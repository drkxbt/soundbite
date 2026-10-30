"""Soundbite's free music: four one-minute tracks written here from scratch, so they belong to the project and can be
used under any clip. Each is synthesized note by note and written as a mono 44.1 kHz WAV; the encoder page turns
them into the .m4a files in music/.

    python scripts/music.py <out dir>
"""
import pathlib
import sys
import wave

import numpy as np

RATE = 44100
SECONDS = 64
LENGTH = RATE * SECONDS


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def place(track, sound, at, gain=1.0):
    start = int(at * RATE)
    if start >= len(track):
        return
    end = min(len(track), start + len(sound))
    track[start:end] += gain * sound[: end - start]


def times(seconds):
    return np.arange(int(RATE * seconds)) / RATE


def envelope(t, attack, decay):
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def keys(freq, seconds, decay=0.9):
    """A soft electric piano: the note, its octave and a little third harmonic, with a slow tremolo."""
    t = times(seconds)
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(4 * np.pi * freq * t) + 0.08 * np.sin(6 * np.pi * freq * t)
    return tone * envelope(t, 0.012, decay) * (1 + 0.06 * np.sin(2 * np.pi * 4.5 * t))


def pluck_synth(freq, seconds):
    """A bright pluck: a few odd and even harmonics that fade faster the higher they are."""
    t = times(seconds)
    tone = sum(np.sin(2 * np.pi * freq * k * t) * np.exp(-t * (6 + 5 * k)) / k for k in range(1, 7))
    return tone * np.minimum(1, t / 0.004)


def pad(freq, seconds):
    """A wide pad: three slightly detuned voices that swell in and out."""
    t = times(seconds)
    tone = sum(np.sin(2 * np.pi * freq * (1 + d) * t) for d in (-0.004, 0, 0.0045)) / 3
    swell = np.minimum(1, t / 1.6) * np.minimum(1, (seconds - t) / 1.6)
    return tone * swell


def bell(freq, seconds):
    t = times(seconds)
    tone = np.sin(2 * np.pi * freq * t) + 0.4 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 3)
    return tone * envelope(t, 0.003, 1.2)


def string(freq, seconds, rng, bright=0.5):
    """A plucked string, Karplus-Strong: a burst of noise round a delay line the length of one period."""
    period = max(2, int(RATE / freq))
    out = np.zeros(int(RATE * seconds))
    line = rng.uniform(-1, 1, period)
    # A darker pick for a softer, nylon-like tone.
    for _ in range(int(3 * (1 - bright)) + 1):
        line = (line + np.roll(line, 1)) / 2
    index = 0
    for i in range(len(out)):
        value = line[index]
        nxt = line[(index + 1) % period]
        line[index] = 0.996 * 0.5 * (value + nxt)
        out[i] = value
        index = (index + 1) % period
    return out


def kick(seconds=0.35, depth=90):
    t = times(seconds)
    return np.sin(2 * np.pi * (48 + depth * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.13)


def noise_hit(rng, seconds, decay, high=True):
    n = rng.normal(0, 1, int(RATE * seconds)) * np.exp(-times(seconds) / decay)
    return np.diff(n, prepend=0) if high else n


def finish(track, rng):
    track += rng.normal(0, 0.002, len(track))
    fade = int(RATE * 1.5)
    track[:fade] *= np.linspace(0, 1, fade)
    track[-fade * 2:] *= np.linspace(1, 0, fade * 2)
    # A gentle limiter, then headroom.
    track = np.tanh(track / np.max(np.abs(track)) * 1.6) / np.tanh(1.6)
    return track * 0.82


def late_night(rng):
    """Lo-fi: warm keys on Fmaj7, Em7, Dm7, Cmaj7 at 84 bpm, a soft kick, brushed hats and a round bass."""
    beat = 60 / 84
    track = np.zeros(LENGTH)
    chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
    roots = [41, 40, 38, 36]
    for bar in range(int(SECONDS / (beat * 4)) + 1):
        at = bar * beat * 4
        for hit in (0, 1.5, 2.5):
            for i, note in enumerate(chords[bar % 4]):
                place(track, keys(hz(note), beat * 2.2), at + hit * beat + i * 0.012, 0.075)
        for hit in (0, 2, 3.5):
            place(track, keys(hz(roots[bar % 4]), beat * 1.6, 0.5), at + hit * beat, 0.22)
        for hit in (0, 2.5):
            place(track, kick(), at + hit * beat, 0.5)
        for step in range(8):
            place(track, noise_hit(rng, 0.06, 0.015), at + step * beat / 2 + (0.03 if step % 2 else 0), 0.05 if step % 2 else 0.08)
        for hit in (1, 3):
            place(track, noise_hit(rng, 0.18, 0.05, high=False), at + hit * beat, 0.09)
    return track


def sunny_side(rng):
    """Upbeat: C, G, Am, F at 112 bpm, a plucked arpeggio in eighths, four on the floor, claps on two and four."""
    beat = 60 / 112
    track = np.zeros(LENGTH)
    chords = [[60, 64, 67, 72], [59, 62, 67, 71], [57, 60, 64, 69], [57, 60, 65, 69]]
    roots = [36, 43, 45, 41]
    pattern = [0, 1, 2, 3, 2, 1, 2, 3]
    for bar in range(int(SECONDS / (beat * 4)) + 1):
        at = bar * beat * 4
        chord = chords[bar % 4]
        for step, index in enumerate(pattern):
            place(track, pluck_synth(hz(chord[index]), beat * 0.9), at + step * beat / 2, 0.11)
        for hit in range(4):
            place(track, kick(0.3, 70), at + hit * beat, 0.42)
            place(track, noise_hit(rng, 0.05, 0.012), at + hit * beat + beat / 2, 0.07)
        for hit in (1, 3):
            # A clap is three bursts a few milliseconds apart.
            for delay in (0, 0.008, 0.017):
                place(track, noise_hit(rng, 0.12, 0.03, high=False), at + hit * beat + delay, 0.05)
        for step in range(8):
            place(track, keys(hz(roots[bar % 4] + (12 if step % 2 else 0)), beat * 0.45, 0.25), at + step * beat / 2, 0.2)
    return track


def open_sky(rng):
    """Ambient: slow pads on Dmaj9, Bm9, Gmaj7 and A6sus at 70 bpm, a few bell notes from the pentatonic over them."""
    beat = 60 / 70
    bar = beat * 4
    track = np.zeros(LENGTH)
    chords = [[50, 57, 61, 64, 66], [47, 54, 57, 61, 62], [43, 50, 54, 59, 62], [45, 52, 54, 59, 62]]
    scale = [74, 76, 78, 81, 83, 86]
    for index in range(int(SECONDS / bar) + 1):
        at = index * bar
        for note in chords[index % 4]:
            place(track, pad(hz(note), bar * 1.25), at, 0.06)
        for step in range(4):
            if rng.random() < 0.45:
                place(track, bell(hz(scale[rng.integers(len(scale))]), 2.5), at + step * beat + rng.uniform(0, 0.15), 0.07)
    swell = rng.normal(0, 1, LENGTH)
    for _ in range(6):
        swell = (swell + np.roll(swell, 1)) / 2
    track += swell * 0.01 * (1 + np.sin(2 * np.pi * np.arange(LENGTH) / RATE / 16)) / 2
    return track


def front_porch(rng):
    """Acoustic: a picked steel string on G, D, Em and C at 96 bpm, a bass note on each beat's first half, a shaker."""
    beat = 60 / 96
    track = np.zeros(LENGTH)
    chords = [[55, 59, 62, 67], [54, 57, 62, 66], [52, 55, 59, 64], [52, 55, 60, 64]]
    basses = [[43, 50], [38, 45], [40, 47], [36, 43]]
    cache = {}

    def picked(note):
        if note not in cache:
            cache[note] = string(hz(note), 1.6, rng, 0.4)
        return cache[note]

    for bar in range(int(SECONDS / (beat * 4)) + 1):
        at = bar * beat * 4
        chord, bass = chords[bar % 4], basses[bar % 4]
        for hit in range(4):
            place(track, picked(bass[hit % 2]), at + hit * beat, 0.32)
            for step, index in enumerate((1, 2, 3, 2)):
                place(track, picked(chord[index]), at + hit * beat + (step + 1) * beat / 4 - beat / 8, 0.16)
        for step in range(8):
            place(track, noise_hit(rng, 0.08, 0.02), at + step * beat / 2, 0.035 if step % 2 else 0.05)
    return track


TRACKS = {"late-night": late_night, "sunny-side": sunny_side, "open-sky": open_sky, "front-porch": front_porch}

if __name__ == "__main__":
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for name, make in TRACKS.items():
        samples = finish(make(np.random.default_rng(len(name))), np.random.default_rng(1))
        with wave.open(str(out / f"{name}.wav"), "wb") as file:
            file.setnchannels(1)
            file.setsampwidth(2)
            file.setframerate(RATE)
            file.writeframes((samples * 32767).astype("<i2").tobytes())
        print(f"{name}: {len(samples) / RATE:.0f} s")
