import { expect, test } from "@playwright/test";

test("seeded judge path reaches a causal receipt without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo?scenario=standard&seed=fork-flight-001");
  await page.getByRole("button", { name: "Start the relay" }).click();
  const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  await expect(flight.getByRole("button", { name: /Less Walking/ })).toBeVisible({ timeout: 4_000 });
  await flight.getByRole("button", { name: /Less Walking/ }).click();
  await expect(flight.getByText("Applied now")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 9_000 });
  await expect(page.getByRole("heading", { name: "Impact Receipt" })).toBeVisible();
  expect(errors).toEqual([]);
});
