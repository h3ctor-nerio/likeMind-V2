import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson } from "@/lib/http";
import { byCode, uiOptions } from "@/lib/languages";

// Save the interface language picked from the floating language menu.
export const POST = route(
  async (req, { user }) => {
    const { code } = await readJson(req);
    const lang = byCode(code);
    const allowed = uiOptions(user.prefs?.languages || []).map((l) => l.code);
    if (!lang || (!allowed.includes(lang.code) && lang.code !== "en")) return fail("Add that language to your profile first.");
    const db = await getDb();
    await db.collection("users").updateOne({ _id: user._id }, { $set: { "prefs.uiLanguage": lang.code } });
    return json({ ok: true });
  },
  { auth: true }
);
