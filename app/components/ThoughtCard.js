"use client";
import Link from "next/link";
import { useState } from "react";
import { timeAgo } from "@/lib/client";
import LikeButton from "./LikeButton";

export default function ThoughtCard({ t: initial, reason, onChange }) {
  const [t, setT] = useState(initial);
  if (t.id !== initial.id) setT(initial);
  return (
    <article className={`bubble ${t.isMine ? "mine" : ""}`}>
      <p className="bubble-text" translate="no">{t.text}</p>
      <div className="bubble-meta">
        <span translate={!t.isMine && t.author !== "Someone" ? "no" : undefined}>{t.isMine ? "You" : t.author}</span>
        <span>{timeAgo(t.createdAt)}</span>
        {t.areaName && <span>Around {t.areaName}</span>}
        {t.replyCount > 0 && <span>{t.replyCount} repl{t.replyCount === 1 ? "y" : "ies"}</span>}
        {t.isMine && t.status === "in_review" && <span className="badge warm">Waiting for review</span>}
      </div>
      {t.tags?.length > 0 && (
        <div style={{ marginTop: 6 }} translate="no">
          {t.tags.map((tag) => <span key={tag} className="tag">#{tag}</span>)}
        </div>
      )}
      {reason && <div className="small muted" style={{ marginTop: 6 }}>{reason}</div>}
      <Link className="cover" href={`/thoughts/${t.id}`} aria-label={`Open thought: ${t.text.slice(0, 60)}`} />
      {!t.isMine && t.status !== "in_review" && (
        <div className="like-row">
          <LikeButton thought={t} onChange={(nt) => { setT(nt); onChange?.(nt); }} />
        </div>
      )}
    </article>
  );
}
