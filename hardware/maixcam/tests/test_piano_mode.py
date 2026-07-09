from face_tracking.piano import (
    MAJOR_DEGREES,
    MINOR_DEGREES,
    PianoModeController,
    create_touch_piano_layout,
)


def _hand(index_x, index_y):
    """构造一只手：指尖(landmark[8])放在 (index_x, index_y)，
    掌指关节(landmark[5])放在其正上方，使 active_fingertips 能检测到手指抬起。"""
    points = [(0, 0, 0)] * 21
    points[5] = (index_x, index_y + 20, 0)  # MCP 在指尖下方（y 越大越靠下）
    points[8] = (index_x, index_y, 0)        # 指尖
    return points


def test_touch_piano_layout_has_real_piano_white_and_black_keys():
    layout = create_touch_piano_layout(350, 200, octave=3)

    assert [key.degree for key in layout.white_keys] == MAJOR_DEGREES
    assert [key.degree for key in layout.black_keys] == MINOR_DEGREES
    assert [key.midi for key in layout.white_keys] == [48, 50, 52, 53, 55, 57, 59]
    assert [key.midi for key in layout.black_keys] == [49, 51, 54, 56, 58]


def test_black_keys_take_priority_over_white_keys():
    layout = create_touch_piano_layout(350, 200, octave=3)
    black = layout.black_keys[0]

    assert layout.key_at(black.x + 1, black.y + 1).midi == black.midi


def test_left_hand_numbers_select_five_octaves_from_low_to_high():
    controller = PianoModeController(350, 200)

    assert controller.update_left(1) == 1
    assert controller.selected_octave == 1
    assert [key.midi for key in controller.layout.white_keys] == [36, 38, 40, 41, 43, 45, 47]
    assert controller.update_left(5) == 5
    assert [key.midi for key in controller.layout.white_keys] == [84, 86, 88, 89, 91, 93, 95]
    assert controller.update_left(6) is None


def test_right_index_touch_triggers_selected_octave_key():
    controller = PianoModeController(350, 200)
    controller.update_left(3)

    # 触摸 C4 (midi=60) —— 键盘 y=0~100，指尖放在键区内
    first = controller.update_right(_hand(25, 50), now_ms=0)
    # 持续触摸同一键，不应重复触发
    repeated = controller.update_right(_hand(25, 50), now_ms=20)

    assert first == [60]
    assert repeated == []


def test_leave_and_retouch_triggers_again():
    controller = PianoModeController(350, 200)
    controller.update_left(3)

    controller.update_right(_hand(25, 50), now_ms=0)
    # 手指离开琴键区域
    controller.update_right(_hand(25, 200), now_ms=10)
    # 重新触摸同一键
    retouch = controller.update_right(_hand(25, 50), now_ms=20)

    assert retouch == [60]


def test_multi_finger_triggers_multiple_keys():
    controller = PianoModeController(350, 200)
    controller.update_left(3)
    layout = controller.layout

    # 构造两只手的点：右手食指在 C4，右手中指在 D4
    c4_key = layout.white_keys[0]  # midi=60
    d4_key = layout.white_keys[1]  # midi=62
    c4_x = c4_key.x + c4_key.w // 2
    d4_x = d4_key.x + d4_key.w // 2
    y = 50

    points = [(0, 0, 0)] * 21
    # 食指 (landmark 5/8)
    points[5] = (c4_x, y + 20, 0)
    points[8] = (c4_x, y, 0)
    # 中指 (landmark 9/12)
    points[9] = (d4_x, y + 20, 0)
    points[12] = (d4_x, y, 0)

    result = controller.update_right(points, now_ms=0)
    assert sorted(result) == [60, 62]
