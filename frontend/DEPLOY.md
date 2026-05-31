# 前端部署指南

## 环境要求

- Chrome 90+ / Edge 90+ / Safari 16+
- Python 3.x 用于启动静态服务器
- 后端 `backend/main.py` 已启动

前端默认不申请本机摄像头。真实画面识别在 MaixCAM2 端完成，前端只接收 WebSocket 事件。

## 启动

```bash
cd frontend
python -m http.server 8080
```

打开：

```text
http://localhost:8080
```

## 模式

真实集成模式：等待 `backend/main.py` 广播 `hardware_status`、`instrument`、`note`、`drum`、`chord`。

演示模式：

```text
http://localhost:8080/?mock=1
```

浏览器备用合成音频：

```text
http://localhost:8080/?mock=1&localAudio=1
```

真实硬件模式下，主要音频由电脑端后端播放，避免浏览器和后端重复发声。

## 文件结构

```text
frontend/
  index.html
  css/style.css
  js/app.js
  js/ws.js
  js/camera.js       # 硬件舞台状态，不使用本机摄像头
  js/gesture.js      # 硬件事件可视化
  js/audio.js        # 可选浏览器备用音频
  js/instrument.js
  js/player.js
  js/status.js
  API.md
  DEPLOY.md
```

## 常见问题

### 页面一直显示等待 MaixCAM2

- 确认 `backend/main.py` 正在运行。
- 确认 MaixCAM2 的 `PC_SYNTH_HOST` 是电脑当前 Wi-Fi IP。
- 确认 MaixCAM2 和电脑在同一网络，UDP 5020 未被防火墙拦截。

### 没有声音

- 后端终端应显示收到 `NOTE`、`HIT` 或 `GUITAR`。
- macOS 使用系统 `afplay` 播放 WAV，通常无需额外安装。
- 安装 `pygame` 可降低播放延迟。
