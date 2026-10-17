import { getDb } from "@/lib/mongodb";
import { isVerifiedOrganizer } from "@/lib/auth";
import { route, json, fail, readJson, str, list } from "@/lib/http";
import { screenFields, eventFields, problemMessage, logBlocked, isHarmful } from "@/lib/moderation";
import { point } from "@/lib/geo";
import { eventView } from "@/lib/views";
import { recommendEvents } from "@/lib/matching";
import { assessEvent, EVENT_INTRO } from "@/lib/trust";

function visibleFilter(user) {
  const f = { status: "published", $or: [{ endsAt: { $gte: new Date() } }, { timing: "self-paced" }] };
  if (!user || user.isMinor) f.ageRange = { $in: ["all", "teens"] };
  else f.ageRange = { $in: ["all", "18+"] };
  return f;
}

export const GET = route(async (req, { user }) => {
  const sp = new URL(req.url).searchParams;
  const db = await getDb();
  const filter = visibleFilter(user);
  if (sp.get("free") === "1") filter["cost.free"] = true;
  if (["online", "in-person", "hybrid"].includes(sp.get("mode"))) filter.mode = sp.get("mode");
  const lang = str(sp.get("lang"), 30).toLowerCase();
  if (lang) filter.languages = lang;
  if (sp.get("wheelchair") === "1") filter["accessibility.wheelchair"] = true;
  if (sp.get("transit") === "1") filter["transport.transit"] = true;
  const tag = str(sp.get("tag"), 30).toLowerCase();
  if (tag) filter.tags = tag;
  const q = str(sp.get("q"), 80);
  if (q) filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  // When: today | week | month
  const when = sp.get("when");
  const days = { today: 1, week: 7, month: 31 }[when];
  const extra = [];
  if (days) {
    const end = new Date();
    if (when === "today") end.setHours(23, 59, 59, 999);
    else end.setDate(end.getDate() + days);
    extra.push({ startsAt: { $lte: end } });
  }

  // Distance: in-person and hybrid events near a point; online events are always included.
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const km = Number(sp.get("km"));
  if (sp.get("lat") && Number.isFinite(lat) && Number.isFinite(lng) && km > 0) {
    extra.push({
      $or: [{ location: { $geoWithin: { $centerSphere: [[lng, lat], Math.min(km, 5000) / 6378.1] } } }, { mode: "online" }],
    });
  }
  if (extra.length) {
    filter.$and = [{ $or: filter.$or }, ...extra];
    delete filter.$or;
  }
  if (sp.get("mine") === "1" && user) {
    delete filter.$or;
    delete filter.$and;
    delete filter.ageRange;
    filter.organizerId = user._id;
    delete filter.status;
  }

  const docs = await db.collection("events").find(filter).sort({ startsAt: 1 }).limit(200).toArray();
  const recommended =
    user && sp.get("mine") !== "1"
      ? recommendEvents(user, docs).map((r) => ({ ...eventView(r.item, user), reasons: r.reasons }))
      : [];
  return json({ events: docs.map((e) => eventView(e, user)), recommended });
});

const MODES = ["in-person", "online", "hybrid"];
const AGES = ["all", "18+", "teens"];

export const POST = route(
  async (req, { user }) => {
    if (!isVerifiedOrganizer(user)) return fail("Only verified hosts can publish events. Apply to host from the Events page.", 403);
    const b = await readJson(req);
    const title = str(b.title, 120);
    const description = str(b.description, 1500);
    const startsAt = new Date(b.startsAt);
    const endsAt = b.endsAt ? new Date(b.endsAt) : new Date(startsAt.getTime() + 2 * 3600 * 1000);
    const timing = b.timing === "self-paced" ? "self-paced" : "live";
    const mode = MODES.includes(b.mode) ? b.mode : "in-person";

    if (title.length < 4) return fail("Give the event a title of at least 4 characters.");
    if (description.length < 20) return fail("Describe the event in at least a sentence or two so people know what to expect.");
    if (Number.isNaN(startsAt.getTime())) return fail("Choose a start date and time.");
    if (endsAt <= startsAt) return fail("The end time needs to be after the start time.");
    if (mode !== "online" && !str(b.locationName, 200)) return fail("Add where the event happens.");
    if (mode !== "in-person" && !/^https?:\/\//.test(str(b.onlineLink, 300))) return fail("Add the online link (starting with https://). Only registered attendees will see it.");


    const db = await getDb();
    const amount = Math.max(0, Number(b.cost?.amount) || 0);
    const doc = {
      organizerId: user._id,
      organizerName: user.organizer?.orgName || user.displayName,
      orgType: user.organizer?.orgType || "individual",
      verified: true,
      title,
      description,
      tags: list(b.tags, 8, 30),
      mode,
      timing,
      startsAt,
      endsAt,
      locationName: mode === "online" ? "" : str(b.locationName, 200),
      location: mode === "online" || !b.location ? null : point(b.location.lat, b.location.lng),
      onlineLink: mode === "in-person" ? "" : str(b.onlineLink, 300),
      cost: { free: amount === 0, amount, notes: str(b.cost?.notes, 200) },
      languages: list(b.languages, 6, 30),
      accessibility: {
        wheelchair: Boolean(b.accessibility?.wheelchair),
        asl: Boolean(b.accessibility?.asl),
        captions: Boolean(b.accessibility?.captions),
        quietSpace: Boolean(b.accessibility?.quietSpace),
        notes: str(b.accessibility?.notes, 300),
      },
      transport: {
        transit: Boolean(b.transport?.transit),
        parking: Boolean(b.transport?.parking),
        bike: Boolean(b.transport?.bike),
        notes: str(b.transport?.notes, 300),
      },
      ageRange: AGES.includes(b.ageRange) ? b.ageRange : "all",
      capacity: Math.max(0, Number(b.capacity) || 0) || null,
      attendees: [],
      feedback: [],
      status: "published",
      tzOffsetMinutes: Math.max(-840, Math.min(840, Number(b.tzOffsetMinutes) || 0)),
      createdAt: new Date(),
    };

    // 1. Wording check on every field. Threatening or offensive wording is never saved.
    const problems = (await screenFields(eventFields(doc), "event")).filter((p) => p.flags.some(isHarmful));
    if (problems.length) {
      await logBlocked(user._id, "event", problems);
      return fail(problemMessage(problems), 422);
    }

    // 2. Safety check: may ask the host for more information before the event goes live.
    const safety = await assessEvent(db, doc, user);
    doc.review = {
      decision: safety.decision,
      signals: safety.signals,
      questions: safety.questions,
      aiNote: safety.ai?.note || "",
      aiAssessment: safety.ai?.assessment || null,
      checkedAt: new Date(),
    };
    if (safety.decision === "needs_info") doc.status = "needs_info";
    // 3. Optional: with EVENT_APPROVAL=all, every event waits for a moderator, even when checks pass.
    else if (process.env.EVENT_APPROVAL === "all") doc.status = "pending_approval";

    const { insertedId } = await db.collection("events").insertOne(doc);
    return json({ id: String(insertedId), status: doc.status, needsInfo: doc.status === "needs_info", message: doc.status === "needs_info" ? EVENT_INTRO : "" });
  },
  { auth: true }
);
