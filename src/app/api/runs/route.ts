import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { runOrchestrator } from "@/server/orchestrator/run-orchestrator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const created = await runOrchestrator.start(await request.json());
    return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof ZodError ? "The task request was invalid." : "The run could not be started.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
