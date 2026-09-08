import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("busy service explains the failure, preserves the task, and supports retry", async ({ page }) => {
  await page.route("**/api/runs", (route) => route.fulfill({
    status: 429, contentType: "application/json", body: JSON.stringify({ error: "PRIVATE_PROVIDER_CANARY" }),
  }));
  await page.goto("/demo?scenario=fast&seed=busy-retry");
  const prompt = page.getByRole("textbox", { name: "What should the agent plan?" });
  const task = await prompt.inputValue();
  await page.getByRole("button", { name: "Start the relay" }).click();
  const failure = page.getByRole("region", { name: "The run could not be started." });
  await expect(failure).toBeFocused();
  await expect(failure).toContainText("The run service is busy");
  await expect(page.locator("body")).not.toContainText("PRIVATE_PROVIDER_CANARY");
  await failure.getByRole("button", { name: "Edit task and try again" }).click();
  await expect(prompt).toBeFocused();
  await expect(prompt).toHaveValue(task);
  await page.unroute("**/api/runs");
  await page.getByRole("button", { name: "Start the relay" }).click();
  await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible();
});

test("lost server state exits waiting and allows a fresh run", async ({ page }) => {
  await page.route("**/api/runs/*/events", (route) => route.abort());
  await page.route("**/api/runs/*/snapshot", (route) => route.fulfill({ status: 404, body: "Run not found" }));
  await page.goto("/demo?scenario=fast&seed=lost-run");
  await page.getByRole("button", { name: "Start the relay" }).click();
  const unavailable = page.getByRole("region", { name: "This run is no longer available." });
  await expect(unavailable).toBeFocused();
  await expect(page.getByRole("region", { name: "Active agent run" })).toHaveCount(0);
  await expect(unavailable).toContainText("may have expired");
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  await page.unroute("**/api/runs/*/events");
  await page.unroute("**/api/runs/*/snapshot");
  await unavailable.getByRole("button", { name: "Edit task and try again" }).click();
  await page.getByRole("button", { name: "Start the relay" }).click();
  await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible();
});

test("missing EventSource still reaches a result through snapshots", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "EventSource", { value: undefined }); });
  await page.goto("/demo?scenario=fast&seed=unsupported-stream");
  await page.getByRole("button", { name: "Start the relay" }).click();
  await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible();
  await expect(page.getByText("Stream idle", { exact: true })).toBeVisible();
});

test("unknown routes offer accessible navigation back to the product", async ({ page }) => {
  const response = await page.goto("/missing-relay-route");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This route does not exist." })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Back to the workspace" }).click();
  await expect(page.getByRole("button", { name: "Start the relay" })).toBeVisible();
});
