"""
隔空弹奏乐器 - Python 后端
WebSocket 服务器 + MaixCAM2 UDP 音频/事件入口
"""
import asyncio
import socket

from instrument_server import (
    HardwareEventRouter,
    InstrumentSynthServer,
    auto_strum_loop,
    hardware_presence_loop,
    start_hardware_udp_server,
)
from ws_server import broadcast, set_hardware_router, start_server


def get_local_ip():
    """获取本机局域网 IP 地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


WS_HOST = "0.0.0.0"
WS_PORT = 8765
HARDWARE_UDP_HOST = "0.0.0.0"
HARDWARE_UDP_PORT = 5020


async def run():
    local_ip = get_local_ip()
    print("=== 隔空弹奏乐器后端 ===")
    print("等待浏览器前端和 MaixCAM2 硬件事件...")
    print(f"本机局域网 IP: {local_ip}")
    print(f"WebSocket: ws://{WS_HOST}:{WS_PORT}")
    print(f"MaixCAM UDP: udp://{HARDWARE_UDP_HOST}:{HARDWARE_UDP_PORT}")
    print(f"请确保 MaixCAM config.py 中 PC_SYNTH_HOST = \"{local_ip}\"")
    print("按 Ctrl+C 停止服务器")
    print()

    audio = InstrumentSynthServer()
    router = HardwareEventRouter(audio)
    set_hardware_router(router)
    udp_transport = await start_hardware_udp_server(
        HARDWARE_UDP_HOST,
        HARDWARE_UDP_PORT,
        router,
        broadcast,
    )
    presence_task = asyncio.create_task(hardware_presence_loop(router, broadcast))
    strum_task = asyncio.create_task(auto_strum_loop(router, broadcast))

    try:
        await start_server(host=WS_HOST, port=WS_PORT)
    finally:
        presence_task.cancel()
        strum_task.cancel()
        udp_transport.close()
        audio.close()


def main():
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n服务器已停止")


if __name__ == "__main__":
    main()
