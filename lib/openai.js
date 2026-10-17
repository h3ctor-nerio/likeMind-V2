// OpenAI helpers: text generation, moderation, and Realtime transcription sessions.
const BASE = "https://api.openai.com/v1";

export function openaiEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function headers() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` };
}

async function post(path, body, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: controller.signal });
    if (!res.ok) {
      console.error(`OpenAI ${path} error`, res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`OpenAI ${path} request failed:`, err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Plain text completion. Returns the text, or null on failure. */
export async function openaiText({ system, prompt, maxTokens = 600, timeoutMs }) {
  if (!openaiEnabled()) return null;
  const data = await post(
    "/chat/completions",
    {
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      // Reasoning models spend part of this budget thinking, so leave headroom.
      max_completion_tokens: Math.max(1500, maxTokens * 3),
    },
    timeoutMs
  );
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

/**
 * OpenAI's moderation model (free to use). Returns { flags: string[], support: boolean } or null.
 */
export async function openaiModerate(text) {
  if (!openaiEnabled()) return null;
  const data = await post("/moderations", { model: "omni-moderation-latest", input: String(text).slice(0, 4000) }, 8000);
  const r = data?.results?.[0];
  if (!r) return null;
  const hit = Object.entries(r.categories || {}).filter(([, v]) => v).map(([k]) => k);
  const support = hit.some((k) => k.startsWith("self-harm"));
  // Self-harm is handled with support resources rather than treated as a violation.
  const flags = hit.filter((k) => !k.startsWith("self-harm"));
  return { flags, support };
}

const ISO = {
  english: "en", spanish: "es", chinese: "zh", vietnamese: "vi", tagalog: "tl", arabic: "ar", french: "fr",
  "haitian creole": "ht", korean: "ko", russian: "ru", portuguese: "pt", hindi: "hi",
};

async function mintSecret(session) {
  let res;
  try {
    res = await fetch(`${BASE}/realtime/client_secrets`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ expires_after: { anchor: "created_at", seconds: 120 }, session }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    return { error: `Couldn't reach OpenAI (${err.message}).`, status: 0 };
  }
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    console.error("OpenAI /realtime/client_secrets error", res.status, text);
    return { error: data?.error?.message || `OpenAI returned status ${res.status}.`, status: res.status };
  }
  const value = data.value || data.client_secret?.value;
  if (!value) return { error: "OpenAI didn't return a voice token.", status: 500 };
  return { value, expiresAt: data.expires_at || data.client_secret?.expires_at || null };
}

/**
 * Mint a short-lived client secret for a Realtime transcription session.
 * The browser uses it to stream microphone audio straight to OpenAI over WebRTC,
 * so audio never passes through (or is stored by) our server.
 * Tries the streaming model first, then a simpler setup with gpt-4o-transcribe.
 * Returns { value, expiresAt } or { error, status }.
 */
export async function createTranscriptionSecret({ language } = {}) {
  if (!openaiEnabled()) return { error: "OPENAI_API_KEY is not set.", status: 501 };
  const iso = ISO[String(language || "").toLowerCase()];
  const withLang = (t) => (iso ? { ...t, language: iso } : t);

  const preferred = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-realtime-whisper";
  const attempts = [
    {
      type: "transcription",
      audio: {
        input: {
          noise_reduction: { type: "near_field" },
          transcription: withLang({ model: preferred }),
          turn_detection: { type: "server_vad", silence_duration_ms: 700 },
        },
      },
    },
    {
      type: "transcription",
      audio: { input: { transcription: withLang({ model: "gpt-4o-transcribe" }), turn_detection: { type: "server_vad" } } },
    },
  ];

  let last;
  for (const session of attempts) {
    last = await mintSecret(session);
    if (last.value) return last;
    // Only a rejected setup (bad model or field) is worth retrying; key or billing problems are not.
    if (![400, 404, 422].includes(last.status)) break;
  }
  return last;
}

/** Moderate many texts in batches (used by the admin scan). Returns one result per input, or nulls. */
export async function openaiModerateMany(texts) {
  if (!openaiEnabled()) return texts.map(() => null);
  const out = [];
  for (let i = 0; i < texts.length; i += 32) {
    const batch = texts.slice(i, i + 32).map((t) => String(t || " ").slice(0, 4000));
    const data = await post("/moderations", { model: "omni-moderation-latest", input: batch }, 20000);
    const results = data?.results || [];
    batch.forEach((_, j) => {
      const r = results[j];
      if (!r) return out.push(null);
      const hit = Object.entries(r.categories || {}).filter(([, v]) => v).map(([k]) => k);
      out.push({ flags: hit.filter((k) => !k.startsWith("self-harm")), support: hit.some((k) => k.startsWith("self-harm")) });
    });
  }
  return out;
}
