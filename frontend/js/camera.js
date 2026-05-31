/**
 * 摄像头画面模块
 * 负责获取和管理摄像头视频流
 */
const Camera = (() => {
  let stream = null;
  let videoEl = null;
  let canvasEl = null;
  let overlayEl = null;
  let animationId = null;
  let frameCount = 0;
  let lastFpsTime = performance.now();
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

  /**
   * 初始化摄像头模块
   */
  function init() {
    videoEl = document.getElementById('video');
    canvasEl = document.getElementById('gestureCanvas');
    overlayEl = document.getElementById('cameraOverlay');

    // 设置 Canvas 尺寸与容器匹配
    const container = canvasEl.parentElement;
    const resizeObserver = new ResizeObserver(() => {
      canvasEl.width = container.clientWidth;
      canvasEl.height = container.clientHeight;
    });
    resizeObserver.observe(container);
  }

  /**
   * 在遮罩层显示消息
   */
  function showOverlayMsg(msg, type = 'info', hint = '支持 Chrome / Edge 浏览器') {
    if (!overlayEl) return;
    overlayEl.classList.remove('hidden');

    const icon = type === 'error'
      ? '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';

    const color = type === 'error' ? 'var(--danger)' : 'var(--text-3)';

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
      showOverlayMsg('等待 Python 识别桥发送手势', 'info', '运行 gesture-instrument-bridge 后会显示骨架与映射区域');
    }
  }

  /**
   * 启动摄像头
   */
  async function start() {
    // 预检查：浏览器是否支持
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showOverlayMsg('当前浏览器不支持摄像头功能，请使用 Chrome 或 Edge', 'error');
      return false;
    }

    // 预检查：是否有摄像头设备
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      if (cameras.length === 0) {
        showOverlayMsg('未检测到摄像头设备，请连接摄像头后重试', 'error');
        return false;
      }
    } catch (e) {
      // enumerateDevices 可能失败，继续尝试 getUserMedia
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      videoEl.srcObject = stream;
      await videoEl.play();

      overlayEl.classList.add('hidden');
      emit('started');

      // 开始帧率计算
      startFpsCounter();

      return true;
    } catch (e) {
      console.error('摄像头启动失败:', e);

      // 显示错误提示
      let msg = '摄像头启动失败';
      if (e.name === 'NotAllowedError') {
        msg = '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头';
      } else if (e.name === 'NotFoundError') {
        msg = '未检测到摄像头设备，请连接摄像头后重试';
      } else if (e.name === 'NotReadableError') {
        msg = '摄像头被其他程序占用，请关闭后重试';
      } else {
        msg = '摄像头错误: ' + e.message;
      }

      showOverlayMsg(msg, 'error');
      emit('error', { message: msg });
      return false;
    }
  }

  /**
   * 停止摄像头
   */
  function stop() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    videoEl.srcObject = null;
    overlayEl.classList.remove('hidden');

    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    emit('stopped');
  }

  /**
   * 帧率计数器
   */
  function startFpsCounter() {
    frameCount = 0;
    lastFpsTime = performance.now();

    function countFrame() {
      if (!stream) return;
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        currentFps = frameCount;
        frameCount = 0;
        lastFpsTime = now;
        emit('fps', currentFps);
      }
      animationId = requestAnimationFrame(countFrame);
    }
    animationId = requestAnimationFrame(countFrame);
  }

  /**
   * 获取当前帧率
   */
  function getFps() {
    return currentFps;
  }

  /**
   * 获取视频元素
   */
  function getVideo() {
    return videoEl;
  }

  /**
   * 获取 Canvas 元素
   */
  function getCanvas() {
    return canvasEl;
  }

  /**
   * 是否正在运行
   */
  function isRunning() {
    return stream !== null;
  }

  return { init, start, stop, setBridgeActive, getFps, getVideo, getCanvas, isRunning, on };
})();
