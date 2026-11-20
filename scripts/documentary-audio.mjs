import {join} from "node:path";
import {writeFileSync} from "node:fs";
import {capture, ffmpeg} from "./project.mjs";

const sampleRate = 48_000;
const pcm = ["-ar", String(sampleRate), "-ac", "2", "-c:a", "pcm_f32le"];
const format = "aformat=sample_rates=48000:channel_layouts=stereo,asetpts=N/SR/TB";
const time = (value) => Number(value.toFixed(6));
const sample = (value) => Math.round(value * sampleRate);

export function narrationWindows(timing, fps) {
  let frame = 0;
  return timing.flatMap(({captions, durationInFrames}) => {
    const at = frame;
    frame += durationInFrames;
    return captions.map(({start, end}) => ({start: (at + start) / fps, end: (at + end) / fps}));
  });
}

export function duckingFilter(windows, {attack = .18, release = .44, depthDb = -9} = {}) {
  if (!windows.length) return "anull";
  const phrases = [];
  for (const candidate of [...windows].sort((a, b) => a.start - b.start)) {
    const last = phrases.at(-1);
    if (last && candidate.start - last.end <= .33) last.end = Math.max(last.end, candidate.end);
    else phrases.push({...candidate});
  }
  const envelope = phrases.map(({start, end}) =>
    `min(clip((t-(${time(start - attack)}))/${attack},0,1),clip((${time(end + release)}-t)/${release},0,1))`).join("+");
  return `volume=volume='1-${time(1 - 10 ** (depthDb / 20))}*min(1,${envelope})':eval=frame`;
}

function placement({path, start, duration, sourceIn = 0, gainDb = 0, fadeIn = 0, fadeOut = 0, lowpassHz}, total) {
  const values = [start, duration, sourceIn, gainDb, fadeIn, fadeOut];
  if (!values.every(Number.isFinite) || start < 0 || duration <= 0 || sourceIn < 0 ||
      start >= total || fadeIn < 0 || fadeOut < 0 || fadeIn + fadeOut > duration ||
      (lowpassHz !== undefined && (!Number.isFinite(lowpassHz) || lowpassHz < 20 || lowpassHz >= sampleRate / 2))) {
    throw new Error(`Invalid audio cue for ${path}, at ${start}s.`);
  }
  const filters = [format, `atrim=start_sample=${sample(sourceIn)}:end_sample=${sample(sourceIn + duration)}`, "asetpts=N/SR/TB"];
  if (lowpassHz) filters.push(`lowpass=f=${lowpassHz}`);
  if (gainDb) filters.push(`volume=${gainDb}dB`);
  if (fadeIn) filters.push(`afade=t=in:d=${time(fadeIn)}:curve=qsin`);
  if (fadeOut) filters.push(`afade=t=out:st=${time(duration - fadeOut)}:d=${time(fadeOut)}:curve=qsin`);
  if (start) filters.push(`adelay=delays=${sample(start)}S:all=1`);
  return filters.join(",");
}

export function renderAudioStem({entries, duration, output, graphPath, post = "anull"}) {
  const sources = new Map();
  const parts = [];
  for (const [index, entry] of entries.entries()) {
    const key = JSON.stringify([entry.path, Boolean(entry.loop)]);
    if (!sources.has(key)) sources.set(key, {input: sources.size, path: entry.path, loop: entry.loop, indexes: []});
    sources.get(key).indexes.push(index);
    parts.push(placement(entry, duration));
  }
  const pads = [];
  const inputs = [];
  for (const {input, path, loop, indexes} of sources.values()) {
    if (loop) inputs.push("-stream_loop", "-1");
    inputs.push("-i", path);
    if (indexes.length > 1) {
      pads.push(`[${input}:a]asplit=${indexes.length}${indexes.map((index) => `[s${index}]`).join("")}`);
    }
    for (const index of indexes) {
      const inputLabel = indexes.length > 1 ? `s${index}` : `${input}:a`;
      pads.push(`[${inputLabel}]${parts[index]}[c${index}]`);
    }
  }
  let sourceLabel;
  if (entries.length > 1) {
    pads.push(`${entries.map((_, i) => `[c${i}]`).join("")}amix=inputs=${entries.length}:normalize=0:duration=longest[mix]`);
    sourceLabel = "[mix]";
  } else if (entries.length) sourceLabel = "[c0]";
  else {
    inputs.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
    sourceLabel = "[0:a]";
  }
  pads.push(`${sourceLabel}apad,atrim=end_sample=${sample(duration)},asetpts=N/SR/TB,${post}[out]`);
  const graph = pads.join(";\n");
  writeFileSync(graphPath, graph, "utf8");
  capture(ffmpeg(), ["-nostdin", "-v", "error", "-y", ...inputs, "-filter_complex", graph,
    "-map", "[out]", ...pcm, output]);
  return output;
}

function loudnormResult(stderr) {
  const block = stderr.match(/\{\s*"input_i"\s*:[\s\S]*?\}/g)?.at(-1);
  if (!block) throw new Error("FFmpeg did not report loudness.");
  return JSON.parse(block);
}

const targetFilter = ({integrated, peak, range}) => `loudnorm=I=${integrated}:TP=${peak}:LRA=${range}`;

export function measureLoudness(input, {start = 0, duration, target = {integrated: -16, peak: -1.5, range: 11}} = {}) {
  const filter = `atrim=start=${start}${duration === undefined ? "" : `:duration=${duration}`},asetpts=PTS-STARTPTS,` +
    `${targetFilter(target)}:print_format=json`;
  return loudnormResult(capture(ffmpeg(), ["-nostdin", "-hide_banner", "-nostats", "-i", input, "-vn",
    "-af", filter, "-f", "null", "-"]).stderr);
}

export function normalizeAudio(input, output, duration, target = {integrated: -16, peak: -1.5, range: 11}) {
  const firstPass = measureLoudness(input, {target});
  const fields = {I: "input_i", TP: "input_tp", LRA: "input_lra", thresh: "input_thresh"};
  if (!Object.values(fields).every((field) => Number.isFinite(Number(firstPass[field]))) ||
      !Number.isFinite(Number(firstPass.target_offset))) throw new Error("The premix must contain measurable audio.");
  const measurement = Object.entries(fields).map(([key, field]) => `measured_${key}=${firstPass[field]}`).join(":");
  const filter = `${targetFilter(target)}:${measurement}:offset=${firstPass.target_offset}:linear=true:print_format=json,` +
    `aresample=${sampleRate},apad,atrim=end_sample=${sample(duration)}`;
  const secondPass = loudnormResult(capture(ffmpeg(), ["-nostdin", "-hide_banner", "-nostats", "-y", "-i", input,
    "-af", filter, ...pcm, output]).stderr);
  return {firstPass, secondPass, target};
}

export function buildDocumentaryMix({narration, music, effects, ambience, windows, duration, workDir, tailFade = 0, effectsDuckDb = 0}) {
  const stem = (name, entries, post) => renderAudioStem({
    entries, duration, output: join(workDir, `${name}.wav`), graphPath: join(workDir, `${name}.ffgraph`), post,
  });
  const stems = {
    narration: stem("narration", narration),
    music: stem("music", music, duckingFilter(windows)),
    effects: stem("effects", effects, effectsDuckDb
      ? duckingFilter(windows, {attack: .12, release: .3, depthDb: effectsDuckDb}) : "anull"),
    ...(ambience ? {ambience: stem("ocean-ambience", ambience)} : {}),
  };
  const premix = stem("premix", Object.values(stems).map((path) => ({path, start: 0, duration})),
    tailFade ? `afade=t=out:st=${time(duration - tailFade)}:d=${tailFade}` : "anull");
  const output = join(workDir, "normalized-mix.wav");
  const loudness = normalizeAudio(premix, output, duration);
  return {stems, premix, output, loudness};
}
