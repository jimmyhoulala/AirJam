"""
WebSocket 服务器
连接浏览器前端和 MaixCAM2，实现消息广播
"""
import asyncio
import json
import websockets

# 所有连接的客户端
clients = set()


def normalize_message(data):
    """Normalize command-style client messages into broadcast events."""
    msg_type = data.get("type")
    if msg_type == "switch_instrument":
        instrument = data.get("instrument")
        if not instrument:
            return None
        return {"type": "instrument", "instrument": instrument}

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
