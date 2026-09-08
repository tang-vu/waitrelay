import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const output = path.resolve("artifacts/demo");
const work = path.join(output, "work");
const baseUrl = (process.env.WAITRELAY_CAPTURE_BASE_URL ?? "https://waitrelay.tangvu.dev").replace(/\/$/, "");
const seed = "fork-flight-001";
const script = [
  { start: 0, end: 8, text: "Waiting can improve an AI answer. This is WaitRelay: Fork Flight.", caption: "WaitRelay: Fork Flight\nRecorded scenario data · actual browser capture" },
  { start: 8, end: 22, text: "This recorded Tokyo scenario keeps working while I choose less walking, then something surprising. Only the host's acknowledgement counts.", caption: "Less Walking → Surprising\nThe agent keeps working. Only an authoritative ACK counts." },
  { start: 22, end: 32, text: "The answer takes over immediately. Stops and costs come from the structured plan. Opening hours are recorded scenario data.", caption: "Completion takes over · the selected route is ready\nOpening hours are recorded scenario data, not live verification." },
  { start: 32, end: 46, text: "The Impact Receipt proves what changed. Accepted choices alter ranking weights and routes. The technical view records the signal and acknowledgement.", caption: "Impact Receipt: computed changes, recorded acknowledgements\nExpand the technical view to inspect the evidence." },
  { start: 46, end: 58, text: "This inspector shows the exact messages sent to the sandboxed game. The raw prompt and final answer stay outside that boundary.", caption: "Privacy Inspector: actual messages crossing the game boundary\nThe host processes the prompt; the game does not receive it." },
  { start: 58, end: 70, text: "The comparison uses the same scenario with different preferences. Both routes and their differences are computed from structured data.", caption: "Separate comparison: same scenario, different accepted preferences\nRoute differences are computed from structured plans." },
  { start: 70, end: 78, text: "A separate fast scenario goes straight to the answer. Flight Packs are an optional, non-transactional preview.", caption: "Separate 200 ms scenario · no full flight\nFlight Pack is an optional preview, with no transaction." },
  { start: 78, end: 90, text: "On mobile, the same seed works with touch. The choice is optional, and the agent still completes independently.", caption: "Separate mobile run · same seed · touch input\nThe wait is the second half of your prompt." },
];
const evidence = { recordedAt: new Date().toISOString(), baseUrl, seed, narration: "Microsoft Zira Desktop · synthetic English narration", scenes: [], errors: [] };

function command(binary, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "", stderr = "";
    process.stdout.on("data", (data) => { stdout += data; });
    process.stderr.on("data", (data) => { stderr += data; });
    process.on("error", reject);
    process.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(`${binary} failed (${code}): ${stderr.slice(-4000)}`)));
  });
}

async function duration(file) {
  return Number((await command("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file])).trim());
}

function observe(page, scene) {
  page.on("pageerror", (error) => evidence.errors.push(`${scene}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") evidence.errors.push(`${scene}: ${message.text()}`); });
}

function timeline() {
  const start = performance.now();
  return { elapsed: () => (performance.now() - start) / 1000, async at(seconds) {
    const remaining = seconds * 1000 - (performance.now() - start);
    if (remaining < -1200) throw new Error(`Recording missed the ${seconds}s scene boundary`);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  } };
}

async function scroll(page, selector) {
  await page.locator(selector).first().evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
}

await mkdir(work, { recursive: true });
await writeFile(path.join(work, "narration.json"), JSON.stringify(script, null, 2));
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] });
let desktop, mobile;
try {
  console.log("Recording desktop: one continuous causal run, then clearly separated scenes.");
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: work, size: { width: 1600, height: 900 } } });
  const anchor = performance.now();
  const page = await context.newPage();
  observe(page, "desktop");
  await page.goto(`${baseUrl}/demo?scenario=standard&seed=${seed}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Start the relay" })).toBeEnabled();
  const offset = (performance.now() - anchor) / 1000;
  const clock = timeline();
  evidence.scenes.push({ scene: "desktop", trimStart: offset, duration: 78 });
  await clock.at(8);
  const createdResponse = page.waitForResponse((response) => response.url().endsWith("/api/runs") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Start the relay" }).click();
  const created = await (await createdResponse).json();
  const flight = page.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  await flight.getByRole("button", { name: /Less Walking/ }).click({ timeout: 6000 });
  await expect(flight.getByText("Applied now")).toBeVisible();
  await flight.getByRole("button", { name: /Surprising/ }).click({ timeout: 6000 });
  await expect(flight.getByText("Applied now")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 9000 });
  const snapshot = await (await page.request.get(`${baseUrl}${created.snapshotUrl}`)).json();
  const complete = snapshot.events.find((event) => event.type === "run.complete");
  if (!complete || complete.impactReceipt.entries.length !== 2) throw new Error("Main recording must prove two applied choices");
  evidence.mainRun = { runId: created.runId, providerMode: complete.providerMode, completedAtVideoSeconds: clock.elapsed(), plan: complete.structuredResult, receipt: complete.impactReceipt };
  console.log("Both choices acknowledged; completion and receipt verified.");
  await clock.at(22);
  await scroll(page, ".result-surface");
  await clock.at(27);
  await scroll(page, ".route-stops");
  await clock.at(32);
  await scroll(page, ".receipt");
  await clock.at(38);
  await page.locator(".receipt details summary").first().click();
  await scroll(page, ".receipt-entry");
  await clock.at(46);
  await page.locator(".privacy-inspector summary").click();
  await scroll(page, ".proof-section");
  await clock.at(52);
  await scroll(page, ".privacy-inspector");
  await clock.at(58);
  await page.goto(`${baseUrl}/compare`, { waitUntil: "networkidle" });
  await scroll(page, ".comparison-grid");
  await clock.at(64);
  await scroll(page, ".comparison-proof");
  await clock.at(70);
  await page.goto(`${baseUrl}/demo?scenario=fast&seed=${seed}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start the relay" }).click();
  await expect(page.getByRole("heading", { name: "Your route is ready" })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await clock.at(75);
  await page.getByRole("button", { name: "Preview Flight Pack" }).click();
  await clock.at(78.5);
  const raw = await page.video().path();
  await context.close();
  desktop = { raw, offset };

  console.log("Recording a separate mobile run with touch input.");
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, recordVideo: { dir: work, size: { width: 390, height: 844 } } });
  const mobileAnchor = performance.now();
  const mobilePage = await mobileContext.newPage();
  observe(mobilePage, "mobile");
  await mobilePage.goto(`${baseUrl}/demo?scenario=standard&seed=${seed}`, { waitUntil: "networkidle" });
  const mobileOffset = (performance.now() - mobileAnchor) / 1000;
  const mobileClock = timeline();
  await mobilePage.getByRole("button", { name: "Start the relay" }).tap();
  const mobileFlight = mobilePage.frameLocator('iframe[title="WaitRelay Fork Flight"]');
  await mobileFlight.getByRole("button", { name: /Less Walking/ }).tap({ timeout: 6000 });
  await expect(mobileFlight.getByText("Applied now")).toBeVisible();
  await expect(mobilePage.getByRole("heading", { name: "Your route is ready" })).toBeVisible({ timeout: 9000 });
  evidence.scenes.push({ scene: "mobile", trimStart: mobileOffset, duration: 12, completedAtSceneSeconds: mobileClock.elapsed() });
  await mobileClock.at(12.5);
  const mobileRaw = await mobilePage.video().path();
  await mobileContext.close();
  mobile = { raw: mobileRaw, offset: mobileOffset };
} finally { await browser.close(); }
if (evidence.errors.length) throw new Error(`Browser recording errors: ${evidence.errors.join("; ")}`);
await writeFile(path.join(work, "capture.json"), JSON.stringify({ desktop, mobile, evidence }, null, 2));

console.log("Generating local synthetic narration.");
await command("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "ops/record-narration.ps1", "-WorkDirectory", work]);
for (const [index, segment] of script.entries()) {
  const seconds = await duration(path.join(work, `voice-${index}.wav`));
  if (seconds > segment.end - segment.start - 0.15) throw new Error(`Narration ${index} is too long: ${seconds}s`);
  segment.narrationDuration = seconds;
}
function timestamp(seconds, separator = ",") {
  return `00:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}${separator}000`;
}
await writeFile(path.join(output, "waitrelay-demo.srt"), script.map((segment, index) => `${index + 1}\n${timestamp(segment.start)} --> ${timestamp(segment.end)}\n${segment.caption}\n`).join("\n"));
await writeFile(path.join(output, "transcript.md"), `# WaitRelay demo transcript\n\nSynthetic narration: Microsoft Zira Desktop. Actual browser recordings of versioned scenario data. Main causal run is continuous; comparison, fast and mobile scenes are labeled separately.\n\n${script.map((segment) => `- ${segment.start}–${segment.end}s: ${segment.text}`).join("\n")}\n`);

const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,Arial,27,&H00F2FFF9,&H00FFFFFF,&H00140A05,&H00140A05,0,0,0,0,100,100,0,0,1,1,0,2,50,50,8,1\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${script.map((segment) => `Dialogue: 0,0:${String(Math.floor(segment.start / 60)).padStart(2, "0")}:${String(segment.start % 60).padStart(2, "0")}.00,0:${String(Math.floor(segment.end / 60)).padStart(2, "0")}:${String(segment.end % 60).padStart(2, "0")}.00,Default,,0,0,0,,${segment.caption.replaceAll("\n", "\\N")}`).join("\n")}\n`;
await writeFile(path.join(work, "captions.ass"), ass);

console.log("Encoding the 90-second MP4 with captions and narration.");
const args = ["-y", "-v", "error", "-i", desktop.raw, "-i", mobile.raw];
for (let index = 0; index < script.length; index++) args.push("-i", path.join(work, `voice-${index}.wav`));
const filters = [
  `[0:v]trim=start=${desktop.offset}:duration=78,setpts=PTS-STARTPTS,fps=30,scale=1792:1008,pad=1920:1080:64:0:color=0x050a14,setsar=1[d]`,
  `[1:v]trim=start=${mobile.offset}:duration=12,setpts=PTS-STARTPTS,fps=30,scale=-2:1008,pad=1920:1080:(ow-iw)/2:0:color=0x050a14,setsar=1[m]`,
  "[d][m]concat=n=2:v=1:a=0,ass=artifacts/demo/work/captions.ass[v]",
  ...script.map((segment, index) => `[${index + 2}:a]adelay=${segment.start * 1000}:all=1[a${index}]`),
  `${script.map((_, index) => `[a${index}]`).join("")}amix=inputs=${script.length}:normalize=0,apad,atrim=duration=90[a]`,
];
args.push("-filter_complex", filters.join(";"), "-map", "[v]", "-map", "[a]", "-t", "90", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", path.join(output, "waitrelay-demo.mp4"));
await command("ffmpeg", args);
const probe = JSON.parse(await command("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", path.join(output, "waitrelay-demo.mp4")]));
if (Math.abs(Number(probe.format.duration) - 90) > 0.2) throw new Error("Final video is not 90 seconds");
evidence.output = { duration: Number(probe.format.duration), width: probe.streams[0].width, height: probe.streams[0].height, bytes: Number(probe.format.size) };
evidence.script = script;
await writeFile(path.join(output, "evidence.json"), JSON.stringify(evidence, null, 2));
console.log(`Ready for review: ${path.join(output, "waitrelay-demo.mp4")}`);
