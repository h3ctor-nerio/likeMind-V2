import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, oid } from "@/lib/http";
import { canSeeThought } from "@/lib/visibility";
import { thoughtView } from "@/lib/views";

const KINDS = ["like", "relate", "support", "insight"];

export const POST = route(
  async (req, { user, params }) => {
    const id = oid(params.id);
    const { kind } = await readJson(req);
    if (!KINDS.includes(kind)) return fail("Unknown reaction.");
    const db = await getDb();
    const t = id && (await db.collection("thoughts").findOne({ _id: id }));
    if (!canSeeThought(t, user)) return fail("This thought isn't available.", 404);
    const me = String(user._id);
    // Every reaction is a toggle: reacting again removes it (unlike).
    const has = (t.reactions?.[kind] || []).includes(me);
    const updated = await db
      .collection("thoughts")
      .findOneAndUpdate({ _id: id }, has ? { $pull: { [`reactions.${kind}`]: me } } : { $addToSet: { [`reactions.${kind}`]: me } }, { returnDocument: "after" });
    return json({ thought: thoughtView(updated, user) });
  },
  { auth: true }
);
