import { expect, test } from "@playwright/test";

test("long-wait scenery repeats beyond a minute, supports Quiet Mode, and yields to the answer", async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  // Control only the decorative frame clock. Host timers, networking, and the
  // real server keep running independently, including the 30-second completion.
  await page.addInitScript(() => {
    if (window === window.top) return;
    const raf = window.requestAnimationFrame.bind(window);
    const now = performance.now.bind(performance);
    const clock: { time?: number; last: number } = { last: 0 };
    Object.defineProperty(window, "__flightTestClock", { value: clock });
    Object.defineProperty(performance, "now", { value: () => clock.time ?? now() });
    window.requestAnimationFrame = (callback) => raf((time) => {
      clock.last = clock.time ?? time;
      callback(clock.last);
    });
  });
  await page.goto("/demo?scenario=long&seed=long-wait-modules");
  await page.getByRole("button", { name: "Start the relay" }).click();
  const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  const canvas = flight.locator("canvas");
  await expect(canvas).toHaveAttribute("data-flight-scenery", "aurora-drift");
  await flight.getByRole("button", { name: /Less Walking/ }).press("Enter");
  await expect(flight.getByText("Applied now")).toBeVisible();
  const frame = page.frames().find((candidate) => new URL(candidate.url()).pathname === "/flight");
  if (!frame) throw new Error("Flight frame unavailable");
  const advance = async (milliseconds: number) => frame.evaluate((delta) => {
    const clock = (window as typeof window & { __flightTestClock: { time?: number; last: number } }).__flightTestClock;
    clock.time = (clock.time ?? clock.last) + delta;
  }, milliseconds);
  await advance(0);
  await page.screenshot({ path: testInfo.outputPath("aurora.png") });
  await advance(10_000);
  await expect(canvas).toHaveAttribute("data-flight-scenery", "cloud-passage");
  await page.screenshot({ path: testInfo.outputPath("clouds.png") });
  await advance(10_000);
  await expect(canvas).toHaveAttribute("data-flight-scenery", "starfield");
  await page.screenshot({ path: testInfo.outputPath("stars.png") });
  await advance(45_000);
  await expect.poll(async () => Number(await canvas.getAttribute("data-flight-loop"))).toBeGreaterThanOrEqual(6);
  await flight.getByRole("button", { name: "Quiet mode" }).press("Enter");
  await expect(flight.getByRole("region", { name: "Passive flight activity" })).toBeVisible();
  await flight.getByRole("button", { name: "Open flight" }).press("Enter");
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 35_000 });
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator(".result-surface")).toBeFocused();
  await expect(page.locator(".receipt")).toContainText("Less Walking");
});
