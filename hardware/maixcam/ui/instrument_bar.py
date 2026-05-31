"""
底部乐器栏
4个乐器卡片，选中高亮 + 霓虹光效
"""
import time
from ui.colors import Color
from ui.screen import SCREEN_W, SCREEN_H, INSTRUMENT_BAR_H


# 乐器定义
INSTRUMENTS = [
    {'id': 'piano', 'name': '钢琴', 'icon': '♪', 'desc': 'Piano'},
    {'id': 'guitar', 'name': '吉他', 'icon': '♫', 'desc': 'Guitar'},
    {'id': 'drums', 'name': '鼓', 'icon': '◉', 'desc': 'Drums'},
    {'id': 'musicbox', 'name': '音乐盒', 'icon': '♫', 'desc': 'Music Box'},
]

# 卡片布局参数
CARD_GAP = 40
CARD_MARGIN = 80


class InstrumentBar:
    """底部乐器栏"""

    def __init__(self, screen):
        self.screen = screen
        self.current = 'piano'
        self.cards = self._calc_cards()
        self.switch_time = 0
        self.switch_ripple = 0

    def _calc_cards(self):
        """计算每个卡片的位置"""
        count = len(INSTRUMENTS)
        total_gap = CARD_GAP * (count - 1)
        total_margin = CARD_MARGIN * 2
        card_w = (SCREEN_W - total_gap - total_margin) // count
        card_h = INSTRUMENT_BAR_H - 40

        cards = []
        for i, inst in enumerate(INSTRUMENTS):
            x = CARD_MARGIN + i * (card_w + CARD_GAP)
            y = SCREEN_H - INSTRUMENT_BAR_H + 20
            cards.append({
                **inst,
                'x': x, 'y': y,
                'w': card_w, 'h': card_h,
            })
        return cards

    def select(self, instrument):
        """切换乐器"""
        if instrument != self.current:
            self.current = instrument
            self.switch_time = time.time()
            self.switch_ripple = 1.0

    def draw(self):
        s = self.screen

        # 背景
        y_start = SCREEN_H - INSTRUMENT_BAR_H
        s.draw_rect(0, y_start, SCREEN_W, INSTRUMENT_BAR_H, Color.BG_PANEL)

        # 顶部分割线
        s.draw_rect(0, y_start, SCREEN_W, 2, Color.BORDER)

        # 绘制每个卡片
        now = time.time()
        for card in self.cards:
            is_active = card['id'] == self.current
            self._draw_card(s, card, is_active, now)

    def _draw_card(self, screen, card, is_active, now):
        x, y, w, h = card['x'], card['y'], card['w'], card['h']

        # 卡片背景
        if is_active:
            # 活跃状态：霓虹紫背景
            screen.draw_rect(x, y, w, h, (45, 35, 70))
            # 顶部高光条
            screen.draw_rect(x + w // 4, y, w // 2, 3, Color.ACCENT)
            # 发光效果（用渐变矩形模拟）
            for i in range(4):
                alpha = 0.3 - i * 0.07
                c = tuple(int(v * alpha) for v in Color.ACCENT)
                screen.draw_rect(x - i * 2, y - i * 2, w + i * 4, h + i * 4, c)
        else:
            # 非活跃：微妙的呼吸动画
            breath = 0.5 + 0.1 * math.sin(now * 1.5 + card['x'] * 0.01)
            c = tuple(int(v * breath) for v in Color.BG_CARD)
            screen.draw_rect(x, y, w, h, c)

        # 边框
        border_color = Color.ACCENT if is_active else Color.BORDER
        screen.draw_rect(x, y, w, h, border_color, filled=False)

        # 图标
        icon_color = Color.ACCENT if is_active else Color.TEXT_2
        icon_x = x + w // 2 - 16
        icon_y = y + h // 3 - 16
        # 用矩形近似绘制图标
        screen.draw_rect(icon_x, icon_y, 32, 32, icon_color)

        # 乐器名称
        name_color = Color.TEXT_1 if is_active else Color.TEXT_2
        name_x = x + w // 2 - 30
        name_y = y + h * 2 // 3
        screen.draw_text(name_x, name_y, card['name'], name_color, size="small")

        # 切换扩散动画
        if is_active and self.switch_ripple > 0:
            elapsed = now - self.switch_time
            if elapsed < 0.5:
                ripple_r = int(elapsed * w * 2)
                ripple_alpha = 1.0 - elapsed * 2
                cx = x + w // 2
                cy = y + h // 2
                r = int(ripple_r * 0.3)
                c = tuple(int(v * ripple_alpha * 0.3) for v in Color.ACCENT)
                screen.draw_circle(cx, cy, r, c, filled=False)
            else:
                self.switch_ripple = 0


# 需要导入 math 用于呼吸动画
import math
