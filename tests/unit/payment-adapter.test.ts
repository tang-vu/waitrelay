import { describe, expect, it } from "vitest";

import { DemoPaymentAdapter, resolvePaymentsMode } from "@/server/payments/demo-payment-adapter";
import { DisabledPaymentAdapter } from "@/server/payments/disabled-payment-adapter";

describe("payment adapter safety", () => {
  it("keeps Commons mode disabled without an official contract", () => {
    expect(resolvePaymentsMode("commons")).toEqual({
      requested: "commons",
      effective: "disabled",
      reason: "Commons payments are disabled because no official public integration contract is configured.",
    });
  });

  it("never creates a transaction in the demo preview", async () => {
    const adapter = new DemoPaymentAdapter();
    await expect(adapter.availability()).resolves.toMatchObject({
      mode: "demo",
      available: false,
      label: "Sandbox preview",
    });
    await expect(adapter.createCheckout({
      userId: "judge-preview",
      sku: "moonlit-flight-pack",
    })).resolves.toEqual({
      created: false,
      mode: "demo",
      message: "Sandbox preview only. No transaction was created.",
    });
  });

  it("never creates a transaction while disabled", async () => {
    const adapter = new DisabledPaymentAdapter();
    await expect(adapter.createCheckout({
      userId: "judge-preview",
      sku: "moonlit-flight-pack",
    })).resolves.toMatchObject({ created: false, mode: "disabled" });
    await expect(adapter.verifyEntitlement("judge-preview", "moonlit-flight-pack"))
      .resolves.toBe(false);
  });
});
