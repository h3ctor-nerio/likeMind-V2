import { getDb } from "@/lib/mongodb";
import { randomDisplayName } from "@/lib/names";
import { route, json, str } from "@/lib/http";

// GET /api/profile/name            -> a random, unused display name
// GET /api/profile/name?check=Name -> whether that name is free
export const GET = route(async (req, { user }) => {
  const db = await getDb();
  const users = db.collection("users");
  const check = str(new URL(req.url).searchParams.get("check"), 30);
  if (check) {
    const valid = /^[\p{L}\p{N}_ .-]{3,30}$/u.test(check);
    const taken = valid && (await users.findOne({ displayName: check }));
    const mine = taken && user && String(taken._id) === String(user._id);
    return json({ valid, available: valid && (!taken || mine) });
  }
  let name = randomDisplayName();
  for (let i = 0; i < 5 && (await users.findOne({ displayName: name })); i++) name = randomDisplayName();
  return json({ name });
});
