const scenes = [
  { name: "aurora-drift", aurora: 1, clouds: 0.35, constellation: 0.2, horizon: 0.7 },
  { name: "cloud-passage", aurora: 0.25, clouds: 1, constellation: 0.15, horizon: 1 },
  { name: "starfield", aurora: 0.35, clouds: 0.2, constellation: 1, horizon: 0.2 },
] as const;

/** Decorative ten-second modules. They never describe agent progress. */
export function flightSceneryAt(elapsedSeconds: number) {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const loop = Math.floor(elapsed / 10);
  const current = scenes[loop % scenes.length];
  const next = scenes[(loop + 1) % scenes.length];
  const blend = Math.max(0, (elapsed % 10 - 8.5) / 1.5);
  const mix = (key: "aurora" | "clouds" | "constellation" | "horizon") =>
    current[key] + (next[key] - current[key]) * blend;
  return { name: current.name, loop, aurora: mix("aurora"), clouds: mix("clouds"),
    constellation: mix("constellation"), horizon: mix("horizon") };
}
