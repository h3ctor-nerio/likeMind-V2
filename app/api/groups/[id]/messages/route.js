import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str, oid } from "@/lib/http";
import { checkContent, logBlocked } from "@/lib/moderation";
import { isMember } from "@/lib/groups";

async function load(db, id, user) {
  const g = await db.collection("groups").findOne({ _id: oid(id), status: { $ne: "removed" } });
  return g && isMember(g, user) ? g : null;
}

export const GET = route(
  async (req, { user, params }) => {
    const db = await getDb();
    const g = await load(db, params.id, user);
    if (!g) return fail("Join this group to see its conversation.", 403);
    const msgs = await db.collection("messages").find({ groupId: g._id }).sort({ createdAt: -1 }).limit(200).toArray();
    return json({
      messages: msgs.reverse().map((m) => ({ id: String(m._id), text: m.text, senderName: m.senderName, mine: String(m.senderId) === String(user._id), createdAt: m.createdAt })),
    });
  },
  { auth: true }
);

export const POST = route(
  async (req, { user, params }) => {
    const db = await getDb();
    const g = await load(db, params.id, user);
    if (!g) return fail("Join this group to post.", 403);
    const text = str((await readJson(req)).text, 1000);
    if (!text) return fail("Write a message first.");
    const check = await checkContent(text, "message");
    if (check.status === "blocked") {
      await logBlocked(user._id, "message", [{ key: "text", label: "your message", flags: check.flags }]);
      return fail(check.note, 422);
    }
    const doc = { groupId: g._id, senderId: user._id, senderName: user.displayName, text, createdAt: new Date() };
    const { insertedId } = await db.collection("messages").insertOne(doc);
    return json({ message: { id: String(insertedId), text, senderName: user.displayName, mine: true, createdAt: doc.createdAt } });
  },
  { auth: true }
);
