import { LandingExperience } from "@/components/host/LandingExperience";
import type { DemoScenario } from "@/components/host/run-types";

const scenarios = new Set<DemoScenario>(["fast", "two-second", "standard", "late", "long", "cancel", "error"]);

export default async function DemoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const raw = typeof query.scenario === "string" ? query.scenario : "standard";
  const scenario = scenarios.has(raw as DemoScenario) ? raw as DemoScenario : "standard";
  const seed = typeof query.seed === "string" && /^[a-zA-Z0-9._:-]{1,128}$/.test(query.seed) ? query.seed : "fork-flight-001";
  const fault = typeof query.fault === "string" ? query.fault : undefined;
  return <LandingExperience scenario={scenario} seed={seed} fault={fault} forceDemo />;
}
