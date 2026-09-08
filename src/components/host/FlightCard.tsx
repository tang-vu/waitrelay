"use client";

import { useEffect } from "react";

const COSMETIC_KEY = "waitrelay:bird-identity";

export function FlightCard({
  appliedChoices,
  durationBand = "medium",
  sensitive = false,
  seed = "fork-flight-001",
  scenario = "standard",
}: {
  appliedChoices: number;
  durationBand?: string;
  sensitive?: boolean;
  seed?: string;
  scenario?: string;
}) {
  const identity = sensitive ? "Private courier" : "Moon courier";
  const safeSeed = /^[a-zA-Z0-9._:-]{1,128}$/.test(seed) ? seed : "fork-flight-001";
  const safeScenario = ["fast", "two-second", "standard", "long", "cancel", "error"].includes(scenario)
    ? scenario
    : "standard";

  useEffect(() => {
    if (sensitive) return;
    try {
      if (localStorage.getItem(COSMETIC_KEY) !== "moon-courier-v1") localStorage.setItem(COSMETIC_KEY, "moon-courier-v1");
    } catch {
      // Cosmetic persistence is optional; a blocked store must not hide the answer.
    }
  }, [sensitive]);

  return <section className="flight-card" aria-labelledby="flight-card-title">
    <div className="mini-bird" aria-hidden="true"><span /></div>
    <div>
      <span className="eyebrow">Sanitized Flight Card</span>
      <h3 id="flight-card-title">{identity} · Dusk relay</h3>
      <p>{appliedChoices} applied {appliedChoices === 1 ? "choice" : "choices"} · {durationBand} wait band · seed echo ready</p>
    </div>
    {!sensitive && <a className="text-button" href={`/demo?scenario=${encodeURIComponent(safeScenario)}&seed=${encodeURIComponent(safeSeed)}`}>Fly this seed</a>}
    {sensitive && <span className="private-card-label">Sharing off</span>}
  </section>;
}
