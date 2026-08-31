import { z } from "zod";

import { ChoiceAckStatusSchema } from "./choices";

export const ReceiptScalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const EffectMetricSchema = z
  .object({
    metricId: z.string().min(1).max(80),
    label: z.string().min(1).max(120),
    before: ReceiptScalarSchema,
    after: ReceiptScalarSchema,
    unit: z.string().min(1).max(32).optional(),
    material: z.boolean(),
  })
  .strict();
export type EffectMetric = z.infer<typeof EffectMetricSchema>;

export const ImpactReceiptEntrySchema = z
  .object({
    requestId: z.string().min(1).max(128),
    axisId: z.string().min(1).max(64),
    selectedOptionId: z.string().min(1).max(64),
    selectedOptionLabel: z.string().min(1).max(48),
    defaultOptionId: z.string().min(1).max(64),
    signalTimestamp: z.string().datetime(),
    ackTimestamp: z.string().datetime(),
    ackStatus: ChoiceAckStatusSchema,
    pipelineNode: z.string().min(1).max(80),
    beforeState: z.record(z.string(), ReceiptScalarSchema),
    afterState: z.record(z.string(), ReceiptScalarSchema),
    effectMetrics: z.array(EffectMetricSchema).max(12),
    summary: z.string().min(1).max(500),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.ackStatus !== "appliedNow") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Impact receipts may contain only appliedNow choices",
        path: ["ackStatus"],
      });
    }
  });
export type ImpactReceiptEntry = z.infer<typeof ImpactReceiptEntrySchema>;

export const ImpactReceiptSchema = z
  .object({
    protocolVersion: z.literal("1.0"),
    runId: z.string().min(1).max(128),
    generatedAt: z.string().datetime(),
    baselinePlanId: z.string().min(1).max(256),
    selectedPlanId: z.string().min(1).max(256),
    entries: z.array(ImpactReceiptEntrySchema).max(3),
    materialChange: z.boolean(),
    summary: z.string().min(1).max(500),
  })
  .strict();
export type ImpactReceipt = z.infer<typeof ImpactReceiptSchema>;
