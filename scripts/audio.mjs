import {existsSync, mkdirSync, renameSync, rmSync, statSync} from "node:fs";
import {join, resolve} from "node:path";
import {FPS, GAP_FRAMES, LEAD_FRAMES, MAX_DOCUMENTARY_SECONDS, TAIL_FRAMES, silentTiming, splitSentences} from "../src/timeline.mjs";
import {audioDuration, capture, command, ffmpeg, hash, publicDir, root, writeJson} from "./project.mjs";

const seconds = (frames) => (frames / FPS).toFixed(7);
const wavFormat = "aformat=sample_rates=48000:channel_layouts=mono";
const voiceLanguages = {bm_george: "en-gb", am_michael: "en-us"};
const kokoroVersion = "kokoro-onnx-0.6.1";

function pythonExecutable() {
  if (process.env.KOKORO_PYTHON) return process.env.KOKORO_PYTHON;
  const venv = join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  return existsSync(venv) ? venv : process.platform === "win32" ? "python" : "python3";
}

function measuredFrames(path) {
  const frames = Math.ceil(audioDuration(path) * FPS - 0.001);
  if (frames < 5) throw new Error(`Narration segment is shorter than five frames: ${path}`);
  return frames;
}

function allocateFrames(timing, desired) {
  let remaining = Math.max(0, 60 * FPS - timing.reduce((sum, scene) => sum + scene.durationInFrames, 0));
  for (let index = timing.length - 1; index >= 0 && remaining; index--) {
    const padding = Math.min(remaining, Math.max(0, desired[index].durationInFrames - timing[index].durationInFrames));
    timing[index].durationInFrames += padding;
    remaining -= padding;
  }
}

function fitExactDuration(timing, desired, targetFrames) {
  const minimum = timing.map((scene) => scene.captions.at(-1).end + TAIL_FRAMES);
  const available = targetFrames - minimum.reduce((sum, value) => sum + value, 0);
  if (available < 0) throw new Error(`Narration needs at least ${((targetFrames - available) / FPS).toFixed(2)} seconds. Condense the draft before rendering.`);
  const gaps = desired.map((scene, index) => Math.max(0, scene.durationInFrames - minimum[index]));
  if (desired.reduce((sum, scene) => sum + scene.durationInFrames, 0) === targetFrames &&
      desired.every((scene, index) => scene.durationInFrames >= minimum[index])) {
    timing.forEach((scene, index) => { scene.durationInFrames = desired[index].durationInFrames; });
    return;
  }
  const weights = gaps.some(Boolean) ? gaps : desired.map((scene) => scene.durationInFrames);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let weightSoFar = 0;
  let assigned = 0;
  for (const [index, scene] of timing.entries()) {
    weightSoFar += weights[index];
    const next = Math.round(available * weightSoFar / totalWeight);
    scene.durationInFrames = minimum[index] + next - assigned;
    assigned = next;
  }
}

function setNarrationTempo(path, tempo) {
  if (tempo === 1) return path;
  const adjusted = path.replace(/\.wav$/, `-tempo-${tempo}.wav`);
  if (existsSync(adjusted)) {
    try { measuredFrames(adjusted); return adjusted; } catch {}
  }
  const temp = adjusted.replace(/\.wav$/, `.${process.pid}.tmp.wav`);
  try {
    capture(ffmpeg(), ["-nostdin", "-v", "error", "-y", "-i", path, "-af", `atempo=${tempo}`, "-c:a", "pcm_s16le", temp]);
    measuredFrames(temp);
    renameSync(temp, adjusted);
    return adjusted;
  } finally {
    rmSync(temp, {force: true});
  }
}

function mixScene(paths, timing, temp) {
  let cursor = 0;
  const graph = timing.captions.map(({start, end}, index) => {
    const next = timing.captions[index + 1]?.start ?? timing.durationInFrames;
    const lead = start - cursor;
    const clip = `[${index}:a]${wavFormat},adelay=${Math.round(lead / FPS * 1000)}:all=1,apad,atrim=duration=${seconds(end - cursor)}[a${index}]`;
    const gap = `anullsrc=r=48000:cl=mono:d=${seconds(next - end)}[gap${index}]`;
    cursor = next;
    return `${clip};${gap}`;
  });
  const segments = timing.captions.map((_, index) => `[a${index}][gap${index}]`).join("");
  graph.push(`${segments}concat=n=${paths.length * 2}:v=0:a=1[out]`);
  capture(ffmpeg(), ["-nostdin", "-hide_banner", "-v", "error", "-y", ...paths.flatMap((path) => ["-i", path]),
    "-filter_complex", graph.join(";"), "-map", "[out]", "-c:a", "pcm_s16le", temp]);
}

export async function prepareAudio(storyboard, workDir, options) {
  const desired = silentTiming(storyboard);
  if (options.silent) return {status: "skipped", timing: desired, error: null};
  const voice = options.voice ?? process.env.KOKORO_VOICE ?? "bm_george";
  if (!Object.hasOwn(voiceLanguages, voice)) {
    throw new Error(`Unsupported Kokoro voice "${voice}". Choose bm_george or am_michael.`);
  }
  const language = voiceLanguages[voice];

  try {
    if (storyboard.language !== "en") {
      throw new Error(`This Kokoro adapter supports English narration. Use an English storyboard or --silent for ${storyboard.language}.`);
    }
    const modelDir = resolve(process.env.KOKORO_MODEL_DIR ?? join(root, ".cache", "kokoro"));
    const modelFiles = ["kokoro-v1.0.onnx", "voices-v1.0.bin"].map((name) => {
      const path = join(modelDir, name);
      const file = statSync(path, {throwIfNoEntry: false});
      if (!file?.isFile() || !file.size) {
        throw new Error(`Missing Kokoro model file ${path}. See the macOS setup in README.md.`);
      }
      return [path, file.size, file.mtimeMs];
    });
    const profile = [kokoroVersion, modelFiles, voice, language];
    const sceneKeys = storyboard.scenes.map(({sceneId, narration, duration, soundDesign}) =>
      [sceneId, narration, duration, soundDesign?.tempo ?? 1]);
    const audioKey = hash(JSON.stringify([profile, sceneKeys, options.targetFrames]));
    const run = `runs/${audioKey}`;
    const audioDir = join(publicDir, run);
    const segmentsDir = join(root, ".cache", "voice", hash(JSON.stringify(profile)));
    const jobs = storyboard.scenes.map((scene) => splitSentences(scene.narration).map((text, index) => ({
      id: `${scene.sceneId}-${index + 1}`, text, path: join(segmentsDir, hash(text) + ".wav"),
    })));
    const pending = [...new Map(jobs.flat().map((job) => [job.path, job])).values()].filter(({path}) => {
      if (!existsSync(path)) return true;
      try { measuredFrames(path); return false; } catch { return true; }
    });
    if (pending.length) {
      const jobFile = join(workDir, `kokoro-jobs-${process.pid}.json`);
      writeJson(jobFile, pending);
      try {
        await command(pythonExecutable(), ["-u", join(root, "scripts/tts/kokoro_adapter.py"), jobFile,
          "--model-dir", modelDir, "--voice", voice, "--language", language], {
          env: {...process.env, PYTHONUTF8: "1"},
        });
      } catch (error) {
        throw new Error(`Kokoro synthesis failed: ${error.message}. Check the adapter log and Python setup.`, {cause: error});
      } finally {
        rmSync(jobFile, {force: true});
      }
    }
    const sources = jobs.map((sceneJobs, index) => sceneJobs.map(({path}) =>
      setNarrationTempo(path, storyboard.scenes[index].soundDesign?.tempo ?? 1)));
    const timing = jobs.map((sceneJobs, index) => {
      let cursor = LEAD_FRAMES;
      const captions = sceneJobs.map(({text}, sentenceIndex) => {
        const start = cursor;
        const end = start + measuredFrames(sources[index][sentenceIndex]);
        cursor = end + GAP_FRAMES;
        return {text, start, end};
      });
      const durationInFrames = Math.max(desired[index].durationInFrames, captions.at(-1).end + TAIL_FRAMES);
      return {durationInFrames, audio: null, captions};
    });
    const limit = desired.reduce((sum, scene) => sum + scene.durationInFrames, 0) > 90 * FPS ? MAX_DOCUMENTARY_SECONDS : 90;
    if (options.targetFrames) {
      fitExactDuration(timing, desired, options.targetFrames);
    } else if (timing.reduce((sum, scene) => sum + scene.durationInFrames, 0) > limit * FPS) {
      for (const scene of timing) scene.durationInFrames = scene.captions.at(-1).end + TAIL_FRAMES;
      allocateFrames(timing, desired);
    }
    if (timing.reduce((sum, scene) => sum + scene.durationInFrames, 0) > limit * FPS) {
      throw new Error(`Measured narration is longer than ${limit} seconds. Condense the storyboard and rerun.`);
    }
    mkdirSync(audioDir, {recursive: true});
    for (const [index, scene] of timing.entries()) {
      const id = storyboard.scenes[index].sceneId;
      const dest = join(audioDir, `${id}.wav`);
      const temp = join(audioDir, `${id}.${process.pid}.tmp.wav`);
      try {
        mixScene(sources[index], scene, temp);
        const actual = audioDuration(temp);
        if (Math.abs(actual - scene.durationInFrames / FPS) > 1 / FPS) throw new Error(`WAV timing drift for ${id}: ${actual}s.`);
        renameSync(temp, dest);
        scene.audio = `${run}/${id}.wav`;
      } finally {
        rmSync(temp, {force: true});
      }
    }
    return {status: "ready", timing, error: null, engine: "kokoro", voice, language, audioDir};
  } catch (error) {
    if (options.requireVoice) throw error;
    console.warn(`[KOKORO] ${error.message} Continuing with the visual cut and estimated sentence timings.`);
    return {status: "unavailable", timing: desired, error: error.message, engine: "kokoro", voice, language};
  }
}
