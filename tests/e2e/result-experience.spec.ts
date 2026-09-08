import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { RunCompleteEvent } from "../../src/shared/contracts/events";

test("result cards match the authoritative plan and copy the complete answer", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text: string) => { document.documentElement.dataset.copiedItinerary = text; },
    } });
  });
  await page.goto("/demo?scenario=fast&seed=result-cards");
  const createdResponse = page.waitForResponse((response) => response.url().endsWith("/api/runs") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Start the relay" }).click();
  const created = await (await createdResponse).json();
  const article = page.getByRole("article", { name: "Your route is ready" });
  await expect(article).toBeVisible();
  const snapshot = await (await page.request.get(created.snapshotUrl)).json();
  const completed = snapshot.events.find((event: { type: string }) => event.type === "run.complete") as RunCompleteEvent;
  expect(completed).toBeDefined();
  const plan = completed.structuredResult;
  const summary = article.getByLabel("Route summary");
  await expect(summary).toContainText(`¥${plan.totalCostYen.toLocaleString("en-US")}`);
  await expect(summary).toContainText(`${plan.routeDistanceKm.toLocaleString("en-US")} km`);
  const stops = article.getByRole("list", { name: "Planned stops" }).getByRole("listitem");
  await expect(stops).toHaveCount(3);
  for (const [index, stop] of plan.stops.entries()) {
    await expect(stops.nth(index).getByRole("heading")).toHaveText(stop.name);
    await expect(stops.nth(index)).toContainText(stop.approximateLocation);
    await expect(stops.nth(index)).toContainText(stop.openingInfo.hours);
    await expect(stops.nth(index)).toContainText(`¥${stop.estimatedCostYen.toLocaleString("en-US")}`);
  }
  await expect(article.getByText(plan.scenarioNotice, { exact: false }).first()).toBeVisible();
  await article.getByRole("button", { name: "Copy itinerary", exact: true }).click();
  await expect(article.getByRole("status")).toHaveText("Itinerary copied.");
  expect(await page.locator("html").getAttribute("data-copied-itinerary")).toBe(completed.finalAnswer);
  await article.locator("summary").click();
  await expect(article.locator(".answer-copy")).toHaveText(completed.finalAnswer);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await article.locator("summary").click();
  await article.screenshot({ path: testInfo.outputPath("structured-result.png") });
});

test("clipboard failure offers selectable text and sensitive mode removes copying", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); },
    } });
  });
  await page.goto("/demo?scenario=fast&seed=result-copy-failure");
  await page.getByRole("button", { name: "Start the relay" }).click();
  const article = page.getByRole("article", { name: "Your route is ready" });
  await article.getByRole("button", { name: "Copy itinerary", exact: true }).click();
  await expect(article.getByRole("status")).toContainText("Clipboard unavailable");
  await expect(article.locator(".answer-copy")).toBeVisible();
  await page.getByRole("checkbox", { name: /Sensitive mode/ }).check();
  await expect(article.getByRole("button", { name: /Copy/ })).toHaveCount(0);
  await expect(article.getByText("Copying off in Sensitive mode.")).toBeVisible();
  await page.getByRole("button", { name: "Start the relay" }).click();
  await expect(article).toBeVisible();
  await expect(article.getByRole("button", { name: /Copy/ })).toHaveCount(0);
});

test("blocked cosmetic storage never hides the answer or traps the preview", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { configurable: true, get() {
      throw new DOMException("Storage blocked", "SecurityError");
    } });
  });
  await page.goto("/demo?scenario=fast&seed=result-storage-blocked");
  await page.getByRole("button", { name: "Start the relay" }).click();
  await expect(page.getByRole("article", { name: "Your route is ready" })).toBeVisible();
  await page.getByRole("button", { name: "Preview Flight Pack" }).click();
  await page.getByRole("button", { name: "Save cosmetic preview" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Preview selected for this session. Browser storage is unavailable.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview Flight Pack" })).toBeFocused();
  await expect(page.getByRole("article", { name: "Your route is ready" })).toBeVisible();
  expect(errors).toEqual([]);
});
