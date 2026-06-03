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
    { id: 'drums', label: '鼓', icon: '🥁', hint: '右手击打' },
    { id: 'electric_guitar', label: '电吉他', icon: '🎸', hint: '左手和弦 右手扫弦' },
    { id: 'acoustic_guitar', label: '木吉他', icon: '🪕', hint: '左手和弦 右手扫弦' },
    { id: 'piano', label: '钢琴', icon: '🎹', hint: '左手八度 右手弹奏' }
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
  const NOTE_SYMBOLS = ['♪', '♫', '♬', '♩', '𝅘𝅥𝅮'];

  // 乐器主题色（与 CSS 同步）
  const THEME_COLORS = {
    piano:            { h: 280, accent: '#a78bfa', glow: 'rgba(167,139,250,', zone: 'rgba(140,100,255,' },
    electric_guitar:  { h: 200, accent: '#5bc0eb', glow: 'rgba(91,192,235,',   zone: 'rgba(60,170,220,' },
    acoustic_guitar:  { h: 55,  accent: '#e8c547', glow: 'rgba(232,197,71,',   zone: 'rgba(210,180,60,' },
    drums:            { h: 15,  accent: '#e85d4a', glow: 'rgba(232,93,74,',    zone: 'rgba(220,80,60,' },
  };

  function getTheme() {
    const inst = currentMeta.instrument || currentMeta.instrumentZone?.instrument;
    return THEME_COLORS[inst] || THEME_COLORS.piano;
  }

  function getThemeParticles() {
    const t = getTheme();
    return [t.accent, '#60a5fa', '#f472b6', '#34d399', '#fbbf24'];
  }

  // 事件动效状态
  let eventParticles = [];
  let eventLabelAnim = null;
  let lastEventLabel = '';

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
    eventParticles = [];
    eventLabelAnim = null;
    lastEventLabel = '';
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
    const current = currentMeta.instrument || null;
    // 已选中具体乐器时不绘制区域边框
    const KNOWN = new Set(INSTRUMENTS.map(i => i.id));
    if (current && KNOWN.has(current)) return;

    const zoneW = w / INSTRUMENTS.length;

    INSTRUMENTS.forEach((instrument, index) => {
      const x = index * zoneW;
      const cx = x + zoneW / 2;
      const cy = h / 2;

      canvasCtx.fillStyle = 'rgba(20, 22, 34, 0.38)';
      canvasCtx.fillRect(x, 0, zoneW, h);
      canvasCtx.strokeStyle = 'rgba(120, 130, 170, 0.3)';
      canvasCtx.lineWidth = 1;
      canvasCtx.strokeRect(x + 0.5, 0.5, zoneW - 1, h - 1);

      // 乐器图标
      canvasCtx.fillStyle = 'rgba(235, 240, 255, 0.88)';
      canvasCtx.font = '56px system-ui, sans-serif';
      canvasCtx.textAlign = 'center';
      canvasCtx.textBaseline = 'middle';
      canvasCtx.fillText(instrument.icon, cx, cy);
    });
  }

  function spawnEventParticles(cx, cy) {
    const count = 10 + Math.floor(Math.random() * 6);
    const colors = getThemeParticles();
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 1.2 + Math.random() * 2.5;
      eventParticles.push({
        symbol: NOTE_SYMBOLS[Math.floor(Math.random() * NOTE_SYMBOLS.length)],
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        life: 1.0,
        decay: 0.012 + Math.random() * 0.01,
        size: 16 + Math.random() * 18,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.08,
      });
    }
  }

  function drawEventLabel(w, h) {
    const label = currentMeta.eventLabel || currentMeta.note || currentMeta.chord || '';

    // 新事件触发粒子爆发
    if (label && label !== lastEventLabel) {
      lastEventLabel = label;
      eventLabelAnim = { label, birth: performance.now(), life: 1.0 };
      spawnEventParticles(w / 2, h / 2);
    }

    // 绘制粒子
    for (let i = eventParticles.length - 1; i >= 0; i--) {
      const p = eventParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.life -= p.decay;
      p.rotation += p.rotSpeed;
      if (p.life <= 0) {
        eventParticles.splice(i, 1);
        continue;
      }
      canvasCtx.save();
      canvasCtx.globalAlpha = p.life;
      canvasCtx.translate(p.x, p.y);
      canvasCtx.rotate(p.rotation);
      canvasCtx.font = `${p.size}px system-ui, sans-serif`;
      canvasCtx.textAlign = 'center';
      canvasCtx.textBaseline = 'middle';
      canvasCtx.shadowColor = p.color;
      canvasCtx.shadowBlur = 12;
      canvasCtx.fillStyle = p.color;
      canvasCtx.fillText(p.symbol, 0, 0);
      canvasCtx.restore();
    }

    // 绘制事件标签（弹入 + 淡出）
    if (eventLabelAnim) {
      const elapsed = (performance.now() - eventLabelAnim.birth) / 1000;
      if (elapsed > 2.0) {
        eventLabelAnim = null;
      } else {
        let alpha;
        if (elapsed < 0.15) {
          alpha = elapsed / 0.15;
        } else if (elapsed > 1.5) {
          alpha = 1 - (elapsed - 1.5) / 0.5;
        } else {
          alpha = 1;
        }
        const scale = elapsed < 0.15 ? 0.5 + 0.5 * (elapsed / 0.15) : 1.0;
        alpha = Math.max(0, Math.min(1, alpha));

        canvasCtx.save();
        canvasCtx.globalAlpha = alpha;
        canvasCtx.translate(w / 2, h / 2);
        canvasCtx.scale(scale, scale);
        const theme = getTheme();
        canvasCtx.font = '700 42px system-ui, sans-serif';
        canvasCtx.textAlign = 'center';
        canvasCtx.textBaseline = 'middle';
        canvasCtx.shadowColor = theme.glow + '0.6)';
        canvasCtx.shadowBlur = 20;
        canvasCtx.fillStyle = 'rgba(235, 246, 255, 0.96)';
        canvasCtx.fillText(eventLabelAnim.label, 0, 0, w * 0.86);
        canvasCtx.restore();
      }
    }

    // 无事件时清空旧标签
    if (!label) {
      lastEventLabel = '';
    }
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

  function triggerEvent(label) {
    if (!canvasEl) return;
    const cx = canvasEl.width / 2;
    const cy = canvasEl.height / 2;
    lastEventLabel = label;
    eventLabelAnim = { label, birth: performance.now(), life: 1.0 };
    spawnEventParticles(cx, cy);
  }

  return { init, updateGesture, updateLandmarks, clear, draw, triggerEvent, startRenderLoop, stopRenderLoop };
})();
