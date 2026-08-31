import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";

type AxeResult = {
  violations: Array<{ impact?: string | null }>;
};

function seriousViolations(result: AxeResult) {
  return result.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
}

const require = createRequire(import.meta.url);
const axePlaywrightEntry = require.resolve("@axe-core/playwright");
const axeScriptPath = require.resolve("axe-core/axe.min.js", {
  paths: [path.dirname(axePlaywrightEntry)],
});

test("empty state and active flight have no serious accessibility violations", async ({ page }) => {
  await page.goto("/demo?scenario=long&seed=a11y-001");
  const empty = await new AxeBuilder({ page }).analyze();
  expect(seriousViolations(empty)).toEqual([]);
  await page.getByRole("button", { name: "Start the relay" }).click();
  await expect(page.locator('iframe[title="WaitRelay Fork Flight"]')).toBeVisible({ timeout: 2_500 });
  const active = await new AxeBuilder({ page }).analyze();
  expect(seriousViolations(active)).toEqual([]);

  const flightFrame = page.frames().find((frame) => new URL(frame.url()).pathname === "/flight");
  if (!flightFrame) throw new Error("flight frame unavailable");
  await flightFrame.addScriptTag({
    path: axeScriptPath,
  });
  const flightResult = await flightFrame.evaluate(async () => {
    const axe = (window as typeof window & {
      axe: { run: (root: Document) => Promise<AxeResult> };
    }).axe;
    return axe.run(document);
  });
  expect(seriousViolations(flightResult)).toEqual([]);

  const visibleControls = flightFrame.locator("button:visible");
  for (let index = 0; index < await visibleControls.count(); index += 1) {
    const box = await visibleControls.nth(index).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("system reduced-motion preference switches to calm node selection", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo?scenario=standard&seed=system-reduced-001");
  await page.getByRole("button", { name: "Start the relay" }).click();
  const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  await expect(flight.getByRole("region", { name: "Reduced motion flight" })).toBeVisible({ timeout: 3_000 });
  await expect(flight.locator("canvas")).toHaveCount(0);
  const reducedFrame = page.frames().find((frame) => new URL(frame.url()).pathname === "/flight");
  if (!reducedFrame) throw new Error("reduced-motion frame unavailable");
  await reducedFrame.addScriptTag({ path: axeScriptPath });
  const reducedResult = await reducedFrame.evaluate(async () => {
    const axe = (window as typeof window & {
      axe: { run: (root: Document) => Promise<AxeResult> };
    }).axe;
    return axe.run(document);
  });
  expect(seriousViolations(reducedResult)).toEqual([]);
});

test("comparison surface has no serious accessibility violations", async ({ page }) => {
  await page.goto("/compare");
  const result = await new AxeBuilder({ page }).analyze();
  expect(seriousViolations(result)).toEqual([]);
});

test("high-contrast preference increases muted text and border contrast", async ({ page }) => {
  await page.emulateMedia({ contrast: "more" });
  await page.goto("/demo?scenario=fast&seed=contrast-001");
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      muted: style.getPropertyValue("--muted").trim(),
      line: style.getPropertyValue("--line").trim(),
    };
  });
  expect(tokens).toEqual({ muted: "#d8e5e2", line: "#ffffff6b" });
});
