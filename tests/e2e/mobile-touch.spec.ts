import { expect, test } from "@playwright/test";

test("touch-sized controls work at 390 by 844", async ({ page }) => {
  await page.goto("/demo?scenario=standard&seed=touch-001");
  await page.getByRole("button", { name: "Start the relay" }).tap();
  const flightFrame = page.locator('iframe[title="WaitRelay Fork Flight"]');
  await expect(flightFrame).toBeVisible();
  const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  const choice = flight.locator("button").filter({ hasText: "Less Walking" });
  const height = await choice.evaluate((element) => {
    const measuredHeight = element.getBoundingClientRect().height;
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" }));
    (element as HTMLButtonElement).click();
    return measuredHeight;
  });
  expect(height).toBeGreaterThanOrEqual(44);
  await expect(flight.getByText("Applied now")).toBeVisible();
});

test("mobile navigation stays reachable without page-level overflow", async ({ page }) => {
  await page.goto("/demo?scenario=fast&seed=mobile-nav-001");
  for (const name of ["Seeded demo", "Compare", "Fault Lab", "Privacy"]) {
    const link = page.getByRole("link", { name });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.goto("/compare");
  const tableRegion = page.getByRole("region", { name: "Scrollable comparison metrics" });
  await expect(tableRegion).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
