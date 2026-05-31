from hand_instrument.protocol import chord_payload
from hand_instrument.state import PlaybackState


def test_chord_payload_contains_frontend_fields() -> None:
    payload = chord_payload(
        PlaybackState(
            root_index=0,
            quality="major",
            muted=False,
            chord_name="C major",
        )
    )

    assert payload == {
        "type": "chord",
        "rootIndex": 0,
        "root": "C",
        "quality": "major",
        "qualityLabel": "major",
        "chord": "C major",
        "midiNotes": [60, 64, 67],
        "frequencies": [261.63, 329.63, 392.0],
        "muted": False,
    }


def test_chord_payload_mutes_without_notes() -> None:
    payload = chord_payload(
        PlaybackState(
            root_index=None,
            quality="major",
            muted=True,
            chord_name="Muted",
        )
    )

    assert payload["rootIndex"] is None
    assert payload["root"] == "-"
    assert payload["midiNotes"] == []
    assert payload["frequencies"] == []
    assert payload["muted"] is True
