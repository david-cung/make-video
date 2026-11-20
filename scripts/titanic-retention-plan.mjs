import {join} from "node:path";
import {FPS} from "../src/timeline.mjs";
import {audioDuration, checkLocalAsset, readJson, root, validateStoryboard} from "./project.mjs";

export const openingFrames = 60 * FPS;
const directory = join(root, "storyboards");
const rounded = (value) => Number(value.toFixed(6));

export function loadRetentionEdit() {
  const edit = readJson(join(directory, "titanic-retention-edit.json"));
  const base = readJson(join(directory, "titanic-upgraded.json"));
  const byId = new Map(base.scenes.map((scene) => [scene.sceneId, scene]));
  const available = (id) => {
    const original = byId.get(id);
    if (!original) throw new Error(`Unknown retention scene ${id}.`);
    return original;
  };
  Object.keys(edit.laterRevisions).forEach(available);
  const creative = new Map();
  const scenes = edit.opening.map(({
    sceneId, newId = sceneId, tempo = 1, visualBeat, effects, silence = [], imagePosition, ...changes
  }) => {
    const original = available(sceneId);
    creative.set(newId, {visualBeat, effects, silence});
    if (imagePosition && !original.image) throw new Error(`No archival image to reframe in ${sceneId}.`);
    return {...original, ...changes, sceneId: newId, chapter: edit.replacesChapter,
      visualDescription: visualBeat,
      image: imagePosition ? {...original.image, objectPosition: imagePosition} : original.image,
      soundDesign: {mood: "Cinematic documentary mix", tempo, cue: null},
    };
  });
  const opening = {...base, historicalStyle: "intel-uhd", music: null, scenes};
  const after = base.scenes.filter(({chapter}) => chapter !== edit.replacesChapter).map((scene) => {
    const revision = edit.laterRevisions[scene.sceneId] ?? {};
    if (revision.visualBeat) creative.set(scene.sceneId, {visualBeat: revision.visualBeat});
    return {...scene, narration: revision.narration ?? scene.narration};
  });
  const full = {...opening, scenes: [...scenes, ...after]};
  if (validateStoryboard(opening) !== openingFrames) throw new Error("The retention opening must be 60 seconds.");
  validateStoryboard(full);
  return {edit, opening, full, creative};
}

const effectsDirectory = "titanic-upgraded";
const inheritedCues = ({soundDesign}) => (soundDesign?.cues ?? []).map((cue) => ({
  asset: cue.path,
  start: cue.start,
  duration: cue.duration,
  gainDb: rounded(20 * Math.log10(cue.gain)),
  fadeIn: Math.min(.34, cue.duration / 4),
  fadeOut: Math.min(.62, cue.duration / 4),
  ...(cue.loop ? {loop: true} : {}),
}));

export function compileCueSheet(full, creative, music) {
  let frame = 0;
  const timeline = full.scenes.map((scene) => {
    const startFrame = frame;
    frame += Math.round(scene.duration * FPS);
    const duration = (frame - startFrame) / FPS;
    const start = startFrame / FPS;
    const decision = creative.get(scene.sceneId);
    const effects = (decision?.effects ?? inheritedCues(scene)).map(({asset, start: offset, ...cue}) => {
      const path = asset.includes("/") ? asset : `${effectsDirectory}/${asset}.m4a`;
      if (offset < 0 || offset + cue.duration > duration + .000001) throw new Error(`Effect exceeds ${scene.sceneId}.`);
      if (cue.event === "collision" && Math.round(offset * FPS) !== Math.round(scene.historical.eventSeconds * FPS)) {
        throw new Error("Collision audio and picture event differ.");
      }
      return {...cue, path, sceneOffset: offset, start: rounded(start + offset), end: rounded(start + offset + cue.duration)};
    });
    const silence = (decision?.silence ?? []).map(({start: from, end: to, purpose}) => ({
      sceneOffset: from, start: rounded(start + from), end: rounded(start + to), purpose,
    }));
    return {id: scene.sceneId, title: scene.title, chapter: scene.chapter, startFrame, endFrameExclusive: frame,
      start: rounded(start), end: rounded(frame / FPS), narration: scene.narration,
      visualBeat: decision?.visualBeat ?? scene.visualDescription, effects, silence};
  });
  const anchors = new Map(timeline.map((item) => [item.id, item]));
  const tracks = new Map(music.tracks.map((track) => [track.id, track]));
  const total = frame / FPS;
  const instant = ({scene, edge = "start", offset = 0}) => {
    if (scene === "end") return total + offset;
    const anchor = anchors.get(scene);
    if (!anchor || !["start", "end"].includes(edge)) throw new Error(`Unknown music placement anchor ${scene}.`);
    return ((edge === "start" ? anchor.startFrame : anchor.endFrameExclusive) / FPS) + offset;
  };
  const musicCues = music.placements.map(({from, to, ...cue}) => {
    const start = instant(from);
    const end = instant(to);
    const duration = end - start;
    if (!tracks.has(cue.track) || start < 0 || end > total || duration <= 0 ||
        cue.fadeIn + cue.fadeOut > duration) throw new Error(`Invalid music placement ${cue.id}.`);
    return {...cue, start: rounded(start), end: rounded(end), duration: rounded(duration)};
  });
  const silence = timeline.flatMap((item) => item.silence);
  for (const gap of silence) {
    if ([...musicCues, ...timeline.flatMap((scene) => scene.effects)]
      .some(({start, end}) => Math.max(start, gap.start) < Math.min(end, gap.end) - .000001)) {
      throw new Error(`A cue overlaps intentional silence at ${gap.start}s.`);
    }
  }
  const clips = new Map();
  for (const {path, duration, loop} of timeline.flatMap((scene) => scene.effects)) {
    if (!clips.has(path)) clips.set(path, audioDuration(checkLocalAsset(path)));
    if (!loop && duration > clips.get(path) + .06) throw new Error(`Effect excerpt exceeds ${path}.`);
  }
  return {title: full.title, fps: FPS, durationSeconds: total, durationFrames: frame, previewSeconds: openingFrames / FPS,
    tracks: music.tracks, musicCues, timeline, sceneCount: timeline.length,
    plannedGaps: music.plannedGaps,
    effectsProvenance: "Original synthesized project effects from scripts/compose-titanic-audio.py. The mix uses them as illustrative sound.",
    attributionInstructions: music.attributionInstructions};
}
