import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str, oid } from "@/lib/http";
import { checkContent, logBlocked } from "@/lib/moderation";
import { profileView } from "@/lib/views";

async function loadConnection(db, id, user) {
  const c = await db.collection("connections").findOne({ _id: oid(id), status: "accepted" });
  if (!c) return null;
  const me = String(user._id);
  if (String(c.fromId) !== me && String(c.toId) !== me) return null;
  return c;
}

export const GET = route(
  async (req, { user, params }) => {
    const db = await getDb();
    const c = await loadConnection(db, params.id, user);
    if (!c) return fail("This chat isn't available. Chats open after both people agree to connect.", 404);
    const otherId = String(c.fromId) === String(user._id) ? c.toId : c.fromId;
    const other = await db.collection("users").findOne({ _id: otherId });
    const since = new URL(req.url).searchParams.get("since");
    const filter = { connectionId: c._id };
    if (since) filter.createdAt = { $gt: new Date(since) };
    const msgs = await db.collection("messages").find(filter).sort({ createdAt: 1 }).limit(500).toArray();

    // Once connected, both people can see each other's profile and what they share.
    const mine = user.profile || {};
    const theirs = other?.profile || {};
    const pool = (p) => [...(p.interests || []), ...(p.skills || []), ...(p.strengths || []), ...(p.tags || [])];
    const theirSet = new Set(pool(theirs));
    const shared = [...new Set(pool(mine))].filter((x) => theirSet.has(x));

    return json({
      other: other ? profileView(other, { full: true }) : { displayName: "Former member" },
      shared,
      messages: msgs.map((m) => ({
        id: String(m._id),
        text: m.text,
        mine: String(m.senderId) === String(user._id),
        senderName: m.senderName,
        createdAt: m.createdAt,
      })),
    });
  },
  { auth: true }
);

export const POST = route(
  async (req, { user, params }) => {
    const db = await getDb();
    const c = await loadConnection(db, params.id, user);
    if (!c) return fail("This chat isn't available.", 404);
    const text = str((await readJson(req)).text, 1000);
    if (!text) return fail("Write a message first.");
    const check = await checkContent(text, "message");
    if (check.status === "blocked") {
      await logBlocked(user._id, "message", [{ key: "text", label: "your message", flags: check.flags }]);
      return fail(check.note, 422);
    }
    const doc = { connectionId: c._id, senderId: user._id, senderName: user.displayName, text, createdAt: new Date() };
    const { insertedId } = await db.collection("messages").insertOne(doc);
    await db.collection("connections").updateOne({ _id: c._id }, { $set: { lastMessageAt: doc.createdAt } });
    return json({ message: { id: String(insertedId), text, mine: true, senderName: user.displayName, createdAt: doc.createdAt }, note: check.note });
  },
  { auth: true }
);
