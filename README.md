# AirJam 隔空演奏系统

AirJam 使用 MaixCAM2 的硬件摄像头完成手势识别，再把演奏事件通过 UDP 发给电脑。电脑端后端负责真实音频播放和 WebSocket 状态广播，浏览器前端只做舞台显示、状态反馈和可选演示，不再占用本机摄像头。

## Demo

https://github.com/user-attachments/assets/36d658ce-4d48-41bf-9a2e-0fb3a4313605

[无法播放时查看仓库内完整 demo 视频](docs/demo.mp4)

## 架构

```
MaixCAM2 硬件摄像头
  ├─ MaixPy 手势识别 / 乐器模式
  └─ UDP 5020: MODE / NOTE / HIT / GUITAR / PING
        ↓
backend/main.py
  ├─ 硬件 UDP 接收 + macOS/Windows/Linux 音频播放
  └─ WebSocket 8765 广播给前端
        ↓
frontend/index.html
  └─ 硬件事件舞台、乐器状态、音符/和弦/鼓点反馈
```

## 项目结构

```
backend/
  main.py                 # 同时启动 WebSocket 和 MaixCAM2 UDP 服务
  instrument_server.py    # 跨平台音频播放、硬件事件转前端消息
  ws_server.py            # WebSocket 广播中枢

frontend/
  index.html              # 浏览器舞台
  js/                     # WebSocket、舞台显示、状态和可选本地音频

docs/
  PRODUCT.md              # 产品定位和设计原则
  HARDWARE.md             # MaixCAM2 硬件接入说明
  GESTURE.md              # 手势识别与演奏映射
  demo.mp4                # GitHub README 演示视频

hardware/
  maixcam/                # 真实 MaixCAM2 端代码
  pc_runtime/instruments/ # 钢琴、木吉他、电吉他、鼓音色与预渲染 WAV
```

## 文档

- [产品说明](docs/PRODUCT.md)
- [硬件接入文档](docs/HARDWARE.md)
- [手势识别说明](docs/GESTURE.md)
- [演示视频](docs/demo.mp4)

## 快速启动

1. 安装后端依赖：

```bash
cd backend
python -m pip install -r requirements.txt
```

1. 启动后端：

```bash
cd backend
python main.py
```

后端会监听：

- WebSocket: `ws://0.0.0.0:8765`
- MaixCAM2 UDP: `udp://0.0.0.0:5020`

1. 启动前端：

```bash
cd frontend
python -m http.server 8080
```

打开 `http://localhost:8080`。

1. 配置 MaixCAM2：

当前电脑 Wi-Fi IP 检测为 `10.143.177.237`。如果 Wi-Fi 变化，复制并修改：

```bash
cp hardware/maixcam/config.example.py hardware/maixcam/config.py
```

把 `PC_SYNTH_HOST` 改成电脑当前 IP，然后将 `hardware/maixcam/` 上传到 MaixCAM2 运行 `main.py`。

## 乐器与音色


| 乐器  | 硬件模式              | 发声方式                                            |
| --- | ----------------- | ----------------------------------------------- |
| 鼓   | `drums`           | Shino snare 分层 WAV，soft/hard 自动映射到 ghost/accent |
| 电吉他 | `electric_guitar` | Bread Breads Distortion Guitar 预渲染上下扫弦 WAV      |
| 木吉他 | `acoustic_guitar` | Steel String Guitar 预渲染上下扫弦 WAV                 |
| 钢琴  | `piano`           | Salamander Grand Piano 36-95 MIDI 预渲染 WAV       |


音频播放优先使用 WAV 样本。macOS 使用系统 `afplay`；Windows 使用 `winsound`；Linux 使用 `aplay`/`paplay`。如果安装了 `pygame`，后端会自动使用缓存播放降低延迟。FluidSynth 现在只是可选兜底，不再是启动硬依赖。

## 硬件协议

MaixCAM2 → 后端 UDP 5020：

```text
PING|maixcam|piano
MODE|electric_guitar
NOTE|piano|60|140
HIT|snare|hit|accent|1800
GUITAR|acoustic_guitar|G|down
FRAME|seq|index|total|<jpeg bytes>
```

后端 → 前端 WebSocket：

- `hardware_status`
- `camera_frame`
- `instrument`
- `note`
- `drum`
- `chord`
- `volume`

## 演示模式

无硬件时可以打开：

```text
http://localhost:8080/?mock=1
```

如需浏览器也同时合成备用音频：

```text
http://localhost:8080/?mock=1&localAudio=1
```

## 贡献者

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/jimmyhoulala">
        <img src="https://github.com/jimmyhoulala.png?size=96" width="72" height="72" alt="jimmyhoulala" />
        <br />
        <sub><b>jimmyhoulala</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/yoyozii">
        <img src="https://github.com/yoyozii.png?size=96" width="72" height="72" alt="yoyozii" />
        <br />
        <sub><b>yoyozii</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/nofish777">
        <img src="https://github.com/nofish777.png?size=96" width="72" height="72" alt="nofish777" />
        <br />
        <sub><b>nofish777</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/Elory210">
        <img src="https://github.com/Elory210.png?size=96" width="72" height="72" alt="Elory210" />
        <br />
        <sub><b>Elory210</b></sub>
      </a>
    </td>
  </tr>
</table>
