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
  let mockMode = new URLSearchParams(window.location.search).get('mock') === '1';
  let mockInterval = null;

  function init() {
    Camera.init();
    Gesture.init();
    Audio.init();
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
      if (!msg.muted) {
        Audio.playChord(msg);
        FloatingNotes.spawn(msg.chord || msg.root);
      }
      Player.setChord(msg);
      Player.setPlaying(!msg.muted);
      updateMappingPanel({ root: { index: msg.rootIndex, name: msg.root }, quality: { name: msg.quality, label: msg.qualityLabel } });
    });

    // Note data - play audio
    WS.on('note', (msg) => {
      Audio.playNote(msg.note);
      Player.setNote(msg.note);
      Player.setPlaying(true);
      FloatingNotes.spawn(msg.note);
    });

    // Volume data
    WS.on('volume', (msg) => {
      Audio.setVolume(msg.volume);
      Player.setVolume(msg.volume);
    });

    // Instrument switch
    WS.on('instrument', (msg) => {
      Instrument.select(msg.instrument, { silent: true });
      updateMappingPanel({ instrument: msg.instrument });
    });

    // ESP32 status
    WS.on('esp32_status', (msg) => {
      Status.setESP32(msg.connected);
    });

    // Camera FPS
    Camera.on('fps', (fps) => {
      Status.setFps(fps);
    });

    // Camera error
    Camera.on('error', (err) => {
      console.warn('摄像头错误:', err.message);
    });

    // Instrument change event - sync audio instrument
    Instrument.on('change', (data) => {
      Audio.setInstrument(data.instrument);
    });
  }

  function updateMappingPanel(msg = {}) {
    const instrumentNames = {
      piano: '钢琴',
      guitar: '吉他',
      drums: '鼓',
      musicbox: '音乐盒'
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

    const qualityName = msg.quality?.candidate || msg.quality?.name || msg.quality;
    if (mapQuality && qualityName) mapQuality.textContent = qualityLabels[qualityName] || qualityName;
    setQualityChips(qualityName);
  }

  function setQualityChips(activeQuality) {
    const chips = document.querySelectorAll('#qualityChips [data-quality]');
    chips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.quality === activeQuality);
    });
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
      Status.setESP32(true);
    }, 600);

    let gestureIndex = 0;
    const gestures = ['C major', 'D minor', 'F 7', 'A maj7', 'Muted'];
    const mockChords = [
      { type: 'chord', rootIndex: 0, root: 'C', quality: 'major', qualityLabel: 'major', chord: 'C major', frequencies: [261.63, 329.63, 392.0], midiNotes: [60, 64, 67], muted: false },
      { type: 'chord', rootIndex: 2, root: 'D', quality: 'minor', qualityLabel: 'minor', chord: 'D minor', frequencies: [293.66, 349.23, 440.0], midiNotes: [62, 65, 69], muted: false },
      { type: 'chord', rootIndex: 5, root: 'F', quality: 'dominant seventh', qualityLabel: '7', chord: 'F 7', frequencies: [349.23, 440.0, 523.25, 622.25], midiNotes: [65, 69, 72, 75], muted: false },
      { type: 'chord', rootIndex: null, root: '-', quality: 'mute', qualityLabel: 'mute', chord: 'Muted', frequencies: [], midiNotes: [], muted: true }
    ];

    mockInterval = setInterval(() => {
      const chord = mockChords[gestureIndex % mockChords.length];
      const mockGesture = {
        type: 'gesture',
        hands: [
          { handedness: 'Right', score: 0.94, landmarks: generateMockLandmarks(0.62, 0.78) },
          { handedness: 'Left', score: 0.91, landmarks: generateMockLandmarks(0.18, 0.45) }
        ],
        root: { index: chord.rootIndex, name: chord.root, candidateIndex: chord.rootIndex, candidateName: chord.root },
        quality: { name: chord.quality, label: chord.qualityLabel, candidate: chord.quality },
        instrument: Instrument.getCurrent(),
        instrumentZone: null,
        muted: chord.muted
      };
      Gesture.updateGesture(mockGesture);
      Camera.setBridgeActive(true);
      updateMappingPanel(mockGesture);

      const nameEl = document.getElementById('gestureName');
      const confEl = document.getElementById('gestureConfidence');
      if (nameEl) nameEl.textContent = gestures[gestureIndex % gestures.length];
      if (confEl) confEl.textContent = `置信度 ${Math.round(85 + Math.random() * 15)}%`;
      gestureIndex++;

      // Mock chords with audio
      if (!chord.muted) {
        Audio.playChord(chord);
        Player.setChord(chord);
        Player.setPlaying(true);
        FloatingNotes.spawn(chord.chord);
      } else {
        Player.setChord(chord);
        Player.setPlaying(false);
      }

      Status.setFps(Math.round(28 + Math.random() * 4));
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
