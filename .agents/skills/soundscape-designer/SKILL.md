---
name: soundscape-designer
description: Design and synchronize layered documentary ambience, effects and silence against measured narration and picture events.
---

# Soundscape design

Inputs are the shot list, picture event frames, measured captions and an asset inventory. Distinguish a continuous location bed from isolated cues. Give a perspective change its own narrower or quieter bed. Choose a short, purposeful silence for a reveal and specify exact boundaries. Keep invented sound effects identified as illustration.

Put scene-relative cue start, length, asset, gain and fade times in the edit data. Use `scripts/documentary-audio.mjs` to turn them into a padded PCM effects stem. Use the same event time in Remotion and the cue sheet for hard synchronization. Crossfade beds where the environment continues and leave planned gaps clear of tails.

Deliver the scene-by-scene timeline and effects stem. Inspect playback on the encoded preview. Check that effects land on the intended frames, fades avoid clicks and ambience leaves speech clear.
