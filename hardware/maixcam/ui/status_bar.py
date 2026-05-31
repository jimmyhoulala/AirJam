"""
顶部状态栏
显示：乐器名 | 音符+状态 | 连接状态+音量
"""
import time
from ui.colors import Color
from ui.screen import SCREEN_W, STATUS_BAR_H


# 乐器图标（简单的 Unicode 符号，MaixPy 可能用文本替代）
INSTRUMENT_ICONS = {
    'piano': '♪',
    'guitar': '♫',
    'drums': '◉',
    'musicbox': '♫',
}


class StatusBar:
    """顶部状态栏"""

    def __init__(self, screen):
        self.screen = screen
        self.current_instrument = 'piano'
        self.current_note = '--'
        self.is_playing = False
        self.connected = False
        self.volume = 72
        self.note_scale = 1.0
        self.note_bounce_time = 0

    def set_instrument(self, instrument):
        self.current_instrument = instrument

    def set_note(self, note):
        if note and note != self.current_note:
            self.current_note = note
            self.note_bounce_time = time.time()
            self.note_scale = 1.3
        elif not note:
            self.current_note = '--'

    def set_playing(self, playing):
        self.is_playing = playing

    def set_connected(self, connected):
        self.connected = connected

    def set_volume(self, volume):
        self.volume = max(0, min(100, volume))

    def draw(self):
        s = self.screen
        w = SCREEN_W
        h = STATUS_BAR_H

        # 背景
        s.draw_rect(0, 0, w, h, Color.BG_PANEL)

        # 底部分割线
        s.draw_rect(0, h - 2, w, 2, Color.BORDER)

        # === 左侧：乐器名 ===
        icon = INSTRUMENT_ICONS.get(self.current_instrument, '♪')
        inst_names = {
            'piano': '钢琴', 'guitar': '吉他',
            'drums': '鼓', 'musicbox': '音乐盒'
        }
        inst_name = inst_names.get(self.current_instrument, '钢琴')
        text = f"{icon} {inst_name}"
        s.draw_text(60, 30, text, Color.TEXT_1, size="large")

        # === 中间：音符 + 状态 ===
        # 音符弹跳效果
        now = time.time()
        if now - self.note_bounce_time < 0.3:
            self.note_scale = 1.3 - 0.3 * (now - self.note_bounce_time) / 0.3
        else:
            self.note_scale = 1.0

        note_color = Color.get_note_color(self.current_note)
        s.draw_text(w // 2 - 100, 25, self.current_note, note_color, size="title")

        # 演奏状态
        state_text = "演奏中" if self.is_playing else "静默"
        state_color = Color.SUCCESS if self.is_playing else Color.TEXT_3
        s.draw_text(w // 2 - 100, 85, state_text, state_color, size="small")

        # 状态指示圆点
        dot_color = state_color
        s.draw_circle(w // 2 - 130, 95, 6, dot_color, filled=True)

        # === 右侧：连接状态 + 音量 ===
        # 连接指示
        conn_color = Color.SUCCESS if self.connected else Color.DANGER
        # 脉冲闪烁
        pulse = int(time.time() * 3) % 2
        if self.connected and pulse:
            conn_color = Color.SUCCESS
        elif not self.connected:
            conn_color = Color.DANGER

        s.draw_circle(w - 80, 40, 8, conn_color, filled=True)
        conn_text = "已连接" if self.connected else "未连接"
        s.draw_text(w - 250, 28, conn_text, Color.TEXT_2, size="small")

        # 音量条
        vol_text = f"音量 {self.volume}%"
        s.draw_text(w - 350, 70, vol_text, Color.TEXT_3, size="small")

        # 音量进度条
        bar_x = w - 280
        bar_y = 75
        bar_w = 180
        bar_h = 16
        # 背景
        s.draw_rect(bar_x, bar_y, bar_w, bar_h, Color.BG_CARD)
        # 填充
        fill_w = int(bar_w * self.volume / 100)
        if fill_w > 0:
            s.draw_rect(bar_x, bar_y, fill_w, bar_h, Color.ACCENT)
