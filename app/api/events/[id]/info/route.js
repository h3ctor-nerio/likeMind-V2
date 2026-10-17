import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str, oid } from "@/lib/http";

// The host answers the questions from a safety check. A person then reviews the answers.
export const POST = route(
  async (req, { user, params }) => {
    const db = await getDb();
    const e = await db.collection("events").findOne({ _id: oid(params.id), organizerId: user._id, status: "needs_info" });
    if (!e) return fail("This event isn't waiting for information.", 404);
    const body = await readJson(req);
    const questions = e.review?.questions || [];
    const answers = questions.map((q, i) => ({ question: q, answer: str(body.answers?.[i], 1000) }));
    if (answers.some((a) => a.answer.length < 3)) return fail("Please answer each question, even briefly.");
    await db.collection("events").updateOne(
      { _id: e._id },
      { $set: { status: "info_submitted", "review.answers": answers, "review.submittedAt": new Date() } }
    );
    return json({ ok: true });
  },
  { auth: true }
);
