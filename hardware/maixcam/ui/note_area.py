"""
中央动画区域
音符粒子飘散 + 音量波形可视化
"""
import time
import math
import random
from ui.colors import Color
from ui.screen import SCREEN_W, SCREEN_H, STATUS_BAR_H, NOTE_AREA_H


# 音符符号
NOTE_SYMBOLS = ['♪', '♫', '♬', '♩']


class Particle:
    """单个音符粒子"""

    def __init__(self, x, y, note, color):
        self.x = x
        self.y = y
        self.note = note
        self.color = color
        self.symbol = random.choice(NOTE_SYMBOLS)
        self.vx = random.uniform(-1.5, 1.5)
        self.vy = random.uniform(-4, -2)
        self.life = 1.0
        self.decay = random.uniform(0.008, 0.015)
        self.rotation = random.uniform(0, 360)
        self.rot_speed = random.uniform(-3, 3)
        self.scale = random.uniform(0.7, 1.3)
        self.born = time.time()

    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.vy += 0.02  # 微弱重力
        self.vx *= 0.99  # 阻尼
        self.rotation += self.rot_speed
        self.life -= self.decay
        return self.life > 0

    def draw(self, screen):
        if self.life <= 0:
            return
        alpha = int(255 * self.life)
        # 简化：用颜色亮度模拟透明度
        r, g, b = self.color
        factor = self.life
        c = (int(r * factor), int(g * factor), int(b * factor))

        x = int(self.x)
        y = int(self.y)
        size = int(24 * self.scale * self.life)

        # 用小矩形近似绘制字符（MaixPy 可能不支持旋转文本）
        screen.draw_rect(x - size // 2, y - size // 2, size, size, c)


class NoteArea:
    """中央音符粒子 + 波形区域"""

    def __init__(self, screen):
        self.screen = screen
        self.particles = []
        self.max_particles = 40
        self.volume = 72
        self.wave_bars = 16
        self.wave_heights = [0.0] * self.wave_bars
        self.target_heights = [0.0] * self.wave_bars
        self.last_wave_update = 0

    def spawn_note(self, note):
        """生成音符粒子"""
        color = Color.get_note_color(note)
        # 在屏幕中央区域随机位置生成
        cx = SCREEN_W * 0.2 + random.random() * SCREEN_W * 0.6
        cy = STATUS_BAR_H + NOTE_AREA_H * 0.6 + random.random() * NOTE_AREA_H * 0.3

        for _ in range(random.randint(2, 4)):
            if len(self.particles) < self.max_particles:
                p = Particle(
                    cx + random.uniform(-100, 100),
                    cy + random.uniform(-50, 50),
                    note, color
                )
                self.particles.append(p)

    def set_volume(self, volume):
        self.volume = max(0, min(100, volume))

    def _update_wave(self):
        """更新波形目标值"""
        now = time.time()
        if now - self.last_wave_update < 0.05:
            return
        self.last_wave_update = now

        # 根据音量生成波形
        base = self.volume / 100
        for i in range(self.wave_bars):
            # 中间的条更高
            center_factor = 1.0 - abs(i - self.wave_bars / 2) / (self.wave_bars / 2)
            target = base * center_factor * (0.5 + random.random() * 0.5)
            self.target_heights[i] = target

        # 平滑过渡
        for i in range(self.wave_bars):
            diff = self.target_heights[i] - self.wave_heights[i]
            self.wave_heights[i] += diff * 0.3

    def draw(self):
        s = self.screen
        y_start = STATUS_BAR_H
        area_h = NOTE_AREA_H

        # 背景（微弱渐变效果）
        for i in range(0, area_h, 4):
            factor = i / area_h
            r = int(25 + factor * 5)
            g = int(26 + factor * 5)
            b = int(35 + factor * 8)
            s.draw_rect(0, y_start + i, SCREEN_W, 4, (r, g, b))

        # 边框
        s.draw_rect(0, y_start, SCREEN_W, 2, Color.BORDER)
        s.draw_rect(0, y_start + area_h - 2, SCREEN_W, 2, Color.BORDER)

        # === 更新和绘制粒子 ===
        self.particles = [p for p in self.particles if p.update()]
        for p in self.particles:
            p.draw(s)

        # === 音量波形 ===
        self._update_wave()
        self._draw_wave(s, y_start, area_h)

    def _draw_wave(self, screen, y_start, area_h):
        """绘制音量波形条"""
        bar_count = self.wave_bars
        total_w = SCREEN_W * 0.6
        bar_w = total_w / bar_count * 0.6
        gap = total_w / bar_count * 0.4
        start_x = int((SCREEN_W - total_w) / 2)
        max_h = int(area_h * 0.3)
        base_y = y_start + area_h - 80

        for i in range(bar_count):
            h = int(max_h * self.wave_heights[i])
            x = int(start_x + i * (bar_w + gap))

            # 颜色根据高度变化
            factor = self.wave_heights[i]
            r = int(100 + 40 * factor)
            g = int(100 + 80 * factor)
            b = int(200 + 55 * factor)
            color = (min(r, 255), min(g, 255), min(b, 255))

            # 从底部向上绘制
            if h > 0:
                screen.draw_rect(x, base_y - h, int(bar_w), h, color)
                # 顶部高光
                screen.draw_rect(x, base_y - h, int(bar_w), 3,
                                 (min(r + 40, 255), min(g + 40, 255), 255))
