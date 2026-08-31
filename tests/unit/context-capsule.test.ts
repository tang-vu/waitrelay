import { describe, expect, it } from "vitest";

import {
  ContextCapsuleSchema,
  createContextCapsule,
  sanitizeContextCapsule,
} from "@/shared/contracts/context-capsule";

const capsule = {
  domain: "planning" as const,
  taskKind: "plan" as const,
  locale: "en" as const,
  risk: "low" as const,
  waitBand: "medium" as const,
  interactionMode: "active" as const,
  difficulty: "normal" as const,
};

describe("Context Capsule", () => {
  it("keeps only the explicit enum-oriented schema", () => {
    expect(createContextCapsule(capsule)).toEqual(capsule);
    expect(
      ContextCapsuleSchema.safeParse({
        ...capsule,
        rawPrompt: "private task",
      }).success,
    ).toBe(false);
  });

  it("rejects user entities and free-text locale or domain values", () => {
    expect(
      ContextCapsuleSchema.safeParse({
        ...capsule,
        locale: "Alice in exact Tokyo neighborhood",
      }).success,
    ).toBe(false);
    expect(
      ContextCapsuleSchema.safeParse({
        ...capsule,
        email: "person@example.test",
      }).success,
    ).toBe(false);
  });

  it("uses generic values in Sensitive Mode while preserving interaction needs", () => {
    expect(sanitizeContextCapsule(capsule, { sensitive: true })).toEqual({
      domain: "general",
      taskKind: "other",
      locale: "unknown",
      risk: "high",
      waitBand: "medium",
      interactionMode: "active",
      difficulty: "calm",
    });
  });
});
