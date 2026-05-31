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

  const ROOTS = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];
  const INSTRUMENTS = [
    { id: 'piano', label: '钢琴' },
    { id: 'guitar', label: '吉他' },
    { id: 'drums', label: '鼓' },
    { id: 'musicbox', label: '音乐盒' }
  ];
  const QUALITIES = [
    { id: 'major', label: 'Major' },
    { id: 'minor', label: 'Minor' },
    { id: 'diminished', label: 'Dim' },
    { id: 'dominant seventh', label: '7' },
    { id: 'major seventh', label: 'Maj7' }
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
    drawRootZones(w, h);
    drawQualityWheel(w, h);
    drawHands(w, h);
  }

  function drawInstrumentZones(w, h) {
    const topH = h * 0.18;
    const active = currentMeta.instrumentZone?.instrument || null;
    const zoneW = w / INSTRUMENTS.length;

    INSTRUMENTS.forEach((instrument, index) => {
      const x = index * zoneW;
      const isActive = instrument.id === active;
      canvasCtx.fillStyle = isActive ? 'rgba(140, 100, 255, 0.24)' : 'rgba(20, 22, 34, 0.38)';
      canvasCtx.fillRect(x, 0, zoneW, topH);
      canvasCtx.strokeStyle = isActive ? 'rgba(175, 145, 255, 0.9)' : 'rgba(120, 130, 170, 0.25)';
      canvasCtx.lineWidth = isActive ? 2 : 1;
      canvasCtx.strokeRect(x + 0.5, 0.5, zoneW - 1, topH - 1);

      canvasCtx.fillStyle = isActive ? 'rgba(235, 232, 255, 0.95)' : 'rgba(210, 214, 235, 0.62)';
      canvasCtx.font = '600 12px system-ui, sans-serif';
      canvasCtx.textAlign = 'center';
      canvasCtx.textBaseline = 'middle';
      canvasCtx.fillText(instrument.label, x + zoneW / 2, topH / 2);
    });
  }

  function drawRootZones(w, h) {
    const bottomH = h * 0.25;
    const y = h - bottomH;
    const zoneW = w / ROOTS.length;
    const activeIndex = currentMeta.root?.candidateIndex ?? currentMeta.root?.index;

    ROOTS.forEach((root, index) => {
      const x = index * zoneW;
      const isActive = index === activeIndex;
      canvasCtx.fillStyle = isActive ? 'rgba(100, 180, 255, 0.24)' : 'rgba(20, 22, 34, 0.42)';
      canvasCtx.fillRect(x, y, zoneW, bottomH);
      canvasCtx.strokeStyle = isActive ? 'rgba(130, 200, 255, 0.95)' : 'rgba(120, 130, 170, 0.25)';
      canvasCtx.lineWidth = isActive ? 2 : 1;
      canvasCtx.strokeRect(x + 0.5, y + 0.5, zoneW - 1, bottomH - 1);

      canvasCtx.fillStyle = isActive ? 'rgba(235, 246, 255, 0.95)' : 'rgba(210, 214, 235, 0.62)';
      canvasCtx.font = `${zoneW < 52 ? '10px' : '11px'} ui-monospace, monospace`;
      canvasCtx.textAlign = 'center';
      canvasCtx.textBaseline = 'middle';
      canvasCtx.fillText(root, x + zoneW / 2, y + bottomH / 2);
    });
  }

  function drawQualityWheel(w, h) {
    const cx = w * 0.18;
    const cy = h * 0.45;
    const radius = Math.min(w, h) * 0.18;
    const muteRadius = radius * 0.35;
    const step = (Math.PI * 2) / QUALITIES.length;
    const activeQuality = currentMeta.quality?.candidate || currentMeta.quality?.name || null;

    QUALITIES.forEach((quality, index) => {
      const start = -Math.PI / 2 + index * step;
      const end = start + step;
      const isActive = quality.id === activeQuality;

      canvasCtx.beginPath();
      canvasCtx.moveTo(cx, cy);
      canvasCtx.arc(cx, cy, radius, start, end);
      canvasCtx.closePath();
      canvasCtx.fillStyle = isActive ? 'rgba(140, 100, 255, 0.30)' : 'rgba(28, 30, 44, 0.48)';
      canvasCtx.fill();
      canvasCtx.strokeStyle = isActive ? 'rgba(175, 145, 255, 0.9)' : 'rgba(120, 130, 170, 0.25)';
      canvasCtx.lineWidth = isActive ? 2 : 1;
      canvasCtx.stroke();

      const labelAngle = start + step / 2;
      const labelRadius = radius * 0.72;
      canvasCtx.fillStyle = isActive ? 'rgba(235, 232, 255, 0.95)' : 'rgba(210, 214, 235, 0.66)';
      canvasCtx.font = '600 10px system-ui, sans-serif';
      canvasCtx.textAlign = 'center';
      canvasCtx.textBaseline = 'middle';
      canvasCtx.fillText(
        quality.label,
        cx + Math.cos(labelAngle) * labelRadius,
        cy + Math.sin(labelAngle) * labelRadius
      );
    });

    canvasCtx.beginPath();
    canvasCtx.arc(cx, cy, muteRadius, 0, Math.PI * 2);
    canvasCtx.fillStyle = activeQuality === 'mute' ? 'rgba(220, 80, 80, 0.35)' : 'rgba(12, 14, 22, 0.78)';
    canvasCtx.fill();
    canvasCtx.strokeStyle = activeQuality === 'mute' ? 'rgba(240, 125, 125, 0.9)' : 'rgba(120, 130, 170, 0.35)';
    canvasCtx.lineWidth = activeQuality === 'mute' ? 2 : 1;
    canvasCtx.stroke();

    canvasCtx.fillStyle = activeQuality === 'mute' ? 'rgba(255, 232, 232, 0.95)' : 'rgba(210, 214, 235, 0.7)';
    canvasCtx.font = '600 10px system-ui, sans-serif';
    canvasCtx.textAlign = 'center';
    canvasCtx.textBaseline = 'middle';
    canvasCtx.fillText('Mute', cx, cy);
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
