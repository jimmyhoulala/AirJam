# 前端接口文档

## WebSocket 通信协议

连接地址：`ws://localhost:8765`

### 消息格式

所有消息均为 JSON 格式：

```json
{
  "type": "消息类型",
  "...": "其他字段"
}
```

---

## 后端 → 前端（接收消息）

### 手势数据

```json
{
  "type": "gesture",
  "landmarks": [
    { "x": 0.5, "y": 0.3, "z": 0.01 },
    ...
  ],
  "hands": [
    {
      "handedness": "Right",
      "score": 0.95,
      "landmarks": [
        { "x": 0.5, "y": 0.3, "z": 0.01 }
      ]
    }
  ],
  "gesture": "C major",
  "confidence": 0.92,
  "root": { "index": 0, "name": "C", "candidateIndex": 0, "candidateName": "C" },
  "quality": { "name": "major", "label": "major", "candidate": "major" },
  "instrumentZone": { "instrument": "piano" },
  "muted": false
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `landmarks` | Array | 兼容旧协议的主手 21 个关键点坐标，x/y/z 范围 0-1 |
| `hands` | Array | 双手关键点，包含 handedness、score、landmarks |
| `gesture` | String | 当前识别到的演奏状态，如 `C major` |
| `confidence` | Number | 置信度 0-1 |
| `root` | Object | 当前根音和右手底部区域候选 |
| `quality` | Object | 当前和弦性质和左手轮盘候选 |
| `instrumentZone` | Object/null | 右手顶部乐器区候选 |
| `muted` | Boolean | 是否静音 |

### 和弦数据

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

| 字段 | 类型 | 说明 |
|------|------|------|
| `rootIndex` | Number/null | 0-11，对应 C 到 B |
| `root` | String | 根音名称 |
| `quality` | String | major、minor、diminished、dominant seventh、major seventh、mute |
| `qualityLabel` | String | UI 显示标签 |
| `chord` | String | 和弦名 |
| `midiNotes` | Array | MIDI 音高 |
| `frequencies` | Array | Web Audio 播放频率 |
| `muted` | Boolean | 是否静音 |

### 音符数据

兼容旧协议。新的识别桥默认发送 `chord`，不再发送 `note`。

```json
{
  "type": "note",
  "note": "C4"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `note` | String | 音符名称，如 C4、D#5、A4 |

### 音量数据

```json
{
  "type": "volume",
  "volume": 72
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `volume` | Number | 音量值 0-100 |

### 乐器切换

```json
{
  "type": "instrument",
  "instrument": "piano"
}
```

| 字段 | 类型 | 可选值 |
|------|------|--------|
| `instrument` | String | piano、guitar、drums、musicbox |

### ESP32 状态

```json
{
  "type": "esp32_status",
  "connected": true
}
```

---

## 前端 → 后端（发送消息）

### 切换乐器

```json
{
  "type": "switch_instrument",
  "instrument": "guitar"
}
```

### 设置音量

```json
{
  "type": "set_volume",
  "volume": 80
}
```

### 开始/停止

```json
{ "type": "start" }
{ "type": "stop" }
```

---

## JavaScript 模块 API

### WS（WebSocket 通信）

```javascript
// 连接服务器
WS.connect('ws://localhost:8765');

// 断开连接
WS.disconnect();

// 发送消息
WS.send({ type: 'switch_instrument', instrument: 'piano' });

// 监听消息
WS.on('gesture', (msg) => { /* msg.landmarks */ });
WS.on('chord', (msg) => { /* msg.frequencies */ });
WS.on('note', (msg) => { /* msg.note */ });
WS.on('volume', (msg) => { /* msg.volume */ });
WS.on('status', (data) => { /* data.connected */ });

// 检查连接状态
WS.isConnected(); // true / false
```

### Camera（摄像头）

```javascript
// 初始化（页面加载时自动调用）
Camera.init();

// 启动摄像头
const success = await Camera.start(); // true / false

// 停止摄像头
Camera.stop();

// 获取帧率
Camera.getFps(); // 30

// 监听事件
Camera.on('started', () => {});
Camera.on('stopped', () => {});
Camera.on('fps', (fps) => {});
Camera.on('error', (err) => {});
```

### Gesture（手势可视化）

```javascript
// 初始化
Gesture.init();

// 更新手势数据
Gesture.updateGesture(msg); // msg = WebSocket gesture 消息
Gesture.updateLandmarks(landmarks); // landmarks = [{x, y, z}, ...]

// 开始/停止渲染
Gesture.startRenderLoop();
Gesture.stopRenderLoop();

// 清除画布
Gesture.clear();
```

### Instrument（乐器选择）

```javascript
// 初始化
Instrument.init();

// 选择乐器
Instrument.select('piano');

// 获取当前乐器
Instrument.getCurrent(); // 'piano'

// 获取乐器信息
Instrument.getInstrument('piano'); // { name: '钢琴', icon: '♪' }

// 监听切换事件
Instrument.on('change', (data) => {
  // data.instrument = 'piano'
  // data.name = '钢琴'
});
```

### Audio（音频合成）

```javascript
// 初始化
Audio.init();

// 播放和弦
Audio.playChord({
  frequencies: [261.63, 329.63, 392.0],
  muted: false
});

// 兼容旧音符协议
Audio.playNote('C4');

// 设置音色和音量
Audio.setInstrument('piano');
Audio.setVolume(72);
```

### Player（演奏状态）

```javascript
// 初始化
Player.init();

// 设置当前和弦
Player.setChord({
  chord: 'C major',
  frequencies: [261.63, 329.63, 392.0],
  muted: false
});

// 兼容旧音符协议
Player.setNote('C4');

// 设置音量
Player.setVolume(72);

// 设置演奏状态
Player.setPlaying(true);

// 获取演奏历史
Player.getHistory(); // ['C major', 'D minor', ...]

// 监听事件
Player.on('chord', (chord) => {});
Player.on('note', (note) => {});
Player.on('volume', (volume) => {});
Player.on('playing', (isPlaying) => {});
```

### Status（系统状态）

```javascript
// 初始化
Status.init();

// 设置 WebSocket 连接状态
Status.setWebSocket(true);

// 设置 ESP32 连接状态
Status.setESP32(true);

// 设置后端状态
Status.setBackend(true);

// 设置帧率
Status.setFps(30);

// 延迟测量
Status.startLatency();
Status.endLatency(); // 返回毫秒数
Status.setLatency(12); // 直接设置
```

---

## Mock 模式

默认关闭，真实集成模式等待 Python 识别桥发送手势。

开启方法：访问 `http://localhost:8080/?mock=1`。

Mock 模式会：
- 每 500ms 模拟手势数据
- 随机播放和弦
- 模拟帧率和延迟
- 顶部显示"演示模式"标签
