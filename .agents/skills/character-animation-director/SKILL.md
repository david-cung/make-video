---
name: character-animation-director
description: "Stage editable body clips, pose blends and camera coverage for a frame-locked original episode."
---

## Purpose

Stage editable body clips, pose blends and camera coverage for a frame-locked original episode.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Scene set, cast positions, beat objectives and duration in the episode schema.

## Outputs

Timed acting beats and a locally rendered picture pass.

## Workflow

Choose clips and timed actions from `animation-studio/src/contracts.mjs`. Edit the motion library only for repeatable action missing from existing clips. Run `npm run animation:create -- --episode PATH --prepare-only`, then render with `--episode PATH`.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

Clear motion silhouettes, frame-deterministic easing and independent reactions. Run gates when rig code changes.

## Failure handling

Use a held reaction deliberately. If motion floats or hands miss contact, repair the pose or prop cue instead of adding camera zoom.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
