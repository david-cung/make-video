"""Create the documentary underscore and effects from generated waveforms."""

import argparse
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt


RATE = 24000
CHORDS = ((45, 48, 52, 57), (41, 45, 48, 53), (48, 52, 55, 60), (43, 47, 50, 55))
TAU = 2 * np.pi


def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)


def time(seconds):
    return np.arange(round(seconds * RATE), dtype=np.float32) / RATE


def envelope(t, attack, release):
    return np.clip(t / attack, 0, 1) * np.clip((t[-1] - t) / release, 0, 1)


def piano(note, duration):
    t = time(duration)
    phase = TAU * frequency(note) * t
    harmonics = np.sin(phase) + 0.24 * np.sin(phase * 2.004) + 0.09 * np.sin(phase * 3.016)
    return harmonics * envelope(t, 0.012, 0.3) * np.exp(-2.15 * t)


def section(seconds, energy, seed):
    t = time(seconds)
    mix = np.zeros((len(t), 2), dtype=np.float32)
    chords = CHORDS if seed % 2 == 0 else CHORDS[1:] + CHORDS[:1]
    beat = 60 / (74 + energy * 33)
    chord_length = beat * 6

    def add(signal, begin, scale, pan):
        sample = round(begin * RATE)
        count = min(len(signal), len(t) - sample)
        if count <= 0:
            return
        gains = np.array([1 - pan, 1 + pan], dtype=np.float32) * scale
        mix[sample:sample + count] += signal[:count, None] * gains

    for bar, start in enumerate(np.arange(0, seconds, chord_length)):
        notes = chords[bar % len(chords)]
        long = time(chord_length + 0.9)
        tone = envelope(long, 0.9, 1.15)
        for index, note in enumerate(notes):
            phase = TAU * frequency(note) * long
            vibrato = np.sin(TAU * (3.4 + index * 0.4) * long) * 0.6
            layer = np.sin(phase + vibrato) + 0.26 * np.sin(phase * 2.001 - vibrato)
            add(layer * tone, start, 0.017 + energy * 0.025, (-1) ** index * 0.34)
        for index, order in enumerate((0, 2, 1, 3, 2, 1)):
            if energy < .35 and index in (3, 5):
                continue
            add(piano(notes[order] + (12 if order > 0 else 0), 2.1),
                start + index * beat, 0.062 * (1 - energy * .32), (order - 1.5) * .15)
        if energy > .45:
            pulse_time = time(0.38)
            kick = np.sin(TAU * (55 * pulse_time + 4 * (1 - np.exp(-24 * pulse_time)))) * np.exp(-13 * pulse_time)
            for index in (0, 2, 4):
                add(kick, start + index * beat, energy * 0.14, 0)
    fade = envelope(t, 1.9, 1.9)
    return mix * fade[:, None]


def effect(seconds, kind):
    t = time(seconds)
    rng = np.random.default_rng(1729)
    if kind == "impact":
        low = np.sin(TAU * (47 * t + 2 * (1 - np.exp(-8 * t)))) * np.exp(-4.5 * t)
        noise = sosfilt(butter(2, 340, fs=RATE, output="sos"), rng.normal(0, .4, len(t)))
        return (.38 * low + .10 * noise * np.exp(-2.0 * t)) * envelope(t, 0.02, 0.5)
    bands = (520, 3800) if kind == "crowd" else (55, 750)
    wash = sosfilt(butter(2, bands, "bandpass", fs=RATE, output="sos"), rng.normal(0, .28, len(t)))
    rhythm = .71 + .15 * np.sin(TAU * .22 * t) + .10 * np.sin(TAU * 1.17 * t)
    return .33 * wash * rhythm * envelope(t, .7, 1.85)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("chapter_seconds", type=json.loads)
    parser.add_argument("score", type=Path)
    parser.add_argument("effects", type=Path)
    args = parser.parse_args()
    energy = (.14, .31, .72, .88, .49, .68, .23)
    if len(args.chapter_seconds) != len(energy) or any(value <= 0 for value in args.chapter_seconds):
        raise ValueError("Provide seven positive chapter lengths.")
    args.effects.mkdir(parents=True, exist_ok=True)
    with sf.SoundFile(args.score, "w", samplerate=RATE, channels=2, subtype="PCM_16") as score:
        for index, (duration, intensity) in enumerate(zip(args.chapter_seconds, energy)):
            score.write(section(duration, intensity, index))
    for kind, duration in (("impact", 2.4), ("crowd", 11), ("wind", 9)):
        sf.write(args.effects / f"{kind}.wav", effect(duration, kind), RATE, subtype="PCM_16")
