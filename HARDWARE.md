# 硬件接入文档

本项目当前使用 MaixCAM2 作为真实硬件端。旧的 ESP32/OLED 假硬件代码已移除；MaixCAM2 自带摄像头负责识别，电脑端负责播放音频和给前端广播状态。

## 目录

```text
hardware/
  maixcam/
    main.py
    config.example.py
    face_tracking/
    assets/
  pc_runtime/instruments/
```

## 电脑端

启动后端：

```bash
cd backend
python main.py
```

后端监听：

- `udp://0.0.0.0:5020`：接收 MaixCAM2 演奏事件并播放音色
- `ws://0.0.0.0:8765`：给浏览器前端广播状态

当前机器可用 Wi-Fi IP 为 `10.143.177.237`，MaixCAM2 的 `PC_SYNTH_HOST` 需要指向这个地址。若网络变化，用 `ifconfig` 查看新的 `en0 inet`。

## MaixCAM2 端配置

复制配置文件：

```bash
cp hardware/maixcam/config.example.py hardware/maixcam/config.py
```

编辑：

```python
PC_SYNTH_HOST = "10.143.177.237"
PC_EVENT_PORT = 5020
```

然后把 `hardware/maixcam/` 上传到 MaixCAM2，运行：

```bash
python main.py
```

## 通信协议

MaixCAM2 使用 UDP 发送 ASCII 文本：

| 消息 | 示例 | 说明 |
|---|---|---|
| 心跳 | `PING|maixcam|piano` | 每秒发送，电脑端据此判断在线 |
| 模式 | `MODE|acoustic_guitar` | 当前选择的乐器 |
| 钢琴音符 | `NOTE|piano|60|140` | MIDI 音符和持续时间 |
| 鼓点 | `HIT|snare|hit|accent|1800` | 鼓、奏法、力度层、运动强度 |
| 吉他扫弦 | `GUITAR|electric_guitar|C5|down` | 乐器、和弦、扫弦方向 |
| 预览画面 | `FRAME|seq|index|total|<jpeg bytes>` | 低帧率硬件摄像头 JPEG 分片 |

## 音频资源

电脑端从 `hardware/pc_runtime/instruments/` 加载：

- `pianos/SalamanderGrandPiano-V3/samples/`
- `guitars/Bread Breads Distortion Guitar/strums/`
- `guitars/acoustic_guitar/strums/`
- `drums/Shino Drums(sf2)/snare_samples/`

macOS 会直接使用系统 `afplay` 播放 WAV；Windows 使用 `winsound`；Linux 使用 `aplay`/`paplay`。安装 `pygame` 后会自动启用更低延迟的缓存播放。
