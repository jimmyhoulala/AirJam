/**
 * 浮动音符模块
 * 演奏时在摄像头画面上飘出彩色音符
 */
const FloatingNotes = (() => {
  let container = null;
  const NOTE_SYMBOLS = ['♪', '♫', '♬', '♩', '𝅘𝅥𝅮', '𝅗𝅥'];
  const MAX_NOTES = 20;

  function init() {
    container = document.getElementById('floatingNotes');
  }

  function spawn(note) {
    if (!container) return;

    const el = document.createElement('span');
    el.className = 'floating-note';
    el.textContent = NOTE_SYMBOLS[Math.floor(Math.random() * NOTE_SYMBOLS.length)];
    el.dataset.note = note;

    // Random horizontal position
    el.style.left = (10 + Math.random() * 80) + '%';
    el.style.bottom = '10%';

    // Random size variation
    const scale = 0.8 + Math.random() * 0.6;
    el.style.fontSize = (scale * 1.5) + 'rem';

    container.appendChild(el);

    // Remove after animation
    setTimeout(() => el.remove(), 2000);

    // Cleanup old notes
    while (container.children.length > MAX_NOTES) {
      container.firstChild.remove();
    }
  }

  return { init, spawn };
})();

/**
 * 主入口模块
 * 整合所有子模块，初始化应用
 */
const App = (() => {
  const params = new URLSearchParams(window.location.search);
  let mockMode = params.get('mock') === '1';
  let localAudio = params.get('localAudio') === '1';
  let mockInterval = null;

  function init() {
    Camera.init();
    Gesture.init();
    if (localAudio) Audio.init();
    Instrument.init();
    Player.init();
    Status.init();
    FloatingNotes.init();

    bindEvents();
    Gesture.startRenderLoop();
    Camera.setBridgeActive(false);

    if (mockMode) {
      startMockData();
    } else {
      WS.connect('ws://localhost:8765');
    }
  }

  function bindEvents() {
    // Camera controls
    const startCameraBtn = document.getElementById('btnStartCamera');
    const stopCameraBtn = document.getElementById('btnStopCamera');
    if (startCameraBtn && stopCameraBtn) {
      startCameraBtn.addEventListener('click', async () => {
        const success = await Camera.start();
        if (success) {
          startCameraBtn.disabled = true;
          stopCameraBtn.disabled = false;
        }
      });

      stopCameraBtn.addEventListener('click', () => {
        Camera.stop();
        startCameraBtn.disabled = false;
        stopCameraBtn.disabled = true;
      });
    }

    // WebSocket status
    WS.on('status', (data) => {
      Status.setWebSocket(data.connected);
      Status.setBackend(data.connected);
      if (!data.connected && !mockMode) Camera.setBridgeActive(false);
    });

    WS.on('hardware_status', (msg) => {
      Status.setHardware(msg.connected, msg.connected ? msg.mode : '');
      Camera.setBridgeActive(msg.connected);
      updateMappingPanel({ instrument: msg.mode });
      // 同步模式到手势模块，确保退回选乐器时区域边框恢复
      if (msg.mode === 'selecting') {
        Gesture.updateGesture({ instrument: null });
      }
    });

    WS.on('camera_frame', (msg) => {
      Status.setHardware(true, 'video');
      Camera.setFrame(msg.dataUrl);
    });

    // Gesture data
    WS.on('gesture', (msg) => {
      Status.startLatency();
      Camera.setBridgeActive(true);
      Gesture.updateGesture(msg);
      updateMappingPanel(msg);
      Status.endLatency();

      const nameEl = document.getElementById('gestureName');
      const confEl = document.getElementById('gestureConfidence');
      if (nameEl) {
        const newName = msg.gesture || '--';
        if (nameEl.textContent !== newName) {
          nameEl.classList.add('changing');
          setTimeout(() => nameEl.classList.remove('changing'), 300);
        }
        nameEl.textContent = newName;
      }
      if (confEl) confEl.textContent = msg.confidence
        ? `置信度 ${Math.round(msg.confidence * 100)}%`
        : '';
    });

    // Chord data - play audio
    WS.on('chord', (msg) => {
      Status.incrementEvents();
      if (msg.instrument) Instrument.select(msg.instrument, { silent: true, force: true });
      setHardwareEvent(msg.chord || msg.root || '--', msg.instrument || '');
      Gesture.updateGesture({
        instrument: msg.instrument,
        chord: msg.chord,
        eventLabel: msg.chord
      });
      if (localAudio && !msg.muted) {
        Audio.playChord(msg);
      }
      if (!msg.muted) FloatingNotes.spawn(msg.chord || msg.root);
      Player.setChord(msg);
      Player.setPlaying(!msg.muted);
      updateMappingPanel({
        instrument: msg.instrument,
        root: { index: msg.rootIndex, name: msg.root },
        quality: { name: msg.quality, label: msg.qualityLabel }
      });
    });

    // Note data - play audio
    WS.on('note', (msg) => {
      Status.incrementEvents();
      if (msg.instrument) Instrument.select(msg.instrument, { silent: true, force: true });
      setHardwareEvent(msg.note || '--', msg.instrument || '');
      Gesture.updateGesture({
        instrument: msg.instrument,
        note: msg.note,
        eventLabel: msg.note
      });
      if (localAudio) Audio.playNote(msg.note);
      Player.setNote(msg.note);
      Player.setPlaying(true);
      FloatingNotes.spawn(msg.note);
    });

    WS.on('drum', (msg) => {
      Status.incrementEvents();
      Instrument.select('drums', { silent: true, force: true });
      const label = `${msg.drum || 'drum'} ${msg.velocity || ''}`.trim();
      setHardwareEvent(label, `power ${msg.power || 0}`);
      Gesture.updateGesture({
        instrument: 'drums',
        eventLabel: label
      });
      Player.setNote(label);
      Player.setPlaying(true);
      if (localAudio) Audio.playNote('C3');
      FloatingNotes.spawn('drums');
      updateMappingPanel({ instrument: 'drums', root: msg.drum, quality: msg.velocity });
    });

    // Volume data
    WS.on('volume', (msg) => {
      Audio.setVolume(msg.volume);
      Player.setVolume(msg.volume);
    });

    // Instrument switch
    WS.on('instrument', (msg) => {
      Instrument.select(msg.instrument, { silent: true });
      setHardwareEvent(Instrument.getInstrument(msg.instrument)?.name || msg.instrument, 'mode');
      Gesture.updateGesture({ instrument: msg.instrument, eventLabel: Instrument.getInstrument(msg.instrument)?.name || msg.instrument });
      updateMappingPanel({ instrument: msg.instrument });
    });

    // Camera FPS
    Camera.on('fps', (fps) => {
      Status.setFps(fps);
    });

    // Camera error
    Camera.on('error', (err) => {
      console.warn('摄像头错误:', err.message);
    });

    // Instrument change event - sync audio, gesture, and auto-strum visibility
    Instrument.on('change', (data) => {
      Audio.setInstrument(data.instrument);
      Gesture.updateGesture({ instrument: data.instrument });
      Gesture.triggerEvent(data.name || data.instrument);
      Gesture.draw();
      updateAutoStrumVisibility(data.instrument);
    });

    // Auto-strum controls
    initAutoStrum();
  }

  function updateMappingPanel(msg = {}) {
    const instrumentNames = {
      piano: '钢琴',
      electric_guitar: '电吉他',
      acoustic_guitar: '木吉他',
      drums: '鼓',
      selecting: '选择中'
    };
    const qualityLabels = {
      major: 'Major',
      minor: 'Minor',
      diminished: 'Dim',
      'dominant seventh': '7',
      'major seventh': 'Maj7',
      mute: 'Mute'
    };

    const mapInstrument = document.getElementById('mapInstrument');
    const mapRoot = document.getElementById('mapRoot');
    const mapQuality = document.getElementById('mapQuality');

    const instrument = msg.instrumentZone?.instrument || msg.instrument;
    if (mapInstrument && instrument) mapInstrument.textContent = instrumentNames[instrument] || instrument;

    const rootName = msg.root?.candidateName || msg.root?.name || msg.root;
    if (mapRoot && rootName) mapRoot.textContent = rootName;

    const qualityName = msg.quality?.candidate || msg.quality?.label || msg.quality?.name || msg.qualityLabel || msg.quality;
    if (mapQuality && qualityName) mapQuality.textContent = qualityLabels[qualityName] || qualityName;
    setInstrumentChips(instrument);
  }

  function setInstrumentChips(activeInstrument) {
    const chips = document.querySelectorAll('#qualityChips [data-instrument-chip]');
    chips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.instrumentChip === activeInstrument);
    });
  }

  function setHardwareEvent(label, meta = '') {
    const nameEl = document.getElementById('gestureName');
    const confEl = document.getElementById('gestureConfidence');
    if (nameEl) {
      if (nameEl.textContent !== label) {
        nameEl.classList.add('changing');
        setTimeout(() => nameEl.classList.remove('changing'), 300);
      }
      nameEl.textContent = label;
    }
    if (confEl) confEl.textContent = meta;
  }

  // ===== 自动扫弦 =====
  let autoStrumEnabled = false;
  let autoStrumBpm = 120;

  function initAutoStrum() {
    const bar = document.getElementById('autoStrumBar');
    const toggle = document.getElementById('autoStrumToggle');
    const bpmDown = document.getElementById('bpmDown');
    const bpmUp = document.getElementById('bpmUp');
    const bpmValue = document.getElementById('bpmValue');
    if (!bar || !toggle) return;

    toggle.addEventListener('click', () => {
      autoStrumEnabled = !autoStrumEnabled;
      toggle.classList.toggle('active', autoStrumEnabled);
      WS.send({ type: 'auto_strum', enabled: autoStrumEnabled, bpm: autoStrumBpm });
    });

    if (bpmDown) {
      bpmDown.addEventListener('click', () => {
        autoStrumBpm = Math.max(40, autoStrumBpm - 10);
        if (bpmValue) bpmValue.textContent = autoStrumBpm;
        if (autoStrumEnabled) WS.send({ type: 'auto_strum', enabled: true, bpm: autoStrumBpm });
      });
    }

    if (bpmUp) {
      bpmUp.addEventListener('click', () => {
        autoStrumBpm = Math.min(240, autoStrumBpm + 10);
        if (bpmValue) bpmValue.textContent = autoStrumBpm;
        if (autoStrumEnabled) WS.send({ type: 'auto_strum', enabled: true, bpm: autoStrumBpm });
      });
    }

    // 监听后端状态同步
    WS.on('auto_strum_status', (msg) => {
      autoStrumEnabled = msg.enabled;
      autoStrumBpm = msg.bpm || autoStrumBpm;
      toggle.classList.toggle('active', autoStrumEnabled);
      if (bpmValue) bpmValue.textContent = autoStrumBpm;
    });

    // 节奏型选项卡
    const patternTabs = document.getElementById('strumPatternTabs');
    if (patternTabs) {
      patternTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.strum-pattern-tab');
        if (!tab) return;
        const pattern = tab.dataset.pattern;
        if (!pattern) return;
        // 更新UI
        patternTabs.querySelectorAll('.strum-pattern-tab').forEach(t => {
          t.classList.toggle('active', t === tab);
        });
        // 发送给后端
        WS.send({ type: 'set_strum_pattern', pattern });
      });
    }

    // 监听后端节奏型同步
    WS.on('strum_pattern_status', (msg) => {
      const pattern = msg.pattern;
      if (patternTabs && pattern) {
        patternTabs.querySelectorAll('.strum-pattern-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.pattern === pattern);
        });
      }
    });
  }

  function updateAutoStrumVisibility(instrument) {
    const bar = document.getElementById('autoStrumBar');
    if (!bar) return;
    const isGuitar = instrument === 'electric_guitar' || instrument === 'acoustic_guitar';
    bar.classList.toggle('visible', isGuitar);
    // 切离吉他时关闭自动扫弦
    if (!isGuitar && autoStrumEnabled) {
      autoStrumEnabled = false;
      const toggle = document.getElementById('autoStrumToggle');
      if (toggle) toggle.classList.remove('active');
      WS.send({ type: 'auto_strum', enabled: false });
    }
  }

  /**
   * Mock data for local testing
   */
  function startMockData() {
    const badge = document.getElementById('mockBadge');
    if (badge) badge.classList.add('visible');

    setTimeout(() => {
      Status.setWebSocket(true);
      Status.setBackend(true);
      Status.setHardware(true, 'mock');
    }, 600);

    let gestureIndex = 0;
    const gestures = ['Piano C4', 'Electric C5 down', 'Acoustic G up', 'Snare accent'];
    const mockChords = [
      { type: 'note', instrument: 'piano', note: 'C4' },
      { type: 'chord', instrument: 'electric_guitar', root: 'C5', quality: 'strum', qualityLabel: 'down', chord: 'C5 down', frequencies: [130.81, 196, 261.63], midiNotes: [48, 55, 60], muted: false },
      { type: 'chord', instrument: 'acoustic_guitar', root: 'G', quality: 'strum', qualityLabel: 'up', chord: 'G up', frequencies: [98, 123.47, 146.83, 196, 246.94, 392], midiNotes: [43, 47, 50, 55, 59, 67], muted: false },
      { type: 'drum', instrument: 'drums', drum: 'snare', velocity: 'accent', power: 1200 }
    ];

    mockInterval = setInterval(() => {
      const event = mockChords[gestureIndex % mockChords.length];
      const mockGesture = {
        type: 'gesture',
        hands: [],
        instrument: event.instrument,
        eventLabel: event.chord || event.note || `${event.drum} ${event.velocity}`,
        instrumentZone: null,
        muted: false
      };
      Gesture.updateGesture(mockGesture);
      Camera.setBridgeActive(true);
      updateMappingPanel(mockGesture);

      const nameEl = document.getElementById('gestureName');
      const confEl = document.getElementById('gestureConfidence');
      if (nameEl) nameEl.textContent = gestures[gestureIndex % gestures.length];
      if (confEl) confEl.textContent = `置信度 ${Math.round(85 + Math.random() * 15)}%`;
      gestureIndex++;

      Status.incrementEvents();
      if (event.type === 'note') {
        if (localAudio) Audio.playNote(event.note);
        Instrument.select(event.instrument, { silent: true, force: true });
        setHardwareEvent(event.note, event.instrument);
        Player.setNote(event.note);
        FloatingNotes.spawn(event.note);
      } else if (event.type === 'chord') {
        if (localAudio) Audio.playChord(event);
        Instrument.select(event.instrument, { silent: true, force: true });
        setHardwareEvent(event.chord, event.instrument);
        Player.setChord(event);
        FloatingNotes.spawn(event.chord);
      } else {
        Instrument.select(event.instrument, { silent: true, force: true });
        setHardwareEvent(`${event.drum} ${event.velocity}`, `power ${event.power}`);
        Player.setNote(`${event.drum} ${event.velocity}`);
        FloatingNotes.spawn('drums');
      }
      Player.setPlaying(true);

      Status.setLatency(Math.round(5 + Math.random() * 15));

    }, 500);
  }

  function generateMockLandmarks(baseX = 0.3 + Math.random() * 0.4, baseY = 0.3 + Math.random() * 0.4) {
    const landmarks = [];

    for (let i = 0; i < 21; i++) {
      landmarks.push({
        x: baseX + (Math.random() - 0.5) * 0.15,
        y: baseY + (Math.random() - 0.5) * 0.15,
        z: (Math.random() - 0.5) * 0.1
      });
    }
    return landmarks;
  }

  function stopMock() {
    if (mockInterval) {
      clearInterval(mockInterval);
      mockInterval = null;
    }
    const badge = document.getElementById('mockBadge');
    if (badge) badge.classList.remove('visible');
  }

  return { init, stopMock };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
