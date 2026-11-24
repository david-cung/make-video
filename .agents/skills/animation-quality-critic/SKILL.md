---
name: animation-quality-critic
description: "Audit decoded character animation, lip cues, props, sound and technical export before delivery."
---

## Purpose

Audit decoded character animation, lip cues, props, sound and technical export before delivery.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Actual MP4 and its matching compiled animation timeline.

## Outputs

Technical report with measured duration, codecs, loudness, visible activity flags and actionable repair times.

## Workflow

Run `npm run animation:create -- --review PATH --timeline output/animation-timeline.json`. Use FFmpeg to extract decoded shots around cup contact, viseme changes, the reverse cut and the punchline. Verify max peak and inspect every flagged beat.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

Separate measurable media/rig checks from editorial judgement. Document any intentional holds that the activity test flagged.

## Failure handling

If identity, pose, props or timing fail, fix the specific asset or beat and re-render the changed scene. Do not report an unresolved test as a pass.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
