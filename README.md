# 隔空弹奏乐器

用手势控制演奏虚拟乐器：Python + MediaPipe 读取摄像头识别双手动作，右手选择根音和乐器，左手选择和弦性质，浏览器端负责显示映射状态并通过扬声器播放和弦。支持四种乐器切换，浏览器端和硬件端屏幕同步显示演奏状态。

## 系统架构

```
┌─────────────┐     WebSocket      ┌──────────────┐     WebSocket      ┌─────────────┐
│  浏览器前端  │ ◄──────────────► │  Python 后端  │ ◄──────────────► │  MaixCAM2   │
│  HTML/CSS/JS │    ws://8765      │  广播中枢     │    WiFi 连接      │  2K 显示屏   │
│  播放和弦    │                   │              │                   │  MaixPy     │
└─────────────┘                   └──────────────┘                   └─────────────┘
                                         ▲
                                         │ WebSocket
                                  ┌──────────────┐
                                  │ Python 识别桥 │
                                  │ MediaPipe     │
                                  └──────────────┘
                                         │ OpenCV
                                         ▼
                                  ┌──────────────┐
                                  │ 摄像头        │
                                  │ Python 占用   │
                                  └──────────────┘
```

## 项目结构

```
red_book/
├── frontend/               # 浏览器前端
│   ├── index.html          # 主页面
│   ├── css/style.css       # 样式（深色霓虹主题）
│   ├── js/
│   │   ├── app.js          # 主入口 + 浮动音符模块
│   │   ├── ws.js           # WebSocket 通信
│   │   ├── camera.js       # 摄像头管理
│   │   ├── gesture.js      # 手势可视化（Canvas 绘制）
│   │   ├── audio.js        # Web Audio 合成（4种乐器音色）
│   │   ├── instrument.js   # 乐器切换
│   │   ├── player.js       # 演奏状态显示
│   │   └── status.js       # 系统状态（FPS/延迟/连接）
│   ├── assets/icons/       # 图标资源
│   ├── start.bat           # Windows 启动脚本
│   └── start.sh            # Mac/Linux 启动脚本
│
├── backend/                # Python 后端
│   ├── main.py             # 主入口
│   ├── ws_server.py        # WebSocket 服务器（广播中枢）
│   └── requirements.txt    # Python 依赖
│
├── recognition/              # MediaPipe 手势识别桥
│   ├── src/hand_instrument/
│   │   ├── bridge.py       # gesture-instrument-bridge：识别并发送 WebSocket 消息
│   │   ├── regions.py      # 根音区、乐器区、和弦轮盘映射
│   │   └── state.py        # 防抖和演奏状态机
│   └── environment.yml     # conda env: mediapipe-hands-instrument
│
├── hardware/maixcam/       # MaixCAM2 硬件端
│   ├── main.py             # 主程序入口
│   ├── ui/
│   │   ├── screen.py       # 屏幕管理（2560x1440 分层渲染）
│   │   ├── colors.py       # 颜色常量（与浏览器端统一）
│   │   ├── status_bar.py   # 顶部状态栏
│   │   ├── note_area.py    # 中央音符粒子 + 波形动画
│   │   └── instrument_bar.py # 底部乐器卡片
│   └── net/
│       └── ws_client.py    # WebSocket 客户端
│
├── PRODUCT.md              # 产品需求文档
├── GESTURE.md              # 手势识别技术文档
├── HARDWARE.md             # 硬件接线文档
└── plan.txt                # 团队分工
```

## 快速开始

### 1. 准备手势识别环境

如果你已经创建过 `mediapipe-hands-instrument`，只需要更新并安装 editable 包：

```bash
cd recognition
conda env update -f environment.yml --prune
conda activate mediapipe-hands-instrument
python -m pip install -e .
python scripts/download_model.py
```

Windows 用户建议在 Anaconda Prompt 中执行同样命令。如果 MediaPipe 安装失败，先安装 Visual C++ Redistributable，再重新运行环境安装。

### 2. 启动 WebSocket 后端

```bash
cd backend
pip install -r requirements.txt
python main.py
# 输出: WebSocket 服务器已启动: ws://0.0.0.0:8765
```

### 3. 启动手势识别桥

另开一个终端：

```bash
conda activate mediapipe-hands-instrument
gesture-instrument-bridge --camera 0 --ws-url ws://localhost:8765
```

如果摄像头左右手识别反了，加 `--swap-hands`。如果 0 号摄像头打不开，尝试 `--camera 1` 或关闭浏览器、Zoom、Teams 等占用摄像头的软件。

### 4. 启动浏览器前端

```bash
cd frontend
# Windows: 双击 start.bat
# Mac/Linux:
python -m http.server 8080
```

浏览器打开 `http://localhost:8080`。真实集成模式默认等待 Python 识别桥发送手势；浏览器端不占用摄像头，避免和 Python 识别进程冲突。

如需离线演示模拟数据，打开：

```text
http://localhost:8080/?mock=1
```

### 5. 启动 MaixCAM2（可选）

编辑 `hardware/maixcam/main.py`，修改配置：

```python
WIFI_SSID = "你的WiFi名"
WIFI_PASSWORD = "你的WiFi密码"
SERVER_HOST = "电脑的IP地址"  # 如 "192.168.1.100"
```

将 `hardware/maixcam/` 目录上传到 MaixCAM2 并运行：

```bash
python main.py
```

## 功能特性

### 浏览器端

- **手势识别展示**：接收 Python 识别桥发送的双手 21 个关键点
- **和弦演奏**：右手底部 12 区选择根音，左手轮盘选择 major、minor、7 等和弦性质
- **手势切换乐器**：右手顶部 4 区稳定停留切换钢琴、吉他、鼓、音乐盒
- **四种乐器**：钢琴、吉他、鼓、音乐盒，各有独特音色
- **乐器 SVG 图标**：精致的矢量图标替代传统字符
- **浮动音符**：演奏时屏幕飘出彩色音符，颜色随音高变化
- **手势可视化**：Canvas 绘制手部骨架，指尖发光效果
- **合成音频**：Web Audio API 实时合成，无需预录音频文件
- **演示模式**：无需后端/摄像头，模拟数据即可体验

### MaixCAM2 硬件端

- **2K 屏显示**：2560x1440 分辨率，深色霓虹主题
- **音符粒子**：演奏时飘出彩色音符，带旋转和缩放
- **音量波形**：中央区域显示实时音量可视化
- **乐器卡片**：底部乐器选择，切换时有霓虹扩散动画
- **双向同步**：与浏览器前端实时同步乐器/音量/和弦状态

### 通信协议

所有消息通过 WebSocket 以 JSON 格式传输：

| 方向 | 消息类型 | 示例 |
|------|---------|------|
| 后端 → 客户端 | `chord` | `{"type":"chord","chord":"C major","frequencies":[261.63,329.63,392.0]}` |
| 后端 → 客户端 | `note` | `{"type":"note","note":"C4"}`（兼容旧协议） |
| 后端 → 客户端 | `instrument` | `{"type":"instrument","instrument":"piano"}` |
| 后端 → 客户端 | `volume` | `{"type":"volume","volume":72}` |
| 客户端 → 后端 | `switch_instrument` | `{"type":"switch_instrument","instrument":"guitar"}` |
| 客户端 → 后端 | `set_volume` | `{"type":"set_volume","volume":80}` |

## 乐器音色

| 乐器 | 音色特点 | 合成方式 |
|------|---------|---------|
| 钢琴 | 柔和，有泛音 | 正弦波叠加 2/3 次泛音，快速起音+中等衰减 |
| 吉他 | 锐利，拨弦感 | 锯齿波 + 低通滤波，锐利起音+快速衰减 |
| 鼓 | 低频冲击 | 正弦波降频 + 噪声冲击 |
| 音乐盒 | 清脆，铃声感 | 高频正弦，极快起音+清脆衰减 |

## 视觉设计

采用 **Synesthesia（联觉）** 风格：

- 深色背景 + 霓虹紫蓝强调色
- 所有交互都有即时视觉反馈
- 摄像头画面是绝对视觉中心
- 演奏状态用精确数据展示
- 光效和色彩营造音乐氛围

## 依赖

### 后端

- Python 3.10+
- websockets >= 12.0

### 手势识别桥

- Conda 环境：`mediapipe-hands-instrument`
- Python 3.12
- MediaPipe 0.10.21
- OpenCV contrib 4.10.0.84
- websockets >= 12.0

### 浏览器端

- Chrome 90+ 或 Edge 90+（支持 Canvas 和 Web Audio）
- 无需 npm/构建工具，纯静态文件

### MaixCAM2

- MaixPy 3.x
- WiFi 连接

## 团队分工

| 角色 | 负责内容 |
|------|---------|
| A | 摄像头与手势识别（OpenCV + MediaPipe） |
| B | 乐器切换与演奏逻辑（状态机、防误触） |
| C | 音频播放与主界面（Web Audio + UI） |
| D | 硬件交互（ESP32/MaixCAM2、按钮、旋钮） |

## License

课程设计 / 毕业设计项目
