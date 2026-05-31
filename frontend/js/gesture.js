/**
 * 手势可视化模块
 * 在 Canvas 上绘制手部关键点、根音区、乐器区和和弦性质轮盘
 */
const Gesture = (() => {
  let canvasCtx = null;
  let canvasEl = null;
  let animationId = null;
  let currentHands = [];
  let currentMeta = {};

  const INSTRUMENTS = [
    { id: 'drums', label: '鼓' },
    { id: 'electric_guitar', label: '电吉他' },
    { id: 'acoustic_guitar', label: '木吉他' },
    { id: 'piano', label: '钢琴' }
  ];

  const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17]
  ];

  const TIP_INDICES = [4, 8, 12, 16, 20];

  function init() {
    canvasEl = Camera.getCanvas();
    canvasCtx = canvasEl.getContext('2d');
  }

  function updateGesture(msg) {
    currentMeta = msg || {};
    if (Array.isArray(msg?.hands)) {
      currentHands = msg.hands;
      return;
    }
    updateLandmarks(msg?.landmarks || []);
  }

  function updateLandmarks(landmarks) {
    currentHands = landmarks && landmarks.length
      ? [{ handedness: 'Right', score: 0, landmarks }]
      : [];
  }

  function clear() {
    if (canvasCtx) {
      canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
    currentHands = [];
    currentMeta = {};
  }

  function draw() {
    if (!canvasCtx || !canvasEl) return;

    const w = canvasEl.width;
    const h = canvasEl.height;
    canvasCtx.clearRect(0, 0, w, h);

    drawInstrumentZones(w, h);
    drawEventLabel(w, h);
    drawHands(w, h);
  }

  function drawInstrumentZones(w, h) {
    const active = currentMeta.instrumentZone?.instrument || currentMeta.instrument || null;
    const zoneW = w / INSTRUMENTS.length;

    INSTRUMENTS.forEach((instrument, index) => {
      const x = index * zoneW;
      const isActive = instrument.id === active;
      canvasCtx.fillStyle = isActive ? 'rgba(140, 100, 255, 0.18)' : 'rgba(20, 22, 34, 0.32)';
      canvasCtx.fillRect(x, 0, zoneW, h);
      canvasCtx.strokeStyle = isActive ? 'rgba(175, 145, 255, 0.9)' : 'rgba(120, 130, 170, 0.25)';
      canvasCtx.lineWidth = isActive ? 2 : 1;
      canvasCtx.strokeRect(x + 0.5, 0.5, zoneW - 1, h - 1);

      canvasCtx.fillStyle = isActive ? 'rgba(235, 232, 255, 0.95)' : 'rgba(210, 214, 235, 0.62)';
      canvasCtx.font = '600 15px system-ui, sans-serif';
      canvasCtx.textAlign = 'center';
      canvasCtx.textBaseline = 'middle';
      canvasCtx.fillText(instrument.label, x + zoneW / 2, 32);
    });
  }

  function drawEventLabel(w, h) {
    const label = currentMeta.eventLabel || currentMeta.note || currentMeta.chord || '';
    if (!label) return;

    canvasCtx.save();
    canvasCtx.fillStyle = 'rgba(8, 10, 18, 0.56)';
    canvasCtx.fillRect(0, h * 0.38, w, h * 0.24);
    canvasCtx.fillStyle = 'rgba(235, 246, 255, 0.96)';
    canvasCtx.font = '700 42px system-ui, sans-serif';
    canvasCtx.textAlign = 'center';
    canvasCtx.textBaseline = 'middle';
    canvasCtx.shadowColor = 'rgba(100, 180, 255, 0.45)';
    canvasCtx.shadowBlur = 18;
    canvasCtx.fillText(label, w / 2, h / 2, w * 0.86);
    canvasCtx.restore();
  }

  function drawHands(w, h) {
    currentHands.forEach(hand => {
      const landmarks = hand.landmarks || [];
      if (landmarks.length === 0) return;

      const isLeft = hand.handedness === 'Left';
      const stroke = isLeft ? 'rgba(255, 175, 110, 0.62)' : 'rgba(100, 180, 255, 0.62)';
      const tip = isLeft ? 'rgba(255, 190, 120, 0.95)' : 'rgba(140, 205, 255, 0.95)';

      canvasCtx.save();
      canvasCtx.shadowColor = isLeft ? 'rgba(255, 175, 110, 0.35)' : 'rgba(100, 180, 255, 0.35)';
      canvasCtx.shadowBlur = 8;
      canvasCtx.strokeStyle = stroke;
      canvasCtx.lineWidth = 2;
      canvasCtx.lineCap = 'round';

      HAND_CONNECTIONS.forEach(([i, j]) => {
        const p1 = landmarks[i];
        const p2 = landmarks[j];
        if (p1 && p2) {
          canvasCtx.beginPath();
          canvasCtx.moveTo(p1.x * w, p1.y * h);
          canvasCtx.lineTo(p2.x * w, p2.y * h);
          canvasCtx.stroke();
        }
      });
      canvasCtx.restore();

      landmarks.forEach((point, index) => {
        const x = point.x * w;
        const y = point.y * h;
        const isTip = TIP_INDICES.includes(index);

        canvasCtx.save();
        if (isTip) {
          canvasCtx.shadowColor = tip;
          canvasCtx.shadowBlur = 10;
        }
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, isTip ? 5 : 3, 0, Math.PI * 2);
        canvasCtx.fillStyle = isTip ? tip : 'rgba(220, 226, 245, 0.62)';
        canvasCtx.fill();
        canvasCtx.restore();
      });
    });
  }

  function startRenderLoop() {
    if (animationId) return;
    function loop() {
      draw();
      animationId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopRenderLoop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    clear();
  }

  return { init, updateGesture, updateLandmarks, clear, draw, startRenderLoop, stopRenderLoop };
})();
