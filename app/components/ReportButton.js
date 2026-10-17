"use client";
import { useState } from "react";
import { api } from "@/lib/client";

export default function ReportButton({ kind, id, label = "Report" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function send() {
    setErr("");
    try {
      const r = await api("/api/reports", { method: "POST", body: { kind, id, reason } });
      setMsg(r.note);
      setOpen(false);
    } catch (e) {
      setErr(e.message);
    }
  }

  if (msg) return <span className="small muted" role="status">{msg}</span>;
  if (!open) return <button className="btn quiet small" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <label>
        What's wrong?
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Choose a reason</option>
          <option>Harassment or bullying</option>
          <option>Hate or discrimination</option>
          <option>Someone may be in danger</option>
          <option>Sexual or inappropriate content</option>
          <option>Spam or scam</option>
          <option>Shares private information</option>
          <option>Something else</option>
        </select>
      </label>
      {err && <div className="alert">{err}</div>}
      <div className="row">
        <button className="btn danger small" onClick={send} disabled={!reason}>Send report</button>
        <button className="btn quiet small" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
