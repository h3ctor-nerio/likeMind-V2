import { getDb } from "@/lib/mongodb";
import { isVerifiedOrganizer } from "@/lib/auth";
import { route, json, fail } from "@/lib/http";

const MIN_GROUP = 3; // never show a theme backed by fewer than this many posts

export const GET = route(
  async (req, { user }) => {
    if (!isVerifiedOrganizer(user)) return fail("Community insights are available to verified hosts.", 403);
    const db = await getDb();
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const tagCounts = await db
      .collection("thoughts")
      .aggregate([
        { $match: { status: "published", createdAt: { $gte: since } } },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 }, relate: { $sum: { $size: { $ifNull: ["$reactions.relate", []] } } } } },
        { $match: { count: { $gte: MIN_GROUP } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ])
      .toArray();

    const totalThoughts = await db.collection("thoughts").countDocuments({ status: "published", createdAt: { $gte: since } });

    const prompts = await db.collection("prompts").find({ createdBy: user._id }).sort({ createdAt: -1 }).toArray();
    const promptStats = [];
    for (const p of prompts) {
      const responses = await db.collection("thoughts").countDocuments({ promptId: p._id, status: "published" });
      const tags = await db
        .collection("thoughts")
        .aggregate([
          { $match: { promptId: p._id, status: "published" } },
          { $unwind: "$tags" },
          { $group: { _id: "$tags", count: { $sum: 1 } } },
          { $match: { count: { $gte: MIN_GROUP } } },
          { $sort: { count: -1 } },
          { $limit: 6 },
        ])
        .toArray();
      promptStats.push({ id: String(p._id), question: p.question, active: p.active, responses, topTags: tags.map((t) => ({ tag: t._id, count: t.count })) });
    }

    const events = await db.collection("events").find({ organizerId: user._id }).sort({ startsAt: -1 }).limit(20).toArray();
    const eventStats = events.map((e) => {
      const fb = e.feedback || [];
      return {
        id: String(e._id),
        title: e.title,
        startsAt: e.startsAt,
        status: e.status,
        registered: (e.attendees || []).length,
        checkedIn: (e.attendees || []).filter((a) => a.checkedIn).length,
        rating: fb.length ? Math.round((fb.reduce((s, f) => s + f.rating, 0) / fb.length) * 10) / 10 : null,
        accessRequests: (e.attendees || []).filter((a) => a.accessRequest).length,
      };
    });

    return json({
      minGroup: MIN_GROUP,
      totalThoughts,
      topTags: tagCounts.map((t) => ({ tag: t._id, count: t.count, relate: t.relate })),
      prompts: promptStats,
      events: eventStats,
    });
  },
  { auth: true }
);
