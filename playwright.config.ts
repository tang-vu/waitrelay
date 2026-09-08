import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // Keep timing assertions and axe scans from contending for a small CI runner.
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:3187",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: skipWebServer ? undefined : [
    {
      command: "node tests/e2e/support/openai-provider.mjs",
      url: "http://127.0.0.1:3188/models",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "pnpm exec next start --hostname 127.0.0.1 --port 3187",
      url: "http://127.0.0.1:3187/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        AGENT_BASE_URL: "http://127.0.0.1:3188",
        AGENT_API_KEY: "e2e-non-secret-placeholder",
        AGENT_MODEL: "e2e-provider-probe",
        ALLOW_FIXTURE_FALLBACK: "1",
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      testIgnore: ["**/mobile-touch.spec.ts"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-chromium",
      testMatch: ["**/mobile-touch.spec.ts", "**/accessibility.spec.ts", "**/result-experience.spec.ts", "**/recovery.spec.ts", "**/long-wait.spec.ts"],
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
});
