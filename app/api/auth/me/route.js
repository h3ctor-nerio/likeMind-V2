import { getDb } from "@/lib/mongodb";
import { isAdmin, isVerifiedOrganizer } from "@/lib/auth";
import { route, json } from "@/lib/http";
import { aiEnabled } from "@/lib/ai";
import { openaiEnabled } from "@/lib/openai";

export const GET = route(async (req, { user }) => {
  if (!user) return json({ user: null, aiEnabled: aiEnabled(), voiceEnabled: openaiEnabled() });
  const db = await getDb();
  const [pendingRequests, groupInvites] = await Promise.all([
    db.collection("connections").countDocuments({ toId: user._id, status: "pending" }),
    db.collection("groups").countDocuments({ invites: user._id }),
  ]);
  const home = user.prefs?.home;
  return json({
    aiEnabled: aiEnabled(),
    voiceEnabled: openaiEnabled(),
    user: {
      id: String(user._id),
      email: user.email,
      fullName: user.fullName,
      displayName: user.displayName,
      age: user.age,
      isMinor: user.isMinor,
      profile: user.profile || {},
      prefs: { ...(user.prefs || {}), home: home ? { lat: home.coordinates[1], lng: home.coordinates[0] } : null },
      privacy: user.privacy || {},
      organizer: user.organizer || { status: "none" },
      isAdmin: isAdmin(user),
      isOrganizer: isVerifiedOrganizer(user),
      pendingRequests,
      trustStatus: ["needs_info", "info_submitted", "restricted"].includes(user.trust?.status) ? user.trust.status : "clear",
      groupInvites,
    },
  });
});
