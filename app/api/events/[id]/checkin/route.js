import { getDb } from "@/lib/mongodb";
import { route, json, fail, oid } from "@/lib/http";
import { eventView } from "@/lib/views";

export const POST = route(
  async (req, { user, params }) => {
    const db = await getDb();
    const events = db.collection("events");
    const e = await events.findOne({ _id: oid(params.id), status: "published" });
    if (!e) return fail("Event not found.", 404);
    if (!(e.attendees || []).some((a) => String(a.userId) === String(user._id))) return fail("Register first, then check in when you arrive.");
    const opensAt = new Date(new Date(e.startsAt).getTime() - 60 * 60 * 1000);
    if (e.timing !== "self-paced" && new Date() < opensAt) return fail("Check-in opens an hour before the event starts.");
    await events.updateOne({ _id: e._id, "attendees.userId": user._id }, { $set: { "attendees.$.checkedIn": true } });
    return json({ event: eventView(await events.findOne({ _id: e._id }), user, { organizerView: true }) });
  },
  { auth: true }
);
