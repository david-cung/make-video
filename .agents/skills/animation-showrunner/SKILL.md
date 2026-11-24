---
name: animation-showrunner
description: "Plan and produce an original Side Street Specials episode from an idea or an existing episode JSON."
---

## Purpose

Plan and produce an original Side Street Specials episode from an idea or an existing episode JSON.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Topic in English or Vietnamese, or a versioned episode JSON, plus a duration of 60–90 seconds.

## Outputs

Validated storyboard, measured timeline, character and license manifests, quality review and local MP4.

## Workflow

Use the recurring cast and the original series bible. For a topic, run `npm run animation:create -- --topic 'A new original idea' --duration 75 --language en --validate` against local Ollama. Review the cached draft, then render it with `npm run animation:create -- --episode PATH`. For the bundled pilot, render `--gates`, inspect the decoded clips, then run `--pilot`.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

An immediate situation, escalating conflict and visual payoff. Verify the MP4 before reporting completion.

## Failure handling

If generation or casting fails, correct the rejected JSON or author it explicitly. Keep the documentary entrypoint and all prior assets.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
