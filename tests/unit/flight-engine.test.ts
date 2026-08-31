import { describe, expect, it } from "vitest";

import { createFlightEngine } from "@/features/flight/engine/flight-engine";

describe("seeded ghost replay", () => {
  it("reproduces the same ghost path parameters for the same public seed", () => {
    const first = createFlightEngine("fork-flight-001");
    const replay = createFlightEngine("fork-flight-001");
    const other = createFlightEngine("fork-flight-002");

    expect({ phase: first.ghostPhase, amplitude: first.ghostAmplitude }).toEqual({
      phase: replay.ghostPhase,
      amplitude: replay.ghostAmplitude,
    });
    expect({ phase: other.ghostPhase, amplitude: other.ghostAmplitude }).not.toEqual({
      phase: first.ghostPhase,
      amplitude: first.ghostAmplitude,
    });
  });
});
