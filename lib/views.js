// Shape database documents for the browser. Author ids never leave the server for
// thoughts, so posts stay anonymous unless the writer chose to show their display name.
const REACTIONS = ["like", "relate", "support", "insight"];

export function thoughtView(t, viewer) {
  const me = viewer ? String(viewer._id) : null;
  const reactions = {};
  const myReactions = [];
  for (const k of REACTIONS) {
    const ids = t.reactions?.[k] || [];
    reactions[k] = ids.length;
    if (me && ids.includes(me)) myReactions.push(k);
  }
  const isMine = me && String(t.authorId) === me;
  return {
    id: String(t._id),
    text: t.text,
    tags: t.tags || [],
    author: t.showName ? t.authorName : "Someone",
    isMine: Boolean(isMine),
    allowReplies: t.allowReplies,
    allowConnections: t.allowConnections,
    audience: t.audience,
    lat: t.location ? t.location.coordinates[1] : null,
    lng: t.location ? t.location.coordinates[0] : null,
    precision: t.precision,
    areaName: t.areaName || "",
    language: t.language || "",
    promptId: t.promptId ? String(t.promptId) : null,
    status: isMine ? t.status : undefined,
    reviewNote: isMine ? t.reviewNote : undefined,
    reactions,
    myReactions,
    saved: Boolean(viewer?.savedThoughts?.some((s) => String(s) === String(t._id))),
    replyCount: t.replyCount || 0,
    createdAt: t.createdAt,
  };
}

export function profileView(u, { full = false } = {}) {
  const base = { id: String(u._id), displayName: u.displayName };
  if (u.profileReview?.status === "held") return { ...base, private: true };
  if (!full && u.privacy?.profileVisibility !== "public") return { ...base, private: true };
  const p = u.profile || {};
  return {
    ...base,
    intro: p.intro || "",
    values: p.values || "",
    aspirations: p.aspirations || "",
    skills: p.skills || [],
    interests: p.interests || [],
    strengths: p.strengths || [],
    tags: p.tags || [],
    languages: u.prefs?.languages || [],
  };
}

export function eventView(e, viewer, { organizerView = false } = {}) {
  const me = viewer ? String(viewer._id) : null;
  const attendees = e.attendees || [];
  const mine = attendees.find((a) => String(a.userId) === me);
  const isOrganizer = me && String(e.organizerId) === me;
  const out = {
    id: String(e._id),
    title: e.title,
    description: e.description,
    tags: e.tags || [],
    organizerName: e.organizerName,
    orgType: e.orgType,
    verified: Boolean(e.verified),
    mode: e.mode,
    timing: e.timing,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    locationName: e.locationName || "",
    lat: e.location ? e.location.coordinates[1] : null,
    lng: e.location ? e.location.coordinates[0] : null,
    cost: e.cost || { free: true },
    languages: e.languages || [],
    accessibility: e.accessibility || {},
    transport: e.transport || {},
    ageRange: e.ageRange || "all",
    capacity: e.capacity || null,
    attendeeCount: attendees.length,
    status: e.status,
    isOrganizer: Boolean(isOrganizer),
    registration: mine
      ? { checkedIn: Boolean(mine.checkedIn), accessRequest: mine.accessRequest || "", rsvpAt: mine.rsvpAt }
      : null,
    onlineLink: mine || isOrganizer ? e.onlineLink || "" : "",
    myFeedback: (e.feedback || []).find((f) => String(f.userId) === me) || null,
  };
  if (isOrganizer && e.review && e.status !== "published") {
    out.review = {
      heldFields: e.review.heldFields || [],
      questions: e.review.questions || [],
      answers: e.review.answers || null,
      submittedAt: e.review.submittedAt || null,
      declineNote: e.review.declineNote || "",
    };
  }
  if (isOrganizer && organizerView) {
    const fb = e.feedback || [];
    out.organizer = {
      attendees: attendees.map((a) => ({
        displayName: a.displayName,
        checkedIn: Boolean(a.checkedIn),
        accessRequest: a.accessRequest || "",
      })),
      checkedInCount: attendees.filter((a) => a.checkedIn).length,
      feedbackCount: fb.length,
      averageRating: fb.length ? Math.round((fb.reduce((s, f) => s + f.rating, 0) / fb.length) * 10) / 10 : null,
      comments: fb.filter((f) => f.comment).map((f) => f.comment),
    };
  }
  return out;
}
