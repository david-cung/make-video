---
name: environment-designer
description: "Create reusable day/night sets and foreground routes around named character and prop anchors."
---

## Purpose

Create reusable day/night sets and foreground routes around named character and prop anchors.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Scene purpose, palette, character blocking, visible props and occlusion needs.

## Outputs

Versioned set config with usable anchors and a readable wide/close-up render.

## Workflow

Edit the set definitions and `animation-studio/src/set.tsx`. Use named anchors and never reference an absent prop. Validate `npm run animation:create -- --episode PATH --validate` and render the target shot or gate.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

Retain clear feet and hands, distinct depth layers and stable screen direction across a cut.

## Failure handling

Make a counter or foreground layer narrower or move the blocking if it hides the action.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
