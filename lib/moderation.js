// Content checks for everything people write: thoughts, replies, messages, profiles, events, groups.
// Runs instantly when something is submitted (never later). Two layers:
//   1. Rules (always on): threats, harassment, crisis language, contact details, links.
//   2. AI (when OPENAI_API_KEY is set): OpenAI's moderation model, which also covers hate,
//      harassment, violence, sexual content, and self-harm in many languages.
// The rule lists are deliberately short and contain no slurs; broad coverage comes from the AI layer.
import { askAI, parseJson, openaiModerate, aiProvider } from "./ai";
import { getDb } from "./mongodb";
import { assessUser } from "./trust";

const CRISIS = [
  "kill myself", "end my life", "suicide", "suicidal", "want to die", "hurt myself", "self harm", "self-harm",
  "no reason to live", "better off without me",
];
const THREATS = [
  "kill you", "i will kill", "i'll kill", "gonna kill", "kys", "go die", "you should die", "i will hurt you", "i'll hurt you",
  "beat you up", "i know where you live", "watch your back", "you're dead", "shoot you", "stab you", "burn your house",
];
const HARASSMENT = ["you're worthless", "youre worthless", "nobody likes you", "you're disgusting", "you are disgusting", "go away and die"];
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const ADDRESS = /\b(my address is|i live at)\b/i;
const LINK = /https?:\/\/|www\./i;

export const SUPPORT_NOTE =
  "If you're going through something heavy, you don't have to hold it alone. In the US you can call or text 988 to reach the Suicide & Crisis Lifeline any time. Outside the US, contact your local emergency number or a local crisis line.";

/** Flags that mean "harmful to others": these are never published as written. */
export function isHarmful(flag) {
  return /threat|harass|hate|violence|sexual|AI:/i.test(flag);
}

/** Rule layer only. Returns { flags, support }. */
export function ruleFlags(text, context = "thought") {
  const lower = ` ${String(text || "").toLowerCase()} `;
  const flags = [];
  let support = false;
  if (CRISIS.some((p) => lower.includes(p))) {
    flags.push("possible crisis");
    support = true;
  }
  if (THREATS.some((p) => lower.includes(p))) flags.push("possible threat");
  if (HARASSMENT.some((p) => lower.includes(p))) flags.push("possible harassment");
  // Contact details and links are fine in private chats after both people agreed to connect, and in event details.
  if (context !== "message" && context !== "event") {
    if (EMAIL.test(text) || PHONE.test(text) || ADDRESS.test(text)) flags.push("personal contact details");
    if (LINK.test(text)) flags.push("link");
  }
  return { flags, support };
}

/**
 * Check text before it becomes visible to others.
 * context: "thought" | "reply" | "message" | "event" | "profile"
 * Returns { status: "published" | "in_review" | "blocked", flags: [], note, support }
 */
export async function checkContent(text, context = "thought") {
  const { flags, support: ruleSupport } = ruleFlags(text, context);
  let support = ruleSupport;

  if (flags.length === 0) {
    const ai = await aiCheck(text, context);
    if (ai?.flags?.length) flags.push(...ai.flags.map((f) => `AI: ${f}`));
    if (ai?.support) support = true;
  }

  if (context === "message") {
    // Private chats are not pre-screened by people; only clearly hostile messages are stopped.
    if (flags.some(isHarmful)) return { status: "blocked", flags, support, note: "This message reads as hostile or threatening. Rephrase it to send." };
    return { status: "published", flags, support, note: support ? SUPPORT_NOTE : "" };
  }

  if (flags.length === 0) return { status: "published", flags, support, note: "" };

  let note = "Thanks for sharing. A person on our team will take a quick look before this appears to others.";
  if (flags.includes("personal contact details")) {
    note += " To protect your privacy, share contact details in a private chat after you've both agreed to connect.";
  }
  if (support) note += " " + SUPPORT_NOTE;
  return { status: "in_review", flags, support, note };
}

/**
 * Check several labeled fields at once (a profile, an event, a group).
 * fields: { key: { label: "your intro", text } }
 * Returns a list of problems: [{ key, label, flags }]. Empty list = fine.
 */
export async function screenFields(fields, context = "profile") {
  const entries = Object.entries(fields).filter(([, f]) => f.text && String(f.text).trim());
  const problems = [];
  for (const [key, f] of entries) {
    const { flags } = ruleFlags(String(f.text), context);
    if (flags.length) problems.push({ key, label: f.label, flags });
  }
  if (problems.length || !entries.length) return problems;

  // One AI call for everything; only if it objects do we check field by field to say which part.
  const combined = entries.map(([, f]) => String(f.text)).join("\n");
  const ai = await aiCheck(combined, context);
  if (!ai?.flags?.length) return problems;
  for (const [key, f] of entries) {
    const r = await aiCheck(String(f.text), context);
    if (r?.flags?.length) problems.push({ key, label: f.label, flags: r.flags.map((x) => `AI: ${x}`) });
  }
  if (!problems.length) problems.push({ key: "all", label: "the text", flags: ai.flags.map((x) => `AI: ${x}`) });
  return problems;
}

/** A direct, respectful message that names exactly which parts need changing. */
export function problemMessage(problems) {
  const labels = [...new Set(problems.map((p) => p.label))];
  const list = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0];
  const harmful = problems.some((p) => p.flags.some(isHarmful));
  const contact = problems.some((p) => p.flags.includes("personal contact details"));
  const link = problems.some((p) => p.flags.includes("link"));
  if (harmful) {
    return `Some wording in ${list} can't be published as written. LikeMinds doesn't allow threats, harassment, hate, or sexual content. Please rephrase that part and save again.`;
  }
  if (contact) return `Please remove the phone number, email, or address from ${list}. You can share contact details in a private chat once you've both agreed to connect.`;
  if (link) return `Please remove the web link from ${list}.`;
  return `Please revise ${list} and try again.`;
}

/** Keep a record of blocked attempts. Repeated attempts become a signal for the account check. */
export async function logBlocked(userId, context, problems) {
  try {
    const db = await getDb();
    await db.collection("moderation_log").insertOne({
      userId,
      context,
      fields: problems.map((p) => p.key),
      flags: problems.flatMap((p) => p.flags),
      harmful: problems.some((p) => p.flags.some(isHarmful)),
      createdAt: new Date(),
    });
    // Repeated harmful attempts can lead to an account check (see lib/trust.js).
    if (problems.some((p) => p.flags.some(isHarmful))) {
      const user = await db.collection("users").findOne({ _id: userId });
      if (user) await assessUser(db, user);
    }
  } catch (err) {
    console.error("moderation_log write failed", err.message);
  }
}

export async function aiCheck(text, context) {
  // OpenAI's dedicated moderation model is fast and free, so prefer it when available.
  if (aiProvider() === "openai") return openaiModerate(text);
  const out = await askAI({
    maxTokens: 200,
    timeoutMs: 8000,
    system:
      "You screen short text for a community-connection app used by teens and adults. " +
      "Respond with JSON only, no prose: {\"flags\": string[], \"support\": boolean}. " +
      "Add a flag only for: harassment, hate, sexual content, threats, violence, scams, or sharing someone's private information. " +
      "Set support to true if the writer may be in crisis or at risk of self-harm. " +
      "Ordinary sadness, loneliness, disagreement, and political opinions are fine and get no flags.",
    prompt: `Context: ${context}\nText:\n"""${String(text).slice(0, 2000)}"""`,
  });
  const parsed = parseJson(out);
  if (!parsed || !Array.isArray(parsed.flags)) return null;
  return { flags: parsed.flags.slice(0, 4).map(String), support: Boolean(parsed.support) };
}

/** Profile fields as labeled text, for screenFields. */
export function profileFields(displayName, profile = {}) {
  const j = (v) => (Array.isArray(v) ? v.join(", ") : v || "");
  return {
    displayName: { label: "your display name", text: displayName || "" },
    intro: { label: "your intro", text: profile.intro },
    values: { label: "what matters to you", text: profile.values },
    aspirations: { label: "what you'd like to do", text: profile.aspirations },
    interests: { label: "your interests", text: j(profile.interests) },
    skills: { label: "your skills", text: j(profile.skills) },
    strengths: { label: "your strengths", text: j(profile.strengths) },
    tags: { label: "your tags", text: j(profile.tags) },
  };
}

export function eventFields(e) {
  return {
    title: { label: "the title", text: e.title },
    description: { label: "the description", text: e.description },
    tags: { label: "the tags", text: (e.tags || []).join(", ") },
    locationName: { label: "the location", text: e.locationName },
    cost: { label: "the cost notes", text: e.cost?.notes },
    access: { label: "the accessibility notes", text: e.accessibility?.notes },
    transport: { label: "the transport notes", text: e.transport?.notes },
  };
}
