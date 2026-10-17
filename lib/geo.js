// Locations are stored approximately so a bubble never points to someone's home.
// "neighborhood" ≈ 500 m, "town" ≈ a few km, "region" ≈ tens of km. A small random offset is added inside the grid cell.
const GRID = { neighborhood: 0.006, town: 0.03, region: 0.25 };

export function approximate(lat, lng, precision = "town") {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  const step = GRID[precision] || GRID.town;
  const snap = (v) => Math.round(v / step) * step + (Math.random() - 0.5) * step * 0.6;
  return { type: "Point", coordinates: [round(snap(ln)), round(snap(la))] };
}

export function point(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  return { type: "Point", coordinates: [ln, la] };
}

function round(v) {
  return Math.round(v * 10000) / 10000;
}

export function distanceKm(a, b) {
  if (!a || !b) return null;
  const [lng1, lat1] = a.coordinates;
  const [lng2, lat2] = b.coordinates;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
