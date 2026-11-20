"""Generate original Titanic ambience and score. No external samples are used."""

import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np

RATE = 24_000
CHAPTERS = (
    ((43, 50, 55, 58), 0.65),
    ((45, 52, 55, 60), 0.58),
    ((41, 48, 53, 56), 0.75),
    ((38, 45, 50, 53), 0.92),
    ((41, 48, 50, 57), 0.62),
    ((36, 43, 48, 51), 0.82),
    ((43, 50, 55, 62), 0.63),
)


def fade(t, seconds, attack, release):
    return np.clip(t / attack, 0, 1) * np.clip((seconds - t) / release, 0, 1)


def atmosphere(t, frequency, phase=0):
    return np.sin(2 * np.pi * frequency * t + phase)


def score_section(seconds, notes, intensity, index):
    t = np.arange(round(seconds * RATE), dtype=np.float64) / RATE
    mix = np.zeros((len(t), 2))
    for n, note in enumerate(notes):
        hz = 440 * 2 ** ((note - 69) / 12)
        swell = 0.64 + 0.36 * atmosphere(t, 0.055 + n * 0.011, n)
        stereo = -1 if n % 2 else 1
        for channel in range(2):
            phase = n * 1.3 + (channel - 0.5) * stereo * 0.44
            body = atmosphere(t, hz, phase) + 0.23 * atmosphere(t, hz * 2.006, phase * 1.5)
            mix[:, channel] += intensity * (0.059 - n * 0.007) * swell * body
    if index in (0, 1, 4, 6):
        for n, start in enumerate(np.arange(1.4, seconds, 3.7)):
            length = min(round(3.5 * RATE), len(t) - round(start * RATE))
            if length <= 0:
                continue
            tone = t[:length]
            note = notes[(n + 1) % len(notes)] + 12
            hz = 440 * 2 ** ((note - 69) / 12)
            key = atmosphere(tone, hz) + 0.38 * atmosphere(tone, hz * 2.003)
            envelope = np.minimum(1, tone * 80) * np.exp(-tone * 1.35) * fade(tone, 3.5, .02, .3)
            mix[round(start * RATE):round(start * RATE)+length] += (0.048 * key * envelope)[:, None] * [0.8, 1.0]
    if index in (2, 3, 5):
        pulse = np.maximum(0, atmosphere(t, .29)) ** 7
        mix += (0.11 * pulse * atmosphere(t, 43.5))[:, None]
    return mix * fade(t, seconds, 2.1, 3.7)[:, None]


def effect(name, seconds):
    t = np.arange(round(RATE * seconds)) / RATE
    rng = np.random.default_rng(527)
    sample = rng.uniform(-1, 1, round(seconds * 430) + 2)
    wash = np.interp(t * 430, np.arange(len(sample)), sample)
    slow = 0.66 + 0.27 * atmosphere(t, 0.63) + 0.08 * atmosphere(t, 1.1)
    if name == "ocean":
        sound = (0.17 * wash + 0.055 * atmosphere(t, 55)) * slow
    elif name == "wind":
        sound = (0.25 * wash + .035 * atmosphere(t, 91)) * slow
    elif name == "creak":
        sound = 0.27 * atmosphere(t, 110, 15 * np.sin(t * 2.9)) * (np.maximum(0, atmosphere(t, .49)) ** 5)
    elif name == "horn":
        sound = 0.31 * (atmosphere(t, 74) + .33 * atmosphere(t, 148)) * np.exp(-t * .2)
    elif name == "deep":
        sound = 0.13 * wash * slow + .16 * atmosphere(t, 39, 4 * np.sin(t * 1.4))
    else:
        sound = (.30 * atmosphere(t, 49, 2 * (1 - np.exp(-12 * t))) + .17 * wash) * np.exp(-t * 2.9)
    return sound[:, None] * fade(t, seconds, .1, 1.4)[:, None]


def encode(chunks, path):
    with tempfile.TemporaryDirectory() as folder:
        wav_path = Path(folder) / "source.wav"
        with wave.open(str(wav_path), "wb") as wav:
            first = True
            for chunk in chunks:
                if first:
                    wav.setparams((chunk.shape[1], 2, RATE, 0, "NONE", "not compressed"))
                    first = False
                wav.writeframes(np.rint(np.clip(chunk, -1, 1) * 32767).astype("<i2").tobytes())
        subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-v", "error", "-y", "-i", str(wav_path),
                        "-c:a", "aac", "-b:a", "112k", str(path)], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("storyboard", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    scenes = json.loads(args.storyboard.read_text(encoding="utf8"))["scenes"]
    durations = {}
    for scene in scenes:
        chapter = scene["chapter"]
        durations[chapter] = durations.get(chapter, 0) + scene["duration"]
    if len(durations) != len(CHAPTERS):
        parser.error("The score requires seven chapters")
    args.output.mkdir(parents=True, exist_ok=True)
    encode((score_section(seconds, notes, level, index)
            for index, (seconds, (notes, level)) in enumerate(zip(durations.values(), CHAPTERS))), args.output / "score.m4a")
    for name, seconds in {"ocean": 13, "wind": 10, "creak": 6, "horn": 6, "deep": 12, "impact": 5}.items():
        encode([effect(name, seconds)], args.output / f"{name}.m4a")


if __name__ == "__main__":
    main()
