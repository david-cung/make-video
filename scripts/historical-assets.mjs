import {createHash} from "node:crypto";
import {createReadStream, createWriteStream, existsSync, linkSync, mkdirSync, rmSync} from "node:fs";
import {dirname, join, relative, resolve} from "node:path";
import {Readable} from "node:stream";
import {pipeline} from "node:stream/promises";
import {fileURLToPath} from "node:url";
import {parseArgs} from "node:util";
import {capture, checkLocalAsset, ffmpeg, probe, publicDir, readJson} from "./project.mjs";

export async function fileSha256(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

function httpsUrl(value, label) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error(`${label} needs an HTTPS URL.`);
  return url;
}

async function fetchAsset(asset, path) {
  const temporary = `${path}.${process.pid}.download`;
  const url = httpsUrl(asset.downloadUrl, asset.id);
  mkdirSync(dirname(path), {recursive: true});
  const response = await fetch(url, {signal: AbortSignal.timeout(120_000)});
  httpsUrl(response.url, asset.id);
  if (!response.ok || !response.body) throw new Error(`${asset.id}: HTTP ${response.status}`);
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, {flags: "wx"}));
    if (await fileSha256(temporary) !== asset.sha256) throw new Error(`${asset.id}: download hash differs from the reviewed original.`);
    linkSync(temporary, path);
  } finally {
    rmSync(temporary, {force: true});
  }
}

export async function reviewHistoricalAssets(manifest, {fetchMissing = false} = {}) {
  const ids = new Set();
  const report = [];
  for (const asset of manifest.assets) {
    const required = ["id", "path", "title", "creator", "date", "identity", "license", "credit"];
    if (required.some((key) => typeof asset[key] !== "string" || !asset[key].trim()) || !/^[a-z][a-z0-9-]*$/.test(asset.id) ||
        !/^[a-f0-9]{64}$/.test(asset.sha256) || !["image", "footage"].includes(asset.kind) || ids.has(asset.id)) {
      throw new Error(`Incomplete, duplicate or unsupported archive asset: ${asset.id ?? "(missing ID)"}.`);
    }
    ids.add(asset.id);
    httpsUrl(asset.sourceUrl, asset.id);
    httpsUrl(asset.rightsUrl, asset.id);
    if (asset.downloadUrl) httpsUrl(asset.downloadUrl, asset.id);
    const path = resolve(publicDir, asset.path);
    const local = relative(publicDir, path);
    if (local.startsWith("..") || !local) throw new Error(`${asset.id}: use a relative public path.`);
    if (!existsSync(path) && fetchMissing && asset.downloadUrl) await fetchAsset(asset, path);
    const checked = checkLocalAsset(asset.path);
    if (await fileSha256(checked) !== asset.sha256) throw new Error(`${asset.id}: local hash differs from the ledger.`);
    const metadata = probe(checked);
    const picture = metadata.streams.find(({codec_type}) => codec_type === "video");
    if (!picture?.width || !picture?.height) throw new Error(`${asset.id}: input has no decodable picture.`);
    const duration = Number(picture.duration ?? metadata.format.duration);
    if (asset.kind === "footage") {
      const {start, end} = asset.excerpt ?? {};
      if (!(Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= duration)) {
        throw new Error(`${asset.id}: a reviewed footage range must fit the source duration.`);
      }
    }
    report.push({id: asset.id, kind: asset.kind, path: asset.path, width: picture.width, height: picture.height,
      ...(asset.kind === "footage" ? {duration, excerpt: asset.excerpt} : {})});
  }
  if (!report.length) throw new Error("The archive manifest is empty.");
  return report;
}

function prepareFootage(reviewed, asset) {
  if (reviewed.kind !== "footage") throw new Error(`${asset.id}: expected reviewed footage.`);
  const {start, end} = reviewed.excerpt;
  const suffix = createHash("sha256").update(JSON.stringify([asset.sha256, start, end])).digest("hex").slice(0, 16);
  const local = `runs/archive/${asset.id}-${suffix}.mp4`;
  const output = join(publicDir, local);
  if (existsSync(output)) return local;
  mkdirSync(dirname(output), {recursive: true});
  const temporary = `${output}.${process.pid}.mp4`;
  try {
    capture(ffmpeg(), ["-nostdin", "-v", "error", "-y", "-ss", String(start), "-i", checkLocalAsset(asset.path),
      "-t", String(end - start), "-map", "0:v:0", "-an", "-vf",
      "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2:reset_sar=1",
      "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", temporary]);
    const metadata = probe(temporary);
    if (Math.abs(Number(metadata.format.duration) - (end - start)) > .12) {
      throw new Error(`${asset.id}: derivative duration differs from the reviewed range.`);
    }
    linkSync(temporary, output);
  } finally {
    rmSync(temporary, {force: true});
  }
  return local;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const {values, positionals} = parseArgs({allowPositionals: true, options: {
      "fetch-missing": {type: "boolean"}, "prepare-footage": {type: "string"},
    }});
    if (positionals.length > 1) throw new Error("Use one historical asset manifest.");
    const manifest = readJson(positionals[0] ?? join("storyboards", "titanic-intel-assets.json"));
    const reviewed = await reviewHistoricalAssets(manifest, {fetchMissing: values["fetch-missing"]});
    const id = values["prepare-footage"];
    if (id) {
      const entry = reviewed.find((asset) => asset.id === id);
      if (!entry) throw new Error(`No reviewed asset named ${id}.`);
      entry.remotionPath = prepareFootage(entry, manifest.assets.find((asset) => asset.id === id));
    }
    console.log(JSON.stringify(reviewed, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
