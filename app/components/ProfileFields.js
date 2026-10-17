"use client";
import { useState } from "react";
import Map from "./Map";
import PlaceSearch from "./PlaceSearch";
import { uiOptions } from "@/lib/languages";
import { LANGUAGES } from "@/lib/client";

const join = (v) => (Array.isArray(v) ? v.join(", ") : v || "");

export function ProfileSection({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="stack">
      <p className="muted">
        Everything here is optional. Share what you're good at and what you care about. You never have to explain what's been hard.
      </p>
      <div>
        <label htmlFor="intro">A line about you</label>
        <textarea id="intro" value={value.intro || ""} onChange={set("intro")} maxLength={400} placeholder="Retired teacher, new grandparent, learning to bake bread." />
      </div>
      <div className="grid2">
        <div>
          <label htmlFor="interests">Interests <span className="hint">Separate with commas</span></label>
          <input id="interests" type="text" value={join(value.interests)} onChange={set("interests")} placeholder="gardening, chess, hiking" />
        </div>
        <div>
          <label htmlFor="skills">Skills you could share</label>
          <input id="skills" type="text" value={join(value.skills)} onChange={set("skills")} placeholder="bike repair, tutoring, cooking" />
        </div>
        <div>
          <label htmlFor="strengths">Strengths</label>
          <input id="strengths" type="text" value={join(value.strengths)} onChange={set("strengths")} placeholder="good listener, organizer" />
        </div>
        <div>
          <label htmlFor="ptags">Tags</label>
          <input id="ptags" type="text" value={join(value.tags)} onChange={set("tags")} placeholder="new-in-town, parent" />
        </div>
      </div>
      <div>
        <label htmlFor="values">What matters to you</label>
        <input id="values" type="text" value={value.values || ""} onChange={set("values")} maxLength={300} placeholder="Family, fairness, being outdoors" />
      </div>
      <div>
        <label htmlFor="aspirations">Something you'd like to do or contribute</label>
        <input id="aspirations" type="text" value={value.aspirations || ""} onChange={set("aspirations")} maxLength={300} placeholder="Start a community garden, teach a class" />
      </div>
    </div>
  );
}

export function PrefsSection({ value, onChange }) {
  const [center, setCenter] = useState(null);
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const access = value.access || {};
  const setAccess = (k, v) => onChange({ ...value, access: { ...access, [k]: v } });
  const langs = Array.isArray(value.languages) ? value.languages : String(value.languages || "").split(",").map((s) => s.trim()).filter(Boolean);
  const toggleLang = (l) => onChange({ ...value, languages: langs.includes(l) ? langs.filter((x) => x !== l) : [...langs, l] });
  const transport = access.transport || [];
  const toggleTransport = (t) => setAccess("transport", transport.includes(t) ? transport.filter((x) => x !== t) : [...transport, t]);
  const avail = value.availability || [];
  const toggleAvail = (a) => onChange({ ...value, availability: avail.includes(a) ? avail.filter((x) => x !== a) : [...avail, a] });

  return (
    <div className="stack">
      <div>
        <label htmlFor="region">Your area <span className="hint">A town or broad region, like “East Bay” or “Northern Arizona”. Shown to no one; used for nearby suggestions.</span></label>
        <input id="region" type="text" value={value.region || ""} onChange={set("region")} />
      </div>
      <div className="stack">
        <PlaceSearch
          label="Find your area on the map"
          placeholder="Your town, neighborhood, or zip code"
          onSelect={(p) => {
            setCenter({ lat: p.lat, lng: p.lng });
            onChange({ ...value, home: { lat: p.lat, lng: p.lng }, region: value.region || p.label.split(",").slice(0, 2).join(",").trim() });
          }}
        />
        <span className="hint">Or click the map near where you live. We store it blurred to your region and use it for “near me” suggestions.</span>
        <Map short zoom={11} center={center} label="Pick your general area" pick={value.home} onPick={(p) => onChange({ ...value, home: p })} />
        {value.home && (
          <button type="button" className="btn quiet small" onClick={() => onChange({ ...value, home: null, keepHome: false })}>Clear my area</button>
        )}
      </div>
      <fieldset>
        <legend>Languages you're comfortable in</legend>
        <div className="row">
          {LANGUAGES.map((l) => (
            <label key={l} className="check" style={{ marginRight: 8 }}>
              <input type="checkbox" checked={langs.map((x) => x.toLowerCase()).includes(l.toLowerCase())} onChange={() => toggleLang(l.toLowerCase())} /> {l}
            </label>
          ))}
        </div>
      </fieldset>
      {uiOptions(langs).length > 0 && (
        <div>
          <label htmlFor="uilang">Site language <span className="hint">The language buttons and menus appear in, translated by AI. With one language listed, the site uses it. With more, a language menu appears at the top right.</span></label>
          <select id="uilang" value={value.uiLanguage || uiOptions(langs)[0].code} onChange={set("uiLanguage")} translate="no">
            {uiOptions(langs).map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      )}
      <fieldset>
        <legend>When are you usually free?</legend>
        <div className="row">
          {["weekday mornings", "weekday evenings", "weekends", "varies"].map((a) => (
            <label key={a} className="check" style={{ marginRight: 8 }}>
              <input type="checkbox" checked={avail.includes(a)} onChange={() => toggleAvail(a)} /> {a}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="participation">How do you like to take part?</label>
        <select id="participation" value={value.participation || "either"} onChange={set("participation")}>
          <option value="either">Online or in person</option>
          <option value="online">Online</option>
          <option value="in-person">In person</option>
        </select>
      </div>
      <fieldset>
        <legend>Practical needs (optional)</legend>
        <label className="check"><input type="checkbox" checked={Boolean(access.freeOnly)} onChange={(e) => setAccess("freeOnly", e.target.checked)} /> Show me free events first</label>
        <div className="field">
          <span style={{ fontWeight: 700 }}>How you get around</span>
          <div className="row">
            {["walk", "bike", "transit", "car", "rideshare", "paratransit"].map((t) => (
              <label key={t} className="check" style={{ marginRight: 8 }}>
                <input type="checkbox" checked={transport.includes(t)} onChange={() => toggleTransport(t)} /> {t}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="travel">Longest trip you'd make (minutes)</label>
          <input id="travel" type="number" min="0" max="240" value={access.maxTravelMinutes || ""} onChange={(e) => setAccess("maxTravelMinutes", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="anotes">Anything that helps you take part <span className="hint">Private. Used only to suggest events; never shared unless you choose to when registering.</span></label>
          <input id="anotes" type="text" value={access.notes || ""} onChange={(e) => setAccess("notes", e.target.value)} placeholder="Step-free access, quiet space, captions…" />
        </div>
      </fieldset>
    </div>
  );
}
