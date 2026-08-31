import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FlightCard } from "@/components/host/FlightCard";

const CANARY = "RAW_PROMPT_CANARY_8f79c58d7e";

describe("sanitized Flight Card", () => {
  it("renders only generic cosmetic state even if an unsafe caller has extra data", () => {
    const props = {
      appliedChoices: 2,
      durationBand: "medium",
      rawPrompt: CANARY,
      finalAnswer: CANARY,
      userIdentity: CANARY,
    } as Parameters<typeof FlightCard>[0] & Record<string, unknown>;
    const output = renderToStaticMarkup(createElement(FlightCard, props));

    expect(output).toContain("2 applied choices");
    expect(output).toContain("medium wait band");
    expect(output).not.toContain(CANARY);
    expect(output).not.toContain("rawPrompt");
    expect(output).not.toContain("finalAnswer");
  });

  it("disables sharing and uses a generic identity in sensitive mode", () => {
    const output = renderToStaticMarkup(createElement(FlightCard, { appliedChoices: 1, sensitive: true }));

    expect(output).toContain("Private courier");
    expect(output).toContain("Sharing off");
    expect(output).not.toContain("Copy seed link");
  });
});
