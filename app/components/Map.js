"use client";
import dynamic from "next/dynamic";

// OpenStreetMap via Leaflet. Loaded only in the browser.
// Props: items [{ id, lat, lng, label, kind, onSelect }], pick, onPick, center, zoom,
// selectedId, userLocation, fitKey, short, label
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map-wrap empty">Loading map…</div>,
});

export default MapView;
