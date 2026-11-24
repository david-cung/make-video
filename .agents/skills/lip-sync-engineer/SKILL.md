---
name: lip-sync-engineer
description: "Generate and verify reusable mouth cues from actual dialogue WAVs with Rhubarb."
---

## Purpose

Generate and verify reusable mouth cues from actual dialogue WAVs with Rhubarb.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Validated episode dialogue, installed adapter voice, actual local WAV and Rhubarb CLI.

## Outputs

Per-line WAV, Rhubarb JSON and frame-positioned A–H/X cues in the compiled timeline.

## Workflow

Run `npm run animation:create -- --episode PATH --prepare-only`. Inspect the dialogue backend and mouth cues in `output/animation-timeline.json`. Run `npm run animation:create -- --gates` to verify both actors and decode a few speech and silence frames.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

Cue bounds are monotonic and fit measured audio. A speaking line has multiple active mouth shapes while the other rig rests.

## Failure handling

Fix the audio, transcript or recognizer. An unavailable backend is an error, and the engine has no random-mouth fallback.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
