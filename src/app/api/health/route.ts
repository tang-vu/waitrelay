import { NextResponse } from "next/server";
import { runOrchestrator } from "@/server/orchestrator/run-orchestrator";
import { createPaymentAdapter, resolvePaymentsMode } from "@/server/payments/demo-payment-adapter";

export const dynamic = "force-dynamic";

export async function GET() {
  const liveConfigured = Boolean(process.env.AGENT_BASE_URL && process.env.AGENT_API_KEY && process.env.AGENT_MODEL);
  const health = await runOrchestrator.health(!liveConfigured);
  const paymentConfiguration = resolvePaymentsMode();
  const paymentAvailability = await createPaymentAdapter().availability();
  return NextResponse.json({
    ok: true,
    product: "WaitRelay: Fork Flight",
    provider: health,
    liveConfigured,
    fixtureFallbackAllowed: process.env.ALLOW_FIXTURE_FALLBACK === "1",
    payments: {
      requestedMode: paymentConfiguration.requested,
      effectiveMode: paymentAvailability.mode,
      available: paymentAvailability.available,
      label: paymentAvailability.label,
      ...(paymentAvailability.reason ? { reason: paymentAvailability.reason } : {}),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
