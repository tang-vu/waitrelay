import { NextResponse } from "next/server";
import { runOrchestrator } from "@/server/orchestrator/run-orchestrator";

export async function POST(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const status = await runOrchestrator.cancel(runId);
  return NextResponse.json({ status }, { status: status === "stale-run" ? 404 : 200 });
}
