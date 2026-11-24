---
name: comedy-screenwriter
description: "Write and structurally validate short original dialogue comedy for the animation engine."
---

## Purpose

Write and structurally validate short original dialogue comedy for the animation engine.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Topic, cast profiles, scene set IDs and desired language.

## Outputs

Episode JSON using the authored contract, plus dialogue and stage directions in the script export.

## Workflow

Read the series bible and inspect `animation-studio/episodes/pilot.json`. Assign a purpose and one short line or silent action to each beat. Validate with `npm run animation:create -- --episode PATH --validate`; use `--prepare-only` to check the measured runtime.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

A visual opener, character-specific responses, escalation and payoff. Leave time for reactions and avoid explaining the visual joke.

## Failure handling

If the measured dialogue overruns, shorten specific lines or increase the authorised duration. Preserve deliberate holds.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
