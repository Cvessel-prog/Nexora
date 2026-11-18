#!/usr/bin/env python3
"""Single-instance Windows-friendly launcher for the local React review app."""

from __future__ import annotations

import argparse
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

import uvicorn
from filelock import FileLock, Timeout

import desktop_shell
from apps.api import create_app
from core import win_acl

ROOT = Path(__file__).parent
HOST = "127.0.0.1"


def runtime_directory(override: Path | None = None) -> Path:
    if override:
        return override.expanduser().resolve()
    base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    return base / "PersonalAIProfile"


def default_vault() -> Path:
    """A user-writable Vault location outside the install directory."""
    from core.vault_identity import default_vault_directory
    return (Path(default_vault_directory()) / "my-ai-profile").resolve()


def choose_vault(value: Path | None) -> Path:
    """Resolve the Vault without blocking the first launch on a file dialog."""
    if value:
        candidate = value.expanduser()
        if not candidate.is_dir():
            raise RuntimeError(f"指定的私人 Vault 不存在或不是文件夹：{candidate}")
        return candidate.resolve()
    configured = os.environ.get("PROFILE_VAULT")
    if configured:
        candidate = Path(configured).expanduser()
        if not candidate.is_dir():
            raise RuntimeError(f"PROFILE_VAULT 指向的私人 Vault 不存在：{candidate}")
        return candidate.resolve()
    checkout_default = ROOT.parent / "my-ai-profile"
    if checkout_default.is_dir():
        return checkout_default.resolve()
    # First launch: create the default Vault.  Users can switch it later in the
    # first-run wizard or Settings instead of facing a modal folder picker before
    # the local service has even started.
    return default_vault()


def _newest_source_mtime(web: Path) -> float:
    """前端源码中最近一次修改时间；用于判断现有构建是否已过期。"""
    newest = 0.0
    for pattern in ("src/**/*", "index.html", "package.json", "vite.config.ts"):
        for path in web.glob(pattern):
            try:
                newest = max(newest, path.stat().st_mtime)
            except OSError:
                continue
    return newest


def ensure_web_build() -> Path:
    web = ROOT / "apps" / "web"
    index = web / "dist" / "index.html"
    stale = not index.is_file() or index.stat().st_mtime < _newest_source_mtime(web)
    if not stale:
        return index.parent
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        if index.is_file():
            # 没有 npm 时仍可运行旧构建，只是看不到最新前端改动。
            return index.parent
        raise RuntimeError("缺少前端构建且未找到 npm；请先安装 Node.js 或使用后续打包版本。")
    if index.is_file():
        print("前端源码已更新，正在重新构建 React 界面…")
    try:
        if not (web / "node_modules").is_dir():
            subprocess.run([npm, "install"], cwd=web, check=True)
        subprocess.run([npm, "run", "build"], cwd=web, check=True)
    except (subprocess.CalledProcessError, OSError) as exc:
        if index.is_file():
            # 构建失败不应阻断启动：回退到已有构建并说明原因。
            print(f"前端重建失败（{exc}），继续使用现有构建；界面可能不是最新版本。")
            return index.parent
        raise RuntimeError(f"React审核界面构建失败：{exc}") from exc
    if not index.is_file():
        raise RuntimeError("React审核界面构建失败。")
    return index.parent


def ensure_vault(vault: Path) -> None:
    """Create the Vault from the bundled template when the target is missing or empty."""
    if vault.exists() and any(vault.iterdir()):
        return
    from core import profile
    profile.init(str(vault))


def read_runtime(path: Path) -> dict[str, object] | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (OSError, ValueError):
        return None


def healthy(port: int, timeout: float = 0.5) -> bool:
    try:
        with urllib.request.urlopen(f"http://{HOST}:{port}/api/v1/health", timeout=timeout) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError, ValueError):
        return False


def browser_url(port: int, token: str) -> str:
    return f"http://{HOST}:{port}/#" + urllib.parse.urlencode({"token": token})


def write_runtime(path: Path, *, port: int, token: str, vault: Path) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.unlink(missing_ok=True)
    payload = json.dumps({
        "pid": os.getpid(), "port": port, "token": token,
        "vault": str(vault), "started": time.time(),
    }, ensure_ascii=False).encode("utf-8")
    # runtime.json carries the local bearer token.  Create the temporary file
    # with a private DACL instead of relying on the ineffective chmod(0600).
    win_acl.create_private_file(temporary, payload)
    os.replace(temporary, path)
    win_acl.secure_private_file(path)


def wait_and_open(port: int, token: str, no_browser: bool) -> None:
    for _ in range(100):
        if healthy(port):
            if not no_browser:
                webbrowser.open(browser_url(port, token))
            return
        time.sleep(0.1)


def wait_until_healthy(port: int, *, timeout: float = 20.0, errors: list[BaseException] | None = None) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if errors:
            raise RuntimeError(f"本地服务启动失败：{errors[0]}") from errors[0]
        if healthy(port):
            return
        time.sleep(0.1)
    raise RuntimeError("本地服务未能在预期时间内就绪；请查看 launcher-error.log 或重试。")


def _run_server(server: uvicorn.Server, sock: socket.socket, errors: list[BaseException]) -> None:
    try:
        server.run(sockets=[sock])
    except BaseException as exc:  # keep a windowed launch from dying silently
        errors.append(exc)


def relaunch(vault: Path, runtime_dir: Path, args: argparse.Namespace) -> None:
    """Start a fresh process after a windowed Vault switch.

    A WebView can only be started once per process, so the windowed path hands a
    Vault switch to a new process instead of trying to rebuild the GUI in place.
    """
    command = [sys.executable]
    if not getattr(sys, "frozen", False):
        command.append(str(ROOT / "launcher.py"))
    command += [
        "--vault", str(vault), "--runtime-dir", str(runtime_dir),
        "--port", str(args.port), "--wait-for-lock",
    ]
    if args.browser:
        command.append("--browser")
    if args.no_window:
        command.append("--no-window")
    subprocess.Popen(command, cwd=str(ROOT), close_fds=True)


def launch(args: argparse.Namespace) -> int:
    state_dir = runtime_directory(args.runtime_dir)
    state_dir.mkdir(parents=True, exist_ok=True)
    runtime_file = state_dir / "runtime.json"
    lock_file = state_dir / "launcher.lock"
    lock = FileLock(lock_file)

    try:
        lock.acquire(timeout=10 if args.wait_for_lock else 0)
    except Timeout:
        for _ in range(50):
            current = read_runtime(runtime_file)
            if current and healthy(int(current.get("port", 0))):
                if not args.no_browser:
                    url = browser_url(int(current["port"]), str(current["token"]))
                    if sys.platform == "win32" and not args.no_window:
                        desktop_shell.open_window(url, threading.Event(), force_browser=args.browser)
                    else:
                        webbrowser.open(url)
                return 0
            time.sleep(0.1)
        raise RuntimeError("已有启动进程占用单实例锁，但本地服务尚未就绪。") from None

    relaunch_vault: Path | None = None
    use_window = sys.platform == "win32" and not args.no_browser and not args.no_window
    try:
        web_dist = ensure_web_build()
        vault = choose_vault(args.vault)
        while True:
            ensure_vault(vault)
            token = secrets.token_urlsafe(32)
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((HOST, args.port))
            sock.listen(128)
            port = int(sock.getsockname()[1])
            requested: list[Path] = []
            app = create_app(vault, token=token, web_dist=web_dist, watch=True)
            # The packaged Windows GUI executable has no stdout/stderr. Skip
            # Uvicorn's default formatter, which assumes sys.stdout.isatty().
            server = uvicorn.Server(
                uvicorn.Config(
                    app,
                    host=HOST,
                    port=port,
                    log_level="warning",
                    log_config=None,
                    access_log=False,
                )
            )
            def request_shutdown(_server: uvicorn.Server = server) -> None:
                _server.should_exit = True

            def restart(next_vault: Path, _server: uvicorn.Server = server, _requested: list[Path] = requested) -> None:
                _requested.append(next_vault.resolve())
                _server.should_exit = True

            app.state.request_shutdown = request_shutdown
            app.state.request_restart = restart
            write_runtime(runtime_file, port=port, token=token, vault=vault)

            if not use_window:
                threading.Thread(target=wait_and_open, args=(port, token, args.no_browser), daemon=True).start()
                try:
                    server.run(sockets=[sock])
                finally:
                    sock.close()
                    runtime_file.unlink(missing_ok=True)
                if not requested:
                    return 0
                vault = requested[-1]
                continue

            errors: list[BaseException] = []
            server_thread = threading.Thread(target=_run_server, args=(server, sock, errors), name="nexora-server", daemon=True)
            server_thread.start()
            try:
                wait_until_healthy(port, errors=errors)
                stop_event = threading.Event()

                def stop_window_when_server_stops(_thread: threading.Thread = server_thread, _event: threading.Event = stop_event) -> None:
                    _thread.join()
                    _event.set()

                threading.Thread(target=stop_window_when_server_stops, daemon=True).start()
                backend_used = desktop_shell.open_window(
                    browser_url(port, token), stop_event, force_browser=args.browser,
                )
                if backend_used in {"webview", "edge"}:
                    # The user closed the native window: stop the local service.
                    stop_event.set()
                    server.should_exit = True
                # In the browser fallback the server keeps running until the user
                # chooses “关闭服务” (or the process is stopped).
                server_thread.join()
            finally:
                sock.close()
                runtime_file.unlink(missing_ok=True)
            if errors and not requested:
                raise RuntimeError(f"本地服务异常退出：{errors[0]}") from errors[0]
            if not requested:
                return 0
            relaunch_vault = requested[-1]
            break
    finally:
        runtime_file.unlink(missing_ok=True)
        lock.release()
        lock_file.unlink(missing_ok=True)

    if relaunch_vault is not None:
        relaunch(relaunch_vault, state_dir, args)
    return 0


def show_error(exc: BaseException, state_dir: Path) -> None:
    state_dir.mkdir(parents=True, exist_ok=True)
    message = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    (state_dir / "launcher-error.log").write_text(message, encoding="utf-8")
    try:
        from tkinter import Tk, messagebox
        root = Tk()
        root.withdraw()
        messagebox.showerror("NEXORA", str(exc) or type(exc).__name__)
        root.destroy()
    except Exception:
        print(message, file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description="启动 NEXORA 本地工作台")
    parser.add_argument("--vault", type=Path)
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--runtime-dir", type=Path, help=argparse.SUPPRESS)
    parser.add_argument("--no-browser", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--no-window", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--browser", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--wait-for-lock", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    try:
        return launch(args)
    except Exception as exc:
        show_error(exc, runtime_directory(args.runtime_dir))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
