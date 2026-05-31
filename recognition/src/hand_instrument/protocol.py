from __future__ import annotations

from typing import Iterable

from hand_instrument.gestures import Point3D
from hand_instrument.music import (
    chord_frequencies,
    chord_midi_notes,
    quality_label,
    root_name,
)
from hand_instrument.state import PlaybackState


def landmark_payload(landmarks: Iterable[Point3D]) -> list[dict[str, float]]:
    return [
        {"x": float(point.x), "y": float(point.y), "z": float(point.z)}
        for point in landmarks
    ]


def chord_payload(playback: PlaybackState) -> dict[str, object]:
    midi_notes = chord_midi_notes(playback.root_index, playback.quality)
    frequencies = chord_frequencies(playback.root_index, playback.quality)

    return {
        "type": "chord",
        "rootIndex": playback.root_index,
        "root": root_name(playback.root_index),
        "quality": playback.quality,
        "qualityLabel": quality_label(playback.quality),
        "chord": playback.chord_name,
        "midiNotes": midi_notes,
        "frequencies": [round(freq, 2) for freq in frequencies],
        "muted": playback.muted,
    }
