import { expect, test } from "@playwright/test";

test.describe("competition presentation", () => {
  test("mobile auto-scroll reveals the active flight and host ACK proof", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let releaseChoice!: () => void;
    const choiceMayContinue = new Promise<void>((resolve) => { releaseChoice = resolve; });
    await page.route("**/api/runs/*/choices", async (route) => {
      await choiceMayContinue;
      await route.continue();
    });

    await page.goto("/demo?scenario=standard&seed=competition-ui-001");
    await page.getByRole("button", { name: "Start the relay" }).click();

    const iframe = page.locator('iframe[title="WaitRelay Fork Flight"]');
    const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    await expect(flight.getByRole("button", { name: /Less Walking/ })).toBeVisible({ timeout: 4_000 });
    await flight.getByRole("button", { name: /Less Walking/ }).click();
    await expect.poll(async () => {
      const box = await iframe.boundingBox();
      return box ? box.y >= 0 && box.y < 844 : false;
    }).toBe(true);

    const relay = page.getByRole("region", { name: "Authoritative choice relay" });
    await expect(relay).toContainText("Less Walking relayed");
    await expect(relay).toContainText("Validation pending");
    await expect(relay).not.toContainText("Applied now");

    releaseChoice();
    await expect(relay).toContainText("Applied now");
    await expect(page.getByText("Stream connected", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 8_000 });
    await expect.poll(async () => (await page.locator(".result-surface").boundingBox())?.y ?? 999).toBeLessThan(24);
    await expect(page.getByRole("list", { name: "Computed causal proof path" })).toBeVisible();
  });
});
