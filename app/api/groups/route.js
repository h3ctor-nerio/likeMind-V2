import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str, list } from "@/lib/http";
import { screenFields, problemMessage, logBlocked, isHarmful } from "@/lib/moderation";
import { groupSummary } from "@/lib/groups";
import { recommendGroups } from "@/lib/matching";

export const GET = route(async (req, { user }) => {
  const db = await getDb();
  const groups = await db.collection("groups").find({ status: { $ne: "removed" } }).sort({ createdAt: -1 }).limit(200).toArray();
  const visible = groups.filter((g) => (user?.isMinor ? g.teenFriendly : g.ageGroup !== "teen"));
  const all = visible.map((g) => groupSummary(g, user));
  const discover = all.filter((g) => !g.isMember && g.visibility === "open");
  const recommended = recommendGroups(
    user,
    visible.filter((g) => g.visibility === "open" && !all.find((s) => s.id === String(g._id))?.isMember)
  ).map((r) => ({ ...groupSummary(r.item, user), reasons: r.reasons }));
  return json({
    mine: all.filter((g) => g.isMember),
    invites: all.filter((g) => g.invited && !g.isMember),
    discover,
    recommended,
  });
});

export const POST = route(
  async (req, { user }) => {
    const body = await readJson(req);
    const name = str(body.name, 80);
    const description = str(body.description, 500);
    if (name.length < 3) return fail("Give your group a name of at least 3 characters.");
    const problems = await screenFields(
      { name: { label: "the group name", text: name }, description: { label: "the description", text: description }, tags: { label: "the tags", text: String(body.tags || "") } },
      "event"
    );
    if (problems.length) {
      if (problems.some((p) => p.flags.some(isHarmful))) await logBlocked(user._id, "group", problems);
      return fail(problemMessage(problems), 422);
    }
    const db = await getDb();
    const doc = {
      name,
      description,
      tags: list(body.tags, 6, 30),
      visibility: body.visibility === "invite" ? "invite" : "open",
      teenFriendly: Boolean(user.isMinor) || Boolean(body.teenFriendly),
      ageGroup: user.isMinor ? "teen" : "adult",
      createdBy: user._id,
      members: [{ userId: user._id, displayName: user.displayName, role: "host", joinedAt: new Date() }],
      invites: [],
      suggestedEvents: [],
      status: "active",
      createdAt: new Date(),
    };
    const { insertedId } = await db.collection("groups").insertOne(doc);
    return json({ id: String(insertedId) });
  },
  { auth: true }
);
