"""
番茄钟 (Pomodoro Timer) — 桌面番茄工作法计时器
基于 tkinter，无需额外依赖，Windows 双击即可运行。
"""

import tkinter as tk
from tkinter import ttk, messagebox
import json
import os
import sys
import threading
import time

try:
    import winsound
    _HAS_WINSOUND = True
except ImportError:
    _HAS_WINSOUND = False

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

DEFAULT_SETTINGS = {
    "focus": 25,
    "short_break": 5,
    "long_break": 15,
    "cycles": 4,
    "always_on_top": False,
}

SESSION_COLORS = {
    "focus": "#e74c3c",
    "short_break": "#27ae60",
    "long_break": "#2980b9",
}

SESSION_LABELS = {
    "focus": "专注时间",
    "short_break": "短休息",
    "long_break": "长休息",
}

BG = "#f5f6fa"
CARD_BG = "#ffffff"
TEXT_DARK = "#2c3e50"
TEXT_MUTED = "#95a5a6"

# ---------------------------------------------------------------------------
# 主应用
# ---------------------------------------------------------------------------


class PomodoroTimer:
    def __init__(self):
        self.settings_path = os.path.join(
            os.path.dirname(os.path.abspath(sys.argv[0])), "pomodoro_settings.json"
        )
        self.settings = self._load_settings()

        self._build_durations()
        self.cycles = self.settings["cycles"]

        # 运行时状态
        self.current = "focus"
        self.remaining = self.durations["focus"]
        self.running = False
        self.completed = 0
        self._timer_id = None

        # 构建窗口
        self.root = tk.Tk()
        self.root.title("番茄钟")
        self.root.geometry("400x560")
        self.root.resizable(False, False)
        self.root.configure(bg=BG)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        if self.settings["always_on_top"]:
            self.root.attributes("-topmost", True)

        self._build_ui()
        self._update_display()

    # ---- UI 构建 ------------------------------------------------------------

    def _build_ui(self):
        self._style = ttk.Style()
        self._style.theme_use("clam")

        # 自定义样式
        self._style.configure(
            "Title.TLabel",
            font=("Microsoft YaHei UI", 18, "bold"),
            background=BG,
            foreground=TEXT_DARK,
        )
        self._style.configure(
            "Session.TLabel",
            font=("Microsoft YaHei UI", 13),
            background=BG,
        )
        self._style.configure(
            "Stats.TLabel",
            font=("Microsoft YaHei UI", 10),
            background=BG,
            foreground=TEXT_MUTED,
        )
        self._style.configure(
            "Primary.TButton",
            font=("Microsoft YaHei UI", 12, "bold"),
            padding=(24, 10),
        )
        self._style.configure(
            "Secondary.TButton",
            font=("Microsoft YaHei UI", 10),
            padding=(8, 6),
        )
        self._style.configure(
            "TProgressbar",
            thickness=8,
            troughcolor="#ecf0f1",
            background="#e74c3c",
        )

        # -- 主容器 --
        main = tk.Frame(self.root, bg=BG)
        main.pack(fill=tk.BOTH, expand=True, padx=24, pady=20)

        # 标题
        ttk.Label(main, text="番茄钟", style="Title.TLabel").pack(pady=(0, 2))

        # 会话标签
        self.session_label = ttk.Label(main, text="", style="Session.TLabel")
        self.session_label.pack(pady=(0, 16))

        # 计时器卡片
        card = tk.Frame(main, bg=CARD_BG, highlightthickness=1,
                        highlightbackground="#e0e0e0")
        card.pack(fill=tk.X, pady=(0, 12), ipady=14)

        self.timer_label = tk.Label(
            card, text="25:00",
            font=("Consolas", 52, "bold"),
            fg=SESSION_COLORS["focus"],
            bg=CARD_BG,
        )
        self.timer_label.pack(pady=(8, 0))

        # 进度条 (显示剩余时间)
        self.progress = ttk.Progressbar(
            card, mode="determinate", style="TProgressbar"
        )
        self.progress.pack(fill=tk.X, padx=24, pady=(8, 12))

        # 统计信息
        self.stats_label = ttk.Label(main, text="", style="Stats.TLabel")
        self.stats_label.pack(pady=(0, 10))

        # 番茄圆点指示器
        self.dots_frame = tk.Frame(main, bg=BG)
        self.dots_frame.pack(pady=(0, 12))
        self.dots = []
        self._build_dots()

        # 控制按钮
        btn_row = tk.Frame(main, bg=BG)
        btn_row.pack(pady=(0, 14))

        self.start_btn = ttk.Button(
            btn_row, text="▶  开始专注", style="Primary.TButton",
            command=self._toggle_timer,
        )
        self.start_btn.pack(side=tk.LEFT, padx=4)

        self.skip_btn = ttk.Button(
            btn_row, text="跳过", style="Secondary.TButton",
            command=self._skip,
        )
        self.skip_btn.pack(side=tk.LEFT, padx=4)

        self.reset_btn = ttk.Button(
            btn_row, text="重置", style="Secondary.TButton",
            command=self._reset,
        )
        self.reset_btn.pack(side=tk.LEFT, padx=4)

        # 底部工具栏
        bottom = tk.Frame(main, bg=BG)
        bottom.pack(side=tk.BOTTOM, fill=tk.X)

        self.top_var = tk.BooleanVar(value=self.settings["always_on_top"])
        ttk.Checkbutton(
            bottom, text="窗口置顶", variable=self.top_var,
            command=self._toggle_top,
        ).pack(side=tk.LEFT)

        ttk.Button(
            bottom, text="设置", style="Secondary.TButton",
            command=self._open_settings, width=7,
        ).pack(side=tk.RIGHT)

    def _build_dots(self):
        """根据 cycles 数量重建圆点指示器。"""
        for d in self.dots:
            d.destroy()
        self.dots.clear()
        for i in range(self.cycles):
            dot = tk.Label(
                self.dots_frame, text="●", font=("", 15),
                fg="#dcdde1", bg=BG,
            )
            dot.pack(side=tk.LEFT, padx=5)
            self.dots.append(dot)
        # 重置缓存以强制下次 _update_display 刷新圆点颜色
        self._last_completed = -1

    # ---- 定时器逻辑 ---------------------------------------------------------

    def _stop_timer(self):
        self.running = False
        if self._timer_id is not None:
            self.root.after_cancel(self._timer_id)
            self._timer_id = None

    def _build_durations(self):
        self.durations = {
            "focus": self.settings["focus"] * 60,
            "short_break": self.settings["short_break"] * 60,
            "long_break": self.settings["long_break"] * 60,
        }

    def _tick(self):
        if not self.running:
            return
        if self.remaining > 0:
            self.remaining -= 1
            self._update_display()
            self._timer_id = self.root.after(1000, self._tick)
        else:
            self.running = False
            self._timer_id = None
            self._session_complete()

    def _toggle_timer(self):
        if self.running:
            self._stop_timer()
        else:
            self.running = True
            self._tick()
        self._update_display()

    def _reset(self):
        self._stop_timer()
        self.remaining = self.durations[self.current]
        self._update_display()

    def _skip(self):
        """跳过当前阶段（不计入番茄完成数），进入下一阶段。"""
        self._stop_timer()
        self.remaining = 0
        self._session_complete(count_focus=False)

    def _session_complete(self, count_focus=True):
        """当前阶段计时结束 — 播放提醒并切换到下一阶段。"""
        self._notify()

        if self.current == "focus":
            if count_focus:
                self.completed += 1
            if self.completed >= self.cycles:
                self.current = "long_break"
                self.remaining = self.durations["long_break"]
                self.completed = 0
                msg = "完成了 {} 个番茄！\n该来一次长休息了~".format(self.cycles)
            else:
                self.current = "short_break"
                self.remaining = self.durations["short_break"]
                msg = "专注时间结束！\n休息一下吧 ☕"
        else:
            self.current = "focus"
            self.remaining = self.durations["focus"]
            msg = "休息结束！\n开始新的番茄吧 💪"

        self._update_display()

        # 弹窗提示
        self.root.lift()
        self.root.focus_force()
        messagebox.showinfo("番茄钟提醒", msg)

    def _notify(self):
        """在子线程中播放系统提示音。"""
        def _beep():
            if _HAS_WINSOUND:
                try:
                    for _ in range(3):
                        winsound.MessageBeep(0xFFFFFFFF)
                        time.sleep(0.25)
                except Exception:
                    pass

        threading.Thread(target=_beep, daemon=True).start()

    # ---- 显示更新 -----------------------------------------------------------

    def _update_display(self):
        mins, secs = divmod(self.remaining, 60)
        self.timer_label.config(text=f"{mins:02d}:{secs:02d}")

        color = SESSION_COLORS[self.current]
        self.timer_label.config(fg=color)
        self.session_label.config(
            text=SESSION_LABELS[self.current], foreground=color
        )

        # 进度条：只在阶段切换时更新颜色
        if not hasattr(self, "_last_color") or self._last_color != color:
            self._last_color = color
            self._style.configure("TProgressbar", background=color)

        total = self.durations[self.current]
        self.progress["maximum"] = total
        self.progress["value"] = total - self.remaining

        # 统计
        self.stats_label.config(
            text=f"本轮已完成 {self.completed} / {self.cycles} 个番茄"
        )

        # 圆点 — 只在完成数变化时更新
        if not hasattr(self, "_last_completed") or self._last_completed != self.completed:
            self._last_completed = self.completed
            for i in range(self.cycles):
                self.dots[i].config(
                    fg="#f39c12" if i < self.completed else "#dcdde1"
                )

        # 按钮文字 — 只在启停或阶段切换时更新
        if not hasattr(self, "_last_running") or self._last_running != self.running or self._last_current != self.current:
            self._last_running = self.running
            self._last_current = self.current
            if self.running:
                self.start_btn.config(text="⏸  暂停")
            else:
                if self.current == "focus":
                    prefix = "▶  开始专注"
                elif self.current == "short_break":
                    prefix = "▶  短休息"
                else:
                    prefix = "▶  长休息"
                self.start_btn.config(text=prefix)

    # ---- 设置 ---------------------------------------------------------------

    def _open_settings(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("设置")
        dialog.geometry("320x300")
        dialog.resizable(False, False)
        dialog.configure(bg=BG)
        dialog.transient(self.root)
        dialog.grab_set()

        # 居中
        dialog.update_idletasks()
        x = self.root.winfo_x() + (self.root.winfo_width() - 320) // 2
        y = self.root.winfo_y() + (self.root.winfo_height() - 300) // 2
        dialog.geometry(f"+{x}+{y}")

        frame = tk.Frame(dialog, bg=BG, padx=24, pady=20)
        frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(
            frame, text="番茄钟设置",
            font=("Microsoft YaHei UI", 14, "bold"),
            background=BG, foreground=TEXT_DARK,
        ).pack(pady=(0, 16))

        fields = [
            ("专注时长 (分钟)", "focus"),
            ("短休息时长 (分钟)", "short_break"),
            ("长休息时长 (分钟)", "long_break"),
            ("长休息前番茄数", "cycles"),
        ]

        entries = {}
        for label, key in fields:
            row = tk.Frame(frame, bg=BG)
            row.pack(fill=tk.X, pady=4)
            ttk.Label(
                row, text=label, background=BG,
                font=("Microsoft YaHei UI", 11), width=18,
            ).pack(side=tk.LEFT)
            var = tk.StringVar(value=str(self.settings[key]))
            entry = ttk.Entry(
                row, textvariable=var, width=8,
                font=("Microsoft YaHei UI", 11),
            )
            entry.pack(side=tk.RIGHT)
            entries[key] = var

        def save():
            try:
                new_settings = {}
                for key, var in entries.items():
                    val = int(var.get())
                    if val < 1 or val > 120:
                        raise ValueError("数值需在 1-120 之间")
                    new_settings[key] = val

                self.settings.update(new_settings)
                self._build_durations()
                self.cycles = self.settings["cycles"]

                # 重建圆点
                self._build_dots()

                if not self._save_settings():
                    messagebox.showerror("保存失败", "无法写入设置文件，请检查磁盘空间或权限。")
                    return

                # 如果当前阶段时长缩短了，裁剪剩余时间
                for k in ("focus", "short_break", "long_break"):
                    if self.current == k and self.remaining > self.durations[k]:
                        self.remaining = self.durations[k]

                # 如果 cycles 缩小了，裁剪 completed
                if self.completed > self.cycles:
                    self.completed = self.cycles

                self._update_display()
                dialog.destroy()
                messagebox.showinfo("已保存", "时间设置已更新。")

            except ValueError:
                messagebox.showerror(
                    "输入错误", "请输入 1-120 之间的整数。"
                )

        ttk.Button(
            frame, text="保存设置", command=save,
            style="Primary.TButton",
        ).pack(pady=(16, 0))

    def _toggle_top(self):
        state = self.top_var.get()
        self.root.attributes("-topmost", state)
        self.settings["always_on_top"] = state
        self._save_settings()

    # ---- 持久化 -------------------------------------------------------------

    def _load_settings(self):
        try:
            with open(self.settings_path, "r", encoding="utf-8") as f:
                stored = json.load(f)
                return {**DEFAULT_SETTINGS, **stored}
        except (FileNotFoundError, json.JSONDecodeError):
            return dict(DEFAULT_SETTINGS)

    def _save_settings(self):
        try:
            with open(self.settings_path, "w", encoding="utf-8") as f:
                json.dump(self.settings, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"[番茄钟] 保存设置失败: {e}", file=sys.stderr)
            return False

    def _on_close(self):
        self._stop_timer()
        self.root.destroy()

    def run(self):
        self.root.mainloop()


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    PomodoroTimer().run()
