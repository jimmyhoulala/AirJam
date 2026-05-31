"""
隔空弹奏乐器 - MaixCAM2 硬件端主程序
在 MaixPy 3.x 环境下运行
"""
import time
import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ui.screen import Screen
from ui.colors import Color
from ui.status_bar import StatusBar
from ui.note_area import NoteArea
from ui.instrument_bar import InstrumentBar
from net.ws_client import WebSocketClient


# ===== 配置 =====
# WiFi 配置（请修改为你的 WiFi）
WIFI_SSID = "your_wifi_name"
WIFI_PASSWORD = "your_wifi_password"

# 后端服务器地址（电脑的 IP 地址）
SERVER_HOST = "192.168.1.100"
SERVER_PORT = 8765
SERVER_URL = f"ws://{SERVER_HOST}:{SERVER_PORT}"

# 渲染帧率
TARGET_FPS = 30
FRAME_TIME = 1.0 / TARGET_FPS


class AirInstrument:
    """MaixCAM2 主程序"""

    def __init__(self):
        # UI 模块
        self.screen = Screen()
        self.status_bar = StatusBar(self.screen)
        self.note_area = NoteArea(self.screen)
        self.instrument_bar = InstrumentBar(self.screen)

        # 网络
        self.ws = WebSocketClient(SERVER_URL, on_message=self._on_message)

        # 状态
        self.running = True
        self.last_frame_time = 0
        self.frame_count = 0
        self.fps_display = 0
        self.last_fps_time = time.time()

        print("=== 隔空弹奏乐器 - MaixCAM2 ===")
        print(f"屏幕: {self.screen.img.width if self.screen.img else 'N/A'}x"
              f"{self.screen.img.height if self.screen.img else 'N/A'}")

    def _on_message(self, msg):
        """处理从后端收到的消息"""
        msg_type = msg.get('type', '')

        if msg_type == 'note':
            note = msg.get('note', '')
            self.status_bar.set_note(note)
            self.status_bar.set_playing(True)
            self.note_area.spawn_note(note)

        elif msg_type == 'chord':
            chord = msg.get('chord', '')
            muted = msg.get('muted', False)
            self.status_bar.set_note('' if muted else chord)
            self.status_bar.set_playing(not muted)
            if not muted and chord:
                self.note_area.spawn_note(chord)

        elif msg_type == 'instrument':
            instrument = msg.get('instrument', 'piano')
            self.status_bar.set_instrument(instrument)
            self.instrument_bar.select(instrument)

        elif msg_type == 'volume':
            volume = msg.get('volume', 72)
            self.status_bar.set_volume(volume)
            self.note_area.set_volume(volume)

        elif msg_type == 'state':
            state = msg.get('state', '')
            self.status_bar.set_playing(state == 'playing' or state == 'PLAYING')

        elif msg_type == 'gesture':
            gesture = msg.get('gesture', '')
            confidence = msg.get('confidence', 0)
            # 手势信息可以在需要时显示

    def start(self):
        """启动程序"""
        # 连接 WiFi
        print(f"[启动] 连接 WiFi: {WIFI_SSID}")
        if self.ws.connect_wifi(WIFI_SSID, WIFI_PASSWORD):
            print("[启动] WiFi 已连接")
        else:
            print("[启动] WiFi 连接失败，将继续尝试")

        # 连接后端
        print(f"[启动] 连接后端: {SERVER_URL}")
        if self.ws.connect():
            print("[启动] 已连接到后端")
            self.status_bar.set_connected(True)
        else:
            print("[启动] 后端连接失败，将自动重连")
            self.status_bar.set_connected(False)

        # 主循环
        print("[启动] 进入主循环")
        self._main_loop()

    def _main_loop(self):
        """主渲染循环"""
        while self.running:
            frame_start = time.time()

            # 网络通信
            self._handle_network()

            # 渲染
            self._render()

            # FPS 计算
            self._update_fps()

            # 帧率控制
            elapsed = time.time() - frame_start
            sleep_time = FRAME_TIME - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    def _handle_network(self):
        """处理网络消息"""
        if not self.ws.ensure_connected():
            self.status_bar.set_connected(False)
            return

        self.status_bar.set_connected(True)

        # 接收消息
        for _ in range(10):  # 每帧最多处理10条消息
            msg = self.ws.recv()
            if msg is None:
                break
            self._on_message(msg)

    def _render(self):
        """渲染一帧"""
        self.screen.clear()

        # 绘制各区域
        self.status_bar.draw()
        self.note_area.draw()
        self.instrument_bar.draw()

        # 绘制 FPS
        self.screen.draw_text(
            20, 5,
            f"FPS: {self.fps_display}",
            Color.TEXT_3, size="small"
        )

        # 刷新屏幕
        self.screen.update()

    def _update_fps(self):
        """更新 FPS 计数"""
        self.frame_count += 1
        now = time.time()
        if now - self.last_fps_time >= 1.0:
            self.fps_display = self.frame_count
            self.frame_count = 0
            self.last_fps_time = now

    def stop(self):
        """停止程序"""
        self.running = False
        self.ws.disconnect()
        print("[停止] 程序已退出")


def main():
    """入口函数"""
    app = AirInstrument()

    try:
        app.start()
    except KeyboardInterrupt:
        print("\n[退出] 用户中断")
    except Exception as e:
        print(f"\n[错误] {e}")
    finally:
        app.stop()


if __name__ == "__main__":
    main()
