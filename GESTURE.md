# 手势识别接入文档

本文档面向负责手势识别和 Python 后端的同学（分工 A、B），说明如何搭建 AI 手势识别模块，并与前端/WebSocket 对接。

---

## 当前集成方案

当前项目采用三进程架构：

1. `backend/main.py` 启动 WebSocket 广播中枢，地址默认 `ws://localhost:8765`。
2. `gesture-instrument-bridge` 启动 Python 手势识别桥，独占摄像头，用 OpenCV + MediaPipe 识别双手，并把结果发给后端。
3. `frontend/` 静态页面连接后端，显示手势映射、播放和弦音频。

浏览器端不负责摄像头识别，避免和 Python 识别桥抢占摄像头。旧的浏览器摄像头按钮只作为兼容预览逻辑保留，不是主流程。

### 手势映射

| 手 | 区域 | 动作 |
|----|------|------|
| 右手食指 | 画面底部 25%，横向 12 区 | 选择根音 C 到 B |
| 右手食指 | 画面顶部 18%，横向 4 区 | 稳定停留切换 piano、guitar、drums、musicbox |
| 左手食指 | 左侧轮盘中心 | mute |
| 左手食指 | 左侧轮盘外圈 | 顺时针选择 major、minor、diminished、dominant seventh、major seventh |

### 启动步骤

macOS / Linux:

```bash
# 终端 1：后端
cd backend
python main.py

# 终端 2：识别桥
conda activate mediapipe-hands-instrument
gesture-instrument-bridge --camera 0 --ws-url ws://localhost:8765

# 终端 3：前端
cd frontend
python -m http.server 8080
```

Windows:

```bat
:: 终端 1：后端
cd backend
python main.py

:: 终端 2：Anaconda Prompt 中启动识别桥
conda activate mediapipe-hands-instrument
gesture-instrument-bridge --camera 0 --ws-url ws://127.0.0.1:8765

:: 终端 3：前端
cd frontend
python -m http.server 8080
```

打开 `http://localhost:8080`。如果要离线演示模拟数据，打开 `http://localhost:8080/?mock=1`。

### WebSocket 消息

识别桥发送 `gesture`、`chord`、`instrument` 三类主要消息：

```json
{
  "type": "chord",
  "rootIndex": 0,
  "root": "C",
  "quality": "major",
  "qualityLabel": "major",
  "chord": "C major",
  "midiNotes": [60, 64, 67],
  "frequencies": [261.63, 329.63, 392.0],
  "muted": false
}
```

`note` 旧消息仍被前端兼容，但新的识别桥默认发送 `chord`。

---

## 技术栈

| 组件 | 技术 | 用途 |
|------|------|------|
| 手势识别 | MediaPipe Hands | 实时检测手部 21 个关键点 |
| 摄像头采集 | OpenCV | 获取视频帧 |
| 后端通信 | WebSocket (websockets) | 与前端实时通信 |
| 音频播放 | Web Audio API | 浏览器端播放和弦 |
| 串口通信 | pyserial | 与 ESP32 通信 |

---

## 环境搭建

### 1. 安装 Python 3.10+

```bash
# Windows: 从 python.org 下载安装，勾选 "Add to PATH"
# Mac:
brew install python@3.10
```

### 2. 创建虚拟环境

```bash
cd red_book
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

### 3. 安装依赖

```bash
pip install opencv-python mediapipe numpy websockets pyserial
```

或使用 requirements.txt：

```bash
pip install -r requirements.txt
```

---

## 手势识别模块

### MediaPipe Hands 原理

MediaPipe Hands 是 Google 开源的的手部检测模型：

- 输入：RGB 视频帧（640x480 或 1280x720）
- 输出：21 个手部关键点的 (x, y, z) 坐标，范围 0-1
- 性能：单手 ~30fps，双手 ~20fps

### 21 个关键点定义

```
        8   12  16  20
        |   |   |   |
    4   7   11  15  19
    |   |   |   |   |
    3   6   10  14  18
    |   |   |   |   |
    2   5   9   13  17
     \  |   |   |  /
      \ |   |   | /
        1---0---1
```

- 0: 手腕
- 1-4: 拇指
- 5-8: 食指
- 9-12: 中指
- 13-16: 无名指
- 17-20: 小指

### 基础手势识别代码

```python
import cv2
import mediapipe as mp

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.5
)

cap = cv2.VideoCapture(0)

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # MediaPipe 需要 RGB 输入
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = hands.process(rgb)

    if result.multi_hand_landmarks:
        for hand_landmarks in result.multi_hand_landmarks:
            # 获取 21 个关键点
            landmarks = []
            for lm in hand_landmarks.landmark:
                landmarks.append({
                    'x': lm.x,
                    'y': lm.y,
                    'z': lm.z
                })

            # 判断手势类型
            gesture = classify_gesture(landmarks)
            print(f"手势: {gesture}")

    cv2.imshow('Hand Tracking', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
```

---

## 手势分类算法

### 方案一：规则判断（简单，推荐入门）

基于关键点之间的距离和角度判断手势：

```python
def classify_gesture(landmarks):
    """基于规则的手势分类"""

    def distance(p1, p2):
        return ((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2) ** 0.5

    # 手指尖端和关节
    tips = [4, 8, 12, 16, 20]     # 拇指、食指、中指、无名指、小指尖端
    pips = [3, 6, 10, 14, 18]     # 对应近端关节

    # 统计伸直的手指数量
    extended = 0
    for i in range(1, 5):  # 从食指到小指
        if landmarks[tips[i]]['y'] < landmarks[pips[i]]['y']:
            extended += 1

    # 拇指特殊判断（水平方向）
    thumb_extended = abs(landmarks[4]['x'] - landmarks[3]['x']) > 0.05

    # 手势判断
    if extended == 0 and not thumb_extended:
        return "握拳"
    elif extended == 4:
        return "张开"
    elif extended == 1 and landmarks[8]['y'] < landmarks[6]['y']:
        return "指向"
    elif extended == 2 and landmarks[8]['y'] < landmarks[6]['y'] and \
         landmarks[4]['y'] < landmarks[3]['y']:
        return "OK"
    elif extended >= 3:
        return "挥手"

    return "未知"
```

### 方案二：机器学习分类（进阶）

使用 sklearn 或 TensorFlow 训练手势分类器：

```python
from sklearn.ensemble import RandomForestClassifier
import numpy as np

# 训练数据：每个样本是 21 个关键点的坐标展平
# X_train.shape = (n_samples, 63)  # 21 * 3
# y_train = ['握拳', '张开', '指向', ...]

clf = RandomForestClassifier(n_estimators=100)
clf.fit(X_train, y_train)

# 预测
def classify_gesture_ml(landmarks):
    features = []
    for lm in landmarks:
        features.extend([lm['x'], lm['y'], lm['z']])
    return clf.predict([features])[0]
```

### 方案三：深度学习（高精度）

使用 TensorFlow Lite 或 PyTorch Mobile：

```python
import tensorflow as tf

model = tf.lite.Interpreter(model_path='hand_gesture.tflite')
model.allocate_tensors()

def classify_gesture_dl(landmarks):
    input_data = np.array([landmarks], dtype=np.float32)
    model.set_tensor(model.get_input_details()[0]['index'], input_data)
    model.invoke()
    output = model.get_tensor(model.get_output_details()[0]['index'])
    gestures = ['握拳', '张开', '指向', 'OK', '挥手']
    return gestures[np.argmax(output)]
```

---

## WebSocket 服务器

### 安装

```bash
pip install websockets
```

### 服务端代码

```python
import asyncio
import websockets
import json

connected_clients = set()

async def handler(websocket, path):
    connected_clients.add(websocket)
    print(f"客户端已连接，当前 {len(connected_clients)} 个")

    try:
        async for message in websocket:
            data = json.loads(message)
            # 处理前端发来的指令
            if data.get('type') == 'switch_instrument':
                print(f"切换乐器: {data['instrument']}")
            elif data.get('type') == 'set_volume':
                print(f"设置音量: {data['volume']}")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.remove(websocket)

async def broadcast(msg):
    """向所有连接的客户端广播消息"""
    if connected_clients:
        await asyncio.gather(*[
            client.send(json.dumps(msg))
            for client in connected_clients
        ])

# 启动服务器
async def main():
    async with websockets.serve(handler, "localhost", 8765):
        print("WebSocket 服务器已启动: ws://localhost:8765")
        await asyncio.Future()  # 永久运行

asyncio.run(main())
```

---

## 完整后端集成

### 项目结构

```
red_book/
├── backend/
│   ├── main.py           # 主入口
│   ├── gesture.py        # 手势识别模块
│   ├── websocket_server.py  # WebSocket 服务器
│   ├── serial_comm.py    # ESP32 串口通信
│   └── audio_player.py   # 音频播放（可选，前端已内置）
├── frontend/
│   └── ...
└── requirements.txt
```

### main.py

```python
import asyncio
import cv2
import mediapipe as mp
from websocket_server import broadcast, start_server
from gesture import GestureRecognizer

async def main():
    # 启动 WebSocket 服务器
    ws_task = asyncio.create_task(start_server())

    # 启动手势识别
    recognizer = GestureRecognizer()
    cap = cv2.VideoCapture(0)

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            continue

        # 识别手势
        result = recognizer.process(frame)

        if result:
            # 广播手势数据到前端
            await broadcast({
                'type': 'gesture',
                'landmarks': result['landmarks'],
                'gesture': result['gesture'],
                'confidence': result['confidence']
            })

        # 检测到音符时广播
        if result and result.get('note'):
            await broadcast({
                'type': 'note',
                'note': result['note']
            })

        await asyncio.sleep(0.03)  # ~30fps

    cap.release()

if __name__ == '__main__':
    asyncio.run(main())
```

### gesture.py

```python
import mediapipe as mp
import cv2

class GestureRecognizer:
    def __init__(self):
        self.hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.last_gesture = None
        self.gesture_buffer = []

    def process(self, frame):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self.hands.process(rgb)

        if not result.multi_hand_landmarks:
            return None

        hand = result.multi_hand_landmarks[0]
        landmarks = [{
            'x': lm.x, 'y': lm.y, 'z': lm.z
        } for lm in hand.landmark]

        gesture = self._classify(landmarks)

        # 手势稳定性过滤（连续 3 帧相同才确认）
        self.gesture_buffer.append(gesture)
        if len(self.gesture_buffer) > 3:
            self.gesture_buffer.pop(0)

        if len(self.gesture_buffer) == 3 and \
           all(g == self.gesture_buffer[0] for g in self.gesture_buffer):
            confirmed_gesture = self.gesture_buffer[0]
        else:
            confirmed_gesture = None

        # 手势变化时触发音符
        note = None
        if confirmed_gesture and confirmed_gesture != self.last_gesture:
            note = self._gesture_to_note(confirmed_gesture)
            self.last_gesture = confirmed_gesture

        return {
            'landmarks': landmarks,
            'gesture': gesture,
            'confidence': 0.9,
            'note': note
        }

    def _classify(self, landmarks):
        # 使用上面的规则判断函数
        tips = [4, 8, 12, 16, 20]
        pips = [3, 6, 10, 14, 18]

        extended = 0
        for i in range(1, 5):
            if landmarks[tips[i]]['y'] < landmarks[pips[i]]['y']:
                extended += 1

        thumb_extended = abs(landmarks[4]['x'] - landmarks[3]['x']) > 0.05

        if extended == 0 and not thumb_extended:
            return "握拳"
        elif extended == 4:
            return "张开"
        elif extended == 1:
            return "指向"
        elif extended == 2:
            return "OK"
        return "未知"

    def _gesture_to_note(self, gesture):
        """手势映射到音符"""
        mapping = {
            '握拳': 'C4',
            '张开': 'E4',
            '指向': 'G4',
            'OK': 'C5'
        }
        return mapping.get(gesture)
```

---

## 历史映射方案参考

以下方案是早期讨论记录，当前实现以本文顶部的“当前集成方案”为准。

### 方案一：手势切换乐器

| 手势 | 动作 |
|------|------|
| 握拳 | 钢琴 |
| 张开 | 吉他 |
| 指向 | 鼓 |
| OK | 音乐盒 |

### 方案二：手势触发音符

| 手势 | 音符 |
|------|------|
| 握拳 | C4 (Do) |
| 张开 | E4 (Mi) |
| 指向 | G4 (Sol) |
| 挥手 | C5 (高音Do) |

### 方案三：混合模式（推荐）

- 静止 2 秒以上 → 进入乐器切换模式
- 手势变化 → 触发音符演奏
- 特定手势组合 → 切换乐器

---

## 启动完整系统

```bash
# 终端 1：启动 WebSocket 后端
cd backend
python main.py

# 终端 2：启动 Python 手势识别桥
conda activate mediapipe-hands-instrument
gesture-instrument-bridge --camera 0 --ws-url ws://localhost:8765

# 终端 3：启动前端
cd frontend
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

---

## 常见问题

### MediaPipe 安装失败

```bash
# Windows 可能需要先安装 Visual C++ Redistributable
# 下载: https://aka.ms/vs/17/release/vc_redist.x64.exe

# 或使用 mediapipe 的 wheel 安装
pip install mediapipe --only-binary=mediapipe
```

### 摄像头被占用

- 确认没有其他程序（Zoom、Teams 等）在使用摄像头
- 关闭前端页面的摄像头预览（如果同时运行）

### WebSocket 连接不上

- 确认后端服务器已启动
- 检查防火墙是否阻止了 8765 端口
- 尝试将 `localhost` 改为 `127.0.0.1`

### 手势识别不准

- 调整 `min_detection_confidence` 和 `min_tracking_confidence` 参数
- 确保光线充足，手部与摄像头距离 30-80cm
- 添加手势缓冲（连续 N 帧相同才确认）
