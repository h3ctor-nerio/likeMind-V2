"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { useAuth } from "./AuthProvider";

/** Like / Unlike toggle. Calls onChange with the updated thought. */
export default function LikeButton({ thought, onChange, small = true }) {
  const { me } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const liked = thought.myReactions?.includes("like");
  const count = thought.reactions?.like || 0;

  async function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!me) return router.push("/login");
    setBusy(true);
    try {
      const r = await api(`/api/thoughts/${thought.id}/react`, { method: "POST", body: { kind: "like" } });
      onChange?.(r.thought);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="row" style={{ gap: 8 }}>
      <button
        type="button"
        className={`btn like-btn ${small ? "small" : ""} ${liked ? "on" : "ghost"}`}
        aria-pressed={liked}
        onClick={toggle}
        disabled={busy}
      >
        <span aria-hidden="true">{liked ? "♥" : "♡"}</span> {liked ? "Unlike" : "Like"}
      </button>
      <span className="small muted">{count} {count === 1 ? "like" : "likes"}</span>
    </span>
  );
}
