from __future__ import annotations

from dataclasses import dataclass
from math import atan2, hypot, pi

from hand_instrument.music import QUALITY_NAMES, ROOT_NAMES


INSTRUMENTS = ("piano", "guitar", "drums", "musicbox")


@dataclass(frozen=True)
class PianoZone:
    index: int
    name: str
    x0: int
    x1: int
    y0: int
    y1: int


@dataclass(frozen=True)
class InstrumentZone:
    index: int
    instrument: str
    x0: int
    x1: int
    y0: int
    y1: int


@dataclass(frozen=True)
class QualityWheel:
    center_x: int
    center_y: int
    radius: int
    mute_radius: int


@dataclass(frozen=True)
class QualitySelection:
    quality: str
    index: int | None
    distance: float
    angle: float | None


def piano_zones(width: int, height: int, bottom_ratio: float = 0.25) -> list[PianoZone]:
    if width <= 0 or height <= 0:
        raise ValueError("width and height must be positive.")
    if not 0.0 < bottom_ratio < 1.0:
        raise ValueError("bottom_ratio must be between 0 and 1.")

    y0 = int(height * (1.0 - bottom_ratio))
    zones: list[PianoZone] = []
    for index, name in enumerate(ROOT_NAMES):
        x0 = int(width * index / len(ROOT_NAMES))
        x1 = int(width * (index + 1) / len(ROOT_NAMES))
        zones.append(PianoZone(index=index, name=name, x0=x0, x1=x1, y0=y0, y1=height))
    return zones


def root_from_point(
    x: float,
    y: float,
    width: int,
    height: int,
    bottom_ratio: float = 0.25,
) -> int | None:
    if x < 0 or y < 0 or x >= width or y >= height:
        return None

    grid_top = height * (1.0 - bottom_ratio)
    if y < grid_top:
        return None

    zone_width = width / len(ROOT_NAMES)
    return min(int(x / zone_width), len(ROOT_NAMES) - 1)


def instrument_zones(width: int, height: int, top_ratio: float = 0.18) -> list[InstrumentZone]:
    if width <= 0 or height <= 0:
        raise ValueError("width and height must be positive.")
    if not 0.0 < top_ratio < 1.0:
        raise ValueError("top_ratio must be between 0 and 1.")

    y1 = int(height * top_ratio)
    zones: list[InstrumentZone] = []
    for index, instrument in enumerate(INSTRUMENTS):
        x0 = int(width * index / len(INSTRUMENTS))
        x1 = int(width * (index + 1) / len(INSTRUMENTS))
        zones.append(InstrumentZone(index=index, instrument=instrument, x0=x0, x1=x1, y0=0, y1=y1))
    return zones


def instrument_from_point(x: float, y: float, width: int, height: int, top_ratio: float = 0.18) -> str | None:
    if x < 0 or y < 0 or x >= width or y >= height:
        return None

    if y >= height * top_ratio:
        return None

    zone_width = width / len(INSTRUMENTS)
    return INSTRUMENTS[min(int(x / zone_width), len(INSTRUMENTS) - 1)]


def quality_wheel(
    width: int,
    height: int,
    center_x_ratio: float = 0.18,
    center_y_ratio: float = 0.45,
    radius_ratio: float = 0.18,
    mute_radius_ratio: float = 0.35,
) -> QualityWheel:
    if width <= 0 or height <= 0:
        raise ValueError("width and height must be positive.")
    if not 0.0 < center_x_ratio < 1.0 or not 0.0 < center_y_ratio < 1.0:
        raise ValueError("wheel center ratios must be between 0 and 1.")
    if not 0.0 < radius_ratio < 0.5:
        raise ValueError("radius_ratio must be between 0 and 0.5.")
    if not 0.0 < mute_radius_ratio < 1.0:
        raise ValueError("mute_radius_ratio must be between 0 and 1.")

    radius = int(min(width, height) * radius_ratio)
    return QualityWheel(
        center_x=int(width * center_x_ratio),
        center_y=int(height * center_y_ratio),
        radius=radius,
        mute_radius=int(radius * mute_radius_ratio),
    )


def quality_from_wheel_point(x: float, y: float, width: int, height: int) -> QualitySelection | None:
    wheel = quality_wheel(width, height)
    dx = x - wheel.center_x
    dy = y - wheel.center_y
    distance = hypot(dx, dy)

    if distance > wheel.radius:
        return None
    if distance <= wheel.mute_radius:
        return QualitySelection(quality="mute", index=None, distance=distance, angle=None)

    angle = (atan2(dx, -dy) + (2.0 * pi)) % (2.0 * pi)
    index = min(int(angle / ((2.0 * pi) / len(QUALITY_NAMES))), len(QUALITY_NAMES) - 1)
    return QualitySelection(quality=QUALITY_NAMES[index], index=index, distance=distance, angle=angle)
