import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { runOrchestrator } from "@/server/orchestrator/run-orchestrator";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const ack = await runOrchestrator.handleChoice(runId, await request.json());
    return NextResponse.json(ack, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ZodError ? "Invalid choice signal" : "Choice relay failed" }, { status: 400 });
  }
}
