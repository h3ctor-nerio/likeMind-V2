import { getDb } from "@/lib/mongodb";
import { isAdmin } from "@/lib/auth";
import { route, json, fail } from "@/lib/http";
import { ruleFlags, isHarmful, profileFields, eventFields } from "@/lib/moderation";
import { openaiEnabled, openaiModerateMany } from "@/lib/openai";

// Re-check content that already exists (posted before a rule change, or before AI was turned on).
// New content is always checked the moment it's submitted; this is for catching up.
// Flagged items are hidden from others and sent to the Review page; nothing is deleted.
export const POST = route(
  async (req, { user }) => {
    if (!isAdmin(user)) return fail("Only moderators can run a scan.", 403);
    const db = await getDb();

    const [users, events, thoughts] = await Promise.all([
      db.collection("users").find({ "profileReview.status": { $ne: "held" } }).limit(1000).toArray(),
      db.collection("events").find({ status: "published" }).limit(500).toArray(),
      db.collection("thoughts").find({ status: "published" }).sort({ createdAt: -1 }).limit(1000).toArray(),
    ]);

    // Build one list of (item, field, text) to check.
    const jobs = [];
    for (const u of users) for (const [key, f] of Object.entries(profileFields(u.displayName, u.profile))) if (f.text) jobs.push({ kind: "profile", doc: u, key, label: f.label, text: String(f.text) });
    for (const e of events) for (const [key, f] of Object.entries(eventFields(e))) if (f.text) jobs.push({ kind: "event", doc: e, key, label: f.label, text: String(f.text) });
    for (const t of thoughts) jobs.push({ kind: "thought", doc: t, key: "text", label: "the thought", text: t.text });

    // Rules first; then OpenAI's moderation model in batches (free) for anything the rules passed.
    for (const j of jobs) j.flags = ruleFlags(j.text, j.kind === "event" ? "event" : "thought").flags.filter(isHarmful);
    let usedAI = false;
    if (openaiEnabled()) {
      const pending = jobs.filter((j) => !j.flags.length);
      const results = await openaiModerateMany(pending.map((j) => j.text));
      pending.forEach((j, i) => {
        if (results[i]?.flags?.length) j.flags = results[i].flags.map((f) => `AI: ${f}`);
      });
      usedAI = true;
    }

    const hits = jobs.filter((j) => j.flags.length);
    const group = (kind) => {
      const m = new Map();
      for (const h of hits.filter((x) => x.kind === kind)) {
        const id = String(h.doc._id);
        if (!m.has(id)) m.set(id, { doc: h.doc, fields: [], labels: [], flags: [] });
        const g = m.get(id);
        g.fields.push(h.key);
        g.labels.push(h.label);
        g.flags.push(...h.flags);
      }
      return [...m.values()];
    };

    const now = new Date();
    const pHits = group("profile");
    for (const g of pHits) {
      await db.collection("users").updateOne({ _id: g.doc._id }, { $set: { profileReview: { status: "held", fields: g.fields, labels: g.labels, flags: [...new Set(g.flags)], heldAt: now, source: "scan" } } });
    }
    const eHits = group("event");
    for (const g of eHits) {
      await db.collection("events").updateOne(
        { _id: g.doc._id },
        { $set: { status: "held", "review.heldFields": g.labels, "review.heldFlags": [...new Set(g.flags)], "review.heldAt": now } }
      );
    }
    const tHits = group("thought");
    for (const g of tHits) {
      await db.collection("thoughts").updateOne(
        { _id: g.doc._id },
        { $set: { status: "in_review", "moderation.flags": [...new Set(g.flags)], reviewNote: "This thought is hidden while a person on our team reviews its wording." } }
      );
    }

    return json({
      checked: { profiles: users.length, events: events.length, thoughts: thoughts.length },
      held: { profiles: pHits.length, events: eHits.length, thoughts: tHits.length },
      usedAI,
    });
  },
  { auth: true }
);
