import { z } from "zod";

export const ChoiceAxisIdSchema = z.enum(["mobility", "character"]);
export type ChoiceAxisId = z.infer<typeof ChoiceAxisIdSchema>;

export const ChoiceOptionIdSchema = z.enum([
  "less-walking",
  "more-discovery",
  "reliable",
  "surprising",
]);
export type ChoiceOptionId = z.infer<typeof ChoiceOptionIdSchema>;

export const PreferenceStateSchema = z
  .object({
    mobility: z.enum(["less-walking", "more-discovery"]),
    character: z.enum(["reliable", "surprising"]),
  })
  .strict();
export type PreferenceState = z.infer<typeof PreferenceStateSchema>;

export const DEFAULT_PREFERENCES: Readonly<PreferenceState> = Object.freeze({
  mobility: "more-discovery",
  character: "reliable",
});

export interface TrustedPreferencePatch {
  axisId: ChoiceAxisId;
  optionId: ChoiceOptionId;
}

export interface ChoiceDefinition {
  axisId: ChoiceAxisId;
  label: string;
  defaultOptionId: ChoiceOptionId;
  decisionPoint: string;
  effectCategory: string;
  options: readonly {
    optionId: ChoiceOptionId;
    label: string;
    description: string;
  }[];
}

export const TOKYO_CHOICE_DEFINITIONS: readonly ChoiceDefinition[] =
  Object.freeze([
    {
      axisId: "mobility",
      label: "Shape the route",
      defaultOptionId: "more-discovery",
      decisionPoint: "venue-ranking",
      effectCategory: "route-and-discovery",
      options: [
        {
          optionId: "less-walking",
          label: "Less Walking",
          description: "Keep the indoor route compact.",
        },
        {
          optionId: "more-discovery",
          label: "More Discovery",
          description: "Travel farther for more distinctive stops.",
        },
      ],
    },
    {
      axisId: "character",
      label: "Shape the mood",
      defaultOptionId: "reliable",
      decisionPoint: "evidence-threshold",
      effectCategory: "confidence-and-novelty",
      options: [
        {
          optionId: "reliable",
          label: "Reliable",
          description: "Favor stronger source confidence.",
        },
        {
          optionId: "surprising",
          label: "Surprising",
          description: "Allow unusual venues with adequate evidence.",
        },
      ],
    },
  ] satisfies readonly ChoiceDefinition[]);

const choiceByAxis = new Map(
  TOKYO_CHOICE_DEFINITIONS.map((definition) => [
    definition.axisId,
    definition,
  ]),
);

const choiceByOption = new Map(
  TOKYO_CHOICE_DEFINITIONS.flatMap((definition) =>
    definition.options.map((option) => [
      option.optionId,
      { definition, option },
    ] as const),
  ),
);

export function resolveChoiceAxis(axisId: string): ChoiceDefinition | undefined {
  const parsed = ChoiceAxisIdSchema.safeParse(axisId);
  return parsed.success ? choiceByAxis.get(parsed.data) : undefined;
}

export function resolveChoiceOption(optionId: string):
  | {
      definition: ChoiceDefinition;
      option: ChoiceDefinition["options"][number];
    }
  | undefined {
  const parsed = ChoiceOptionIdSchema.safeParse(optionId);
  return parsed.success ? choiceByOption.get(parsed.data) : undefined;
}

/** Maps an allowlisted option ID to a trusted state change. */
export function applyTrustedOption(
  state: PreferenceState,
  axisId: string,
  optionId: string,
): PreferenceState {
  const current = PreferenceStateSchema.parse(state);
  const definition = resolveChoiceAxis(axisId);
  const resolved = resolveChoiceOption(optionId);

  if (!definition || !resolved || resolved.definition.axisId !== axisId) {
    throw new Error("Invalid option for choice axis");
  }

  if (definition.axisId === "mobility") {
    return PreferenceStateSchema.parse({
      ...current,
      mobility: resolved.option.optionId,
    });
  }

  return PreferenceStateSchema.parse({
    ...current,
    character: resolved.option.optionId,
  });
}

export const RankingWeightsSchema = z
  .object({
    walkingWeight: z.number().min(0).max(1),
    noveltyWeight: z.number().min(0).max(1),
    confidenceWeight: z.number().min(0).max(1),
    indoorWeight: z.number().min(0).max(1),
    vegetarianWeight: z.number().min(0).max(1),
    minimumConfidence: z.number().min(0).max(1),
  })
  .strict();
export type RankingWeights = z.infer<typeof RankingWeightsSchema>;

/**
 * Derives ranking weights from the complete preference snapshot. The axes are
 * combined, rather than applied in arrival order, so race ordering cannot alter
 * the result.
 */
export function deriveRankingWeights(state: PreferenceState): RankingWeights {
  const preferences = PreferenceStateSchema.parse(state);
  const mobility =
    preferences.mobility === "less-walking"
      ? { walkingWeight: 0.42, noveltyWeight: 0.1 }
      : { walkingWeight: 0.14, noveltyWeight: 0.27 };
  const character =
    preferences.character === "surprising"
      ? { confidenceWeight: 0.18, noveltyBonus: 0.18, minimumConfidence: 0.62 }
      : { confidenceWeight: 0.38, noveltyBonus: 0, minimumConfidence: 0.78 };

  return RankingWeightsSchema.parse({
    walkingWeight: mobility.walkingWeight,
    noveltyWeight: Math.min(1, mobility.noveltyWeight + character.noveltyBonus),
    confidenceWeight: character.confidenceWeight,
    indoorWeight: 0.18,
    vegetarianWeight: 0.12,
    minimumConfidence: character.minimumConfidence,
  });
}
