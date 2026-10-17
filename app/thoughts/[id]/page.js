"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, timeAgo } from "@/lib/client";
import { useAuth } from "../../components/AuthProvider";
import ThoughtCard from "../../components/ThoughtCard";
import ReportButton from "../../components/ReportButton";
import Translate from "../../components/Translate";
import LikeButton from "../../components/LikeButton";
import Map from "../../components/Map";

const REACTIONS = [
  { kind: "relate", label: "I relate" },
  { kind: "support", label: "Sending support" },
  { kind: "insight", label: "Good point" },
];

export default function ThoughtPage() {
  const { id } = useParams();
  const router = useRouter();
  const { me } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [reply, setReply] = useState("");
  const [replyNote, setReplyNote] = useState("");
  const [connectNote, setConnectNote] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionErr, setActionErr] = useState("");

  useEffect(() => {
    api(`/api/thoughts/${id}`).then(setData).catch((e) => setErr(e.message));
  }, [id, me?.id]);

  if (err) return <div className="page narrow"><div className="alert">{err}</div><p><Link href="/explore">Back to the map</Link></p></div>;
  if (!data) return <div className="page narrow"><p className="muted">Loading…</p></div>;
  const { thought: t, replies, similar, connection, prompt } = data;

  async function react(kind) {
    if (!me) return router.push("/login");
    const r = await api(`/api/thoughts/${id}/react`, { method: "POST", body: { kind } });
    setData({ ...data, thought: r.thought });
  }
  async function save() {
    if (!me) return router.push("/login");
    const r = await api(`/api/thoughts/${id}/save`, { method: "POST" });
    setData({ ...data, thought: { ...t, saved: r.saved } });
  }
  async function sendReply(e) {
    e.preventDefault();
    setActionErr("");
    try {
      const r = await api(`/api/thoughts/${id}/replies`, { method: "POST", body: { text: reply } });
      setData({ ...data, replies: [...replies, r.reply] });
      setReply("");
      setReplyNote(r.note || "");
    } catch (e2) {
      setActionErr(e2.message);
    }
  }
  async function connect(body) {
    setActionErr("");
    try {
      await api("/api/connections", { method: "POST", body });
      setActionMsg("Request sent. If they accept, a private chat opens in Connections.");
      setConnectOpen(false);
      if (body.thoughtId) setData({ ...data, connection: { status: "pending", outgoing: true } });
    } catch (e2) {
      setActionErr(e2.message);
    }
  }
  async function remove() {
    if (!confirm("Delete this thought? This can't be undone.")) return;
    await api(`/api/thoughts/${id}`, { method: "DELETE" });
    router.push("/profile");
  }

  return (
    <div className="page">
      <p><Link href="/explore">Back to explore</Link></p>
      <div className="side">
        <div className="stack">
          {prompt && <div className="notice warm small">In answer to <span translate="no">{prompt.orgName}</span>'s question: <span translate="no">“{prompt.question}”</span></div>}
          <article className={`bubble ${t.isMine ? "mine" : ""}`} style={{ padding: "26px 28px" }}>
            <p className="bubble-text" translate="no" style={{ fontSize: "1.35rem", fontFamily: "var(--font-display)", fontWeight: 500 }}>{t.text}</p>
            <div className="bubble-meta">
              <span translate={!t.isMine && t.author !== "Someone" ? "no" : undefined}>{t.isMine ? "You" : t.author}</span>
              <span>{timeAgo(t.createdAt)}</span>
              <span>{t.lat == null ? "Not on the map" : t.areaName ? `Around ${t.areaName}` : "Approximate location"}</span>
              {t.audience === "adults" && <span className="badge plain">Adults only</span>}
            </div>
            {t.tags.length > 0 && (
              <div style={{ marginTop: 8 }} translate="no">
                {t.tags.map((tag) => <Link key={tag} href={`/explore?tag=${tag}`} className="tag">#{tag}</Link>)}
              </div>
            )}
            {!t.isMine && <div style={{ marginTop: 8 }}><Translate text={t.text} /></div>}
          </article>

          {t.isMine && t.status === "in_review" && <div className="notice warm">{t.reviewNote}</div>}

          {!t.isMine && <LikeButton thought={t} small={false} onChange={(nt) => setData({ ...data, thought: nt })} />}

          <div className="row spread">
            <div className="reactions" role="group" aria-label="Reactions">
              {REACTIONS.map((r) => (
                <button key={r.kind} className={`btn small ${t.myReactions.includes(r.kind) ? "on" : "ghost"}`} aria-pressed={t.myReactions.includes(r.kind)} onClick={() => react(r.kind)}
                  title={t.myReactions.includes(r.kind) ? "Click again to remove your reaction" : undefined}>
                  {t.myReactions.includes(r.kind) ? "✓ " : ""}{r.label} {t.reactions[r.kind] > 0 ? t.reactions[r.kind] : ""}
                </button>
              ))}
            </div>
            <div className="row">
              <button className="btn quiet small" onClick={save}>{t.saved ? "Saved" : "Save"}</button>
              {t.isMine ? <button className="btn danger small" onClick={remove}>Delete</button> : me && <ReportButton kind="thought" id={t.id} />}
            </div>
          </div>

          {!t.isMine && t.allowConnections && me && (
            <div className="panel">
              {connection?.status === "accepted" ? (
                <p style={{ margin: 0 }}>You're connected with the writer. <Link href={`/chat/${connection.id}`}>Open your chat</Link>.</p>
              ) : connection?.status === "pending" ? (
                <p style={{ margin: 0 }} className="muted">{connection.outgoing ? "Your connection request is waiting for a reply." : "This person asked to connect with you. Respond in Connections."}</p>
              ) : actionMsg ? (
                <p style={{ margin: 0 }} role="status">{actionMsg}</p>
              ) : connectOpen ? (
                <div className="stack">
                  <label htmlFor="cnote">Add a short note <span className="hint">Optional. Say what resonated. Skip contact details; you can share those once you're connected.</span></label>
                  <input id="cnote" type="text" maxLength={200} value={connectNote} onChange={(e) => setConnectNote(e.target.value)} />
                  <div className="row">
                    <button className="btn" onClick={() => connect({ thoughtId: t.id, note: connectNote })}>Send request</button>
                    <button className="btn quiet" onClick={() => setConnectOpen(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="row spread">
                  <span>The writer is open to connecting.</span>
                  <button className="btn" onClick={() => setConnectOpen(true)}>Ask to connect</button>
                </div>
              )}
            </div>
          )}
          {actionErr && <div className="alert" role="alert">{actionErr}</div>}

          <section>
            <h2>Replies</h2>
            {replies.length === 0 && <p className="muted">{t.allowReplies ? "No replies yet." : "The writer turned off replies."}</p>}
            <ul className="rows">
              {replies.map((r) => (
                <li key={r.id}>
                  <div className="row spread">
                    <b translate={r.isMine ? undefined : "no"}>{r.isMine ? "You" : r.author}</b>
                    <span className="small muted">{timeAgo(r.createdAt)}</span>
                  </div>
                  <p style={{ margin: "4px 0" }} translate="no">{r.text}</p>
                  {r.status === "in_review" && <span className="badge warm">Waiting for review</span>}
                  <div className="row">
                    {!r.isMine && <Translate text={r.text} />}
                    {t.isMine && !r.isMine && <button className="btn quiet small" onClick={() => connect({ replyId: r.id })}>Ask to connect</button>}
                    {!r.isMine && me && <ReportButton kind="reply" id={r.id} />}
                  </div>
                </li>
              ))}
            </ul>
            {t.allowReplies && me && (
              <form onSubmit={sendReply} className="stack" style={{ marginTop: 12 }}>
                <label htmlFor="reply">Reply as {me.displayName}</label>
                <textarea id="reply" value={reply} maxLength={400} onChange={(e) => setReply(e.target.value)} placeholder="Be kind. Share what you relate to." />
                {replyNote && <div className="notice warm small">{replyNote}</div>}
                <button className="btn" disabled={reply.trim().length < 2}>Post reply</button>
              </form>
            )}
            {!me && t.allowReplies && <p className="muted"><Link href="/login">Sign in</Link> to reply.</p>}
          </section>
        </div>

        <aside className="stack">
          {t.lat != null && (
            <>
              <Map short label="Where this thought was shared" items={[{ id: t.id, lat: t.lat, lng: t.lng, label: t.areaName || "Shared here", kind: "thought" }]} />
              <p className="small muted" style={{ margin: 0 }}>Approximate. The pin never marks an exact address.</p>
            </>
          )}
          <h2>Similar thoughts</h2>
          <p className="small muted">Matched by shared tags and words. Nothing about you is used here.</p>
          {similar.length ? similar.map((s) => <ThoughtCard key={s.id} t={s} reason={s.reason} />) : <div className="empty">No close matches yet.</div>}
        </aside>
      </div>
    </div>
  );
}
