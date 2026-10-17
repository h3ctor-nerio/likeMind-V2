export function isMember(g, user) {
  return Boolean(user && (g.members || []).some((m) => String(m.userId) === String(user._id)));
}

export function groupSummary(g, user) {
  return {
    id: String(g._id),
    name: g.name,
    description: g.description,
    tags: g.tags || [],
    visibility: g.visibility,
    memberCount: (g.members || []).length,
    isMember: isMember(g, user),
    invited: Boolean(user && (g.invites || []).some((i) => String(i) === String(user._id))),
    createdAt: g.createdAt,
  };
}
