import type { CheckoutInput, PaymentAdapter } from "./payment-adapter";
import { DisabledPaymentAdapter } from "./disabled-payment-adapter";

/** A UI sandbox only. It never creates money, receipts, wallets, or entitlements. */
export class DemoPaymentAdapter implements PaymentAdapter {
  async availability() {
    return {
      mode: "demo" as const,
      available: false,
      label: "Sandbox preview",
      reason: "Cosmetic preview only. No transaction, receipt, or entitlement is created.",
    };
  }
  async createCheckout(input: CheckoutInput) {
    void input;
    return { created: false, mode: "demo" as const, message: "Sandbox preview only. No transaction was created." };
  }
  async verifyEntitlement(userId: string, sku: string) { void userId; void sku; return false; }
}

export type RequestedPaymentsMode = "disabled" | "demo" | "commons";

export function resolvePaymentsMode(raw = process.env.PAYMENTS_MODE): {
  requested: RequestedPaymentsMode;
  effective: "disabled" | "demo";
  reason?: string;
} {
  const requested: RequestedPaymentsMode = raw === "demo" || raw === "commons"
    ? raw
    : "disabled";
  if (requested === "demo") return { requested, effective: "demo" };
  if (requested === "commons") {
    return {
      requested,
      effective: "disabled",
      reason: "Commons payments are disabled because no official public integration contract is configured.",
    };
  }
  return { requested, effective: "disabled" };
}

export function createPaymentAdapter(): PaymentAdapter {
  const configuration = resolvePaymentsMode();
  if (configuration.effective === "demo") return new DemoPaymentAdapter();
  return new DisabledPaymentAdapter(
    configuration.requested === "commons" ? "Preview only, Commons unavailable" : undefined,
    configuration.reason,
  );
}
