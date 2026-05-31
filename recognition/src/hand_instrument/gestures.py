from __future__ import annotations

from dataclasses import dataclass
from math import hypot
from typing import Sequence


@dataclass(frozen=True)
class Point3D:
    x: float
    y: float
    z: float = 0.0


FINGER_JOINTS = (
    (4, 3),
    (8, 6),
    (12, 10),
    (16, 14),
    (20, 18),
)


def _distance(a: Point3D, b: Point3D) -> float:
    return hypot(a.x - b.x, a.y - b.y)


def extended_fingers(landmarks: Sequence[Point3D], min_extension: float = 0.025) -> list[bool]:
    """Return extension state for thumb, index, middle, ring, and pinky."""

    if len(landmarks) < 21:
        raise ValueError("Expected 21 MediaPipe hand landmarks.")

    wrist = landmarks[0]
    states: list[bool] = []
    for tip_index, inner_joint_index in FINGER_JOINTS:
        tip = landmarks[tip_index]
        inner_joint = landmarks[inner_joint_index]
        states.append(_distance(wrist, tip) > _distance(wrist, inner_joint) + min_extension)
    return states


def count_extended_fingers(landmarks: Sequence[Point3D], min_extension: float = 0.025) -> int:
    return sum(extended_fingers(landmarks, min_extension=min_extension))

