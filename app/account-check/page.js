"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useAuth } from "../components/AuthProvider";
import Gate from "../components/Gate";
import InfoRequest from "../components/InfoRequest";

function Check() {
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api("/api/trust").then(setData).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  if (err) return <div className="alert">{err}</div>;
  if (!data) return <p className="muted">Loading…</p>;
  if (data.status === "clear") return <div className="notice">Your account is in good standing. There's nothing you need to do.</div>;
  if (data.status === "info_submitted")
    return <div className="notice">Thanks for your answers. A person on our team will review them, usually within a day. Until then you can keep browsing, posting, and chatting with your connections.</div>;
  if (data.status === "restricted")
    return <div className="notice warm">After review, new connection requests and invitations stay paused on your account. {data.note} You can still browse, post, and chat with your existing connections. If you think this is a mistake, contact the LikeMinds team and a different moderator will take another look.</div>;

  return (
    <div className="panel">
      <InfoRequest
        intro={data.intro}
        questions={data.questions}
        onSubmit={async (answers) => {
          await api("/api/trust", { method: "POST", body: { answers } });
          await load();
          refresh();
        }}
      />
    </div>
  );
}

export default function Page() {
  return (
    <div className="page narrow">
      <h1>Account check</h1>
      <Gate what="see your account check"><Check /></Gate>
    </div>
  );
}
