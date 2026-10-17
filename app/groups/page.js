"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useAuth } from "../components/AuthProvider";
import Gate from "../components/Gate";

function GroupRow({ g, children }) {
  return (
    <li className="row spread">
      <div>
        <Link href={`/groups/${g.id}`} translate="no"><b>{g.name}</b></Link>{" "}
        <span className="small muted">{g.memberCount} member{g.memberCount === 1 ? "" : "s"}{g.visibility === "invite" ? ", invite-only" : ""}</span>
        {g.description && <div className="small" translate="no">{g.description}</div>}
        {g.reasons?.length > 0 && <div className="small muted">{g.reasons[0]}</div>}
        <div translate="no">{g.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>
      </div>
      <div className="row">{children}</div>
    </li>
  );
}

function Groups() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", tags: "", visibility: "open" });
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(() => api("/api/groups").then(setData).catch((e) => setErr(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function membership(id, action) {
    setErr("");
    try {
      await api(`/api/groups/${id}/membership`, { method: "POST", body: { action } });
      await load();
      refresh();
      if (action === "join") router.push(`/groups/${id}`);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function create(e) {
    e.preventDefault();
    setErr("");
    try {
      const r = await api("/api/groups", { method: "POST", body: form });
      router.push(`/groups/${r.id}`);
    } catch (e2) {
      setErr(e2.message);
    }
  }

  if (!data) return err ? <div className="alert">{err}</div> : <p className="muted">Loading…</p>;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="stack">
      {err && <div className="alert" role="alert">{err}</div>}
      {data.invites.length > 0 && (
        <section className="panel">
          <h2>Invitations</h2>
          <p className="small muted">Joining is always your choice.</p>
          <ul className="rows">
            {data.invites.map((g) => (
              <GroupRow key={g.id} g={g}>
                <button className="btn" onClick={() => membership(g.id, "join")}>Join</button>
                <button className="btn ghost" onClick={() => membership(g.id, "decline")}>No thanks</button>
              </GroupRow>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="row spread">
          <h2 style={{ margin: 0 }}>Your groups</h2>
          <button className="btn" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}>{showForm ? "Close" : "Start a group"}</button>
        </div>
        {showForm && (
          <form className="panel stack" style={{ marginTop: 12 }} onSubmit={create}>
            <div><label htmlFor="gname">Group name</label><input id="gname" type="text" value={form.name} onChange={set("name")} maxLength={80} required /></div>
            <div><label htmlFor="gdesc">What's it about?</label><textarea id="gdesc" value={form.description} onChange={set("description")} maxLength={500} /></div>
            <div><label htmlFor="gtags">Tags</label><input id="gtags" type="text" value={form.tags} onChange={set("tags")} placeholder="walking, new-in-town" /></div>
            <div>
              <label htmlFor="gvis">Who can join?</label>
              <select id="gvis" value={form.visibility} onChange={set("visibility")}>
                <option value="open">Anyone can find and join</option>
                <option value="invite">Only people members invite</option>
              </select>
            </div>
            <button className="btn">Create group</button>
          </form>
        )}
        {data.mine.length ? (
          <ul className="rows" style={{ marginTop: 12 }}>{data.mine.map((g) => <GroupRow key={g.id} g={g}><Link className="btn ghost" href={`/groups/${g.id}`}>Open</Link></GroupRow>)}</ul>
        ) : (
          <p className="muted">You haven't joined a group yet.</p>
        )}
      </section>

      {data.recommended.length > 0 && (
        <section>
          <h2>Suggested for you</h2>
          <ul className="rows">{data.recommended.map((g) => <GroupRow key={g.id} g={g}><button className="btn" onClick={() => membership(g.id, "join")}>Join</button></GroupRow>)}</ul>
        </section>
      )}

      <section>
        <h2>Open groups</h2>
        {data.discover.length ? (
          <ul className="rows">{data.discover.map((g) => <GroupRow key={g.id} g={g}><button className="btn ghost" onClick={() => membership(g.id, "join")}>Join</button></GroupRow>)}</ul>
        ) : (
          <p className="muted">No open groups yet. Start one.</p>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <div className="page narrow">
      <h1>Groups</h1>
      <Gate what="find and join groups"><Groups /></Gate>
    </div>
  );
}
