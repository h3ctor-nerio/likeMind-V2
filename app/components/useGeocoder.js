"use client";
// Place search and reverse geocoding with OpenStreetMap's Nominatim service.
// Nominatim is free for light use (about one request per second), which suits a prototype.
import { useCallback } from "react";

function useOsmGeocoder() {
  const search = useCallback(async (input) => {
    if (!input.trim()) return [];
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(input)}`, {
      headers: { "Accept-Language": navigator.language || "en" },
    });
    const rows = res.ok ? await res.json() : [];
    return rows.map((r) => ({
      id: String(r.place_id),
      label: r.display_name,
      resolve: async () => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name, name: r.name || "" }),
    }));
  }, []);

  const reverse = useCallback(async (lat, lng, precision = "town") => {
    const zoom = { neighborhood: 15, town: 10, region: 7 }[precision] || 10;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=${zoom}&lat=${lat}&lon=${lng}`);
      const a = (await res.json()).address || {};
      const town = a.city || a.town || a.village || a.municipality;
      if (precision === "neighborhood") return [a.neighbourhood || a.suburb || a.quarter, town].filter(Boolean).join(", ");
      if (precision === "town") return [town, a.state].filter(Boolean).join(", ");
      return [a.county, a.state || a.country].filter(Boolean).join(", ");
    } catch {
      return "";
    }
  }, []);

  return { search, reverse, ready: true, provider: "osm" };
}

export const useGeocoder = useOsmGeocoder;
