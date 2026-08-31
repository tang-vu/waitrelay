import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { runOrchestrator } from "@/server/orchestrator/run-orchestrator";
import { readBoundedJson, RequestBodyTooLargeError } from "@/server/http/read-bounded-json";
import { RunCapacityError } from "@/server/stores/run-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const created = await runOrchestrator.start(await readBoundedJson(request, 16_384));
    return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "The task request was too large." }, { status: 413 });
    }
    if (error instanceof RunCapacityError) {
      return NextResponse.json(
        { error: "The run service is busy. Try again shortly." },
        { status: 429, headers: { "Retry-After": "5" } },
      );
    }
    const message = error instanceof ZodError ? "The task request was invalid." : "The run could not be started.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
