from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, TypeVar

from hand_instrument.music import chord_label


T = TypeVar("T")


@dataclass
class PlaybackState:
    root_index: int | None
    quality: str
    muted: bool
    chord_name: str


class StableValue(Generic[T]):
    def __init__(self, initial: T, stable_frames: int = 3) -> None:
        if stable_frames < 1:
            raise ValueError("stable_frames must be at least 1.")
        self.value = initial
        self._candidate = initial
        self._candidate_frames = 0
        self._stable_frames = stable_frames

    def update(self, candidate: T) -> T:
        if candidate == self._candidate:
            self._candidate_frames += 1
        else:
            self._candidate = candidate
            self._candidate_frames = 1

        if self._candidate_frames >= self._stable_frames:
            self.value = candidate
        return self.value


class InstrumentController:
    def __init__(
        self,
        stable_frames: int = 3,
        missing_root_frames: int = 12,
        default_quality: str = "major",
    ) -> None:
        self._root = StableValue[int | None](None, stable_frames=stable_frames)
        self._quality = StableValue[str](default_quality, stable_frames=stable_frames)
        self._missing_root_frames = missing_root_frames
        self._root_absence_count = 0
        self._manual_quality_target = default_quality

    def update(self, root_index: int | None, quality: str | None) -> PlaybackState:
        if root_index is None:
            self._root_absence_count += 1
            root_target = None if self._root_absence_count >= self._missing_root_frames else self._root.value
        else:
            self._root_absence_count = 0
            root_target = root_index

        stable_root = self._root.update(root_target)

        if quality is not None:
            self._manual_quality_target = quality
            quality_target = quality
        else:
            quality_target = self._manual_quality_target

        stable_quality = self._quality.update(quality_target)
        muted = stable_root is None or stable_quality == "mute"
        return PlaybackState(
            root_index=stable_root,
            quality=stable_quality,
            muted=muted,
            chord_name=chord_label(stable_root, stable_quality),
        )


class InstrumentSwitchController:
    def __init__(self, initial: str = "piano", stable_frames: int = 8) -> None:
        self.current = initial
        self._instrument = StableValue[str | None](None, stable_frames=stable_frames)

    def update(self, candidate: str | None) -> str | None:
        stable_candidate = self._instrument.update(candidate)
        if stable_candidate is None or stable_candidate == self.current:
            return None

        self.current = stable_candidate
        return stable_candidate
