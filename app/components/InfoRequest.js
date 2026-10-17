"use client";
import { useState } from "react";

/** Shows a respectful request for more information and collects one answer per question. */
export default function InfoRequest({ intro, questions, onSubmit, submitLabel = "Send answers" }) {
  const [answers, setAnswers] = useState(questions.map(() => ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await onSubmit(answers);
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  }

  return (
    <form className="info-request stack" onSubmit={submit}>
      <p style={{ margin: 0 }}>{intro}</p>
      <ol className="stack" style={{ paddingLeft: 20, margin: 0 }}>
        {questions.map((q, i) => (
          <li key={q}>
            <label htmlFor={`q${i}`} style={{ fontWeight: 600 }}>{q}</label>
            <textarea id={`q${i}`} value={answers[i]} maxLength={1000} required onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
          </li>
        ))}
      </ol>
      {err && <div className="alert small" role="alert">{err}</div>}
      <div className="row">
        <button className="btn" disabled={busy}>{busy ? "Sending…" : submitLabel}</button>
        <span className="small muted">A person reads every answer. Questions? Reply in your answer and we'll get back to you.</span>
      </div>
    </form>
  );
}
