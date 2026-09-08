import type { PublicEvent, ProviderMode } from "@/shared/contracts/events";
import { OpaqueIdSchema, ProviderModeSchema } from "@/shared/contracts/events";
import { z } from "zod";

export type RunStatus = "running" | "completed" | "cancelled" | "failed";

export interface RunSnapshotResponse {
  runId: string;
  status: RunStatus;
  providerMode: ProviderMode;
  latestSequence: number;
  events: PublicEvent[];
}

export const CreateRunResponseSchema = z.object({
  runId: OpaqueIdSchema,
  providerMode: ProviderModeSchema,
  streamUrl: z.string(),
  snapshotUrl: z.string(),
}).strict().refine((value) => {
  const base = `/api/runs/${encodeURIComponent(value.runId)}`;
  return value.streamUrl === `${base}/events` && value.snapshotUrl === `${base}/snapshot`;
}, "Run transport URLs must belong to the created run");

export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;

export type DemoScenario =
  | "fast"
  | "two-second"
  | "standard"
  | "late"
  | "long"
  | "cancel"
  | "error";
