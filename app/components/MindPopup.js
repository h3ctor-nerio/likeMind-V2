"use client";
// Mind: a pop-up on the map that suggests 3 people every 10 minutes, each with 2 of their recent posts.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, timeAgo } from "@/lib/client";
import { useAuth } from "./AuthProvider";

const POLL_MS = 60 * 1000; // check once a minute; the server only makes a new batch every 10 minutes

function seenKey(me) {
  return `lm-mind-seen-${me?.id}`;
}
function readSeen(me) {
  try {
    return sessionStorage.getItem(seenKey(me)) || "";
  } catch {
    return "";
  }
}
function writeSeen(me, id) {
  try {
    sessionStorage.setItem(seenKey(me), id);
  } catch {}
}

export default function MindPopup({ onPosts, onFocusPost }) {
  const { me, refresh } = useAuth();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const [why, setWhy] = useState(false);
  const [sent, setSent] = useState({});
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const batchRef = useRef("");

  const load = useCallback(async () => {
    try {
      const d = await api("/api/mind");
      setData(d);
      onPosts?.((d.suggestions || []).flatMap((s) => s.posts.map((p) => p.id)));
      if (d.batchId && d.batchId !== batchRef.current) {
        batchRef.current = d.batchId;
        if (d.suggestions?.length && readSeen(me) !== d.batchId) {
          setOpen(true);
          setUnseen(true);
        }
      }
    } catch (e) {
      setErr(e.message);
    }
  }, [me, onPosts]);

  useEffect(() => {
    if (!me || me.privacy?.mindSuggestions === false) return;
    load();
    const t = setInterval(load, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => {
      clearInterval(t);
      clearInterval(clock);
    };
  }, [me, load]);

  if (!me || me.privacy?.mindSuggestions === false) return null;

  function close() {
    setOpen(false);
    setUnseen(false);
    if (data?.batchId) writeSeen(me, data.batchId);
  }

  async function connect(s) {
    setErr("");
    try {
      await api("/api/connections", { method: "POST", body: { userId: s.id, note: s.shared.length ? `Mind thought we'd get along. I'm into ${s.shared.slice(0, 2).join(" and ")} too.` : "" } });
      setSent((x) => ({ ...x, [s.id]: true }));
    } catch (e) {
      setErr(e.message);
    }
  }

  async function dismiss(s) {
    await api("/api/mind", { method: "POST", body: { action: "dismiss", userId: s.id } });
    setData((d) => ({ ...d, suggestions: d.suggestions.filter((x) => x.id !== s.id) }));
  }

  async function turnOff() {
    await api("/api/mind", { method: "POST", body: { action: "off" } });
    onPosts?.([]);
    refresh();
  }

  const mins = data?.nextAt ? Math.max(0, Math.ceil((new Date(data.nextAt).getTime() - now) / 60000)) : null;

  if (!open) {
    return (
      <button className="mind-fab" onClick={() => { setOpen(true); setUnseen(false); }} aria-label={unseen ? "Open Mind, new suggestions" : "Open Mind"}>
        <span className="mind-face" aria-hidden="true" />
        Mind
        {unseen && <span className="mind-dot" aria-hidden="true" />}
      </button>
    );
  }

  return (
    <section className="mind" role="dialog" aria-label="Mind suggestions" aria-live="polite">
      <header className="mind-head">
        <span className="mind-face" aria-hidden="true" />
        <div>
          <h2>Mind</h2>
          <p className="small muted" style={{ margin: 0 }}>People you might click with</p>
        </div>
        <button className="btn quiet small" onClick={close} aria-label="Minimize Mind">Minimize</button>
      </header>

      <div className="mind-body">
        {!data && !err && <p className="muted">Mind is looking…</p>}
        {err && <div className="alert small">{err}</div>}

        {data && !data.hasProfile && (
          <div className="notice small">
            Mind matches people by the interests, skills, and values on your profile. <Link href="/profile">Add a few</Link> and Mind will start suggesting people.
          </div>
        )}

        {data && data.hasProfile && data.suggestions?.length === 0 && (
          <p className="muted small">No new matches right now. Mind will look again{mins != null ? ` in about ${mins} min` : " soon"}.</p>
        )}

        {data?.suggestions?.map((s) => (
          <article key={s.id} className="mind-person">
            <div className="row spread">
              <b translate="no">{s.displayName}</b>
              {s.connection === "accepted" ? <span className="badge">Connected</span> : null}
            </div>
            {s.shared.length > 0 && <div translate="no">{s.shared.map((x) => <span key={x} className="tag">{x}</span>)}</div>}
            <p className="mind-note">{s.reason}</p>
            {s.posts.length > 0 ? (
              <div className="mind-posts">
                {s.posts.map((p) => (
                  <Link key={p.id} href={`/thoughts/${p.id}`} className="mind-post" onMouseEnter={() => onFocusPost?.(p)} onFocus={() => onFocusPost?.(p)}>
                    <span translate="no">{p.text.length > 110 ? p.text.slice(0, 108) + "…" : p.text}</span>
                    <span className="small muted">{timeAgo(p.createdAt)}{p.areaName ? `, around ${p.areaName}` : ""}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="small muted">No public thoughts yet.</p>
            )}
            <div className="row">
              {sent[s.id] || s.connection === "pending" ? (
                <span className="small" role="status">Request sent. They decide whether to connect.</span>
              ) : s.connection !== "accepted" ? (
                <button className="btn small" onClick={() => connect(s)}>Ask to connect</button>
              ) : null}
              <button className="btn quiet small" onClick={() => dismiss(s)}>Not for me</button>
            </div>
          </article>
        ))}
      </div>

      <footer className="mind-foot">
        <span className="small muted">{mins != null ? `New suggestions in ${mins} min` : ""}</span>
        <button className="btn quiet small" onClick={() => setWhy(!why)} aria-expanded={why}>Why these people?</button>
      </footer>
      {why && (
        <div className="mind-why small">
          <p>
            Mind compares the interests, skills, strengths, and values you chose to share with people who turned on “Let Mind suggest me.”
            {data?.aiWritten ? " An AI picked the final three and wrote the notes, so they can be wrong." : " The notes come from what you have in common."}
            {" "}Mind never uses your messages, location history, or anything you haven't shared.
          </p>
          <p style={{ margin: 0 }}>
            {data && !data.discoverable && <>You're not suggested to others. <Link href="/profile">Change that in Privacy</Link>. </>}
            <button className="btn quiet small" onClick={turnOff}>Turn off Mind</button>
          </p>
        </div>
      )}
    </section>
  );
}
