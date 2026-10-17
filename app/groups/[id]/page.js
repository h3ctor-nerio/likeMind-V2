"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, formatWhen, timeAgo } from "@/lib/client";
import Gate from "../../components/Gate";
import ReportButton from "../../components/ReportButton";

function Group() {
  const { id } = useParams();
  const router = useRouter();
  const [g, setG] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [connections, setConnections] = useState([]);
  const [invitee, setInvitee] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api(`/api/groups/${id}`);
      setG(r.group);
      if (r.group.isMember) {
        const m = await api(`/api/groups/${id}/messages`);
        setMsgs(m.messages);
      }
    } catch (e) {
      setErr(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
    api("/api/connections").then((r) => setConnections(r.connected)).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!g?.isMember) return;
    const t = setInterval(() => api(`/api/groups/${id}/messages`).then((m) => setMsgs(m.messages)).catch(() => {}), 6000);
    return () => clearInterval(t);
  }, [g?.isMember, id]);

  async function membership(action, extra = {}) {
    setErr("");
    setMsg("");
    try {
      await api(`/api/groups/${id}/membership`, { method: "POST", body: { action, ...extra } });
      if (action === "leave") return router.push("/groups");
      if (action === "invite") setMsg("Invitation sent. They'll decide whether to join.");
      setInvitee("");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function post(e) {
    e.preventDefault();
    try {
      const r = await api(`/api/groups/${id}/messages`, { method: "POST", body: { text } });
      setMsgs([...msgs, r.message]);
      setText("");
    } catch (e2) {
      setErr(e2.message);
    }
  }

  if (!g) return err ? <div className="alert">{err}</div> : <p className="muted">Loading…</p>;

  return (
    <>
      <h1 translate="no">{g.name}</h1>
      {g.description && <p className="muted" translate="no">{g.description}</p>}
      <div style={{ marginBottom: 16 }} translate="no">{g.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>
      {err && <div className="alert" role="alert">{err}</div>}
      {msg && <div className="notice" role="status">{msg}</div>}

      {!g.isMember ? (
        <div className="panel row spread">
          <span>{g.memberCount} members. Join to see the conversation and the events the group is considering.</span>
          <button className="btn" onClick={() => membership("join")}>Join group</button>
        </div>
      ) : (
        <div className="side">
          <section className="panel">
            <h2>Conversation</h2>
            <div className="chat">
              {msgs.length === 0 && <p className="muted">No messages yet. Introduce yourself.</p>}
              {msgs.map((m) => (
                <div key={m.id} className={`msg ${m.mine ? "mine" : ""}`}>
                  <div className="who">{m.mine ? "You" : <span translate="no">{m.senderName}</span>}, {timeAgo(m.createdAt)}</div>
                  <div style={{ whiteSpace: "pre-wrap" }} translate="no">{m.text}</div>
                  {!m.mine && <ReportButton kind="message" id={m.id} />}
                </div>
              ))}
            </div>
            <form className="composer" onSubmit={post}>
              <textarea aria-label="Message the group" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
              <button className="btn" disabled={!text.trim()}>Send</button>
            </form>
          </section>
          <aside className="stack">
            <section className="panel">
              <h2>Events we're considering</h2>
              <p className="small muted">Everyone decides and registers on their own.</p>
              {g.events.length === 0 ? (
                <p className="muted">None yet. Open any event and choose “Suggest to a group”. <Link href="/events">Browse events</Link></p>
              ) : (
                <ul className="rows">
                  {g.events.map((e) => (
                    <li key={e.id}>
                      <Link href={`/events/${e.id}`} translate="no"><b>{e.title}</b></Link>
                      <div className="small muted">{formatWhen(e.startsAt)}, {e.mode}{e.free ? ", free" : ""}</div>
                      <div className="small">{e.goingFromGroup} from this group going{e.imGoing ? ", including you" : ""}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel">
              <h2>Members</h2>
              <ul className="rows">
                {g.members.map((m) => <li key={m.displayName}><span translate="no">{m.displayName}</span> {m.role === "host" && <span className="badge plain">Started the group</span>}</li>)}
              </ul>
              {connections.length > 0 && (
                <div className="stack" style={{ marginTop: 12 }}>
                  <label htmlFor="inv">Invite a connection</label>
                  <select id="inv" value={invitee} onChange={(e) => setInvitee(e.target.value)}>
                    <option value="">Choose someone</option>
                    {connections.map((c) => <option key={c.id} value={c.id} translate="no">{c.otherName}</option>)}
                  </select>
                  <button className="btn ghost" disabled={!invitee} onClick={() => membership("invite", { connectionId: invitee })}>Send invitation</button>
                </div>
              )}
              <button className="btn quiet small" style={{ marginTop: 12 }} onClick={() => confirm("Leave this group?") && membership("leave")}>Leave group</button>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <div className="page">
      <p><Link href="/groups">All groups</Link></p>
      <Gate what="see this group"><Group /></Gate>
    </div>
  );
}
