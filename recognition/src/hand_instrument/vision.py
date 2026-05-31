from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

from hand_instrument.gestures import Point3D


@dataclass
class DetectedHand:
    handedness: str
    score: float
    landmarks: list[Point3D]


class HandTracker:
    def __init__(
        self,
        model_path: Path,
        backend: str = "auto",
        min_detection_confidence: float = 0.5,
        min_presence_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ) -> None:
        cache_root = Path(tempfile.gettempdir()) / "hand_instrument_cache"
        (cache_root / "matplotlib").mkdir(parents=True, exist_ok=True)
        (cache_root / "xdg").mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("MPLCONFIGDIR", str(cache_root / "matplotlib"))
        os.environ.setdefault("XDG_CACHE_HOME", str(cache_root / "xdg"))

        import mediapipe as mp

        self._mp = mp
        self._backend = self._choose_backend(mp, backend)
        self._hands = None
        self._landmarker = None

        if self._backend == "legacy":
            self._hands = mp.solutions.hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                model_complexity=1,
                min_detection_confidence=min_detection_confidence,
                min_tracking_confidence=min_tracking_confidence,
            )
            return

        if not model_path.exists():
            raise FileNotFoundError(
                f"Missing MediaPipe model: {model_path}\n"
                "Run: python scripts/download_model.py"
            )

        base_options = mp.tasks.BaseOptions(
            model_asset_path=str(model_path),
            delegate=mp.tasks.BaseOptions.Delegate.CPU,
        )
        options = mp.tasks.vision.HandLandmarkerOptions(
            base_options=base_options,
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=min_detection_confidence,
            min_hand_presence_confidence=min_presence_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self._landmarker = mp.tasks.vision.HandLandmarker.create_from_options(options)

    @staticmethod
    def _choose_backend(mp, backend: str) -> str:
        if backend not in {"auto", "legacy", "task"}:
            raise ValueError("backend must be one of: auto, legacy, task.")
        has_legacy = hasattr(mp, "solutions") and hasattr(mp.solutions, "hands")
        if backend == "legacy" and not has_legacy:
            raise RuntimeError("This MediaPipe version does not provide mp.solutions.hands.")
        if backend == "auto":
            return "legacy" if has_legacy else "task"
        return backend

    def detect(self, rgb_frame, timestamp_ms: int) -> list[DetectedHand]:
        if self._backend == "legacy":
            return self._detect_legacy(rgb_frame)
        return self._detect_task(rgb_frame, timestamp_ms)

    def _detect_legacy(self, rgb_frame) -> list[DetectedHand]:
        result = self._hands.process(rgb_frame)
        if not result.multi_hand_landmarks:
            return []

        hands: list[DetectedHand] = []
        handedness = result.multi_handedness or []
        for index, hand_landmarks in enumerate(result.multi_hand_landmarks):
            classification = handedness[index].classification[0] if index < len(handedness) else None
            label = classification.label if classification is not None else "Unknown"
            score = float(classification.score) if classification is not None else 0.0
            points = [
                Point3D(x=landmark.x, y=landmark.y, z=landmark.z)
                for landmark in hand_landmarks.landmark
            ]
            hands.append(DetectedHand(handedness=label, score=score, landmarks=points))
        return hands

    def _detect_task(self, rgb_frame, timestamp_ms: int) -> list[DetectedHand]:
        mp_image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb_frame)
        result = self._landmarker.detect_for_video(mp_image, timestamp_ms)
        hands: list[DetectedHand] = []

        for landmarks, handedness_categories in zip(result.hand_landmarks, result.handedness):
            category = handedness_categories[0]
            label = getattr(category, "category_name", None) or getattr(category, "categoryName", "Unknown")
            score = float(getattr(category, "score", 0.0))
            points = [Point3D(x=landmark.x, y=landmark.y, z=landmark.z) for landmark in landmarks]
            hands.append(DetectedHand(handedness=label, score=score, landmarks=points))

        return hands

    def close(self) -> None:
        if self._landmarker is not None:
            self._landmarker.close()
        if self._hands is not None:
            self._hands.close()
