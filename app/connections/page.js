"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "@/lib/client";
import { useAuth } from "../components/AuthProvider";
import Gate from "../components/Gate";

function Connections() {
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => api("/api/connections").then(setData).catch((e) => setErr(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(id, action) {
    if (action === "remove" && !confirm("End this connection? Your chat will close for both of you.")) return;
    try {
      await api(`/api/connections/${id}`, { method: "PATCH", body: { action } });
      await load();
      refresh();
    } catch (e) {
      setErr(e.message);
    }
  }

  if (err) return <div className="alert">{err}</div>;
  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div className="stack">
      <section>
        <h2>Requests for you</h2>
        {data.incoming.length === 0 ? (
          <p className="muted">No requests right now.</p>
        ) : (
          <ul className="rows">
            {data.incoming.map((c) => (
              <li key={c.id}>
                <div className="row spread">
                  <div>
                    <b translate="no">{c.otherName}</b> wants to connect <span className="small muted">{timeAgo(c.createdAt)}</span>
                    <div className="small muted" translate="no">{c.context}</div>
                    {c.note && <p style={{ margin: "6px 0 0" }} translate="no">“{c.note}”</p>}
                  </div>
                  <div className="row">
                    <button className="btn" onClick={() => act(c.id, "accept")}>Accept</button>
                    <button className="btn ghost" onClick={() => act(c.id, "decline")}>Decline</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="small muted">Declining is private. The other person just sees that you're not available.</p>
      </section>

      <section>
        <h2>Your connections</h2>
        {data.connected.length === 0 ? (
          <div className="empty">
            No connections yet. When a thought resonates, ask to connect from its page. <Link href="/explore">Explore thoughts</Link>
          </div>
        ) : (
          <ul className="rows">
            {data.connected.map((c) => (
              <li key={c.id} className="row spread">
                <div>
                  <b translate="no">{c.otherName}</b>
                  <div className="small muted">{c.lastMessageAt ? `Last message ${timeAgo(c.lastMessageAt)}` : "No messages yet"}</div>
                </div>
                <div className="row">
                  <Link className="btn" href={`/chat/${c.id}`}>Open chat</Link>
                  <button className="btn quiet small" onClick={() => act(c.id, "remove")}>End connection</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.outgoing.length > 0 && (
        <section>
          <h2>Waiting for a reply</h2>
          <ul className="rows">
            {data.outgoing.map((c) => (
              <li key={c.id} className="row spread">
                <span><b translate="no">{c.otherName}</b> <span className="small muted">sent {timeAgo(c.createdAt)}</span></span>
                <button className="btn quiet small" onClick={() => act(c.id, "cancel")}>Withdraw</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <div className="page narrow">
      <h1>Connections</h1>
      <Gate what="see your connections"><Connections /></Gate>
    </div>
  );
}
