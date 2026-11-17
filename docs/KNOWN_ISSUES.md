# Known Issues

## 发布阻断/高优先级

1. **Windows runtime ACL 未验证**：代码尝试 `chmod 0600`，但 Windows ACL 语义没有证据；涉及本地 token/runtime metadata。
2. **本地 E2E 环境仍未复验**：早期 Playwright Chromium 下载从 0% 多次 30 秒超时；GitHub CI 的完整 E2E 已通过，但本机下载根因仍需 R3 取证。
3. **干净 VM 人工安装验收未完成**：GitHub Windows installer smoke 已通过；全新安装、升级、卸载、数据保留和异常恢复仍需 R2 的真实 VM 证据。

## 产品与 UX

4. **月度复盘无未保存离页提醒**：显式保存是正确边界，但未提交文本可能在导航/切月时丢失。依据：`docs/PHASE6_ACCEPTANCE.md`。
5. **自动本地备份未实现**：managed backup 是手动/操作触发；没有调度。
6. **AI Host 实机兼容证据有限**：stdio 协议子进程已测；历史 C4 明确测试机未安装 Claude Desktop。
7. **Obsidian integration 仅文件级**：无专用插件；这是可接受的产品决策，但“Obsidian 集成”不应被描述为完整插件体验。

## 工程与文档债务

8. **阶段命名仍有历史歧义**：旧 handoff 把 Phase 7/8 指向可视化/引导，后续验收把 Phase 7/8 指向 Security/Growth；历史文档已指向 `PROJECT_STATUS.md`，但阅读时仍需保留其时间语境。
9. **Frontend lint warning**：`apps/web/e2e/accessibility.spec.ts:4` 的 `shots` 未使用。
10. **Frontend bundle warning**：production 主 JS 534.37 kB，超过 Vite 500 kB warning 阈值；应以真实启动性能决定是否分包。
11. **MCP 只有 Tools**：没有 Resources/Prompts；当前是明确非目标，不应宣称完整 MCP surface。
12. **审计链无外部锚定**：本地可发现篡改并 fail closed，但无法独立证明删除全部本地状态前的历史；Local-first V0.1 的刻意限制。
