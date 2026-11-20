---
name: scene-generator
description: Assemble documentary storyboard JSON into reusable Remotion scenes and validate compatible visual, caption and audio assets.
---

Use the shared storyboard schema and the fixed composition ID. Keep shot content as data. Use the existing scene and overlays for new topics. Split paragraphs into sentence-level cues and let the audio adapter supply measured durations when available. Resolve local images and WAVs through staticFile. Keep designed illustration presets available for topics without photography.

Set `visualStyle` to `image-first` on new storyboards and choose each scene's `labelPosition` from the actual framing. Mark vertical photos with `portrait: true`. Use additional scenes to represent visual beats when one composition would hold through several different ideas.
