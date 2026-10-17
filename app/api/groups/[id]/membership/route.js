import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, oid } from "@/lib/http";
import { isMember } from "@/lib/groups";
import { canSendRequests } from "@/lib/trust";

// join | leave | decline | invite (invite a connection; they decide whether to join)
export const POST = route(
  async (req, { user, params }) => {
    const body = await readJson(req);
    const db = await getDb();
    const groups = db.collection("groups");
    const g = await groups.findOne({ _id: oid(params.id), status: { $ne: "removed" } });
    if (!g) return fail("Group not found.", 404);
    const invited = (g.invites || []).some((i) => String(i) === String(user._id));

    switch (body.action) {
      case "join": {
        if (isMember(g, user)) return json({ ok: true });
        if (g.visibility === "invite" && !invited) return fail("This group is invite-only.", 403);
        if (user.isMinor && !g.teenFriendly) return fail("This group is for adults.", 403);
        if (!user.isMinor && g.ageGroup === "teen") return fail("This group is for teens.", 403);
        await groups.updateOne(
          { _id: g._id },
          { $push: { members: { userId: user._id, displayName: user.displayName, role: "member", joinedAt: new Date() } }, $pull: { invites: user._id } }
        );
        return json({ ok: true });
      }
      case "decline":
        await groups.updateOne({ _id: g._id }, { $pull: { invites: user._id } });
        return json({ ok: true });
      case "leave":
        await groups.updateOne({ _id: g._id }, { $pull: { members: { userId: user._id } } });
        return json({ ok: true });
      case "invite": {
        if (!isMember(g, user)) return fail("Only members can invite people.", 403);
        if (!canSendRequests(user)) return fail("Invitations are paused until a person on our team reviews your account.", 403);
        const c = await db.collection("connections").findOne({ _id: oid(body.connectionId), status: "accepted" });
        if (!c || (String(c.fromId) !== String(user._id) && String(c.toId) !== String(user._id))) {
          return fail("You can invite people you're connected with.", 403);
        }
        const otherId = String(c.fromId) === String(user._id) ? c.toId : c.fromId;
        if (g.members.some((m) => String(m.userId) === String(otherId))) return fail("They're already in this group.");
        await groups.updateOne({ _id: g._id }, { $addToSet: { invites: otherId } });
        return json({ ok: true });
      }
      default:
        return fail("Unknown action.");
    }
  },
  { auth: true }
);
