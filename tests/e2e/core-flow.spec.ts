import { expect, test } from "@playwright/test";

const canary = "PROMPT_CANARY_7f2c91";

test("late iframe initialization still receives the current gate after handshake retry", async ({ page }) => {
  await page.addInitScript(() => {
    if (window === window.top) return;
    const add = window.addEventListener.bind(window);
    window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      if (type === "message") setTimeout(() => add(type, listener, options), 900);
      else add(type, listener, options);
    }) as typeof window.addEventListener;
  });
  await page.goto("/demo?scenario=standard&seed=delayed-flight-listener");
  await page.getByRole("button", { name: "Start the relay" }).click();
  const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  const choice = flight.getByRole("button", { name: /Less Walking/ });
  await expect(choice).toBeVisible({ timeout: 4_000 });
  await choice.click();
  await expect(flight.getByText("Applied now")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 9_000 });
});

test.describe("Fork Flight causal loop", () => {
  test("an 8-second run applies two choices and reveals a computed receipt", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    await page.goto("/demo?scenario=standard&seed=fork-flight-001");
    await expect(page.getByText("Demo Provider", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /second half/i })).toBeVisible();
    await page.getByRole("button", { name: "Start the relay" }).click();
    const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    await expect(flight.getByRole("button", { name: /Less Walking/ })).toBeVisible({ timeout: 4_000 });
    await flight.getByRole("button", { name: /Less Walking/ }).click();
    await expect(flight.getByText("Applied now")).toBeVisible();
    await expect(flight.getByRole("button", { name: /Surprising/ })).toBeVisible({ timeout: 4_000 });
    await flight.getByRole("button", { name: /Surprising/ }).click();
    await expect(flight.getByText("Applied now")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 7_000 });
    const takeoverMs = await page.evaluate(() => performance.getEntriesByName("waitrelay-completion-takeover", "measure").at(-1)?.duration);
    expect(takeoverMs).toBeDefined();
    expect(takeoverMs).toBeLessThan(250);
    await expect(page.getByRole("heading", { name: "Impact Receipt" })).toBeVisible();
    await expect(page.getByText("Plan changed")).toBeVisible();
    await expect(page.getByText("Less Walking", { exact: true })).toBeVisible();
    await expect(page.getByText("Surprising", { exact: true })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("a 200 ms result never mounts the full flight", async ({ page }) => {
    await page.goto("/demo?scenario=fast&seed=fast-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 2_000 });
    await expect(page.locator('iframe[title="WaitRelay Fork Flight"]')).toHaveCount(0);
  });

  test("dismiss activity leaves the agent running", async ({ page }) => {
    await page.goto("/demo?scenario=standard&seed=dismiss-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    await expect(page.locator('iframe[title="WaitRelay Fork Flight"]')).toBeVisible({ timeout: 2_500 });
    await page.getByRole("button", { name: "Dismiss activity" }).click();
    await expect(page.getByText("Activity dismissed")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 9_000 });
  });

  test("cancel is separate and terminal", async ({ page }) => {
    await page.goto("/demo?scenario=cancel&seed=cancel-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    await expect(page.getByRole("button", { name: "Cancel AI run" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel AI run" }).click();
    await expect(page.getByRole("heading", { name: "The flight and agent stopped." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toHaveCount(0);
  });

  test("privacy canary never appears in the game, inspector, or storage", async ({ page }) => {
    const consoleMessages: string[] = [];
    const flightRequests: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    page.on("request", (request) => {
      if (request.frame().url().includes("/flight")) flightRequests.push(`${request.url()} ${request.postData() ?? ""}`);
    });
    await page.goto("/demo?scenario=standard&seed=privacy-001");
    await page.getByLabel("What should the agent plan?").fill(`Plan a Tokyo date. ${canary}`);
    await page.getByRole("button", { name: "Start the relay" }).click();
    const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    await expect(flight.getByText("Choose a current")).toBeVisible({ timeout: 4_000 });
    await expect(page.locator('iframe[title="WaitRelay Fork Flight"]')).toHaveAttribute("sandbox", "allow-scripts");
    const flightDocument = await page.request.get("/flight");
    expect(flightDocument.headers()["content-security-policy"]).toContain("connect-src 'none'");
    expect(await flight.locator("body").innerText()).not.toContain(canary);
    const storage = await page.evaluate(async () => ({
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
      databases: "databases" in indexedDB ? (await indexedDB.databases()).map((db) => db.name).join(",") : "",
      url: location.href,
    }));
    expect(JSON.stringify(storage)).not.toContain(canary);
    await page.getByText("Privacy Inspector").click();
    const inspector = page.locator(".privacy-inspector");
    expect(await inspector.innerText()).not.toContain(canary);
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 8_000 });
    expect(await page.locator(".flight-card").innerText()).not.toContain(canary);
    expect(consoleMessages.join("\n")).not.toContain(canary);
    expect(flightRequests.join("\n")).not.toContain(canary);
    expect(flightRequests.some((request) => /analytics|telemetry/i.test(request))).toBe(false);
  });

  test("keyboard selection waits for the matching ACK", async ({ page }) => {
    await page.goto("/demo?scenario=standard&seed=keyboard-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    const frame = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    await expect(frame.getByRole("button", { name: /Less Walking/ })).toBeVisible({ timeout: 3_000 });
    const firstChoice = frame.getByRole("button", { name: /Less Walking/ });
    await firstChoice.focus();
    await page.keyboard.press("ArrowUp");
    await expect(frame.getByText("Applied now")).toBeVisible();
  });

  test("pending feedback appears before a deliberately delayed authoritative ACK", async ({ page }) => {
    let releaseChoice!: () => void;
    const choiceMayContinue = new Promise<void>((resolve) => { releaseChoice = resolve; });
    await page.route("**/api/runs/*/choices", async (route) => {
      await choiceMayContinue;
      await route.continue();
    });
    await page.goto("/demo?scenario=standard&seed=pending-ack-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    const frame = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    const choice = frame.getByRole("button", { name: /Less Walking/ });
    await expect(choice).toBeVisible({ timeout: 4_000 });
    await choice.click();
    await expect(frame.getByText("Waiting for agent confirmation")).toBeVisible();
    await expect(frame.getByText("Applied now")).toHaveCount(0);
    releaseChoice();
    await expect(frame.getByText("Applied now")).toBeVisible();
  });

  test("skip preserves defaults and normal completion", async ({ page }) => {
    await page.goto("/demo?scenario=standard&seed=skip-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    const frame = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    await expect(frame.getByRole("button", { name: "Skip choice" })).toBeVisible({ timeout: 3_000 });
    await frame.getByRole("button", { name: "Skip choice" }).click();
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 9_000 });
    await expect(page.getByText("Defaults carried the run.")).toBeVisible();
    await expect(page.getByText("No material change")).toBeVisible();
  });

  test("completion takes focus while a gate is still active", async ({ page }) => {
    await page.goto("/demo?scenario=two-second&seed=active-completion-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    const frame = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    await expect(frame.getByRole("button", { name: /Less Walking/ })).toBeVisible({ timeout: 3_000 });
    const result = page.getByRole("heading", { name: "Your route is ready" });
    await expect(result).toBeVisible({ timeout: 4_000 });
    await expect(page.locator('iframe[title="WaitRelay Fork Flight"]')).toHaveCount(0);
    await expect(page.locator(".result-surface")).toBeFocused();
  });

  test("a post-lock choice is labelled too late and never enters the receipt", async ({ page }) => {
    await page.goto("/demo?scenario=late&seed=late-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    const frame = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    const lateChoice = frame.getByRole("button", { name: /Less Walking/ });
    await expect(lateChoice).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("heading", { name: "Verifying" })).toBeVisible({ timeout: 7_000 });
    await lateChoice.click();
    await expect(frame.getByText("Too late for this run")).toBeVisible({ timeout: 2_000 });
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Defaults carried the run.")).toBeVisible();
  });

  test("game iframe failure cannot block the answer", async ({ page }) => {
    await page.goto("/demo?scenario=standard&seed=failure-001&fault=iframe-failure");
    await page.getByRole("button", { name: "Start the relay" }).click();
    await expect(page.getByText("Flight unavailable")).toBeVisible({ timeout: 4_000 });
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 10_000 });
  });

  test("snapshot polling completes the run when SSE is unavailable", async ({ page }) => {
    await page.route("**/api/runs/*/events", async (route) => route.abort("connectionfailed"));
    await page.goto("/demo?scenario=two-second&seed=polling-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    await expect(page.getByText("Polling fallback", { exact: true })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 5_000 });
  });

  test("native SSE reconnect resumes from Last-Event-ID", async ({ page }) => {
    await page.goto("/demo?scenario=standard&seed=reconnect-001&fault=sse-reconnect");
    await page.getByRole("button", { name: "Start the relay" }).click();
    await expect(page.getByText("SSE reconnected and replayed only events after Last-Event-ID.")).toBeVisible({ timeout: 7_000 });
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 6_000 });
  });

  test("provider failure exits safely without leaking the internal error", async ({ page }) => {
    await page.goto("/demo?scenario=error&seed=error-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    await expect(page.getByRole("heading", { name: "The provider did not complete this run." })).toBeVisible({ timeout: 4_000 });
    await expect(page.getByText("controlled-provider-failure")).toHaveCount(0);
    await expect(page.locator('iframe[title="WaitRelay Fork Flight"]')).toHaveCount(0);
  });

  test("a configured live provider is visibly labelled", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start the relay" }).click();
    await expect(page.getByText("Live Provider", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Live Provider", { exact: true })).toBeVisible();
  });

  test("live failure is visibly relabelled as Fallback Replay", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("What should the agent plan?").fill("Plan the flagship Tokyo route. fallback-provider-probe");
    const startResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/runs") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Start the relay" }).click();
    const startPayload = await (await startResponsePromise).json() as { providerMode: string };
    expect(startPayload.providerMode).toBe("live");
    await expect(page.getByText("Fallback Replay", { exact: true })).toBeVisible({ timeout: 4_000 });
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 10_000 });
  });

  test("choice transport failure never fabricates an ACK or blocks completion", async ({ page }) => {
    await page.route("**/api/runs/*/choices", async (route) => route.abort("connectionfailed"));
    await page.goto("/demo?scenario=standard&seed=choice-network-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    await expect(flight.getByRole("button", { name: /Less Walking/ })).toBeVisible({ timeout: 4_000 });
    // Dispatch the user-facing click after the actionability assertion. The
    // expected fetch failure intentionally tears down the iframe immediately,
    // which can detach the button before Playwright's click bookkeeping ends.
    await flight.getByRole("button", { name: /Less Walking/ }).dispatchEvent("click");
    await expect(page.getByText("Choice confirmation was interrupted.", { exact: false })).toBeVisible();
    await expect(page.getByText("Activity dismissed")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 9_000 });
    await expect(page.getByText("Defaults carried the run.")).toBeVisible();
  });

  test("a committed choice with a lost response defers to the authoritative receipt", async ({ page }) => {
    await page.route("**/api/runs/*/choices", async (route) => {
      await route.fetch();
      await route.abort("connectionfailed");
    });
    await page.goto("/demo?scenario=standard&seed=ambiguous-choice-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
    const choice = flight.getByRole("button", { name: /Less Walking/ });
    await expect(choice).toBeVisible({ timeout: 4_000 });
    await choice.dispatchEvent("click");
    await expect(page.getByText("final Impact Receipt is authoritative", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 9_000 });
    await expect(page.getByRole("heading", { name: "Impact Receipt" })).toBeVisible();
    await expect(page.getByText("Less Walking", { exact: true })).toBeVisible();
    await expect(page.getByText("Defaults carried the run.")).toHaveCount(0);
  });

  test("failed cancellation stays unconfirmed while the agent completes", async ({ page }) => {
    await page.route("**/api/runs/*/cancel", async (route) => route.abort("connectionfailed"));
    await page.goto("/demo?scenario=two-second&seed=cancel-network-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    await page.getByRole("button", { name: "Cancel AI run" }).click();
    await expect(page.getByText("Cancellation confirmation was interrupted.", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 4_000 });
    await expect(page.getByRole("heading", { name: "The flight and agent stopped." })).toHaveCount(0);
  });

  test("temporary browser offline state does not stop server completion", async ({ page, context }) => {
    await page.goto("/demo?scenario=two-second&seed=offline-001");
    await page.getByRole("button", { name: "Start the relay" }).click();
    await expect(page.locator('iframe[title="WaitRelay Fork Flight"]')).toBeVisible({ timeout: 2_500 });
    await context.setOffline(true);
    await expect(page.getByText("Stream offline", { exact: true })).toBeVisible();
    await page.waitForTimeout(2_400);
    await context.setOffline(false);
    await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 5_000 });
  });
});
