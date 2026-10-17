import { getDb } from "@/lib/mongodb";
import { isAdmin } from "@/lib/auth";
import { route, json, fail } from "@/lib/http";

export const GET = route(
  async (req, { user }) => {
    if (!isAdmin(user)) return fail("Only moderators can open the review queue.", 403);
    const db = await getDb();
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [eventsAnswered, eventsWaiting, eventsWatch, usersAnswered, usersWaiting, usersWatch, asked, approved, declined] = await Promise.all([
      db.collection("events").find({ status: { $in: ["info_submitted", "pending_approval", "held"] } }).sort({ createdAt: 1 }).limit(50).toArray(),
      db.collection("events").find({ status: "needs_info" }).sort({ createdAt: 1 }).limit(50).toArray(),
      db.collection("events").find({ status: "published", "review.decision": "watch", "review.cleared": { $ne: true } }).limit(50).toArray(),
      db.collection("users").find({ "trust.status": "info_submitted" }).limit(50).toArray(),
      db.collection("users").find({ "trust.status": "needs_info" }).limit(50).toArray(),
      db.collection("users").find({ "trust.status": "watch" }).limit(50).toArray(),
      db.collection("events").countDocuments({ "review.decision": "needs_info", createdAt: { $gt: monthAgo } }),
      db.collection("events").countDocuments({ "review.outcome": "approved", createdAt: { $gt: monthAgo } }),
      db.collection("events").countDocuments({ "review.outcome": "declined", createdAt: { $gt: monthAgo } }),
    ]);
    const ev = (e) => ({
      id: String(e._id), title: e.title, organizerName: e.organizerName, description: e.description.slice(0, 400),
      startsAt: e.startsAt, signals: e.review?.signals || [], aiNote: e.review?.aiNote || "", answers: e.review?.answers || [],
      status: e.status, heldFields: e.review?.heldFields || [], heldFlags: e.review?.heldFlags || [],
    });
    const us = (u) => ({ id: String(u._id), displayName: u.displayName, signals: u.trust?.signals || [], answers: u.trust?.answers || [] });
    const heldProfiles = await db.collection("users").find({ "profileReview.status": "held" }).limit(50).toArray();
    const [thoughts, replies, reports, organizers] = await Promise.all([
      db.collection("thoughts").find({ status: "in_review" }).sort({ createdAt: 1 }).limit(50).toArray(),
      db.collection("replies").find({ status: "in_review" }).sort({ createdAt: 1 }).limit(50).toArray(),
      db.collection("reports").find({ status: "open" }).sort({ createdAt: 1 }).limit(50).toArray(),
      db.collection("users").find({ "organizer.status": "pending" }).limit(50).toArray(),
    ]);
    return json({
      thoughts: thoughts.map((t) => ({ id: String(t._id), text: t.text, tags: t.tags, flags: t.moderation?.flags || [], support: Boolean(t.moderation?.support), reportCount: t.reportCount || 0, createdAt: t.createdAt })),
      replies: replies.map((r) => ({ id: String(r._id), text: r.text, flags: r.moderation?.flags || [], createdAt: r.createdAt })),
      reports: reports.map((r) => ({ id: String(r._id), kind: r.kind, targetId: String(r.targetId), reason: r.reason, excerpt: r.excerpt, createdAt: r.createdAt })),
      organizers: organizers.map((u) => ({ id: String(u._id), displayName: u.displayName, ...u.organizer })),
      safety: {
        eventsAnswered: eventsAnswered.map(ev),
        eventsWaiting: eventsWaiting.map(ev),
        eventsWatch: eventsWatch.map(ev),
        usersAnswered: usersAnswered.map(us),
        usersWaiting: usersWaiting.map(us),
        usersWatch: usersWatch.map(us),
        // Fairness check: if most events we ask about end up approved, the rules are too strict.
        stats: { asked, approved, declined },
        heldProfiles: heldProfiles.map((u) => ({
          id: String(u._id),
          displayName: u.displayName,
          labels: u.profileReview?.labels || [],
          flags: u.profileReview?.flags || [],
          excerpts: (u.profileReview?.fields || []).map((k) => {
            const v = k === "displayName" ? u.displayName : u.profile?.[k];
            return { label: k, text: Array.isArray(v) ? v.join(", ") : String(v || "") };
          }),
        })),
      },
    });
  },
  { auth: true }
);
