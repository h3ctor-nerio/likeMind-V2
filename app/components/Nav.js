"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { api } from "@/lib/client";

export default function Nav() {
  const { me, loading, error, refresh } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const link = (href, label, extra, keep) => (
    <Link href={href} translate={keep ? "no" : undefined} aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined}>
      {label}
      {extra ? <span className="count">{extra}</span> : null}
    </Link>
  );

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    await refresh();
    router.push("/");
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="LikeMinds home" translate="no">
          <span className="brand-mark" aria-hidden="true" />
          LikeMinds
        </Link>
        <button className="btn ghost small menu-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
          Menu
        </button>
        <nav className={`nav-links ${open ? "open" : ""}`} aria-label="Main">
          {link("/explore", "Explore")}
          {link("/events", "Events")}
          {me && link("/groups", "Groups", me.groupInvites || null)}
          {me && link("/connections", "Connections", me.pendingRequests || null)}
          {me?.isOrganizer && link("/insights", "Insights")}
          {me?.isAdmin && link("/admin", "Review")}
          {me && link("/profile", me.displayName, null, true)}
          {!loading && !me && link("/login", "Sign in")}
          {!loading && !me && (
            <Link href="/signup" className="btn small" style={{ color: "var(--violet-ink)" }}>
              Join
            </Link>
          )}
          {me && (
            <button className="btn quiet small" onClick={signOut}>
              Sign out
            </button>
          )}
        </nav>
      </div>
      {me?.trustStatus === "needs_info" && (
        <div className="trust-banner" role="status">
          We need a little more information from you before you can send new connection requests. <Link href="/account-check">Answer a few questions</Link>
        </div>
      )}
      {error && (
        <div className="alert" role="alert" style={{ borderRadius: 0, textAlign: "center" }}>
          {error}
        </div>
      )}
    </header>
  );
}
