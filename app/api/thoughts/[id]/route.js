import { getDb } from "@/lib/mongodb";
import { route, json, fail, oid } from "@/lib/http";
import { thoughtView } from "@/lib/views";
import { canSeeThought, thoughtFilter } from "@/lib/visibility";
import { similarThoughts } from "@/lib/matching";

export const GET = route(async (req, { user, params }) => {
  const id = oid(params.id);
  const db = await getDb();
  const t = id && (await db.collection("thoughts").findOne({ _id: id }));
  if (!canSeeThought(t, user)) return fail("This thought isn't available. It may have been removed.", 404);

  const me = user ? String(user._id) : null;
  const replyDocs = await db
    .collection("replies")
    .find({ thoughtId: id, $or: [{ status: "published" }, ...(user ? [{ authorId: user._id, status: "in_review" }] : [])] })
    .sort({ createdAt: 1 })
    .toArray();
  const replies = replyDocs.map((r) => ({
    id: String(r._id),
    text: r.text,
    author: r.authorName,
    isMine: me === String(r.authorId),
    status: me === String(r.authorId) ? r.status : undefined,
    createdAt: r.createdAt,
  }));

  const pool = await db.collection("thoughts").find(thoughtFilter(user)).sort({ createdAt: -1 }).limit(400).toArray();
  const similar = similarThoughts(t, pool, 5).map((s) => ({ ...thoughtView(s.item, user), reason: s.reason }));

  let connection = null;
  if (user && !thoughtView(t, user).isMine) {
    const pairKey = [String(user._id), String(t.authorId)].sort().join(":");
    const c = await db.collection("connections").findOne({ pairKey });
    if (c) connection = { id: String(c._id), status: c.status, outgoing: String(c.fromId) === me };
  }

  let prompt = null;
  if (t.promptId) {
    const p = await db.collection("prompts").findOne({ _id: t.promptId });
    if (p) prompt = { id: String(p._id), question: p.question, orgName: p.orgName };
  }

  return json({ thought: thoughtView(t, user), replies, similar, connection, prompt });
});

export const DELETE = route(
  async (req, { user, params }) => {
    const id = oid(params.id);
    const db = await getDb();
    const r = await db.collection("thoughts").updateOne({ _id: id, authorId: user._id }, { $set: { status: "removed", removedAt: new Date() } });
    if (!r.matchedCount) return fail("You can only delete your own thoughts.", 403);
    return json({ ok: true });
  },
  { auth: true }
);
