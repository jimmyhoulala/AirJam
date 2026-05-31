/**
 * WebSocket 通信模块
 * 负责与 Python 后端的实时通信
 */
const WS = (() => {
  let ws = null;
  let reconnectTimer = null;
  let reconnectDelay = 1000;
  const MAX_RECONNECT_DELAY = 30000;

  // 消息回调注册表
  const listeners = {};

  /**
   * 注册消息监听器
   * @param {string} type - 消息类型
   * @param {Function} callback - 回调函数
   */
  function on(type, callback) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(callback);
  }

  /**
   * 触发消息回调
   */
  function emit(type, data) {
    if (listeners[type]) {
      listeners[type].forEach(cb => cb(data));
    }
  }

  /**
   * 连接 WebSocket 服务器
   * @param {string} url - WebSocket 地址，默认 ws://localhost:8765
   */
  function connect(url = 'ws://localhost:8765') {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      ws = new WebSocket(url);
    } catch (e) {
      console.error('WebSocket 创建失败:', e);
      emit('status', { connected: false, error: e.message });
      scheduleReconnect(url);
      return;
    }

    ws.onopen = () => {
      console.log('WebSocket 已连接');
      reconnectDelay = 1000;
      emit('status', { connected: true });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        emit('message', msg);
        if (msg.type) {
          emit(msg.type, msg);
        }
      } catch (e) {
        console.warn('消息解析失败:', event.data);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket 已断开');
      emit('status', { connected: false });
      scheduleReconnect(url);
    };

    ws.onerror = (e) => {
      console.error('WebSocket 错误:', e);
      emit('status', { connected: false, error: '连接错误' });
    };
  }

  /**
   * 安排重连
   */
  function scheduleReconnect(url) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      console.log(`尝试重连 (延迟 ${reconnectDelay}ms)...`);
      connect(url);
      reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
    }, reconnectDelay);
  }

  /**
   * 发送消息
   * @param {object} msg - 要发送的消息对象
   */
  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      console.warn('WebSocket 未连接，消息未发送:', msg);
    }
  }

  /**
   * 断开连接
   */
  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  /**
   * 获取连接状态
   */
  function isConnected() {
    return ws && ws.readyState === WebSocket.OPEN;
  }

  return { connect, disconnect, send, on, isConnected };
})();
