import {createHash} from "node:crypto";
import {spawn, spawnSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync} from "node:fs";
import {dirname, isAbsolute, join, relative, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";
import Ajv from "ajv";
import {FPS, MAX_DOCUMENTARY_SECONDS, splitSentences} from "../src/timeline.mjs";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const publicDir = join(root, "public");
export const schemaPath = join(root, "storyboards/storyboard.schema.json");
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
export const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);
const schemaCheck = new Ajv({allErrors: true}).compile(readJson(schemaPath));

export function atomicWrite(path, data) {
  mkdirSync(dirname(path), {recursive: true});
  const temp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, data);
    renameSync(temp, path);
  } finally {
    rmSync(temp, {force: true});
  }
}

export function writeJson(path, data) {
  atomicWrite(path, JSON.stringify(data, null, 2) + "\n");
}

export function checkLocalAsset(path) {
  if (!/^[a-z0-9][a-z0-9._/-]+$/i.test(path) || path.split("/").some((part) => !part || part === ".." || part === ".")) {
    throw new Error(`Use a relative public asset path: ${path}`);
  }
  const actual = realpathSync(join(publicDir, path));
  const pathFromPublic = relative(realpathSync(publicDir), actual);
  if (pathFromPublic === ".." || pathFromPublic.startsWith(".." + sep) || isAbsolute(pathFromPublic) || !statSync(actual).isFile() || !statSync(actual).size) {
    throw new Error(`Invalid or empty public asset: ${path}`);
  }
  return actual;
}

export function validateStoryboard(storyboard, {assets = true} = {}) {
  if (!schemaCheck(storyboard)) {
    throw new Error("Storyboard schema validation failed: " + schemaCheck.errors.map((error) => `${error.instancePath || "/"} ${error.message}`).join(", "));
  }
  const errors = [];
  const add = (condition, message) => { if (!condition) errors.push(message); };
  const scenes = storyboard.scenes;
  const plannedFrames = scenes.reduce((sum, scene) => sum + Math.round(scene.duration * FPS), 0);
  add(scenes.length >= 6 && scenes.length <= 60, "Use 6–60 scenes.");
  add(plannedFrames >= 60 * FPS && plannedFrames <= MAX_DOCUMENTARY_SECONDS * FPS, "Use a total duration of 60–600 seconds.");
  add(Boolean(storyboard.title.trim() && storyboard.topic.trim()), "Add a project title and topic.");
  add(new Set(scenes.map(({sceneId}) => sceneId)).size === scenes.length, "Scene IDs must be unique.");
  const sourceIds = new Set(storyboard.sources.map(({id}) => id));
  add(sourceIds.size === storyboard.sources.length, "Source IDs must be unique.");
  for (const source of storyboard.sources) {
    let url;
    try { url = new URL(source.url); } catch {}
    add(url?.protocol === "https:" && !url.username && !url.password && Boolean(source.title.trim() && source.id.trim()), `Invalid source ${source.id}.`);
  }
  for (const scene of scenes) {
    const label = scene.sceneId;
    const direction = scene.visualDirection;
    const sentences = splitSentences(scene.narration);
    add(/^[a-z][a-z0-9-]{1,39}$/.test(label), `Invalid scene ID ${label}.`);
    add(scene.duration >= 4 && scene.duration <= 24, `${label} must be 4–24 seconds.`);
    add(scene.title.trim().length > 0 && scene.title.length <= 70 && scene.kicker.length <= 65 && scene.displayNote.length <= 68, `${label} display text exceeds the layout limits.`);
    add(sentences.length > 0 && sentences.length <= 6 && sentences.every((sentence) => sentence.length <= 160), `${label} needs 1–6 sentences of at most 160 characters each.`);
    add([scene.visualDescription, direction.shotType, direction.cameraAngle, direction.lighting, direction.composition,
      direction.foreground, direction.midground, direction.background].every((value) => value.trim()) &&
      direction.visualAssets.length > 0 && direction.visualAssets.every((value) => value.trim()), `${label} needs a complete shot plan.`);
    add(direction.colorPalette.length === 3 && direction.colorPalette.every((color) => /^#[0-9a-f]{6}$/i.test(color)), `${label} needs dark, middle and light hex colors.`);
    add(scene.sourceIds.every((id) => sourceIds.has(id)), `${label} references an unknown source.`);
    if (scene.soundDesign?.cue && assets) checkLocalAsset(scene.soundDesign.cue);
    add(scene.sourceIds.length > 0 || scene.factChecks.every(({status}) => status !== "verified"), `${label} needs a source for every verified claim.`);
    add(scene.factChecks.every(({note}) => note.trim()), `${label} includes an empty fact check.`);
    if (scene.image) {
      add(Boolean(scene.image.credit.trim() && scene.image.license.trim()), `${label} image attribution and rights are required.`);
      add(/^(?:100|\d{1,2})% (?:100|\d{1,2})%$/.test(scene.image.objectPosition), `${label} image position must be a percentage pair.`);
      if (assets) checkLocalAsset(scene.image.path);
    }
  }
  if (storyboard.music) {
    add(Boolean(storyboard.music.license.trim() && storyboard.music.credit.trim()), "Music needs attribution and rights.");
    if (assets) checkLocalAsset(storyboard.music.path);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return plannedFrames;
}

export function command(file, args, options = {}) {
  const {input, ...spawnOptions} = options;
  return new Promise((resolvePromise, reject) => {
    const child = spawn(file, args, {cwd: root, windowsHide: true, stdio: "inherit", ...spawnOptions});
    child.once("error", reject);
    if (input !== undefined) {
      child.stdin.on("error", (error) => { if (error.code !== "EPIPE") reject(error); });
      child.stdin.end(input, "utf8");
    }
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${file} exited with ${code ?? signal}`));
    });
  });
}

export function capture(file, args, options = {}) {
  const result = spawnSync(file, args, {cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024, ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${file} exited with ${result.status}\n${result.stderr}`);
  return result;
}

function mediaTool(name) {
  const override = process.env[name.toUpperCase()];
  const platform = {
    "win32-x64": "win32-x64-msvc",
    "darwin-x64": "darwin-x64",
    "darwin-arm64": "darwin-arm64",
    "linux-x64": "linux-x64-gnu",
    "linux-arm64": "linux-arm64-gnu",
  }[`${process.platform}-${process.arch}`];
  const bundled = join(root, "node_modules", "@remotion", `compositor-${platform}`, name + (process.platform === "win32" ? ".exe" : ""));
  const local = join(root, ".cache", "ffmpeg", name + (process.platform === "win32" ? ".exe" : ""));
  if (override) return resolve(override);
  if (existsSync(local)) return local;
  if (spawnSync(name, ["-version"], {windowsHide: true, stdio: "ignore"}).status === 0) return name;
  if (existsSync(bundled)) return bundled;
  throw new Error(`Install ${name}, add it to PATH or set ${name.toUpperCase()} to its executable.`);
}

export const ffmpeg = () => mediaTool("ffmpeg");
export const ffprobe = () => mediaTool("ffprobe");
export const probe = (path) => JSON.parse(capture(ffprobe(), ["-v", "error", "-show_streams", "-show_format", "-of", "json", path]).stdout);
export function audioDuration(path) {
  const metadata = probe(path);
  const audio = metadata.streams.find(({codec_type}) => codec_type === "audio");
  const duration = Number(audio?.duration ?? metadata.format?.duration);
  if (!audio || !Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid audio: ${path}`);
  return duration;
}
