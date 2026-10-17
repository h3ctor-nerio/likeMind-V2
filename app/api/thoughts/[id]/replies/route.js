import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str, oid } from "@/lib/http";
import { checkContent, logBlocked, isHarmful } from "@/lib/moderation";
import { canSeeThought } from "@/lib/visibility";

export const POST = route(
  async (req, { user, params }) => {
    const id = oid(params.id);
    const db = await getDb();
    const t = id && (await db.collection("thoughts").findOne({ _id: id }));
    if (!canSeeThought(t, user) || t.status !== "published") return fail("This thought isn't available.", 404);
    if (!t.allowReplies) return fail("The writer turned off replies for this thought.", 403);
    const text = str((await readJson(req)).text, 400);
    if (text.length < 2) return fail("Write a reply first.");
    const check = await checkContent(text, "reply");
    const doc = {
      thoughtId: id,
      authorId: user._id,
      authorName: user.displayName,
      text,
      status: check.status === "published" ? "published" : "in_review",
      moderation: { flags: check.flags },
      createdAt: new Date(),
    };
    const { insertedId } = await db.collection("replies").insertOne(doc);
    if (check.flags.some(isHarmful)) await logBlocked(user._id, "reply", [{ key: "text", label: "your reply", flags: check.flags }]);
    if (doc.status === "published") await db.collection("thoughts").updateOne({ _id: id }, { $inc: { replyCount: 1 } });
    return json({
      reply: { id: String(insertedId), text, author: user.displayName, isMine: true, status: doc.status, createdAt: doc.createdAt },
      note: check.note,
    });
  },
  { auth: true }
);
