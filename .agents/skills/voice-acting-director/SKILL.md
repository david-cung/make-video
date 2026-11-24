---
name: voice-acting-director
description: "Cast stock synthetic voices by language and test line delivery and measured pacing."
---

## Purpose

Cast stock synthetic voices by language and test line delivery and measured pacing.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Speaker ID, text, language, rate preference and optional pronunciation replacements.

## Outputs

Measured line WAVs, consistent stock voice assignment and named pronunciation settings.

## Workflow

Use `animation-studio/configs/cast.json`. Use Kokoro for English and the separate VieNeu adapter for Vietnamese. Validate by running `npm run animation:create -- --episode PATH --prepare-only`. Listen for rate and pronunciation before render.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

Voice identity remains fixed across a run. Pace from text, pauses and rate; delivery tags are editorial notes, not inferred emotions.

## Failure handling

Do not silently substitute an unavailable voice. Correct casting or fail with the missing preset and dependency.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
