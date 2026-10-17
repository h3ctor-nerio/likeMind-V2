// Who can see which thoughts. Signed-out visitors and teens see "everyone" posts only.
export function thoughtFilter(viewer) {
  const filter = { status: "published" };
  if (!viewer || viewer.isMinor) filter.audience = "everyone";
  return filter;
}

export function canSeeThought(t, viewer) {
  if (!t || t.status === "removed") return false;
  const mine = viewer && String(t.authorId) === String(viewer._id);
  if (mine) return true;
  if (t.status !== "published") return false;
  if (t.audience === "adults" && (!viewer || viewer.isMinor)) return false;
  return true;
}
