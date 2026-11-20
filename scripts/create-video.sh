#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
export KOKORO_VOICE="${KOKORO_VOICE-bm_george}"
exec node scripts/create-video.mjs "$@"
