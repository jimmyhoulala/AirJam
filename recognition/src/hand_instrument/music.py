from __future__ import annotations

from math import pow


ROOT_NAMES = (
    "C",
    "C#/Db",
    "D",
    "D#/Eb",
    "E",
    "F",
    "F#/Gb",
    "G",
    "G#/Ab",
    "A",
    "A#/Bb",
    "B",
)

QUALITY_INTERVALS = {
    "major": (0, 4, 7),
    "minor": (0, 3, 7),
    "diminished": (0, 3, 6),
    "dominant seventh": (0, 4, 7, 10),
    "major seventh": (0, 4, 7, 11),
}

QUALITY_LABELS = {
    "major": "major",
    "minor": "minor",
    "diminished": "diminished",
    "dominant seventh": "7",
    "major seventh": "maj7",
    "mute": "mute",
}

QUALITY_NAMES = tuple(QUALITY_INTERVALS.keys())

def root_name(root_index: int | None) -> str:
    if root_index is None:
        return "-"
    return ROOT_NAMES[root_index % len(ROOT_NAMES)]


def chord_midi_notes(root_index: int | None, quality: str, base_octave: int = 4) -> list[int]:
    if root_index is None or quality == "mute":
        return []
    if quality not in QUALITY_INTERVALS:
        raise ValueError(f"Unsupported chord quality: {quality}")

    root_midi = 12 * (base_octave + 1) + (root_index % len(ROOT_NAMES))
    return [root_midi + interval for interval in QUALITY_INTERVALS[quality]]


def midi_to_frequency(midi_note: int) -> float:
    return 440.0 * pow(2.0, (midi_note - 69) / 12.0)


def root_frequency(root_index: int, base_octave: int = 4) -> float:
    return midi_to_frequency(12 * (base_octave + 1) + (root_index % len(ROOT_NAMES)))


def chord_frequencies(root_index: int | None, quality: str, base_octave: int = 4) -> list[float]:
    return [midi_to_frequency(note) for note in chord_midi_notes(root_index, quality, base_octave)]


def quality_label(quality: str) -> str:
    return QUALITY_LABELS.get(quality, quality)


def chord_label(root_index: int | None, quality: str) -> str:
    if root_index is None or quality == "mute":
        return "Muted"
    label = QUALITY_LABELS.get(quality, quality)
    return f"{root_name(root_index)} {label}"
