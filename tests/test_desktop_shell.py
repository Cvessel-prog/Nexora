import sys
import threading

import pytest

import desktop_shell


def test_forced_browser_wins(monkeypatch):
    monkeypatch.setattr(desktop_shell, "webview_available", lambda: True)
    monkeypatch.setattr(desktop_shell, "edge_executable", lambda: "msedge.exe")
    assert desktop_shell.backend(force_browser=True) == "browser"


def test_backend_prefers_webview_then_edge(monkeypatch):
    monkeypatch.setattr(desktop_shell, "webview_available", lambda: True)
    monkeypatch.setattr(desktop_shell, "edge_executable", lambda: "msedge.exe")
    assert desktop_shell.backend() == "webview"

    monkeypatch.setattr(desktop_shell, "webview_available", lambda: False)
    assert desktop_shell.backend() == "edge"

    monkeypatch.setattr(desktop_shell, "edge_executable", lambda: None)
    assert desktop_shell.backend() == "browser"


def test_open_window_uses_browser_when_no_host_exists(monkeypatch):
    opened: list[str] = []
    monkeypatch.setattr(desktop_shell, "backend", lambda force_browser=False: "browser")
    monkeypatch.setattr(desktop_shell.webbrowser, "open", lambda url: opened.append(url))

    used = desktop_shell.open_window("http://127.0.0.1:1/#token=test", threading.Event())

    assert used == "browser"
    assert opened == ["http://127.0.0.1:1/#token=test"]


@pytest.mark.skipif(sys.platform != "win32", reason="Edge host is Windows-only")
def test_open_window_falls_back_when_edge_launch_fails(monkeypatch):
    opened: list[str] = []
    monkeypatch.setattr(desktop_shell, "backend", lambda force_browser=False: "edge")
    monkeypatch.setattr(desktop_shell, "edge_executable", lambda: "C:/missing/msedge.exe")

    def fail(url, stop_event):
        raise OSError("edge missing")

    monkeypatch.setattr(desktop_shell, "_run_edge", fail)
    monkeypatch.setattr(desktop_shell.webbrowser, "open", lambda url: opened.append(url))

    used = desktop_shell.open_window("http://127.0.0.1:1/#token=test", threading.Event())

    assert used == "browser"
    assert len(opened) == 1
