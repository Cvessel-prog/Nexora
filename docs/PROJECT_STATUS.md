# Project Status

Last verified: 2026-11-18（Asia/Shanghai）
Code baseline: `main@8862bd5` · Public release: `v1.0.4` · Desktop/ACL/IA hardening present as uncommitted working-tree changes.

## Current phase

NEXORA has completed its principal local-first product loops and is in **Release Hardening**. Memory lifecycle, profile, monthly reflection, Human 3.0/Growth, Security Center, MCP, AI Connections, provider authorization, backup/recovery, private GitHub connection, Windows launcher and installer automation all have real implementations and automated coverage.

The 2026-11-18 hardening pass adds three product-level fixes: a real desktop window with WebView2 → Edge `--app` → browser fallback, DACL repair for `binding.key`/runtime/provider state, and a consolidated nine-entry navigation with hub tabs, a Settings page, and a persistent concept map. D1-0 additionally hardens startup: launcher.log without tokens, actionable port-conflict and Vault-validation errors, Windows exclusive port binding, and crash-recovery coverage. See `docs/desktop-experience/D1_0_RUNTIME_STABILIZATION.md`.

It is not yet classified as a fully validated stable release. Remaining release gates are real NTFS ACL and multi-user evidence, clean-VM install/upgrade/uninstall/recovery, local Playwright download-root-cause reproduction, a rebuilt installer carrying the windowed-exe startup fix, and a real MCP host compatibility baseline. See `RELEASE_READINESS_CHECKLIST.md`.

## Capability status

- **Implemented:** Vault create/validate/register/restart-switch, resident external-edit monitoring, memory lifecycle, profile, conversational onboarding, monthly reflection, Human 3.0, Growth, Security Center, AI Connections, provider authorization, import, managed backups, Git history/restore, GitHub Device Flow/private verification, Windows launcher and installer build/smoke automation.
- **Desktop and recovery hardening (uncommitted):** native window host (`desktop_shell.py`) using pywebview/WebView2 when available, Edge `--app` second, system browser last; relaunch after Vault switch; crash traceback in windowed mode; runtime token kept out of argv; `core/win_acl.py` repairs damaged DACLs without rotating `binding.key` and now covers `runtime.json`, `providers.json` and `provider-audit.jsonl`.
- **Information architecture (uncommitted):** nine navigation entries; Memory/Reflection/Growth/Data/Connections own hub tabs; Settings page centralizes language, contrast, Vault, backup/provider/GitHub/authorization status; a shared concept map explains Vault, Obsidian, snapshots, GitHub backup, MCP and Provider boundaries from every surface.
- **Partial or deliberately limited:** Obsidian is an optional file editor rather than a required plugin; MCP currently exposes Tools but not Resources/Prompts; provider support is limited to the implemented adapters; scheduled backup is not implemented.
- **Release-hardening work:** Windows ACL/multi-user validation, clean-VM installer acceptance, local Playwright environment validation, real MCP client matrix, rebuilt installer verification, and final release documentation.

## Current automated evidence

- Python script suite: all runnable `tests/test_*.py` scripts passed on 2026-11-18, including `test_local_api.py` with the native folder picker boundary mocked (a real Tk modal cannot run under TestClient). `test_release_packaging.py` was not rerun in this pass.
- Python pytest: `pytest -q` → 28 passed on 2026-11-18, including `tests/test_win_acl.py`, `tests/test_desktop_shell.py` and `tests/test_launcher_runtime.py`. The new files are wired into the Windows CI job.
- Launcher integration passes first start, duplicate start, Vault switch, graceful shutdown, hard-kill recovery and token-free log checks. Installer contract tests confirm per-user install, lowest privileges, no `[UninstallDelete]`, and no Vault path in the installer.
- Frontend unit: 29/29 tests passed; TypeScript (`tsc --noEmit`) and production build passed.
- Lint: exit 0 with one existing unused-variable warning in `apps/web/e2e/accessibility.spec.ts:4`.
- Ruff, release privacy gate and `pip-audit`: passed during the 2026-11-17 audit; not all were rerun on 2026-11-18.
- MCP protocol/security, security lifecycle, provider target binding, backup, GitHub and launcher tests passed.
- GitHub CI after PR closure: smoke, Windows clean, Playwright E2E and Windows installer smoke all passed on the merged changes. The new uncommitted hardening has not yet run in CI.
- Local Playwright: the earlier Chromium download attempt timed out before tests started. CI success does not close the local download-root-cause task.
- Clean Windows VM manual installer acceptance and NTFS ACL/multi-user validation: not yet performed. The public v1.0.4 installer still predates the windowed-stdout fix; it has not been rebuilt as v1.0.5.

## GitHub status

- PRs #47, #48, #52 and #53 were reviewed, rerun where necessary, passed CI and were merged.
- Dependency PR #43 and provider authorization PR #55 also passed CI and were merged.
- Open pull requests at this verification point: **0**.
- `main` is protected and requires pull requests.

## Documentation authority

This file is the current capability-status authority. Historical Phase, planning and acceptance documents preserve their original context; their historical “not implemented” or “complete” statements must not override current code and current evidence. The FastAPI source currently defines 103 `/api/v1` routes, and `LOCAL_API.md` was checked against that inventory during R4.

## Workspace note

The 2026-11-18 desktop/ACL/IA hardening is present only in the local working tree; it has not been committed, pushed, released or merged. The Release Hardening planning and R4 documentation closure described earlier changed only project documentation. Their Git publication state is determined by the repository history rather than this status snapshot.
