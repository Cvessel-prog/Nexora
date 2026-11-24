# Project Status

Last verified: 2026-11-24（Asia/Shanghai）
Code baseline: `main@3cfa973` · Public release: `v1.0.4` · `/api/v1` routes: 104

## Current phase

NEXORA has completed its principal local-first product loops and is in **Release Hardening**. Memory lifecycle, profile, monthly reflection, Human 3.0/Growth, Security Center, MCP, AI Connections, provider authorization, import, managed backups, Git history/restore, GitHub Device Flow/private verification, Windows launcher and installer automation all have real implementations and automated coverage.

The 2026-11-18 hardening pass is **merged** (PR #58, `fix/desktop-ux-hardening`) and brings:

- a native desktop window host (`desktop_shell.py`) using pywebview/WebView2 when available, then Edge `--app`, then the system browser;
- `core/win_acl.py` repairing damaged DACLs for `binding.key`, `runtime.json`, `providers.json` and `provider-audit.jsonl` without rotating `binding.key`;
- a consolidated nine-entry navigation with hub tabs, a Settings page, and a persistent concept map;
- launcher startup hardening: token-free `launcher.log`, actionable port-conflict and Vault-validation errors, Windows exclusive port binding, crash recovery.

Internationalisation is complete across the workspace: `zh-CN` and `English` cover the navigation,
topbar, concepts, settings, and every page body. Both directions are covered by tests.

## Capability status

- **Implemented:** Vault create/validate/register/restart-switch, resident external-edit monitoring, memory lifecycle, profile, conversational onboarding, monthly reflection, Human 3.0, Growth, Security Center, AI Connections, provider authorization, import, managed backups, Git history/restore, GitHub Device Flow/private verification, Windows launcher and installer build/smoke automation, native desktop window host, Windows ACL repair, Settings page, concept map, full UI localisation.
- **Partial or deliberately limited:** Obsidian is an optional file editor rather than a required plugin; MCP currently exposes Tools but not Resources/Prompts; provider support is limited to the implemented adapters; scheduled backup is not implemented.
- **Release-hardening work:** real NTFS ACL / multi-user evidence, clean-VM installer acceptance, local Playwright environment validation, real MCP client matrix, rebuilt installer verification, and final release documentation.

## Current automated evidence (2026-11-24)

- Python script suite: all runnable `tests/test_*.py` scripts pass (30/30), including `test_local_api.py`, `test_windows_acl.py`, `test_desktop_shell.py` and `test_launcher_runtime.py`.
- Frontend: `tsc --noEmit` passes, **30/30** Vitest tests pass, `npm run build` passes, Ruff passes with one pre-existing unused-variable warning.
- **Local Playwright E2E still does not run locally.** The Playwright Chromium download does not complete in this environment (the cached browser build does not match the installed Playwright version and the CDN does not resume). CI runs E2E on GitHub-hosted runners; that is the source of truth for E2E.

## GitHub status

- Open pull requests: **1** — PR #57 (`fix/windows-private-acl`). It predates PR #58 and **currently conflicts with `main`**; PR #58 already landed `core/win_acl.py` and the desktop shell, so #57 needs a rebase or a decision to close it.
- `main` is protected and requires pull requests.

## Open release-hardening issues

| Issue | Priority | Topic |
|---|---|---|
| #60 | P0 | Consolidate Windows ACL security implementation (blocks #61, #62) |
| #61 | P0 | Verify Windows multi-user data isolation |
| #62 | P0 | Complete Windows installer upgrade acceptance |
| #63 | P1 | Redesign first-run onboarding |
| #64 | P1 | Improve Overview dashboard |
| #65 | P2 | Protect unsaved changes in Monthly Reflection |
| #66 | P2 | Establish MCP host compatibility matrix |
| #67 | P3 | Implement scheduled backup and recovery |

## Ready-to-submit branches

Both branches below are based on `main@3cfa973` (with `origin/main` merged) and verified locally.

| Branch | Commits | Contents |
|---|---|---|
| `docs/api-and-ci-hygiene` | 13 ahead | Full UI localisation (872 keys × 2 languages, 14 pages); `LOCAL_API.md` refreshed to the 104-route inventory; historical planning docs annotated; CI `timeout-minutes` on every job. |
| `fix/vault-monitor-leak` | 1 ahead | Stop the resident Vault watcher on app shutdown, plus a regression test. |

## Documentation authority

This file is the current capability-status authority. Historical Phase, planning and acceptance documents
preserve their original context; their historical “not implemented” or “complete” statements must not
override current code and current evidence. The FastAPI source currently defines 104 `/api/v1` routes,
and `LOCAL_API.md` was checked against that inventory.

## Workspace note

Two local branches are prepared and verified against `main@3cfa973`; see “Ready-to-submit branches”.
Nothing is pushed automatically.
