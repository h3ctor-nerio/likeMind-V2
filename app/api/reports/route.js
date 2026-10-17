import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str, oid } from "@/lib/http";
import { assessUser } from "@/lib/trust";

const KINDS = { thought: "thoughts", reply: "replies", message: "messages", event: "events", group: "groups" };
const HIDE_AFTER = 3; // reports from different people before a thought is hidden pending review

export const POST = route(
  async (req, { user }) => {
    const body = await readJson(req);
    const collection = KINDS[body.kind];
    const id = oid(body.id);
    if (!collection || !id) return fail("Choose something to report.");
    const reason = str(body.reason, 300) || "No reason given";
    const db = await getDb();
    const target = await db.collection(collection).findOne({ _id: id });
    if (!target) return fail("That content no longer exists.", 404);

    const dup = await db.collection("reports").findOne({ kind: body.kind, targetId: id, reporterId: user._id });
    if (dup) return json({ ok: true, note: "You've already reported this. Our team will review it." });

    await db.collection("reports").insertOne({
      kind: body.kind,
      targetId: id,
      reporterId: user._id,
      reason,
      excerpt: String(target.text || target.title || target.name || "").slice(0, 300),
      status: "open",
      createdAt: new Date(),
    });
    if (body.kind === "thought") {
      const updated = await db.collection("thoughts").findOneAndUpdate({ _id: id }, { $inc: { reportCount: 1 } }, { returnDocument: "after" });
      if (updated?.reportCount >= HIDE_AFTER && updated.status === "published") {
        await db.collection("thoughts").updateOne({ _id: id }, { $set: { status: "in_review", reviewNote: "Hidden after several reports while our team takes a look." } });
      }
    }
    const authorId = target.authorId || target.senderId || target.organizerId || target.createdBy;
    if (authorId) {
      const author = await db.collection("users").findOne({ _id: authorId });
      if (author) await assessUser(db, author);
    }
    return json({ ok: true, note: "Thanks. A person on our team will review this." });
  },
  { auth: true }
);
