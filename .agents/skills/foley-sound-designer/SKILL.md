---
name: foley-sound-designer
description: "Create original action-timed Foley and mix it beneath measured line dialogue."
---

## Purpose

Create original action-timed Foley and mix it beneath measured line dialogue.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Timed beat action, sound cue name, gain and original sound kit source.

## Outputs

Dialogue, score, effects and ambience stems, cue sheet, normalized mix and measured peak.

## Workflow

Regenerate the original kit with `.venv/bin/python animation-studio/scripts/sound.py animation-studio/assets/audio` when a cue changes. Set `effects[].at` in scene seconds. Run `npm run animation:create -- --episode PATH --prepare-only` to mix, then run the review on the encoded cut.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

Action and sound share one frame clock. The score ducks under speech. Keep final true peak at or below the checked ceiling.

## Failure handling

Lower the conflicting cue or edit its placement if it masks speech, then remux or rerender.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
