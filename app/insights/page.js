"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, formatWhen } from "@/lib/client";
import { useAuth } from "../components/AuthProvider";
import Gate from "../components/Gate";

function Insights() {
  const { me, aiEnabled } = useAuth();
  const [data, setData] = useState(null);
  const [question, setQuestion] = useState("");
  const [summaries, setSummaries] = useState({});
  const [err, setErr] = useState("");

  const load = useCallback(() => api("/api/insights").then(setData).catch((e) => setErr(e.message)), []);
  useEffect(() => {
    if (me.isOrganizer) load();
  }, [load, me.isOrganizer]);

  if (!me.isOrganizer) return <div className="empty">Insights are for verified hosts. <Link href="/events/new">Apply to host</Link>.</div>;
  if (err) return <div className="alert">{err}</div>;
  if (!data) return <p className="muted">Loading…</p>;

  async function ask(e) {
    e.preventDefault();
    try {
      await api("/api/prompts", { method: "POST", body: { question } });
      setQuestion("");
      load();
    } catch (x) {
      setErr(x.message);
    }
  }
  async function close(id) {
    await api("/api/prompts", { method: "POST", body: { closeId: id } });
    load();
  }
  async function summarize(id) {
    setSummaries({ ...summaries, [id]: { busy: true } });
    try {
      const r = await api("/api/insights/summary", { method: "POST", body: { promptId: id } });
      setSummaries((s) => ({ ...s, [id]: { text: r.summary } }));
    } catch (x) {
      setSummaries((s) => ({ ...s, [id]: { error: x.message } }));
    }
  }
  const max = Math.max(1, ...data.topTags.map((t) => t.count));

  return (
    <div className="stack">
      <div className="notice small">
        Everything here is aggregated. Themes appear only when at least {data.minGroup} different posts share them, and you never see who wrote what.
      </div>

      <section className="panel">
        <h2>What people are talking about</h2>
        <p className="muted">{data.totalThoughts} thoughts shared in the last 30 days.</p>
        {data.topTags.length === 0 ? (
          <p className="muted">Not enough activity yet to show themes.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Theme</th><th>Posts</th><th style={{ width: "45%" }}></th><th>“I relate”</th></tr></thead>
              <tbody>
                {data.topTags.map((t) => (
                  <tr key={t.tag}>
                    <td translate="no">#{t.tag}</td>
                    <td>{t.count}</td>
                    <td><div className="bar" style={{ width: `${(t.count / max) * 100}%` }} /></td>
                    <td>{t.relate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel stack">
        <h2>Ask the community</h2>
        <p className="muted">Post an open question. People answer anonymously on the map, and you see the themes. Useful for planning events or local policy.</p>
        <form className="row" onSubmit={ask} style={{ flexWrap: "nowrap" }}>
          <input type="text" aria-label="Question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What would make the town park feel more welcoming?" maxLength={200} />
          <button className="btn" disabled={question.length < 10}>Post question</button>
        </form>
        {data.prompts.length > 0 && (
          <ul className="rows">
            {data.prompts.map((p) => (
              <li key={p.id} className="stack">
                <div className="row spread">
                  <b translate="no">“{p.question}”</b>
                  <span className="row">
                    <span className="small muted">{p.responses} answers{p.active ? "" : ", closed"}</span>
                    {p.active && <button className="btn quiet small" onClick={() => close(p.id)}>Close</button>}
                  </span>
                </div>
                {p.topTags.length > 0 && <div>{p.topTags.map((t) => <span key={t.tag} className="tag">#{t.tag} ({t.count})</span>)}</div>}
                {aiEnabled && (
                  <div>
                    {summaries[p.id]?.text ? (
                      <div className="notice" style={{ whiteSpace: "pre-wrap" }}><b>AI summary of themes</b> (check against the answers before acting on it){"\n"}{summaries[p.id].text}</div>
                    ) : summaries[p.id]?.error ? (
                      <div className="alert small">{summaries[p.id].error}</div>
                    ) : (
                      <button className="btn ghost small" disabled={summaries[p.id]?.busy} onClick={() => summarize(p.id)}>{summaries[p.id]?.busy ? "Summarizing…" : "Summarize themes with AI"}</button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Your events</h2>
        {data.events.length === 0 ? (
          <p className="muted">No events yet. <Link href="/events/new">Host one</Link>.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Event</th><th>When</th><th>Registered</th><th>Checked in</th><th>Rating</th><th>Access requests</th></tr></thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.id}>
                    <td><Link href={`/events/${e.id}`} translate="no">{e.title}</Link>{e.status === "cancelled" && " (cancelled)"}</td>
                    <td>{formatWhen(e.startsAt)}</td>
                    <td>{e.registered}</td>
                    <td>{e.checkedIn}</td>
                    <td>{e.rating ?? "–"}</td>
                    <td>{e.accessRequests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <div className="page">
      <h1>Community insights</h1>
      <Gate what="see community insights"><Insights /></Gate>
    </div>
  );
}
