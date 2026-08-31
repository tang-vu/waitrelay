import { z } from "zod";

export const PaymentAvailabilitySchema = z.object({
  mode: z.enum(["disabled", "demo"]),
  available: z.boolean(),
  label: z.string(),
  reason: z.string().optional(),
}).strict();
export type PaymentAvailability = z.infer<typeof PaymentAvailabilitySchema>;

export const CheckoutInputSchema = z.object({
  userId: z.string().min(1).max(128),
  sku: z.literal("moonlit-flight-pack"),
}).strict();
export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

export const CheckoutResultSchema = z.object({
  created: z.boolean(),
  mode: z.enum(["disabled", "demo"]),
  message: z.string(),
}).strict();
export type CheckoutResult = z.infer<typeof CheckoutResultSchema>;

export interface PaymentAdapter {
  availability(): Promise<PaymentAvailability>;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyEntitlement(userId: string, sku: string): Promise<boolean>;
}
