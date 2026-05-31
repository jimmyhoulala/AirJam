from pytest import approx

from hand_instrument.music import (
    ROOT_NAMES,
    chord_label,
    chord_midi_notes,
    midi_to_frequency,
    root_frequency,
)


def test_root_names_cover_chromatic_scale() -> None:
    assert len(ROOT_NAMES) == 12
    assert ROOT_NAMES[0] == "C"
    assert ROOT_NAMES[11] == "B"


def test_chord_intervals() -> None:
    assert chord_midi_notes(0, "major") == [60, 64, 67]
    assert chord_midi_notes(0, "minor") == [60, 63, 67]
    assert chord_midi_notes(0, "diminished") == [60, 63, 66]
    assert chord_midi_notes(0, "dominant seventh") == [60, 64, 67, 70]
    assert chord_midi_notes(0, "major seventh") == [60, 64, 67, 71]
    assert chord_midi_notes(0, "mute") == []


def test_frequencies() -> None:
    assert midi_to_frequency(69) == approx(440.0)
    assert root_frequency(9) == approx(440.0)


def test_chord_label() -> None:
    assert chord_label(0, "major") == "C major"
    assert chord_label(1, "dominant seventh") == "C#/Db 7"
    assert chord_label(None, "major") == "Muted"
