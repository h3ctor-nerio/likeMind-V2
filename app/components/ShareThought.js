"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { PRECISIONS } from "@/lib/maps-config";
import { useAuth } from "./AuthProvider";
import { useGeocoder } from "./useGeocoder";
import PlaceSearch from "./PlaceSearch";
import VoiceDictation from "./VoiceDictation";

const SUGGESTED = ["loneliness", "new-in-town", "parenting", "caregiving", "gardening", "music", "language", "local-politics", "outdoors", "students"];

/**
 * Share a thought. The spot comes from a map click (pick), a place search, or the device.
 * The server blurs it to the chosen precision; the area name shown to others is just as coarse.
 */
export default function ShareThought({ pick, onPick, onShared, prompt, onClearPrompt }) {
  const { me } = useAuth();
  const { reverse } = useGeocoder();
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [audience, setAudience] = useState("everyone");
  const [showName, setShowName] = useState(me?.privacy?.showNameOnThoughts || false);
  const [allowReplies, setAllowReplies] = useState(true);
  const [allowConnections, setAllowConnections] = useState(false);
  const [noLocation, setNoLocation] = useState(false);
  const [precision, setPrecision] = useState("town");
  const [areaName, setAreaName] = useState("");
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  // Describe where the bubble will appear, at the chosen level of detail.
  useEffect(() => {
    let alive = true;
    setAreaName("");
    if (pick && !noLocation) reverse(pick.lat, pick.lng, precision).then((a) => alive && setAreaName(a));
    return () => {
      alive = false;
    };
  }, [pick?.lat, pick?.lng, precision, noLocation, reverse]);

  function useMyLocation() {
    setErr("");
    if (!navigator.geolocation) return setErr("Your browser can't share location. Search for a place or click the map instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setNoLocation(false);
        onPick?.({ lat: p.coords.latitude, lng: p.coords.longitude }, { fly: true });
      },
      () => {
        setLocating(false);
        setErr("Location permission was denied. Search for a place or click the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function addTag(t) {
    const cur = tags.split(",").map((s) => s.trim()).filter(Boolean);
    if (!cur.includes(t)) setTags([...cur, t].join(", "));
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!noLocation && !pick) return setErr("Choose where your bubble goes: click the map, search a place, or use your location. Or pick “Don't put it on the map”.");
    setBusy(true);
    try {
      const r = await api("/api/thoughts", {
        method: "POST",
        body: {
          text, tags, audience, showName, allowReplies, allowConnections, precision,
          location: noLocation ? null : pick,
          areaName: noLocation ? "" : areaName,
          promptId: prompt?.id,
          language: me?.prefs?.languages?.[0] || "",
        },
      });
      setResult(r);
      setText("");
      setTags("");
      onShared?.(r.thought);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="stack">
        {result.status === "published" ? (
          <div className="notice" role="status">Shared{result.thought.areaName ? ` around ${result.thought.areaName}` : ""}. Your bubble is on the map now.</div>
        ) : (
          <div className="notice warm" role="status">{result.note}</div>
        )}
        <button className="btn ghost" onClick={() => setResult(null)}>Share another thought</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="stack" aria-label="Share a thought">
      {prompt && (
        <div className="notice warm small">
          Answering: <b>{prompt.question}</b>{" "}
          <button type="button" className="btn quiet small" onClick={onClearPrompt}>Remove</button>
        </div>
      )}
      <div>
        <label htmlFor="thought">What's on your mind?</label>
        <textarea id="thought" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="A feeling, an idea, something you wish your neighborhood had…" required />
        <span className="hint">{500 - text.length} characters left. Your name stays hidden unless you choose to show it.</span>
        <VoiceDictation getText={() => text} setText={setText} maxLength={500} />
      </div>
      <div>
        <label htmlFor="tags">Tags <span className="hint">Optional, separated by commas</span></label>
        <input id="tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="gardening, new-in-town" />
        <div style={{ marginTop: 6 }}>
          {SUGGESTED.map((t) => (
            <button key={t} type="button" className="tag" style={{ border: 0, cursor: "pointer" }} onClick={() => addTag(t)}>#{t}</button>
          ))}
        </div>
      </div>

      <fieldset>
        <legend>Where on the map</legend>
        {!noLocation && (
          <div className="stack">
            <PlaceSearch label="Search a place" placeholder="Neighborhood, town, or landmark" onSelect={(p) => onPick?.({ lat: p.lat, lng: p.lng }, { fly: true })} />
            <div className="row">
              <button type="button" className="btn ghost small" onClick={useMyLocation} disabled={locating}>{locating ? "Finding you…" : "Use my location"}</button>
              <span className="small muted">or click the map</span>
            </div>
            <div>
              <label htmlFor="precision">How exact?</label>
              <select id="precision" value={precision} onChange={(e) => setPrecision(e.target.value)}>
                {PRECISIONS.map((p) => <option key={p.value} value={p.value}>{p.label} ({p.detail})</option>)}
              </select>
            </div>
            <div className={pick ? "notice small" : "notice warm small"} role="status">
              {pick ? (areaName ? <>Others will see: <b>around {areaName}</b>. The pin is moved slightly so it never points to an exact address.</> : "Spot chosen. The pin is moved slightly so it never points to an exact address.") : "No spot chosen yet."}
            </div>
          </div>
        )}
        <label className="check" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={noLocation} onChange={(e) => setNoLocation(e.target.checked)} /> Don't put it on the map (list view only)
        </label>
      </fieldset>

      <fieldset>
        <legend>Who can respond</legend>
        <label className="check"><input type="checkbox" checked={allowReplies} onChange={(e) => setAllowReplies(e.target.checked)} /> Allow replies</label>
        <label className="check"><input type="checkbox" checked={allowConnections} onChange={(e) => setAllowConnections(e.target.checked)} /> Let people ask to connect with me <span className="hint">You approve each request.</span></label>
        <label className="check"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Show my display name ({me?.displayName})</label>
        {!me?.isMinor && (
          <div className="field">
            <label htmlFor="audience">Audience</label>
            <select id="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="everyone">Everyone, including teens</option>
              <option value="adults">Adults only (18+)</option>
            </select>
          </div>
        )}
      </fieldset>

      {err && <div className="alert" role="alert">{err}</div>}
      <button className="btn" disabled={busy || text.trim().length < 3}>{busy ? "Sharing…" : "Share thought"}</button>
    </form>
  );
}
