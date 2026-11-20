---
name: music-supervisor
description: Select and time documentary music against story beats, and verify recording rights, attribution and intended distribution. Use when scoring or revising a documentary.
---

# Music supervision

Inputs are the approved script, shot timing, muted scene boundaries and license records for the actual recordings. Start with the emotion or question at each chapter, then audition and spot music in and out points. Use an asset record for each recording with creator, source, license, attribution and any modification. Verify monetized distribution and credit conditions with the licensor. Keep an explicit gap and asset request when a suitable cue is missing.

In the Titanic package, edit `storyboards/titanic-retention-music.json`. Specify chapter-relative placement, source in point, duration, gain and fades. Keep intentional silence out of overlap ranges. Run `node scripts/render-titanic-retention.mjs` to place and audition the preview cues with the measured speech and export the full cue sheet. Review cue bounds against local media and document all recording credits.

Outputs are the full cue sheet, music stem and ready-to-use attribution. Validate synchronization permission, musical transitions, audibility and space for the voice.
