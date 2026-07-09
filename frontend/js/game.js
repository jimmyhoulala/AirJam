/**
 * 曲谱模式 - 游戏逻辑模块
 * 管理选曲、演奏、评分、结算的完整流程
 */
const Game = (() => {

  /* ── 常量 ── */
  const FALL_DURATION = 3000;     // 音符下落时间 (ms)，给玩家更多反应时间
  const PERFECT_WINDOW = 100;     // Perfect 判定窗口 (±ms)
  const GOOD_WINDOW = 250;        // Good 判定窗口 (±ms)
  const PERFECT_SCORE = 100;
  const GOOD_SCORE = 60;

  /* ── 状态 ── */
  let state = 'IDLE';             // IDLE | SELECTING | COUNTDOWN | PLAYING | RESULTS
  let currentInstrument = 'piano';
  let gameStartInstrument = null; // 游戏开始时的乐器（用于判断是否真正切换了乐器）
  let currentSong = null;
  let startTime = 0;
  let animFrame = null;

  // 评分
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let perfectCount = 0;
  let goodCount = 0;
  let missCount = 0;
  let totalNotes = 0;

  // 音符池: { id, beat, track, timeMs, hit, missed, el }
  let activeNotes = [];
  let nextNoteIndex = 0;

  // 最高分 (localStorage)
  let bestScores = {};

  /* ── DOM 引用 ── */
  let overlayEl, selectOverlayEl, resultsOverlayEl, countdownEl;
  let gameAreaEl, hudScoreEl, hudComboEl, hudAccuracyEl, hudSongEl;
  let judgeLineEl;
  let resultsRatingEl, resultsScoreEl, resultsStatsEl;

  /* ── 轨道映射 ── */
  const TRACK_LABELS = {
    piano: ['C4', 'D4', 'E4', 'F4'],
    electric_guitar: ['C5', 'D5', 'E5', 'F5'],
    acoustic_guitar: ['C', 'G', 'Am', 'F'],
    drums: ['Ghost', 'Normal', 'Accent']
  };

  const GESTURE_MAP = {
    piano: { 'C4': 1, 'D4': 2, 'E4': 3, 'F4': 4 },
    electric_guitar: { 'C5': 1, 'D5': 2, 'E5': 3, 'F5': 4 },
    acoustic_guitar: { 'C': 1, 'G': 2, 'Am': 3, 'F': 4 },
    drums: { 'ghost': 1, 'normal': 2, 'accent': 3 }
  };

  // 反向映射: gesture name → track number
  function gestureToTrack(instrument, gestureName) {
    const map = GESTURE_MAP[instrument];
    if (!map) return -1;
    return map[gestureName] || -1;
  }

  /* ── 初始化 ── */
  let instrumentGridEl = null;

  function init() {
    loadBestScores();
    bindUI();
    instrumentGridEl = document.getElementById('instrumentGrid');
  }

  /** 控制乐器选择网格的显示/隐藏 */
  function updateInstrumentGridVisibility() {
    if (!instrumentGridEl) return;
    // 只在 IDLE 或 SELECTING（未选乐器）时显示乐器网格
    const showGrid = state === 'IDLE' || (state === 'SELECTING' && !selectedInstrument);
    instrumentGridEl.style.display = showGrid ? '' : 'none';
  }

  function bindUI() {
    overlayEl = document.getElementById('gameOverlay');
    selectOverlayEl = document.getElementById('songSelectOverlay');
    resultsOverlayEl = document.getElementById('gameResultsOverlay');
    countdownEl = document.getElementById('gameCountdown');
    gameAreaEl = document.getElementById('gameArea');
    hudScoreEl = document.getElementById('gameHudScore');
    hudComboEl = document.getElementById('gameHudCombo');
    hudAccuracyEl = document.getElementById('gameHudAccuracy');
    hudSongEl = document.getElementById('gameHudSong');
    judgeLineEl = document.getElementById('gameJudgeLine');
    resultsRatingEl = document.getElementById('gameResultsRating');
    resultsScoreEl = document.getElementById('gameResultsScore');
    resultsStatsEl = document.getElementById('gameResultsStats');

    // 选曲返回按钮
    const backBtn = document.getElementById('songSelectBack');
    if (backBtn) backBtn.addEventListener('click', hideSelect);

    // 结算按钮
    const retryBtn = document.getElementById('gameResultsRetry');
    const backToSelectBtn = document.getElementById('gameResultsBack');
    if (retryBtn) retryBtn.addEventListener('click', retrySong);
    if (backToSelectBtn) backToSelectBtn.addEventListener('click', backToSelect);

    // 退出按钮
    const quitBtn = document.getElementById('gameHudQuit');
    if (quitBtn) quitBtn.addEventListener('click', quitGame);
  }

  /* ── 最高分管理 ── */
  function loadBestScores() {
    try {
      const saved = localStorage.getItem('airjam_best_scores');
      bestScores = saved ? JSON.parse(saved) : {};
    } catch (e) {
      bestScores = {};
    }
  }

  function saveBestScore(songId, newScore) {
    const old = bestScores[songId] || 0;
    if (newScore > old) {
      bestScores[songId] = newScore;
      try {
        localStorage.setItem('airjam_best_scores', JSON.stringify(bestScores));
      } catch (e) { /* ignore */ }
    }
  }

  function getBestScore(songId) {
    return bestScores[songId] || 0;
  }

  /* ── 选曲界面 ── */
  function showSelect(instrument) {
    if (instrument) {
      // 选了乐器，显示曲目列表
      currentInstrument = instrument;
      state = 'SELECTING';
      renderSongList();
      selectOverlayEl.classList.add('visible');
      overlayEl.classList.add('active');
      overlayEl.dataset.instrument = currentInstrument;
    } else {
      // 没传乐器，检查当前是否已有乐器选中
      const current = Instrument.getCurrent?.();
      if (current) {
        // 已有乐器，直接显示曲目列表
        showSelect(current);
        return; // showSelect(current) 会调用 updateInstrumentGridVisibility
      } else {
        // 没有乐器，只进入选曲状态，等用户选乐器
        state = 'SELECTING';
      }
    }
    updateInstrumentGridVisibility();
  }

  function hideSelect() {
    selectOverlayEl.classList.remove('visible');
    resultsOverlayEl.classList.remove('visible');
    overlayEl.classList.remove('active');
    state = 'IDLE';
    updateInstrumentGridVisibility();
  }

  function renderSongList() {
    const songs = Songbook.getSongs(currentInstrument);
    const listEl = document.getElementById('songList');
    if (!listEl) return;

    const instrumentNames = {
      piano: '钢琴',
      electric_guitar: '电吉他',
      acoustic_guitar: '木吉他',
      drums: '鼓'
    };

    document.getElementById('songSelectTitle').textContent =
      `${instrumentNames[currentInstrument] || currentInstrument} · 曲谱模式`;

    listEl.innerHTML = songs.map(song => {
      const stars = '★'.repeat(song.difficulty) + '☆'.repeat(3 - song.difficulty);
      const best = getBestScore(song.id);
      return `
        <div class="song-card" data-song-id="${song.id}">
          <div class="song-card-info">
            <div class="song-card-name">${song.name}</div>
            <div class="song-card-meta">
              <span class="song-card-stars">${stars}</span>
              <span>${song.bpm} BPM</span>
              <span>${song.notes.length} 音符</span>
              ${best > 0 ? `<span class="song-card-best">最高 ${best}</span>` : ''}
            </div>
          </div>
          <div class="song-card-play">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      `;
    }).join('');

    // 绑定点击事件
    listEl.querySelectorAll('.song-card').forEach(card => {
      card.addEventListener('click', () => {
        const songId = card.dataset.songId;
        const song = Songbook.getSongById(songId);
        if (song) startGame(song);
      });
    });
  }

  /* ── 游戏流程 ── */
  function startGame(song) {
    currentSong = song;
    state = 'COUNTDOWN';
    gameStartInstrument = currentInstrument; // 记录游戏开始时的乐器

    // 重置评分
    score = 0;
    combo = 0;
    maxCombo = 0;
    perfectCount = 0;
    goodCount = 0;
    missCount = 0;
    totalNotes = song.notes.length;

    // 预处理音符时间（加 FALL_DURATION 偏移，让音符从顶部开始下落）
    const beatMs = 60000 / song.bpm;
    activeNotes = song.notes.map((n, i) => ({
      id: i,
      beat: n.beat,
      track: n.track,
      timeMs: n.beat * beatMs + FALL_DURATION,
      hit: false,
      missed: false,
      el: null
    }));
    nextNoteIndex = 0;

    // 更新 UI
    hudScoreEl.textContent = '0';
    hudComboEl.textContent = '0';
    hudAccuracyEl.textContent = '100%';
    hudSongEl.textContent = song.name;

    // 隐藏选曲，显示游戏
    selectOverlayEl.classList.remove('visible');
    resultsOverlayEl.classList.remove('visible');
    overlayEl.classList.add('active');
    overlayEl.dataset.instrument = currentInstrument;
    updateInstrumentGridVisibility();

    // 鼓模式隐藏第 4 轨道
    const trackEls = gameAreaEl.querySelectorAll('.game-track');
    const trackLabels = gameAreaEl.querySelectorAll('.game-track-label');
    const isDrums = currentInstrument === 'drums';
    if (trackEls[3]) trackEls[3].style.display = isDrums ? 'none' : '';
    if (trackLabels[3]) trackLabels[3].style.display = isDrums ? 'none' : '';

    // 更新轨道标签
    const labels = TRACK_LABELS[currentInstrument];
    if (labels) {
      trackLabels.forEach((el, i) => {
        if (labels[i]) el.textContent = labels[i];
      });
    }

    // 清空游戏区域
    clearGameArea();

    // 显示倒计时
    showCountdown(() => {
      state = 'PLAYING';
      startTime = performance.now();
      gameLoop();
    });
  }

  function clearGameArea() {
    if (!gameAreaEl) return;
    gameAreaEl.querySelectorAll('.game-note, .game-judge-fx').forEach(el => el.remove());
    activeNotes.forEach(n => n.el = null);
  }

  function showCountdown(onFinish) {
    countdownEl.classList.add('visible');
    let count = 3;
    countdownEl.querySelector('.game-countdown-number').textContent = count;

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownEl.querySelector('.game-countdown-number').textContent = count;
      } else {
        clearInterval(interval);
        countdownEl.classList.remove('visible');
        onFinish();
      }
    }, 800);
  }

  /* ── 游戏主循环 ── */
  function gameLoop() {
    if (state !== 'PLAYING') return;

    const now = performance.now();
    const elapsed = now - startTime;

    // 生成新音符 (提前 FALL_DURATION 出现)
    while (nextNoteIndex < activeNotes.length) {
      const note = activeNotes[nextNoteIndex];
      if (note.timeMs - FALL_DURATION <= elapsed) {
        spawnNoteElement(note);
        nextNoteIndex++;
      } else {
        break;
      }
    }

    // 更新音符位置
    updateNotePositions(elapsed);

    // 检测 Miss (音符过线未击中)
    checkMisses(elapsed);

    // 检查歌曲是否结束
    if (elapsed > getLastNoteTime() + 1000) {
      endGame();
      return;
    }

    animFrame = requestAnimationFrame(gameLoop);
  }

  function getLastNoteTime() {
    if (activeNotes.length === 0) return 0;
    return activeNotes[activeNotes.length - 1].timeMs;
  }

  /* ── 音符渲染 ── */
  function spawnNoteElement(note) {
    const trackEls = gameAreaEl.querySelectorAll('.game-track');
    const trackEl = trackEls[note.track - 1];
    if (!trackEl) return;

    const el = document.createElement('div');
    el.className = 'game-note';
    el.dataset.track = note.track;
    el.dataset.id = note.id;

    // 显示手势编号
    const labels = TRACK_LABELS[currentInstrument];
    el.textContent = labels ? labels[note.track - 1] : note.track;

    // 设置初始位置在顶部
    el.style.top = '0px';

    trackEl.appendChild(el);
    note.el = el;
  }

  function updateNotePositions(elapsed) {
    const judgeBottom = 80; // 判定线距底部 px
    const areaHeight = gameAreaEl.clientHeight;
    const fallDistance = areaHeight - judgeBottom;

    for (const note of activeNotes) {
      if (!note.el || note.hit || note.missed) continue;

      // 进度: 0 = 刚出现, 1 = 到达判定线
      const progress = (elapsed - (note.timeMs - FALL_DURATION)) / FALL_DURATION;

      if (progress < 0 || progress > 1.2) {
        if (note.el) note.el.style.display = 'none';
        continue;
      }

      const topPx = progress * fallDistance;
      note.el.style.top = topPx + 'px';
      note.el.style.display = '';
    }
  }

  /* ── 判定逻辑 ── */
  function checkMisses(elapsed) {
    for (const note of activeNotes) {
      if (note.hit || note.missed) continue;
      if (elapsed > note.timeMs + GOOD_WINDOW) {
        note.missed = true;
        onMiss(note);
      }
    }
  }

  function onGestureEvent(track) {
    if (state !== 'PLAYING') return;

    const elapsed = performance.now() - startTime;

    // 找最近的未击中音符
    let bestNote = null;
    let bestDiff = Infinity;

    for (const note of activeNotes) {
      if (note.hit || note.missed) continue;
      if (note.track !== track) continue;

      const diff = Math.abs(elapsed - note.timeMs);
      if (diff < bestDiff && diff <= GOOD_WINDOW) {
        bestNote = note;
        bestDiff = diff;
      }
    }

    if (bestNote) {
      bestNote.hit = true;
      if (bestDiff <= PERFECT_WINDOW) {
        onPerfect(bestNote);
      } else {
        onGood(bestNote);
      }
    }
  }

  function onPerfect(note) {
    perfectCount++;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    score += PERFECT_SCORE + combo * 10;
    showJudgeFx('PERFECT', note.track);
    flashJudgeLine('perfect');
    removeNote(note);
    updateHUD();
  }

  function onGood(note) {
    goodCount++;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    score += GOOD_SCORE + combo * 5;
    showJudgeFx('GOOD', note.track);
    flashJudgeLine('good');
    removeNote(note);
    updateHUD();
  }

  function onMiss(note) {
    missCount++;
    combo = 0;
    showJudgeFx('MISS', note.track);
    flashJudgeLine('miss');
    removeNote(note);
    updateHUD();
  }

  function removeNote(note) {
    if (note.el) {
      note.el.style.opacity = '0';
      setTimeout(() => {
        if (note.el && note.el.parentNode) note.el.parentNode.removeChild(note.el);
        note.el = null;
      }, 150);
    }
  }

  /* ── 视觉反馈 ── */
  function showJudgeFx(type, track) {
    const trackEls = gameAreaEl.querySelectorAll('.game-track');
    const trackEl = trackEls[track - 1];
    if (!trackEl) return;

    const el = document.createElement('div');
    el.className = `game-judge-fx ${type.toLowerCase()}`;
    el.textContent = type;
    trackEl.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 600);
  }

  function flashJudgeLine(type) {
    if (!judgeLineEl) return;
    judgeLineEl.classList.remove('flash-perfect', 'flash-good', 'flash-miss');
    void judgeLineEl.offsetWidth; // force reflow
    judgeLineEl.classList.add(`flash-${type}`);
    setTimeout(() => judgeLineEl.classList.remove(`flash-${type}`), 300);
  }

  /* ── HUD 更新 ── */
  function updateHUD() {
    hudScoreEl.textContent = score;
    hudComboEl.textContent = combo;

    // 连击动画
    hudComboEl.classList.add('bump');
    setTimeout(() => hudComboEl.classList.remove('bump'), 100);

    // 准确率
    const hitCount = perfectCount + goodCount;
    const judged = hitCount + missCount;
    const accuracy = judged > 0 ? Math.round((hitCount / judged) * 100) : 100;
    hudAccuracyEl.textContent = accuracy + '%';
  }

  /* ── 结算 ── */
  function endGame() {
    state = 'RESULTS';
    if (animFrame) cancelAnimationFrame(animFrame);

    // 计算最终成绩
    const hitCount = perfectCount + goodCount;
    const judged = hitCount + missCount;
    const accuracy = judged > 0 ? Math.round((hitCount / judged) * 100) : 0;

    let rating = 'C';
    let ratingClass = 'rating-c';
    if (accuracy >= 95) { rating = 'S'; ratingClass = 'rating-s'; }
    else if (accuracy >= 85) { rating = 'A'; ratingClass = 'rating-a'; }
    else if (accuracy >= 70) { rating = 'B'; ratingClass = 'rating-b'; }

    // 保存最高分
    if (currentSong) saveBestScore(currentSong.id, score);

    // 显示结算界面
    const resultsSongEl = document.getElementById('gameResultsSong');
    if (resultsSongEl && currentSong) resultsSongEl.textContent = currentSong.name;

    resultsRatingEl.textContent = rating;
    resultsRatingEl.className = `game-results-rating ${ratingClass}`;
    resultsScoreEl.innerHTML = `${score} <span>分</span>`;

    resultsStatsEl.innerHTML = `
      <div class="game-results-stat perfect">
        <div class="game-results-stat-value">${perfectCount}</div>
        <div class="game-results-stat-label">Perfect</div>
      </div>
      <div class="game-results-stat good">
        <div class="game-results-stat-value">${goodCount}</div>
        <div class="game-results-stat-label">Good</div>
      </div>
      <div class="game-results-stat miss">
        <div class="game-results-stat-value">${missCount}</div>
        <div class="game-results-stat-label">Miss</div>
      </div>
      <div class="game-results-stat">
        <div class="game-results-stat-value">${maxCombo}</div>
        <div class="game-results-stat-label">最大连击</div>
      </div>
    `;

    resultsOverlayEl.classList.add('visible');
    updateInstrumentGridVisibility();
  }

  function retrySong() {
    if (currentSong) startGame(currentSong);
  }

  function backToSelect() {
    resultsOverlayEl.classList.remove('visible');
    // 回到当前乐器的曲目列表
    showSelect(currentInstrument);
  }

  function quitGame() {
    state = 'IDLE';
    if (animFrame) cancelAnimationFrame(animFrame);
    selectOverlayEl.classList.remove('visible');
    resultsOverlayEl.classList.remove('visible');
    overlayEl.classList.remove('active');
    clearGameArea();
    updateInstrumentGridVisibility();
  }

  /* ── 公开 API ── */
  return {
    init,
    showSelect,
    hideSelect,
    quitGame,
    onGestureEvent,
    getState: () => state,
    getCurrentInstrument: () => currentInstrument,
    getGameStartInstrument: () => gameStartInstrument,
  };
})();
