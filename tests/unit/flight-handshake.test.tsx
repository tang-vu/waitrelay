// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FlightSandboxHost } from "@/components/flight/FlightSandboxHost";
import { sanitizeContextCapsule } from "@/shared/contracts/context-capsule";
import { SafeFlightGateSchema } from "@/features/flight/bridge/contracts";
import type { HostBridgeOptions } from "@/features/flight/bridge/message-bridge";

const mock = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("@/features/flight/bridge", async (original) => ({
  ...await original<typeof import("@/features/flight/bridge")>(),
  connectFlightHost: mock.connect,
}));

const connections: Array<{ options: HostBridgeOptions; bridge: { send: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> } }> = [];
const props = {
  runId: "run-handshake", nonce: "nonce-handshake", visualSeed: "seed-handshake",
  stage: "understanding" as const, onSignal: vi.fn(),
  context: sanitizeContextCapsule({ domain: "planning", taskKind: "plan", locale: "en", risk: "low", waitBand: "medium", interactionMode: "active", difficulty: "normal" }),
};
const gate = SafeFlightGateSchema.parse({
  requestId: "mobility-1", axisId: "mobility", defaultOptionId: "more-discovery", effectCategory: "route-and-discovery",
  options: [{ optionId: "less-walking", label: "Less Walking" }, { optionId: "more-discovery", label: "More Discovery" }],
});

beforeEach(() => {
  vi.useFakeTimers();
  connections.length = 0;
  mock.connect.mockImplementation((options: HostBridgeOptions) => {
    const bridge = { send: vi.fn(() => true), destroy: vi.fn() };
    connections.push({ options, bridge });
    return bridge;
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

it("retains an accepted port until its delayed READY and synchronizes the latest gate", () => {
  const view = render(<FlightSandboxHost {...props} />);
  fireEvent.load(view.getByTitle("WaitRelay Fork Flight"));
  view.rerender(<FlightSandboxHost {...props} gate={gate} stage="gathering" mode="passive" />);
  act(() => { vi.advanceTimersByTime(700); });
  expect(connections).toHaveLength(4);
  expect(connections[0].bridge.destroy).not.toHaveBeenCalled();
  act(() => { connections[0].options.onMessage({ bridgeVersion: "1.0", runId: props.runId, nonce: props.nonce, type: "flight.ready" }); });
  const accepted = connections[0].bridge;
  expect(accepted.send).toHaveBeenCalledWith(expect.objectContaining({ type: "choice.request", gate }));
  expect(accepted.send).toHaveBeenCalledWith(expect.objectContaining({ type: "run.progress", stage: "gathering" }));
  expect(accepted.send).toHaveBeenCalledWith(expect.objectContaining({ type: "flight.mode", mode: "passive" }));
  for (const candidate of connections.slice(1)) expect(candidate.bridge.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  view.unmount();
  expect(accepted.destroy).toHaveBeenCalledOnce();
});

it("closes every unacknowledged candidate and reports one failure on timeout", () => {
  const failure = vi.fn();
  const view = render(<FlightSandboxHost {...props} onFailure={failure} />);
  fireEvent.load(view.getByTitle("WaitRelay Fork Flight"));
  act(() => { vi.advanceTimersByTime(2_500); });
  expect(failure).toHaveBeenCalledOnce();
  for (const candidate of connections) expect(candidate.bridge.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
