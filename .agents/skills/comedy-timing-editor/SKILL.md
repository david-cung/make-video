---
name: comedy-timing-editor
description: "Set up editorial beats, held reactions and callback timing in the rendered original comedy."
---

## Purpose

Set up editorial beats, held reactions and callback timing in the rendered original comedy.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Episode JSON, dialogue timings and a decoded sample of the current cut.

## Outputs

Revised beat lengths, matching audio and an evidence-based motion review.

## Workflow

Use `npm run animation:create -- --episode PATH --prepare-only` to measure speech. Set intentional holds in the beat data and verify the reveal and reaction as separate shots. Run `--episode PATH`, then `--review FILE`.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

The camera cuts for information or reaction. Silence and holds support the joke. Report timing evidence rather than audience-retention estimates.

## Failure handling

If an unplanned still shot gets flagged, add a motivated glance, shift or prop event and re-render the affected scene.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
