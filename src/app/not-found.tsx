import Link from "next/link";

export default function NotFound() {
  return <main className="missing-page">
    <Link className="brand" href="/" aria-label="WaitRelay home"><span className="brand-mark" aria-hidden="true"><i /></span>WaitRelay</Link>
    <section className="terminal-message" aria-labelledby="missing-title">
      <span className="eyebrow">404 · Off the flight path</span>
      <h1 id="missing-title">This route does not exist.</h1>
      <p>The link may be incomplete or out of date. Head back to the workspace or open the seeded demo.</p>
      <div className="route-actions">
        <Link href="/">Back to the workspace</Link>
        <Link href="/demo?scenario=standard&seed=fork-flight-001">Open the seeded demo</Link>
      </div>
    </section>
  </main>;
}
