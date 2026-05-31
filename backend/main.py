"""
隔空弹奏乐器 - Python 后端
WebSocket 服务器 + MaixCAM2 UDP 音频/事件入口
"""
import asyncio

from instrument_server import (
    HardwareEventRouter,
    InstrumentSynthServer,
    hardware_presence_loop,
    start_hardware_udp_server,
)
from ws_server import broadcast, start_server


WS_HOST = "0.0.0.0"
WS_PORT = 8765
HARDWARE_UDP_HOST = "0.0.0.0"
HARDWARE_UDP_PORT = 5020


async def run():
    print("=== 隔空弹奏乐器后端 ===")
    print("等待浏览器前端和 MaixCAM2 硬件事件...")
    print(f"WebSocket: ws://{WS_HOST}:{WS_PORT}")
    print(f"MaixCAM UDP: udp://{HARDWARE_UDP_HOST}:{HARDWARE_UDP_PORT}")
    print("按 Ctrl+C 停止服务器")
    print()

    audio = InstrumentSynthServer()
    router = HardwareEventRouter(audio)
    udp_transport = await start_hardware_udp_server(
        HARDWARE_UDP_HOST,
        HARDWARE_UDP_PORT,
        router,
        broadcast,
    )
    presence_task = asyncio.create_task(hardware_presence_loop(router, broadcast))

    try:
        await start_server(host=WS_HOST, port=WS_PORT)
    finally:
        presence_task.cancel()
        udp_transport.close()
        audio.close()


def main():
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n服务器已停止")


if __name__ == "__main__":
    main()
