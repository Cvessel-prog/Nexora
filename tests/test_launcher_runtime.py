"""Launcher startup and recovery boundaries.

These tests cover the failure paths that a packaged windowed build cannot show
on stdout: a busy port, a folder that is not a Vault, a stale runtime file and
the always-on launcher log.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))

import launcher
from core import profile


def test_bind_socket_reports_port_conflict() -> None:
    occupied = launcher.bind_socket(0)
    port = int(occupied.getsockname()[1])
    try:
        with pytest.raises(RuntimeError, match="已被其他程序占用"):
            launcher.bind_socket(port)
    finally:
        occupied.close()


def test_bind_socket_zero_selects_a_free_port() -> None:
    sock = launcher.bind_socket(0)
    try:
        assert int(sock.getsockname()[1]) > 0
    finally:
        sock.close()


def test_ensure_vault_creates_template(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    launcher.ensure_vault(vault)
    assert (vault / "90 System").is_dir()
    launcher.ensure_vault(vault)  # idempotent for an existing Vault


def test_ensure_vault_rejects_foreign_folder(tmp_path: Path) -> None:
    folder = tmp_path / "Documents"
    folder.mkdir()
    (folder / "notes.txt").write_text("not a vault", encoding="utf-8")
    with pytest.raises(RuntimeError, match="不是 NEXORA Vault"):
        launcher.ensure_vault(folder)


def test_ensure_vault_rejects_file(tmp_path: Path) -> None:
    target = tmp_path / "vault.md"
    target.write_text("file", encoding="utf-8")
    with pytest.raises(RuntimeError, match="不是文件夹"):
        launcher.ensure_vault(target)


def test_ensure_vault_rejects_old_schema(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    profile.init(str(vault))
    config = vault / "profile.config.yml"
    text = config.read_text(encoding="utf-8")
    config.write_text(text.replace("schema_version: 1", "schema_version: 99"), encoding="utf-8")
    with pytest.raises(RuntimeError, match="版本为 99"):
        launcher.ensure_vault(vault)


def test_read_runtime_ignores_damaged_file(tmp_path: Path) -> None:
    runtime = tmp_path / "runtime.json"
    runtime.write_text("{not json", encoding="utf-8")
    assert launcher.read_runtime(runtime) is None


def test_wait_until_healthy_reports_server_error() -> None:
    errors: list[BaseException] = [OSError("bind failed")]
    with pytest.raises(RuntimeError, match="bind failed"):
        launcher.wait_until_healthy(1, timeout=0.1, errors=errors)


def test_configure_logging_writes_no_token(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    token = "token-that-must-never-appear"
    monkeypatch.setattr(launcher.secrets, "token_urlsafe", lambda _size: token)
    launcher.configure_logging(tmp_path)
    launcher.LOGGER.info("local service ready on port %s", 12345)
    text = (tmp_path / "launcher.log").read_text(encoding="utf-8")
    assert "ready on port 12345" in text
    assert token not in text


def test_redact_removes_registered_token() -> None:
    launcher._remember_secret("secret-token-value")
    assert launcher._redact("http://127.0.0.1/#token=secret-token-value") == "http://127.0.0.1/#token=[redacted]"


def test_server_config_survives_windowed_process(monkeypatch: pytest.MonkeyPatch) -> None:
    # PyInstaller console=False gives the process no stdout/stderr.  Uvicorn's
    # default formatter calls sys.stdout.isatty() and crashes in that state.
    monkeypatch.setattr(sys, "stdout", None)
    monkeypatch.setattr(sys, "stderr", None)
    server = launcher.make_server(object(), 0)
    server.config.configure_logging()
    assert server.config.log_config is None
    assert server.config.access_log is False
    assert server.config.timeout_graceful_shutdown == 5


def test_runtime_directory_is_user_scoped(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    assert launcher.runtime_directory() == tmp_path / "PersonalAIProfile"


def test_default_vault_is_user_scoped(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    monkeypatch.setenv("HOME", str(tmp_path))
    assert launcher.default_vault() == (tmp_path / "Nexora" / "vault" / "my-ai-profile").resolve()


def test_runtime_file_is_private_and_parseable(tmp_path: Path) -> None:
    runtime = tmp_path / "runtime.json"
    launcher.write_runtime(runtime, port=1234, token="secret-token", vault=tmp_path / "vault")
    data = json.loads(launcher.win_acl.read_private_bytes(runtime).decode("utf-8"))
    assert data["port"] == 1234
    assert data["token"] == "secret-token"
