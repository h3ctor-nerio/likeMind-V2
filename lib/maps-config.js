// Maps use OpenStreetMap (map tiles via Leaflet, place search via Nominatim). No API key needed.
export const DEFAULT_CENTER = { lat: 39.5, lng: -98.35 };

export const PRECISIONS = [
  { value: "neighborhood", label: "My neighborhood", detail: "about 500 m off" },
  { value: "town", label: "My town or city", detail: "a few km off" },
  { value: "region", label: "My region", detail: "tens of km off" },
];

// Opens turn-by-turn directions in OpenStreetMap, starting from wherever the person chooses.
export function directionsUrl(lat, lng) {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=16/${lat}/${lng}`;
}
