// One entry point for AI features. Uses OpenAI when OPENAI_API_KEY is set,
// otherwise Claude when ANTHROPIC_API_KEY is set, otherwise nothing (rule-based fallbacks apply).
import { openaiEnabled, openaiText, openaiModerate } from "./openai";
import { aiEnabled as claudeEnabled, askClaude } from "./claude";
export { parseJson } from "./claude";

export function aiProvider() {
  if (openaiEnabled()) return "openai";
  if (claudeEnabled()) return "anthropic";
  return null;
}

export function aiEnabled() {
  return aiProvider() !== null;
}

export async function askAI(opts) {
  const p = aiProvider();
  if (p === "openai") return openaiText(opts);
  if (p === "anthropic") return askClaude(opts);
  return null;
}

export { openaiModerate };
