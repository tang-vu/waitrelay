// Offline rendering only. Supply WAVs and MiMo TTS/ASR receipts from an interactive session.
import { readFile, writeFile, copyFile, rename } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const output = path.resolve("artifacts/demo");
const voices = path.resolve(process.argv[2] ?? "artifacts/demo/mimo");
const video = path.join(output, "waitrelay-demo.mp4");
const candidate = path.join(output, "waitrelay-demo-mimo.mp4");
const evidence = JSON.parse(await readFile(path.join(output, "evidence.json"), "utf8"));
const script = JSON.parse(await readFile(path.join(output, "work/narration.json"), "utf8"));

function command(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(`${binary} failed (${code}): ${stderr.slice(-2000)}`)));
  });
}

function words(text) {
  // Preserve raw ASR in the report. Ignore only known response tags, punctuation,
  // UK/US spelling, and the brand's homophonic transcription.
  return text.toLowerCase().replace(/^(?:\s*(?:think>|<chinese>))+/g, "")
    .replaceAll("acknowledgement", "acknowledgment")
    .replace(/\b(?:waitrelay|weight relay|wait relay)\b/g, "wait relay")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

const report = { provider: "Xiaomi MiMo", model: "mimo-v2.5-tts", voice: "Mia", asrModel: "mimo-v2.5-asr", renderedAt: new Date().toISOString(), segments: [] };
for (const [index, segment] of script.entries()) {
  const wav = path.join(voices, `voice-${index}.wav`);
  const tts = JSON.parse(await readFile(path.join(voices, `tts-${index}.json`), "utf8"));
  const asr = JSON.parse(await readFile(path.join(voices, `asr-${index}.json`), "utf8"));
  if (tts.text !== segment.text || asr.expected !== segment.text || tts.voice !== report.voice || tts.model !== report.model || asr.model !== report.asrModel) throw new Error(`Segment ${index}: metadata mismatch`);
  if (words(asr.transcript) !== words(segment.text)) throw new Error(`Segment ${index}: ASR does not match script; inspect the raw transcript`);
  const seconds = Number((await command("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", wav])).trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`Segment ${index}: invalid audio duration`);
  const slot = segment.end - segment.start - 0.4;
  const tempo = Math.max(1, seconds / slot);
  if (tempo > 1.2) throw new Error(`Segment ${index}: regenerate speech; too long for natural pacing`);
  report.segments.push({ index, text: segment.text, rawTranscript: asr.transcript, normalizedMatch: true, originalDuration: seconds, tempo, narrationDuration: seconds / tempo, start: segment.start + 0.2, end: segment.start + 0.2 + seconds / tempo });
}

// Normalize each clip separately so loudnorm's internal sample rate cannot
// change the time base of another input in the mixing graph.
const mixArgs = ["-y", "-v", "error"];
for (const segment of report.segments) {
  const processed = path.join(voices, `processed-${segment.index}.wav`);
  await command("ffmpeg", ["-y", "-v", "error", "-i", path.join(voices, `voice-${segment.index}.wav`), "-af", `atempo=${segment.tempo},loudnorm=I=-16:TP=-1.5:LRA=7`, "-ar", "48000", "-ac", "1", processed]);
  mixArgs.push("-i", processed);
}
const filters = report.segments.map((segment, index) => `[${index}:a]adelay=${Math.round(segment.start * 1000)}:all=1[a${index}]`);
filters.push(`${script.map((_, index) => `[a${index}]`).join("")}amix=inputs=${script.length}:normalize=0,apad,atrim=duration=90[a]`);
const narration = path.join(voices, "narration.wav");
mixArgs.push("-filter_complex", filters.join(";"), "-map", "[a]", "-ar", "48000", "-c:a", "pcm_s16le", narration);
await command("ffmpeg", mixArgs);
await command("ffmpeg", ["-y", "-v", "error", "-i", video, "-i", narration, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", "90", "-movflags", "+faststart", candidate]);
await command("ffmpeg", ["-v", "error", "-i", candidate, "-f", "null", "-"]);
const probe = JSON.parse(await command("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", candidate]));
const videoStream = probe.streams.find((stream) => stream.codec_type === "video");
const audioStream = probe.streams.find((stream) => stream.codec_type === "audio");
if (Math.abs(Number(probe.format.duration) - 90) > 0.1 || videoStream?.width !== 1920 || videoStream?.height !== 1080 || !audioStream || Math.abs(Number(audioStream.start_time)) > 0.05 || Math.abs(Number(audioStream.duration) - 90) > 0.1) throw new Error("Invalid rendered video or audio timestamps");
const pcmPath = path.join(voices, "final-audio.pcm");
await command("ffmpeg", ["-y", "-v", "error", "-i", candidate, "-vn", "-ar", "48000", "-ac", "1", "-f", "s16le", pcmPath]);
const pcm = await readFile(pcmPath);
for (const segment of report.segments) {
  let energy = 0, samples = 0;
  for (let sample = Math.floor(segment.start * 48000); sample < Math.min(Math.floor(segment.end * 48000), pcm.length / 2); sample++) {
    energy += (pcm.readInt16LE(sample * 2) / 32768) ** 2;
    samples++;
  }
  segment.finalRmsDb = 10 * Math.log10(energy / samples);
  if (!Number.isFinite(segment.finalRmsDb) || segment.finalRmsDb < -40) throw new Error(`Segment ${segment.index}: final audio is silent or too quiet`);
}
// Keep the previous deliverable and evidence before replacing a verified candidate.
const backupSuffix = new Date().toISOString().replace(/[:.]/g, "-");
await copyFile(video, path.join(output, `waitrelay-demo-before-mimo-${backupSuffix}.mp4`), 1);
await copyFile(path.join(output, "evidence.json"), path.join(output, `evidence-before-mimo-${backupSuffix}.json`), 1);
await rename(candidate, video);
evidence.narration = "Xiaomi MiMo mimo-v2.5-tts / Mia · synthetic English narration";
evidence.narrationVerification = report;
evidence.script = script.map((segment, index) => ({ ...segment, narrationDuration: report.segments[index].narrationDuration }));
evidence.output = { duration: Number(probe.format.duration), width: videoStream.width, height: videoStream.height, bytes: Number(probe.format.size) };
await writeFile(path.join(output, "evidence.json"), JSON.stringify(evidence, null, 2));
await writeFile(path.join(voices, "verification.json"), JSON.stringify(report, null, 2));
await writeFile(path.join(output, "transcript.md"), `# WaitRelay demo transcript\n\nSynthetic English narration: Xiaomi MiMo mimo-v2.5-tts, voice Mia. Checked with mimo-v2.5-asr; raw transcripts and normalization rules are preserved in evidence.json. Actual browser footage and captions are unchanged.\n\n${script.map((segment) => `- ${segment.start}–${segment.end}s: ${segment.text}`).join("\n")}\n`);
console.log(JSON.stringify({ video, output: evidence.output, voice: report.voice, verifiedSegments: report.segments.length }, null, 2));
