// Browser-side fetch helper: throws an Error with the server's message on failure.
export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  return new Date(date).toLocaleDateString();
}

export function formatWhen(start, end) {
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const day = s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const t = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return e ? `${day}, ${t(s)}–${t(e)}` : `${day}, ${t(s)}`;
}

export const LANGUAGES = ["English", "Spanish", "Chinese", "Vietnamese", "Tagalog", "Arabic", "French", "Haitian Creole", "Korean", "Russian", "Portuguese", "Hindi", "ASL"];
