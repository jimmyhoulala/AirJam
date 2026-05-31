from __future__ import annotations

import argparse
import asyncio
import json
import time
from pathlib import Path

import cv2
import websockets

from hand_instrument.gestures import count_extended_fingers
from hand_instrument.model import DEFAULT_MODEL_PATH
from hand_instrument.music import quality_label, root_name
from hand_instrument.protocol import chord_payload, landmark_payload
from hand_instrument.regions import (
    instrument_from_point,
    quality_from_wheel_point,
    root_from_point,
)
from hand_instrument.state import InstrumentController, InstrumentSwitchController
from hand_instrument.vision import DetectedHand, HandTracker


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BRIDGE_MODEL_PATH = PROJECT_ROOT / DEFAULT_MODEL_PATH


def _pick_hand(hands: list[DetectedHand], handedness: str) -> DetectedHand | None:
    candidates = [hand for hand in hands if hand.handedness == handedness]
    if not candidates:
        return None
    return max(candidates, key=lambda hand: hand.score)


def _swap_handedness(hands: list[DetectedHand]) -> None:
    for hand in hands:
        hand.handedness = "Left" if hand.handedness == "Right" else "Right"


def _hands_payload(hands: list[DetectedHand]) -> list[dict[str, object]]:
    return [
        {
            "handedness": hand.handedness,
            "score": round(hand.score, 4),
            "landmarks": landmark_payload(hand.landmarks),
        }
        for hand in hands
    ]


class HandInstrumentBridge:
    def __init__(
        self,
        camera: int,
        ws_url: str,
        model_path: Path,
        backend: str = "auto",
        swap_hands: bool = False,
        min_detection_confidence: float = 0.5,
        min_presence_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
        max_fps: float = 30.0,
    ) -> None:
        self.camera = camera
        self.ws_url = ws_url
        self.model_path = model_path.expanduser().resolve()
        self.backend = backend
        self.swap_hands = swap_hands
        self.min_detection_confidence = min_detection_confidence
        self.min_presence_confidence = min_presence_confidence
        self.min_tracking_confidence = min_tracking_confidence
        self.max_fps = max_fps
        self.playback_controller = InstrumentController()
        self.instrument_controller = InstrumentSwitchController(stable_frames=8)
        self._last_chord_signature: tuple[int | None, str, bool] | None = None

    async def run(self) -> None:
        cap = cv2.VideoCapture(self.camera)
        if not cap.isOpened():
            raise RuntimeError(
                f"Could not open camera index {self.camera}. "
                "Try another --camera value, and make sure no browser or meeting app is using it."
            )

        tracker = HandTracker(
            model_path=self.model_path,
            backend=self.backend,
            min_detection_confidence=self.min_detection_confidence,
            min_presence_confidence=self.min_presence_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        )

        print(f"[bridge] camera {self.camera} ready")
        print(f"[bridge] sending gestures to {self.ws_url}")
        try:
            while True:
                try:
                    async with websockets.connect(self.ws_url) as websocket:
                        print(f"[bridge] connected: {self.ws_url}")
                        await self._stream_frames(cap, tracker, websocket)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    print(f"[bridge] WebSocket disconnected: {exc}. Retrying in 2s...")
                    await asyncio.sleep(2.0)
        finally:
            tracker.close()
            cap.release()

    async def _stream_frames(self, cap, tracker: HandTracker, websocket) -> None:
        fps_interval = 1.0 / self.max_fps if self.max_fps > 0 else 0.0
        last_frame_started = 0.0

        while True:
            now = time.perf_counter()
            sleep_for = fps_interval - (now - last_frame_started)
            if sleep_for > 0:
                await asyncio.sleep(sleep_for)
            last_frame_started = time.perf_counter()

            ok, frame = cap.read()
            if not ok:
                raise RuntimeError("Camera stopped returning frames.")

            frame = cv2.flip(frame, 1)
            height, width = frame.shape[:2]
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            timestamp_ms = int(time.monotonic() * 1000)
            hands = tracker.detect(rgb_frame, timestamp_ms)
            if self.swap_hands:
                _swap_handedness(hands)

            gesture_msg, chord_msg, instrument_msg = self._messages_for_frame(hands, width, height)

            await websocket.send(json.dumps(gesture_msg, ensure_ascii=False))
            if chord_msg is not None:
                await websocket.send(json.dumps(chord_msg, ensure_ascii=False))
            if instrument_msg is not None:
                await websocket.send(json.dumps(instrument_msg, ensure_ascii=False))

    def _messages_for_frame(
        self,
        hands: list[DetectedHand],
        width: int,
        height: int,
    ) -> tuple[dict[str, object], dict[str, object] | None, dict[str, object] | None]:
        root_hand = _pick_hand(hands, "Right")
        quality_hand = _pick_hand(hands, "Left")

        instrument_candidate = None
        root_candidate = None
        if root_hand is not None:
            index_tip = root_hand.landmarks[8]
            x = index_tip.x * width
            y = index_tip.y * height
            instrument_candidate = instrument_from_point(x, y, width, height)
            if instrument_candidate is None:
                root_candidate = root_from_point(x, y, width, height)

        selected_quality = None
        quality_selection = None
        finger_count = None
        if quality_hand is not None:
            finger_count = count_extended_fingers(quality_hand.landmarks)
            index_tip = quality_hand.landmarks[8]
            quality_selection = quality_from_wheel_point(index_tip.x * width, index_tip.y * height, width, height)
            if quality_selection is not None:
                selected_quality = quality_selection.quality

        playback = self.playback_controller.update(root_candidate, selected_quality)
        chord_msg = self._chord_message_if_changed(playback)
        instrument_msg = self._instrument_message_if_changed(instrument_candidate)

        primary_landmarks = root_hand.landmarks if root_hand is not None else (hands[0].landmarks if hands else [])
        confidence = max((hand.score for hand in hands), default=0.0)
        gesture_msg: dict[str, object] = {
            "type": "gesture",
            "landmarks": landmark_payload(primary_landmarks),
            "hands": _hands_payload(hands),
            "gesture": playback.chord_name,
            "confidence": round(confidence, 4),
            "root": {
                "index": playback.root_index,
                "name": root_name(playback.root_index),
                "candidateIndex": root_candidate,
                "candidateName": root_name(root_candidate),
            },
            "quality": {
                "name": playback.quality,
                "label": quality_label(playback.quality),
                "candidate": selected_quality,
                "candidateLabel": quality_label(selected_quality) if selected_quality else None,
                "fingerCount": finger_count,
                "selection": None if quality_selection is None else {
                    "index": quality_selection.index,
                    "distance": round(quality_selection.distance, 2),
                    "angle": None if quality_selection.angle is None else round(quality_selection.angle, 4),
                },
            },
            "instrument": self.instrument_controller.current,
            "instrumentZone": None if instrument_candidate is None else {"instrument": instrument_candidate},
            "muted": playback.muted,
        }
        return gesture_msg, chord_msg, instrument_msg

    def _chord_message_if_changed(self, playback) -> dict[str, object] | None:
        signature = (playback.root_index, playback.quality, playback.muted)
        if signature == self._last_chord_signature:
            return None
        self._last_chord_signature = signature
        return chord_payload(playback)

    def _instrument_message_if_changed(self, candidate: str | None) -> dict[str, object] | None:
        instrument = self.instrument_controller.update(candidate)
        if instrument is None:
            return None
        return {"type": "instrument", "instrument": instrument}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bridge MediaPipe hand gestures to the instrument WebSocket server.")
    parser.add_argument("--camera", type=int, default=0, help="OpenCV camera index.")
    parser.add_argument("--ws-url", default="ws://localhost:8765", help="WebSocket server URL.")
    parser.add_argument("--model", type=Path, default=DEFAULT_BRIDGE_MODEL_PATH, help="Path to hand_landmarker.task.")
    parser.add_argument(
        "--backend",
        choices=("auto", "legacy", "task"),
        default="auto",
        help="MediaPipe backend. Auto prefers the classic Hands graph when available.",
    )
    parser.add_argument(
        "--swap-hands",
        action="store_true",
        help="Swap MediaPipe handedness labels if your camera reports roles backwards.",
    )
    parser.add_argument(
        "--min-detection-confidence",
        type=float,
        default=0.5,
        help="Minimum palm detection confidence.",
    )
    parser.add_argument(
        "--min-presence-confidence",
        type=float,
        default=0.5,
        help="Minimum hand presence confidence.",
    )
    parser.add_argument(
        "--min-tracking-confidence",
        type=float,
        default=0.5,
        help="Minimum hand tracking confidence.",
    )
    parser.add_argument("--max-fps", type=float, default=30.0, help="Maximum recognition/send FPS.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    bridge = HandInstrumentBridge(
        camera=args.camera,
        ws_url=args.ws_url,
        model_path=args.model,
        backend=args.backend,
        swap_hands=args.swap_hands,
        min_detection_confidence=args.min_detection_confidence,
        min_presence_confidence=args.min_presence_confidence,
        min_tracking_confidence=args.min_tracking_confidence,
        max_fps=args.max_fps,
    )
    try:
        asyncio.run(bridge.run())
    except KeyboardInterrupt:
        print("\n[bridge] stopped")


if __name__ == "__main__":
    main()
