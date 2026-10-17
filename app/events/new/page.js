"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, LANGUAGES } from "@/lib/client";
import { useAuth } from "../../components/AuthProvider";
import Gate from "../../components/Gate";
import Map from "../../components/Map";
import PlaceSearch from "../../components/PlaceSearch";
import { useGeocoder } from "../../components/useGeocoder";

function Apply() {
  const { me, refresh } = useAuth();
  const [f, setF] = useState({ orgName: "", orgType: "individual", about: "", website: "" });
  const [err, setErr] = useState("");
  const status = me.organizer?.status;

  if (status === "pending") return <div className="notice">Your application to host is with our team. We'll verify it and you'll see “Host an event” here once approved.</div>;

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      await api("/api/profile/organizer", { method: "POST", body: f });
      refresh();
    } catch (x) {
      setErr(x.message);
    }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <form className="panel stack" onSubmit={submit}>
      <h2>Apply to host events</h2>
      <p className="muted">Hosts are verified by a person on our team so attendees know who they're meeting.{status === "rejected" ? " Your last application wasn't approved; you can apply again with more detail." : ""}</p>
      <div><label htmlFor="on">Your name or organization</label><input id="on" type="text" value={f.orgName} onChange={set("orgName")} required /></div>
      <div>
        <label htmlFor="ot">Type</label>
        <select id="ot" value={f.orgType} onChange={set("orgType")}>
          {["individual", "township", "public agency", "small business", "nonprofit", "school", "faith community"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div><label htmlFor="ab">What kind of events will you host?</label><textarea id="ab" value={f.about} onChange={set("about")} required /></div>
      <div><label htmlFor="ws">Website <span className="hint">Optional, helps verification</span></label><input id="ws" type="url" value={f.website} onChange={set("website")} /></div>
      {err && <div className="alert">{err}</div>}
      <button className="btn">Send application</button>
    </form>
  );
}

function NewEvent() {
  const router = useRouter();
  const [f, setF] = useState({
    title: "", description: "", tags: "", mode: "in-person", timing: "live", startsAt: "", endsAt: "",
    locationName: "", onlineLink: "", capacity: "", ageRange: "all", languages: ["english"],
    cost: { amount: 0, notes: "" },
    accessibility: { wheelchair: false, asl: false, captions: false, quietSpace: false, notes: "" },
    transport: { transit: false, parking: false, bike: false, notes: "" },
  });
  const [where, setWhere] = useState(null);
  const [center, setCenter] = useState(null);
  const { reverse } = useGeocoder();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setIn = (group, k, v) => setF({ ...f, [group]: { ...f[group], [k]: v } });
  const toggleLang = (l) => setF({ ...f, languages: f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l] });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api("/api/events", {
        method: "POST",
        body: { ...f, startsAt: new Date(f.startsAt).toISOString(), endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined, location: where, tzOffsetMinutes: new Date(f.startsAt).getTimezoneOffset() },
      });
      router.push(`/events/${r.id}`);
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="panel stack">
        <h2>The basics</h2>
        <div><label htmlFor="t">Title</label><input id="t" type="text" value={f.title} onChange={set("title")} maxLength={120} required /></div>
        <div><label htmlFor="d">Description <span className="hint">What happens, who it's for, what to bring</span></label><textarea id="d" value={f.description} onChange={set("description")} required /></div>
        <div><label htmlFor="tg">Tags</label><input id="tg" type="text" value={f.tags} onChange={set("tags")} placeholder="gardening, outdoors, families" /></div>
        <div className="grid2">
          <div>
            <label htmlFor="m">Format</label>
            <select id="m" value={f.mode} onChange={set("mode")}>
              <option value="in-person">In person</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <label htmlFor="tm">Timing</label>
            <select id="tm" value={f.timing} onChange={set("timing")}>
              <option value="live">Live, at a set time</option>
              <option value="self-paced">Self-paced, join any time in the window</option>
            </select>
          </div>
          <div><label htmlFor="s">Starts</label><input id="s" type="datetime-local" value={f.startsAt} onChange={set("startsAt")} required /></div>
          <div><label htmlFor="en">Ends</label><input id="en" type="datetime-local" value={f.endsAt} onChange={set("endsAt")} /></div>
          <div>
            <label htmlFor="ar">Who can come</label>
            <select id="ar" value={f.ageRange} onChange={set("ageRange")}>
              <option value="all">All ages</option>
              <option value="teens">Teens only</option>
              <option value="18+">Adults 18+</option>
            </select>
          </div>
          <div><label htmlFor="cap">Capacity <span className="hint">Leave empty for no limit</span></label><input id="cap" type="number" min="0" value={f.capacity} onChange={set("capacity")} /></div>
        </div>
      </div>

      <div className="panel stack">
        <h2>Where</h2>
        {f.mode !== "online" && (
          <>
            <PlaceSearch
              label="Find the venue"
              placeholder="Venue name or street address"
              onSelect={(p) => {
                setWhere({ lat: p.lat, lng: p.lng });
                setCenter({ lat: p.lat, lng: p.lng });
                setF((cur) => ({ ...cur, locationName: p.name && !p.label.startsWith(p.name) ? `${p.name}, ${p.label}` : p.label }));
              }}
            />
            <div><label htmlFor="ln">Place name and address <span className="hint">Shown to attendees. Edit it to add a room or entrance.</span></label><input id="ln" type="text" value={f.locationName} onChange={set("locationName")} placeholder="Riverside Library, 12 Main St" /></div>
            <span className="hint">Fine-tune the pin by clicking the exact entrance on the map.</span>
            <Map short zoom={17} center={center} label="Place the event" pick={where} onPick={async (p) => {
              setWhere(p);
              if (!f.locationName) {
                const area = await reverse(p.lat, p.lng, "neighborhood");
                if (area) setF((cur) => ({ ...cur, locationName: cur.locationName || area }));
              }
            }} />
          </>
        )}
        {f.mode !== "in-person" && (
          <div><label htmlFor="ol">Online link <span className="hint">Shown only to registered attendees</span></label><input id="ol" type="url" value={f.onlineLink} onChange={set("onlineLink")} placeholder="https://" /></div>
        )}
      </div>

      <div className="panel stack">
        <h2>Cost, language, and access</h2>
        <div className="grid2">
          <div><label htmlFor="c">Cost in dollars <span className="hint">0 means free</span></label><input id="c" type="number" min="0" step="0.01" value={f.cost.amount} onChange={(e) => setIn("cost", "amount", e.target.value)} /></div>
          <div><label htmlFor="cn">Cost notes</label><input id="cn" type="text" value={f.cost.notes} onChange={(e) => setIn("cost", "notes", e.target.value)} placeholder="Sliding scale, no one turned away" /></div>
        </div>
        <fieldset>
          <legend>Languages spoken</legend>
          <div className="row">
            {LANGUAGES.map((l) => (
              <label key={l} className="check" style={{ marginRight: 8 }}>
                <input type="checkbox" checked={f.languages.includes(l.toLowerCase())} onChange={() => toggleLang(l.toLowerCase())} /> {l}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Accessibility</legend>
          {[["wheelchair", "Step-free / wheelchair access"], ["asl", "ASL interpretation"], ["captions", "Live captions"], ["quietSpace", "Quiet space available"]].map(([k, l]) => (
            <label key={k} className="check"><input type="checkbox" checked={f.accessibility[k]} onChange={(e) => setIn("accessibility", k, e.target.checked)} /> {l}</label>
          ))}
          <input type="text" aria-label="Accessibility notes" value={f.accessibility.notes} onChange={(e) => setIn("accessibility", "notes", e.target.value)} placeholder="Other access details" style={{ marginTop: 8 }} />
        </fieldset>
        <fieldset>
          <legend>Getting there</legend>
          {[["transit", "Near public transit"], ["parking", "Free parking"], ["bike", "Bike parking"]].map(([k, l]) => (
            <label key={k} className="check"><input type="checkbox" checked={f.transport[k]} onChange={(e) => setIn("transport", k, e.target.checked)} /> {l}</label>
          ))}
          <input type="text" aria-label="Transport notes" value={f.transport.notes} onChange={(e) => setIn("transport", "notes", e.target.value)} placeholder="Bus 14 stops out front" style={{ marginTop: 8 }} />
        </fieldset>
      </div>
      {err && <div className="alert" role="alert">{err}</div>}
      <button className="btn" disabled={busy}>{busy ? "Publishing…" : "Publish event"}</button>
    </form>
  );
}

function Body() {
  const { me } = useAuth();
  return me.isOrganizer ? <NewEvent /> : <Apply />;
}

export default function Page() {
  return (
    <div className="page narrow">
      <h1>Host an event</h1>
      <Gate what="host events"><Body /></Gate>
    </div>
  );
}
