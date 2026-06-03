/**
 * 硬件舞台模块
 * 只负责前端显示区域与状态遮罩，不再申请本机摄像头。
 */
const Camera = (() => {
  let videoEl = null;
  let frameEl = null;
  let canvasEl = null;
  let overlayEl = null;
  let currentFps = 0;

  const listeners = {};

  function on(type, callback) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(callback);
  }

  function emit(type, data) {
    if (listeners[type]) {
      listeners[type].forEach(cb => cb(data));
    }
  }

  function init() {
    videoEl = document.getElementById('video');
    frameEl = document.getElementById('hardwareFrame');
    canvasEl = document.getElementById('gestureCanvas');
    overlayEl = document.getElementById('cameraOverlay');

    if (videoEl) videoEl.style.display = 'none';
    if (frameEl) frameEl.style.display = 'block';

    const container = canvasEl.parentElement;
    const resizeObserver = new ResizeObserver(() => {
      canvasEl.width = container.clientWidth;
      canvasEl.height = container.clientHeight;
    });
    resizeObserver.observe(container);
  }

  function showOverlayMsg(msg, type = 'info', hint = 'MaixCAM2 / UDP 5020') {
    if (!overlayEl) return;
    overlayEl.classList.remove('hidden');

    const icon = type === 'error'
      ? '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 19l-2 3"/><path d="M16 19l2 3"/><circle cx="12" cy="12" r="3"/><path d="M12 9V7"/><path d="M15 12h2"/><path d="M12 15v2"/><path d="M9 12H7"/></svg>';

    overlayEl.innerHTML = `
      <div class="overlay-icon ${type === 'error' ? 'error' : ''}">${icon}</div>
      <p class="overlay-text">${msg}</p>
      <p class="overlay-hint">${hint}</p>
    `;
  }

  function setBridgeActive(active) {
    if (!overlayEl) return;
    if (active) {
      overlayEl.classList.add('hidden');
    } else {
      showOverlayMsg('等待 MaixCAM2 硬件事件', 'info', '后端会接收硬件 UDP 演奏数据');
    }
  }

  let _prevObjectUrl = null;

  function setFrame(dataUrl) {
    if (!frameEl || !dataUrl) return;
    // 将 base64 data URL 转为 Blob URL，减少浏览器解码开销
    if (dataUrl.startsWith('data:')) {
      try {
        const parts = dataUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)[1];
        const raw = atob(parts[1]);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        const blob = new Blob([arr], { type: mime });
        if (_prevObjectUrl) URL.revokeObjectURL(_prevObjectUrl);
        _prevObjectUrl = URL.createObjectURL(blob);
        frameEl.src = _prevObjectUrl;
      } catch (e) {
        frameEl.src = dataUrl;
      }
    } else {
      frameEl.src = dataUrl;
    }
    setBridgeActive(true);
  }

  async function start() {
    setBridgeActive(false);
    emit('error', { message: '当前模式使用 MaixCAM2 硬件摄像头，不启用本机摄像头' });
    return false;
  }

  function stop() {
    setBridgeActive(false);
    emit('stopped');
  }

  function getFps() {
    return currentFps;
  }

  function getVideo() {
    return videoEl;
  }

  function getCanvas() {
    return canvasEl;
  }

  function isRunning() {
    return false;
  }

  function setFps(fps) {
    currentFps = fps;
    emit('fps', fps);
  }

  return { init, start, stop, setBridgeActive, setFrame, setFps, getFps, getVideo, getCanvas, isRunning, on };
})();
