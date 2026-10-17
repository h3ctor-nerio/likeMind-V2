import { getDb } from "@/lib/mongodb";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { route, json, fail, readJson, str } from "@/lib/http";

export const POST = route(async (req) => {
  const body = await readJson(req);
  const email = str(body.email, 200).toLowerCase();
  const db = await getDb();
  const user = await db.collection("users").findOne({ email });
  if (!user || !verifyPassword(String(body.password || ""), user.passwordHash)) {
    return fail("That email and password don't match an account.", 401);
  }
  const res = json({ ok: true });
  setSessionCookie(res, String(user._id));
  return res;
});
