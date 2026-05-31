from hand_instrument.state import InstrumentController, InstrumentSwitchController, StableValue


def test_stable_value_requires_repeated_candidate() -> None:
    stable = StableValue(initial=None, stable_frames=3)
    assert stable.update(2) is None
    assert stable.update(2) is None
    assert stable.update(2) == 2


def test_controller_smooths_root_and_quality() -> None:
    controller = InstrumentController(stable_frames=2)
    first = controller.update(0, "major")
    assert first.muted is True
    second = controller.update(0, "major")
    assert second.root_index == 0
    assert second.quality == "major"
    assert second.muted is False
    assert second.chord_name == "C major"


def test_controller_handles_mute_gesture() -> None:
    controller = InstrumentController(stable_frames=1)
    playback = controller.update(0, "mute")
    assert playback.quality == "mute"
    assert playback.muted is True
    assert playback.chord_name == "Muted"


def test_controller_mutes_after_root_disappears() -> None:
    controller = InstrumentController(stable_frames=1, missing_root_frames=2)
    assert controller.update(0, "major").muted is False
    assert controller.update(None, "major").muted is False
    assert controller.update(None, "major").muted is True


def test_controller_keeps_wheel_quality_when_left_hand_leaves() -> None:
    controller = InstrumentController(stable_frames=1, default_quality="major")
    assert controller.update(0, "minor").quality == "minor"
    assert controller.update(0, None).quality == "minor"
    assert controller.update(0, None).quality == "minor"


def test_instrument_switch_requires_repeated_candidate() -> None:
    controller = InstrumentSwitchController(initial="piano", stable_frames=3)
    assert controller.update("guitar") is None
    assert controller.update("guitar") is None
    assert controller.update("guitar") == "guitar"
    assert controller.current == "guitar"
    assert controller.update("guitar") is None
