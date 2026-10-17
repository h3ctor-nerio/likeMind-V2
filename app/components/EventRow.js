import Link from "next/link";
import { formatWhen } from "@/lib/client";

export function eventFacts(e) {
  const facts = [];
  facts.push(e.mode === "online" ? "Online" : e.mode === "hybrid" ? "In person or online" : "In person");
  if (e.timing === "self-paced") facts.push("Self-paced");
  facts.push(e.cost?.free ? "Free" : `$${e.cost.amount}${e.cost.notes ? ` (${e.cost.notes})` : ""}`);
  if (e.languages?.length) facts.push(e.languages.map((l) => l[0].toUpperCase() + l.slice(1)).join(", "));
  if (e.accessibility?.wheelchair) facts.push("Step-free access");
  if (e.accessibility?.asl) facts.push("ASL");
  if (e.accessibility?.captions) facts.push("Captions");
  if (e.accessibility?.quietSpace) facts.push("Quiet space");
  if (e.transport?.transit) facts.push("Near transit");
  if (e.transport?.parking) facts.push("Parking");
  if (e.ageRange === "teens") facts.push("Teens");
  if (e.ageRange === "18+") facts.push("18+");
  return facts;
}

export default function EventRow({ e }) {
  const d = new Date(e.startsAt);
  return (
    <li className="event-row">
      <div className="datebox" aria-hidden="true">
        <span>{d.toLocaleDateString(undefined, { month: "short" })}</span>
        <b>{d.getDate()}</b>
      </div>
      <div>
        <h3 style={{ margin: 0 }} translate="no"><Link href={`/events/${e.id}`}>{e.title}</Link></h3>
        <div className="small">
          {formatWhen(e.startsAt, e.endsAt)}{e.locationName && <span translate="no">, {e.locationName}</span>}
        </div>
        <div className="small muted">
          Hosted by <span translate="no">{e.organizerName}</span> {e.verified && <span className="badge">Verified host</span>}
        </div>
        <div className="facts">{eventFacts(e).map((f) => <span key={f}>{f}</span>)}</div>
        {e.reasons?.length > 0 && <div className="small" style={{ marginTop: 4 }}>Why this: {e.reasons.join(". ")}.</div>}
        {e.registration && <span className="badge" style={{ marginTop: 6 }}>You're registered</span>}
      </div>
    </li>
  );
}
