/**
 * 曲谱数据模块
 * 预设曲谱，每乐器 2-3 首，难度递增
 *
 * 数据格式:
 *   beat: 节拍位置 (0 = 第一拍, 1 = 第二拍, 0.5 = 半拍)
 *   track: 轨道编号 (1-4 对应手势 1-4, 鼓只有 1-3)
 */
const Songbook = (() => {

  /* ── 钢琴曲谱 (轨道: 1=C4, 2=D4, 3=E4, 4=F4) ── */
  const piano = [
    {
      id: 'piano_easy',
      name: '小星星',
      difficulty: 1,
      bpm: 100,
      notes: [
        // C C G G A A G  (简化为 C C E E F F E)
        { beat: 0, track: 1 }, { beat: 1, track: 1 },
        { beat: 2, track: 3 }, { beat: 3, track: 3 },
        { beat: 4, track: 4 }, { beat: 5, track: 4 },
        { beat: 6, track: 3 }, { beat: 7, track: 2 },
        // F F E E D D C
        { beat: 8, track: 4 }, { beat: 9, track: 4 },
        { beat: 10, track: 3 }, { beat: 11, track: 3 },
        { beat: 12, track: 2 }, { beat: 13, track: 2 },
        { beat: 14, track: 1 },
        // 重复
        { beat: 16, track: 1 }, { beat: 17, track: 1 },
        { beat: 18, track: 3 }, { beat: 19, track: 3 },
        { beat: 20, track: 4 }, { beat: 21, track: 4 },
        { beat: 22, track: 3 }, { beat: 23, track: 2 },
        { beat: 24, track: 4 }, { beat: 25, track: 4 },
        { beat: 26, track: 3 }, { beat: 27, track: 3 },
        { beat: 28, track: 2 }, { beat: 29, track: 2 },
        { beat: 30, track: 1 },
      ]
    },
    {
      id: 'piano_medium',
      name: '欢乐颂',
      difficulty: 2,
      bpm: 120,
      notes: [
        // E E F G G F E D C C D E E D D
        { beat: 0, track: 3 }, { beat: 1, track: 3 },
        { beat: 2, track: 4 }, { beat: 3, track: 1 },  // G→C (简化)
        { beat: 4, track: 1 }, { beat: 5, track: 4 },
        { beat: 6, track: 3 }, { beat: 7, track: 2 },
        { beat: 8, track: 1 }, { beat: 9, track: 1 },
        { beat: 10, track: 2 }, { beat: 11, track: 3 },
        { beat: 12, track: 3 }, { beat: 13, track: 2 },
        { beat: 14, track: 2 },
        // E E F G G F E D C C D E D C C
        { beat: 16, track: 3 }, { beat: 17, track: 3 },
        { beat: 18, track: 4 }, { beat: 19, track: 1 },
        { beat: 20, track: 1 }, { beat: 21, track: 4 },
        { beat: 22, track: 3 }, { beat: 23, track: 2 },
        { beat: 24, track: 1 }, { beat: 25, track: 1 },
        { beat: 26, track: 2 }, { beat: 27, track: 3 },
        { beat: 28, track: 2 }, { beat: 29, track: 1 },
        { beat: 30, track: 1 },
      ]
    },
    {
      id: 'piano_hard',
      name: '快速练习',
      difficulty: 3,
      bpm: 140,
      notes: [
        // 快速音阶上下行
        { beat: 0, track: 1 }, { beat: 0.5, track: 2 },
        { beat: 1, track: 3 }, { beat: 1.5, track: 4 },
        { beat: 2, track: 3 }, { beat: 2.5, track: 2 },
        { beat: 3, track: 1 }, { beat: 3.5, track: 2 },
        { beat: 4, track: 3 }, { beat: 4.5, track: 4 },
        { beat: 5, track: 3 }, { beat: 5.5, track: 2 },
        { beat: 6, track: 1 }, { beat: 6.5, track: 1 },
        { beat: 7, track: 4 }, { beat: 7.5, track: 4 },
        // 交替跳跃
        { beat: 8, track: 1 }, { beat: 8.5, track: 3 },
        { beat: 9, track: 2 }, { beat: 9.5, track: 4 },
        { beat: 10, track: 1 }, { beat: 10.5, track: 3 },
        { beat: 11, track: 2 }, { beat: 11.5, track: 4 },
        { beat: 12, track: 4 }, { beat: 12.5, track: 3 },
        { beat: 13, track: 2 }, { beat: 13.5, track: 1 },
        { beat: 14, track: 1 }, { beat: 14.5, track: 2 },
        { beat: 15, track: 3 }, { beat: 15.5, track: 4 },
        // 第二段更快
        { beat: 16, track: 1 }, { beat: 16.25, track: 2 },
        { beat: 16.5, track: 3 }, { beat: 16.75, track: 4 },
        { beat: 17, track: 4 }, { beat: 17.25, track: 3 },
        { beat: 17.5, track: 2 }, { beat: 17.75, track: 1 },
        { beat: 18, track: 1 }, { beat: 18.5, track: 3 },
        { beat: 19, track: 2 }, { beat: 19.5, track: 4 },
        { beat: 20, track: 1 }, { beat: 20.5, track: 4 },
        { beat: 21, track: 2 }, { beat: 21.5, track: 3 },
        { beat: 22, track: 1 }, { beat: 22.5, track: 2 },
        { beat: 23, track: 3 }, { beat: 23.5, track: 4 },
        // 结尾
        { beat: 24, track: 1 }, { beat: 24, track: 2 },
        { beat: 24, track: 3 }, { beat: 24, track: 4 },
      ]
    }
  ];

  /* ── 电吉他曲谱 (轨道: 1=C5, 2=D5, 3=E5, 4=F5) ── */
  const electric_guitar = [
    {
      id: 'eguitar_easy',
      name: '摇滚入门',
      difficulty: 1,
      bpm: 100,
      notes: [
        // 简单和弦进行: C - E - F - C
        { beat: 0, track: 1 },
        { beat: 2, track: 3 },
        { beat: 4, track: 4 },
        { beat: 6, track: 1 },
        { beat: 8, track: 1 },
        { beat: 10, track: 3 },
        { beat: 12, track: 4 },
        { beat: 14, track: 1 },
        // 变化: C - D - E - F
        { beat: 16, track: 1 },
        { beat: 18, track: 2 },
        { beat: 20, track: 3 },
        { beat: 22, track: 4 },
        { beat: 24, track: 4 },
        { beat: 26, track: 3 },
        { beat: 28, track: 2 },
        { beat: 30, track: 1 },
      ]
    },
    {
      id: 'eguitar_medium',
      name: '朋克节奏',
      difficulty: 2,
      bpm: 140,
      notes: [
        // 快速下扫节奏
        { beat: 0, track: 1 }, { beat: 0.5, track: 1 },
        { beat: 1, track: 1 }, { beat: 1.5, track: 1 },
        { beat: 2, track: 3 }, { beat: 2.5, track: 3 },
        { beat: 3, track: 3 }, { beat: 3.5, track: 3 },
        { beat: 4, track: 4 }, { beat: 4.5, track: 4 },
        { beat: 5, track: 4 }, { beat: 5.5, track: 4 },
        { beat: 6, track: 1 }, { beat: 6.5, track: 1 },
        { beat: 7, track: 1 }, { beat: 7.5, track: 1 },
        // 第二段
        { beat: 8, track: 2 }, { beat: 8.5, track: 2 },
        { beat: 9, track: 2 }, { beat: 9.5, track: 2 },
        { beat: 10, track: 3 }, { beat: 10.5, track: 3 },
        { beat: 11, track: 3 }, { beat: 11.5, track: 3 },
        { beat: 12, track: 1 }, { beat: 12.5, track: 1 },
        { beat: 13, track: 1 }, { beat: 13.5, track: 1 },
        { beat: 14, track: 4 }, { beat: 14.5, track: 4 },
        { beat: 15, track: 4 }, { beat: 15.5, track: 4 },
        // 结尾
        { beat: 16, track: 1 }, { beat: 16, track: 3 },
        { beat: 17, track: 2 }, { beat: 17, track: 4 },
        { beat: 18, track: 1 }, { beat: 18, track: 3 },
        { beat: 19, track: 1 },
      ]
    },
    {
      id: 'eguitar_hard',
      name: '金属连复',
      difficulty: 3,
      bpm: 160,
      notes: [
        // 快速交替
        { beat: 0, track: 1 }, { beat: 0.25, track: 3 },
        { beat: 0.5, track: 2 }, { beat: 0.75, track: 4 },
        { beat: 1, track: 1 }, { beat: 1.25, track: 3 },
        { beat: 1.5, track: 2 }, { beat: 1.75, track: 4 },
        { beat: 2, track: 4 }, { beat: 2.25, track: 2 },
        { beat: 2.5, track: 3 }, { beat: 2.75, track: 1 },
        { beat: 3, track: 4 }, { beat: 3.25, track: 2 },
        { beat: 3.5, track: 3 }, { beat: 3.75, track: 1 },
        // 连复段
        { beat: 4, track: 1 }, { beat: 4.25, track: 1 },
        { beat: 4.5, track: 3 }, { beat: 5, track: 2 },
        { beat: 5.5, track: 4 }, { beat: 5.75, track: 4 },
        { beat: 6, track: 1 }, { beat: 6.5, track: 3 },
        { beat: 7, track: 2 }, { beat: 7.5, track: 4 },
        // 高潮
        { beat: 8, track: 1 }, { beat: 8, track: 2 },
        { beat: 8.5, track: 3 }, { beat: 8.5, track: 4 },
        { beat: 9, track: 1 }, { beat: 9, track: 2 },
        { beat: 9.5, track: 3 }, { beat: 9.5, track: 4 },
        { beat: 10, track: 1 }, { beat: 10.25, track: 2 },
        { beat: 10.5, track: 3 }, { beat: 10.75, track: 4 },
        { beat: 11, track: 4 }, { beat: 11.25, track: 3 },
        { beat: 11.5, track: 2 }, { beat: 11.75, track: 1 },
        // 结尾
        { beat: 12, track: 1 }, { beat: 12, track: 2 },
        { beat: 12, track: 3 }, { beat: 12, track: 4 },
      ]
    }
  ];

  /* ── 木吉他曲谱 (轨道: 1=C, 2=G, 3=Am, 4=F) ── */
  const acoustic_guitar = [
    {
      id: 'aguitar_easy',
      name: '流行进行',
      difficulty: 1,
      bpm: 100,
      notes: [
        // C - G - Am - F 经典进行
        { beat: 0, track: 1 },
        { beat: 4, track: 2 },
        { beat: 8, track: 3 },
        { beat: 12, track: 4 },
        // 重复
        { beat: 16, track: 1 },
        { beat: 20, track: 2 },
        { beat: 24, track: 3 },
        { beat: 28, track: 4 },
      ]
    },
    {
      id: 'aguitar_medium',
      name: '民谣弹唱',
      difficulty: 2,
      bpm: 120,
      notes: [
        // C - Am - F - G (半拍节奏)
        { beat: 0, track: 1 }, { beat: 2, track: 1 },
        { beat: 4, track: 3 }, { beat: 6, track: 3 },
        { beat: 8, track: 4 }, { beat: 10, track: 4 },
        { beat: 12, track: 2 }, { beat: 14, track: 2 },
        // 变化
        { beat: 16, track: 1 }, { beat: 18, track: 3 },
        { beat: 20, track: 4 }, { beat: 22, track: 2 },
        { beat: 24, track: 1 }, { beat: 26, track: 3 },
        { beat: 28, track: 4 }, { beat: 30, track: 2 },
      ]
    },
    {
      id: 'aguitar_hard',
      name: '抒情民谣',
      difficulty: 3,
      bpm: 90,
      notes: [
        // 复杂节奏型
        { beat: 0, track: 1 }, { beat: 0.5, track: 1 },
        { beat: 1.5, track: 3 }, { beat: 2, track: 3 },
        { beat: 3, track: 4 }, { beat: 3.5, track: 4 },
        { beat: 4.5, track: 2 }, { beat: 5, track: 2 },
        { beat: 6, track: 1 }, { beat: 6.5, track: 1 },
        { beat: 7, track: 3 }, { beat: 7.5, track: 3 },
        // 第二段
        { beat: 8, track: 4 }, { beat: 8.5, track: 4 },
        { beat: 9.5, track: 2 }, { beat: 10, track: 2 },
        { beat: 11, track: 1 }, { beat: 11.5, track: 1 },
        { beat: 12.5, track: 3 }, { beat: 13, track: 3 },
        { beat: 14, track: 4 }, { beat: 14.5, track: 4 },
        { beat: 15, track: 2 }, { beat: 15.5, track: 2 },
        // 结尾
        { beat: 16, track: 1 }, { beat: 16, track: 3 },
        { beat: 17, track: 2 }, { beat: 17, track: 4 },
        { beat: 18, track: 1 },
      ]
    }
  ];

  /* ── 鼓曲谱 (轨道: 1=ghost, 2=normal, 3=accent) ── */
  const drums = [
    {
      id: 'drums_easy',
      name: '基础节拍',
      difficulty: 1,
      bpm: 80,
      notes: [
        // 简单的 normal 节拍
        { beat: 0, track: 2 },
        { beat: 2, track: 2 },
        { beat: 4, track: 2 },
        { beat: 6, track: 2 },
        { beat: 8, track: 2 },
        { beat: 10, track: 2 },
        { beat: 12, track: 2 },
        { beat: 14, track: 2 },
        // 加入 ghost
        { beat: 16, track: 2 },
        { beat: 17, track: 1 },
        { beat: 18, track: 2 },
        { beat: 19, track: 1 },
        { beat: 20, track: 2 },
        { beat: 21, track: 1 },
        { beat: 22, track: 2 },
        { beat: 23, track: 1 },
        // 加入 accent
        { beat: 24, track: 3 },
        { beat: 26, track: 2 },
        { beat: 28, track: 3 },
        { beat: 30, track: 2 },
      ]
    },
    {
      id: 'drums_medium',
      name: '摇滚节拍',
      difficulty: 2,
      bpm: 120,
      notes: [
        // 摇滚基本节奏
        { beat: 0, track: 3 },   // accent
        { beat: 1, track: 1 },   // ghost
        { beat: 2, track: 2 },   // normal
        { beat: 3, track: 1 },   // ghost
        { beat: 4, track: 3 },   // accent
        { beat: 5, track: 1 },   // ghost
        { beat: 6, track: 2 },   // normal
        { beat: 7, track: 1 },   // ghost
        // 变化
        { beat: 8, track: 3 },
        { beat: 9, track: 2 },
        { beat: 10, track: 2 },
        { beat: 11, track: 1 },
        { beat: 12, track: 3 },
        { beat: 13, track: 1 },
        { beat: 14, track: 2 },
        { beat: 15, track: 1 },
        // 更密
        { beat: 16, track: 3 }, { beat: 16.5, track: 1 },
        { beat: 17, track: 2 }, { beat: 17.5, track: 1 },
        { beat: 18, track: 3 }, { beat: 18.5, track: 1 },
        { beat: 19, track: 2 }, { beat: 19.5, track: 1 },
        { beat: 20, track: 3 }, { beat: 20.5, track: 1 },
        { beat: 21, track: 2 }, { beat: 21.5, track: 1 },
        { beat: 22, track: 2 }, { beat: 22.5, track: 2 },
        { beat: 23, track: 3 },
        // 结尾
        { beat: 24, track: 3 },
      ]
    },
    {
      id: 'drums_hard',
      name: '放克节拍',
      difficulty: 3,
      bpm: 110,
      notes: [
        // 复杂切分
        { beat: 0, track: 3 },
        { beat: 0.75, track: 1 },
        { beat: 1.5, track: 2 },
        { beat: 2, track: 3 },
        { beat: 2.5, track: 1 },
        { beat: 3, track: 2 },
        { beat: 3.5, track: 1 },
        { beat: 4, track: 3 },
        { beat: 4.75, track: 1 },
        { beat: 5.5, track: 2 },
        { beat: 6, track: 3 },
        { beat: 6.5, track: 1 },
        { beat: 7, track: 2 },
        { beat: 7.5, track: 1 },
        // 变化
        { beat: 8, track: 3 }, { beat: 8.5, track: 2 },
        { beat: 9, track: 1 }, { beat: 9.5, track: 2 },
        { beat: 10, track: 3 }, { beat: 10.5, track: 1 },
        { beat: 11, track: 2 }, { beat: 11.5, track: 1 },
        { beat: 12, track: 3 }, { beat: 12.25, track: 1 },
        { beat: 12.5, track: 2 }, { beat: 12.75, track: 1 },
        { beat: 13, track: 3 }, { beat: 13.5, track: 2 },
        { beat: 14, track: 1 }, { beat: 14.5, track: 2 },
        { beat: 15, track: 3 }, { beat: 15.5, track: 1 },
        // 高潮
        { beat: 16, track: 3 }, { beat: 16.25, track: 1 },
        { beat: 16.5, track: 2 }, { beat: 16.75, track: 1 },
        { beat: 17, track: 3 }, { beat: 17.25, track: 1 },
        { beat: 17.5, track: 2 }, { beat: 17.75, track: 1 },
        { beat: 18, track: 3 },
      ]
    }
  ];

  /* ── 公开 API ── */
  const allSongs = { piano, electric_guitar, acoustic_guitar, drums };

  /** 获取指定乐器的曲谱列表 */
  function getSongs(instrument) {
    return allSongs[instrument] || [];
  }

  /** 根据 ID 获取曲谱 */
  function getSongById(id) {
    for (const instrument of Object.values(allSongs)) {
      const found = instrument.find(s => s.id === id);
      if (found) return found;
    }
    return null;
  }

  /** 获取所有乐器列表 */
  function getInstruments() {
    return Object.keys(allSongs);
  }

  return { getSongs, getSongById, getInstruments };
})();
