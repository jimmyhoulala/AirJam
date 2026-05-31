/**
 * 系统状态模块
 * 显示连接状态、帧率、延迟等系统信息
 */
const Status = (() => {
  let wsDotEl, wsLabelEl;
  let esp32DotEl, esp32LabelEl;
  let backendDotEl, backendLabelEl;
  let fpsEl, latencyEl;

  let latencyStart = 0;

  function init() {
    wsDotEl = document.getElementById('wsStatus');
    wsLabelEl = document.getElementById('wsLabel');
    esp32DotEl = document.getElementById('esp32Status');
    esp32LabelEl = document.getElementById('esp32Label');
    backendDotEl = document.getElementById('backendStatus');
    backendLabelEl = document.getElementById('backendLabel');
    fpsEl = document.getElementById('fpsDisplay');
    latencyEl = document.getElementById('latencyDisplay');
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

  function setESP32(connected) {
    setDot(esp32DotEl, connected ? 'connected' : 'warning');
    if (esp32LabelEl) esp32LabelEl.textContent = connected ? '在线' : '离线';
  }

  function setBackend(connected) {
    setDot(backendDotEl, connected ? 'connected' : 'error');
    if (backendLabelEl) backendLabelEl.textContent = connected ? '在线' : '离线';
  }

  function setFps(fps) {
    if (fpsEl) fpsEl.textContent = fps;
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

  return { init, setWebSocket, setESP32, setBackend, setFps, startLatency, endLatency, setLatency };
})();
