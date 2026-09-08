import { expect, test } from "@playwright/test";

test("long-wait scenery repeats beyond a minute, supports Quiet Mode, and yields to the answer", async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  // Advance browser time only. The real server keeps its independent 30s run.
  await page.clock.install();
  await page.goto("/demo?scenario=long&seed=long-wait-modules");
  await page.getByRole("button", { name: "Start the relay" }).click();
  const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  const canvas = flight.locator("canvas");
  await expect(canvas).toHaveAttribute("data-flight-scenery", "aurora-drift");
  await flight.getByRole("button", { name: /Less Walking/ }).press("Enter");
  await expect(flight.getByText("Applied now")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("aurora.png") });
  await page.clock.fastForward(10_000);
  await expect(canvas).toHaveAttribute("data-flight-scenery", "cloud-passage");
  await page.screenshot({ path: testInfo.outputPath("clouds.png") });
  await page.clock.fastForward(10_000);
  await expect(canvas).toHaveAttribute("data-flight-scenery", "starfield");
  await page.screenshot({ path: testInfo.outputPath("stars.png") });
  await page.clock.fastForward(45_000);
  expect(Number(await canvas.getAttribute("data-flight-loop"))).toBeGreaterThanOrEqual(6);
  await flight.getByRole("button", { name: "Quiet mode" }).press("Enter");
  await expect(flight.getByRole("region", { name: "Passive flight activity" })).toBeVisible();
  await flight.getByRole("button", { name: "Open flight" }).press("Enter");
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 35_000 });
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator(".result-surface")).toBeFocused();
  await expect(page.locator(".receipt")).toContainText("Less Walking");
});
