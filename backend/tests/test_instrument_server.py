from pathlib import Path

from backend import instrument_server as server


def test_instrument_server_defaults_to_hardware_runtime_paths():
    root = Path(__file__).resolve().parents[2]

    assert server.DEFAULT_PORT == 5020
    assert server.DEFAULT_DRUM_SAMPLE_DIR == root / "hardware" / "pc_runtime" / "instruments" / "drums" / "Shino Drums(sf2)" / "snare_samples"
    assert server.DEFAULT_PIANO_SAMPLE_DIR == root / "hardware" / "pc_runtime" / "instruments" / "pianos" / "SalamanderGrandPiano-V3" / "samples"
    assert server.DEFAULT_ELECTRIC_GUITAR_SAMPLE_DIR == root / "hardware" / "pc_runtime" / "instruments" / "guitars" / "Bread Breads Distortion Guitar" / "strums"
    assert server.DEFAULT_ACOUSTIC_GUITAR_SAMPLE_DIR == root / "hardware" / "pc_runtime" / "instruments" / "guitars" / "acoustic_guitar" / "strums"


def test_audio_driver_candidates_include_macos_coreaudio_and_windows_wasapi():
    assert server._fluidsynth_driver_candidates("Darwin") == ("coreaudio",)
    assert "wasapi" in server._fluidsynth_driver_candidates("Windows")
    assert "alsa" in server._fluidsynth_driver_candidates("Linux")


def test_system_wave_command_uses_native_macos_afplay():
    command = server._system_wave_command("/tmp/test.wav", system="Darwin", which=lambda name: f"/usr/bin/{name}")

    assert command == ["afplay", "/tmp/test.wav"]


def test_router_translates_hardware_note_to_frontend_message():
    played = []

    class FakeAudio:
        def play_note(self, instrument, midi, duration_ms):
            played.append((instrument, midi, duration_ms))

        def play_drum(self, drum, velocity):
            played.append((drum, velocity))

        def play_guitar_chord(self, instrument, chord, direction):
            played.append((instrument, chord, direction))

        def set_mode(self, instrument):
            played.append(("mode", instrument))

    router = server.HardwareEventRouter(FakeAudio())
    messages = router.handle_payload(b"NOTE|piano|60|140", ("10.0.0.2", 50000))

    assert played == [("piano", 60, 140)]
    assert messages[-1]["type"] == "note"
    assert messages[-1]["note"] == "C4"
    assert messages[-1]["instrument"] == "piano"


def test_router_reassembles_camera_frame_chunks():
    class FakeAudio:
        def set_mode(self, instrument):
            pass

    router = server.HardwareEventRouter(FakeAudio())
    frame = b"\xff\xd8" + (b"jpeg" * 300) + b"\xff\xd9"
    first = b"FRAME|7|0|2|" + frame[:800]
    second = b"FRAME|7|1|2|" + frame[800:]

    first_messages = router.handle_payload(first, ("10.0.0.2", 50000))
    second_messages = router.handle_payload(second, ("10.0.0.2", 50000))

    assert first_messages[-1]["type"] == "hardware_status"
    assert second_messages[-1]["type"] == "camera_frame"
    assert second_messages[-1]["dataUrl"].startswith("data:image/jpeg;base64,")
    assert second_messages[-1]["bytes"] == len(frame)


def test_snare_sample_bank_maps_soft_and_hard_to_available_layers(tmp_path):
    played = []
    for name in ("ghost", "normal", "accent"):
        (tmp_path / f"{name}.wav").write_bytes(b"fake")

    bank = server.SnareSampleBank(tmp_path, player=lambda path: played.append(Path(path).name))

    assert bank.play("soft") is True
    assert bank.play("hard") is True
    assert played == ["ghost.wav", "accent.wav"]
