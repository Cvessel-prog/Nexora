#!/usr/bin/env python3
"""Single-instance Windows-friendly launcher for the local React review app."""

from __future__ import annotations

import argparse
import contextlib
import errno
import json
import logging
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
from core.windows_security import ensure_private_directory

ROOT = Path(__file__).parent
HOST = "127.0.0.1"
LOGGER = logging.getLogger("nexora.launcher")
_SECRETS: set[str] = set()


def _remember_secret(value: object) -> None:
    text = str(value or "")
    if text:
        _SECRETS.add(text)


def _redact(text: str) -> str:
    for secret in _SECRETS:
        text = text.replace(secret, "[redacted]")
    return text



def runtime_directory(override: Path | None = None) -> Path:
    if override:
        return override.expanduser().resolve()
    base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    return base / "PersonalAIProfile"


def configure_logging(state_dir: Path) -> None:
    """Write a small, append-only startup log without tokens or Vault content."""
    path = state_dir / "launcher.log"
    for handler in list(LOGGER.handlers):
        LOGGER.removeHandler(handler)
        handler.close()
    with contextlib.suppress(OSError, RuntimeError):
        # Keep the log private and repair an inherited empty DACL on Windows.
        win_acl.ensure_private_file(path, b"")
    try:
        handler = logging.FileHandler(path, encoding="utf-8")
    except OSError:
        # Logging must never prevent the product from starting.
        LOGGER.addHandler(logging.NullHandler())
        return
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    LOGGER.addHandler(handler)
    LOGGER.setLevel(logging.INFO)
    LOGGER.propagate = False


def bind_socket(port: int) -> socket.socket:
    """Bind the loopback listener with a user-readable conflict message."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    if os.name == "nt":
        # On Windows SO_REUSEADDR permits hijacking a port another process is
        # already listening on, which would hide a real conflict.  Exclusive use
        # makes bind() fail so the user gets an actionable message.
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
    else:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((HOST, port))
    except OSError as exc:
        sock.close()
        in_use = exc.errno == errno.EADDRINUSE or getattr(exc, "winerror", None) == 10048
        if in_use:
            raise RuntimeError(
                f"端口 {port} 已被其他程序占用。请关闭占用该端口的程序，"
                "或不要指定 --port，让 NEXORA 自动选择可用端口。"
            ) from exc
        raise RuntimeError(f"无法在 127.0.0.1:{port} 启动本地服务：{exc}") from exc
    sock.listen(128)
    return sock



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
    """Create the Vault from the bundled template, or fail with a clear message."""
    if vault.exists() and not vault.is_dir():
        raise RuntimeError(f"Vault 路径不是文件夹：{vault}")
    if vault.exists() and any(vault.iterdir()):
        # An arbitrary non-empty folder is not a Vault.  Validate before the
        # service starts so the user sees one actionable message instead of a
        # half-working workspace.
        from core.vault_management import CURRENT_SCHEMA_VERSION, schema_version
        version = schema_version(vault)
        if version == 0:
            raise RuntimeError(
                f"所选文件夹不是 NEXORA Vault（缺少有效的 Vault 配置）：{vault}。"
                "请选择一个空文件夹，或使用 NEXORA 创建的 Vault。"
            )
        if version != CURRENT_SCHEMA_VERSION:
            raise RuntimeError(
                f"Vault 版本为 {version}，当前应用需要 {CURRENT_SCHEMA_VERSION}。"
                "请先运行迁移或使用匹配版本的 NEXORA。"
            )
        return
    from core import profile
    profile.init(str(vault))


def read_runtime(path: Path) -> dict[str, object] | None:
    try:
        data = json.loads(win_acl.read_private_bytes(path).decode("utf-8"))
        return data if isinstance(data, dict) else None
    except (OSError, ValueError, RuntimeError):
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
            LOGGER.info("local service ready on port %s (browser mode)", port)
            if not no_browser:
                webbrowser.open(browser_url(port, token))
            return
        time.sleep(0.1)


def make_server(app: object, port: int) -> uvicorn.Server:
    """Build Uvicorn without its stdout-dependent default formatter."""
    return uvicorn.Server(
        uvicorn.Config(
            app,
            host=HOST,
            port=port,
            log_level="warning",
            log_config=None,
            access_log=False,
            # A lingering keep-alive connection must not keep the app alive
            # after the user closes the window or chooses 关闭服务.
            timeout_graceful_shutdown=5,
        )
    )


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
    if args.vault:
        selected_vault = args.vault.expanduser().resolve()
        try:
            state_dir.relative_to(selected_vault)
        except ValueError:
            pass
        else:
            raise RuntimeError("Runtime 目录不能位于私人 Vault 内；请选择独立目录。")
    ensure_private_directory(state_dir)
    configure_logging(state_dir)
    runtime_file = state_dir / "runtime.json"
    lock_file = state_dir / "launcher.lock"
    lock = FileLock(lock_file)
    LOGGER.info("launcher start pid=%s", os.getpid())

    try:
        lock.acquire(timeout=10 if getattr(args, "wait_for_lock", False) else 0)
    except Timeout:
        LOGGER.info("existing launcher detected; reusing the running service")
        for _ in range(50):
            current = read_runtime(runtime_file)
            if current and healthy(int(current.get("port", 0))):
                _remember_secret(current.get("token", ""))
                if not args.no_browser:
                    url = browser_url(int(current["port"]), str(current["token"]))
                    if sys.platform == "win32" and not args.no_window:
                        desktop_shell.open_window(url, threading.Event(), force_browser=args.browser)
                    else:
                        webbrowser.open(url)
                return 0
            time.sleep(0.1)
        raise RuntimeError("已有启动进程占用单实例锁，但本地服务尚未就绪。请稍后重试；若持续出现，请关闭残留的 NEXORA 进程。") from None

    relaunch_vault: Path | None = None
    use_window = sys.platform == "win32" and not args.no_browser and not args.no_window
    try:
        web_dist = ensure_web_build()
        vault = choose_vault(args.vault)
        LOGGER.info("vault selected (path omitted from log)")
        while True:
            ensure_vault(vault)
            token = secrets.token_urlsafe(32)
            _remember_secret(token)
            sock = bind_socket(args.port)
            port = int(sock.getsockname()[1])
            requested: list[Path] = []
            app = create_app(vault, token=token, web_dist=web_dist, watch=True)
            server = make_server(app, port)
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
                LOGGER.info("local service stopped")
                if not requested:
                    return 0
                LOGGER.info("vault switch requested; restarting service")
                vault = requested[-1]
                continue

            errors: list[BaseException] = []
            server_thread = threading.Thread(target=_run_server, args=(server, sock, errors), name="nexora-server", daemon=True)
            server_thread.start()
            try:
                wait_until_healthy(port, errors=errors)
                LOGGER.info("local service ready on port %s (window mode)", port)
                stop_event = threading.Event()

                def stop_window_when_server_stops(_thread: threading.Thread = server_thread, _event: threading.Event = stop_event) -> None:
                    _thread.join()
                    _event.set()

                threading.Thread(target=stop_window_when_server_stops, daemon=True).start()
                backend_used = desktop_shell.open_window(
                    browser_url(port, token), stop_event, force_browser=args.browser,
                )
                LOGGER.info("desktop window closed (backend=%s)", backend_used)
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
                LOGGER.info("local service stopped")
                return 0
            LOGGER.info("vault switch requested; relaunching window")
            relaunch_vault = requested[-1]
            break
    except Exception as exc:
        # The full traceback goes to launcher-error.log; the routine log keeps
        # one readable line and never includes the bearer token.
        LOGGER.error("launcher failed: %s", _redact(str(exc)))
        raise
    finally:
        runtime_file.unlink(missing_ok=True)
        lock.release()
        lock_file.unlink(missing_ok=True)

    if relaunch_vault is not None:
        relaunch(relaunch_vault, state_dir, args)
    return 0


def show_error(exc: BaseException, state_dir: Path) -> None:
    state_dir.mkdir(parents=True, exist_ok=True)
    error_log = state_dir / "launcher-error.log"
    message = _redact("".join(traceback.format_exception(type(exc), exc, exc.__traceback__)))
    with contextlib.suppress(OSError, RuntimeError):
        # The traceback contains local paths; keep the diagnostic file private.
        win_acl.write_private_file(error_log, message.encode("utf-8"))
    summary = _redact(str(exc) or type(exc).__name__)
    dialog = f"{summary}\n\n详细信息已写入：{error_log}"
    try:
        from tkinter import Tk, messagebox
        root = Tk()
        root.withdraw()
        messagebox.showerror("NEXORA 无法启动", dialog)
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
