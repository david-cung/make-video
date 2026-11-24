"""Local synthesis adapters for animation. Documentary TTS remains separate."""
import argparse
import json
import os
from pathlib import Path
import wave
import numpy as np

def save(path, samples, sample_rate):
    samples = np.asarray(samples).squeeze()
    if samples.ndim != 1 or not len(samples) or not np.isfinite(samples).all() or np.max(np.abs(samples)) < .001:
        raise ValueError("The adapter returned empty, silent, or malformed speech.")
    highest = float(np.max(np.abs(samples)))
    if highest > .91:
        samples = samples * (.91 / highest)
    temporary = path.with_name(f"{path.stem}.{os.getpid()}.partial.wav")
    try:
        with wave.open(str(temporary), "wb") as wav:
            wav.setparams((1, 2, sample_rate, 0, "NONE", "not compressed"))
            wav.writeframes(np.rint(samples * 32767).astype("<i2").tobytes())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jobs", type=Path)
    parser.add_argument("--adapter", choices=("kokoro","vieneu"), required=True)
    parser.add_argument("--model-dir", type=Path, required=True)
    args = parser.parse_args()
    jobs = json.loads(args.jobs.read_text(encoding="utf-8"))
    if not jobs:
        return
    if args.adapter == "kokoro":
        from kokoro_onnx import Kokoro
        engine = Kokoro(str(args.model_dir / "kokoro-v1.0.onnx"), str(args.model_dir / "voices-v1.0.bin"))
    else:
        from vieneu import Vieneu
        engine = Vieneu(mode="v3nano")
    for job in jobs:
        path = Path(job["path"])
        path.parent.mkdir(parents=True, exist_ok=True)
        if args.adapter == "kokoro":
            samples, rate = engine.create(job["speech"], voice=job["voice"], lang=job["locale"], speed=job["rate"])
        else:
            raw = path.with_suffix(".native.wav")
            try:
                audio = engine.infer(job["speech"], voice=job["voice"])
                engine.save(audio, str(raw))
                import subprocess
                subprocess.run([job["ffmpeg"],"-nostdin","-v","error","-y","-i",str(raw),
                                "-af",f"atempo={job['rate']}","-c:a","pcm_s16le",str(path)],check=True)
            finally:
                raw.unlink(missing_ok=True)
            continue
        save(path, samples, rate)

if __name__ == "__main__":
    main()
