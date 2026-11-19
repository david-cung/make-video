import argparse
import json
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Synthesize Vietnamese sentence WAVs with VieNeu ONNX.")
    parser.add_argument("jobs", type=Path)
    parser.add_argument("--mode", choices=("v3turbo", "v3nano"), required=True)
    parser.add_argument("--voice", required=True)
    args = parser.parse_args()
    jobs = json.loads(args.jobs.read_text(encoding="utf-8"))
    if not jobs:
        return

    from vieneu import Vieneu

    if args.mode == "v3turbo":
        engine = Vieneu(mode=args.mode, backend="onnx")
    else:
        engine = Vieneu(mode=args.mode)
    for job in jobs:
        target = Path(job["path"])
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(f"{target.stem}.{os.getpid()}.tmp.wav")
        try:
            print(f"VieNeu | {job['id']}", flush=True)
            audio = engine.infer(job["text"], voice=args.voice)
            engine.save(audio, str(temporary))
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
