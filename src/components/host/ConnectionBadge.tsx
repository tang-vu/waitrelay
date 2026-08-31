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
  const connectionLabel = connection === "live"
    ? "Stream connected"
    : connection === "polling"
      ? "Polling fallback"
      : connection === "connecting"
        ? "Stream connecting"
        : connection === "offline"
          ? "Stream offline"
          : "Stream idle";
  const preflightLabel = preflight === "checking" ? "Live adapter check" : preflight === "ready" ? "Live adapter ready" : preflight === "not-configured" ? "Live adapter off" : "Live adapter unavailable";
  return <div className="status-badges" aria-label={`Provider: ${label}. Transport: ${connectionLabel}. ${preflightLabel}.`}>
    <span className={`badge provider-${providerMode ?? "demo"}`}>{label}</span>
    <span className="badge"><span className={`status-dot status-${connection}`} aria-hidden="true" />{connectionLabel}</span>
    <span className={`badge preflight-${preflight}`}>{preflightLabel}</span>
  </div>;
}
