import { NextResponse } from "next/server";
import { CheckoutInputSchema } from "@/server/payments/payment-adapter";
import { readBoundedJson, RequestBodyTooLargeError } from "@/server/http/read-bounded-json";
import { createPaymentAdapter } from "@/server/payments/demo-payment-adapter";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await readBoundedJson(request, 2_048);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Checkout request too large" }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
  }
  const input = CheckoutInputSchema.safeParse(payload);
  if (!input.success) return NextResponse.json({ error: "Invalid preview request" }, { status: 400 });
  const result = await createPaymentAdapter().createCheckout(input.data);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
