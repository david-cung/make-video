"""Turn sentence jobs into local PCM WAVs for the documentary timeline."""

import argparse
import json
import os
from pathlib import Path
import sys
import tempfile
import wave


def synthesize(jobs, model_dir, voice, language):
    import numpy as np
    from kokoro_onnx import Kokoro

    engine = Kokoro(str(model_dir / "kokoro-v1.0.onnx"), str(model_dir / "voices-v1.0.bin"))
    for job in jobs:
        try:
            samples, rate = engine.create(job["text"], voice=voice, lang=language)
            pcm = np.rint(np.clip(samples, -1, 1) * 32767)
            if pcm.ndim != 1 or not pcm.size or not np.isfinite(pcm).all() or not pcm.any():
                raise ValueError("Kokoro returned invalid or silent audio")
            dest = Path(job["path"])
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=dest.parent, suffix=".tmp.wav", delete=False) as temp:
                temporary = Path(temp.name)
            try:
                with wave.open(str(temporary), "wb") as wav:
                    wav.setparams((1, 2, rate, 0, "NONE", "not compressed"))
                    wav.writeframes(pcm.astype("<i2").tobytes())
                os.replace(temporary, dest)
            finally:
                temporary.unlink(missing_ok=True)
        except Exception as error:
            raise RuntimeError(f"{job['id']}: {error}") from error
        print(f"[KOKORO] {job['id']} · {pcm.size / rate:.2f}s", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jobs", type=Path)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--language", choices=("en-gb", "en-us"), required=True)
    args = parser.parse_args()
    try:
        jobs = json.loads(args.jobs.read_text(encoding="utf-8"))
        if jobs:
            synthesize(jobs, args.model_dir, args.voice, args.language)
    except ImportError as error:
        parser.exit(1, f"[KOKORO] {error}. Install requirements-tts.txt in the selected Python environment.\n")
    except Exception as error:
        parser.exit(1, f"[KOKORO] {error}\n")


if __name__ == "__main__":
    main()
