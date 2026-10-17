import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str, list, oid } from "@/lib/http";
import { checkContent, logBlocked, isHarmful } from "@/lib/moderation";
import { approximate } from "@/lib/geo";
import { thoughtView } from "@/lib/views";
import { thoughtFilter } from "@/lib/visibility";

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const GET = route(async (req, { user }) => {
  const sp = new URL(req.url).searchParams;
  const db = await getDb();
  let filter;

  if (sp.get("mine") === "1") {
    if (!user) return fail("Sign in to see your thoughts.", 401);
    filter = { authorId: user._id, status: { $ne: "removed" } };
  } else if (sp.get("saved") === "1") {
    if (!user) return fail("Sign in to see saved thoughts.", 401);
    filter = { ...thoughtFilter(user), _id: { $in: user.savedThoughts || [] } };
  } else if (sp.get("liked") === "1") {
    if (!user) return fail("Sign in to see thoughts you liked.", 401);
    filter = { ...thoughtFilter(user), "reactions.like": String(user._id) };
  } else {
    filter = thoughtFilter(user);
    const tag = str(sp.get("tag"), 40).toLowerCase().replace(/^#/, "");
    if (tag) filter.tags = tag;
    const q = str(sp.get("q"), 80);
    if (q) filter.text = { $regex: escape(q), $options: "i" };
    const sinceHours = Number(sp.get("since"));
    if (sinceHours > 0) filter.createdAt = { $gte: new Date(Date.now() - sinceHours * 3600 * 1000) };
    if (sp.get("likedOnly") === "1" && user) filter["reactions.like"] = String(user._id);
    const promptId = oid(sp.get("promptId"));
    if (promptId) filter.promptId = promptId;
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));
    const km = Number(sp.get("km"));
    if (sp.get("lat") && Number.isFinite(lat) && Number.isFinite(lng) && km > 0) {
      filter.location = { $geoWithin: { $centerSphere: [[lng, lat], Math.min(km, 5000) / 6378.1] } };
    }
  }

  const limit = Math.min(300, Number(sp.get("limit")) || 150);
  const docs = await db.collection("thoughts").find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
  return json({ thoughts: docs.map((t) => thoughtView(t, user)) });
});

export const POST = route(
  async (req, { user }) => {
    const body = await readJson(req);
    const text = str(body.text, 500);
    if (text.length < 3) return fail("Write at least a few words to share a thought.");

    const db = await getDb();
    const recent = await db.collection("thoughts").countDocuments({
      authorId: user._id,
      createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (recent >= 10) return fail("You've shared 10 thoughts in the last hour. Take a breather and try again later.", 429);

    const precision = ["neighborhood", "town", "region"].includes(body.precision) ? body.precision : "town";
    const location = body.location ? approximate(body.location.lat, body.location.lng, precision) : null;
    const audience = user.isMinor ? "everyone" : body.audience === "adults" ? "adults" : "everyone";
    let promptId = oid(body.promptId);
    if (promptId && !(await db.collection("prompts").findOne({ _id: promptId, active: true }))) promptId = null;

    const check = await checkContent(text, "thought");
    const doc = {
      authorId: user._id,
      authorName: user.displayName,
      showName: Boolean(body.showName),
      text,
      tags: list(body.tags, 6, 30),
      audience,
      allowReplies: body.allowReplies !== false,
      allowConnections: Boolean(body.allowConnections),
      location,
      precision,
      areaName: location ? str(body.areaName, 80) : "",
      language: str(body.language, 30),
      promptId,
      status: check.status === "published" ? "published" : "in_review",
      moderation: { flags: check.flags, support: check.support },
      reviewNote: check.note,
      reactions: { like: [], relate: [], support: [], insight: [] },
      replyCount: 0,
      reportCount: 0,
      createdAt: new Date(),
    };
    const { insertedId } = await db.collection("thoughts").insertOne(doc);
    if (check.flags.some(isHarmful)) await logBlocked(user._id, "thought", [{ key: "text", label: "your thought", flags: check.flags }]);
    return json({ thought: thoughtView({ ...doc, _id: insertedId }, user), note: check.note, status: doc.status, support: check.support });
  },
  { auth: true }
);
