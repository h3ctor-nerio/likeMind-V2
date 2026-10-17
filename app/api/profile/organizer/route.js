import { getDb } from "@/lib/mongodb";
import { route, json, fail, readJson, str } from "@/lib/http";

const TYPES = ["individual", "township", "public agency", "small business", "nonprofit", "school", "faith community"];

export const POST = route(
  async (req, { user }) => {
    if (user.isMinor) return fail("Hosting events is available to members 18 and older.");
    const body = await readJson(req);
    const orgName = str(body.orgName, 120);
    const orgType = TYPES.includes(body.orgType) ? body.orgType : null;
    const about = str(body.about, 600);
    if (!orgName || !orgType || !about) return fail("Fill in the organization name, type, and a short description.");
    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { organizer: { status: "pending", orgName, orgType, about, website: str(body.website, 200), appliedAt: new Date() } } }
    );
    return json({ ok: true });
  },
  { auth: true }
);
