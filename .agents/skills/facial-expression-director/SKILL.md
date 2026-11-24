---
name: facial-expression-director
description: "Direct independently animated eyes, brows, blinks and resting mouths across a conversation."
---

## Purpose

Direct independently animated eyes, brows, blinks and resting mouths across a conversation.

## Tools

Use the local animation CLI, Node.js and the project assets. Executable rendering uses Remotion with Chrome; media verification uses FFmpeg/FFprobe. Work from the repository root.

## Inputs

Character IDs, expression and eye-target beats plus measured dialogue offsets.

## Outputs

Expression choices in episode JSON and a decoded character performance preview.

## Workflow

Author `poses.expression` and `poses.eyeTarget` and edit presets in `animation-studio/src/rig.tsx` only if existing presets cannot express the beat. Run `npm run animation:create -- --gates`, then inspect character and dialogue test frames before and after the cut.

## Data contract

Read `animation-studio/src/episode.schema.json` for authored beats and `animation-studio/src/types.ts` for compiled frame data. Retain cast IDs and declared asset versions. Seconds belong to authored cues; frame offsets belong to the compiled 30 fps timeline.

## Quality

The listener rests the mouth and stays engaged. Eyes aim at the current speaker or object. Held expressions read without face drift.

## Failure handling

If eyes or brows miss the beat, retime the pose and preserve the audio-derived viseme track.

## Integration

Hand off validated episode JSON to `animation-studio/scripts/studio.mjs`. Use `output/animation-timeline.json` and the matching rendered artifact for review.
