// Thin wrapper around the Claude Messages API. Every feature that uses it has a
// non-AI fallback, so the app works without an API key.
export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function askClaude({ system, prompt, maxTokens = 600, timeoutMs = 12000 }) {
  if (!aiEnabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error("Claude API error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  } catch (err) {
    console.error("Claude API request failed:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}
