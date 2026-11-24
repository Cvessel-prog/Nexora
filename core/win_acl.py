"""Private-file permissions for local secrets on Windows and POSIX.

``os.chmod(path, 0o600)`` is a no-op for Windows DACLs.  On Windows a file can
therefore inherit (or accumulate) an empty or permissive access list even though
the Python code asks for owner-only access.  This module applies an explicit
DACL through ``icacls`` and can repair an existing file whose DACL no longer
grants the current user access, without rotating or rewriting its contents.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

_SYSTEM_SID = "*S-1-5-18"
_ADMINISTRATORS_SID = "*S-1-5-32-544"
_BROAD_SIDS = ("*S-1-1-0", "*S-1-5-11", "*S-1-5-32-545")
_CREATE_NO_WINDOW = 0x08000000
_SECURED: set[str] = set()
_USER_SID: str | None = None


def _run_icacls(path: Path, *arguments: str) -> bool:
    executable = Path(os.environ.get("SYSTEMROOT", r"C:\Windows")) / "System32" / "icacls.exe"
    if not executable.is_file():
        found = shutil.which("icacls")
        if not found:
            return False
        executable = Path(found)
    options = {"capture_output": True, "text": True, "errors": "replace", "timeout": 15}
    if os.name == "nt":
        options["creationflags"] = _CREATE_NO_WINDOW
    try:
        completed = subprocess.run([str(executable), str(path), *arguments], **options)
    except (OSError, subprocess.SubprocessError):
        return False
    return completed.returncode == 0


def current_user_sid() -> str | None:
    """Return the current process user's SID, or ``None`` when unavailable."""
    global _USER_SID
    if _USER_SID is not None:
        return _USER_SID or None
    if os.name != "nt":
        _USER_SID = ""
        return None
    executable = Path(os.environ.get("SYSTEMROOT", r"C:\Windows")) / "System32" / "whoami.exe"
    if not executable.is_file():
        _USER_SID = ""
        return None
    options = {"capture_output": True, "text": True, "errors": "replace", "timeout": 15}
    options["creationflags"] = _CREATE_NO_WINDOW
    try:
        completed = subprocess.run([str(executable), "/user", "/fo", "csv", "/nh"], **options)
    except (OSError, subprocess.SubprocessError):
        _USER_SID = ""
        return None
    if completed.returncode != 0:
        _USER_SID = ""
        return None
    # Example: "LAPTOP\zy","S-1-5-21-...-1001"
    for value in completed.stdout.replace('"', " ").replace(",", " ").split():
        if value.startswith("S-1-"):
            _USER_SID = value
            return value
    _USER_SID = ""
    return None


def _readable(path: Path) -> bool:
    try:
        with path.open("rb") as handle:
            handle.read(1)
        return True
    except OSError:
        return False


def _apply_windows_dacl(path: Path) -> bool:
    sid = current_user_sid()
    if not sid:
        return False
    path = path.resolve()
    if not _run_icacls(path, "/inheritance:r"):
        # An empty protected DACL is exactly the failure mode this repairs; the
        # owner can still replace it even when the first call reports an error.
        pass
    for broad_sid in _BROAD_SIDS:
        _run_icacls(path, "/remove:d", broad_sid)
    for trusted_sid in (_SYSTEM_SID, _ADMINISTRATORS_SID):
        _run_icacls(path, "/remove:d", trusted_sid)
    _run_icacls(path, "/remove:d", f"*{sid}")
    granted = _run_icacls(
        path,
        "/grant:r",
        f"{_SYSTEM_SID}:(F)",
        f"{_ADMINISTRATORS_SID}:(F)",
        f"*{sid}:(F)",
    )
    if not granted:
        return False
    _SECURED.add(str(path))
    return _readable(path)


def secure_private_file(path: Path) -> bool:
    """Restrict ``path`` to the current user, SYSTEM and Administrators.

    Returns ``True`` when permissions were applied and the file is readable.
    Failures are reported as ``False`` instead of raising so a cosmetic ACL
    problem cannot prevent the local service from starting.  Callers that must
    read the file use :func:`read_private_bytes`, which raises a clear error.
    """
    path = path.expanduser()
    if not path.is_file():
        return False
    if os.name != "nt":
        try:
            os.chmod(path, 0o600)
        except OSError:
            return False
        return _readable(path)
    if str(path.resolve()) in _SECURED:
        return True
    return _apply_windows_dacl(path)


def repair_private_file(path: Path) -> bool:
    """Repair a Windows DACL that no longer permits the current user to read."""
    path = path.expanduser()
    if not path.is_file():
        return False
    if os.name != "nt":
        return secure_private_file(path)
    _SECURED.discard(str(path.resolve()))
    return _apply_windows_dacl(path)


def create_private_file(path: Path, data: bytes) -> None:
    """Create ``path`` exclusively with owner-only permissions."""
    path = path.expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
    secure_private_file(path)


def write_private_file(path: Path, data: bytes) -> None:
    """Atomically replace a private file, repairing a damaged DACL first.

    Repairing the existing target is necessary on Windows: an empty protected
    DACL can make even the owner unable to replace the file.  The temporary file
    is created with owner-only permissions so the new contents are never exposed
    under the destination's previous access list.
    """
    path = path.expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and os.name == "nt" and not _readable(path) and not repair_private_file(path):
        raise RuntimeError(f"无法修复本地安全文件的访问权限：{path}")
    temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    temporary.unlink(missing_ok=True)
    create_private_file(temporary, data)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    secure_private_file(path)


def read_private_bytes(path: Path) -> bytes:
    """Read a private file, repairing an unusable Windows DACL once.

    The file is never recreated or rotated: a repair only changes its access
    list, so existing HMAC bindings and managed backups remain valid.
    """
    path = path.expanduser()
    try:
        return path.read_bytes()
    except PermissionError:
        if not repair_private_file(path):
            raise RuntimeError(
                f"无法访问本地安全文件：{path}。请以当前 Windows 用户身份运行 "
                f'icacls "{path}" /grant:r "%USERNAME%":(F) 后重试；'
                "系统不会自动更换密钥，现有备份仍然有效。"
            ) from None
        try:
            return path.read_bytes()
        except OSError as exc:
            raise RuntimeError(f"本地安全文件仍不可读：{path}（{exc.strerror or exc}）。") from exc


def ensure_private_file(path: Path, data: bytes) -> None:
    """Create the file when missing, then repair/harden its permissions."""
    path = path.expanduser()
    if not path.is_file():
        create_private_file(path, data)
    if os.name == "nt" and not _readable(path):
        repair_private_file(path)
    secure_private_file(path)


__all__ = [
    "create_private_file",
    "current_user_sid",
    "ensure_private_file",
    "read_private_bytes",
    "repair_private_file",
    "secure_private_file",
    "write_private_file",
]


if sys.platform != "win32":  # pragma: no cover - documentation helper
    _CREATE_NO_WINDOW = 0
