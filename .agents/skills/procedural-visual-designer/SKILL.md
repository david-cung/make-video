---
name: procedural-visual-designer
description: Build deterministic documentary visuals with lightweight Remotion layers, maps, diagrams and cutaways. Use when a scene must render reliably on integrated graphics or a CPU.
---

# Lightweight documentary visuals

Separate atmosphere and far landscape, subject, and near occlusion into depth planes. Give them different frame-based translations and slight scale differences. Precompute noisy textures, coastline geometry and wide soft lighting. Reuse small raster textures and SVG paths. Reserve per-frame work for transforms, reveals and meaningful changes in composition.

Draw geographic boundaries from credited offline data. Mark approximate routes and schematic cutaways. Tie every marker, inflow and diagram annotation to a source or to a measured narration cue. Use a test still before adding costly blur or particles. Blender can supply a short prerendered plate if a test on the target hardware warrants it.

Supply layered components, labelled evidence and a tested render profile to the scene generator. The Titanic implementation in `src/titanic-intel.tsx` uses CSS/SVG and small precomputed textures with Remotion's default Chromium renderer selection.
