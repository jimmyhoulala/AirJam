/**
 * 系统状态模块
 * 显示连接状态、帧率、延迟等系统信息
 */
const Status = (() => {
  let wsDotEl, wsLabelEl;
  let hardwareDotEl;
  let backendDotEl, backendLabelEl;
  let eventEl, latencyEl, frameCountEl;

  let latencyStart = 0;
  let eventCount = 0;
  let frameCount = 0;

  function init() {
    wsDotEl = document.getElementById('wsStatus');
    wsLabelEl = document.getElementById('wsLabel');
    hardwareDotEl = document.getElementById('hardwareStatus');
    backendDotEl = document.getElementById('backendStatus');
    backendLabelEl = document.getElementById('backendLabel');
    eventEl = document.getElementById('eventDisplay');
    latencyEl = document.getElementById('latencyDisplay');
    frameCountEl = document.getElementById('frameCountDisplay');
  }

  function setDot(dotEl, state) {
    if (!dotEl) return;
    dotEl.classList.remove('connected', 'warning', 'error');
    if (state) dotEl.classList.add(state);
  }

  function setWebSocket(connected) {
    setDot(wsDotEl, connected ? 'connected' : 'error');
    if (wsLabelEl) wsLabelEl.textContent = connected ? '在线' : '离线';
  }

  function setHardware(connected) {
    setDot(hardwareDotEl, connected ? 'connected' : 'warning');
  }

  function setBackend(connected) {
    setDot(backendDotEl, connected ? 'connected' : 'error');
    if (backendLabelEl) backendLabelEl.textContent = connected ? '在线' : '离线';
  }

  function setFps(fps) {
    if (eventEl) eventEl.textContent = fps;
  }

  function incrementEvents() {
    eventCount += 1;
    if (eventEl) eventEl.textContent = eventCount;
  }

  function startLatency() {
    latencyStart = performance.now();
  }

  function endLatency() {
    if (latencyStart === 0) return;
    const latency = Math.round(performance.now() - latencyStart);
    latencyStart = 0;
    if (latencyEl) latencyEl.textContent = latency + 'ms';
    return latency;
  }

  function setLatency(ms) {
    if (latencyEl) latencyEl.textContent = ms + 'ms';
  }

  function incrementFrames() {
    frameCount += 1;
    if (frameCountEl) frameCountEl.textContent = frameCount;
  }

  return { init, setWebSocket, setHardware, setBackend, setFps, incrementEvents, incrementFrames, startLatency, endLatency, setLatency };
})();
