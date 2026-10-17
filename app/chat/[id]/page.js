"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, timeAgo } from "@/lib/client";
import { useAuth } from "../../components/AuthProvider";
import Gate from "../../components/Gate";
import ReportButton from "../../components/ReportButton";
import Translate from "../../components/Translate";

function Chat() {
  const { id } = useParams();
  const { me } = useAuth();
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api(`/api/chats/${id}`)
        .then((d) => alive && setData(d))
        .catch((e) => alive && setErr(e.message));
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [data?.messages?.length]);

  async function send(e) {
    e.preventDefault();
    setErr("");
    try {
      const r = await api(`/api/chats/${id}`, { method: "POST", body: { text } });
      setData((d) => ({ ...d, messages: [...d.messages, r.message] }));
      setText("");
      setNote(r.note || "");
    } catch (e2) {
      setErr(e2.message);
    }
  }

  if (err && !data) return <div className="alert">{err} <Link href="/connections">Back to connections</Link></div>;
  if (!data) return <p className="muted">Loading…</p>;
  const o = data.other;

  return (
    <div className="side">
      <div className="panel">
        <div className="chat" aria-live="polite">
          {data.messages.length === 0 && <p className="muted">You're connected. Say hello. Maybe start with what you both relate to.</p>}
          {data.messages.map((m) => (
            <div key={m.id} className={`msg ${m.mine ? "mine" : ""}`}>
              <div className="who">{m.mine ? "You" : <span translate="no">{m.senderName}</span>}, {timeAgo(m.createdAt)}</div>
              <div style={{ whiteSpace: "pre-wrap" }} translate="no">{m.text}</div>
              {!m.mine && (
                <div className="row">
                  <Translate text={m.text} />
                  <ReportButton kind="message" id={m.id} />
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form className="composer" onSubmit={send}>
          <textarea aria-label={`Message ${o.displayName}`} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={`Message as ${me.displayName}`}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) send(e); } }} />
          <button className="btn" disabled={!text.trim()}>Send</button>
        </form>
        {err && <div className="alert" role="alert" style={{ marginTop: 8 }}>{err}</div>}
        {note && <div className="notice warm small" style={{ marginTop: 8 }}>{note}</div>}
      </div>
      <aside className="panel stack">
        <h2 translate="no">{o.displayName}</h2>
        {o.intro && <p translate="no">{o.intro}</p>}
        {data.shared.length > 0 && (
          <div>
            <b>You both listed</b>
            <div translate="no">{data.shared.map((s) => <span key={s} className="tag">{s}</span>)}</div>
          </div>
        )}
        {o.interests?.length > 0 && <div><b>Interests</b><div translate="no">{o.interests.map((s) => <span key={s} className="tag">{s}</span>)}</div></div>}
        {o.skills?.length > 0 && <div><b>Skills</b><div translate="no">{o.skills.map((s) => <span key={s} className="tag">{s}</span>)}</div></div>}
        <p className="small muted">Only display names are shown. Take your time before sharing personal details, and meet first at public events.</p>
        <Link className="btn ghost" href="/groups">Start a group together</Link>
      </aside>
    </div>
  );
}

export default function Page() {
  return (
    <div className="page">
      <p><Link href="/connections">Back to connections</Link></p>
      <Gate what="open this chat"><Chat /></Gate>
    </div>
  );
}
