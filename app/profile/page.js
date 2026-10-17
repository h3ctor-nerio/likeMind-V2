"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useAuth } from "../components/AuthProvider";
import Gate from "../components/Gate";
import ThoughtCard from "../components/ThoughtCard";
import { ProfileSection, PrefsSection } from "../components/ProfileFields";

const TABS = ["Name", "Profile", "Preferences", "Privacy", "My thoughts", "Liked", "Saved"];

function Profile() {
  const { me, refresh } = useAuth();
  const [tab, setTab] = useState("Name");
  const [displayName, setDisplayName] = useState(me.displayName);
  const [fullName, setFullName] = useState(me.fullName);
  const [nameStatus, setNameStatus] = useState(null);

  useEffect(() => {
    if (displayName === me.displayName) return setNameStatus(null);
    const t = setTimeout(async () => {
      const r = await api(`/api/profile/name?check=${encodeURIComponent(displayName)}`);
      setNameStatus(!r.valid ? "invalid" : r.available ? "available" : "taken");
    }, 300);
    return () => clearTimeout(t);
  }, [displayName, me.displayName]);
  const [profile, setProfile] = useState(me.profile);
  const [prefs, setPrefs] = useState(me.prefs);
  const [privacy, setPrivacy] = useState(me.privacy);
  const [thoughts, setThoughts] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (tab === "My thoughts") api("/api/thoughts?mine=1").then((r) => setThoughts(r.thoughts));
    if (tab === "Saved") api("/api/thoughts?saved=1").then((r) => setThoughts(r.thoughts));
    if (tab === "Liked") api("/api/thoughts?liked=1").then((r) => setThoughts(r.thoughts));
  }, [tab]);

  async function save(body) {
    setMsg("");
    setErr("");
    try {
      await api("/api/profile", { method: "PUT", body });
      await refresh();
      setMsg("Changes saved.");
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <>
      <div className="tabs" role="group" aria-label="Profile sections" style={{ marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map((t) => <button key={t} aria-pressed={tab === t} onClick={() => { setTab(t); setMsg(""); setErr(""); setThoughts(null); }}>{t}</button>)}
      </div>
      {msg && <div className="notice" role="status" style={{ marginBottom: 12 }}>{msg}</div>}
      {err && <div className="alert" role="alert" style={{ marginBottom: 12 }}>{err}</div>}

      {tab === "Name" && (
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); save({ displayName, fullName }); }}>
          <div>
            <label htmlFor="dn">Display name <span className="hint">The only name others see, on thoughts you choose to sign, replies, chats, groups, and events. Changing it updates it everywhere.</span></label>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input id="dn" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} aria-describedby="dn-status" />
              <button type="button" className="btn ghost" onClick={async () => setDisplayName((await api("/api/profile/name")).name)}>Shuffle</button>
            </div>
            <span id="dn-status" className="hint" role="status">
              {nameStatus === "available" && "That name is available."}
              {nameStatus === "taken" && <span style={{ color: "var(--danger)" }}>That name is taken. Try another or shuffle.</span>}
              {nameStatus === "invalid" && <span style={{ color: "var(--danger)" }}>Use 3–30 letters, numbers, spaces, dots, dashes, or underscores.</span>}
            </span>
          </div>
          <div>
            <label htmlFor="fn">Full name <span className="hint">Private. Never shown to anyone; kept for account safety.</span></label>
            <input id="fn" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} autoComplete="name" />
          </div>
          <button className="btn" disabled={nameStatus === "taken" || nameStatus === "invalid"}>Save names</button>
          <p className="small muted">Signed in as {me.email}.</p>
        </form>
      )}

      {tab === "Profile" && (
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); save({ profile }); }}>
          <ProfileSection value={profile} onChange={setProfile} />
          <button className="btn">Save profile</button>
        </form>
      )}

      {tab === "Preferences" && (
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); save({ prefs }); }}>
          <PrefsSection value={prefs} onChange={setPrefs} />
          <button className="btn">Save preferences</button>
        </form>
      )}

      {tab === "Privacy" && (
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); save({ privacy }); }}>
          <p className="muted">Everything starts private. Turn things on only if you want to.</p>
          <label className="check">
            <input type="checkbox" checked={privacy.profileVisibility === "public"} onChange={(e) => setPrivacy({ ...privacy, profileVisibility: e.target.checked ? "public" : "private" })} />
            Let people I'm not connected with see my profile <span className="hint">Connections can always see your profile.</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={privacy.showNameOnThoughts} onChange={(e) => setPrivacy({ ...privacy, showNameOnThoughts: e.target.checked })} />
            Show my display name on new thoughts by default <span className="hint">You can still change it for each thought.</span>
          </label>
          <fieldset>
            <legend>Mind suggestions</legend>
            <label className="check">
              <input type="checkbox" checked={privacy.mindSuggestions !== false} onChange={(e) => setPrivacy({ ...privacy, mindSuggestions: e.target.checked })} />
              Show me Mind's suggestions on the map <span className="hint">Every 10 minutes, Mind suggests 3 people with similar interests, skills, and values.</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={Boolean(privacy.discoverable)} onChange={(e) => setPrivacy({ ...privacy, discoverable: e.target.checked })} />
              Let Mind suggest me to others
              <span className="hint">People with things in common may see your display name, shared interests, and your 2 most recent thoughts, which links those thoughts to your display name. Teens are only suggested to teens. Turn this off any time.</span>
            </label>
          </fieldset>
          <button className="btn">Save privacy settings</button>
          {me.isMinor && <div className="notice small">Because you're under 18, you see posts meant for everyone and can connect only with other teens.</div>}
        </form>
      )}

      {["My thoughts", "Liked", "Saved"].includes(tab) &&
        (thoughts === null ? (
          <p className="muted">Loading…</p>
        ) : thoughts.length ? (
          <div className="bubble-list">
            {thoughts.map((t) => (
              <ThoughtCard key={t.id} t={t} onChange={(nt) => tab === "Liked" && !nt.myReactions.includes("like") && setThoughts((cur) => cur.filter((x) => x.id !== nt.id))} />
            ))}
          </div>
        ) : (
          <div className="empty">{tab === "Saved" ? "Thoughts you save show up here." : tab === "Liked" ? "Thoughts you like show up here. Unlike one to remove it." : "You haven't shared a thought yet."}</div>
        ))}
    </>
  );
}

export default function Page() {
  return (
    <div className="page narrow">
      <h1>Your profile</h1>
      <Gate what="edit your profile"><Profile /></Gate>
    </div>
  );
}
