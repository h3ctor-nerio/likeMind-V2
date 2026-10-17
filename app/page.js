import Link from "next/link";

const SAMPLE = [
  { text: "Moved here three months ago and still eat lunch alone most days.", style: { top: 0, left: "6%" } },
  { text: "Would anyone want to start a Spanish–English conversation swap?", style: { top: 92, right: 0 } },
  { text: "I fix bikes for fun. Happy to teach.", style: { top: 196, left: 0 } },
  { text: "Caring for my mom is a lot. Does it get easier?", style: { top: 270, right: "8%" } },
];

export default function Home() {
  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>Say what you feel. Find who feels it too.</h1>
          <p className="hero-lede">
            Drop an anonymous thought on the map. Read what people near you and far away are carrying. When something
            clicks, you can both choose to talk, form a group, and meet up at an event that fits your life.
          </p>
          <div className="row">
            <Link href="/explore" className="btn">Explore the map</Link>
            <Link href="/signup" className="btn ghost">Create an account</Link>
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>No account needed to look around.</p>
          <p className="credit">Team 10 prototype for 2026 UAlbany AI in Society Inaugural Competition</p>
        </div>
        <div className="sky" aria-label="Example thoughts">
          {SAMPLE.map((s) => (
            <div key={s.text} className="bubble" style={s.style}>
              <p className="bubble-text" style={{ margin: 0 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="path" aria-label="How it works">
        <ol style={{ display: "contents" }}>
          <li>
            <span className="path-step">Share</span>
            <p className="muted">Post a thought under a random display name. Its location is blurred to your town or region.</p>
          </li>
          <li>
            <span className="path-step">Discover</span>
            <p className="muted">Browse bubbles on the map or as a list, and see thoughts similar to the ones you relate to.</p>
          </li>
          <li>
            <span className="path-step">Connect</span>
            <p className="muted">Ask to connect. A private chat opens only when both of you say yes.</p>
          </li>
          <li>
            <span className="path-step">Meet</span>
            <p className="muted">Join groups and events from verified hosts, with cost, language, transit, and access spelled out.</p>
          </li>
        </ol>
      </section>
    </div>
  );
}
