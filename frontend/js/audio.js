/**
 * 音频合成模块
 * 用 Web Audio API 为不同乐器生成不同音色
 */
const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let currentInstrument = 'piano';
  let volume = 0.72;

  // 音符频率映射（C4 = 261.63 Hz）
  const NOTE_FREQ = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61,
    'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23,
    'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46,
    'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    'C6': 1046.50
  };

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);
  }

  function ensureContext() {
    if (!ctx) init();
    if (ctx.state === 'suspended') ctx.resume();
  }

  /**
   * 播放音符
   */
  function playNote(note) {
    ensureContext();
    const freq = NOTE_FREQ[note];
    if (!freq) return;

    playFrequency(freq, 1);
  }

  /**
   * 播放和弦
   */
  function playChord(chord) {
    ensureContext();
    if (!chord || chord.muted) return;

    const freqs = Array.isArray(chord.frequencies) ? chord.frequencies : [];
    if (freqs.length === 0) return;

    const gainScale = Math.min(0.9, 1 / Math.sqrt(freqs.length));
    freqs.slice(0, 5).forEach(freq => {
      if (typeof freq === 'number' && freq > 0) {
        playFrequency(freq, gainScale);
      }
    });
  }

  function playFrequency(freq, gainScale = 1) {
    switch (currentInstrument) {
      case 'piano': playPiano(freq, gainScale); break;
      case 'guitar':
      case 'electric_guitar':
        playGuitar(freq, gainScale);
        break;
      case 'acoustic_guitar':
        playAcousticGuitar(freq, gainScale);
        break;
      case 'drums': playDrums(freq, gainScale); break;
      default: playPiano(freq, gainScale);
    }
  }

  /**
   * 钢琴：正弦波叠加泛音，柔和的起音和衰减
   */
  function playPiano(freq, gainScale = 1) {
    const now = ctx.currentTime;
    const duration = 1.2;

    // 基频
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;

    // 二次泛音
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;

    // 三次泛音（弱）
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = freq * 3;

    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const gain3 = ctx.createGain();

    // 钢琴包络：快速起音，中等衰减
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.5 * gainScale, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.2 * gainScale, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.7);

    gain3.gain.setValueAtTime(0, now);
    gain3.gain.linearRampToValueAtTime(0.08 * gainScale, now + 0.01);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.4);

    osc1.connect(gain1).connect(masterGain);
    osc2.connect(gain2).connect(masterGain);
    osc3.connect(gain3).connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);
  }

  /**
   * 吉他：锯齿波 + 低通滤波，拨弦感
   */
  function playGuitar(freq, gainScale = 1) {
    const now = ctx.currentTime;
    const duration = 0.8;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    // 低通滤波器模拟琴弦共鸣
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq * 4;
    filter.Q.value = 2;

    const gain = ctx.createGain();
    // 吉他包络：锐利起音，快速衰减
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4 * gainScale, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.15 * gainScale, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // 滤波器也随时间衰减
    filter.frequency.setValueAtTime(freq * 6, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, now + duration);

    osc.connect(filter).connect(gain).connect(masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playAcousticGuitar(freq, gainScale = 1) {
    const now = ctx.currentTime;
    const duration = 1.0;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    const body = ctx.createBiquadFilter();
    body.type = 'bandpass';
    body.frequency.value = Math.max(180, freq * 1.8);
    body.Q.value = 0.9;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.34 * gainScale, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.12 * gainScale, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(body).connect(gain).connect(masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * 鼓：低频正弦 + 噪声冲击
   */
  function playDrums(freq, gainScale = 1) {
    const now = ctx.currentTime;

    // 低频冲击（模拟鼓皮振动）
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.1);

    const gainOsc = ctx.createGain();
    gainOsc.gain.setValueAtTime(0.6 * gainScale, now);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gainOsc).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.3);

    // 噪声冲击（模拟鼓槌击打）
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;

    const gainNoise = ctx.createGain();
    gainNoise.gain.setValueAtTime(0.3 * gainScale, now);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(noiseFilter).connect(gainNoise).connect(masterGain);
    noise.start(now);
  }

  /**
   * 设置当前乐器
   */
  function setInstrument(instrument) {
    currentInstrument = instrument;
  }

  /**
   * 设置音量
   */
  function setVolume(vol) {
    volume = vol / 100;
    if (masterGain) masterGain.gain.value = volume;
  }

  /**
   * 获取当前乐器
   */
  function getInstrument() {
    return currentInstrument;
  }

  return { init, playNote, playChord, setInstrument, setVolume, getInstrument };
})();
