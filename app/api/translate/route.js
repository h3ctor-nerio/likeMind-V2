import { route, json, fail, readJson, str } from "@/lib/http";
import { askAI, aiEnabled } from "@/lib/ai";

export const POST = route(
  async (req) => {
    if (!aiEnabled()) return fail("Translation needs an AI key. Add OPENAI_API_KEY to .env.local to turn it on.", 501);
    const body = await readJson(req);
    const text = str(body.text, 2000);
    const target = str(body.target, 40) || "English";
    if (!text) return fail("Nothing to translate.");
    const out = await askAI({
      maxTokens: 800,
      system:
        "You translate short personal messages for a community app. Keep the writer's tone and meaning. " +
        "Reply with the translation only. If the text is already in the target language, return it unchanged.",
      prompt: `Translate into ${target}:\n\n${text}`,
    });
    if (!out) return fail("Translation is unavailable right now. Try again in a moment.", 503);
    return json({ translation: out, target });
  },
  { auth: true }
);
