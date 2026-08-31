import { expect, test } from "@playwright/test";

test("Fault Lab distinguishes interactive probes from executable protocol evidence", async ({ page }) => {
  await page.goto("/fault-lab?probe=duplicate&scenario=standard#probe-runner");
  const duplicate = page.getByRole("link", { name: /Duplicate signal/ });
  await expect(duplicate).toHaveAttribute("aria-current", "true");
  await expect(page.getByText("Executable evidence:")).toBeVisible();
  await expect(page.getByText("tests/unit/memory-run-store.test.ts", { exact: false })).toBeVisible();

  await page.goto("/fault-lab?probe=sensitive&scenario=standard&fault=sensitive#probe-runner");
  await expect(page.getByRole("link", { name: /Sensitive mode/ })).toHaveAttribute("aria-current", "true");
  await expect(page.getByLabel("Sensitive mode generic capsule")).toBeChecked();
  await expect(page.getByText("Sensitive Mode is preselected.", { exact: false })).toBeVisible();
});
