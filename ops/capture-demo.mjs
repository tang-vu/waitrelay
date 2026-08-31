import { chromium } from "@playwright/test";

const baseUrl = (process.env.WAITRELAY_CAPTURE_BASE_URL ?? "https://waitrelay.tangvu.dev").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`${label}: ${error.message}`));
}

async function mainStory() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page, "gate story");
  await page.goto(`${baseUrl}/demo?scenario=long&seed=fork-flight-capture`, { waitUntil: "networkidle" });
  await page.screenshot({ path: "demo/empty-final.png" });

  let releaseChoice;
  const choiceMayContinue = new Promise((resolve) => { releaseChoice = resolve; });
  await page.route("**/api/runs/*/choices", async (route) => {
    await choiceMayContinue;
    await route.continue();
  });

  await page.getByRole("button", { name: "Start the relay" }).click();
  const frame = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  const firstChoice = frame.getByRole("button", { name: /Less Walking/ });
  await firstChoice.waitFor({ state: "visible", timeout: 6_000 });
  await page.screenshot({ path: "demo/active-gate-final.png" });
  // Dispatch directly so a slow screenshot cannot lose the short first-gate
  // element during Playwright's actionability bookkeeping.
  await firstChoice.dispatchEvent("click");
  await page.getByRole("region", { name: "Authoritative choice relay" }).getByText("Validation pending", { exact: true }).waitFor();
  await page.screenshot({ path: "demo/pending-ack-final.png" });
  releaseChoice();
  await frame.getByText("Applied now").waitFor({ state: "visible", timeout: 4_000 });
  await page.screenshot({ path: "demo/applied-ack-final.png" });
  await page.close();

  const resultPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(resultPage, "result story");
  await resultPage.goto(`${baseUrl}/demo?scenario=standard&seed=fork-flight-001`, { waitUntil: "networkidle" });
  await resultPage.getByRole("button", { name: "Start the relay" }).click();
  const resultFrame = resultPage.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  const resultFirstChoice = resultFrame.getByRole("button", { name: /Less Walking/ });
  await resultFirstChoice.waitFor({ state: "visible", timeout: 6_000 });
  await resultFirstChoice.dispatchEvent("click");
  await resultFrame.getByText("Applied now").waitFor({ state: "visible", timeout: 4_000 });
  const secondChoice = resultFrame.getByRole("button", { name: /Surprising/ });
  await secondChoice.waitFor({ state: "visible", timeout: 6_000 });
  await secondChoice.dispatchEvent("click");
  await resultPage.getByRole("heading", { name: "Your route is ready" }).waitFor({ state: "visible", timeout: 8_000 });
  for (const summary of await resultPage.locator(".receipt details summary").all()) await summary.click();
  await resultPage.screenshot({ path: "demo/result-receipt-final.png", fullPage: true });

  await resultPage.locator(".privacy-inspector summary").click();
  await resultPage.locator(".privacy-inspector").scrollIntoViewIfNeeded();
  await resultPage.screenshot({ path: "demo/privacy-inspector-final.png" });
  await resultPage.close();
}

async function mobileStory() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  watch(page, "mobile story");
  await page.goto(`${baseUrl}/demo?scenario=standard&seed=mobile-final-001`, { waitUntil: "networkidle" });
  await page.screenshot({ path: "demo/mobile-empty-final.png" });
  await page.getByRole("button", { name: "Start the relay" }).tap();
  const frame = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  const choice = frame.getByRole("button", { name: /Less Walking/ });
  await choice.waitFor({ state: "visible", timeout: 6_000 });
  await choice.tap();
  await frame.getByText("Applied now").waitFor({ state: "visible", timeout: 4_000 });
  await page.screenshot({ path: "demo/mobile-applied-final.png" });
  await page.close();
}

async function reducedMotionStory() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  watch(page, "reduced motion");
  await page.goto(`${baseUrl}/demo?scenario=standard&seed=reduced-final-001`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start the relay" }).click();
  const frame = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  await frame.getByRole("button", { name: /Less Walking/ }).waitFor({ state: "visible", timeout: 6_000 });
  await page.screenshot({ path: "demo/reduced-motion-final.png" });
  await page.close();
}

async function terminalProofs() {
  const cases = [
    { name: "fast-completion-final.png", path: "/demo?scenario=fast&seed=fast-final-001", heading: "Your route is ready", timeout: 4_000 },
    { name: "provider-failure-final.png", path: "/demo?scenario=error&seed=error-final-001", heading: "The provider did not complete this run.", timeout: 5_000 },
  ];
  for (const item of cases) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    watch(page, item.name);
    await page.goto(`${baseUrl}${item.path}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Start the relay" }).click();
    await page.getByRole("heading", { name: item.heading }).waitFor({ state: "visible", timeout: item.timeout });
    await page.screenshot({ path: `demo/${item.name}` });
    await page.close();
  }

  const late = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(late, "late ACK");
  await late.goto(`${baseUrl}/demo?scenario=late&seed=late-final-001`, { waitUntil: "networkidle" });
  await late.getByRole("button", { name: "Start the relay" }).click();
  const frame = late.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  const choice = frame.getByRole("button", { name: /Less Walking/ });
  await choice.waitFor({ state: "visible", timeout: 6_000 });
  await late.getByRole("heading", { name: "Verifying" }).waitFor({ state: "visible", timeout: 7_000 });
  await choice.dispatchEvent("click");
  await frame.getByText("Too late for this run").waitFor({ state: "visible", timeout: 3_000 });
  await late.screenshot({ path: "demo/late-choice-final.png" });
  await late.close();
}

async function evidencePages() {
  for (const item of [
    { path: "/compare", output: "demo/compare-final.png" },
    { path: "/fault-lab", output: "demo/fault-lab-updated.png" },
  ]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    watch(page, item.path);
    await page.goto(`${baseUrl}${item.path}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: item.output, fullPage: true });
    await page.close();
  }
}

try {
  await mainStory();
  await mobileStory();
  await reducedMotionStory();
  await terminalProofs();
  await evidencePages();
  if (consoleErrors.length > 0) throw new Error(`Browser errors:\n${consoleErrors.join("\n")}`);
  console.log(`Captured final submission states from ${baseUrl}`);
} finally {
  await browser.close();
}
