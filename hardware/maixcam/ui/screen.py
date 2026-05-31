"""
屏幕管理模块
初始化 LCD，管理分层渲染
"""
import time

try:
    from maix import display, image, font
    MAIXPY = True
except ImportError:
    MAIXPY = False

from ui.colors import Color


# MaixCAM2 2K 屏幕尺寸
SCREEN_W = 2560
SCREEN_H = 1440

# 区域划分
STATUS_BAR_H = 120       # 顶部状态栏
INSTRUMENT_BAR_H = 200   # 底部乐器栏
NOTE_AREA_Y = STATUS_BAR_H
NOTE_AREA_H = SCREEN_H - STATUS_BAR_H - INSTRUMENT_BAR_H


class Screen:
    """屏幕管理器"""

    def __init__(self):
        self.img = None
        self.font_small = None
        self.font_large = None
        self.font_title = None
        self._init_display()

    def _init_display(self):
        """初始化 LCD 显示"""
        if not MAIXPY:
            print("[Screen] 非 MaixPy 环境，跳过 LCD 初始化")
            return

        try:
            # MaixPy 3.x LCD 初始化
            self.img = image.Image(SCREEN_W, SCREEN_H)
            self.img.clear(Color.BG_DEEP)

            # 加载字体
            try:
                self.font_small = font.Font(
                    "/maixapp/share/font/unifont.ttf", 28)
                self.font_large = font.Font(
                    "/maixapp/share/font/unifont.ttf", 48)
                self.font_title = font.Font(
                    "/maixapp/share/font/unifont.ttf", 64)
            except Exception:
                # 如果找不到字体文件，使用默认字体
                self.font_small = font.Font_HERSHEY_SIMPLEX
                self.font_large = font.Font_HERSHEY_SIMPLEX
                self.font_title = font.Font_HERSHEY_SIMPLEX

            print("[Screen] LCD 初始化完成")
        except Exception as e:
            print(f"[Screen] LCD 初始化失败: {e}")

    def clear(self):
        """清屏"""
        if self.img:
            self.img.clear(Color.BG_DEEP)

    def draw_rect(self, x, y, w, h, color, filled=True):
        """绘制矩形"""
        if not self.img:
            return
        if filled:
            self.img.draw_rect(x, y, w, h, color=color, thickness=-1)
        else:
            self.img.draw_rect(x, y, w, h, color=color, thickness=2)

    def draw_rounded_rect(self, x, y, w, h, r, color, filled=True):
        """绘制圆角矩形"""
        if not self.img:
            return
        # MaixPy 可能不直接支持圆角矩形，用矩形+圆角近似
        if filled:
            self.img.draw_rect(x, y, w, h, color=color, thickness=-1)
            # 四个角的圆
            self.img.draw_circle(x + r, y + r, r, color=color, thickness=-1)
            self.img.draw_circle(x + w - r, y + r, r, color=color, thickness=-1)
            self.img.draw_circle(x + r, y + h - r, r, color=color, thickness=-1)
            self.img.draw_circle(x + w - r, y + h - r, r, color=color, thickness=-1)
        else:
            self.img.draw_rect(x, y, w, h, color=color, thickness=2)

    def draw_text(self, x, y, text, color, size="small", anchor="left"):
        """绘制文本"""
        if not self.img:
            return
        font_obj = {
            "small": self.font_small,
            "large": self.font_large,
            "title": self.font_title,
        }.get(size, self.font_small)
        self.img.draw_string(x, y, text, font=font_obj, color=color)

    def draw_circle(self, x, y, r, color, filled=True):
        """绘制圆形"""
        if not self.img:
            return
        thickness = -1 if filled else 2
        self.img.draw_circle(x, y, r, color=color, thickness=thickness)

    def draw_line(self, x1, y1, x2, y2, color, thickness=2):
        """绘制线段"""
        if not self.img:
            return
        self.img.draw_line(x1, y1, x2, y2, color=color, thickness=thickness)

    def update(self):
        """刷新屏幕显示"""
        if self.img and MAIXPY:
            try:
                display.show(self.img)
            except Exception:
                pass

    def get_img(self):
        """获取 Image 对象供高级绘制使用"""
        return self.img
