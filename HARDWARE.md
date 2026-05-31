# 硬件接入文档

本文档面向负责 ESP32/Arduino 硬件部分的同学（分工 D），说明如何烧录固件、接线、与电脑端通信。

---

## 硬件清单

| 组件 | 型号/规格 | 数量 | 用途 |
|------|----------|------|------|
| 主控板 | ESP32-DevKitC 或 Arduino Nano 33 BLE | 1 | 主控制器 |
| OLED 显示屏 | SSD1306 0.96寸 I2C | 1 | 显示当前乐器 |
| LED 灯带 | WS2812B (可选) | 1 | 灯效反馈 |
| 按钮 | 轻触开关 6x6mm | 3 | 开始/重置/切换模式 |
| 旋钮 | 旋转编码器或电位器 10K | 1 | 调节音量 |
| 面包板 + 杜邦线 | 若干 | 1套 | 接线 |

---

## 开发环境搭建

### Arduino IDE

1. 下载 [Arduino IDE 2.x](https://www.arduino.cc/en/software)
2. 添加 ESP32 开发板支持：
   - 文件 → 首选项 → 附加开发板管理器网址
   - 添加：`https://espressif.github.io/arduino-esp32/package_esp32_index.json`
   - 工具 → 开发板 → 开发板管理器 → 搜索 "esp32" → 安装

### PlatformIO（推荐）

1. 安装 [VS Code](https://code.visualstudio.com/)
2. 安装 PlatformIO 插件
3. 新建项目，选择 ESP32 Dev Module

---

## ESP32 烧录固件

### 方法一：Arduino IDE

1. 工具 → 开发板 → 选择 "ESP32 Dev Module"
2. 端口 → 选择 COM 口（插上 USB 后出现）
3. 点击上传

### 方法二：PlatformIO

```bash
# 在项目目录下
pio run --target upload
```

### 进入下载模式

如果烧录失败，按住 BOOT 按钮再按 RESET：

1. 按住 BOOT（GPIO0）
2. 按一下 RESET
3. 松开 BOOT
4. 重新上传

---

## 接线图

### ESP32 接线

```
ESP32 引脚        →  连接目标
─────────────────────────────────
GPIO 21 (SDA)    →  OLED SDA
GPIO 22 (SCL)    →  OLED SCL
GPIO 4           →  按钮1 (开始) → GND
GPIO 5           →  按钮2 (重置) → GND
GPIO 15          →  按钮3 (切换) → GND
GPIO 34          →  旋钮中间脚 (ADC输入)
GPIO 2           →  WS2812B DATA (可选)
3.3V             →  OLED VCC, 旋钮 VCC
GND              →  OLED GND, 所有按钮一端, 旋钮 GND
```

### OLED 接线（I2C）

```
SSD1306 引脚  →  ESP32 引脚
VCC           →  3.3V
GND           →  GND
SCL           →  GPIO 22
SDA           →  GPIO 21
```

### 按钮接线

```
按钮引脚1  →  GPIO (见上表)
按钮引脚2  →  GND
```

> ESP32 内部有上拉电阻，代码中启用 `INPUT_PULLUP` 即可，无需外接电阻。

### 旋钮接线（电位器模式）

```
电位器引脚1  →  3.3V
电位器引脚2  →  GPIO 34 (ADC)
电位器引脚3  →  GND
```

---

## 串口通信协议

电脑（Python 后端）与 ESP32 通过 USB 串口通信，波特率 `115200`。

### 电脑 → ESP32

| 消息格式 | 示例 | 说明 |
|---------|------|------|
| `INST:乐器名` | `INST:piano` | 设置当前乐器 |
| `CHORD:和弦名` | `CHORD:C major` | 显示/反馈当前和弦 |
| `STATE:状态` | `STATE:PLAYING` | 演奏状态 |
| `VOL:音量值` | `VOL:72` | 设置音量 0-100 |

多条指令可用分号合并：

```
INST:piano;CHORD:C major;STATE:PLAYING
```

### ESP32 → 电脑

| 消息格式 | 示例 | 说明 |
|---------|------|------|
| `BTN:按钮名` | `BTN:start` | 按钮事件 |
| `VOL:音量值` | `VOL:72` | 旋钮音量值 |

按钮名：`start`（开始）、`reset`（重置）、`mode`（切换模式）

---

## 参考代码（Arduino）

```cpp
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// 按钮引脚
#define BTN_START 4
#define BTN_RESET 5
#define BTN_MODE 15

// 旋钮引脚
#define KNOB_PIN 34

String currentInstrument = "piano";
int currentVolume = 72;

void setup() {
  Serial.begin(115200);

  // 按钮
  pinMode(BTN_START, INPUT_PULLUP);
  pinMode(BTN_RESET, INPUT_PULLUP);
  pinMode(BTN_MODE, INPUT_PULLUP);

  // OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED 初始化失败");
    while (true);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Air Instrument");
  display.println("Ready");
  display.display();
}

void loop() {
  // 检测按钮
  if (digitalRead(BTN_START) == LOW) {
    Serial.println("BTN:start");
    delay(200); // 消抖
  }
  if (digitalRead(BTN_RESET) == LOW) {
    Serial.println("BTN:reset");
    delay(200);
  }
  if (digitalRead(BTN_MODE) == LOW) {
    Serial.println("BTN:mode");
    delay(200);
  }

  // 读取旋钮
  int knobVal = analogRead(KNOB_PIN);
  int volume = map(knobVal, 0, 4095, 0, 100);
  if (abs(volume - currentVolume) > 2) { // 防抖
    currentVolume = volume;
    Serial.println("VOL:" + String(currentVolume));
  }

  // 读取串口
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    parseCommand(cmd);
  }

  delay(50);
}

void parseCommand(String cmd) {
  // 解析 INST:xxx
  int instIdx = cmd.indexOf("INST:");
  if (instIdx >= 0) {
    currentInstrument = cmd.substring(instIdx + 5, cmd.indexOf(";", instIdx));
    updateDisplay();
  }

  // 解析 NOTE:xxx
  int noteIdx = cmd.indexOf("NOTE:");
  if (noteIdx >= 0) {
    String note = cmd.substring(noteIdx + 5, cmd.indexOf(";", noteIdx));
    // 可在此触发 LED 灯效
  }

  // 解析 VOL:xxx
  int volIdx = cmd.indexOf("VOL:");
  if (volIdx >= 0) {
    currentVolume = cmd.substring(volIdx + 4).toInt();
    updateDisplay();
  }
}

void updateDisplay() {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.println("Air Instrument");
  display.println();
  display.setTextSize(2);
  display.println(currentInstrument);
  display.setTextSize(1);
  display.print("Vol: ");
  display.println(currentVolume);
  display.display();
}
```

---

## Python 端串口通信示例

```python
import serial
import serial.tools.list_ports

# 查找串口
ports = serial.tools.list_ports.comports()
for p in ports:
    print(p.device)

# 连接 ESP32
ser = serial.Serial('COM3', 115200, timeout=1)

# 发送指令
ser.write(b'INST:piano\n')
ser.write(b'CHORD:C major\n')
ser.write(b'VOL:72\n')

# 读取数据
while True:
    if ser.in_waiting:
        line = ser.readline().decode().strip()
        print(line)  # 例如: BTN:start 或 VOL:50
```

---

## 常见问题

### 串口找不到

- Windows：设备管理器 → 端口 (COM & LPT) 查看
- 安装 CP2102 或 CH340 驱动（取决于 ESP32 板载芯片）

### 烧录失败

- 按住 BOOT + 按 RESET 进入下载模式
- 检查 USB 线是否支持数据传输（部分线只有充电功能）

### OLED 无显示

- 确认 I2C 地址是 `0x3C`（部分模块是 `0x3D`）
- 检查 SDA/SCL 是否接反

### 旋钮数值跳动

- 在代码中加均值滤波：读取 5 次取平均
- 或加软件消抖：变化超过阈值才更新
