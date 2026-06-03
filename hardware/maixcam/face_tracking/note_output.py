from dataclasses import dataclass
import socket


FRAME_CHUNK_SIZE = 900


@dataclass(frozen=True)
class NoteEvent:
    midi: int
    duration_ms: int


@dataclass(frozen=True)
class DrumHitEvent:
    drum: str
    articulation: str
    velocity: str
    power: int


@dataclass(frozen=True)
class ModeEvent:
    instrument: str


@dataclass(frozen=True)
class GuitarChordEvent:
    instrument: str
    chord: str
    direction: str


@dataclass(frozen=True)
class HeartbeatEvent:
    device: str
    mode: str


KNOWN_INSTRUMENTS = {"drums", "electric_guitar", "acoustic_guitar", "piano"}
MELODIC_INSTRUMENTS = {"electric_guitar", "acoustic_guitar", "piano"}
GUITAR_INSTRUMENTS = {"electric_guitar", "acoustic_guitar"}
ELECTRIC_GUITAR_CHORD_NAMES = {"C5", "D5", "E5", "F5", "G5", "A5", "Bb5", "B5"}
ACOUSTIC_GUITAR_CHORD_NAMES = {"C", "G", "Am", "F", "D", "Em", "A", "E"}


class UdpNoteOutput:
    def __init__(self, host, port=5010, socket_factory=None):
        self.address = (host, port)
        self.socket = (socket_factory or _default_socket_factory)()

    def play_midi(self, midi, duration_ms=160):
        payload = f"NOTE {int(midi)} {int(duration_ms)}".encode("ascii")
        try:
            self.socket.sendto(payload, self.address)
        except OSError:
            return False
        return True


class UdpDrumOutput:
    def __init__(self, host, port=5020, socket_factory=None):
        self.address = (host, port)
        self.socket = (socket_factory or _default_socket_factory)()

    def play_hit(self, drum, articulation, velocity, power):
        payload = f"HIT|{drum}|{articulation}|{velocity}|{int(power)}".encode("ascii")
        try:
            self.socket.sendto(payload, self.address)
        except OSError:
            return False
        return True

    def play_simple_hit(self, drum):
        payload = f"HIT|{drum}".encode("ascii")
        try:
            self.socket.sendto(payload, self.address)
        except OSError:
            return False
        return True


class UdpInstrumentOutput:
    def __init__(self, host, port=5020, socket_factory=None):
        self.address = (host, port)
        self.socket = (socket_factory or _default_socket_factory)()
        self._frame_sequence = 0

    def set_mode(self, instrument):
        payload = f"MODE|{instrument}".encode("ascii")
        try:
            self.socket.sendto(payload, self.address)
        except OSError:
            return False
        return True

    def play_note(self, instrument, midi, duration_ms=160):
        payload = f"NOTE|{instrument}|{int(midi)}|{int(duration_ms)}".encode("ascii")
        try:
            self.socket.sendto(payload, self.address)
        except OSError:
            return False
        return True

    def play_hit(self, drum, articulation, velocity, power):
        payload = f"HIT|{drum}|{articulation}|{velocity}|{int(power)}".encode("ascii")
        try:
            self.socket.sendto(payload, self.address)
        except OSError:
            return False
        return True

    def play_guitar_chord(self, instrument, chord, direction):
        payload = f"GUITAR|{instrument}|{chord}|{direction}".encode("ascii")
        try:
            self.socket.sendto(payload, self.address)
        except OSError:
            return False
        return True

    def send_chord_state(self, instrument, chord):
        """发送当前和弦状态到后端（不触发播放，供自动扫弦使用）"""
        payload = f"CHORD_STATE|{instrument}|{chord}".encode("ascii")
        try:
            self.socket.sendto(payload, self.address)
        except OSError:
            return False
        return True

    def heartbeat(self, mode="-"):
        payload = f"PING|maixcam|{mode or '-'}".encode("ascii")
        try:
            self.socket.sendto(payload, self.address)
        except OSError:
            return False
        return True

    def send_frame(self, frame_bytes):
        if not frame_bytes:
            return False
        self._frame_sequence = (self._frame_sequence + 1) % 100000
        total = (len(frame_bytes) + FRAME_CHUNK_SIZE - 1) // FRAME_CHUNK_SIZE
        for index in range(total):
            start = index * FRAME_CHUNK_SIZE
            chunk = frame_bytes[start:start + FRAME_CHUNK_SIZE]
            header = f"FRAME|{self._frame_sequence}|{index}|{total}|".encode("ascii")
            try:
                self.socket.sendto(header + chunk, self.address)
            except OSError:
                return False
        return True

    def play_simple_hit(self, drum):
        payload = f"HIT|{drum}".encode("ascii")
        try:
            self.socket.sendto(payload, self.address)
        except OSError:
            return False
        return True


def parse_note_event(message):
    if isinstance(message, bytes):
        message = message.decode("ascii", "ignore")
    parts = str(message).strip().split()
    if len(parts) != 3 or parts[0] != "NOTE":
        return None
    try:
        midi = int(parts[1])
        duration_ms = int(parts[2])
    except ValueError:
        return None
    if not 0 <= midi <= 127 or duration_ms <= 0:
        return None
    return NoteEvent(midi=midi, duration_ms=duration_ms)


def parse_chord_state_event(message):
    """解析 CHORD_STATE 消息（仅更新和弦状态，不触发播放）"""
    if isinstance(message, bytes):
        message = message.decode("ascii", "ignore")
    parts = str(message).strip().split("|")
    if len(parts) != 3 or parts[0] != "CHORD_STATE":
        return None
    instrument = parts[1]
    chord = parts[2]
    if instrument not in GUITAR_INSTRUMENTS:
        return None
    return {"instrument": instrument, "chord": chord}


def parse_mode_event(message):
    if isinstance(message, bytes):
        message = message.decode("ascii", "ignore")
    parts = str(message).strip().split("|")
    if len(parts) != 2 or parts[0] != "MODE":
        return None
    if parts[1] not in KNOWN_INSTRUMENTS:
        return None
    return ModeEvent(parts[1])


def parse_heartbeat_event(message):
    if isinstance(message, bytes):
        message = message.decode("ascii", "ignore")
    parts = str(message).strip().split("|")
    if len(parts) < 2 or parts[0] != "PING":
        return None
    device = parts[1] or "maixcam"
    mode = parts[2] if len(parts) >= 3 else "-"
    return HeartbeatEvent(device=device, mode=mode)


def parse_instrument_note_event(message):
    if isinstance(message, bytes):
        message = message.decode("ascii", "ignore")
    parts = str(message).strip().split("|")
    if len(parts) != 4 or parts[0] != "NOTE":
        return None
    try:
        midi = int(parts[2])
        duration_ms = int(parts[3])
    except ValueError:
        return None
    if parts[1] not in MELODIC_INSTRUMENTS or not 0 <= midi <= 127 or duration_ms <= 0:
        return None
    return NoteEvent(midi=midi, duration_ms=duration_ms)


def parse_guitar_chord_event(message):
    if isinstance(message, bytes):
        message = message.decode("ascii", "ignore")
    parts = str(message).strip().split("|")
    if len(parts) != 4 or parts[0] != "GUITAR":
        return None
    instrument, chord, direction = parts[1], parts[2], parts[3]
    if instrument not in GUITAR_INSTRUMENTS:
        return None
    allowed_chords = ACOUSTIC_GUITAR_CHORD_NAMES if instrument == "acoustic_guitar" else ELECTRIC_GUITAR_CHORD_NAMES
    if chord not in allowed_chords:
        return None
    if direction not in {"down", "up"}:
        return None
    return GuitarChordEvent(instrument, chord, direction)


def parse_drum_hit_event(message):
    if isinstance(message, bytes):
        message = message.decode("ascii", "ignore")
    parts = str(message).strip().split("|")
    if len(parts) == 2 and parts[0] == "HIT":
        return DrumHitEvent(drum=parts[1], articulation="hit", velocity="normal", power=1000)
    if len(parts) != 5 or parts[0] != "HIT":
        return None
    _, drum, articulation, velocity, power_text = parts
    if velocity not in {"ghost", "soft", "normal", "hard", "accent"}:
        return None
    try:
        power = int(power_text)
    except ValueError:
        return None
    return DrumHitEvent(drum=drum, articulation=articulation, velocity=velocity, power=power)


def _default_socket_factory():
    return socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
