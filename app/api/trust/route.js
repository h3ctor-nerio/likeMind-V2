import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str } from "@/lib/http";
import { USER_INTRO } from "@/lib/trust";

// The signed-in member's own check status, and their answers.
export const GET = route(
  async (req, { user }) => {
    const t = user.trust || {};
    if (!["needs_info", "info_submitted", "restricted"].includes(t.status)) return json({ status: "clear" });
    return json({ status: t.status, intro: USER_INTRO, questions: t.questions || [], submittedAt: t.submittedAt || null, note: t.note || "" });
  },
  { auth: true }
);

export const POST = route(
  async (req, { user }) => {
    if (user.trust?.status !== "needs_info") return fail("There's nothing to answer right now.");
    const body = await readJson(req);
    const questions = user.trust.questions || [];
    const answers = questions.map((q, i) => ({ question: q, answer: str(body.answers?.[i], 1000) }));
    if (answers.some((a) => a.answer.length < 3)) return fail("Please answer each question, even briefly.");
    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { "trust.status": "info_submitted", "trust.answers": answers, "trust.submittedAt": new Date() } }
    );
    return json({ ok: true });
  },
  { auth: true }
);
