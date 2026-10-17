import { getDb } from "@/lib/mongodb";
import { isVerifiedOrganizer } from "@/lib/auth";
import { route, json, fail, readJson, str, oid } from "@/lib/http";

// Community prompts: hosts and local agencies ask an open question; people answer with
// anonymous thoughts; hosts see aggregated themes, never who said what.
export const GET = route(async () => {
  const db = await getDb();
  const prompts = await db.collection("prompts").find({ active: true }).sort({ createdAt: -1 }).limit(10).toArray();
  const counts = await db
    .collection("thoughts")
    .aggregate([{ $match: { promptId: { $in: prompts.map((p) => p._id) }, status: "published" } }, { $group: { _id: "$promptId", n: { $sum: 1 } } }])
    .toArray();
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  return json({
    prompts: prompts.map((p) => ({ id: String(p._id), question: p.question, orgName: p.orgName, responses: byId[String(p._id)] || 0, createdAt: p.createdAt })),
  });
});

export const POST = route(
  async (req, { user }) => {
    if (!isVerifiedOrganizer(user)) return fail("Only verified hosts can post community prompts.", 403);
    const body = await readJson(req);
    const db = await getDb();
    if (body.closeId) {
      await db.collection("prompts").updateOne({ _id: oid(body.closeId), createdBy: user._id }, { $set: { active: false } });
      return json({ ok: true });
    }
    const question = str(body.question, 200);
    if (question.length < 10) return fail("Write the prompt as a full question.");
    const { insertedId } = await db.collection("prompts").insertOne({
      question,
      orgName: user.organizer?.orgName || user.displayName,
      createdBy: user._id,
      active: true,
      createdAt: new Date(),
    });
    return json({ id: String(insertedId) });
  },
  { auth: true }
);
