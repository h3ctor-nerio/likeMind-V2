"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, LANGUAGES } from "@/lib/client";
import { useAuth } from "../components/AuthProvider";
import EventRow from "../components/EventRow";

export default function Events() {
  const { me } = useAuth();
  const [data, setData] = useState(null);
  const [f, setF] = useState({ free: false, mode: "", lang: "", wheelchair: false, transit: false });
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (f.free) p.set("free", "1");
    if (f.mode) p.set("mode", f.mode);
    if (f.lang) p.set("lang", f.lang);
    if (f.wheelchair) p.set("wheelchair", "1");
    if (f.transit) p.set("transit", "1");
    api(`/api/events?${p}`).then(setData).catch((e) => setErr(e.message));
  }, [f]);
  useEffect(() => {
    load();
  }, [load, me?.id]);

  const set = (k, v) => setF({ ...f, [k]: v });

  return (
    <div className="page">
      <div className="row spread" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Events</h1>
        <div className="row">
          <Link className="btn ghost" href="/explore?layer=events">See on the map</Link>
          {me && <Link className="btn" href="/events/new">{me.isOrganizer ? "Host an event" : "Apply to host"}</Link>}
        </div>
      </div>
      <p className="muted">Hosted by verified people and organizations: townships, public agencies, libraries, small businesses, and neighbors.</p>

      <fieldset style={{ marginBottom: 20 }}>
        <legend>Filter</legend>
        <div className="row">
          <select aria-label="Format" value={f.mode} onChange={(e) => set("mode", e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Any format</option>
            <option value="in-person">In person</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <select aria-label="Language" value={f.lang} onChange={(e) => set("lang", e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Any language</option>
            {LANGUAGES.map((l) => <option key={l} value={l.toLowerCase()}>{l}</option>)}
          </select>
          <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={f.free} onChange={(e) => set("free", e.target.checked)} /> Free</label>
          <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={f.wheelchair} onChange={(e) => set("wheelchair", e.target.checked)} /> Step-free access</label>
          <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={f.transit} onChange={(e) => set("transit", e.target.checked)} /> Near transit</label>
        </div>
      </fieldset>

      {err && <div className="alert">{err}</div>}
      {!data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {data.recommended.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2>Picked for you</h2>
              <p className="small muted">Based on the interests, languages, and needs you chose to share. <Link href="/profile">Update them</Link>.</p>
              <ul className="rows">{data.recommended.map((e) => <EventRow key={e.id} e={e} />)}</ul>
            </section>
          )}
          <section>
            <h2>All upcoming</h2>
            {data.events.length ? (
              <ul className="rows">{data.events.map((e) => <EventRow key={e.id} e={e} />)}</ul>
            ) : (
              <div className="empty">No events match these filters. Try removing one.</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
