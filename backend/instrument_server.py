import argparse
import asyncio
import base64
from dataclasses import dataclass
from pathlib import Path
import os
import platform
import shutil
import socket
import subprocess
import sys
import threading
import time


PROJECT_ROOT = Path(__file__).resolve().parents[1]
HARDWARE_APP_DIR = PROJECT_ROOT / "hardware" / "maixcam"
if str(HARDWARE_APP_DIR) not in sys.path:
    sys.path.insert(0, str(HARDWARE_APP_DIR))

from face_tracking.note_output import (  # noqa: E402
    parse_drum_hit_event,
    parse_guitar_chord_event,
    parse_heartbeat_event,
    parse_instrument_note_event,
    parse_mode_event,
)


DEFAULT_PORT = 5020
INSTRUMENTS_DIR = PROJECT_ROOT / "hardware" / "pc_runtime" / "instruments"
DEFAULT_DRUM_SF2 = INSTRUMENTS_DIR / "drums" / "Shino Drums(sf2)" / "02_Shino_Snare.sf2"
DEFAULT_DRUM_SAMPLE_DIR = INSTRUMENTS_DIR / "drums" / "Shino Drums(sf2)" / "snare_samples"
DEFAULT_GM_SF2 = INSTRUMENTS_DIR / "pianos" / "SalamanderGrandPiano-V3" / "SalamanderGrandPiano-V3+20200602.sf2"
DEFAULT_PIANO_SAMPLE_DIR = INSTRUMENTS_DIR / "pianos" / "SalamanderGrandPiano-V3" / "samples"
DEFAULT_ELECTRIC_GUITAR_SF2 = (
    INSTRUMENTS_DIR
    / "guitars"
    / "Bread Breads Distortion Guitar"
    / "Bread Breads Distortion Guitar v2.1.sf2"
)
DEFAULT_ACOUSTIC_GUITAR_SF2 = (
    INSTRUMENTS_DIR
    / "guitars"
    / "acoustic_guitar"
    / "FSS-SteelStringGuitar-20200521.sf2"
)
DEFAULT_ELECTRIC_GUITAR_SAMPLE_DIR = (
    INSTRUMENTS_DIR / "guitars" / "Bread Breads Distortion Guitar" / "strums"
)
DEFAULT_ACOUSTIC_GUITAR_SAMPLE_DIR = INSTRUMENTS_DIR / "guitars" / "acoustic_guitar" / "strums"

SNARE_MIDI_NOTE = 40
SNARE_BANK = 0
SNARE_PRESET = 2
SNARE_VELOCITIES = {
    "ghost": 42,
    "soft": 52,
    "normal": 90,
    "hard": 118,
    "accent": 127,
}
SNARE_SAMPLE_ALIASES = {
    "soft": "ghost",
    "hard": "accent",
}

CHANNELS = {
    "piano": 0,
    "electric_guitar": 1,
    "acoustic_guitar": 2,
    "drums": 9,
}

INSTRUMENT_LABELS = {
    "drums": "鼓",
    "electric_guitar": "电吉他",
    "acoustic_guitar": "木吉他",
    "piano": "钢琴",
}

ELECTRIC_GUITAR_CHORDS = {
    "C5": [48, 55, 60],
    "D5": [50, 57, 62],
    "E5": [52, 59, 64],
    "F5": [53, 60, 65],
    "G5": [55, 62, 67],
    "A5": [57, 64, 69],
    "Bb5": [58, 65, 70],
    "B5": [59, 66, 71],
}

ACOUSTIC_GUITAR_CHORDS = {
    "C": [48, 52, 55, 60, 64],
    "G": [43, 47, 50, 55, 59, 67],
    "Am": [45, 52, 57, 60, 64],
    "F": [41, 48, 53, 57, 60, 65],
    "D": [50, 57, 62, 66],
    "Em": [40, 47, 52, 55, 59, 64],
    "A": [45, 52, 57, 61, 64],
    "E": [40, 47, 52, 56, 59, 64],
}

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


class InstrumentSynthServer:
    def __init__(
        self,
        drum_sf2=DEFAULT_DRUM_SF2,
        gm_sf2=DEFAULT_GM_SF2,
        electric_guitar_sf2=DEFAULT_ELECTRIC_GUITAR_SF2,
        acoustic_guitar_sf2=DEFAULT_ACOUSTIC_GUITAR_SF2,
        drum_sample_dir=DEFAULT_DRUM_SAMPLE_DIR,
        piano_sample_dir=DEFAULT_PIANO_SAMPLE_DIR,
        electric_guitar_sample_dir=DEFAULT_ELECTRIC_GUITAR_SAMPLE_DIR,
        acoustic_guitar_sample_dir=DEFAULT_ACOUSTIC_GUITAR_SAMPLE_DIR,
        gain=1.2,
        wave_player=None,
        enable_fluidsynth=True,
    ):
        self.current_mode = "selecting"
        self.wave_player = wave_player or SystemWavePlayer()
        self.snare_samples = SnareSampleBank(drum_sample_dir, self.wave_player.play)
        self.piano_samples = PianoSampleBank(piano_sample_dir, self.wave_player.play)
        self.electric_samples = WaveSampleBank(
            electric_guitar_sample_dir,
            ELECTRIC_GUITAR_CHORDS,
            self.wave_player.play,
        )
        self.acoustic_samples = WaveSampleBank(
            acoustic_guitar_sample_dir,
            ACOUSTIC_GUITAR_CHORDS,
            self.wave_player.play,
        )
        self.synth = None
        if enable_fluidsynth:
            self.synth = FluidSynthFallback.try_create(
                drum_sf2=drum_sf2,
                gm_sf2=gm_sf2,
                electric_guitar_sf2=electric_guitar_sf2,
                acoustic_guitar_sf2=acoustic_guitar_sf2,
                gain=gain,
            )

    def set_mode(self, instrument):
        self.current_mode = instrument
        print(f"mode: {instrument}")

    def play_drum(self, drum, velocity="normal"):
        if drum != "snare":
            print(f"unknown drum: {drum}")
            return
        if self.snare_samples.play(velocity):
            return
        if self.synth:
            midi_velocity = SNARE_VELOCITIES.get(velocity, SNARE_VELOCITIES["normal"])
            self.synth.play_note(CHANNELS["drums"], SNARE_MIDI_NOTE, 90, velocity=midi_velocity)

    def play_note(self, instrument, midi, duration_ms):
        if instrument == "piano" and self.piano_samples.play(midi):
            return
        if self.synth and instrument in CHANNELS:
            self.synth.play_note(CHANNELS[instrument], midi, duration_ms)

    def play_guitar_chord(self, instrument, chord, direction):
        if instrument == "electric_guitar" and self.electric_samples.play(chord, direction):
            return
        if instrument == "acoustic_guitar" and self.acoustic_samples.play(chord, direction):
            return
        if self.synth:
            notes = _notes_for_guitar_chord(instrument, chord)
            if notes:
                self.synth.strum_notes(CHANNELS[instrument], notes, direction)

    def close(self):
        self.wave_player.close()
        if self.synth:
            self.synth.close()


class FluidSynthFallback:
    def __init__(self, synth):
        self.synth = synth

    @classmethod
    def try_create(
        cls,
        drum_sf2,
        gm_sf2,
        electric_guitar_sf2,
        acoustic_guitar_sf2,
        gain=1.2,
    ):
        try:
            import fluidsynth
        except ModuleNotFoundError:
            print("FluidSynth optional backend not installed; WAV samples will be used.")
            return None

        synth = fluidsynth.Synth(gain=gain)
        try:
            _start_fluidsynth_audio_driver(synth)
            _load_program(synth, drum_sf2, CHANNELS["drums"], SNARE_BANK, SNARE_PRESET, "drum")
            _load_program(synth, gm_sf2, CHANNELS["piano"], 0, 0, "piano")
            _load_program(
                synth,
                electric_guitar_sf2,
                CHANNELS["electric_guitar"],
                0,
                0,
                "electric guitar",
            )
            _load_program(
                synth,
                acoustic_guitar_sf2,
                CHANNELS["acoustic_guitar"],
                0,
                0,
                "acoustic guitar",
                required=False,
            )
            return cls(synth)
        except Exception as exc:
            print(f"FluidSynth backend disabled: {exc}")
            try:
                synth.delete()
            except Exception:
                pass
            return None

    def play_note(self, channel, midi, duration_ms, velocity=127):
        self.synth.noteon(channel, midi, velocity)
        threading.Thread(target=self._noteoff_later, args=(channel, midi, duration_ms), daemon=True).start()

    def strum_notes(self, channel, notes, direction):
        ordered = notes if direction == "down" else list(reversed(notes))
        threading.Thread(target=self._strum_notes, args=(channel, ordered), daemon=True).start()

    def close(self):
        self.synth.delete()

    def _noteoff_later(self, channel, midi, duration_ms):
        time.sleep(duration_ms / 1000)
        self.synth.noteoff(channel, midi)

    def _strum_notes(self, channel, notes):
        active = []
        for midi in notes:
            self.synth.noteon(channel, midi, 127)
            active.append(midi)
            time.sleep(0.018)
        time.sleep(0.22)
        for midi in active:
            self.synth.noteoff(channel, midi)


class SystemWavePlayer:
    def __init__(self):
        self._pygame = None
        self._sound_cache = {}
        self._init_pygame()

    def play(self, path):
        path = Path(path)
        if self._play_with_pygame(path):
            return
        _play_with_system_player(path)

    def close(self):
        if self._pygame:
            self._pygame.quit()

    def _init_pygame(self):
        try:
            import pygame

            pygame.mixer.pre_init(44100, -16, 2, 256)
            pygame.init()
            pygame.mixer.set_num_channels(32)
            self._pygame = pygame
            print("audio backend: pygame WAV cache")
        except Exception as exc:
            self._pygame = None
            print(f"pygame audio backend unavailable: {exc}")

    def _play_with_pygame(self, path):
        if not self._pygame:
            return False
        try:
            sound = self._sound_cache.get(path)
            if sound is None:
                sound = self._pygame.mixer.Sound(str(path))
                self._sound_cache[path] = sound
            sound.play()
            return True
        except Exception as exc:
            print(f"pygame failed for {path}: {exc}")
            return False


class WaveSampleBank:
    def __init__(self, sample_dir, chord_notes, player=None):
        self.sample_dir = Path(sample_dir)
        self.chord_notes = chord_notes
        self.player = player or _play_with_system_player
        self.samples = {
            (chord, direction): self.sample_dir / f"{chord}_{direction}.wav"
            for chord in chord_notes
            for direction in ("down", "up")
        }

    def play(self, chord, direction):
        path = self.samples.get((chord, direction))
        if path is None or not path.exists():
            return False
        self.player(path)
        return True


class SnareSampleBank:
    def __init__(self, sample_dir, player=None):
        self.sample_dir = Path(sample_dir)
        self.player = player or _play_with_system_player
        self.samples = {
            velocity: self.sample_dir / f"{velocity}.wav"
            for velocity in ("ghost", "normal", "accent")
        }

    def play(self, velocity):
        sample_velocity = velocity if velocity in self.samples else SNARE_SAMPLE_ALIASES.get(velocity)
        path = self.samples.get(sample_velocity)
        if path is None or not path.exists():
            return False
        self.player(path)
        return True


class PianoSampleBank:
    def __init__(self, sample_dir, player=None):
        self.sample_dir = Path(sample_dir)
        self.player = player or _play_with_system_player

    def play(self, midi):
        path = self.sample_dir / f"{int(midi):03d}.wav"
        if not path.exists():
            return False
        self.player(path)
        return True


@dataclass
class HardwareEventRouter:
    audio: InstrumentSynthServer
    timeout_seconds: float = 3.0
    last_seen: float = 0.0
    last_address: tuple | None = None
    current_mode: str = "selecting"
    frame_assembler: object = None

    def __post_init__(self):
        if self.frame_assembler is None:
            self.frame_assembler = FrameAssembler()

    def handle_payload(self, payload, address):
        self._mark_seen(address)
        frame = self.frame_assembler.accept(payload, address)
        if frame:
            return [self.status_message(), frame]
        if frame is False:
            return [self.status_message()]

        heartbeat = parse_heartbeat_event(payload)
        if heartbeat:
            self.current_mode = heartbeat.mode or self.current_mode
            return [self.status_message()]

        mode = parse_mode_event(payload)
        if mode:
            self.current_mode = mode.instrument
            self.audio.set_mode(mode.instrument)
            print(f"hardware mode {mode.instrument} from {address}")
            return [
                self.status_message(),
                {
                    "type": "instrument",
                    "instrument": mode.instrument,
                    "label": INSTRUMENT_LABELS.get(mode.instrument, mode.instrument),
                },
            ]

        hit = parse_drum_hit_event(payload)
        if hit:
            self.current_mode = "drums"
            print(f"hardware hit {hit.drum} {hit.velocity} power={hit.power} from {address}")
            self.audio.play_drum(hit.drum, hit.velocity)
            return [
                self.status_message(),
                {
                    "type": "drum",
                    "instrument": "drums",
                    "drum": hit.drum,
                    "articulation": hit.articulation,
                    "velocity": hit.velocity,
                    "power": hit.power,
                },
            ]

        note = parse_instrument_note_event(payload)
        if note:
            instrument = _instrument_from_note_payload(payload)
            if instrument:
                self.current_mode = instrument
                print(f"hardware note {instrument} midi={note.midi} duration={note.duration_ms} from {address}")
                self.audio.play_note(instrument, note.midi, note.duration_ms)
                return [
                    self.status_message(),
                    {
                        "type": "note",
                        "instrument": instrument,
                        "note": midi_to_name(note.midi),
                        "midi": note.midi,
                        "durationMs": note.duration_ms,
                        "frequency": midi_to_frequency(note.midi),
                    },
                ]

        guitar = parse_guitar_chord_event(payload)
        if guitar:
            self.current_mode = guitar.instrument
            print(f"hardware guitar {guitar.instrument} {guitar.chord} {guitar.direction} from {address}")
            self.audio.play_guitar_chord(guitar.instrument, guitar.chord, guitar.direction)
            notes = _notes_for_guitar_chord(guitar.instrument, guitar.chord) or []
            return [
                self.status_message(),
                {
                    "type": "chord",
                    "instrument": guitar.instrument,
                    "root": guitar.chord,
                    "quality": "strum",
                    "qualityLabel": guitar.direction,
                    "chord": f"{guitar.chord} {guitar.direction}",
                    "midiNotes": notes,
                    "frequencies": [midi_to_frequency(midi) for midi in notes],
                    "muted": False,
                },
            ]

        print(f"ignored from {address}: {payload!r}")
        return [self.status_message()]

    def is_connected(self):
        return self.last_seen > 0 and time.monotonic() - self.last_seen <= self.timeout_seconds

    def status_message(self, connected=None):
        connected = self.is_connected() if connected is None else connected
        host, port = self.last_address if self.last_address else ("-", "-")
        return {
            "type": "hardware_status",
            "connected": connected,
            "name": "MaixCAM2",
            "source": "udp",
            "address": f"{host}:{port}",
            "mode": self.current_mode,
        }

    def _mark_seen(self, address):
        self.last_seen = time.monotonic()
        self.last_address = address


class FrameAssembler:
    def __init__(self, max_age_seconds=1.5):
        self.max_age_seconds = max_age_seconds
        self.frames = {}

    def accept(self, payload, address):
        if not isinstance(payload, bytes) or not payload.startswith(b"FRAME|"):
            return None
        parts = payload.split(b"|", 4)
        if len(parts) != 5:
            return False
        try:
            sequence = int(parts[1])
            index = int(parts[2])
            total = int(parts[3])
        except ValueError:
            return False
        if total <= 0 or index < 0 or index >= total:
            return False

        now = time.monotonic()
        self._drop_stale(now)
        key = (address, sequence)
        state = self.frames.setdefault(
            key,
            {
                "created": now,
                "total": total,
                "chunks": {},
            },
        )
        if state["total"] != total:
            self.frames.pop(key, None)
            return False
        state["chunks"][index] = parts[4]
        if len(state["chunks"]) != total:
            return False

        data = b"".join(state["chunks"][chunk_index] for chunk_index in range(total))
        self.frames.pop(key, None)
        if not data.startswith(b"\xff\xd8"):
            return False
        encoded = base64.b64encode(data).decode("ascii")
        return {
            "type": "camera_frame",
            "mime": "image/jpeg",
            "dataUrl": f"data:image/jpeg;base64,{encoded}",
            "sequence": sequence,
            "bytes": len(data),
        }

    def _drop_stale(self, now):
        stale_keys = [
            key
            for key, state in self.frames.items()
            if now - state["created"] > self.max_age_seconds
        ]
        for key in stale_keys:
            self.frames.pop(key, None)


class HardwareUdpProtocol(asyncio.DatagramProtocol):
    def __init__(self, router, broadcast_callback):
        self.router = router
        self.broadcast_callback = broadcast_callback

    def datagram_received(self, data, address):
        messages = self.router.handle_payload(data, address)
        loop = asyncio.get_running_loop()
        for message in messages:
            loop.create_task(self.broadcast_callback(message))


async def start_hardware_udp_server(host, port, router, broadcast_callback):
    loop = asyncio.get_running_loop()
    transport, _ = await loop.create_datagram_endpoint(
        lambda: HardwareUdpProtocol(router, broadcast_callback),
        local_addr=(host, port),
    )
    print(f"硬件 UDP 音频/事件服务已启动: udp://{host}:{port}")
    return transport


async def hardware_presence_loop(router, broadcast_callback, interval=1.0):
    previous = None
    while True:
        connected = router.is_connected()
        if connected != previous:
            await broadcast_callback(router.status_message(connected=connected))
            previous = connected
        await asyncio.sleep(interval)


def serve(
    host,
    port,
    drum_sf2=DEFAULT_DRUM_SF2,
    gm_sf2=DEFAULT_GM_SF2,
    electric_guitar_sf2=DEFAULT_ELECTRIC_GUITAR_SF2,
    acoustic_guitar_sf2=DEFAULT_ACOUSTIC_GUITAR_SF2,
    drum_sample_dir=DEFAULT_DRUM_SAMPLE_DIR,
    piano_sample_dir=DEFAULT_PIANO_SAMPLE_DIR,
    electric_guitar_sample_dir=DEFAULT_ELECTRIC_GUITAR_SAMPLE_DIR,
    acoustic_guitar_sample_dir=DEFAULT_ACOUSTIC_GUITAR_SAMPLE_DIR,
    gain=1.2,
):
    audio = InstrumentSynthServer(
        drum_sf2=drum_sf2,
        gm_sf2=gm_sf2,
        electric_guitar_sf2=electric_guitar_sf2,
        acoustic_guitar_sf2=acoustic_guitar_sf2,
        drum_sample_dir=drum_sample_dir,
        piano_sample_dir=piano_sample_dir,
        electric_guitar_sample_dir=electric_guitar_sample_dir,
        acoustic_guitar_sample_dir=acoustic_guitar_sample_dir,
        gain=gain,
    )
    router = HardwareEventRouter(audio)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((host, port))
    print(f"Instrument server listening on {host}:{port}")
    try:
        while True:
            payload, address = sock.recvfrom(256)
            for message in router.handle_payload(payload, address):
                print(message)
    except KeyboardInterrupt:
        print("stopping")
    finally:
        sock.close()
        audio.close()


def midi_to_name(midi):
    return f"{NOTE_NAMES[midi % 12]}{midi // 12 - 1}"


def midi_to_frequency(midi):
    return 440.0 * (2 ** ((midi - 69) / 12))


def _instrument_from_note_payload(payload):
    if isinstance(payload, bytes):
        payload = payload.decode("ascii", "ignore")
    parts = str(payload).strip().split("|")
    if len(parts) == 4 and parts[0] == "NOTE":
        return parts[1]
    return None


def _notes_for_guitar_chord(instrument, chord):
    if instrument == "electric_guitar":
        return ELECTRIC_GUITAR_CHORDS.get(chord)
    if instrument == "acoustic_guitar":
        return ACOUSTIC_GUITAR_CHORDS.get(chord)
    return None


def _start_fluidsynth_audio_driver(synth):
    last_error = None
    for audio_driver in _fluidsynth_driver_candidates():
        try:
            synth.start(driver=audio_driver, midi_driver=None)
            print(f"FluidSynth audio driver: {audio_driver}")
            return
        except Exception as exc:
            last_error = exc
            print(f"FluidSynth driver failed ({audio_driver}): {exc}")
    raise RuntimeError(f"No usable FluidSynth audio driver found: {last_error}")


def _fluidsynth_driver_candidates(system=None):
    system = system or platform.system()
    if system == "Darwin":
        return ("coreaudio",)
    if system == "Windows":
        return ("wasapi", "dsound", "waveout")
    if system == "Linux":
        return ("pulseaudio", "pipewire", "alsa", "jack", "oss")
    return ("pulseaudio", "alsa")


def _load_program(synth, path, channel, bank, preset, label, required=True):
    path = Path(path)
    if not path.exists():
        message = f"{label} soundfont not found: {path}"
        if required:
            print(f"warning: {message}")
        return False
    sfid = synth.sfload(str(path))
    synth.program_select(channel, sfid, bank, preset)
    return True


def _play_with_system_player(path):
    if os.name == "nt":
        import winsound

        winsound.PlaySound(str(path), winsound.SND_FILENAME | winsound.SND_ASYNC)
        return
    command = _system_wave_command(path)
    if command is None:
        print(f"no system WAV player available for {path}")
        return
    subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _system_wave_command(path, system=None, which=shutil.which):
    path = str(path)
    system = system or platform.system()
    if system == "Darwin":
        return ["afplay", path] if which("afplay") else None
    if system == "Linux":
        for player in ("aplay", "paplay"):
            if which(player):
                return [player, path]
        if which("ffplay"):
            return ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", path]
    return None


def main():
    parser = argparse.ArgumentParser(description="Receive MaixCAM2 instrument events and route to audio output.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--drum-sf2", default=DEFAULT_DRUM_SF2)
    parser.add_argument("--drum-sample-dir", default=DEFAULT_DRUM_SAMPLE_DIR)
    parser.add_argument("--gm-sf2", default=DEFAULT_GM_SF2)
    parser.add_argument("--piano-sample-dir", default=DEFAULT_PIANO_SAMPLE_DIR)
    parser.add_argument("--electric-guitar-sf2", default=DEFAULT_ELECTRIC_GUITAR_SF2)
    parser.add_argument("--acoustic-guitar-sf2", default=DEFAULT_ACOUSTIC_GUITAR_SF2)
    parser.add_argument("--electric-guitar-sample-dir", default=DEFAULT_ELECTRIC_GUITAR_SAMPLE_DIR)
    parser.add_argument("--acoustic-guitar-sample-dir", default=DEFAULT_ACOUSTIC_GUITAR_SAMPLE_DIR)
    parser.add_argument("--gain", type=float, default=1.2)
    args = parser.parse_args()
    serve(
        args.host,
        args.port,
        Path(args.drum_sf2).resolve(),
        Path(args.gm_sf2).resolve(),
        Path(args.electric_guitar_sf2).resolve(),
        Path(args.acoustic_guitar_sf2).resolve(),
        Path(args.drum_sample_dir).resolve(),
        Path(args.piano_sample_dir).resolve(),
        Path(args.electric_guitar_sample_dir).resolve(),
        Path(args.acoustic_guitar_sample_dir).resolve(),
        args.gain,
    )


if __name__ == "__main__":
    main()
