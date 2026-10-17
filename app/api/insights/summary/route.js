import { getDb } from "@/lib/mongodb";
import { isVerifiedOrganizer } from "@/lib/auth";
import { route, json, fail, readJson, oid } from "@/lib/http";
import { askAI, aiEnabled } from "@/lib/ai";

const MIN_RESPONSES = 5;

export const POST = route(
  async (req, { user }) => {
    if (!isVerifiedOrganizer(user)) return fail("Community insights are available to verified hosts.", 403);
    if (!aiEnabled()) return fail("Theme summaries need an AI key. Add OPENAI_API_KEY to .env.local to turn them on.", 501);
    const { promptId } = await readJson(req);
    const db = await getDb();
    const p = await db.collection("prompts").findOne({ _id: oid(promptId), createdBy: user._id });
    if (!p) return fail("Prompt not found.", 404);
    const docs = await db.collection("thoughts").find({ promptId: p._id, status: "published" }).project({ text: 1 }).limit(200).toArray();
    if (docs.length < MIN_RESPONSES) return fail(`Summaries unlock after ${MIN_RESPONSES} responses, so no single answer can be singled out.`);
    const summary = await askAI({
      maxTokens: 700,
      system:
        "You summarize anonymous community responses for a local organizer. Describe 3–5 recurring themes in plain language, " +
        "each with a rough share of responses (e.g. 'about a third'). Never quote a response word for word, never include names, " +
        "places smaller than a town, or details that could identify a person. Note any clear disagreements. End with one sentence " +
        "on what the organizer could try next.",
      prompt: `Prompt: ${p.question}\n\nResponses:\n${docs.map((d, i) => `${i + 1}. ${d.text}`).join("\n")}`,
    });
    if (!summary) return fail("The summary couldn't be generated right now. Try again in a moment.", 503);
    return json({ summary, responses: docs.length });
  },
  { auth: true }
);
