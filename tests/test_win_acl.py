"""Windows DACL handling for local secrets.

The regression that motivated this module: binding.key was created with
os.open(..., 0o600), which does not set a DACL on Windows.  A file whose DACL
became empty (D:PAI) denied even its owner.  Repairs must change permissions
only -- never rotate the key, because managed backups are bound to it.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))

from core import vault_management, win_acl


def _empty_dacl(path: Path) -> None:
    if os.name != "nt":
        pytest.skip("Windows DACL test")
    completed = subprocess.run(
        ["icacls", str(path), "/inheritance:r"],
        capture_output=True, text=True, errors="replace",
    )
    assert completed.returncode == 0, completed.stderr
    win_acl._SECURED.discard(str(path.resolve()))


def test_create_private_file_does_not_overwrite(tmp_path: Path) -> None:
    target = tmp_path / "secret.txt"
    win_acl.create_private_file(target, b"first")
    win_acl.create_private_file(target, b"second")
    assert target.read_bytes() == b"first"


def test_secure_private_file_is_readable_and_idempotent(tmp_path: Path) -> None:
    target = tmp_path / "secret.txt"
    target.write_bytes(b"payload")
    assert win_acl.secure_private_file(target)
    assert win_acl.secure_private_file(target)
    assert win_acl.read_private_bytes(target) == b"payload"


def test_repair_preserves_contents(tmp_path: Path) -> None:
    target = tmp_path / "binding.key"
    payload = bytes(range(32))
    target.write_bytes(payload)
    _empty_dacl(target)
    win_acl.repair_private_file(target)
    assert win_acl.read_private_bytes(target) == payload
    assert target.read_bytes() == payload


def test_write_private_file_repairs_damaged_target(tmp_path: Path) -> None:
    target = tmp_path / "providers.json"
    target.write_bytes(b"old")
    _empty_dacl(target)
    win_acl.write_private_file(target, b'{"providers":[]}')
    assert target.read_bytes() == b'{"providers":[]}'
    assert win_acl.read_private_bytes(target) == b'{"providers":[]}'


def test_local_binding_repairs_existing_key(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(vault_management, "backup_root", lambda: tmp_path / "backups")
    vault = tmp_path / "vault"
    first = vault_management._local_binding("managed-backup", vault)
    key = tmp_path / "binding.key"
    assert key.is_file()
    original = key.read_bytes()
    if os.name == "nt":
        _empty_dacl(key)
    second = vault_management._local_binding("managed-backup", vault)
    assert second == first
    assert key.read_bytes() == original
