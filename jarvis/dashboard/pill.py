"""
jarvis/dashboard/pill.py

Minimal stylized cute floating overlay pill for J.A.R.V.I.S agent tasks.
Built with Tkinter (no heavy external dependencies).
Always-on-top, dark-mode, sleek pill positioned at top-center of screen.
Provides Pause/Resume and Stop controls that integrate cleanly with async agent loops.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import Optional

logger = logging.getLogger(__name__)

# Global state for the active pill
_pill_instance: Optional["FloatingPill"] = None
_pill_lock = threading.Lock()


class FloatingPill:
    """A sleek, minimal floating Tkinter window at the top center of the screen."""

    def __init__(self, task_type: str = "Agent Active"):
        import tkinter as tk

        self.task_type = task_type
        self.is_paused = False
        self.is_stopped = False

        self.root = tk.Tk()
        self.root.overrideredirect(True)  # Frameless pill
        self.root.attributes("-topmost", True)  # Always on top

        # Windows transparency and styling
        self.root.configure(bg="#141414")
        
        # Calculate top center position
        screen_w = self.root.winfo_screenwidth()
        pill_w = 260
        pill_h = 44
        pos_x = (screen_w - pill_w) // 2
        pos_y = 16
        self.root.geometry(f"{pill_w}x{pill_h}+{pos_x}+{pos_y}")

        # Outer border / pill container
        self.frame = tk.Frame(
            self.root,
            bg="#141414",
            highlightbackground="#22d3ee",
            highlightthickness=1,
            padx=8,
            pady=4,
        )
        self.frame.pack(fill="both", expand=True)

        # Status Dot
        self.dot = tk.Canvas(self.frame, width=12, height=12, bg="#141414", highlightthickness=0)
        self.dot_id = self.dot.create_oval(2, 2, 10, 10, fill="#22d3ee", outline="")
        self.dot.pack(side="left", padx=(4, 6))

        # Title Label
        self.lbl = tk.Label(
            self.frame,
            text=f"JARVIS | {self.task_type}",
            font=("Segoe UI", 9, "bold"),
            fg="#e4e4e7",
            bg="#141414",
        )
        self.lbl.pack(side="left", padx=4)

        # Stop Button
        self.btn_stop = tk.Button(
            self.frame,
            text="⏹",
            font=("Segoe UI", 9),
            fg="#f87171",
            bg="#1f1f1f",
            activebackground="#2e2e2e",
            activeforeground="#f87171",
            relief="flat",
            command=self._on_stop,
            cursor="hand2",
            padx=4,
            pady=0,
        )
        self.btn_stop.pack(side="right", padx=(2, 2))

        # Pause/Resume Button
        self.btn_pause = tk.Button(
            self.frame,
            text="⏸",
            font=("Segoe UI", 9),
            fg="#facc15",
            bg="#1f1f1f",
            activebackground="#2e2e2e",
            activeforeground="#facc15",
            relief="flat",
            command=self._on_pause_toggle,
            cursor="hand2",
            padx=4,
            pady=0,
        )
        self.btn_pause.pack(side="right", padx=(2, 2))

        # Start pulsing dot animation
        self._pulse_state = True
        self._animate_dot()

    def _animate_dot(self):
        if self.is_stopped:
            return
        try:
            if self.is_paused:
                self.dot.itemconfig(self.dot_id, fill="#facc15")
            else:
                color = "#22d3ee" if self._pulse_state else "#0891b2"
                self.dot.itemconfig(self.dot_id, fill=color)
                self._pulse_state = not self._pulse_state
            self.root.after(500, self._animate_dot)
        except Exception:
            pass

    def _on_pause_toggle(self):
        self.is_paused = not self.is_paused
        if self.is_paused:
            self.btn_pause.configure(text="▶", fg="#4ade80")
            self.lbl.configure(text="JARVIS | Paused")
            self.frame.configure(highlightbackground="#facc15")
            logger.info("Agent task paused by user via floating pill.")
        else:
            self.btn_pause.configure(text="⏸", fg="#facc15")
            self.lbl.configure(text=f"JARVIS | {self.task_type}")
            self.frame.configure(highlightbackground="#22d3ee")
            logger.info("Agent task resumed by user via floating pill.")

    def _on_stop(self):
        self.is_stopped = True
        self.is_paused = False
        self.lbl.configure(text="JARVIS | Stopping...")
        self.frame.configure(highlightbackground="#f87171")
        self.dot.itemconfig(self.dot_id, fill="#f87171")
        logger.warning("Agent task stopped by user via floating pill.")

    def destroy(self):
        try:
            self.root.destroy()
        except Exception:
            pass


def _run_pill_thread(task_type: str):
    global _pill_instance
    try:
        pill = FloatingPill(task_type)
        with _pill_lock:
            _pill_instance = pill
        pill.root.mainloop()
    except Exception as e:
        logger.debug("Floating pill GUI exception: %s", e)
    finally:
        with _pill_lock:
            _pill_instance = None


def show_pill(task_type: str = "Agent Active") -> None:
    """Show the floating pill in a background GUI thread."""
    global _pill_instance
    hide_pill()
    t = threading.Thread(target=_run_pill_thread, args=(task_type,), daemon=True)
    t.start()


def hide_pill() -> None:
    """Hide and destroy the active floating pill."""
    global _pill_instance
    with _pill_lock:
        if _pill_instance is not None:
            try:
                _pill_instance.destroy()
            except Exception:
                pass
            _pill_instance = None


async def check_pill_state() -> bool:
    """Check if the pill is paused (waits asynchronously) or stopped.

    Returns True if the task was STOPPED by the user, False otherwise.
    """
    global _pill_instance
    while True:
        with _pill_lock:
            pill = _pill_instance
            if pill is None:
                return False
            if pill.is_stopped:
                return True
            paused = pill.is_paused

        if not paused:
            return False

        # If paused, sleep and check again without blocking event loop
        await asyncio.sleep(0.3)
