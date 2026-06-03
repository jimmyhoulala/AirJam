/**
 * 乐器选择模块
 * 管理乐器切换和状态
 */
const Instrument = (() => {
  let currentInstrument = 'piano';
  let gridEl = null;

  const INSTRUMENTS = {
    piano: { name: '钢琴', icon: 'piano' },
    electric_guitar: { name: '电吉他', icon: 'guitar' },
    acoustic_guitar: { name: '木吉他', icon: 'guitar' },
    drums: { name: '鼓', icon: 'drums' },
  };

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
   * 初始化乐器选择
   */
  function init() {
    gridEl = document.getElementById('instrumentGrid');
    const cards = gridEl.querySelectorAll('.instrument-card');

    cards.forEach(card => {
      card.addEventListener('click', () => {
        const instrument = card.dataset.instrument;
        select(instrument);
      });
    });
  }

  /**
   * 选择乐器
   * @param {string} instrument - 乐器 ID
   */
  function select(instrument, options = {}) {
    if (!INSTRUMENTS[instrument]) return;
    if (instrument === currentInstrument && !options.force) return;

    currentInstrument = instrument;

    // 切换主题
    const THEME_MAP = {
      piano: 'theme-piano',
      electric_guitar: 'theme-electric_guitar',
      acoustic_guitar: 'theme-acoustic_guitar',
      drums: 'theme-drums',
    };
    // 移除旧主题
    Object.values(THEME_MAP).forEach(cls => document.body.classList.remove(cls));
    // 添加新主题
    const themeClass = THEME_MAP[instrument];
    if (themeClass) document.body.classList.add(themeClass);

    // 更新 UI
    const cards = gridEl.querySelectorAll('.instrument-card');
    cards.forEach(card => {
      card.classList.toggle('active', card.dataset.instrument === instrument);
    });

    // 更新状态显示
    const nameEl = document.getElementById('currentInstrument');
    if (nameEl) nameEl.textContent = INSTRUMENTS[instrument].name;

    // 通知后端
    if (!options.silent) {
      WS.send({ type: 'switch_instrument', instrument });
    }

    emit('change', { instrument, ...INSTRUMENTS[instrument] });
  }

  /**
   * 获取当前乐器
   */
  function getCurrent() {
    return currentInstrument;
  }

  /**
   * 获取乐器信息
   */
  function getInstrument(id) {
    return INSTRUMENTS[id] || null;
  }

  return { init, select, getCurrent, getInstrument, on };
})();
