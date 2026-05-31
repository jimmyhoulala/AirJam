"""
颜色常量 - 与浏览器前端 Synesthesia 主题统一
"""


class Color:
    # 背景层次
    BG_DEEP = (25, 26, 35)        # 最深背景
    BG_PANEL = (33, 34, 43)       # 面板背景
    BG_CARD = (41, 42, 51)        # 卡片背景
    BG_CARD_HOVER = (51, 52, 61)  # 卡片 hover

    # 强调色
    ACCENT = (140, 100, 255)      # 霓虹紫蓝（主强调）
    ACCENT_DIM = (120, 80, 200)   # 次要强调
    SECONDARY = (100, 180, 255)   # 青蓝

    # 语义状态
    SUCCESS = (100, 220, 140)     # 连接/演奏中
    WARNING = (200, 180, 80)      # 警告
    DANGER = (220, 80, 80)        # 断开/错误

    # 文本层次
    TEXT_1 = (235, 235, 240)      # 主文本
    TEXT_2 = (170, 170, 180)      # 次要文本
    TEXT_3 = (120, 120, 135)      # 弱化文本

    # 边框
    BORDER = (60, 62, 75)
    BORDER_ACCENT = (140, 100, 255)

    # 音符颜色（按音高）
    NOTE_COLORS = {
        'C': (160, 120, 255),     # 紫
        'D': (180, 100, 255),     # 粉紫
        'E': (255, 100, 100),     # 红
        'F': (255, 160, 60),      # 橙
        'G': (100, 220, 140),     # 绿
        'A': (100, 180, 255),     # 蓝
        'B': (200, 100, 255),     # 紫红
    }

    @staticmethod
    def get_note_color(note):
        """根据音符名称获取颜色"""
        if not note:
            return Color.SECONDARY
        letter = note[0].upper()
        return Color.NOTE_COLORS.get(letter, Color.SECONDARY)
