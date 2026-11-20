import {bundle} from "@remotion/bundler";
import {openBrowser, renderMedia, selectComposition} from "@remotion/renderer";
import {existsSync, linkSync, mkdirSync, renameSync, rmSync, statSync} from "node:fs";
import {availableParallelism} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {performance} from "node:perf_hooks";
import {parseArgs} from "node:util";
import {COMPOSITION, FPS, HEIGHT, WIDTH} from "../src/timeline.mjs";
import {prepareAudio} from "./audio.mjs";
import {fileSha256, reviewHistoricalAssets} from "./historical-assets.mjs";
import {capture, checkLocalAsset, ffmpeg, probe, readJson, root, validateStoryboard, writeJson} from "./project.mjs";

const half = 15 * FPS;
const seconds = (frames) => (frames / FPS).toFixed(6);
const storyDir = join(root, "storyboards");
const qsv = ["-init_hw_device", "qsv=intel:hw,child_device_type=d3d11va"];

function buildStoryboard(main, cut) {
  const scenes = cut.after.map(({sceneId, duration, narration, soundDesign, eventSeconds, visualAssets, additionalSources = []}) => {
    const original = main.scenes.find((scene) => scene.sceneId === sceneId);
    if (!original) throw new Error(`Unknown source scene: ${sceneId}`);
    for (const asset of visualAssets.filter((path) => path.startsWith("titanic-intel/"))) checkLocalAsset(asset);
    const historical = {...original.historical};
    if (eventSeconds !== undefined) historical.eventSeconds = eventSeconds;
    return {...original, duration, narration, transition: "cut", historical, soundDesign,
      sourceIds: [...original.sourceIds, ...additionalSources],
      visualDirection: {...original.visualDirection, visualAssets}};
  });
  const storyboard = {...main, historicalStyle: "intel-uhd", sources: [...main.sources, ...cut.sources], scenes};
  if (validateStoryboard(storyboard, {minSeconds: 15}) !== half) throw new Error("After must be exactly 15 seconds.");
  return storyboard;
}

function checkBaseline(cut, durationInFrames) {
  let cursor = 0;
  for (const {startFrame, endFrame, beat} of cut.before) {
    if (!beat || !Number.isInteger(startFrame) || !Number.isInteger(endFrame) ||
        startFrame < 0 || endFrame > durationInFrames || endFrame <= startFrame) {
      throw new Error("A baseline source interval falls outside the input.");
    }
    cursor += endFrame - startFrame;
  }
  if (cursor !== half) throw new Error("Before must be exactly 15 seconds.");
}

function supportsQsv() {
  if (process.platform !== "win32") return false;
  const attempt = spawnSync(ffmpeg(), ["-nostdin", "-v", "error", ...qsv, "-f", "lavfi",
    "-i", "color=s=1920x1080:r=30:d=1", "-vf", "format=nv12", "-c:v", "h264_qsv",
    "-frames:v", "30", "-f", "null", "-"], {windowsHide: true, encoding: "utf8", timeout: 15_000});
  if (attempt.status !== 0) console.log(`[ENCODER] Quick Sync test unavailable. ${attempt.stderr?.trim() ?? ""}`);
  return attempt.status === 0;
}

function comparisonFilters(before, gain, fontPath) {
  const textStyle = fontPath ? `fontfile='${fontPath.replaceAll("\\", "/").replace(":", "\\:")}':` : "";
  const label = (text, color) => `drawbox=x=70:y=42:w=330:h=45:color=0x06121e@0.90:t=fill,` +
    `drawbox=x=70:y=42:w=3:h=45:color=${color}:t=fill,` +
    `drawtext=${textStyle}text='${text}':x=90:y=55:fontcolor=white:fontsize=21`;
  const inputs = before.flatMap(({startFrame, endFrame}, i) => {
    const length = seconds(endFrame - startFrame);
    const fadeOut = (Number(length) - .058).toFixed(6);
    return [
      `[0:v]trim=start_frame=${startFrame}:end_frame=${endFrame},setpts=PTS-STARTPTS[v${i}]`,
      `[0:a]atrim=start=${seconds(startFrame)}:end=${seconds(endFrame)},asetpts=PTS-STARTPTS,` +
        `aresample=48000,afade=t=in:d=0.048,afade=t=out:st=${fadeOut}:d=0.058[a${i}]`,
    ];
  });
  const links = before.map((_, i) => `[v${i}][a${i}]`).join("");
  return [...inputs, `${links}concat=n=${before.length}:v=1:a=1[bv][ba]`,
    `[bv]${label("BEFORE / EXISTING CUT", "0x8babbc")}[before]`,
    `[1:v]trim=end_frame=${half},setpts=PTS-STARTPTS,${label("AFTER / INTEL UHD", "0xe5af72")}[after]`,
    `[1:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS,volume=${gain}dB,` +
      "alimiter=limit=0.794328:level=0:latency=1,apad,atrim=duration=15,afade=t=out:st=14.93:d=0.07[aa]",
    "[before][ba][after][aa]concat=n=2:v=1:a=1[video][audio]",
  ].join(";");
}

function encodeComparison(cut, baseline, after, output, gain, preferQsv) {
  const fontPath = process.platform === "win32" ? join(process.env.WINDIR ?? "C:/Windows", "Fonts", "arial.ttf") : null;
  const filters = comparisonFilters(cut.before, gain, fontPath);
  const common = ["-i", baseline, "-i", after, "-filter_complex", filters,
    "-map", "[video]", "-map", "[audio]", "-t", "30", "-r", String(FPS), "-g", "60"];
  const tail = ["-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    "-colorspace", "bt709", "-color_trc", "bt709", "-color_primaries", "bt709", output];
  const stopwatch = performance.now();
  if (preferQsv && supportsQsv()) {
    try {
      capture(ffmpeg(), ["-nostdin", "-v", "error", "-y", ...qsv, ...common,
        "-c:v", "h264_qsv", "-preset", "medium", "-global_quality", "19", "-pix_fmt", "nv12", ...tail]);
      return {codec: "h264_qsv", seconds: (performance.now() - stopwatch) / 1000};
    } catch (error) {
      console.log(`[ENCODER] Quick Sync export failed, will use libx264. ${error.message}`);
    }
  }
  capture(ffmpeg(), ["-nostdin", "-v", "error", "-y", ...common,
    "-c:v", "libx264", "-preset", "fast", "-crf", "17", "-pix_fmt", "yuv420p", ...tail]);
  return {codec: "libx264", seconds: (performance.now() - stopwatch) / 1000};
}

function verifyComparison(path) {
  const info = probe(path);
  const video = info.streams.find(({codec_type}) => codec_type === "video");
  const audio = info.streams.find(({codec_type}) => codec_type === "audio");
  if (video?.codec_name !== "h264" || video.width !== WIDTH || video.height !== HEIGHT ||
      video.avg_frame_rate !== `${FPS}/1` || Number(video.nb_frames) !== 900 ||
      video.pix_fmt !== "yuv420p" || Number(video.duration) !== 30 || Number(info.format.duration) !== 30 ||
      audio?.codec_name !== "aac" || audio.channels !== 2 || Math.abs(Number(audio.duration) - 30) > .002) {
    throw new Error("Unexpected FFprobe parameters on the 30-second comparison.");
  }
  const scans = capture(ffmpeg(), ["-hide_banner", "-nostdin", "-i", path, "-an",
    "-vf", "blackdetect=d=0.16:pix_th=0.08:pic_th=0.99,freezedetect=n=-52dB:d=1.2", "-f", "null", "-"]).stderr;
  const black = [...scans.matchAll(/black_start:[^\r\n]+/g)].map(([line]) => line);
  const freeze = [...scans.matchAll(/freeze_(?:start|end|duration):[^\r\n]+/g)].map(([line]) => line);
  if (black.length) throw new Error(`Black intervals in output: ${black.join(", ")}`);
  return {video, audio, seconds: Number(info.format.duration), bytes: statSync(path).size, black, freeze};
}

function luma(path, frame) {
  const {status, stdout, stderr} = spawnSync(ffmpeg(), ["-v", "error", "-ss", seconds(frame), "-i", path,
    "-frames:v", "1", "-an", "-vf", "crop=1600:680:160:155,scale=96:42,format=gray", "-f", "rawvideo", "-"], {windowsHide: true});
  if (status !== 0 || stdout.length !== 96 * 42) throw new Error(`Missing review frame ${frame}: ${stderr.toString()}`);
  return stdout;
}

function pictureChange(path, a, b) {
  const first = luma(path, a);
  const last = luma(path, b);
  return Number((first.reduce((sum, value, i) => sum + Math.abs(value - last[i]), 0) / first.length).toFixed(3));
}

function groupBefore(intervals) {
  const beats = [];
  let start = 0;
  for (const span of intervals) {
    const length = span.endFrame - span.startFrame;
    if (beats.at(-1)?.name === span.beat) beats.at(-1).length += length;
    else beats.push({name: span.beat, start, length});
    start += length;
  }
  return beats;
}

function reviewCut(path, cut, timing, workDir) {
  const before = groupBefore(cut.before);
  if (before.map(({name}) => name).join() !== cut.after.map(({beat}) => beat).join()) {
    throw new Error("Compare the same narrative beats in the same order.");
  }
  let start = half;
  return cut.after.map(({beat, sample, pictureChanges, duration}, i) => {
    const previous = before[i];
    const beforeFrame = previous.start + Math.round(previous.length * .84);
    const afterFrame = start + sample;
    const length = timing[i].durationInFrames;
    if (start + length > half * 2 || sample < 0 || sample >= length || length !== duration * FPS) {
      throw new Error(`Measured timing differs from the shot plan for ${beat}.`);
    }
    const variations = pictureChanges === "narration-cues" ? timing[i].captions.map(({start}) => start) : pictureChanges;
    if (!variations.length || variations.some((at) => !Number.isInteger(at) || at < 0 || at >= length)) {
      throw new Error(`Invalid visual action timing for ${beat}.`);
    }
    for (const [side, frame] of [["before", beforeFrame], ["after", afterFrame]]) {
      capture(ffmpeg(), ["-v", "error", "-y", "-ss", seconds(frame), "-i", path, "-frames:v", "1",
        "-update", "1", join(workDir, `${side}-${beat}.jpg`)]);
    }
    const result = {beat, before: {seconds: previous.length / FPS, sampleFrame: beforeFrame,
      pictureChange: pictureChange(path, previous.start, beforeFrame)}, after: {seconds: length / FPS, sampleFrame: afterFrame,
      pictureChange: pictureChange(path, start, afterFrame), visualActionsAtFrames: variations,
      captions: timing[i].captions.map(({start: onset, end, text}) => ({start: start + onset, end: start + end, text}))}};
    if (result.after.pictureChange < .15) throw new Error(`The representative picture for ${beat} has barely changed.`);
    start += length;
    return result;
  });
}

async function main() {
  const {values: options} = parseArgs({options: {
    concurrency: {type: "string"}, cpu: {type: "boolean"}, force: {type: "boolean"},
  }});
  const concurrency = Number(options.concurrency ?? Math.min(3, availableParallelism()));
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Concurrency must be a positive integer.");
  const output = join(root, "output/titanic-intel-preview.mp4");
  if (existsSync(output) && !options.force) throw new Error("The comparison already exists. Use --force to regenerate it.");
  const cut = readJson(join(storyDir, "titanic-intel-cut.json"));
  const workDir = join(root, "output/work/titanic-intel");
  mkdirSync(workDir, {recursive: true});
  const baseline = join(root, cut.baseline);
  const originalHash = await fileSha256(baseline);
  if (originalHash !== cut.baselineSha256) throw new Error("The baseline does not match the audited MP4.");
  const baselineVideo = probe(baseline).streams.find(({codec_type}) => codec_type === "video");
  if (baselineVideo?.avg_frame_rate !== `${FPS}/1` || baselineVideo.width !== WIDTH || baselineVideo.height !== HEIGHT) {
    throw new Error("Unexpected baseline dimensions or frame rate.");
  }
  checkBaseline(cut, Number(baselineVideo.nb_frames));
  const assets = await reviewHistoricalAssets(readJson(join(storyDir, "titanic-intel-assets.json")));
  const storyboard = buildStoryboard(readJson(join(storyDir, "titanic-upgraded.json")), cut);
  const {timing, ...voice} = await prepareAudio(storyboard, workDir, {voice: "bm_george", requireVoice: true, targetFrames: half});
  if (timing.some(({durationInFrames}, i) => durationInFrames !== cut.after[i].duration * FPS)) {
    throw new Error("Adjust the script so measured speech fits each planned shot.");
  }
  const inputProps = {storyboard, timing};
  writeJson(join(workDir, "props.json"), inputProps);
  const afterFile = join(workDir, `after-${process.pid}.mp4`);
  const candidate = join(workDir, `comparison-${process.pid}.mp4`);
  const startRender = performance.now();
  const serveUrl = await bundle({entryPoint: join(root, "src/index.tsx"), enableCaching: true});
  const browser = await openBrowser("chrome", {browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE});
  try {
    const settings = {serveUrl, inputProps, puppeteerInstance: browser};
    const composition = await selectComposition({...settings, id: COMPOSITION});
    if (composition.durationInFrames !== half || composition.width !== WIDTH || composition.height !== HEIGHT || composition.fps !== FPS) {
      throw new Error("Unexpected after composition.");
    }
    let lastPercent = -1;
    await renderMedia({...settings, composition, codec: "h264", audioCodec: "aac", pixelFormat: "yuv420p", colorSpace: "bt709",
      outputLocation: afterFile, x264Preset: "fast", crf: 16, imageFormat: "jpeg", jpegQuality: 93, concurrency,
      onProgress: ({progress}) => {
        const percent = Math.floor(progress * 4) * 25;
        if (percent > lastPercent) { lastPercent = percent; console.log(`[REMOTION] ${percent}%`); }
      }});
  } catch (error) {
    rmSync(afterFile, {force: true});
    throw error;
  } finally {
    await browser.close({silent: true});
  }
  const renderSeconds = (performance.now() - startRender) / 1000;
  try {
    const encoder = encodeComparison(cut, baseline, afterFile, candidate, storyboard.mixGainDb ?? 0, !options.cpu);
    const media = verifyComparison(candidate);
    const beats = reviewCut(candidate, cut, timing, workDir);
    if (await fileSha256(baseline) !== originalHash) throw new Error("The baseline changed during this run.");
    if (options.force) renameSync(candidate, output);
    else linkSync(candidate, output);
    writeJson(join(workDir, "review.json"), {output, baseline, baselineHash: originalHash, assets, voice,
      concurrency, renderSeconds, encoder, media, beats});
    console.log(`[FINAL] ${output} · ${media.seconds}s · ${encoder.codec}`);
  } finally {
    rmSync(afterFile, {force: true});
    rmSync(candidate, {force: true});
  }
}

main().catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
