"use client";
// Live speech-to-text with OpenAI's Realtime API over WebRTC.
// 1. Ask our server for a short-lived client secret (/api/voice/session).
// 2. Open a peer connection to OpenAI with the microphone track.
// 3. Read transcript events from the "oai-events" data channel and stream them into the text box.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { useAuth } from "./AuthProvider";

const MAX_SECONDS = 110; // the client secret lasts two minutes

export default function VoiceDictation({ getText, setText, maxLength = 500 }) {
  const { voiceEnabled } = useAuth();
  const [state, setState] = useState("idle"); // idle | connecting | listening | hearing
  const [err, setErr] = useState("");
  const [seconds, setSeconds] = useState(0);
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const baseRef = useRef("");
  const segRef = useRef([]); // [{ id, text }] in the order speech arrived

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (seconds >= MAX_SECONDS) stop();
  }, [seconds]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!voiceEnabled) return null;
  const supported = typeof window !== "undefined" && navigator.mediaDevices?.getUserMedia && window.RTCPeerConnection;
  if (!supported) return null;

  function render() {
    const spoken = segRef.current.map((s) => s.text.trim()).filter(Boolean).join(" ");
    const base = baseRef.current.trimEnd();
    setText(((base ? base + " " : "") + spoken).slice(0, maxLength));
  }

  function onEvent(e) {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    const segs = segRef.current;
    const find = (id) => segs.find((s) => s.id === id) || (segs.push({ id, text: "" }), segs[segs.length - 1]);
    switch (msg.type) {
      case "input_audio_buffer.speech_started":
        setState("hearing");
        break;
      case "input_audio_buffer.speech_stopped":
        setState("listening");
        break;
      case "conversation.item.input_audio_transcription.delta":
        find(msg.item_id).text += msg.delta || "";
        render();
        break;
      case "conversation.item.input_audio_transcription.completed":
        find(msg.item_id).text = msg.transcript || "";
        render();
        break;
      case "error":
        setErr(msg.error?.message || "Voice transcription hit an error.");
        stop();
        break;
      default:
    }
  }

  async function start() {
    setErr("");
    setState("connecting");
    baseRef.current = getText() || "";
    segRef.current = [];
    try {
      const { clientSecret } = await api("/api/voice/session", { method: "POST" });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const channel = pc.createDataChannel("oai-events");
      channel.addEventListener("message", onEvent);
      pc.addEventListener("connectionstatechange", () => {
        if (["failed", "closed"].includes(pc.connectionState)) stop();
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const res = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" },
      });
      if (!res.ok) {
        const body = await res.text();
        let detail = "";
        try {
          detail = JSON.parse(body)?.error?.message || "";
        } catch {}
        console.error("OpenAI realtime call failed", res.status, body);
        throw new Error(`Couldn't connect to the voice service (${res.status})${detail ? `: ${detail}` : ""}.`);
      }
      await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });

      setState("listening");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      const denied = e?.name === "NotAllowedError" || e?.name === "SecurityError";
      setErr(denied ? "Microphone access was blocked. Allow it in your browser's site settings, or type instead." : e.message || "Voice isn't available right now.");
      stop();
    }
  }

  function stop() {
    clearInterval(timerRef.current);
    timerRef.current = null;
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState("idle");
  }

  const active = state !== "idle";
  return (
    <div className="voice">
      <div className="row">
        <button
          type="button"
          className={`btn small ${active ? "on voice-on" : "ghost"}`}
          onClick={active ? stop : start}
          disabled={state === "connecting"}
          aria-pressed={active}
        >
          <span aria-hidden="true" className={`mic ${state === "hearing" ? "live" : ""}`} />
          {state === "connecting" ? "Connecting…" : active ? "Stop" : "Speak instead"}
        </button>
        <span className="small muted" role="status" aria-live="polite">
          {state === "listening" && `Listening… ${MAX_SECONDS - seconds}s left. Pause and your words appear.`}
          {state === "hearing" && "Hearing you…"}
          {state === "idle" && !err && "Your voice is turned into text you can edit before posting. Audio isn't saved."}
        </span>
      </div>
      {err && <div className="alert small" role="alert" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}
