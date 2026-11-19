import {existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {availableParallelism} from "node:os";
import {parseArgs} from "node:util";
import {bundle} from "@remotion/bundler";
import {openBrowser, renderMedia, renderStill, selectComposition} from "@remotion/renderer";
import {COMPOSITION, FADE_FRAMES, FPS, HEIGHT, MAX_DOCUMENTARY_SECONDS, WIDTH} from "../src/timeline.mjs";
import {prepareAudio} from "./audio.mjs";
import {generateStoryboard} from "./generate-storyboard.mjs";
import {atomicWrite, audioDuration, capture, checkLocalAsset, command, ffmpeg, hash, probe, readJson, root, validateStoryboard, writeJson} from "./project.mjs";

const sample = join(root, "storyboards/ocean.json");
const usage = `Usage: ./scripts/create-video.sh "Topic" [--output output/topic.mp4]
       ./scripts/create-video.sh --storyboard storyboards/ocean.json [--require-voice]
       Options: --duration SECONDS  --brief FILE  --silent  --prepare-only  --previews-only  --concurrency N  --force
       Existing generated storyboards and measured narration are reused on retry.`;

function assetCheck(storyboard) {
  for (const {image} of storyboard.scenes) {
    if (image && !probe(checkLocalAsset(image.path)).streams.some(({codec_type}) => codec_type === "video")) {
      throw new Error(`Could not decode image ${image.path}`);
    }
  }
  for (const cue of new Set(storyboard.scenes.map((scene) => scene.soundDesign?.cue).filter(Boolean))) {
    audioDuration(checkLocalAsset(cue));
  }
  if (storyboard.music) audioDuration(checkLocalAsset(storyboard.music.path));
}

function srtTime(frame) {
  const ms = Math.round(frame / FPS * 1000);
  const part = (value, digits = 2) => String(value).padStart(digits, "0");
  return `${part(Math.floor(ms / 3600000))}:${part(Math.floor(ms / 60000) % 60)}:${part(Math.floor(ms / 1000) % 60)},${part(ms % 1000, 3)}`;
}

function exportCaptions(storyboard, timing, workDir) {
  const blocks = [];
  const script = [`# ${storyboard.title}`];
  let cursor = 0;
  for (const [index, scene] of timing.entries()) {
    const {title, narration} = storyboard.scenes[index];
    script.push(`## ${index + 1}. ${title} · ${(scene.durationInFrames / FPS).toFixed(2)} giây\n\n${narration}`);
    for (const {text, start, end} of scene.captions) {
      blocks.push(`${blocks.length + 1}\n${srtTime(cursor + start)} --> ${srtTime(cursor + end)}\n${text}`);
    }
    cursor += scene.durationInFrames;
  }
  atomicWrite(join(workDir, "subtitles.vi.srt"), blocks.join("\n\n") + "\n");
  atomicWrite(join(workDir, "script.vi.md"), script.join("\n\n") + "\n");
}

function blackFrameScan(path, frames) {
  const tool = ffmpeg();
  const filters = capture(tool, ["-hide_banner", "-filters"]).stdout;
  if (/\bblackdetect\b/.test(filters)) {
    const scan = capture(tool, ["-nostdin", "-hide_banner", "-v", "info", "-i", path,
      "-an", "-vf", "blackdetect=d=0:pix_th=0.045:pic_th=0.985", "-f", "null", "-"]).stderr;
    return {method: "ffmpeg-blackdetect", blackIntervals: scan.match(/black_start:[^\r\n]+/g) ?? []};
  }
  const pixels = 96 * 54;
  const {stdout} = capture(tool, ["-nostdin", "-v", "error", "-i", path, "-an",
    "-vf", "scale=96:54:flags=area,format=gray", "-threads:v", "1", "-c:v", "rawvideo", "-f", "rawvideo", "pipe:1"],
  {encoding: null, maxBuffer: Math.max(32 * 1024 * 1024, frames * pixels + 1024)});
  if (stdout.length !== frames * pixels) throw new Error("Black-frame scan received an incomplete picture stream.");
  const blackIntervals = [];
  for (let frame = 0; frame < frames; frame++) {
    let dark = 0;
    for (let i = frame * pixels; i < (frame + 1) * pixels; i++) if (stdout[i] <= 11) dark++;
    if (dark / pixels >= 0.985) blackIntervals.push(frame);
  }
  return {method: "ffmpeg-decoded-luma", blackIntervals};
}

function normalizeAudioDuration(path, duration) {
  const audio = probe(path).streams.find(({codec_type}) => codec_type === "audio");
  if (!audio) throw new Error("The expected AAC track is missing.");
  if (Math.abs(Number(audio.duration) - duration) < 0.0005) return;
  const trimmed = path.replace(/\.mp4$/i, ".timed.mp4");
  try {
    capture(ffmpeg(), ["-nostdin", "-v", "error", "-y", "-i", path,
      "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy", "-af", `apad,atrim=duration=${duration}`,
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", trimmed]);
    renameSync(trimmed, path);
  } finally {
    rmSync(trimmed, {force: true});
  }
}

function verifyMp4(path, frames, hasAudio, exact = false) {
  const data = probe(path);
  const video = data.streams.find(({codec_type}) => codec_type === "video");
  const audio = data.streams.find(({codec_type}) => codec_type === "audio");
  if (video?.codec_name !== "h264" || video.width !== WIDTH || video.height !== HEIGHT ||
      video.avg_frame_rate !== `${FPS}/1` || Number(video.nb_frames) !== frames || video.pix_fmt !== "yuv420p") {
    throw new Error(`Unexpected video stream: ${JSON.stringify(video ?? null)}`);
  }
  const duration = Number(data.format.duration);
  const tolerance = exact ? 0.0005 : 1 / FPS;
  if (!Number.isFinite(duration) || Math.abs(duration - frames / FPS) > tolerance) throw new Error("MP4 duration differs from the Remotion timeline.");
  const audioSeconds = Number(audio?.duration);
  if (hasAudio && (audio?.codec_name !== "aac" || !Number.isFinite(audioSeconds) || Math.abs(audioSeconds - duration) > (exact ? tolerance : 0.1))) {
    throw new Error("The expected AAC track is missing or has incorrect duration.");
  }
  const {method, blackIntervals} = blackFrameScan(path, frames);
  if (blackIntervals.length) throw new Error(`Unexpected black video: ${blackIntervals.join("; ")}`);
  if (hasAudio) {
    const audioScan = capture(ffmpeg(), ["-nostdin", "-hide_banner", "-v", "info", "-i", path,
      "-vn", "-af", "silencedetect=noise=-55dB:d=0.8", "-f", "null", "-"]).stderr;
    const silences = [...audioScan.matchAll(/silence_duration: ([\d.]+)/g)].map((match) => Number(match[1]));
    if (silences.some((value) => value >= duration - 0.5)) throw new Error("The expected AAC track is silent.");
  }
  return {duration, bytes: statSync(path).size, video, audio: audio ?? null, blackScan: {method, blackIntervals}};
}

function previewFrames(storyboard, timing) {
  const frames = new Set([0]);
  const long = timing.length > 12;
  let start = 0;
  timing.forEach((scene, index) => {
    if (index > 0) {
      if (!long) frames.add(start - 1);
      frames.add(start);
      if (!long && storyboard.scenes[index].transition === "fade") frames.add(start + Math.floor(FADE_FRAMES / 2));
    }
    const cue = scene.captions.find(({start: cueStart}) => cueStart >= 35) ?? scene.captions[0];
    frames.add(Math.floor((cue.start + cue.end) / 2) + start);
    start += scene.durationInFrames;
  });
  frames.add(start - 1);
  return [...frames].sort((a, b) => a - b);
}

async function main() {
  const {values: options, positionals} = parseArgs({
    allowPositionals: true,
    options: {
      storyboard: {type: "string"}, output: {type: "string"}, concurrency: {type: "string"},
      duration: {type: "string"}, brief: {type: "string"},
      silent: {type: "boolean"}, "require-voice": {type: "boolean"}, "prepare-only": {type: "boolean"},
      "previews-only": {type: "boolean"}, force: {type: "boolean"}, help: {type: "boolean", short: "h"},
    },
  });
  if (options.help) { console.log(usage); return; }
  if (positionals.length > 1 || (positionals[0] && options.storyboard) || (options.silent && options["require-voice"])) throw new Error(usage);
  const topic = positionals[0]?.trim();
  if (positionals.length && !topic) throw new Error("A topic cannot be blank.");
  const duration = options.duration === undefined ? null : Number(options.duration);
  if (duration !== null && (!Number.isInteger(duration) || duration < 60 || duration > MAX_DOCUMENTARY_SECONDS)) {
    throw new Error("--duration needs a whole number of seconds from 60 to 600.");
  }
  if (options.brief && !topic) throw new Error("--brief needs a topic.");
  const brief = options.brief ? readFileSync(resolve(options.brief), "utf8") : "";
  const output = resolve(options.output ?? join(root, "output/documentary.mp4"));
  const render = !options["prepare-only"] && !options["previews-only"];
  if (!output.toLowerCase().endsWith(".mp4")) throw new Error("--output needs an MP4 path.");
  if (render && existsSync(output) && !options.force) throw new Error(`Output already exists: ${output}. Use --output or --force.`);
  const concurrency = Number(options.concurrency ?? Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2))));
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("--concurrency must be a positive integer.");

  const source = options.storyboard ? resolve(options.storyboard) : topic ? null : sample;
  const existingStory = source ? readJson(source) : null;
  const key = topic ?? JSON.stringify(existingStory);
  const workDir = join(root, "output", "work", hash(duration || brief ? JSON.stringify([key, duration, brief]) : key));
  mkdirSync(workDir, {recursive: true});
  const storyFile = join(workDir, "storyboard.json");
  const storyboard = existingStory ?? await generateStoryboard(topic, storyFile, {duration, brief});
  const plannedFrames = validateStoryboard(storyboard);
  if (duration !== null && plannedFrames !== duration * FPS) throw new Error(`Storyboard must plan exactly ${duration} seconds.`);
  assetCheck(storyboard);
  writeJson(storyFile, storyboard);
  await command(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--noEmit"]);
  console.log(`[PREFLIGHT] TypeScript, schema and assets passed. ${storyboard.scenes.length} scenes · ${plannedFrames / FPS}s planned.`);
  const {timing, ...voice} = await prepareAudio(storyboard, workDir, {
    silent: options.silent, requireVoice: options["require-voice"], targetFrames: duration === null ? null : duration * FPS,
  });
  const props = {storyboard: options.silent ? {...storyboard, music: null} : storyboard, timing};
  const frames = timing.reduce((sum, scene) => sum + scene.durationInFrames, 0);
  const hasAudio = Boolean(props.storyboard.music || voice.status === "ready");
  writeJson(join(workDir, "props.json"), props);
  exportCaptions(storyboard, timing, workDir);
  const report = {storyboard: storyFile, voice, composition: {fps: FPS, width: WIDTH, height: HEIGHT, frames},
    checks: {typescript: true, schema: true, assets: true, narrationDuration: voice.status === "ready"}};
  const reportFile = join(workDir, options["prepare-only"] ? "preflight.json" : options["previews-only"] ? "preview.json" : "review.json");
  writeJson(reportFile, report);
  console.log(`[TIMELINE] ${frames / FPS}s · narration: ${voice.status} · artifacts: ${workDir}`);
  if (options["prepare-only"]) return;

  const serveUrl = await bundle({entryPoint: join(root, "src/index.tsx"), enableCaching: true});
  const browser = await openBrowser("chrome");
  try {
    const browserOptions = {serveUrl, inputProps: props, puppeteerInstance: browser};
    const composition = await selectComposition({...browserOptions, id: COMPOSITION});
    if (composition.width !== WIDTH || composition.height !== HEIGHT || composition.fps !== FPS || composition.durationInFrames !== frames) {
      throw new Error("Remotion composition differs from the validated timeline.");
    }
    report.checks.composition = true;
    const previews = join(workDir, "previews");
    mkdirSync(previews, {recursive: true});
    const checks = previewFrames(storyboard, timing);
    for (const frame of checks) {
      const name = `frame-${String(frame).padStart(4, "0")}.jpg`;
      await renderStill({...browserOptions, composition, frame, imageFormat: "jpeg", jpegQuality: 92, output: join(previews, name)});
    }
    report.previews = {directory: previews, frames: checks};
    writeJson(reportFile, report);
    console.log(`[PREVIEW] ${checks.length} frames at ${previews}`);
    if (!render) return;

    mkdirSync(dirname(output), {recursive: true});
    const temp = output.replace(/\.mp4$/i, `.${process.pid}.partial.mp4`);
    let encoded = false;
    let published = false;
    try {
      let progress = -10;
      await renderMedia({...browserOptions, composition, codec: "h264", audioCodec: "aac", pixelFormat: "yuv420p", colorSpace: "bt709",
        outputLocation: temp, concurrency, imageFormat: "jpeg", jpegQuality: 90, muted: !hasAudio,
        x264Preset: "fast", crf: 18, onProgress: ({progress: ratio}) => {
          const percent = Math.floor(ratio * 10) * 10;
          if (percent > progress) { progress = percent; console.log(`[RENDER] ${percent}%`); }
        }});
      encoded = true;
      if (duration !== null && hasAudio) normalizeAudioDuration(temp, duration);
      report.encoded = verifyMp4(temp, frames, hasAudio, duration !== null);
      if (options.force) renameSync(temp, output);
      else linkSync(temp, output);
      published = true;
      report.output = output;
      writeJson(reportFile, report);
      console.log(`[FINAL] ${output} · ${report.encoded.duration}s · ${report.encoded.bytes} bytes`);
    } finally {
      if (!encoded || published) rmSync(temp, {force: true});
      else console.error(`[REVIEW] The unverified MP4 is available at ${temp}`);
    }
  } finally {
    await browser.close({silent: true});
  }
}

main().catch((error) => {
  console.error(`[ERROR] ${error.stack ?? error}`);
  process.exitCode = 1;
});
