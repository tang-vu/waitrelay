import { z } from "zod";

export const ContextCapsuleSchema = z
  .object({
    domain: z.enum([
      "research",
      "coding",
      "planning",
      "writing",
      "creative",
      "general",
    ]),
    taskKind: z.enum([
      "compare",
      "plan",
      "generate",
      "debug",
      "analyze",
      "other",
    ]),
    locale: z.enum(["en", "vi", "ja", "other", "unknown"]),
    risk: z.enum(["low", "medium", "high"]),
    waitBand: z.enum(["instant", "short", "medium", "long"]),
    interactionMode: z.enum(["active", "passive"]),
    difficulty: z.enum(["calm", "normal", "challenge"]),
  })
  .strict();

export type ContextCapsule = z.infer<typeof ContextCapsuleSchema>;

export interface ContextCapsuleSanitizeOptions {
  sensitive?: boolean;
}

/**
 * Re-parses a capsule so unknown and free-text keys can never cross the game
 * boundary. Sensitive mode deliberately removes domain, locale, and task hints.
 */
export function sanitizeContextCapsule(
  input: unknown,
  options: ContextCapsuleSanitizeOptions = {},
): ContextCapsule {
  const capsule = ContextCapsuleSchema.parse(input);
  if (!options.sensitive) {
    return capsule;
  }

  return {
    domain: "general",
    taskKind: "other",
    locale: "unknown",
    risk: "high",
    waitBand: capsule.waitBand,
    interactionMode: capsule.interactionMode,
    difficulty: "calm",
  };
}

export function createContextCapsule(
  input: ContextCapsule,
  options?: ContextCapsuleSanitizeOptions,
): ContextCapsule {
  return sanitizeContextCapsule(input, options);
}
