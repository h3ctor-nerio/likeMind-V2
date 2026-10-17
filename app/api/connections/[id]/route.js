import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, oid } from "@/lib/http";

export const PATCH = route(
  async (req, { user, params }) => {
    const { action } = await readJson(req);
    const db = await getDb();
    const c = await db.collection("connections").findOne({ _id: oid(params.id) });
    if (!c || (String(c.fromId) !== String(user._id) && String(c.toId) !== String(user._id))) return fail("Connection not found.", 404);
    const isRecipient = String(c.toId) === String(user._id);

    if (action === "accept" || action === "decline") {
      if (!isRecipient || c.status !== "pending") return fail("Only the person who received the request can respond to it.", 403);
      await db.collection("connections").updateOne({ _id: c._id }, { $set: { status: action === "accept" ? "accepted" : "declined", respondedAt: new Date() } });
    } else if (action === "cancel" || action === "remove") {
      // Either person can end a connection at any time. The chat closes for both.
      await db.collection("connections").updateOne({ _id: c._id }, { $set: { status: isRecipient && c.status === "pending" ? "declined" : "ended", endedAt: new Date() } });
    } else {
      return fail("Unknown action.");
    }
    return json({ ok: true });
  },
  { auth: true }
);
