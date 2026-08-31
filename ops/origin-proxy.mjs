import { createServer, request as createUpstreamRequest } from "node:http";

const proxyHost = process.env.WAITRELAY_PROXY_HOST ?? "127.0.0.1";
const proxyPort = Number(process.env.WAITRELAY_PROXY_PORT ?? "4317");
const upstreamHost = process.env.WAITRELAY_UPSTREAM_HOST ?? "127.0.0.1";
const upstreamPort = Number(process.env.WAITRELAY_UPSTREAM_PORT ?? "4318");
const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function withoutHopByHop(headers) {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !hopByHopHeaders.has(name.toLowerCase())),
  );
}

const server = createServer((request, response) => {
  const upstream = createUpstreamRequest({
    host: upstreamHost,
    port: upstreamPort,
    method: request.method,
    path: request.url,
    headers: withoutHopByHop(request.headers),
  }, (upstreamResponse) => {
    const headers = withoutHopByHop(upstreamResponse.headers);
    const contentType = String(upstreamResponse.headers["content-type"] ?? "");
    if (contentType.toLowerCase().includes("text/html")) {
      headers["cache-control"] = "public, no-store, max-age=0, must-revalidate, no-transform";
    }
    response.writeHead(upstreamResponse.statusCode ?? 502, headers);
    upstreamResponse.pipe(response);
  });

  upstream.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    }
    response.end("WaitRelay origin is temporarily unavailable.");
  });
  request.on("aborted", () => upstream.destroy());
  response.on("close", () => {
    if (!response.writableEnded) upstream.destroy();
  });
  request.pipe(upstream);
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.listen(proxyPort, proxyHost);

function close() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
