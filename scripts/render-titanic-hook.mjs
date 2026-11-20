import {bundle} from "@remotion/bundler";
import {openBrowser, renderMedia, selectComposition} from "@remotion/renderer";
import {existsSync, linkSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync} from "node:fs";
import {join, relative, resolve} from "node:path";
import {parseArgs} from "node:util";
import {audioDuration, capture, checkLocalAsset, command, ffmpeg, probe, readJson, root, writeJson} from "./project.mjs";
import {buildDocumentaryMix, measureLoudness} from "./documentary-audio.mjs";
import {fileSha256} from "./historical-assets.mjs";
import {captionLines, FPS, HEIGHT, WIDTH} from "../src/timeline.mjs";

const duration = 30;
const frames = duration * FPS;
const rate = 48_000;
const workDir = join(root, "output/work/titanic-hook");
const outputDir = join(root, "output");
const cut = () => readJson(join(root, "storyboards/titanic-hook.json"));
const reviewTimes = [0, 3, 7, 12, 17, 21, 26, 29];
const cueTime = (frame) => frame / FPS;

async function synthesize(edit) {
  const jobs = edit.lines.map((text, i) => {
    const number = String(i + 1).padStart(2, "0");
    return {id: `line-${number}`, text: i === 0 ? "Eleven forty P M." : text,
      path: relative(root, join(workDir, `raw-${number}.wav`))};
  });
  const list = join(workDir, "kokoro-jobs.json");
  const prior = existsSync(list) ? readJson(list) : [];
  const pending = jobs.filter((job, i) => JSON.stringify(job) !== JSON.stringify(prior[i]) || !existsSync(join(root, job.path)));
  if (pending.length) {
    const request = join(workDir, `kokoro-pending-${process.pid}.json`);
    writeJson(request, pending);
    const windowsPython = join(root, ".venv/Scripts/python.exe");
    const posixPython = join(root, ".venv/bin/python");
    const python = process.env.KOKORO_PYTHON ?? (existsSync(windowsPython) ? windowsPython : posixPython);
    try {
      await command(python, ["-u", join(root, "scripts/tts/kokoro_adapter.py"), request,
        "--model-dir", resolve(process.env.KOKORO_MODEL_DIR ?? join(root, ".cache/kokoro")), "--voice", edit.voice,
        "--language", edit.language], {env: {...process.env, PYTHONUTF8: "1"}});
    } finally {
      rmSync(request, {force: true});
    }
  }
  writeJson(list, jobs);
  return jobs.map((job) => {
    const path = join(root, job.path);
    const stream = probe(path).streams.find(({codec_type}) => codec_type === "audio");
    const length = Number(stream?.duration_ts) / Number(stream?.sample_rate);
    if (!(length > 0)) throw new Error(`FFprobe could not measure ${job.id}.`);
    return {path, duration: length, spoken: job.text};
  });
}

function lockTimeline(edit, speech) {
  const requested = edit.scenes.flatMap(({lines}) => lines);
  if (requested.length !== speech.length || requested.some((line, i) => line !== i)) {
    throw new Error("The seven scenes must contain every requested line in script order.");
  }
  const budgets = edit.scenes.map(({lines}, i) => ({
    lead: i === 0 ? 19 : 3,
    length: lines.reduce((sum, line) => sum + Math.ceil(speech[line].duration * FPS), 0) + (lines.length - 1) * 3,
  }));
  if (budgets.reduce((sum, {lead, length}) => sum + lead + length + 3, 0) > frames) {
    throw new Error("The measured narration no longer fits. Review a revised script or edit before rendering.");
  }
  let from = 0;
  return edit.scenes.map((shot, i) => {
    const {lead, length} = budgets[i];
    const later = budgets.slice(i + 1).reduce((sum, next) => sum + next.lead + next.length + 3, 0);
    const target = (edit.scenes[i + 1]?.targetStart ?? duration) * FPS;
    const end = Math.min(frames - later, Math.max(target, from + lead + length + 3));
    let local = lead;
    const captions = shot.lines.map((line) => {
      const start = local;
      const stop = start + Math.ceil(speech[line].duration * FPS);
      local = stop + 3;
      return {text: edit.lines[line], start, end: stop};
    });
    const timeline = {id: shot.id, name: shot.name, targetStart: shot.targetStart, startFrame: from,
      durationInFrames: end - from, captions, lineIndices: shot.lines, ...(shot.id === "reveal" ? {eventFrame: 7} : {})};
    from = end;
    return timeline;
  });
}

function synthEffect(name, seconds, shape) {
  const count = Math.round(seconds * rate);
  const buffer = Buffer.alloc(44 + count * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(count * 2, 40);
  let seed = 1912;
  let water = 0;
  for (let i = 0; i < count; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 4294967296) * 2 - 1;
    water = .94 * water + .06 * noise;
    const tone = shape(i / rate, noise, water);
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, tone)) * 32767), 44 + i * 2);
  }
  const path = join(workDir, `${name}.wav`);
  writeFileSync(path, buffer);
  return path;
}

const sine = (phase) => Math.sin(2 * Math.PI * phase);

async function planSound(scenes, speech) {
  const record = readJson(join(root, "storyboards/titanic-retention-music.json")).tracks;
  const licensed = new Map(await Promise.all(["signal-to-noise", "hiraeth"].map(async (id) => {
    const track = record.find((item) => item.id === id);
    const path = join(root, track.path);
    if (!existsSync(path) || await fileSha256(path) !== track.sha256) {
      throw new Error(`Restore the reviewed recording using the media record for ${track.title} in storyboards/titanic-retention-music.json.`);
    }
    return [id, {...track, absolutePath: path, duration: audioDuration(path)}];
  })));
  const metal = synthEffect("metal-strike", .32, (t, n) =>
    Math.min(1, t * 250) * Math.exp(-t * 18) * (.28 * sine(204 * t) + .16 * sine(403 * t) + .14 * sine(693 * t) + .19 * n));
  const bass = synthEffect("sub-impact", .48, (t) =>
    Math.min(1, t * 125) * Math.exp(-t * 10) * (.36 * sine(49 * t - 16 * t * t) + .12 * sine(88 * t - 32 * t * t)));
  const pulse = synthEffect("clock-percussion", .26, (t) =>
    Math.min(1, t * 160) * Math.exp(-t * 16) * (.29 * sine(61 * t - 20 * t * t) + .15 * sine(115 * t)));
  const rush = synthEffect("water-rush", 3.4, (t, n, w) =>
    Math.min(1, t * 1.5) * Math.min(1, (3.4 - t) * 2) * (.75 * w + .035 * n) * (.57 + .14 * sine(t * 2.1)));
  const sfx = (name) => checkLocalAsset(`titanic-upgraded/${name}.m4a`);
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const at = (id) => cueTime(byId.get(id).startFrame);
  const until = (id) => at(id) + cueTime(byId.get(id).durationInFrames);
  const cue = (name, path, start, length, gainDb, fadeIn, fadeOut, extra = {}) =>
    ({name, path, start, duration: length, gainDb, fadeIn, fadeOut, ...extra});
  const hit = at("reveal") + cueTime(byId.get("reveal").eventFrame);
  const reveal = byId.get("question").captions[1].start;
  const titleHit = at("question") + cueTime(reveal - 4);
  const signal = licensed.get("signal-to-noise").absolutePath;
  const hiraeth = licensed.get("hiraeth").absolutePath;
  const music = [
    cue("Reveal sub-bass", bass, hit, .32, -3, .008, .095),
    cue("Low suspense drone", signal, at("engine"), until("engine") - at("engine") + .25, -7, .3, .4, {sourceIn: 44}),
    cue("Reduced corridor underscore", signal, at("corridor") - .18, until("corridor") - at("corridor") + .38, -15, .34, .38, {sourceIn: 70}),
    cue("Tension under flooding", signal, at("flooding") - .12, until("flooding") - at("flooding") + .33, -8, .62, .41, {sourceIn: 86}),
    cue("Countdown undercurrent", signal, at("countdown") - .17, until("countdown") - at("countdown") + .36, -9, .33, .36, {sourceIn: 96}),
    cue("Sinking crescendo", hiraeth, at("sinking") - .12, until("sinking") - at("sinking") - .067, -12, .85, .42, {sourceIn: 32}),
    cue("Question bass impact", bass, titleHit, .47, -7, .01, .13),
  ];
  for (let beat = at("countdown") + .27; beat < until("countdown") - .25; beat += .756) {
    music.push(cue("Countdown pulse", pulse, beat, .25, -7, .009, .06));
  }
  const effects = [
    cue("Metallic reveal impact", metal, hit, .32, -4, .007, .09),
    cue("Engine room", sfx("engine"), at("engine"), until("engine") - at("engine"), -11, .24, .37),
    cue("Distant corridor rumble", sfx("engine"), at("corridor"), until("corridor") - at("corridor"), -17, .34, .58, {lowpassHz: 205}),
    cue("Water rush", rush, at("flooding") + .12, 3.29, -11, .35, .53),
    cue("Bulkhead creak", sfx("creak"), at("flooding") + .51, 2.87, -10, .28, .55),
    cue("Hull strain", sfx("creak"), at("sinking") + .22, Math.min(3.35, until("sinking") - at("sinking") - .32), -14, .37, .67, {lowpassHz: 550}),
  ];
  const ambience = [
    cue("Sea beneath ship reveal", sfx("ocean"), at("reveal") + 1.05, until("reveal") - at("reveal") - 1.05, -23, .53, .48),
    cue("Cold sea at sinking", sfx("ocean"), at("sinking"), until("sinking") - at("sinking") + .28, -18, .58, .48),
    cue("Empty ocean foreground", sfx("ocean"), at("question") - .13, duration - at("question") + .13, -15, .59, .55, {sourceIn: 1.4}),
  ];
  const narration = [];
  const windows = [];
  for (const scene of scenes) {
    for (const [i, caption] of scene.captions.entries()) {
      const goal = speech[scene.lineIndices[i]];
      const start = cueTime(scene.startFrame + caption.start);
      narration.push({path: goal.path, duration: goal.duration, start, text: caption.text});
      windows.push({start, end: start + goal.duration});
    }
  }
  const recordings = [...licensed.values()].map(({absolutePath, ...metadata}) => metadata);
  return {narration, windows, music, effects, ambience, recordings, revealImpact: hit, questionImpact: titleHit};
}

function srtTime(frame) {
  const milliseconds = Math.round(frame / FPS * 1000);
  const pad = (n, size) => String(n).padStart(size, "0");
  return `00:${pad(Math.floor(milliseconds / 60000), 2)}:${pad(Math.floor(milliseconds / 1000) % 60, 2)},${pad(milliseconds % 1000, 3)}`;
}

function cutFiles(edit, scenes, speech, sound, technical) {
  const framesToSeconds = (frame) => (frame / FPS).toFixed(3);
  const audible = speech.reduce((sum, line) => sum + line.duration, 0);
  const proof = join(outputDir, "titanic-hook-script.md");
  const table = scenes.map((s) => `| ${s.name} | ${s.targetStart.toFixed(3)} | ${framesToSeconds(s.startFrame)}–${framesToSeconds(s.startFrame + s.durationInFrames)} |`);
  writeFileSync(proof, ["# Titanic high-tension hook", "", "## Narration", "", edit.lines.join("\n\n"),
    "", "## Timing", "", `Kokoro \`bm_george\` (en-GB). FFprobe measured ${audible.toFixed(3)} seconds across the nine original waveform files. All wording and punctuation are preserved in the script and captions. The time cue is voiced as “Eleven forty P M.” Scene cuts move to fit the original speech at its normal synthesis rate.`,
    "", "| Shot | Creative target (s) | Locked range (s) |", "| --- | ---: | ---: |", ...table, ""].join("\n"), "utf8");
  const captions = scenes.flatMap((scene) => scene.captions.map((c) => ({text: c.text,
    startFrame: scene.startFrame + c.start, endFrameExclusive: scene.startFrame + c.end})));
  writeFileSync(join(outputDir, "titanic-hook-subtitles.srt"), captions.map(({text, startFrame, endFrameExclusive}, i) =>
    `${i + 1}\n${srtTime(startFrame)} --> ${srtTime(endFrameExclusive)}\n${captionLines(text)}`).join("\n\n") + "\n", "utf8");
  const relativeCues = (list) => list.map(({path, ...cue}) => ({...cue, path: relative(root, path).replaceAll("\\", "/")}));
  writeJson(join(outputDir, "titanic-hook-storyboard.json"), {
    title: edit.title, fps: FPS, width: WIDTH, height: HEIGHT, durationInFrames: frames, durationSeconds: duration,
    voice: {engine: "Kokoro", name: edit.voice, language: edit.language, naturalWavSeconds: audible},
    openingBlack: {startFrame: 0, minimumBlackFrames: 7, intent: "Black lead before the ship appears"},
    scenes: scenes.map((s) => ({...s, pictureSource: s.id === "countdown" ? "original animated infographic" :
      s.id === "flooding" ? "illustrated schematic with a period inquiry plate" : "original illustrated reconstruction"})),
    captions, audio: {music: relativeCues(sound.music), effects: relativeCues(sound.effects), ambience: relativeCues(sound.ambience),
      narration: relativeCues(sound.narration), recordings: sound.recordings,
      events: {revealImpact: sound.revealImpact, questionImpact: sound.questionImpact}},
    review: technical,
  });
}

async function renderPicture(editScenes, picture, concurrency) {
  const source = readJson(join(root, "storyboards/titanic-upgraded.json"));
  const floodScene = source.scenes.find(({sceneId}) => sceneId === "the-limit");
  if (!floodScene || floodScene.historical.kind !== "flooding") throw new Error("The sourced flooding scene is unavailable.");
  for (const file of ["sky.jpg", "far-water.jpg", "near-water.png", "inquiry-48.jpg"]) checkLocalAsset(`titanic-intel/${file}`);
  const inputProps = {scenes: editScenes, floodScene};
  const serveUrl = await bundle({entryPoint: join(root, "src/titanic-hook-entry.tsx"), enableCaching: true});
  const browser = await openBrowser("chrome", {browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE});
  try {
    const options = {serveUrl, inputProps, puppeteerInstance: browser};
    const composition = await selectComposition({...options, id: "TitanicHook"});
    let last = -1;
    await renderMedia({...options, composition, codec: "h264", muted: true, outputLocation: picture, concurrency,
      crf: 17, x264Preset: "fast", imageFormat: "jpeg", jpegQuality: 92, pixelFormat: "yuv420p", colorSpace: "bt709",
      onProgress: ({progress}) => {
        const amount = Math.floor(progress * 4) * 25;
        if (amount > last) {
          console.log(`[HOOK] ${amount}%`);
          last = amount;
        }
      }});
  } finally {
    await browser.close({silent: true});
  }
}

function deliverMedia(picture, audio, output) {
  let encoded;
  let trimDb = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    capture(ffmpeg(), ["-nostdin", "-v", "error", "-y", "-i", picture, "-i", audio, "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", ...(trimDb ? ["-af", `volume=${trimDb}dB`] : []),
      "-t", String(duration), "-movflags", "+faststart", output]);
    encoded = measureLoudness(output);
    if (Number(encoded.input_tp) <= -1) break;
    trimDb = -1.15 - Number(encoded.input_tp);
  }
  if (!(Number(encoded.input_tp) <= -1) || Math.abs(Number(encoded.input_i) + 16) > 1) {
    throw new Error("Encoded audio missed the loudness or true-peak check.");
  }
  const {streams, format} = probe(output);
  const video = streams.find(({codec_type}) => codec_type === "video");
  const sound = streams.find(({codec_type}) => codec_type === "audio");
  if (video?.codec_name !== "h264" || video.width !== WIDTH || video.height !== HEIGHT ||
      Number(video.nb_frames) !== frames || video.avg_frame_rate !== `${FPS}/1` ||
      sound?.codec_name !== "aac" || sound.channels !== 2 ||
      ![video.duration, sound.duration, format.duration].every((value) => Number(value) === duration)) {
    throw new Error("FFprobe detected unexpected output streams.");
  }
  const scan = capture(ffmpeg(), ["-nostdin", "-hide_banner", "-nostats", "-i", output, "-an", "-vf",
    "blackdetect=d=0.08:pix_th=0.04:pic_th=0.995", "-f", "null", "-"]).stderr;
  const black = [...scan.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)]
    .map(([, start, end, length]) => ({start: Number(start), end: Number(end), duration: Number(length)}));
  if (black.length !== 1 || black[0].start !== 0 || black[0].end > .55) throw new Error(`Unexpected black intervals: ${JSON.stringify(black)}`);
  for (const seconds of reviewTimes) {
    capture(ffmpeg(), ["-v", "error", "-y", "-ss", String(seconds), "-i", output, "-frames:v", "1",
      "-update", "1", join(workDir, `review-${String(seconds).padStart(2, "0")}.jpg`)]);
  }
  return {video, audio: sound, duration, encoded, codecTrimDb: trimDb, black, reviewTimes};
}

async function main() {
  const {values: options} = parseArgs({options: {force: {type: "boolean"}, concurrency: {type: "string"}}});
  const concurrency = Number(options.concurrency ?? 4);
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("The render concurrency must be a positive integer.");
  const output = join(outputDir, "titanic-hook-high-tension.mp4");
  if (existsSync(output) && !options.force) throw new Error("The hook already exists. Use --force to regenerate just the hook.");
  mkdirSync(workDir, {recursive: true});
  const oldNames = readdirSync(outputDir).filter((name) => /^titanic-.*\.mp4$/i.test(name) && name !== "titanic-hook-high-tension.mp4");
  const previous = new Map(await Promise.all(oldNames.map(async (name) => [name, await fileSha256(join(outputDir, name))])));
  const edit = cut();
  const speech = await synthesize(edit);
  const scenes = lockTimeline(edit, speech);
  const sound = await planSound(scenes, speech);
  const mix = buildDocumentaryMix({...sound, duration, workDir, tailFade: .26, effectsDuckDb: -6});
  const measurements = Object.fromEntries(Object.entries(mix.stems).map(([stem, path]) => [stem, measureLoudness(path)]));
  if (Object.values(measurements).some(({input_i}) => !Number.isFinite(Number(input_i)))) throw new Error("An audio stem is silent.");
  writeJson(join(workDir, "mix.json"), {mix, measurements, speech, sound, scenes});
  console.log(`[AUDIO] ${speech.length} original lines · ${speech.reduce((sum, line) => sum + line.duration, 0).toFixed(3)}s measured`);
  const picture = join(workDir, `picture-${process.pid}.mp4`);
  const candidate = join(workDir, `hook-${process.pid}.mp4`);
  try {
    await renderPicture(scenes, picture, concurrency);
    const technical = deliverMedia(picture, mix.output, candidate);
    for (const [name, sha] of previous) {
      if (await fileSha256(join(outputDir, name)) !== sha) throw new Error(`The original export changed: ${name}`);
    }
    if (options.force) renameSync(candidate, output);
    else linkSync(candidate, output);
    cutFiles(edit, scenes, speech, sound, technical);
    writeJson(join(workDir, "review.json"), {...technical, previous: Object.fromEntries(previous)});
    console.log(`[FINAL] ${output} · ${technical.encoded.input_i} LUFS · ${technical.encoded.input_tp} dBTP`);
  } finally {
    rmSync(candidate, {force: true});
    rmSync(picture, {force: true});
  }
}

main().catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
