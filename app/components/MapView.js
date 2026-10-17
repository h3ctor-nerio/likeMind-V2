"use client";
// OpenStreetMap map (Leaflet). Free, no API key.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { useEffect } from "react";
import { DEFAULT_CENTER } from "@/lib/maps-config";

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const icon = (label, kind, selected) =>
  L.divIcon({ className: "lm-divicon", html: `<div class="lm-pin ${kind} ${selected ? "selected" : ""}">${esc(label)}</div>`, iconSize: null, iconAnchor: [4, 30] });
const meIcon = L.divIcon({ className: "lm-divicon", html: '<div class="lm-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

function ClickToPick({ onPick }) {
  useMapEvents({ click: (e) => onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Fit({ points, center, zoom, fitKey }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], zoom || 12);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])).pad(0.2), { maxZoom: 13 });
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, center?.lat, center?.lng]);
  return null;
}

export default function MapView({ items = [], onPick, pick, center, zoom, short = false, label = "Map", selectedId, userLocation, fitKey }) {
  const placed = items.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng));
  return (
    <div className={`map-wrap ${short ? "short" : ""}`} role="region" aria-label={label} translate="no">
      <MapContainer center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} zoom={4} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit points={placed} center={center} zoom={zoom} fitKey={fitKey ?? placed.length} />
        {onPick && <ClickToPick onPick={onPick} />}
        {placed.map((i) => (
          <Marker key={i.id} position={[i.lat, i.lng]} icon={icon(i.label, i.kind, i.id === selectedId)} title={i.label} keyboard zIndexOffset={i.id === selectedId ? 1000 : 0} eventHandlers={{ click: () => i.onSelect?.() }} />
        ))}
        {pick && <Marker position={[pick.lat, pick.lng]} icon={icon("Here", "pick")} zIndexOffset={2000} />}
        {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={meIcon} title="You are here" />}
      </MapContainer>
    </div>
  );
}
