import { z } from "zod";

import { PreferenceStateSchema, RankingWeightsSchema } from "./choices";

export const TokyoCandidateSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(160),
    kind: z.enum(["dinner", "activity", "dessert"]),
    approximateLocation: z.string().min(1).max(160),
    estimatedCostYen: z.number().int().nonnegative(),
    indoorSuitability: z.number().min(0).max(1),
    vegetarianSuitability: z.number().min(0).max(1),
    openingInfo: z
      .object({
        scenarioOpen: z.boolean(),
        hours: z.string().min(1).max(80),
        recordedAt: z.string().datetime(),
        sourceLabel: z.string().min(1).max(160),
      })
      .strict(),
    evidenceTimestamp: z.string().datetime(),
    sourceConfidence: z.number().min(0).max(1),
    novelty: z.number().min(0).max(1),
    routeDistanceKm: z.number().nonnegative(),
    scenarioNote: z.string().min(1).max(500),
  })
  .strict();
export type TokyoCandidate = z.infer<typeof TokyoCandidateSchema>;

export const TokyoPlanSchema = z
  .object({
    planId: z.string().min(1).max(256),
    fixtureVersion: z.string().min(1).max(128),
    fixtureRecordedAt: z.string().datetime(),
    scenarioNotice: z.string().min(1).max(500),
    preferences: PreferenceStateSchema,
    rankingWeights: RankingWeightsSchema,
    stops: z.array(TokyoCandidateSchema).length(3),
    totalCostYen: z.number().int().nonnegative(),
    routeDistanceKm: z.number().nonnegative(),
    averageNovelty: z.number().min(0).max(1),
    averageSourceConfidence: z.number().min(0).max(1),
    verifiedEvidenceItems: z.number().int().nonnegative(),
    excludedCandidateIds: z.array(z.string().min(1).max(128)).max(100),
  })
  .strict();
export type TokyoPlan = z.infer<typeof TokyoPlanSchema>;
