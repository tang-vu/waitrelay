import { expect, test } from "@playwright/test";

test.describe("Mobile and alternate modes", () => {
  test("reduced motion can make the same choice", async ({ page }) => {
    await page.goto("/demo?scenario=standard&seed=reduced-001");
    await page.getByText("Reduced motion", { exact: false }).click();
    await page.getByRole("button", { name: "Start the relay" }).click();
    const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    await expect(flight.getByRole("region", { name: "Reduced motion flight" })).toBeVisible({ timeout: 3_000 });
    await flight.getByRole("button", { name: /Less Walking/ }).click();
    await expect(flight.getByText("Applied now")).toBeVisible();
  });

  test("passive mode never requires interaction", async ({ page }) => {
    await page.goto("/demo?scenario=two-second&seed=passive-001");
    await page.getByText("Passive mode", { exact: false }).click();
    await page.getByRole("button", { name: "Start the relay" }).click();
    const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    await expect(flight.getByRole("region", { name: "Passive flight activity" })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 4_000 });
  });

  test("sensitive mode sends generic game state and disables sharing", async ({ page }) => {
    await page.goto("/demo?scenario=standard&seed=sensitive-secret&fault=sensitive");
    await page.getByRole("button", { name: "Start the relay" }).click();
    const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    await expect(flight.getByRole("button", { name: /Practical/ })).toBeVisible({ timeout: 4_000 });
    await expect(flight.locator("[data-flight-sensitive=true]")).toBeVisible();
    await flight.getByRole("button", { name: /Practical/ }).click();
    await expect(flight.getByText("Applied now")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("Private courier", { exact: false })).toBeVisible();
    await expect(page.getByText("Sharing off")).toBeVisible();
    await page.getByText("Privacy Inspector").click();
    await expect(page.locator(".privacy-inspector")).toContainText("private-flight");
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe("{}");
    await page.getByRole("button", { name: "Preview Flight Pack" }).click();
    await page.getByRole("button", { name: "Use for this preview" }).click();
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe("{}");
  });

  test("post-run Flight Pack remains a non-transactional preview", async ({ page }) => {
    await page.goto("/demo?scenario=fast&seed=pack-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 2_000 });
    const preview = page.getByRole("button", { name: "Preview Flight Pack" });
    await preview.click();
    const dialog = page.getByRole("dialog", { name: "Choose a cosmetic flight style" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("No transaction", { exact: false })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Buy|Purchase|Checkout/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(preview).toBeFocused();
  });

  test("computed split-screen comparison is usable on desktop", async ({ page }) => {
    await page.goto("/compare?seed=compare-e2e-001");
    await expect(page.getByRole("heading", { name: "Two flights. Two traceable routes." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Compact and reliable" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Discovery and surprise" })).toBeVisible();
    await expect(page.getByRole("row", { name: /Approximate route/ })).toBeVisible();
    await expect(page.getByText("Deterministic scenario data", { exact: false })).toBeVisible();
  });
});
