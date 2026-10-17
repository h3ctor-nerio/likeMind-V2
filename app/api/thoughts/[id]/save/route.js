import { getDb } from "@/lib/mongodb";
import { route, json, fail, oid } from "@/lib/http";

export const POST = route(
  async (req, { user, params }) => {
    const id = oid(params.id);
    if (!id) return fail("This thought isn't available.", 404);
    const db = await getDb();
    const saved = (user.savedThoughts || []).some((s) => String(s) === String(id));
    await db.collection("users").updateOne({ _id: user._id }, saved ? { $pull: { savedThoughts: id } } : { $addToSet: { savedThoughts: id } });
    return json({ saved: !saved });
  },
  { auth: true }
);
