---
name: audio-mixing-engineer
description: Mix narration, music and effects on a frame-locked documentary timeline, and verify delivery loudness and true peak after encoding.
---

# Documentary mix

Inputs are locally measured narration WAVs with cue times, a music sheet, a soundscape plan and the locked picture duration. Build aligned PCM narration, music and effects stems. Crossfade overlapping cues and derive gradual ducking from speech windows. Keep some dynamic contrast around key sounds.

Use `scripts/documentary-audio.mjs` for placement, ducking, mixing and two-pass FFmpeg loudnorm. Measure encoded AAC again. Include headroom for codec peaks and reduce level if the delivered output exceeds its peak ceiling. Compare cue waveform positions with caption timing.

Outputs are separate stems, final mix, and measurement evidence. Check music presence, intelligibility, relative levels, sync, silence and peaks. Integrated loudness is one mix check alongside editorial review.
