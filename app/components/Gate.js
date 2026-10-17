"use client";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

/** Renders children only for signed-in people; otherwise invites them to sign in. */
export default function Gate({ children, what = "use this page" }) {
  const { me, loading } = useAuth();
  if (loading) return <p className="muted">Loading…</p>;
  if (!me)
    return (
      <div className="empty">
        <p style={{ margin: "0 auto 12px" }}>Sign in to {what}.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link className="btn" href="/login">Sign in</Link>
          <Link className="btn ghost" href="/signup">Create an account</Link>
        </div>
      </div>
    );
  return children;
}
