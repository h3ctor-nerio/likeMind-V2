import { getDb } from "@/lib/mongodb";
import { route, json, fail } from "@/lib/http";
import { openaiEnabled, createTranscriptionSecret } from "@/lib/openai";

const PER_HOUR = 20;

// Returns a 2-minute client secret so the browser can stream speech to OpenAI for live transcription.
// Our API key never reaches the browser, and the audio never touches our server.
export const POST = route(
  async (req, { user }) => {
    if (!openaiEnabled()) return fail("Voice posting needs OPENAI_API_KEY in the server settings.", 501);
    const db = await getDb();
    const recent = await db.collection("voice_sessions").countDocuments({ userId: user._id, createdAt: { $gt: new Date(Date.now() - 3600 * 1000) } });
    if (recent >= PER_HOUR) return fail("You've used voice a lot this hour. Type your thought, or try voice again later.", 429);

    const secret = await createTranscriptionSecret({ language: user.prefs?.languages?.[0] });
    if (!secret.value) {
      const reason =
        secret.status === 401
          ? "OpenAI rejected the API key. Check OPENAI_API_KEY and restart or redeploy."
          : secret.status === 429
            ? "OpenAI says the account has no credit left or hit a rate limit. Check Billing at platform.openai.com."
            : secret.status === 403
              ? "This OpenAI project doesn't have access to realtime transcription. Check the key's project permissions."
              : `OpenAI couldn't start voice: ${secret.error}`;
      return fail(reason, 502);
    }
    await db.collection("voice_sessions").insertOne({ userId: user._id, createdAt: new Date() });
    return json({ clientSecret: secret.value, expiresAt: secret.expiresAt });
  },
  { auth: true }
);
