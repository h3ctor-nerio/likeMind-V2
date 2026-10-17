import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str, oid } from "@/lib/http";
import { eventView } from "@/lib/views";

// Everyone registers individually, even when a group found the event together.
export const POST = route(
  async (req, { user, params }) => {
    const body = await readJson(req);
    const db = await getDb();
    const events = db.collection("events");
    const e = await events.findOne({ _id: oid(params.id), status: "published" });
    if (!e) return fail("Event not found.", 404);
    const already = (e.attendees || []).some((a) => String(a.userId) === String(user._id));

    if (body.going === false) {
      await events.updateOne({ _id: e._id }, { $pull: { attendees: { userId: user._id } } });
    } else {
      if (already) return fail("You're already registered.");
      if (e.ageRange === "18+" && user.isMinor) return fail("This event is for adults 18 and older.", 403);
      if (e.ageRange === "teens" && !user.isMinor) return fail("This event is for teens.", 403);
      if (e.capacity && (e.attendees || []).length >= e.capacity) return fail("This event is full.");
      // Access requests go to the host only, and only if the attendee chooses to share them.
      const accessRequest = body.shareAccess ? str(body.accessRequest, 300) : "";
      await events.updateOne(
        { _id: e._id },
        { $push: { attendees: { userId: user._id, displayName: user.displayName, accessRequest, checkedIn: false, rsvpAt: new Date() } } }
      );
    }
    const updated = await events.findOne({ _id: e._id });
    return json({ event: eventView(updated, user, { organizerView: true }) });
  },
  { auth: true }
);
