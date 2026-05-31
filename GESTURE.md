# 手势识别说明

当前版本的手势识别在 MaixCAM2 硬件端完成。电脑端不再运行 MediaPipe/OpenCV 识别桥，浏览器端也不申请本机摄像头。

## MaixCAM2 端流程

1. `hardware/maixcam/main.py` 读取 MaixCAM2 摄像头画面。
2. `face_tracking/gestures.py` 控制人脸跟踪与锁定模式。
3. 锁定后进入乐器选择和演奏模式。
4. `face_tracking/note_output.py` 通过 UDP 把演奏事件发给电脑端 `backend/main.py`。

## 乐器选择

`face_tracking/instrument_select.py` 将画面横向分成四个区域：

| 区域 | 乐器 |
|---|---|
| 1 | 鼓 `drums` |
| 2 | 电吉他 `electric_guitar` |
| 3 | 木吉他 `acoustic_guitar` |
| 4 | 钢琴 `piano` |

手移动到对应区域并做出匹配数字手势后选中乐器。双手食指交叉可返回乐器选择。

## 演奏映射

| 模式 | 左手 | 右手 |
|---|---|---|
| 鼓 | 无需选择 | 向下击打触发军鼓，力度映射为 ghost/normal/accent |
| 电吉他 | 数字 1-8 选择 C5、D5、E5、F5、G5、A5、Bb5、B5 | 上下扫弦触发 up/down |
| 木吉他 | 数字 1-8 选择 C、G、Am、F、D、Em、A、E | 上下扫弦触发 up/down |
| 钢琴 | 数字 1-5 选择八度 | 食指触碰屏幕键盘区域触发 MIDI 音符 |

## UDP 事件

MaixCAM2 会向电脑端发送：

```text
PING|maixcam|piano
MODE|piano
NOTE|piano|60|140
HIT|snare|hit|normal|900
GUITAR|electric_guitar|C5|down
```

`PING` 每秒发送一次，用于前端显示硬件在线状态。
