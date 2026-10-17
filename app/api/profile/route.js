import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str } from "@/lib/http";
import { cleanProfile, cleanPrefs, cleanPrivacy } from "@/lib/profile";
import { screenFields, profileFields, problemMessage, logBlocked } from "@/lib/moderation";

export const PUT = route(
  async (req, { user }) => {
    const body = await readJson(req);
    const db = await getDb();
    const set = {};
    if (body.profile) set.profile = cleanProfile(body.profile);
    if (body.prefs) {
      const prefs = cleanPrefs(body.prefs);
      if (!body.prefs.home && body.prefs.keepHome !== false && user.prefs?.home) prefs.home = user.prefs.home;
      set.prefs = prefs;
    }
    if (body.privacy) set.privacy = cleanPrivacy(body.privacy);
    if (body.displayName !== undefined) {
      const name = str(body.displayName, 30);
      if (!/^[\p{L}\p{N}_ .-]{3,30}$/u.test(name)) return fail("Display names are 3–30 letters, numbers, spaces, dots, dashes, or underscores.");
      if (name !== user.displayName) {
        if (await db.collection("users").findOne({ displayName: name })) return fail("That display name is taken. Try another.");
        set.displayName = name;
      }
    }
    if (body.fullName !== undefined) {
      const fullName = str(body.fullName, 120);
      if (!fullName) return fail("Your full name can't be empty. It stays private.");
      set.fullName = fullName;
    }
    // Check any public-facing wording before saving it.
    if (set.profile || set.displayName) {
      const fields = profileFields(set.displayName || "", set.profile || {});
      if (!set.displayName) delete fields.displayName;
      if (!set.profile) for (const k of Object.keys(fields)) if (k !== "displayName") delete fields[k];
      const problems = await screenFields(fields, "profile");
      if (problems.length) {
        await logBlocked(user._id, "profile", problems);
        return fail(problemMessage(problems), 422);
      }
      // A clean save clears any earlier hold on the profile.
      if (user.profileReview?.status === "held") set.profileReview = { status: "clear", clearedAt: new Date() };
    }
    await db.collection("users").updateOne({ _id: user._id }, { $set: set });
    if (set.displayName) await renameEverywhere(db, user._id, set.displayName);
    return json({ ok: true });
  },
  { auth: true }
);

// Display names are copied onto posts, chats, groups, and events for speed. Keep every copy in sync.
async function renameEverywhere(db, userId, name) {
  await Promise.all([
    db.collection("thoughts").updateMany({ authorId: userId }, { $set: { authorName: name } }),
    db.collection("replies").updateMany({ authorId: userId }, { $set: { authorName: name } }),
    db.collection("messages").updateMany({ senderId: userId }, { $set: { senderName: name } }),
    db.collection("connections").updateMany({ fromId: userId }, { $set: { fromName: name } }),
    db.collection("connections").updateMany({ toId: userId }, { $set: { toName: name } }),
    db.collection("groups").updateMany({ "members.userId": userId }, { $set: { "members.$[m].displayName": name } }, { arrayFilters: [{ "m.userId": userId }] }),
    db.collection("events").updateMany({ "attendees.userId": userId }, { $set: { "attendees.$[a].displayName": name } }, { arrayFilters: [{ "a.userId": userId }] }),
  ]);
}
