---
name: historical-asset-researcher
description: Find and verify the identity, rights and local usability of historical footage, photographs and documents. Use before sourcing archival media for a documentary cut.
---

# Historical media

Start with the shot's date, place, event and viewpoint. Inspect the item record, the frames or pages themselves, and the holding institution's rights statement. For mixed newsreels, verify the ship or person at the clip level and record in/out times. Keep the archive's stated uncertainty in any caption.

Record the item, rights and media URLs, creator, date, identity, credit line, local path and reviewed SHA-256 in a media ledger. Use `node scripts/historical-assets.mjs <manifest>` to verify the bundled bytes and decoded media. The optional `--fetch-missing` mode retrieves a reviewed original when its ledger includes a direct HTTPS URL and a pinned hash. Derive crop and working resolution locally and retain the parent item citation.

For a verified footage entry, `--prepare-footage <id>` cuts its declared `excerpt.start` and `excerpt.end` in seconds and returns a silent local MP4 path for Remotion. Keep the archived source unchanged and credit the excerpt at the point of use.

Hand the validated assets and a caption to the scene generator. Where the archive cannot establish the event, use a clearly labelled reconstruction or schematic. The verifier checks the ledger and file integrity, while the researcher establishes permissions and identity.
