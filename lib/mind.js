// "Mind": every 10 minutes, suggest 3 people with similar interests, skills, and values,
// each with 2 of their recent posts. Code shortlists; AI (when configured) picks and explains.
// Only people who opted in ("Let Mind suggest me") can be suggested.
import { getDb } from "./mongodb";
import { askAI, aiEnabled, parseJson } from "./ai";
import { recommendPeople } from "./matching";
import { thoughtFilter } from "./visibility";

export const MIND_INTERVAL_MS = 10 * 60 * 1000;
const PER_BATCH = 3;

export async function getMindBatch(viewer) {
  const db = await getDb();
  const col = db.collection("mind_suggestions");
  const latest = await col.findOne({ userId: viewer._id }, { sort: { createdAt: -1 } });
  if (latest && Date.now() - new Date(latest.createdAt).getTime() < MIND_INTERVAL_MS) return hydrate(db, viewer, latest);

  const batch = await generate(db, viewer);
  if (!batch) {
    const empty = { userId: viewer._id, createdAt: new Date(), items: [], source: "none" };
    await col.insertOne(empty);
    return hydrate(db, viewer, empty);
  }
  const doc = { userId: viewer._id, createdAt: new Date(), items: batch.items, source: batch.source };
  await col.insertOne(doc);
  return hydrate(db, viewer, doc);
}

async function generate(db, viewer) {
  const me = viewer._id;
  const conns = await db.collection("connections").find({ $or: [{ fromId: me }, { toId: me }] }).project({ fromId: 1, toId: 1 }).toArray();
  const exclude = new Set([
    String(me),
    ...conns.map((c) => (String(c.fromId) === String(me) ? String(c.toId) : String(c.fromId))),
    ...(viewer.mindHidden || []).map(String),
  ]);

  // Teens are only ever matched with teens, adults with adults.
  const candidates = (
    await db.collection("users").find({ "privacy.discoverable": true, isMinor: Boolean(viewer.isMinor), "profileReview.status": { $ne: "held" } }).limit(500).toArray()
  ).filter((u) => !exclude.has(String(u._id)));
  if (!candidates.length) return null;

  const posts = await db
    .collection("thoughts")
    .find({ ...thoughtFilter(viewer), authorId: { $in: candidates.map((c) => c._id) } })
    .sort({ createdAt: -1 })
    .limit(2000)
    .toArray();
  const postsByUser = {};
  for (const t of posts) (postsByUser[String(t.authorId)] ||= []).push(t);
  const myPosts = await db.collection("thoughts").find({ authorId: me, status: "published" }).sort({ createdAt: -1 }).limit(30).toArray();

  let ranked = recommendPeople(viewer, myPosts, candidates, postsByUser, 10);
  // Rotate: prefer people not suggested in the last two batches, if there are enough others.
  const recent = await db.collection("mind_suggestions").find({ userId: me }).sort({ createdAt: -1 }).limit(2).toArray();
  const recentIds = new Set(recent.flatMap((r) => r.items.map((i) => String(i.userId))));
  const fresh = ranked.filter((r) => !recentIds.has(String(r.user._id)));
  if (fresh.length >= PER_BATCH) ranked = fresh;
  if (!ranked.length) return null;

  const picks = await aiPick(viewer, ranked);
  if (picks) return { source: "ai", items: picks };
  return {
    source: "rules",
    items: ranked.slice(0, PER_BATCH).map((r) => ({ userId: r.user._id, reason: r.reason, shared: r.shared })),
  };
}

async function aiPick(viewer, ranked) {
  if (!aiEnabled()) return null;
  const p = viewer.profile || {};
  const describe = (q, posts) =>
    [
      q.interests?.length && `interests: ${q.interests.join(", ")}`,
      q.skills?.length && `skills: ${q.skills.join(", ")}`,
      q.strengths?.length && `strengths: ${q.strengths.join(", ")}`,
      q.values && `values: ${q.values}`,
      q.aspirations && `hopes to: ${q.aspirations}`,
      posts?.length && `recent posts: ${posts.slice(0, 2).map((t) => `"${t.text.slice(0, 160)}"`).join(" | ")}`,
    ]
      .filter(Boolean)
      .join("; ");

  const out = await askAI({
    maxTokens: 500,
    timeoutMs: 15000,
    system:
      "You are Mind, a warm assistant in a community app that helps people find others with shared interests, skills, and values. " +
      `From the numbered candidates, pick the ${PER_BATCH} best matches for the user. For each, write one friendly sentence (under 25 words) ` +
      "addressed to the user explaining what they have in common or how they could help each other. " +
      "Use only the information given. Never guess at health, mental state, religion, ethnicity, sexuality, politics, or other sensitive traits, " +
      "and never mention anything that sounds like distress. Respond with JSON only: {\"picks\":[{\"i\":0,\"note\":\"...\"}]}",
    prompt:
      `User: ${describe(p, null) || "no profile details yet"}\n\nCandidates:\n` +
      ranked.map((r, i) => `${i}. ${describe(r.user.profile || {}, r.posts)} (shared: ${r.shared.join(", ")})`).join("\n"),
  });
  const parsed = parseJson(out);
  if (!Array.isArray(parsed?.picks)) return null;
  const seen = new Set();
  const items = [];
  for (const pick of parsed.picks) {
    const r = ranked[Number(pick.i)];
    if (!r || seen.has(pick.i) || typeof pick.note !== "string") continue;
    seen.add(pick.i);
    items.push({ userId: r.user._id, reason: pick.note.trim().slice(0, 200), shared: r.shared });
    if (items.length === PER_BATCH) break;
  }
  return items.length ? items : null;
}

async function hydrate(db, viewer, doc) {
  const createdAt = new Date(doc.createdAt);
  const out = {
    batchId: String(doc._id || createdAt.getTime()),
    generatedAt: createdAt,
    nextAt: new Date(createdAt.getTime() + MIND_INTERVAL_MS),
    aiWritten: doc.source === "ai",
    suggestions: [],
  };
  for (const item of doc.items || []) {
    const u = await db.collection("users").findOne({ _id: item.userId });
    if (!u || !u.privacy?.discoverable || Boolean(u.isMinor) !== Boolean(viewer.isMinor)) continue; // they may have opted out since
    const posts = await db
      .collection("thoughts")
      .find({ ...thoughtFilter(viewer), authorId: u._id })
      .sort({ createdAt: -1 })
      .limit(2)
      .toArray();
    const pairKey = [String(viewer._id), String(u._id)].sort().join(":");
    const conn = await db.collection("connections").findOne({ pairKey });
    out.suggestions.push({
      id: String(u._id),
      displayName: u.displayName,
      intro: u.profile?.intro || "",
      shared: item.shared || [],
      reason: item.reason,
      connection: conn ? conn.status : null,
      posts: posts.map((t) => ({
        id: String(t._id),
        text: t.text,
        tags: t.tags || [],
        areaName: t.areaName || "",
        lat: t.location ? t.location.coordinates[1] : null,
        lng: t.location ? t.location.coordinates[0] : null,
        createdAt: t.createdAt,
      })),
    });
  }
  return out;
}
