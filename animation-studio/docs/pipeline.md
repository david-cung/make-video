# Animation production contract

The documentary uses `src/index.tsx` and `scripts/create-video.mjs`. This project uses a separate entrypoint and episode schema. Both share the bundled fonts, encoder tooling and the FFmpeg stem mixer.

1. Start from an authored episode or request a draft from a local Ollama model. The predictable IDs and set catalog are validated before any voice or rendering work.
2. Each beat may contain one spoken line and parallel pose, prop and sound events. Times within each beat are seconds. The compiler locks the output to integer frames at 30 fps. It measures each speech WAV, preserves minimum beat lengths, then distributes the time left over.
3. Run Rhubarb on every actual generated dialogue clip. The JSON remains a separate asset. The compiler rounds its intervals to frame bounds and selects speech poses only for the speaker. The English recognizer uses the original script. Vietnamese uses Rhubarb's generic phonetic backend.
4. A shoulder/elbow chain solves cup reach and returns a hand anchor. The prop references the same anchor in world coordinates while held. A named table anchor takes over when released. Unreachable targets clamp to the arm's reach; review any motion that approaches the limit.
5. Compose reusable set layers, the character skeleton and facial state, then the camera. Each scene encodes separately. Hashes include geometry, source settings and timed dialogue cues. Cached valid video segments are reused. Independent PCM dialogue, music, room and effects tracks are rebuilt and mixed at delivery.
6. Mux H.264/AAC and decode the result. Verify media metadata, measure loudness/true peak and check sampled luma and intended activity. Inspect contact sheets for actual articulation, continuity and punchline readability.

## Locations

- `configs/` defines the cast, voices and set anchors.
- `assets/characters/` contains reproducibly exported SVG part packs.
- `assets/audio/` holds the output of the original local Foley generator.
- `episodes/` contains the three gate fixtures and the authored pilot.
- `src/episode.schema.json` is the interoperable schema. `src/contracts.mjs` exports the schema and catalogs. `src/types.ts` declares the corresponding runtime types.
- `.cache/animation/` holds generated drafts, mixes, audits and picture segments. `public/animation-runs/voice/` holds per-line WAVs and raw cue JSON.

The system implements analytic poses and vector turns. It does not create hand-drawn in-betweens, automatic costume deformation, a conversational overlap mixer, or a per-beat vision model. Visual review remains part of the production gate. English emotional direction uses the writing, rate and timing; technical labels do not change unsupported model emotions.
