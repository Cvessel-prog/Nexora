"""Static installer contracts for per-user install and data preservation.

The Windows acceptance runs happen in a VM, but these invariants must not
regress silently in the meantime: the installer stays per-user, never ships or
deletes a private Vault, and never removes runtime state on uninstall.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))

INSTALLER = ROOT / "packaging" / "windows" / "installer.iss"


def main() -> None:
    text = INSTALLER.read_text(encoding="utf-8")
    assert "PrivilegesRequired=lowest" in text, "installer must remain per-user"
    assert "DefaultDirName={localappdata}" in text, "install into the current user's profile"
    assert "[UninstallDelete]" not in text, "uninstall must not delete user data"
    assert "[UninstallRun]" not in text, "uninstall must not run Vault cleanup"
    assert "{userdocs}" not in text and "{documents}" not in text, "installer must not target the Vault location"
    assert "Source: \"..\\..\\dist\\personal-ai-profile\\*\"" in text, "only the packaged app is installed"

    launcher = (ROOT / "launcher.py").read_text(encoding="utf-8")
    assert "SO_EXCLUSIVEADDRUSE" in launcher, "Windows port conflicts must be detected, not hijacked"
    assert "log_config=None" in launcher, "windowed uvicorn must not use the stdout formatter"
    assert "launcher.log" in launcher
    assert (ROOT / "desktop_shell.py").is_file()
    assert (ROOT / "requirements-desktop.txt").is_file()

    spec = (ROOT / "packaging" / "windows" / "personal-ai-profile.spec").read_text(encoding="utf-8")
    assert "collect_all(\"webview\")" in spec, "desktop host assemblies must be bundled when available"
    assert "console=False" in spec, "the GUI build must not allocate a console"

    print("installer and launcher contract tests passed")


if __name__ == "__main__":
    main()
