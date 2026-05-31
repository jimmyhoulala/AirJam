# 前端接口

前端连接 `ws://localhost:8765`，只显示后端广播的硬件事件。默认不启用本机摄像头，也不做浏览器端手势识别。

## 后端 → 前端

### 硬件状态

```json
{
  "type": "hardware_status",
  "connected": true,
  "name": "MaixCAM2",
  "source": "udp",
  "address": "10.143.177.20:5020",
  "mode": "piano"
}
```

### 乐器

```json
{
  "type": "instrument",
  "instrument": "electric_guitar",
  "label": "电吉他"
}
```

可选值：`drums`、`electric_guitar`、`acoustic_guitar`、`piano`。

### 硬件摄像头画面

```json
{
  "type": "camera_frame",
  "mime": "image/jpeg",
  "dataUrl": "data:image/jpeg;base64,...",
  "sequence": 123,
  "bytes": 20480
}
```

### 钢琴音符

```json
{
  "type": "note",
  "instrument": "piano",
  "note": "C4",
  "midi": 60,
  "durationMs": 140,
  "frequency": 261.63
}
```

### 鼓

```json
{
  "type": "drum",
  "instrument": "drums",
  "drum": "snare",
  "articulation": "hit",
  "velocity": "accent",
  "power": 1800
}
```

### 吉他扫弦

```json
{
  "type": "chord",
  "instrument": "acoustic_guitar",
  "root": "G",
  "quality": "strum",
  "qualityLabel": "down",
  "chord": "G down",
  "midiNotes": [43, 47, 50, 55, 59, 67],
  "frequencies": [98.0, 123.47, 146.83, 196.0, 246.94, 392.0],
  "muted": false
}
```

## 前端 → 后端

前端仍保留手动切换 UI，用于演示或同步显示：

```json
{
  "type": "switch_instrument",
  "instrument": "piano"
}
```

后端会广播为 `instrument` 消息。真实演奏以 MaixCAM2 的 `MODE`、`NOTE`、`HIT`、`GUITAR` UDP 事件为准。

## 演示模式

```text
http://localhost:8080/?mock=1
```

浏览器备用合成音频：

```text
http://localhost:8080/?mock=1&localAudio=1
```
