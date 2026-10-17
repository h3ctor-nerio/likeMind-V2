"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { useAuth } from "./AuthProvider";

export default function Translate({ text }) {
  const { me, aiEnabled } = useAuth();
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!me || !aiEnabled) return null;
  const target = me.prefs?.languages?.[0] || "English";

  async function go() {
    setBusy(true);
    setErr("");
    try {
      const r = await api("/api/translate", { method: "POST", body: { text, target } });
      setOut(r.translation);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (out)
    return (
      <div className="small" style={{ marginTop: 6 }}>
        <span className="muted">Translated to {target} by AI:</span> {out}
      </div>
    );
  return (
    <>
      <button className="btn quiet small" onClick={go} disabled={busy}>{busy ? "Translating…" : `Translate to ${target}`}</button>
      {err && <span className="small" style={{ color: "var(--danger)" }}>{err}</span>}
    </>
  );
}
