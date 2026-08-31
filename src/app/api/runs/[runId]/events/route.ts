import { runOrchestrator } from "@/server/orchestrator/run-orchestrator";
import type { PublicEvent } from "@/shared/contracts/events";

export const dynamic = "force-dynamic";

function encodeEvent(event: PublicEvent): string {
  return `id: ${event.sequence}\nevent: message\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const snapshot = await runOrchestrator.getSnapshot(runId);
  if (!snapshot) return new Response("Run not found", { status: 404 });
  const rawLastId = request.headers.get("last-event-id") ?? new URL(request.url).searchParams.get("after") ?? "-1";
  const forceFirstDisconnect = new URL(request.url).searchParams.get("fault") === "reconnect-once"
    && request.headers.get("last-event-id") === null;
  const afterSequence = Number.isFinite(Number(rawLastId)) ? Number(rawLastId) : -1;
  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* stream already closed */ }
      };
      const send = (event: PublicEvent) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(encodeEvent(event))); } catch { close(); return; }
        if (event.type === "run.complete" || event.type === "run.cancel.ack" || event.type === "run.error") setTimeout(close, 25);
      };
      const subscription = await runOrchestrator.subscribeWithReplay(runId, afterSequence, send);
      if (!subscription) {
        close();
        return;
      }
      unsubscribe = subscription.unsubscribe;
      const initial = subscription.replay;
      initial.forEach(send);
      if (initial.some((event) => event.type === "run.complete" || event.type === "run.cancel.ack" || event.type === "run.error")) {
        close();
        return;
      }
      if (forceFirstDisconnect) {
        setTimeout(close, 25);
        return;
      }
      subscription.activate();
      heartbeat = setInterval(() => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { close(); }
        }
      }, 15_000);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
