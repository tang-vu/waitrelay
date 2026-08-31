import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { runOrchestrator } from "@/server/orchestrator/run-orchestrator";
import { readBoundedJson, RequestBodyTooLargeError } from "@/server/http/read-bounded-json";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const ack = await runOrchestrator.handleChoice(runId, await readBoundedJson(request, 4_096));
    return NextResponse.json(ack, {
      status: ack.reason === "run-capacity" ? 429 : 200,
      headers: {
        "Cache-Control": "no-store",
        ...(ack.reason === "run-capacity" ? { "Retry-After": "5" } : {}),
      },
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Choice signal too large" }, { status: 413 });
    }
    return NextResponse.json({ error: error instanceof ZodError ? "Invalid choice signal" : "Choice relay failed" }, { status: 400 });
  }
}
