"""
WebSocket 服务器
连接浏览器前端和 MaixCAM2，实现消息广播
"""
import asyncio
import json
import websockets

# 所有连接的客户端
clients = set()

# 硬件路由器引用（由 main.py 设置）
_hardware_router = None


def set_hardware_router(router):
    global _hardware_router
    _hardware_router = router


def normalize_message(data):
    """Normalize command-style client messages into broadcast events."""
    msg_type = data.get("type")
    if msg_type == "switch_instrument":
        instrument = data.get("instrument")
        if not instrument:
            return None
        # 转发 MODE 命令给 MaixCam 硬件
        if _hardware_router:
            _hardware_router.send_mode(instrument)
        return {"type": "instrument", "instrument": instrument}

    if msg_type == "auto_strum":
        enabled = data.get("enabled", False)
        bpm = data.get("bpm")
        if _hardware_router:
            _hardware_router.set_auto_strum(enabled, bpm)
        return {
            "type": "auto_strum_status",
            "enabled": _hardware_router.auto_strum_enabled if _hardware_router else enabled,
            "bpm": _hardware_router.auto_strum_bpm if _hardware_router else (bpm or 120),
        }

    if msg_type == "set_strum_pattern":
        pattern = data.get("pattern")
        if not pattern:
            return None
        if _hardware_router:
            _hardware_router.set_strum_pattern(pattern)
        return {
            "type": "strum_pattern_status",
            "pattern": _hardware_router.auto_strum_pattern if _hardware_router else pattern,
        }

    if msg_type == "set_volume":
        volume = data.get("volume")
        if volume is None:
            return None
        return {"type": "volume", "volume": volume}

    return data


async def handler(websocket, path=None):
    clients.add(websocket)
    client_id = id(websocket)
    print(f"[+] 客户端已连接 (id={client_id}), 当前 {len(clients)} 个")

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                data = normalize_message(data)
                if data is None:
                    continue
                # 广播给其他所有客户端
                await broadcast(data, exclude=websocket)
            except json.JSONDecodeError:
                print(f"[!] 收到无效 JSON: {message}")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        clients.discard(websocket)
        print(f"[-] 客户端断开 (id={client_id}), 剩余 {len(clients)} 个")


async def broadcast(msg, exclude=None):
    """广播消息给所有客户端（排除发送者）"""
    if not clients:
        return
    payload = json.dumps(msg, ensure_ascii=False)
    tasks = []
    for client in clients:
        if client != exclude:
            tasks.append(client.send(payload))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def start_server(host="0.0.0.0", port=8765):
    """启动 WebSocket 服务器"""
    async with websockets.serve(handler, host, port):
        print(f"WebSocket 服务器已启动: ws://{host}:{port}")
        await asyncio.Future()  # 永久运行
