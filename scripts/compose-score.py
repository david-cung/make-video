"""Compose the original deep-ocean underscore as a stereo PCM WAV."""

import argparse
from array import array
import math
from pathlib import Path
import sys
import wave

RATE = 48_000
SECONDS = 75
TAU = math.tau
ROOTS = (55.0, 43.6535, 48.9994, 41.2034, 55.0)


def pad(t, root, phase):
    return (
        0.24 * math.sin(TAU * root * t + phase)
        + 0.08 * math.sin(TAU * (root * 1.5 + 0.08) * t + phase)
        + 0.05 * math.sin(TAU * (root * 2.0 - 0.13) * t)
        + 0.034 * math.sin(TAU * root * 3.0 * t + phase / 2)
    )


def score():
    output = array("h")
    for index in range(RATE * SECONDS):
        t = index / RATE
        chord = int(t / 15)
        local = t % 15
        blend = max(0.0, (local - 11) / 4)
        blend = (1 - math.cos(math.pi * blend)) / 2
        root = ROOTS[chord]
        next_root = ROOTS[(chord + 1) % len(ROOTS)]
        swell = 0.74 + 0.24 * math.sin(TAU * t / 12.7)
        fade = min(1, t / 2, (SECONDS - t) / 4)
        note = index // (RATE * 5)
        age = t % 5
        chime = 0.055 * min(1, age / 0.16) * math.exp(-age / 1.25)
        chime *= math.sin(TAU * (195.998, 164.814, 146.832)[note % 3] * age)
        for phase in (0.24, -0.24):
            bed = (1 - blend) * pad(t, root, phase) + blend * pad(t, next_root, phase)
            distant = 0.025 * math.sin(TAU * 28 * t + phase) * math.sin(TAU * 0.11 * t)
            output.append(round(32767 * fade * (swell * bed + chime + distant)))
    if sys.byteorder != "little":
        output.byteswap()
    return output.tobytes()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    with wave.open(str(args.output), "wb") as wav:
        wav.setparams((2, 2, RATE, 0, "NONE", "not compressed"))
        wav.writeframes(score())
