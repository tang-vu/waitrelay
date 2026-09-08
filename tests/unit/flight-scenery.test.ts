import { describe, expect, it } from "vitest";
import { createFlightEngine, setFlightTerminal, updateFlightEngine } from "@/features/flight/engine/flight-engine";
import { flightSceneryAt } from "@/features/flight/engine/flight-scenery";

describe("long-wait scenery", () => {
  it("repeats ten-second modules beyond a minute without a finish condition", () => {
    expect([0, 10, 20, 30, 60, 70].map((time) => flightSceneryAt(time).name))
      .toEqual(["aurora-drift", "cloud-passage", "starfield", "aurora-drift", "aurora-drift", "cloud-passage"]);
  });

  it("crossfades continuously across every module boundary", () => {
    for (const boundary of [10, 20, 30, 60, 70]) {
      const before = flightSceneryAt(boundary - 0.001);
      const after = flightSceneryAt(boundary);
      for (const key of ["aurora", "clouds", "constellation", "horizon"] as const) {
        expect(Math.abs(before[key] - after[key])).toBeLessThan(0.001);
      }
    }
  });

  it("catches up scenery after a suspended frame without jumping bird physics", () => {
    const original = createFlightEngine("long-wait");
    const resumed = updateFlightEngine(original, 65);
    expect(resumed.sceneryElapsed).toBe(65);
    expect(resumed.elapsed).toBe(0.05);
    expect(resumed.birdY).toBe(original.birdY);
    setFlightTerminal(resumed, true);
    expect(updateFlightEngine(resumed, 10).sceneryElapsed).toBe(65);
  });
});
