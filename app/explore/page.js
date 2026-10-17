"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatWhen, timeAgo, LANGUAGES } from "@/lib/client";
import { directionsUrl } from "@/lib/maps-config";
import { useAuth } from "../components/AuthProvider";
import Map from "../components/Map";
import ThoughtCard from "../components/ThoughtCard";
import ShareThought from "../components/ShareThought";
import PlaceSearch from "../components/PlaceSearch";
import LikeButton from "../components/LikeButton";
import EventRow, { eventFacts } from "../components/EventRow";
import MindPopup from "../components/MindPopup";

const REFRESH_MS = 15 * 1000; // bubbles refresh and rotate every 15 seconds
const MAX_BUBBLES = 20; // at most this many thought bubbles on the map at once

const LAYERS = [
  { value: "all", label: "Everything" },
  { value: "thoughts", label: "Thoughts", swatch: "thought" },
  { value: "events", label: "Events", swatch: "event" },
];

export default function Explore() {
  const { me } = useAuth();
  const [layer, setLayer] = useState("all");
  const [view, setView] = useState("map");

  // Location filter shared by both layers
  const [origin, setOrigin] = useState(null); // { lat, lng, label }
  const [km, setKm] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [center, setCenter] = useState(null);

  // Thought filters
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [since, setSince] = useState("");
  const [likedOnly, setLikedOnly] = useState(false);
  // Event filters
  const [when, setWhen] = useState("");
  const [mode, setMode] = useState("");
  const [free, setFree] = useState(false);
  const [lang, setLang] = useState("");
  const [stepFree, setStepFree] = useState(false);
  const [transit, setTransit] = useState(false);

  const [thoughts, setThoughts] = useState([]);
  const [events, setEvents] = useState([]);
  const [tagPool, setTagPool] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [activePrompt, setActivePrompt] = useState(null);
  const [selected, setSelected] = useState(null); // { kind, id }
  const [pick, setPick] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rotation, setRotation] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mindIds, setMindIds] = useState([]);
  const onMindPosts = useCallback((ids) => setMindIds(ids), []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("tag")) setTag(p.get("tag"));
    if (["thoughts", "events"].includes(p.get("layer"))) setLayer(p.get("layer"));
    api("/api/prompts").then((r) => setPrompts(r.prompts)).catch(() => {});
  }, []);

  const near = origin && km ? { lat: origin.lat, lng: origin.lng, km } : null;

  const loadThoughts = useCallback(async () => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tag) p.set("tag", tag);
    if (since) p.set("since", since);
    if (likedOnly) p.set("likedOnly", "1");
    if (activePrompt) p.set("promptId", activePrompt.id);
    if (near) Object.entries(near).forEach(([k, v]) => p.set(k, v));
    const r = await api(`/api/thoughts?${p}`);
    setThoughts(r.thoughts);
    if (!tag) {
      const counts = {};
      r.thoughts.forEach((t) => t.tags.forEach((x) => (counts[x] = (counts[x] || 0) + 1)));
      setTagPool(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([x]) => x));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tag, since, likedOnly, activePrompt, near?.lat, near?.lng, near?.km]);

  const loadEvents = useCallback(async () => {
    const p = new URLSearchParams();
    if (when) p.set("when", when);
    if (mode) p.set("mode", mode);
    if (free) p.set("free", "1");
    if (lang) p.set("lang", lang);
    if (stepFree) p.set("wheelchair", "1");
    if (transit) p.set("transit", "1");
    if (near) Object.entries(near).forEach(([k, v]) => p.set(k, v));
    const r = await api(`/api/events?${p}`);
    setEvents(r.events);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, mode, free, lang, stepFree, transit, near?.lat, near?.lng, near?.km]);

  useEffect(() => {
    setLoading(true);
    setErr("");
    const t = setTimeout(() => {
      Promise.all([loadThoughts(), loadEvents()])
        .catch((e) => setErr(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [loadThoughts, loadEvents, me?.id]);

  // Every 15 seconds: quietly fetch new posts and rotate which bubbles are shown, so the map stays uncluttered.
  useEffect(() => {
    if (paused || view !== "map") return;
    const t = setInterval(() => {
      setRotation((r) => r + 1);
      loadThoughts().catch(() => {});
      loadEvents().catch(() => {});
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [paused, view, loadThoughts, loadEvents]);

  function locateMe() {
    if (!navigator.geolocation) return setErr("Your browser can't share location. Search for a place instead.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUserLocation(loc);
        setOrigin({ ...loc, label: "your location" });
        if (!km) setKm(10);
        setCenter({ ...loc });
      },
      () => setErr("Location permission was denied. Search for a place instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function useHome() {
    if (!me?.prefs?.home) return;
    setOrigin({ ...me.prefs.home, label: me.prefs.region || "your area" });
    if (!km) setKm(25);
    setCenter({ ...me.prefs.home });
  }

  const showThoughts = layer !== "events";
  const showEvents = layer !== "thoughts";

  // Pinned bubbles always show: your own, the one you opened, ones you liked, and Mind's picks.
  // The rest rotate through in sets so no more than MAX_BUBBLES are on the map.
  const { shownThoughts, placedCount } = useMemo(() => {
    const placed = thoughts.filter((t) => t.lat != null);
    const mind = new Set(mindIds);
    const isPinned = (t) => t.isMine || mind.has(t.id) || t.myReactions?.includes("like") || (selected?.kind === "thought" && selected.id === t.id);
    const pinned = placed.filter(isPinned).slice(0, MAX_BUBBLES);
    const rest = placed.filter((t) => !isPinned(t));
    const room = Math.max(0, MAX_BUBBLES - pinned.length);
    let slice = rest;
    if (rest.length > room) {
      const start = (rotation * room) % rest.length;
      slice = [...rest.slice(start), ...rest.slice(0, start)].slice(0, room);
    }
    return { shownThoughts: [...pinned, ...slice], placedCount: placed.length };
  }, [thoughts, mindIds, rotation, selected]);

  const items = useMemo(
    () => [
      ...(showThoughts
        ? shownThoughts.map((t) => ({
            id: "t" + t.id,
            lat: t.lat,
            lng: t.lng,
            label: t.text.length > 34 ? t.text.slice(0, 32) + "…" : t.text,
            kind: mindIds.includes(t.id) ? "thought mind" : "thought",
            onSelect: () => setSelected({ kind: "thought", id: t.id }),
          }))
        : []),
      ...(showEvents
        ? events.map((e) => ({ id: "e" + e.id, lat: e.lat, lng: e.lng, label: e.title, kind: "event", onSelect: () => setSelected({ kind: "event", id: e.id }) }))
        : []),
    ],
    [shownThoughts, events, showThoughts, showEvents, mindIds]
  );

  const fitKey = [layer, q, tag, since, likedOnly, when, mode, free, lang, stepFree, transit, near?.km, activePrompt?.id, loading].join("|");
  const selThought = selected?.kind === "thought" ? thoughts.find((t) => t.id === selected.id) : null;
  const selEvent = selected?.kind === "event" ? events.find((e) => e.id === selected.id) : null;
  const updateThought = (nt) => setThoughts((cur) => cur.map((t) => (t.id === nt.id ? nt : t)));
  const placedThoughts = thoughts.filter((t) => t.lat != null).length;
  const placedEvents = events.filter((e) => e.lat != null).length;
  const activeFilters = [q, tag, since, likedOnly, when, mode, free, lang, stepFree, transit, near].filter(Boolean).length;

  function clearFilters() {
    setQ(""); setTag(""); setSince(""); setLikedOnly(false);
    setWhen(""); setMode(""); setFree(false); setLang(""); setStepFree(false); setTransit(false);
    setKm(0); setOrigin(null); setCenter(null);
  }

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="row spread" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Explore</h1>
        <div className="tabs" role="group" aria-label="View">
          <button aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>
          <button aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        </div>
      </div>

      {prompts.length > 0 && (
        <div className="notice warm" style={{ marginBottom: 12 }}>
          {prompts.slice(0, 2).map((p) => (
            <div key={p.id} className="row spread">
              <span><b>Community question:</b> <span translate="no">“{p.question}”</span> <span className="small muted">from <span translate="no">{p.orgName}</span>, {p.responses} answers</span></span>
              <span className="row">
                <button className="btn small ghost" onClick={() => { setActivePrompt(activePrompt?.id === p.id ? null : p); setLayer("thoughts"); }}>
                  {activePrompt?.id === p.id ? "Show all thoughts" : "See answers"}
                </button>
                {me && <button className="btn small" onClick={() => { setActivePrompt(p); document.getElementById("thought")?.focus(); }}>Answer</button>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Layer tabs */}
      <div className="layer-tabs" role="group" aria-label="Show on the map">
        {LAYERS.map((l) => (
          <button key={l.value} aria-pressed={layer === l.value} onClick={() => { setLayer(l.value); setSelected(null); }}>
            {l.swatch && <span className={`swatch ${l.swatch}`} aria-hidden="true" />}
            {l.label}
            <span className="n">
              {l.value === "thoughts" ? thoughts.length : l.value === "events" ? events.length : thoughts.length + events.length}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar" aria-label="Filters">
        <div style={{ minWidth: 240, flex: "1 1 240px", maxWidth: 360 }}>
          <PlaceSearch hideLabel label="Search a place" placeholder="Search a place to look around" onSelect={(p) => { setOrigin(p); if (!km) setKm(10); setCenter({ lat: p.lat, lng: p.lng }); }} />
        </div>
        <button className="btn ghost small" onClick={locateMe}>Near me</button>
        {me?.prefs?.home && <button className="btn ghost small" onClick={useHome}>My area</button>}
        <select aria-label="Distance" value={km} onChange={(e) => setKm(Number(e.target.value))} disabled={!origin}>
          <option value={0}>{origin ? "Any distance" : "Choose a place first"}</option>
          <option value={2}>Within 2 km</option>
          <option value={10}>Within 10 km</option>
          <option value={25}>Within 25 km</option>
          <option value={100}>Within 100 km</option>
        </select>
        {near && <span className="small muted">around {origin.label?.split(",")[0]}</span>}
      </div>

      {showThoughts && (
        <div className="filter-bar" style={{ paddingTop: 0 }} aria-label="Thought filters">
          {layer === "all" && <span className="small" style={{ fontWeight: 700 }}><span className="swatch thought" style={{ display: "inline-block", width: 14, height: 12, marginRight: 6 }} />Thoughts</span>}
          <input type="search" aria-label="Search thoughts" placeholder="Search thoughts" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Posted" value={since} onChange={(e) => setSince(e.target.value)}>
            <option value="">Any time</option>
            <option value="24">Last 24 hours</option>
            <option value="168">Last 7 days</option>
            <option value="720">Last 30 days</option>
          </select>
          {me && <button className="chip" aria-pressed={likedOnly} onClick={() => setLikedOnly(!likedOnly)}>♥ Liked by me</button>}
          {tagPool.map((t) => (
            <button key={t} className="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? "" : t)}>#{t}</button>
          ))}
          {tag && !tagPool.includes(tag) && <button className="chip" aria-pressed="true" onClick={() => setTag("")}>#{tag}</button>}
        </div>
      )}

      {showEvents && (
        <div className="filter-bar" style={{ paddingTop: 0 }} aria-label="Event filters">
          {layer === "all" && <span className="small" style={{ fontWeight: 700 }}><span className="swatch event" style={{ display: "inline-block", width: 14, height: 12, marginRight: 6 }} />Events</span>}
          <select aria-label="When" value={when} onChange={(e) => setWhen(e.target.value)}>
            <option value="">Any date</option>
            <option value="today">Today</option>
            <option value="week">Next 7 days</option>
            <option value="month">Next 30 days</option>
          </select>
          <select aria-label="Format" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">Any format</option>
            <option value="in-person">In person</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">Any language</option>
            {LANGUAGES.map((l) => <option key={l} value={l.toLowerCase()}>{l}</option>)}
          </select>
          <button className="chip" aria-pressed={free} onClick={() => setFree(!free)}>Free</button>
          <button className="chip" aria-pressed={stepFree} onClick={() => setStepFree(!stepFree)}>Step-free</button>
          <button className="chip" aria-pressed={transit} onClick={() => setTransit(!transit)}>Near transit</button>
        </div>
      )}
      {activeFilters > 0 && <button className="btn quiet small" onClick={clearFilters} style={{ marginBottom: 8 }}>Clear all filters</button>}

      {err && <div className="alert" role="alert" style={{ marginBottom: 12 }}>{err}</div>}

      <div className="side">
        <div>
          {view === "map" ? (
            <>
              <div className="map-stage">
                <Map
                  label="Map of thoughts and events"
                  items={items}
                  selectedId={selected ? (selected.kind === "thought" ? "t" : "e") + selected.id : null}
                  onPick={me ? (p) => { setPick(p); setSelected(null); } : undefined}
                  pick={pick}
                  center={center}
                  userLocation={userLocation}
                  fitKey={fitKey}
                />
                {selThought && (
                  <div className="preview" role="dialog" aria-label="Thought preview">
                    <button className="btn quiet small close" onClick={() => setSelected(null)} aria-label="Close preview">✕</button>
                    <p className="bubble-text" style={{ paddingRight: 28 }} translate="no">{selThought.text}</p>
                    <div className="bubble-meta" style={{ marginBottom: 10 }}>
                      <span translate={!selThought.isMine && selThought.author !== "Someone" ? "no" : undefined}>{selThought.isMine ? "You" : selThought.author}</span>
                      <span>{timeAgo(selThought.createdAt)}</span>
                      {selThought.areaName && <span>Around {selThought.areaName}</span>}
                    </div>
                    <div className="row spread">
                      {!selThought.isMine ? <LikeButton thought={selThought} onChange={updateThought} /> : <span />}
                      <Link className="btn small" href={`/thoughts/${selThought.id}`}>Open thought</Link>
                    </div>
                  </div>
                )}
                {selEvent && (
                  <div className="preview" role="dialog" aria-label="Event preview">
                    <button className="btn quiet small close" onClick={() => setSelected(null)} aria-label="Close preview">✕</button>
                    <h3 style={{ paddingRight: 28 }} translate="no">{selEvent.title}</h3>
                    <div className="small">{formatWhen(selEvent.startsAt, selEvent.endsAt)}</div>
                    {selEvent.locationName && <div className="small muted" translate="no">{selEvent.locationName}</div>}
                    <div className="facts">{eventFacts(selEvent).slice(0, 5).map((f) => <span key={f}>{f}</span>)}</div>
                    <div className="row" style={{ marginTop: 10 }}>
                      <Link className="btn small" href={`/events/${selEvent.id}`}>View event</Link>
                      {selEvent.lat != null && <a className="btn ghost small" href={directionsUrl(selEvent.lat, selEvent.lng)} target="_blank" rel="noreferrer">Directions</a>}
                    </div>
                  </div>
                )}
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                {loading ? "Loading…" : [
                  showThoughts && `${placedThoughts} thought${placedThoughts === 1 ? "" : "s"} on the map${thoughts.length > placedThoughts ? ` (${thoughts.length - placedThoughts} list-only)` : ""}`,
                  showEvents && `${placedEvents} event${placedEvents === 1 ? "" : "s"} on the map${events.length > placedEvents ? ` (${events.length - placedEvents} online)` : ""}`,
                ].filter(Boolean).join(", ") + "."}{" "}
                Thought locations are approximate.{me && " Click the map to place your own bubble."}
              </p>
              {showThoughts && placedCount > MAX_BUBBLES && (
                <div className="rotate-bar small">
                  <span className="muted" role="status">
                    Showing {shownThoughts.length} of {placedCount} bubbles{paused ? ". Updates paused." : ", with a new set every 15 seconds."}
                  </span>
                  <button className="btn ghost small" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? "Resume updates" : "Pause updates"}</button>
                  <button className="btn quiet small" onClick={() => setView("list")}>See all in the list</button>
                </div>
              )}
              {showThoughts && placedCount <= MAX_BUBBLES && (
                <div className="rotate-bar small">
                  <span className="muted">New thoughts appear every 15 seconds{paused ? " (paused)" : ""}.</span>
                  <button className="btn ghost small" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? "Resume updates" : "Pause updates"}</button>
                </div>
              )}
            </>
          ) : (
            <div className="stack">
              {showThoughts && (
                <section>
                  {layer === "all" && <h2>Thoughts</h2>}
                  {thoughts.length ? (
                    <div className="bubble-list">{thoughts.map((t) => <ThoughtCard key={t.id} t={t} onChange={updateThought} />)}</div>
                  ) : (
                    <div className="empty">{loading ? "Loading…" : "No thoughts match these filters. Try clearing one, or share the first."}</div>
                  )}
                </section>
              )}
              {showEvents && (
                <section>
                  {layer === "all" && <h2>Events</h2>}
                  {events.length ? <ul className="rows">{events.map((e) => <EventRow key={e.id} e={e} />)}</ul> : <div className="empty">{loading ? "Loading…" : "No events match these filters."}</div>}
                </section>
              )}
            </div>
          )}
        </div>

        {me && view === "map" && (
          <MindPopup
            onPosts={onMindPosts}
            onFocusPost={(p) => {
              if (thoughts.some((t) => t.id === p.id)) setSelected({ kind: "thought", id: p.id });
            }}
          />
        )}
        <aside className="panel">
          {me ? (
            <>
              <h2>Share a thought</h2>
              <ShareThought
                pick={pick}
                onPick={(p, opts) => { setPick(p); if (opts?.fly) setCenter({ ...p }); }}
                prompt={activePrompt}
                onClearPrompt={() => setActivePrompt(null)}
                onShared={(t) => {
                  setPick(null);
                  if (t.status === "published") setThoughts((cur) => [t, ...cur]);
                }}
              />
            </>
          ) : (
            <>
              <h2>Add your own bubble</h2>
              <p className="muted">Look around freely. To share a thought, like, or reply, create a free account. Your name stays hidden.</p>
              <div className="row">
                <Link className="btn" href="/signup">Create an account</Link>
                <Link className="btn ghost" href="/login">Sign in</Link>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
