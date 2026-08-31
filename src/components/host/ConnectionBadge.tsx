"use client";

import { useEffect, useState } from "react";
import type { ProviderMode } from "@/shared/contracts/events";

export function ConnectionBadge({ connection, providerMode }: { connection: string; providerMode: ProviderMode | null }) {
  const [preflight, setPreflight] = useState<"checking" | "ready" | "not-configured" | "unavailable">("checking");
  const label = providerMode === "live" ? "Live Provider" : providerMode === "fallback" ? "Fallback Replay" : "Demo Provider";
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/health", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ liveConfigured?: boolean; provider?: { ok?: boolean } }> : Promise.reject(new Error("preflight failed")))
      .then((health) => setPreflight(health.liveConfigured ? (health.provider?.ok ? "ready" : "unavailable") : "not-configured"))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setPreflight("unavailable");
      });
    return () => controller.abort();
  }, []);
  const preflightLabel = preflight === "checking" ? "Live preflight: checking" : preflight === "ready" ? "Live preflight: ready" : preflight === "not-configured" ? "Live preflight: not configured" : "Live preflight: unavailable";
  return <div className="status-badges" aria-label={`Provider: ${label}. Connection: ${connection}. ${preflightLabel}.`}>
    <span className={`badge provider-${providerMode ?? "demo"}`}>{label}</span>
    <span className="badge"><span className={`status-dot status-${connection}`} aria-hidden="true" />{connection}</span>
    <span className={`badge preflight-${preflight}`}>{preflightLabel}</span>
  </div>;
}
