import { NextResponse } from "next/server";
import { CheckoutInputSchema } from "@/server/payments/payment-adapter";
import { createPaymentAdapter } from "@/server/payments/demo-payment-adapter";

export async function POST(request: Request) {
  const input = CheckoutInputSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "Invalid preview request" }, { status: 400 });
  const result = await createPaymentAdapter().createCheckout(input.data);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
