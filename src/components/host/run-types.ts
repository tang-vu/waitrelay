import type { PublicEvent, ProviderMode } from "@/shared/contracts/events";

export type RunStatus = "running" | "completed" | "cancelled" | "failed";

export interface RunSnapshotResponse {
  runId: string;
  status: RunStatus;
  providerMode: ProviderMode;
  latestSequence: number;
  events: PublicEvent[];
}

export interface CreateRunResponse {
  runId: string;
  providerMode: ProviderMode;
  streamUrl: string;
  snapshotUrl: string;
}

export type DemoScenario =
  | "fast"
  | "two-second"
  | "standard"
  | "long"
  | "cancel"
  | "error";
