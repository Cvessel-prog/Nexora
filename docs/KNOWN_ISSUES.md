# Known Issues

## 发布阻断/高优先级

1. **Windows runtime ACL 已加固，干净 VM 复验未完成**：`core/win_acl.py` 现在显式写入仅当前用户 SID 可访问的 DACL，并在文件被 `icacls /inheritance:r` 破坏后只修复权限、不轮换 `binding.key`；覆盖 `runtime.json`、`providers.json`、`provider-audit.jsonl`。`tests/test_win_acl.py` 已在本机通过并进入 Windows CI，但仍需在干净 VM、中文用户名和历史受管备份场景下复验。
2. **本地 E2E 环境仍未复验**：早期 Playwright Chromium 下载从 0% 多次 30 秒超时；GitHub CI 的完整 E2E 已通过，但本机下载根因仍需 R3 取证。
3. **公开 v1.0.4 GUI 启动故障的修复未随发布包验证**：窗口化 exe 中 uvicorn 默认 formatter 访问 `sys.stdout.isatty()` 的崩溃点已在源码修复（`log_config=None`、`access_log=False`），并由 `tests/test_launcher.py` 覆盖；v1.0.5 安装包尚未重新构建与实机验收。
4. **干净 VM 人工安装验收未完成**：GitHub Windows installer smoke 已通过；全新安装、升级、卸载、数据保留和异常恢复仍需 R2 的真实 VM 证据。

## 产品与 UX

5. **月度复盘无未保存离页提醒**：显式保存是正确边界，但未提交文本可能在导航/切月时丢失。依据：`docs/PHASE6_ACCEPTANCE.md`。
6. **自动本地备份未实现**：managed backup 是手动/操作触发；没有调度。
7. **AI Host 实机兼容证据有限**：stdio 协议子进程已测；历史 C4 明确测试机未安装 Claude Desktop。
8. **Obsidian integration 仅文件级**：无专用插件；这是可接受的产品决策，但“Obsidian 集成”不应被描述为完整插件体验。
9. **桌面窗口依赖可选 WebView2 运行时**：优先 pywebview/WebView2，其次 Edge `--app`，最后系统浏览器；三条路径都有自动降级，但 WebView2 缺失时的视觉差异尚未在真机截图归档。

## 工程与文档债务

10. **阶段命名仍有历史歧义**：旧 handoff 把 Phase 7/8 指向可视化/引导，后续验收把 Phase 7/8 指向 Security/Growth；历史文档已指向 `PROJECT_STATUS.md`，但阅读时仍需保留其时间语境。
11. **Frontend lint warning**：`apps/web/e2e/accessibility.spec.ts:4` 的 `shots` 未使用。
12. **Frontend bundle warning**：production 主 JS 约 568 kB，超过 Vite 500 kB warning 阈值；应以真实启动性能决定是否分包。
13. **MCP 只有 Tools**：没有 Resources/Prompts；当前是明确非目标，不应宣称完整 MCP surface。
14. **审计链无外部锚定**：本地可发现篡改并 fail closed，但无法独立证明删除全部本地状态前的历史；Local-first V0.1 的刻意限制。
