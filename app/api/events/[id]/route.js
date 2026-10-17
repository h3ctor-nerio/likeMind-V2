import { getDb } from "@/lib/mongodb";
import { route, json, fail, oid } from "@/lib/http";
import { eventView } from "@/lib/views";

export const GET = route(async (req, { user, params }) => {
  const db = await getDb();
  const e = await db.collection("events").findOne({ _id: oid(params.id) });
  if (!e || (e.status !== "published" && String(e.organizerId) !== String(user?._id))) return fail("Event not found.", 404);
  let groups = [];
  if (user) {
    groups = (await db.collection("groups").find({ "members.userId": user._id, status: { $ne: "removed" } }).project({ name: 1 }).toArray()).map((g) => ({
      id: String(g._id),
      name: g.name,
    }));
  }
  return json({ event: eventView(e, user, { organizerView: true }), myGroups: groups });
});

export const DELETE = route(
  async (req, { user, params }) => {
    const db = await getDb();
    const r = await db.collection("events").updateOne({ _id: oid(params.id), organizerId: user._id }, { $set: { status: "cancelled" } });
    if (!r.matchedCount) return fail("Only the host can cancel this event.", 403);
    return json({ ok: true });
  },
  { auth: true }
);
