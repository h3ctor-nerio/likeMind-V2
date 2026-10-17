// Trust & safety checks for events and members.
//
// Fairness rules built into this file:
// 1. Only concrete behaviors are signals. Account age, organization size, language, spelling, names,
//    and where someone is from are NEVER used.
// 2. A request for more information needs a rule-based signal: one strong signal, or two medium ones.
//    AI alone can never cause a request. AI can only soften a request into a quiet moderator check,
//    or add a quiet check the person never sees.
// 3. Nothing is removed or banned automatically. A person reviews every case.
import { askAI, aiEnabled, parseJson } from "./ai";

const RX = {
  offPlatformPayment: /\b(venmo|cash ?app|zelle|paypal|wire transfer|western union|gift ?cards?|bitcoin|crypto|usdt)\b/i,
  personalInfo: /\b(ssn|social security|bank account|routing number|passport|photo of (your|an?) id|id photo|driver'?s licen[sc]e|date of birth|home address)\b/i,
  privateContact: /\b(dm me|text me|whats ?app|telegram|signal me|snap(chat)?|message me privately|contact me privately|kik)\b/i,
  privateHome: /\b(my (house|home|apartment|place|basement)|private residence)\b/i,
  earnings: /\b(earn \$|make money|guaranteed (income|returns?)|investment opportunit|be your own boss|passive income|work from home)\b/i,
  shortLink: /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly|rb\.gy|tiny\.cc)\b/i,
};

// Direct, respectful questions. Each one names exactly what would resolve the concern.
const EVENT_QUESTIONS = {
  offPlatformPayment: "How will attendees pay, and what do they get for it? If payment happens outside LikeMinds, tell us which service and why.",
  personalInfo: "Your event asks attendees for personal details. What information do you need, and why?",
  privateContact: "How will attendees reach you? Tell us why they'd need to message you privately instead of using the event page.",
  teenPrivateSetting: "This event is open to teens. Who will supervise, and is the venue a public place?",
  earnings: "The description mentions earning money. Is this a job, a sale, or a class? Describe what attendees will do.",
  missingPin: "Please confirm the venue's full street address so attendees can find it.",
  shortLink: "Please share the full web address instead of a shortened link, so attendees know where it goes.",
  burst: "You've posted several events today. Are they one series? A sentence about your plans helps.",
};

const USER_QUESTIONS = {
  requestBurst: "You've sent a lot of connection requests today. What kinds of people or activities are you hoping to find?",
  highDecline: "Many of your recent connection requests weren't accepted. Tell us what you're looking for, and we can point you to groups and events that fit.",
  reports: "A few people raised concerns about recent posts or messages. Is there anything you'd like us to know?",
  harmfulWording: "Several things you tried to post this week included wording we don't allow, like threats or insults. Is something going on that we should know about?",
};

export const EVENT_INTRO =
  "Thanks for hosting on LikeMinds. Before this event goes live, we need a little more information. " +
  "This is a routine safety check for events that include certain details, not a judgment about you. Most hosts hear back within a day.";

export const USER_INTRO =
  "We need a little more information from you. This is a routine check that runs on certain activity patterns, not a judgment about you. " +
  "Until a person on our team reviews your answer, you can keep browsing, posting, and chatting with your connections, but you can't send new connection requests.";

function decide(signals) {
  const strong = signals.filter((s) => s.strength === "strong").length;
  const medium = signals.filter((s) => s.strength === "medium").length;
  if (strong >= 1 || medium >= 2) return "needs_info";
  if (signals.length) return "watch";
  return "ok";
}

/** Rule-based signals for an event the host is about to publish. */
export async function eventSignals(db, e, host) {
  const text = `${e.title}\n${e.description}\n${e.cost?.notes || ""}\n${e.locationName || ""}\n${e.onlineLink || ""}`;
  const s = [];
  if (RX.offPlatformPayment.test(text)) s.push({ code: "offPlatformPayment", strength: "strong", label: "Mentions paying through an outside service" });
  if (RX.personalInfo.test(text)) s.push({ code: "personalInfo", strength: "strong", label: "Asks attendees for personal or financial details" });
  // Local hour of the event, using the host's time zone offset sent by their browser.
  const d = new Date(e.startsAt);
  const tz = Number.isFinite(e.tzOffsetMinutes) ? e.tzOffsetMinutes : 0;
  const startHour = Math.floor((((d.getUTCHours() * 60 + d.getUTCMinutes() - tz) % 1440) + 1440) % 1440 / 60);
  const teens = e.ageRange === "teens" || e.ageRange === "all";
  if (teens && e.mode !== "online" && (RX.privateHome.test(text) || startHour >= 21 || startHour < 6)) {
    s.push({ code: "teenPrivateSetting", strength: "strong", label: "Open to teens at a private home or late at night" });
  }
  if (RX.privateContact.test(text)) s.push({ code: "privateContact", strength: "medium", label: "Asks attendees to make contact privately" });
  if (RX.earnings.test(text)) s.push({ code: "earnings", strength: "medium", label: "Promises income or investment returns" });
  if (RX.shortLink.test(text)) s.push({ code: "shortLink", strength: "medium", label: "Uses a shortened link" });
  if (e.mode !== "online" && !e.location) s.push({ code: "missingPin", strength: "low", label: "In-person event without a map pin" });
  const today = await db.collection("events").countDocuments({ organizerId: host._id, createdAt: { $gt: new Date(Date.now() - 24 * 3600 * 1000) } });
  if (today >= 4) s.push({ code: "burst", strength: "medium", label: `${today} events created in the last 24 hours` });
  return s;
}

/** Rule-based signals for a member's recent activity. */
export async function userSignals(db, user) {
  const s = [];
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const sentToday = await db.collection("connections").countDocuments({ fromId: user._id, createdAt: { $gt: dayAgo } });
  if (sentToday >= 15) s.push({ code: "requestBurst", strength: "medium", label: `${sentToday} connection requests in 24 hours` });
  const sentMonth = await db.collection("connections").find({ fromId: user._id, createdAt: { $gt: monthAgo } }).project({ status: 1 }).toArray();
  const declined = sentMonth.filter((c) => c.status === "declined").length;
  if (sentMonth.length >= 5 && declined / sentMonth.length >= 0.8) {
    s.push({ code: "highDecline", strength: "medium", label: `${declined} of ${sentMonth.length} requests declined this month` });
  }
  // Reports from different people about this member's posts, replies, or messages.
  const [thoughtIds, replyIds, messageIds] = await Promise.all([
    db.collection("thoughts").find({ authorId: user._id }).project({ _id: 1 }).toArray(),
    db.collection("replies").find({ authorId: user._id }).project({ _id: 1 }).toArray(),
    db.collection("messages").find({ senderId: user._id, createdAt: { $gt: monthAgo } }).project({ _id: 1 }).toArray(),
  ]);
  const ids = [...thoughtIds, ...replyIds, ...messageIds].map((d) => d._id);
  const reporters = ids.length
    ? await db.collection("reports").distinct("reporterId", { targetId: { $in: ids }, createdAt: { $gt: monthAgo } })
    : [];
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const harmfulAttempts = await db.collection("moderation_log").countDocuments({ userId: user._id, harmful: true, createdAt: { $gt: weekAgo } });
  if (harmfulAttempts >= 4) s.push({ code: "harmfulWording", strength: "strong", label: `${harmfulAttempts} threatening or offensive submissions this week` });
  else if (harmfulAttempts >= 2) s.push({ code: "harmfulWording", strength: "medium", label: `${harmfulAttempts} threatening or offensive submissions this week` });
  if (reporters.length >= 3) s.push({ code: "reports", strength: "strong", label: `Reports from ${reporters.length} different people this month` });
  else if (reporters.length === 2) s.push({ code: "reports", strength: "medium", label: "Reports from 2 different people this month" });
  return s;
}

async function aiSecondLook(kind, content, signals) {
  if (!aiEnabled()) return null;
  const out = await askAI({
    maxTokens: 300,
    timeoutMs: 12000,
    system:
      "You help a community app's moderators. Assume good faith: most hosts and members are ordinary people, many of them new. " +
      "Judge only the content and the listed signals. Never consider the person's name, language, spelling, grammar, nationality, " +
      "organization size, or how new they are. Respond with JSON only: " +
      '{"assessment":"benign"|"unclear"|"concerning","note":"one or two neutral sentences for a moderator"}. ' +
      "Use benign when the signals have an innocent explanation in the content itself (for example, a library that lists PayPal for a book fair).",
    prompt: `Kind: ${kind}\nSignals: ${signals.map((s) => s.label).join("; ") || "none"}\nContent:\n"""${content.slice(0, 3000)}"""`,
  });
  const parsed = parseJson(out);
  if (!parsed || !["benign", "unclear", "concerning"].includes(parsed.assessment)) return null;
  return { assessment: parsed.assessment, note: String(parsed.note || "").slice(0, 400) };
}

/** Decide what happens to a new event. Returns { decision, signals, questions, ai }. */
export async function assessEvent(db, e, host) {
  const signals = await eventSignals(db, e, host);
  let decision = decide(signals);
  const ai = await aiSecondLook("event", `${e.title}\n\n${e.description}\n\nCost notes: ${e.cost?.notes || ""}\nWhere: ${e.locationName || "online"}`, signals);
  const hasStrong = signals.some((s) => s.strength === "strong");
  // AI may soften a medium-only request into a quiet check, and may add a quiet check, but never more.
  if (decision === "needs_info" && !hasStrong && ai?.assessment === "benign") decision = "watch";
  if (decision === "ok" && ai?.assessment === "concerning") decision = "watch";
  const questions = decision === "needs_info" ? [...new Set(signals.map((s) => EVENT_QUESTIONS[s.code]).filter(Boolean))] : [];
  return { decision, signals, questions, ai };
}

/** Re-check a member after activity. Returns null if nothing changes. */
export async function assessUser(db, user) {
  if (["needs_info", "info_submitted", "restricted"].includes(user.trust?.status)) return null;
  // A moderator cleared them recently: give them a fresh start for 30 days.
  if (user.trust?.status === "clear" && user.trust.reviewedAt && Date.now() - new Date(user.trust.reviewedAt).getTime() < 30 * 24 * 3600 * 1000) return null;
  const signals = await userSignals(db, user);
  const decision = decide(signals);
  if (decision === "ok") return null;
  const trust =
    decision === "needs_info"
      ? { status: "needs_info", signals, questions: [...new Set(signals.map((s) => USER_QUESTIONS[s.code]).filter(Boolean))], askedAt: new Date() }
      : { status: "watch", signals, askedAt: new Date() };
  await db.collection("users").updateOne({ _id: user._id }, { $set: { trust } });
  return trust;
}

export function canSendRequests(user) {
  return !["needs_info", "info_submitted", "restricted"].includes(user?.trust?.status);
}
