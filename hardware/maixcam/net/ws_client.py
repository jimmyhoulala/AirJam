"""
WebSocket 客户端
连接 Python 后端，接收和发送消息
"""
import json
import time

try:
    import socket
    MAIXPY = True
except ImportError:
    MAIXPY = False

try:
    import network
    HAS_NETWORK = True
except ImportError:
    HAS_NETWORK = False


class WebSocketClient:
    """轻量级 WebSocket 客户端（适配 MaixPy 3.x）"""

    def __init__(self, server_url, on_message=None):
        self.server_url = server_url
        self.on_message = on_message
        self.connected = False
        self.sock = None
        self._reconnect_interval = 3
        self._last_reconnect = 0

    def connect_wifi(self, ssid, password):
        """连接 WiFi（MaixPy 环境）"""
        if not HAS_NETWORK:
            print("[WS] 非 MaixPy 环境，跳过 WiFi 连接")
            return True

        try:
            wlan = network.WLAN(network.STA_IF)
            wlan.active(True)

            if wlan.isconnected():
                print(f"[WS] WiFi 已连接: {wlan.ifconfig()[0]}")
                return True

            print(f"[WS] 正在连接 WiFi: {ssid}...")
            wlan.connect(ssid, password)

            timeout = 15
            start = time.time()
            while not wlan.isconnected():
                if time.time() - start > timeout:
                    print("[WS] WiFi 连接超时")
                    return False
                time.sleep(1)

            print(f"[WS] WiFi 连接成功: {wlan.ifconfig()[0]}")
            return True
        except Exception as e:
            print(f"[WS] WiFi 连接失败: {e}")
            return False

    def connect(self):
        """连接 WebSocket 服务器"""
        if not MAIXPY:
            print("[WS] 非 MaixPy 环境，模拟连接")
            self.connected = True
            return True

        try:
            # 解析 URL
            url = self.server_url.replace("ws://", "")
            if ":" in url:
                host, port = url.split(":")
                port = int(port)
            else:
                host = url
                port = 8765

            # 创建 TCP socket
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(5)
            self.sock.connect((host, port))

            # WebSocket 握手
            self._ws_handshake(host, port)

            self.connected = True
            self._last_reconnect = time.time()
            print(f"[WS] 已连接到 {host}:{port}")
            return True
        except Exception as e:
            print(f"[WS] 连接失败: {e}")
            self.connected = False
            return False

    def _ws_handshake(self, host, port):
        """简单的 WebSocket 握手"""
        import hashlib
        import base64
        import os

        # 生成 WebSocket key
        ws_key = base64.b64encode(os.urandom(16)).decode()

        # 发送握手请求
        request = (
            f"GET / HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {ws_key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n"
            f"\r\n"
        )
        self.sock.send(request.encode())

        # 读取响应
        response = b""
        while b"\r\n\r\n" not in response:
            data = self.sock.recv(1024)
            if not data:
                raise Exception("握手失败：无响应")
            response += data

    def send(self, msg):
        """发送消息"""
        if not self.connected or not self.sock:
            return False

        try:
            payload = json.dumps(msg, ensure_ascii=False).encode()
            self._ws_send_frame(payload)
            return True
        except Exception as e:
            print(f"[WS] 发送失败: {e}")
            self.connected = False
            return False

    def _ws_send_frame(self, data):
        """发送 WebSocket 帧"""
        frame = bytearray()
        frame.append(0x81)  # FIN + TEXT

        length = len(data)
        if length < 126:
            frame.append(0x80 | length)  # masked
        elif length < 65536:
            frame.append(0x80 | 126)
            frame.extend(length.to_bytes(2, 'big'))
        else:
            frame.append(0x80 | 127)
            frame.extend(length.to_bytes(8, 'big'))

        # Masking key
        import os
        mask = os.urandom(4)
        frame.extend(mask)

        # Masked payload
        masked = bytearray(len(data))
        for i in range(len(data)):
            masked[i] = data[i] ^ mask[i % 4]
        frame.extend(masked)

        self.sock.send(bytes(frame))

    def recv(self):
        """接收消息（非阻塞）"""
        if not self.connected or not self.sock:
            return None

        try:
            self.sock.setblocking(False)
            data = self._ws_recv_frame()
            if data:
                return json.loads(data.decode())
            return None
        except BlockingIOError:
            return None
        except Exception as e:
            print(f"[WS] 接收失败: {e}")
            self.connected = False
            return None

    def _ws_recv_frame(self):
        """接收 WebSocket 帧"""
        header = self.sock.recv(2)
        if not header or len(header) < 2:
            return None

        opcode = header[0] & 0x0F
        masked = bool(header[1] & 0x80)
        length = header[1] & 0x7F

        if length == 126:
            ext = self.sock.recv(2)
            length = int.from_bytes(ext, 'big')
        elif length == 127:
            ext = self.sock.recv(8)
            length = int.from_bytes(ext, 'big')

        mask_key = None
        if masked:
            mask_key = self.sock.recv(4)

        payload = b""
        while len(payload) < length:
            chunk = self.sock.recv(length - len(payload))
            if not chunk:
                break
            payload += chunk

        if masked and mask_key:
            payload = bytearray(payload)
            for i in range(len(payload)):
                payload[i] ^= mask_key[i % 4]
            payload = bytes(payload)

        # 处理关闭帧
        if opcode == 0x8:
            self.connected = False
            return None

        return payload if opcode == 0x1 else None

    def disconnect(self):
        """断开连接"""
        self.connected = False
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
            self.sock = None

    def ensure_connected(self):
        """确保连接（自动重连）"""
        if self.connected:
            return True

        now = time.time()
        if now - self._last_reconnect < self._reconnect_interval:
            return False

        self._last_reconnect = now
        return self.connect()
