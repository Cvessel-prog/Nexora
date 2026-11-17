# NEXORA Codex development discipline

1. Read `docs/PROJECT_CONTEXT.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/KNOWN_ISSUES.md` before changing behavior.
2. Treat the Markdown Vault as the primary data source. Never read, copy, test against, commit, or publish a real private Vault; use temporary synthetic Vaults only.
3. Keep the public source repository and every private Vault strictly separated. Obsidian is optional; the Web application is the primary product surface.
4. Put domain behavior in `core/`. Frontend, FastAPI, CLI, launcher, legacy review UI, and MCP are adapters and must not duplicate domain or access-policy logic.
5. Preserve human confirmation boundaries. AI/MCP may propose candidate memories but cannot confirm, reject, delete, publish, or silently promote them.
6. Enforce `allowed`, `summary-only`, `local-only`, and `denied` server-side. Missing or invalid access metadata fails closed. Vault identity mismatch fails closed.
7. Keep FastAPI loopback-only, require its bearer session outside health checks, never log credentials, and keep provider calls opt-in with exact preview and per-call approval.
8. Check `git status`, both diffs, branches, and remotes before editing. Never overwrite unrelated uncommitted work. Do not commit, push, merge, release, or modify Issues/PRs without explicit instruction.
9. For behavior changes, update tests and the relevant contract/status documents in the same change. Run Python scripts, Ruff, frontend lint/typecheck/unit/build/E2E, MCP/security lifecycle, launcher, release gates, and applicable Windows packaging checks.
10. Report observed facts separately from historical claims. A phase document saying “complete” is not proof; current code and current test results are authoritative.
