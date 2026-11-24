# Documentary video workspace

Use the project skills in `.agents/skills/` in story, visual direction, motion, composition, and review order. The sample's reporting sources live beside its storyboard. Generated footage should use bundled original illustrations or explicitly licensed local assets. Frame timing comes from the validated storyboard and measured narration. The project renders locally and never publishes.

## Documentary workflow

1. Use `storytelling-director` to verify claims and write the script around human stakes, decisions and consequences. Use `retention-editor` to check the opening, evidence reveals, pauses and payoff before locking the script.
2. Use `cinematic-shot-planner` to assign duration, framing, motion, lighting, transition and sound to every shot. Use `visual-asset-researcher` to verify and credit archival images and specify labeled originals for gaps. Then use `visual-director` to lock the visual storyboard.
3. Use `motion-designer` for deterministic camera paths and transitions. Use `sound-design-director` to measure local narration, time effects, duck the music and mark silence. Use `scene-generator` to assemble and validate the composition.
4. Use `thumbnail-title-director` when preparing a YouTube package. Check its promise against the opening and the rights ledger.
5. Use `retention-editor` on the assembled preview and `video-quality-review` to inspect frames, captions, the mix, media specs and credits. Honor any preview approval gate before a full render.

## Visual defaults for new videos

- Use `"visualStyle": "image-first"` for new storyboards. Give the photo, illustration, or data graphic the main area of the frame. Use full-bleed landscape photos. Preserve faces in vertical photos with a contained foreground and a soft background derived from the photo.
- Reserve large titles for openings and chapter changes. Show them briefly, typically 2–3 seconds. During the story, use a short label only when it adds context. Choose its position from the subject and subtitle safe area. Preserve context needed to identify archival images beside the credit. Avoid a permanent title column and a wide dark overlay reserved for text.
- Plan a visible change for each important beat in the narration. Vary shot scale, angle, and composition. Split long narration with multiple ideas into distinct shots. Use a map, comparison, timeline, or reconstruction when it helps explain the story. Limit repeated slow zooms, generic backgrounds, and decorative cards.
- Before a long render, inspect a short preview covering the opener, a typical narrative shot, a chapter transition, and a graphic scene if present. Check that the image is the focal point, key faces and details stay in frame throughout movement, and overlays clear the subtitles. Fix issues in the storyboard or renderer before the full export.

## Optimizing an existing documentary cut

- Use `documentary-story-editor` to audit the actual MP4 and match the before/after story beats. For archival footage and scans, use `historical-asset-researcher` to review item-level rights, pin the local media and keep the credit visible.
- Use `procedural-visual-designer` for CPU-friendly depth planes, maps and cutaways. Give visual actions a frame position relative to their narration. Use `sound-design-director` to match comparative listening levels and place effects.
- Use `visual-quality-review` on decoded comparison frames. Pair shot length and visual change measurements with an inspection of readability and story purpose. Verify the exported media with FFprobe.

## Retention and audio revisions

- Use `audience-retention-director` to compare the existing export and rewrite the opening, evidence order and payoff. Measure narration before locking shot lengths.
- Use `music-supervisor` to spot licensed recordings across the film and document source, in-point, edits and attribution. Use `soundscape-designer` for frame-linked effects, scene transitions and intentional silence.
- Use `audio-mixing-engineer` to build separate narration, music and effects stems, duck music, run measured loudness normalization and verify the encoded audio. Use `video-quality-review` on the final MP4 and keep viewer-retention claims tied to analytics.

## Character animation

The studio has its own Remotion entrypoint and episode schema under `animation-studio/`. Use `animation-showrunner` and `comedy-screenwriter` for episode planning. Use the design, rig, expression, voice, lip sync and environment skills to stage the episode, then use `comedy-timing-editor`, `foley-sound-designer` and `animation-quality-critic` on decoded previews. Pass the three technical gates before rendering the bundled pilot. Keep the documentary entrypoint and original archive assets intact.
