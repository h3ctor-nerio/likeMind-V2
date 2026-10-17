"use client";
import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "@/lib/client";
import { useAuth } from "../components/AuthProvider";
import Gate from "../components/Gate";

function Queue() {
  const { me } = useAuth();
  const [q, setQ] = useState(null);
  const [err, setErr] = useState("");
  const [scan, setScan] = useState({});
  const load = useCallback(() => api("/api/admin/queue").then(setQ).catch((e) => setErr(e.message)), []);
  useEffect(() => {
    if (me.isAdmin) load();
  }, [load, me.isAdmin]);

  if (!me.isAdmin) return <div className="empty">Only moderators can open the review queue. Add your email to ADMIN_EMAILS in .env.local.</div>;
  if (err) return <div className="alert">{err}</div>;
  if (!q) return <p className="muted">Loading…</p>;

  async function act(type, id, decision, note) {
    await api("/api/admin/action", { method: "POST", body: { type, id, decision, note } });
    load();
  }
  const askNote = (msg) => window.prompt(msg) ?? null;
  async function runScan() {
    setScan({ busy: true });
    try {
      const result = await api("/api/admin/scan", { method: "POST" });
      setScan({ result });
      load();
    } catch (e) {
      setScan({ error: e.message });
    }
  }
  const s = q.safety;
  const Signals = ({ list }) => <div className="row">{list.map((x) => <span key={x.code} className={`badge ${x.strength === "strong" ? "warm" : "plain"}`}>{x.label}</span>)}</div>;
  const Answers = ({ list }) =>
    list.length ? (
      <dl className="answers">
        {list.map((a) => (
          <div key={a.question}><dt>{a.question}</dt><dd>{a.answer}</dd></div>
        ))}
      </dl>
    ) : null;

  const Section = ({ title, items, render, emptyText }) => (
    <section className="panel">
      <h2>{title} <span className="small muted">({items.length})</span></h2>
      {items.length === 0 ? <p className="muted">{emptyText}</p> : <ul className="rows">{items.map(render)}</ul>}
    </section>
  );

  return (
    <div className="stack">
      <p className="muted">Nothing here is removed automatically for good. A person makes every final call.</p>

      <section className="panel">
        <h2>Safety checks, last 30 days</h2>
        <p style={{ margin: 0 }}>
          {s.stats.asked} events asked for more information, {s.stats.approved} approved after answering, {s.stats.declined} declined.
          {s.stats.asked >= 5 && s.stats.approved / s.stats.asked > 0.8 && <b> Most flagged events turn out fine. Consider loosening the rules in lib/trust.js.</b>}
        </p>
        <p className="small muted" style={{ marginBottom: 0 }}>Signals are specific behaviors only. Account age, organization size, language, and spelling are never used. Judge the answers, not the person.</p>
      </section>

      <section className="panel stack">
        <h2>Scan existing content</h2>
        <p className="small muted" style={{ margin: 0 }}>
          New profiles, events, and posts are checked the moment they're submitted. Run a scan to re-check older content, for example after turning on the OpenAI key. Anything flagged is hidden and listed below; nothing is deleted.
        </p>
        <div className="row">
          <button className="btn small" disabled={scan.busy} onClick={runScan}>{scan.busy ? "Scanning…" : "Scan profiles, events, and posts"}</button>
          {scan.result && (
            <span className="small" role="status">
              Checked {scan.result.checked.profiles} profiles, {scan.result.checked.events} events, {scan.result.checked.thoughts} posts
              {scan.result.usedAI ? " with rules and AI" : " with rules only (add OPENAI_API_KEY for AI)"}. Held {scan.result.held.profiles} profiles, {scan.result.held.events} events, {scan.result.held.thoughts} posts.
            </span>
          )}
          {scan.error && <span className="small" style={{ color: "var(--danger)" }}>{scan.error}</span>}
        </div>
      </section>

      <Section title="Profiles held for wording" items={s.heldProfiles} emptyText="None." render={(u) => (
        <li key={u.id} className="stack">
          <div><b>{u.displayName}</b> <span className="small muted">Their profile details are hidden from others until reviewed.</span></div>
          <div className="row">{u.flags.map((f) => <span key={f} className="badge warm">{f}</span>)}</div>
          <dl className="answers">{u.excerpts.map((x) => <div key={x.label}><dt>{x.label}</dt><dd>{x.text}</dd></div>)}</dl>
          <div className="row">
            <button className="btn small" onClick={() => act("profile", u.id, "clear")}>Wording is fine</button>
            <button className="btn danger small" onClick={() => act("profile", u.id, "wipe")}>Remove that wording</button>
          </div>
        </li>
      )} />

      <Section title="Events waiting for a decision" items={s.eventsAnswered} emptyText="Nothing waiting." render={(e) => (
        <li key={e.id} className="stack">
          <div>
            <b>{e.title}</b> <span className="small muted">by {e.organizerName}</span>{" "}
            <span className="badge plain">{e.status === "held" ? "Held for wording" : e.status === "pending_approval" ? "Needs approval" : "Host answered"}</span>
          </div>
          {e.heldFlags.length > 0 && <div className="row">{e.heldFlags.map((f) => <span key={f} className="badge warm">{f} in {e.heldFields.join(", ")}</span>)}</div>}
          <p className="small" style={{ margin: 0 }}>{e.description}</p>
          <Signals list={e.signals} />
          {e.aiNote && <p className="small muted" style={{ margin: 0 }}>AI note (may be wrong): {e.aiNote}</p>}
          <Answers list={e.answers} />
          <div className="row">
            <button className="btn small" onClick={() => act("event", e.id, "approve")}>Approve and publish</button>
            <button className="btn danger small" onClick={() => { const n = askNote("Tell the host why, in one respectful sentence:"); if (n !== null) act("event", e.id, "decline", n); }}>Decline</button>
          </div>
        </li>
      )} />
      <Section title="Events waiting for the host" items={s.eventsWaiting} emptyText="None." render={(e) => (
        <li key={e.id} className="stack">
          <div><b>{e.title}</b> <span className="small muted">by {e.organizerName}</span></div>
          <Signals list={e.signals} />
          <div className="row"><button className="btn ghost small" onClick={() => act("event", e.id, "approve")}>Approve without answers</button></div>
        </li>
      )} />
      <Section title="Published events worth a quick look" items={s.eventsWatch} emptyText="None." render={(e) => (
        <li key={e.id} className="stack">
          <div><b>{e.title}</b> <span className="small muted">by {e.organizerName}. The host wasn't told about this check.</span></div>
          <Signals list={e.signals} />
          {e.aiNote && <p className="small muted" style={{ margin: 0 }}>AI note (may be wrong): {e.aiNote}</p>}
          <div className="row"><button className="btn ghost small" onClick={() => act("event", e.id, "clear")}>Looks fine</button></div>
        </li>
      )} />
      <Section title="Members with answers to review" items={s.usersAnswered} emptyText="Nothing waiting." render={(u) => (
        <li key={u.id} className="stack">
          <b>{u.displayName}</b>
          <Signals list={u.signals} />
          <Answers list={u.answers} />
          <div className="row">
            <button className="btn small" onClick={() => act("user", u.id, "clear")}>Clear and restore requests</button>
            <button className="btn danger small" onClick={() => { const n = askNote("Tell the member why requests stay paused, in one respectful sentence:"); if (n !== null) act("user", u.id, "restrict", n); }}>Keep requests paused</button>
          </div>
        </li>
      )} />
      <Section title="Members waiting to answer" items={s.usersWaiting} emptyText="None." render={(u) => (
        <li key={u.id} className="stack">
          <b>{u.displayName}</b>
          <Signals list={u.signals} />
          <div className="row"><button className="btn ghost small" onClick={() => act("user", u.id, "clear")}>Clear without answers</button></div>
        </li>
      )} />
      <Section title="Members worth a quick look" items={s.usersWatch} emptyText="None." render={(u) => (
        <li key={u.id} className="stack">
          <div><b>{u.displayName}</b> <span className="small muted">They weren't told about this check.</span></div>
          <Signals list={u.signals} />
          <div className="row"><button className="btn ghost small" onClick={() => act("user", u.id, "clear")}>Looks fine</button></div>
        </li>
      )} />
      <Section title="Thoughts waiting for review" items={q.thoughts} emptyText="All clear." render={(t) => (
        <li key={t.id} className="stack">
          <p style={{ margin: 0 }}>{t.text}</p>
          <div className="row">
            {t.flags.map((f) => <span key={f} className="badge warm">{f}</span>)}
            {t.reportCount > 0 && <span className="badge plain">{t.reportCount} reports</span>}
            <span className="small muted">{timeAgo(t.createdAt)}</span>
          </div>
          {t.support && <div className="notice warm small">The writer may be struggling. The app already showed them crisis resources. Consider approving if it's safe; removing a cry for help can feel like rejection.</div>}
          <div className="row">
            <button className="btn small" onClick={() => act("thought", t.id, "approve")}>Publish</button>
            <button className="btn danger small" onClick={() => act("thought", t.id, "remove")}>Remove</button>
          </div>
        </li>
      )} />
      <Section title="Replies waiting for review" items={q.replies} emptyText="All clear." render={(r) => (
        <li key={r.id} className="stack">
          <p style={{ margin: 0 }}>{r.text}</p>
          <div className="row">{r.flags.map((f) => <span key={f} className="badge warm">{f}</span>)}</div>
          <div className="row">
            <button className="btn small" onClick={() => act("reply", r.id, "approve")}>Publish</button>
            <button className="btn danger small" onClick={() => act("reply", r.id, "remove")}>Remove</button>
          </div>
        </li>
      )} />
      <Section title="Reports" items={q.reports} emptyText="No open reports." render={(r) => (
        <li key={r.id} className="stack">
          <div><span className="badge plain">{r.kind}</span> <b>{r.reason}</b> <span className="small muted">{timeAgo(r.createdAt)}</span></div>
          <p style={{ margin: 0 }} className="muted">“{r.excerpt}”</p>
          <div className="row">
            <button className="btn danger small" onClick={() => act("report", r.id, "remove")}>Remove content</button>
            <button className="btn ghost small" onClick={() => act("report", r.id, "dismiss")}>Dismiss</button>
          </div>
        </li>
      )} />
      <Section title="Host applications" items={q.organizers} emptyText="No pending applications." render={(o) => (
        <li key={o.id} className="stack">
          <div><b>{o.orgName}</b> <span className="small muted">({o.orgType}), account {o.displayName}</span></div>
          <p style={{ margin: 0 }}>{o.about}</p>
          {o.website && <a href={o.website} target="_blank" rel="noreferrer">{o.website}</a>}
          <div className="row">
            <button className="btn small" onClick={() => act("organizer", o.id, "approve")}>Verify host</button>
            <button className="btn ghost small" onClick={() => act("organizer", o.id, "reject")}>Decline</button>
          </div>
        </li>
      )} />
    </div>
  );
}

export default function Page() {
  return (
    <div className="page narrow" translate="no">
      <h1>Review queue</h1>
      <Gate what="review content"><Queue /></Gate>
    </div>
  );
}
