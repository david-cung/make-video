---
name: video-quality-review
description: Verify a documentary render through storyboard, asset, narration, composition, preview, and final MP4 checks.
---

Run the pipeline preflight for TypeScript, storyboard schema and source assets. Verify each narration WAV and build captions from measured audio segments. Check the selected Remotion composition and review frames across the scene boundaries and both ends of the video. Inspect the MP4 with FFprobe for duration, dimensions, fps, H.264 and AAC when narration or music is present. Scan the encoded picture for black frames and report which checks ran and which need human review.
