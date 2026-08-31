import { NextResponse } from "next/server";
import { runOrchestrator } from "@/server/orchestrator/run-orchestrator";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const snapshot = await runOrchestrator.getSnapshot(runId);
  if (!snapshot) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const latestProviderEvent = [...snapshot.publicEvents]
    .reverse()
    .find((event) => event.type === "run.complete" || event.type === "provider.mode" || event.type === "run.start");
  const providerMode = latestProviderEvent?.type === "run.complete" || latestProviderEvent?.type === "provider.mode" || latestProviderEvent?.type === "run.start"
    ? latestProviderEvent.providerMode
    : "demo";
  return NextResponse.json({
    runId,
    status: snapshot.state === "active" ? "running" : snapshot.state,
    providerMode,
    latestSequence: snapshot.lastSequence,
    events: snapshot.publicEvents,
  }, { headers: { "Cache-Control": "no-store" } });
}
