import { getDb } from "@/lib/mongodb";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { route, json, fail, readJson, str } from "@/lib/http";
import { randomDisplayName } from "@/lib/names";
import { cleanProfile, cleanPrefs, defaultPrivacy } from "@/lib/profile";
import { screenFields, profileFields, problemMessage } from "@/lib/moderation";

export const POST = route(async (req) => {
  const body = await readJson(req);
  const email = str(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = str(body.fullName, 120);
  const age = Number(body.age);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
  if (password.length < 8) return fail("Use a password with at least 8 characters.");
  if (!fullName) return fail("Enter your full name. It stays private and is only used for account safety.");
  if (!Number.isInteger(age) || age < 13 || age > 120) return fail("You need to be 13 or older to join LikeMinds.");

  const db = await getDb();
  const users = db.collection("users");
  if (await users.findOne({ email })) return fail("An account with that email already exists. Sign in instead.");

  let displayName = str(body.displayName, 30);
  if (!displayName || !/^[\p{L}\p{N}_ .-]{3,30}$/u.test(displayName)) displayName = randomDisplayName();
  while (await users.findOne({ displayName })) displayName = randomDisplayName();

  // Check the profile before the account exists, so nothing harmful is ever saved.
  const profile = cleanProfile(body.profile || {});
  const problems = await screenFields(profileFields(displayName, profile), "profile");
  if (problems.length) {
    return json({ error: problemMessage(problems), step: 1 }, 422);
  }

  const doc = {
    email,
    fullName,
    passwordHash: hashPassword(password),
    age,
    isMinor: age < 18,
    displayName,
    profile,
    prefs: cleanPrefs(body.prefs || {}),
    privacy: { ...defaultPrivacy(), discoverable: Boolean(body.discoverable) },
    organizer: { status: "none" },
    savedThoughts: [],
    createdAt: new Date(),
  };
  const { insertedId } = await users.insertOne(doc);
  const res = json({ ok: true, displayName });
  setSessionCookie(res, String(insertedId));
  return res;
});
