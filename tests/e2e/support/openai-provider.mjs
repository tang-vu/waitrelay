import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 3188;

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

function providerEnvelope(value) {
  return { choices: [{ message: { content: JSON.stringify(value) } }] };
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/models") {
    sendJson(response, 200, { data: [{ id: "e2e-provider-probe" }] });
    return;
  }

  if (request.method !== "POST" || request.url !== "/chat/completions") {
    sendJson(response, 404, { error: "not-found" });
    return;
  }

  let rawBody = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    rawBody += chunk;
    if (rawBody.length > 1_000_000) request.destroy();
  });
  request.on("end", () => {
    if (rawBody.includes("fallback-provider-probe")) {
      sendJson(response, 503, { error: "controlled-e2e-provider-failure" });
      return;
    }

    const body = JSON.parse(rawBody);
    const system = body.messages?.[0]?.content ?? "";
    if (system.includes("Classify this Tokyo planning task")) {
      sendJson(response, 200, providerEnvelope({
        domain: "planning",
        taskKind: "plan",
        applicableAxisIds: ["mobility", "character"],
        publicSummary: "Local E2E provider accepted the structured Tokyo planning task.",
      }));
      return;
    }
    if (system.includes("source=live")) {
      sendJson(response, 200, providerEnvelope({
        source: "live",
        recordedAt: "2026-08-31T00:00:00.000Z",
        summary: "Local E2E provider returned a validated evidence envelope.",
        evidenceItems: 6,
      }));
      return;
    }
    sendJson(response, 200, providerEnvelope({
      answer: "The local E2E provider presented the authoritative structured itinerary.",
    }));
  });
});

server.listen(port, host);

function close() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
