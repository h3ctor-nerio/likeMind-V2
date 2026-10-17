import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str, oid } from "@/lib/http";
import { checkContent } from "@/lib/moderation";
import { assessUser, canSendRequests } from "@/lib/trust";

function view(c, me) {
  const outgoing = String(c.fromId) === me;
  return {
    id: String(c._id),
    status: c.status,
    outgoing,
    otherName: outgoing ? c.toName : c.fromName,
    note: c.note || "",
    context: c.context || "",
    createdAt: c.createdAt,
    lastMessageAt: c.lastMessageAt || null,
  };
}

export const GET = route(
  async (req, { user }) => {
    const db = await getDb();
    const me = String(user._id);
    const docs = await db
      .collection("connections")
      .find({ $or: [{ fromId: user._id }, { toId: user._id }], status: { $in: ["pending", "accepted"] } })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .toArray();
    const all = docs.map((c) => view(c, me));
    return json({
      incoming: all.filter((c) => c.status === "pending" && !c.outgoing),
      outgoing: all.filter((c) => c.status === "pending" && c.outgoing),
      connected: all.filter((c) => c.status === "accepted"),
    });
  },
  { auth: true }
);

// Request a connection with the writer of a thought, or with someone who replied to your thought.
export const POST = route(
  async (req, { user }) => {
    if (!canSendRequests(user)) {
      return fail("New connection requests are paused until a person on our team reviews your account. Answer the questions on your account check page to speed this up.", 403);
    }
    const body = await readJson(req);
    const db = await getDb();
    let target = null;
    let context = "";

    if (body.thoughtId) {
      const t = await db.collection("thoughts").findOne({ _id: oid(body.thoughtId), status: "published" });
      if (!t) return fail("This thought isn't available.", 404);
      if (!t.allowConnections) return fail("The writer isn't open to connection requests on this thought.", 403);
      target = await db.collection("users").findOne({ _id: t.authorId });
      context = `About a thought: “${t.text.slice(0, 80)}${t.text.length > 80 ? "…" : ""}”`;
    } else if (body.replyId) {
      const r = await db.collection("replies").findOne({ _id: oid(body.replyId), status: "published" });
      const t = r && (await db.collection("thoughts").findOne({ _id: r.thoughtId }));
      if (!r || !t || String(t.authorId) !== String(user._id)) return fail("You can connect with people who replied to your own thoughts.", 403);
      target = await db.collection("users").findOne({ _id: r.authorId });
      context = `Replied to your thought: “${r.text.slice(0, 80)}${r.text.length > 80 ? "…" : ""}”`;
    } else if (body.userId) {
      // From a Mind suggestion: only people who opted in to being suggested.
      target = await db.collection("users").findOne({ _id: oid(body.userId), "privacy.discoverable": true });
      if (!target) return fail("This person isn't available for suggestions anymore.", 404);
      context = "Suggested by Mind";
    } else {
      return fail("Choose a thought or reply to connect through.");
    }

    if (!target) return fail("That person is no longer on LikeMinds.", 404);
    if (String(target._id) === String(user._id)) return fail("That's your own thought.");
    if (Boolean(target.isMinor) !== Boolean(user.isMinor)) {
      return fail("For safety, teens and adults can't connect directly. You can still react and reply.", 403);
    }

    const note = str(body.note, 200);
    if (note) {
      const check = await checkContent(note, "reply");
      if (check.status !== "published") return fail("Your note couldn't be sent as written. Keep it friendly and leave out contact details.");
    }

    const pairKey = [String(user._id), String(target._id)].sort().join(":");
    const existing = await db.collection("connections").findOne({ pairKey });
    if (existing) {
      if (existing.status === "accepted") return fail("You're already connected. Open your chat from Connections.");
      if (existing.status === "pending") return fail("A request is already waiting for a response.");
      if (existing.status === "declined" && String(existing.fromId) === String(user._id)) {
        return fail("This person isn't open to connecting right now.");
      }
      await db.collection("connections").deleteOne({ _id: existing._id });
    }

    const doc = {
      pairKey,
      fromId: user._id,
      fromName: user.displayName,
      toId: target._id,
      toName: target.displayName,
      note,
      context,
      status: "pending",
      createdAt: new Date(),
    };
    const { insertedId } = await db.collection("connections").insertOne(doc);
    await assessUser(db, user);
    return json({ connection: view({ ...doc, _id: insertedId }, String(user._id)) });
  },
  { auth: true }
);
