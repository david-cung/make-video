---
name: character-rigging
description: "Test SVG skeleton pivots, joint order and physical hand attachment with deterministic poses."
---

## Purpose

Test SVG skeleton pivots, joint order and physical hand attachment with deterministic poses.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Rig source, attachment manifest and a reach/pickup/release beat.

## Outputs

Frame-level FK/IK audit and a verified prop interaction MP4.

## Workflow

Apply the joint definitions in `animation-studio/src/motion.mjs`. Run `npm run animation:create -- --gates --prepare-only` for the trajectory check, then `--gates` for the actual 10-second prop test. Inspect contact frames at pickup, hold and release.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

Hand remains attached to a held prop. Reject a sudden grip jump and unreachable anchor rather than accepting a cosmetic substitute.

## Failure handling

Correct the state transition or table anchor first. Run the trajectory gate again before compositing.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
