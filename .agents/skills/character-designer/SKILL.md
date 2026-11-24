---
name: character-designer
description: "Create, version and export reusable four-view layered original SVG character designs."
---

## Purpose

Create, version and export reusable four-view layered original SVG character designs.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Original silhouette, palette, proportions, wardrobe and identity rules.

## Outputs

Versioned cast profile, character manifest and transparent per-part SVGs in four views.

## Workflow

Edit `animation-studio/configs/cast.json` and shared geometry in `animation-studio/src/rig.tsx`. Increment the character version when an approved design changes. Run `npm run animation:create -- --assets` and inspect the manifest and turnaround SVGs.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

Stable silhouettes and joint coordinates, consistent outline strength and correct front/back visibility.

## Failure handling

If parts lose alignment, fix the common rig coordinate system and regenerate all views from the same source.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
