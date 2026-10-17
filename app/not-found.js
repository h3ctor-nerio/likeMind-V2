import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page narrow">
      <h1>This page doesn't exist</h1>
      <p>The link may be old or mistyped.</p>
      <Link className="btn" href="/explore">Go to the map</Link>
    </div>
  );
}
