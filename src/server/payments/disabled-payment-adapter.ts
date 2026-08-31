import type { CheckoutInput, PaymentAdapter } from "./payment-adapter";

export class DisabledPaymentAdapter implements PaymentAdapter {
  constructor(
    private readonly label = "Preview only",
    private readonly reason = "Payments are disabled. No transaction can be created.",
  ) {}

  async availability() {
    return {
      mode: "disabled" as const,
      available: false,
      label: this.label,
      reason: this.reason,
    };
  }
  async createCheckout(input: CheckoutInput) {
    void input;
    return { created: false, mode: "disabled" as const, message: "Payments are disabled. No transaction was created." };
  }
  async verifyEntitlement(userId: string, sku: string) { void userId; void sku; return false; }
}
