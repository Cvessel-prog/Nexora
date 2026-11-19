# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Personal AI Profile Windows app.

Bundle the launcher, the FastAPI backend, the built React frontend, and the
empty Vault template into a single onedir application.
"""

from pathlib import Path

ROOT = Path(SPECPATH).resolve().parents[1]  # packaging/windows -> repo root

datas = [
    (str(ROOT / "template"), "template"),
    (str(ROOT / "apps" / "web" / "dist"), "apps/web/dist"),
]

hiddenimports = [
    "anyio._backends._asyncio",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "webview.platforms.edgechromium",
    "webview.platforms.winforms",
    "clr",
    "pythonnet",
]

binaries = []
try:
    # The desktop host is optional: without pywebview the launcher falls back to
    # an Edge app window. When it is installed, bundle its WebView2 assemblies.
    from PyInstaller.utils.hooks import collect_all

    webview_datas, webview_binaries, webview_hidden = collect_all("webview")
    datas += webview_datas
    binaries += webview_binaries
    hiddenimports += webview_hidden
except Exception:
    pass

a = Analysis(
    [str(ROOT / "launcher.py")],
    pathex=[str(ROOT)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter.test", "tkinter.ttk"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="personal-ai-profile",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="personal-ai-profile",
)
