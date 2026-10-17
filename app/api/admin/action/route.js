import { getDb } from "@/lib/mongodb";
import { isAdmin } from "@/lib/auth";
import { route, json, fail, readJson, oid } from "@/lib/http";

const REMOVE = { thought: "thoughts", reply: "replies", message: "messages", event: "events", group: "groups" };

export const POST = route(
  async (req, { user }) => {
    if (!isAdmin(user)) return fail("Only moderators can do that.", 403);
    const { type, id, decision, note } = await readJson(req);
    const _id = oid(id);
    if (!_id) return fail("Missing id.");
    const db = await getDb();
    const by = { reviewedBy: user._id, reviewedAt: new Date() };

    if (type === "thought" || type === "reply") {
      const col = type === "thought" ? "thoughts" : "replies";
      const status = decision === "approve" ? "published" : "removed";
      const doc = await db.collection(col).findOneAndUpdate({ _id }, { $set: { status, ...by } }, { returnDocument: "after" });
      if (type === "reply" && doc && status === "published") await db.collection("thoughts").updateOne({ _id: doc.thoughtId }, { $inc: { replyCount: 1 } });
    } else if (type === "report") {
      const r = await db.collection("reports").findOne({ _id });
      if (!r) return fail("Report not found.", 404);
      if (decision === "remove") {
        const col = REMOVE[r.kind];
        if (r.kind === "message") await db.collection("messages").deleteOne({ _id: r.targetId });
        else await db.collection(col).updateOne({ _id: r.targetId }, { $set: { status: r.kind === "event" ? "cancelled" : "removed", ...by } });
      }
      await db.collection("reports").updateMany({ targetId: r.targetId, status: "open" }, { $set: { status: decision === "remove" ? "actioned" : "dismissed", ...by } });
    } else if (type === "event") {
      // decision: approve | decline | clear (dismiss a quiet check on a published event)
      if (decision === "clear") {
        await db.collection("events").updateOne({ _id }, { $set: { "review.cleared": true, "review.reviewedBy": user._id } });
      } else {
        const approve = decision === "approve";
        await db.collection("events").updateOne(
          { _id, status: { $in: ["needs_info", "info_submitted", "pending_approval", "held"] } },
          {
            $set: {
              status: approve ? "published" : "declined",
              "review.outcome": approve ? "approved" : "declined",
              "review.declineNote": approve ? "" : String(note || "").slice(0, 300),
              "review.cleared": true,
              ...by,
            },
          }
        );
      }
    } else if (type === "user") {
      // decision: clear | restrict
      const set =
        decision === "restrict"
          ? { "trust.status": "restricted", "trust.note": String(note || "").slice(0, 300), "trust.reviewedAt": new Date(), "trust.outcome": "restricted" }
          : { "trust.status": "clear", "trust.reviewedAt": new Date(), "trust.outcome": "cleared" };
      await db.collection("users").updateOne({ _id }, { $set: set });
    } else if (type === "profile") {
      // decision: clear (wording is fine) | wipe (remove the flagged wording)
      const u = await db.collection("users").findOne({ _id });
      if (!u) return fail("Member not found.", 404);
      const set = { profileReview: { status: "clear", reviewedBy: user._id, reviewedAt: new Date(), outcome: decision } };
      if (decision === "wipe") {
        for (const k of u.profileReview?.fields || []) {
          if (["intro", "values", "aspirations"].includes(k)) set[`profile.${k}`] = "";
          if (["interests", "skills", "strengths", "tags"].includes(k)) set[`profile.${k}`] = [];
        }
      }
      await db.collection("users").updateOne({ _id }, { $set: set });
    } else if (type === "organizer") {
      await db.collection("users").updateOne({ _id }, { $set: { "organizer.status": decision === "approve" ? "verified" : "rejected", "organizer.reviewedAt": new Date() } });
    } else {
      return fail("Unknown review type.");
    }
    return json({ ok: true });
  },
  { auth: true }
);
