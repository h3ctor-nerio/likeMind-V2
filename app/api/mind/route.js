import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, oid } from "@/lib/http";
import { getMindBatch } from "@/lib/mind";

// GET: the current batch of Mind suggestions (a new batch at most every 10 minutes).
export const GET = route(
  async (req, { user }) => {
    if (user.privacy?.mindSuggestions === false) return json({ off: true, suggestions: [] });
    const hasProfile = ["interests", "skills", "strengths", "tags"].some((k) => user.profile?.[k]?.length) || user.profile?.values;
    const batch = await getMindBatch(user);
    return json({ ...batch, hasProfile: Boolean(hasProfile), discoverable: Boolean(user.privacy?.discoverable) });
  },
  { auth: true }
);

// POST { action: "dismiss", userId } | { action: "off" } | { action: "on" }
export const POST = route(
  async (req, { user }) => {
    const body = await readJson(req);
    const db = await getDb();
    const users = db.collection("users");
    if (body.action === "dismiss") {
      const id = oid(body.userId);
      if (!id) return fail("Missing person.");
      await users.updateOne({ _id: user._id }, { $addToSet: { mindHidden: id } });
    } else if (body.action === "off" || body.action === "on") {
      await users.updateOne({ _id: user._id }, { $set: { "privacy.mindSuggestions": body.action === "on" } });
    } else {
      return fail("Unknown action.");
    }
    return json({ ok: true });
  },
  { auth: true }
);
