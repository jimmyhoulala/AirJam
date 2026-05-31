"""
隔空弹奏乐器 - Python 后端
WebSocket 服务器，桥接浏览器前端和 MaixCAM2 硬件端
"""
import asyncio
from ws_server import start_server


def main():
    print("=== 隔空弹奏乐器后端 ===")
    print("等待浏览器前端和 MaixCAM2 连接...")
    print("按 Ctrl+C 停止服务器")
    print()

    try:
        asyncio.run(start_server(host="0.0.0.0", port=8765))
    except KeyboardInterrupt:
        print("\n服务器已停止")


if __name__ == "__main__":
    main()
