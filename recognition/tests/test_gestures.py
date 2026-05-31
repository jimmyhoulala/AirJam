from hand_instrument.gestures import Point3D, count_extended_fingers, extended_fingers


def _landmarks_with_count(count: int) -> list[Point3D]:
    landmarks = [Point3D(0.5, 0.8, 0.0) for _ in range(21)]
    joints = ((4, 3), (8, 6), (12, 10), (16, 14), (20, 18))
    extended_points = [
        (Point3D(0.25, 0.64), Point3D(0.42, 0.73)),
        (Point3D(0.38, 0.43), Point3D(0.43, 0.64)),
        (Point3D(0.50, 0.38), Point3D(0.50, 0.62)),
        (Point3D(0.62, 0.43), Point3D(0.57, 0.64)),
        (Point3D(0.72, 0.50), Point3D(0.64, 0.68)),
    ]
    curled_points = [
        (Point3D(0.48, 0.77), Point3D(0.42, 0.73)),
        (Point3D(0.47, 0.76), Point3D(0.43, 0.64)),
        (Point3D(0.51, 0.76), Point3D(0.50, 0.62)),
        (Point3D(0.54, 0.76), Point3D(0.57, 0.64)),
        (Point3D(0.57, 0.77), Point3D(0.64, 0.68)),
    ]

    for index, (tip_index, joint_index) in enumerate(joints):
        tip, joint = extended_points[index] if index < count else curled_points[index]
        landmarks[tip_index] = tip
        landmarks[joint_index] = joint
    return landmarks


def test_counts_extended_fingers() -> None:
    for count in range(6):
        assert count_extended_fingers(_landmarks_with_count(count)) == count


def test_returns_each_finger_state() -> None:
    assert extended_fingers(_landmarks_with_count(2)) == [True, True, False, False, False]

