import { describe, expect, it } from "vitest";

import { POST as startRun } from "@/app/api/runs/route";
import { runOrchestrator } from "@/server/orchestrator/run-orchestrator";

function runRequest(index: number): Request {
  return new Request("http://localhost/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `Capacity probe ${index}`,
      scenario: "long",
      seed: `capacity-${index}`,
      sensitive: false,
      interactionMode: "passive",
      forceDemo: true,
    }),
  });
}

describe("run API resource limits", () => {
  it("rejects declared and streamed oversized task bodies with 413", async () => {
    const declared = await startRun(new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "20000" },
      body: JSON.stringify({ prompt: "small" }),
    }));
    expect(declared.status).toBe(413);

    const streamed = await startRun(new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "x".repeat(17_000) }),
    }));
    expect(streamed.status).toBe(413);
  });

  it("returns 429 without disturbing active runs when concurrency is full", async () => {
    const runIds: string[] = [];
    try {
      for (let index = 0; index < 64; index += 1) {
        const response = await startRun(runRequest(index));
        expect(response.status).toBe(201);
        runIds.push(((await response.json()) as { runId: string }).runId);
      }
      const limited = await startRun(runRequest(65));
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toBe("5");
      expect(await runOrchestrator.getSnapshot(runIds[0])).toMatchObject({ state: "active" });
    } finally {
      await Promise.all(runIds.map((runId) => runOrchestrator.cancel(runId)));
    }
  });
});
