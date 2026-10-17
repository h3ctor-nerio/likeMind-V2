import { getDb } from "@/lib/mongodb";
import { route, json, fail, oid } from "@/lib/http";
import { groupSummary, isMember } from "@/lib/groups";

export const GET = route(async (req, { user, params }) => {
  const db = await getDb();
  const g = await db.collection("groups").findOne({ _id: oid(params.id), status: { $ne: "removed" } });
  if (!g) return fail("Group not found.", 404);
  const member = isMember(g, user);
  const invited = (g.invites || []).some((i) => user && String(i) === String(user._id));
  if (g.visibility === "invite" && !member && !invited) return fail("This group is invite-only.", 403);

  const out = { ...groupSummary(g, user), myRole: null };
  if (member) {
    out.myRole = g.members.find((m) => String(m.userId) === String(user._id))?.role;
    out.members = g.members.map((m) => ({ displayName: m.displayName, role: m.role }));
    const ids = (g.suggestedEvents || []).map((s) => s.eventId);
    const events = ids.length ? await db.collection("events").find({ _id: { $in: ids }, status: "published" }).toArray() : [];
    const memberIds = new Set(g.members.map((m) => String(m.userId)));
    out.events = events.map((e) => ({
      id: String(e._id),
      title: e.title,
      startsAt: e.startsAt,
      mode: e.mode,
      free: Boolean(e.cost?.free),
      goingFromGroup: (e.attendees || []).filter((a) => memberIds.has(String(a.userId))).length,
      imGoing: (e.attendees || []).some((a) => String(a.userId) === String(user._id)),
    }));
  }
  return json({ group: out });
});
