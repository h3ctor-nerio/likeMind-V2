import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson } from "@/lib/http";
import { askAI, aiEnabled, parseJson } from "@/lib/ai";
import { byCode, ENGLISH_NAMES } from "@/lib/languages";

const PER_REQUEST = 60;
const PER_HOUR = 3000; // new (uncached) strings per person per hour

// Translates interface strings. Every translation is stored, so each string is translated once
// per language for everyone; after the first visit the interface loads from the database.
export const POST = route(
  async (req, { user }) => {
    if (!aiEnabled()) return fail("Interface translation needs OPENAI_API_KEY in the server settings.", 501);
    const body = await readJson(req);
    const lang = byCode(body.lang);
    if (!lang || lang.code === "en") return fail("That language isn't supported.");
    const strings = [...new Set((Array.isArray(body.strings) ? body.strings : []).map((s) => String(s).slice(0, 1000)).filter((s) => /\p{L}/u.test(s)))].slice(0, PER_REQUEST);
    if (!strings.length) return json({ translations: {} });

    const db = await getDb();
    const col = db.collection("ui_translations");
    const found = await col.find({ lang: lang.code, source: { $in: strings } }).toArray();
    const map = Object.fromEntries(found.map((d) => [d.source, d.text]));
    const missing = strings.filter((s) => !(s in map));

    if (missing.length) {
      const usage = db.collection("ui_translate_usage");
      const recent = await usage.aggregate([{ $match: { userId: user._id, at: { $gt: new Date(Date.now() - 3600 * 1000) } } }, { $group: { _id: null, n: { $sum: "$n" } } }]).toArray();
      if ((recent[0]?.n || 0) + missing.length > PER_HOUR) return json({ translations: map, limited: true });
      await usage.insertOne({ userId: user._id, n: missing.length, at: new Date() });

      const translated = await translateBatch(lang.code, missing);
      const writes = [];
      missing.forEach((src, i) => {
        const t = translated?.[i];
        if (typeof t === "string" && t.trim() && samePlaceholders(src, t)) {
          map[src] = t;
          writes.push({ updateOne: { filter: { lang: lang.code, source: src }, update: { $set: { text: t, at: new Date() } }, upsert: true } });
        }
      });
      if (writes.length) await col.bulkWrite(writes, { ordered: false }).catch((e) => console.error("ui_translations write", e.message));
    }
    return json({ translations: map });
  },
  { auth: true }
);

function samePlaceholders(a, b) {
  const ph = (s) => (s.match(/\{\d+\}/g) || []).sort().join();
  return ph(a) === ph(b);
}

async function translateBatch(code, strings) {
  const out = await askAI({
    maxTokens: 4000,
    timeoutMs: 45000,
    system:
      `You translate the user interface of LikeMinds, a warm, welcoming community app, from English into ${ENGLISH_NAMES[code]}. ` +
      "Each item is a button, label, heading, hint, or message. Keep translations natural, short, plain, and friendly; use the informal " +
      "\"you\" where that is normal for apps in this language. Keep placeholders like {0} and {1} exactly as they are. " +
      "Do not translate: LikeMinds, Mind (the name of the app's assistant), OpenStreetMap, 988, #hashtags, or email addresses. " +
      'Respond with JSON only: {"t": [translations in the same order, one per item]}.',
    prompt: JSON.stringify(strings),
  });
  const parsed = parseJson(out);
  return Array.isArray(parsed?.t) && parsed.t.length === strings.length ? parsed.t : null;
}
