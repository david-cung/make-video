# Cinema

Build English documentary videos from a topic or a storyboard. Codex CLI can create a storyboard from a topic using ChatGPT sign-in. Kokoro 82M generates narration locally on CPU. Remotion renders the film, and FFprobe and FFmpeg check the MP4.

## Set up on macOS

Use Node.js 22.12 or later, Python 3.11 or 3.12, and FFmpeg with FFprobe (`brew install ffmpeg`). The first setup downloads dependencies, the Kokoro model and voice weights, and Remotion's headless browser. After setup, a local storyboard can be narrated and rendered offline without a Codex login or TTS service.

```bash
npm ci
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements-tts.txt

mkdir -p .cache/kokoro
curl -fL https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx \
  -o .cache/kokoro/kokoro-v1.0.onnx
curl -fL https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin \
  -o .cache/kokoro/voices-v1.0.bin
```

See the [Kokoro 82M model card](https://huggingface.co/hexgrad/Kokoro-82M) and [Kokoro ONNX release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1) for model details and licensing.

## Render

```bash
# 20-second English Titanic sample with the default British voice
./scripts/create-video.sh --storyboard storyboards/titanic-sample.json \
  --duration 20 --require-voice --output output/titanic-sample.mp4

# Prepare the same sample with the American voice, without rendering
./scripts/create-video.sh --storyboard storyboards/titanic-sample.json \
  --duration 20 --voice am_michael --require-voice --prepare-only

# Generate and render a storyboard for a new topic (requires Codex CLI with ChatGPT sign-in)
./scripts/create-video.sh "Why do tides happen?" --require-voice --output output/tides.mp4

# Open the sample in Remotion Studio
npm run studio
```

- `--voice bm_george` selects the British English male voice (the default). `--voice am_michael` selects the American English male voice. Set `KOKORO_VOICE` to change the default for a shell session. The command-line flag takes precedence.
- `KOKORO_PYTHON` overrides the Python executable. The project uses its `.venv` when present. `KOKORO_MODEL_DIR` overrides `.cache/kokoro` and must contain both model files.
- `--require-voice` stops if narration or timing fails. Without it, a narration failure produces a visual cut with estimated captions and any configured background music. `--silent` skips audio explicitly. Legacy Vietnamese storyboards can still be rendered with `--silent`; this Kokoro adapter narrates English.
- `--duration` accepts a whole number of seconds from 20 to 600. The storyboard must plan the same duration, and the measured narration must fit. `--prepare-only` stops after audio, script, and captions. `--previews-only` also renders selected frames.
- `--brief FILE` passes editorial notes and local asset references when generating a new storyboard. `CODEX_BIN` and `CODEX_MODEL` configure that optional step. `FFMPEG` and `FFPROBE` override media tools, and `--concurrency` sets Remotion workers.
- `--output` selects the MP4 path (default `output/documentary.mp4`). `--force` replaces an existing MP4 after its replacement passes verification.

If Chrome Headless Shell crashes on macOS, point `REMOTION_BROWSER_EXECUTABLE` to an installed Chrome binary, such as `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

The pipeline synthesizes sentences locally and measures each WAV with FFprobe. It uses those measurements for the English subtitle cues, then assembles and verifies one PCM WAV per scene in `public/runs/<audio-id>/`. Sentence audio is cached by model files, voice, and text. The render log prints the working directory under `output/work/<id>/`. It contains `storyboard.json`, `script.en.md`, `subtitles.en.srt`, `props.json`, preview frames, and the verification report.

## Storyboards and assets

Storyboards use [the shared schema](storyboards/storyboard.schema.json) and reference images and music relative to `public/`. Provide a credit and licence for each asset. The [Titanic sample](storyboards/titanic-sample.json) links to its historical sources and uses original illustrations. The renderer burns the same sentence cues into the picture that it exports in the SRT file.

## Full Titanic documentary

The English film uses [the Titanic storyboard](storyboards/titanic-en.json), [research and archive credits](storyboards/titanic-en.credits.md), and original Remotion reconstructions. Render its 580-second master with:

```bash
./scripts/create-video.sh --storyboard storyboards/titanic-en.json \
  --duration 580 --voice bm_george --require-voice \
  --output output/titanic-documentary-en.mp4
```

The narration, shot timing and English SRT are written together in the working directory printed by the render command.
