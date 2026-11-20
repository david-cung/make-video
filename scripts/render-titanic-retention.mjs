import {bundle} from "@remotion/bundler";
import {openBrowser, renderMedia, selectComposition} from "@remotion/renderer";
import {createWriteStream, existsSync, linkSync, mkdirSync, renameSync, rmSync} from "node:fs";
import {join} from "node:path";
import {Readable} from "node:stream";
import {pipeline} from "node:stream/promises";
import {performance} from "node:perf_hooks";
import {parseArgs} from "node:util";
import {COMPOSITION, FPS, HEIGHT, WIDTH} from "../src/timeline.mjs";
import {prepareAudio} from "./audio.mjs";
import {buildDocumentaryMix, measureLoudness, narrationWindows} from "./documentary-audio.mjs";
import {fileSha256, reviewHistoricalAssets} from "./historical-assets.mjs";
import {audioDuration, capture, checkLocalAsset, ffmpeg, probe, readJson, root, writeJson} from "./project.mjs";
import {compileCueSheet, loadRetentionEdit, openingFrames} from "./titanic-retention-plan.mjs";

const duration = openingFrames / FPS;
const workDir = join(root, "output/work/titanic-retention");
const readProjectStory = (name) => readJson(join(root, "storyboards", name));

async function localRecording(track) {
  if (!/^[a-z][a-z0-9-]*$/.test(track.id) || track.path !== `.cache/titanic-retention-music/${track.id}.mp3` ||
      !/^[a-f0-9]{64}$/.test(track.sha256) || !track.licenseUrl || !track.attribution) {
    throw new Error(`Incomplete recording or rights record: ${track.id}.`);
  }
  const path = join(root, track.path);
  if (!existsSync(path)) {
    const url = new URL(track.downloadUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Music download must use HTTPS.");
    mkdirSync(join(root, ".cache/titanic-retention-music"), {recursive: true});
    const temporary = `${path}.${process.pid}.download`;
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(120_000)});
      if (!response.ok || !response.body || new URL(response.url).protocol !== "https:") {
        throw new Error(`Could not download ${track.title} (HTTP ${response.status}).`);
      }
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, {flags: "wx"}));
      if (await fileSha256(temporary) !== track.sha256) throw new Error(`Downloaded recording differs: ${track.title}.`);
      linkSync(temporary, path);
    } finally {
      rmSync(temporary, {force: true});
    }
  }
  if (await fileSha256(path) !== track.sha256) throw new Error(`Recording does not match the reviewed file: ${track.title}.`);
  return {id: track.id, path, duration: audioDuration(path)};
}

async function renderPicture(storyboard, timing, output, concurrency) {
  const inputProps = {storyboard, timing: timing.map(({audio, ...scene}) => ({...scene, audio: null}))};
  const start = performance.now();
  const serveUrl = await bundle({entryPoint: join(root, "src/index.tsx"), enableCaching: true});
  const browser = await openBrowser("chrome", {browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE});
  try {
    const settings = {serveUrl, inputProps, puppeteerInstance: browser};
    const composition = await selectComposition({...settings, id: COMPOSITION});
    if (composition.durationInFrames !== openingFrames || composition.fps !== FPS ||
        composition.height !== HEIGHT || composition.width !== WIDTH) {
      throw new Error("Unexpected retention composition.");
    }
    let previous = -1;
    await renderMedia({...settings, composition, codec: "h264", muted: true,
      pixelFormat: "yuv420p", colorSpace: "bt709", outputLocation: output, x264Preset: "fast", crf: 17,
      imageFormat: "jpeg", jpegQuality: 92, concurrency, onProgress: ({progress}) => {
        const percent = Math.floor(progress * 4) * 25;
        if (percent > previous) { previous = percent; console.log(`[PICTURE] ${percent}%`); }
      }});
    return (performance.now() - start) / 1000;
  } finally {
    await browser.close({silent: true});
  }
}

function mux(picture, mix, output, gain = 0) {
  capture(ffmpeg(), ["-nostdin", "-v", "error", "-y", "-i", picture, "-i", mix, "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", ...(gain ? ["-af", `volume=${gain}dB`] : []), "-c:a", "aac", "-b:a", "192k",
    "-t", String(duration), "-movflags", "+faststart", output]);
}

function verify(path, timing) {
  const media = probe(path);
  const picture = media.streams.find(({codec_type}) => codec_type === "video");
  const audio = media.streams.find(({codec_type}) => codec_type === "audio");
  if (picture?.codec_name !== "h264" || picture.width !== WIDTH || picture.height !== HEIGHT ||
      Number(picture.nb_frames) !== openingFrames || picture.avg_frame_rate !== `${FPS}/1` ||
      audio?.codec_name !== "aac" || audio.channels !== 2 || audio.sample_rate !== "48000" ||
      Number(picture.duration) !== duration || Number(audio.duration) !== duration || Number(media.format.duration) !== duration) {
    throw new Error("The final streams differ from the 1920×1080, 30 fps, 60-second edit.");
  }
  const scan = capture(ffmpeg(), ["-nostdin", "-hide_banner", "-nostats", "-i", path, "-an", "-vf",
    "blackdetect=d=0.1:pix_th=0.08:pic_th=0.995,freezedetect=n=-52dB:d=1.3", "-f", "null", "-"]).stderr;
  const black = [...scan.matchAll(/black_start:[^\r\n]*/g)].map(([line]) => line);
  const freeze = [...scan.matchAll(/freeze_(?:start|end|duration):[^\r\n]*/g)].map(([line]) => line);
  if (black.length) throw new Error(`Black frames detected: ${black.join(", ")}`);
  let start = 0;
  const reviewFrames = timing.map(({captions, durationInFrames}, i) => {
    const cue = captions.at(-1);
    const frame = start + Math.round((cue.start + cue.end) / 2);
    const file = `preview-${String(i + 1).padStart(2, "0")}.jpg`;
    capture(ffmpeg(), ["-v", "error", "-y", "-ss", (frame / FPS).toFixed(6), "-i", path, "-frames:v", "1",
      "-update", "1", join(workDir, file)]);
    start += durationInFrames;
    return {frame, file};
  });
  return {picture, audio, duration, black, freeze, reviewFrames};
}

async function main() {
  const {values: options} = parseArgs({options: {
    concurrency: {type: "string"}, force: {type: "boolean"}, "audio-only": {type: "boolean"}, remix: {type: "boolean"},
  }});
  const concurrency = Number(options.concurrency ?? 3);
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Concurrency must be a positive integer.");
  const output = join(root, "output/titanic-retention-preview.mp4");
  if (options.remix && (options["audio-only"] || !existsSync(output))) throw new Error("--remix requires an existing retention preview.");
  if (existsSync(output) && !options.force && !options["audio-only"] && !options.remix) {
    throw new Error("Use --force to regenerate the retention preview.");
  }
  mkdirSync(workDir, {recursive: true});

  const {edit, opening, full, creative} = loadRetentionEdit();
  const music = readProjectStory("titanic-retention-music.json");
  const baseline = join(root, edit.baseline);
  const baselineHash = await fileSha256(baseline);
  await reviewHistoricalAssets(readProjectStory("titanic-intel-assets.json"));
  for (const file of ["atlantic-land.svg", "sky.jpg", "far-water.jpg", "near-water.png", "iceberg.png", "inquiry-48.jpg"]) {
    checkLocalAsset(`titanic-intel/${file}`);
  }
  const sheet = compileCueSheet(full, creative, music);
  const tracks = new Map((await Promise.all(sheet.tracks.map(localRecording))).map((track) => [track.id, track]));
  for (const cue of sheet.musicCues) {
    if (cue.sourceIn < 0 || cue.sourceIn + cue.duration > tracks.get(cue.track).duration - .04) {
      throw new Error(`Music cue exceeds reviewed recording: ${cue.id}.`);
    }
  }
  sheet.tracks = sheet.tracks.map((track) => ({...track, duration: tracks.get(track.id).duration}));
  const {timing, ...voice} = await prepareAudio(opening, workDir, {voice: "bm_george", requireVoice: true, targetFrames: openingFrames});
  if (timing.some(({durationInFrames}, i) => durationInFrames !== Math.round(opening.scenes[i].duration * FPS))) {
    throw new Error("A narration overrun changed the planned opening shot lengths.");
  }
  const windows = narrationWindows(timing, FPS);
  const openingTimeline = sheet.timeline.slice(0, opening.scenes.length);
  for (const [index, row] of openingTimeline.entries()) {
    row.captions = timing[index].captions.map(({start, end, text}) => ({
      startFrame: row.startFrame + start, endFrame: row.startFrame + end, text,
    }));
    if (row.silence.some((gap) => windows.some((window) => window.start < gap.end && window.end > gap.start))) {
      throw new Error(`Narration overlaps intentional silence in ${row.id}.`);
    }
  }
  const propsPath = join(workDir, "props.json");
  const props = {storyboard: opening, timing};
  const previous = options.remix ? readJson(join(workDir, "review.json")) : null;
  if (previous && (previous.output !== output || JSON.stringify(readJson(propsPath)) !== JSON.stringify(props))) {
    throw new Error("The picture storyboard or measured timing changed. Render again before remixing.");
  }
  writeJson(propsPath, props);
  const narration = timing.map((row, i) => ({
    path: checkLocalAsset(row.audio), start: openingTimeline[i].startFrame / FPS, duration: row.durationInFrames / FPS,
  }));
  const effects = openingTimeline.flatMap((scene) => scene.effects).map((cue) => ({...cue, path: checkLocalAsset(cue.path)}));
  const placedMusic = sheet.musicCues.filter(({start}) => start < duration)
    .map((cue) => ({...cue, path: tracks.get(cue.track).path}));
  const mix = buildDocumentaryMix({
    narration, music: placedMusic, effects, windows, duration, workDir, tailFade: .58, effectsDuckDb: -7,
  });
  const stemMeasurements = Object.fromEntries(Object.entries(mix.stems).map(([part, path]) => [part, measureLoudness(path)]));
  const inspectedMusic = placedMusic.flatMap(({id, start, end}) => {
    const length = Math.min(end, duration) - start;
    if (length < 4) return [];
    const seconds = start + (length - 1.4) / 2;
    const loudness = Number(measureLoudness(mix.stems.music, {start: seconds, duration: 1.4}).input_i);
    if (!Number.isFinite(loudness)) throw new Error(`The music stem is silent inside cue ${id}.`);
    return [{id, start: seconds, duration: 1.4, loudness}];
  });
  const cueSheetPath = join(root, "output/titanic-music-cue-sheet.json");
  writeJson(cueSheetPath, sheet);
  writeJson(join(workDir, "mix.json"), {voice, ...mix, stemMeasurements, inspectedMusic});
  console.log(`[AUDIO] ${voice.voice} · ${windows.length} captions · ${sheet.musicCues.length} whole-film music cues`);
  if (options["audio-only"]) return;

  const picture = previous ? output : join(workDir, `picture-${process.pid}.mp4`);
  const candidate = join(workDir, `comparison-${process.pid}.mp4`);
  try {
    const renderSeconds = previous?.renderSeconds ?? await renderPicture(opening, timing, picture, concurrency);
    mux(picture, mix.output, candidate);
    let encoded = measureLoudness(candidate);
    let codecTrimDb = 0;
    if (Number(encoded.input_tp) > -1) {
      codecTrimDb = -1.18 - Number(encoded.input_tp);
      mux(picture, mix.output, candidate, codecTrimDb);
      encoded = measureLoudness(candidate);
    }
    if (!Number.isFinite(Number(encoded.input_tp)) || Number(encoded.input_tp) > -1 ||
        Math.abs(Number(encoded.input_i) + 16) > 1) throw new Error("Encoded loudness exceeds the delivery tolerances.");
    const video = verify(candidate, timing);
    if (await fileSha256(baseline) !== baselineHash) throw new Error("The prior preview changed during export.");
    if (options.force || previous) renameSync(candidate, output);
    else linkSync(candidate, output);
    writeJson(join(workDir, "review.json"), {output, baseline, baselineHash, voice, video, encoded, codecTrimDb,
      mix, stemMeasurements, inspectedMusic, renderSeconds,
      concurrency: previous?.concurrency ?? concurrency, pictureReused: Boolean(previous), premiere: openingTimeline});
    console.log(`[FINAL] ${output} · ${duration}s · ${encoded.input_i} LUFS · ${encoded.input_tp} dBTP`);
  } finally {
    rmSync(candidate, {force: true});
    if (!previous) rmSync(picture, {force: true});
  }
}

main().catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
