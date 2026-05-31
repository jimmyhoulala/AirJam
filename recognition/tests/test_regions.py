from hand_instrument.regions import (
    instrument_from_point,
    instrument_zones,
    piano_zones,
    quality_from_wheel_point,
    quality_wheel,
    root_from_point,
)


def test_piano_zones_cover_bottom_of_frame() -> None:
    zones = piano_zones(1200, 800)
    assert len(zones) == 12
    assert zones[0].x0 == 0
    assert zones[-1].x1 == 1200
    assert zones[0].y0 == 600
    assert zones[0].y1 == 800


def test_root_from_point_returns_none_outside_grid() -> None:
    assert root_from_point(100, 100, 1200, 800) is None
    assert root_from_point(-1, 700, 1200, 800) is None
    assert root_from_point(1200, 700, 1200, 800) is None


def test_root_from_point_maps_chromatic_zones() -> None:
    width = 1200
    height = 800
    assert root_from_point(0, 700, width, height) == 0
    assert root_from_point(99, 700, width, height) == 0
    assert root_from_point(100, 700, width, height) == 1
    assert root_from_point(1199, 700, width, height) == 11


def test_instrument_zones_cover_top_of_frame() -> None:
    zones = instrument_zones(1200, 800)
    assert len(zones) == 4
    assert zones[0].instrument == "piano"
    assert zones[-1].instrument == "musicbox"
    assert zones[0].y0 == 0
    assert zones[0].y1 == 144


def test_instrument_from_point_maps_top_zones() -> None:
    width = 1200
    height = 800
    assert instrument_from_point(0, 10, width, height) == "piano"
    assert instrument_from_point(300, 10, width, height) == "guitar"
    assert instrument_from_point(600, 10, width, height) == "drums"
    assert instrument_from_point(1199, 10, width, height) == "musicbox"
    assert instrument_from_point(100, 200, width, height) is None


def test_quality_wheel_maps_center_to_mute_and_outer_sectors() -> None:
    width = 1200
    height = 800
    wheel = quality_wheel(width, height)

    center = quality_from_wheel_point(wheel.center_x, wheel.center_y, width, height)
    assert center is not None
    assert center.quality == "mute"

    top = quality_from_wheel_point(wheel.center_x, wheel.center_y - wheel.mute_radius - 10, width, height)
    assert top is not None
    assert top.quality == "major"

    right = quality_from_wheel_point(wheel.center_x + wheel.radius - 1, wheel.center_y, width, height)
    assert right is not None
    assert right.quality == "minor"

    outside = quality_from_wheel_point(wheel.center_x + wheel.radius + 1, wheel.center_y, width, height)
    assert outside is None
