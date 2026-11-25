"""Desktop window front-end for the local NEXORA service.

The product deliberately avoids Electron/Tauri (see docs/DECISIONS.md).  On
Windows this module prefers a native WebView2 window through pywebview, falls
back to an Edge ``--app`` window, and finally to the system browser.  The
fallbacks keep the app usable on machines where the optional WebView2 host is
missing or cannot start.
"""

from __future__ import annotations

import contextlib
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import webbrowser
from pathlib import Path

WINDOW_TITLE = "NEXORA 知序"
_CREATE_NO_WINDOW = 0x08000000


def edge_executable() -> str | None:
    if sys.platform != "win32":
        return None
    bases = [
        os.environ.get("PROGRAMFILES(X86)"),
        os.environ.get("PROGRAMFILES"),
        os.environ.get("LOCALAPPDATA"),
    ]
    for base in filter(None, bases):
        candidate = Path(base) / "Microsoft" / "Edge" / "Application" / "msedge.exe"
        if candidate.is_file():
            return str(candidate)
    return shutil.which("msedge")


def webview_available() -> bool:
    if sys.platform != "win32":
        return False
    try:
        import webview  # noqa: F401
    except Exception:
        return False
    return True


def backend(force_browser: bool = False) -> str:
    if force_browser:
        return "browser"
    if webview_available():
        return "webview"
    if edge_executable():
        return "edge"
    return "browser"


def _run_edge(url: str, stop_event: threading.Event) -> str:
    executable = edge_executable()
    if not executable:
        webbrowser.open(url)
        return "browser"
    with tempfile.TemporaryDirectory(prefix="nexora-window-") as profile:
        command = [
            executable,
            f"--app={url}",
            f"--user-data-dir={profile}",
            "--no-first-run",
            "--no-default-browser-check",
            "--window-size=1280,860",
            "--disable-features=msEdgeSidebarV2,msEdgeSplitScreen",
        ]
        process = subprocess.Popen(command, creationflags=_CREATE_NO_WINDOW if os.name == "nt" else 0)

        def stop() -> None:
            stop_event.wait()
            if process.poll() is None:
                process.terminate()

        threading.Thread(target=stop, daemon=True).start()
        process.wait()
    return "edge"


def _run_webview(url: str, stop_event: threading.Event) -> str:
    import webview

    window = webview.create_window(
        WINDOW_TITLE,
        url,
        width=1280,
        height=860,
        min_size=(1024, 700),
        text_select=True,
    )

    def stop() -> None:
        stop_event.wait()
        with contextlib.suppress(Exception):
            window.destroy()

    threading.Thread(target=stop, daemon=True).start()
    webview.start()
    return "webview"


def open_window(url: str, stop_event: threading.Event, *, force_browser: bool = False) -> str:
    """Open the workspace window and block until it closes.

    ``stop_event`` is set by the launcher when the local service stops; the
    window then closes itself.  The returned value identifies the backend that
    was actually used.  The browser fallback does not block.
    """
    selected = backend(force_browser)
    if selected == "webview":
        try:
            return _run_webview(url, stop_event)
        except Exception:
            # A missing WebView2 runtime or a headless session must not strand
            # the user: fall through to the Edge app window or default browser.
            pass
    if selected in {"webview", "edge"} and edge_executable():
        try:
            return _run_edge(url, stop_event)
        except OSError:
            # Edge can disappear between discovery and launch (enterprise policy,
            # an uninstalled build, or a locked profile).  Never strand the app.
            pass
    webbrowser.open(url)
    return "browser"


__all__ = ["WINDOW_TITLE", "backend", "edge_executable", "open_window", "webview_available"]
