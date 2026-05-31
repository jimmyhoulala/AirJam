#!/bin/bash
echo "========================================"
echo "  隔空弹奏乐器 - 启动本地服务器"
echo "========================================"
echo ""
echo "浏览器打开: http://localhost:8080"
echo "按 Ctrl+C 停止服务器"
echo ""
cd "$(dirname "$0")"
python3 -m http.server 8080
