"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useAuth } from "../components/AuthProvider";
import { ProfileSection, PrefsSection } from "../components/ProfileFields";

export default function Signup() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [account, setAccount] = useState({ email: "", fullName: "", password: "", age: "" });
  const [displayName, setDisplayName] = useState("");
  const [profile, setProfile] = useState({});
  const [prefs, setPrefs] = useState({ participation: "either", languages: ["english"], access: {} });
  const [discoverable, setDiscoverable] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function shuffle() {
    const r = await api("/api/profile/name");
    setDisplayName(r.name);
  }
  useEffect(() => {
    shuffle();
  }, []);

  function next(e) {
    e.preventDefault();
    setErr("");
    if (step === 0) {
      const age = Number(account.age);
      if (!Number.isInteger(age) || age < 13) return setErr("You need to be 13 or older to join LikeMinds.");
      if (account.password.length < 8) return setErr("Use a password with at least 8 characters.");
    }
    setStep(step + 1);
  }

  async function finish(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth/signup", { method: "POST", body: { ...account, age: Number(account.age), displayName, profile, prefs, discoverable } });
      await refresh();
      router.push("/explore");
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
      if (Number.isInteger(e2.data?.step)) setStep(e2.data.step);
      else if (/email|password|13/.test(e2.message)) setStep(0);
    }
  }

  const titles = ["Create your account", "Your profile", "Your preferences"];
  const setA = (k) => (e) => setAccount({ ...account, [k]: e.target.value });

  return (
    <div className="page narrow">
      <div className="steps" aria-hidden="true">
        {titles.map((t, i) => <span key={t} className={i <= step ? "done" : ""} />)}
      </div>
      <p className="small muted">Step {step + 1} of 3</p>
      <h1>{titles[step]}</h1>
      <form className="panel stack" onSubmit={step === 2 ? finish : next}>
        {step === 0 && (
          <>
            <div>
              <label htmlFor="email">Email <span className="hint">Private. Used to sign in.</span></label>
              <input id="email" type="email" autoComplete="email" value={account.email} onChange={setA("email")} required />
            </div>
            <div>
              <label htmlFor="fullName">Full name <span className="hint">Private. Kept for account safety and never shown to others.</span></label>
              <input id="fullName" type="text" autoComplete="name" value={account.fullName} onChange={setA("fullName")} required />
            </div>
            <div className="grid2">
              <div>
                <label htmlFor="password">Password <span className="hint">At least 8 characters</span></label>
                <input id="password" type="password" autoComplete="new-password" value={account.password} onChange={setA("password")} required />
              </div>
              <div>
                <label htmlFor="age">Age <span className="hint">Teens get a teen-safe space</span></label>
                <input id="age" type="number" min="13" max="120" value={account.age} onChange={setA("age")} required />
              </div>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div>
              <label htmlFor="dn">Display name <span className="hint">This is the only name others see. We picked a random one; change it if you like.</span></label>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input id="dn" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} required />
                <button type="button" className="btn ghost" onClick={shuffle}>Shuffle</button>
              </div>
            </div>
            <ProfileSection value={profile} onChange={setProfile} />
          </>
        )}
        {step === 2 && (
          <>
            <PrefsSection value={prefs} onChange={setPrefs} />
            <label className="check">
              <input type="checkbox" checked={discoverable} onChange={(e) => setDiscoverable(e.target.checked)} />
              Let Mind suggest me to people with similar interests
              <span className="hint">They'd see your display name, shared interests, and your 2 most recent thoughts. Off unless you turn it on.</span>
            </label>
          </>
        )}

        {err && <div className="alert" role="alert">{err}</div>}
        <div className="row spread">
          {step > 0 ? <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>Back</button> : <span />}
          <div className="row">
            {step > 0 && step < 2 && <button type="button" className="btn quiet" onClick={() => setStep(step + 1)}>Skip</button>}
            <button className="btn" disabled={busy}>{step === 2 ? (busy ? "Creating account…" : "Create account") : "Continue"}</button>
          </div>
        </div>
        {step === 0 && <p className="small muted">Already have an account? <Link href="/login">Sign in</Link>.</p>}
        {step === 2 && <p className="small muted">Your profile starts private. You can make it visible later from your profile page.</p>}
      </form>
    </div>
  );
}
