/**
 * 演奏状态模块
 * 显示当前和弦、音量、演奏状态
 */
const Player = (() => {
  let chordEl = null;
  let volumeBarEl = null;
  let volumeValueEl = null;
  let playStateEl = null;
  let chordHistory = [];
  const MAX_HISTORY = 8;

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
    chordEl = document.getElementById('currentChord') || document.getElementById('currentNote');
    volumeBarEl = document.getElementById('volumeBar');
    volumeValueEl = document.getElementById('volumeValue');
    playStateEl = document.getElementById('playState');
  }

  /**
   * Update current chord with pulse animation
   */
  function setChord(chord) {
    if (!chordEl) return;

    const label = !chord || chord.muted ? '--' : (chord.chord || '--');
    chordEl.textContent = label;

    chordEl.classList.add('pulse');
    setTimeout(() => chordEl.classList.remove('pulse'), 180);

    if (label && label !== '--') {
      chordHistory.unshift(label);
      if (chordHistory.length > MAX_HISTORY) chordHistory.pop();
    }

    emit('chord', chord);
  }

  function setNote(note) {
    if (!chordEl) return;

    chordEl.textContent = note || '--';

    // Pulse animation
    chordEl.classList.add('pulse');
    setTimeout(() => chordEl.classList.remove('pulse'), 180);

    if (note) {
      chordHistory.unshift(note);
      if (chordHistory.length > MAX_HISTORY) chordHistory.pop();
    }

    emit('note', note);
  }

  /**
   * Update volume
   */
  function setVolume(volume) {
    volume = Math.max(0, Math.min(100, volume));

    if (volumeBarEl) volumeBarEl.style.width = volume + '%';
    if (volumeValueEl) volumeValueEl.textContent = volume + '%';

    emit('volume', volume);
  }

  /**
   * Update play state
   */
  function setPlaying(playing) {
    if (!playStateEl) return;

    if (playing) {
      playStateEl.innerHTML = '<span class="state-indicator playing"></span> 演奏中';
    } else {
      playStateEl.innerHTML = '<span class="state-indicator"></span> 静默';
    }

    emit('playing', playing);
  }

  function getHistory() {
    return [...chordHistory];
  }

  return { init, setChord, setNote, setVolume, setPlaying, getHistory, on };
})();
