import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str, oid } from "@/lib/http";
import { checkContent } from "@/lib/moderation";
import { eventView } from "@/lib/views";

export const POST = route(
  async (req, { user, params }) => {
    const body = await readJson(req);
    const rating = Math.round(Number(body.rating));
    if (!(rating >= 1 && rating <= 5)) return fail("Choose a rating from 1 to 5.");
    const db = await getDb();
    const events = db.collection("events");
    const e = await events.findOne({ _id: oid(params.id) });
    if (!e || !(e.attendees || []).some((a) => String(a.userId) === String(user._id))) return fail("Only registered attendees can leave feedback.", 403);
    let comment = str(body.comment, 500);
    if (comment && (await checkContent(comment, "reply")).status !== "published") comment = "";
    await events.updateOne({ _id: e._id }, { $pull: { feedback: { userId: user._id } } });
    await events.updateOne({ _id: e._id }, { $push: { feedback: { userId: user._id, rating, comment, at: new Date() } } });
    return json({ event: eventView(await events.findOne({ _id: e._id }), user, { organizerView: true }) });
  },
  { auth: true }
);
