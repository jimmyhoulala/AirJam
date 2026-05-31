# 前端部署指南

## 环境要求

- 浏览器：Chrome 90+ 或 Edge 90+（支持 Canvas 和 Web Audio）
- Python 3.x（用于启动本地服务器）
- 真实手势识别需要另行启动后端和 `gesture-instrument-bridge`

---

## 快速启动

### Windows 用户

双击 `start.bat` 即可启动服务器，浏览器打开 `http://localhost:8080`

### Mac / Linux 用户

```bash
chmod +x start.sh
./start.sh
```

### 手动启动

```bash
cd frontend
python -m http.server 8080
```

浏览器打开 `http://localhost:8080`

---

## 功能说明

### 演示模式

默认关闭。需要无需后端体验时，访问 `http://localhost:8080/?mock=1`：
- 手势可视化动画
- 乐器切换
- 和弦合成音播放（钢琴/吉他/鼓/音乐盒各有不同音色）
- 底部状态模拟数据

顶部显示"演示模式"标签。

### 真实集成模式

直接访问 `http://localhost:8080`。前端会等待 Python 识别桥通过 WebSocket 发送 `gesture` 和 `chord` 消息。浏览器端不占用摄像头，避免和 Python 识别桥冲突。

### 连接后端

编辑 `js/app.js`，修改 WebSocket 地址：

```javascript
WS.connect('ws://你的后端地址:8765');
```

---

## 文件结构

```
frontend/
├── index.html          主页面
├── start.bat           Windows 启动脚本
├── start.sh            Mac/Linux 启动脚本
├── css/
│   └── style.css       样式文件
├── js/
│   ├── app.js          主入口
│   ├── ws.js           WebSocket 通信
│   ├── camera.js       摄像头模块
│   ├── gesture.js      手势可视化
│   ├── audio.js        音频合成
│   ├── instrument.js   乐器选择
│   ├── player.js       演奏状态
│   └── status.js       系统状态
├── API.md              接口文档
└── DEPLOY.md           本文档
```

---

## 乐器音色说明

| 乐器 | 音色特点 | 实现方式 |
|------|---------|---------|
| 钢琴 | 柔和，有泛音 | 正弦波叠加 2/3 次泛音 |
| 吉他 | 锐利，拨弦感 | 锯齿波 + 低通滤波 |
| 鼓 | 低频冲击 | 正弦波降频 + 噪声 |
| 音乐盒 | 清脆，铃声感 | 高频正弦，快速衰减 |

---

## 常见问题

### 识别桥无法启动摄像头

- 确认 `gesture-instrument-bridge --camera 0` 在单独终端运行
- 如果 0 号摄像头不可用，尝试 `--camera 1`
- 关闭浏览器摄像头预览、Zoom、Teams 等可能占用摄像头的软件
- macOS 首次运行可能需要在系统设置中允许终端或 Python 访问摄像头

### 没有声音

- 点击页面任意位置先激活 AudioContext（浏览器安全策略）
- 检查系统音量
- 确认没有静音

### 界面显示异常

- 打开浏览器开发者工具（F12）查看 Console 报错
- 确认所有 JS 文件都在正确位置
