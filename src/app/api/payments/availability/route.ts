import { NextResponse } from "next/server";
import { createPaymentAdapter } from "@/server/payments/demo-payment-adapter";

export async function GET() {
  return NextResponse.json(await createPaymentAdapter().availability(), { headers: { "Cache-Control": "no-store" } });
}
