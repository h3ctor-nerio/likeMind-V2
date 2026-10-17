import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, oid } from "@/lib/http";
import { isMember } from "@/lib/groups";

// Suggest an event to a group. Each member still decides on their own whether to go.
export const POST = route(
  async (req, { user, params }) => {
    const { eventId } = await readJson(req);
    const db = await getDb();
    const g = await db.collection("groups").findOne({ _id: oid(params.id) });
    if (!g || !isMember(g, user)) return fail("Join this group to suggest events.", 403);
    const e = await db.collection("events").findOne({ _id: oid(eventId), status: "published" });
    if (!e) return fail("Event not found.", 404);
    if ((g.suggestedEvents || []).some((s) => String(s.eventId) === String(e._id))) return fail("This event is already on the group's list.");
    await db.collection("groups").updateOne(
      { _id: g._id },
      { $push: { suggestedEvents: { eventId: e._id, suggestedBy: user.displayName, at: new Date() } } }
    );
    return json({ ok: true });
  },
  { auth: true }
);
