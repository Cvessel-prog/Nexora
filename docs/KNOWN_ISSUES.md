# Known Issues

## 发布阻断/高优先级

1. **Windows runtime ACL 未验证**：代码尝试 `chmod 0600`，但 Windows ACL 语义没有证据；涉及本地 token/runtime metadata。
2. **本轮 E2E 未执行**：Playwright Chromium 下载从 0% 多次 30 秒超时；这不是测试失败，但当前机器没有浏览器级回归证据。
3. **开放修复尚未进入 main**：#52 shutdown timeout、#48 drawer focus、#47 E2E locator、#53 文档/API/CI 清理位于开放 PR，不能按已完成计算。
4. **Windows installer 未在本轮 smoke**：工作流存在且历史文档声称通过，但本轮只验证 launcher；需要干净 VM 的 build/install/start/uninstall 证据。

## 产品与 UX

5. **月度复盘无未保存离页提醒**：显式保存是正确边界，但未提交文本可能在导航/切月时丢失。依据：`docs/PHASE6_ACCEPTANCE.md`。
6. **自动本地备份未实现**：managed backup 是手动/操作触发；没有调度。
7. **AI Host 实机兼容证据有限**：stdio 协议子进程已测；历史 C4 明确测试机未安装 Claude Desktop。
8. **Obsidian integration 仅文件级**：无专用插件；这是可接受的产品决策，但“Obsidian 集成”不应被描述为完整插件体验。

## 工程与文档债务

9. **阶段命名冲突/文档漂移**：旧 handoff 把 Phase 7/8 指向可视化/引导，后续验收把 Phase 7/8 指向 Security/Growth；历史“未实现”文字与当前代码冲突。
10. **Frontend lint warning**：`apps/web/e2e/accessibility.spec.ts:4` 的 `shots` 未使用。
11. **Frontend bundle warning**：production 主 JS 534.37 kB，超过 Vite 500 kB warning 阈值；应以真实启动性能决定是否分包。
12. **MCP 只有 Tools**：没有 Resources/Prompts；当前是明确非目标，不应宣称完整 MCP surface。
13. **审计链无外部锚定**：本地可发现篡改并 fail closed，但无法独立证明删除全部本地状态前的历史；Local-first V0.1 的刻意限制。
14. **根仓库此前无 AGENTS.md**：本轮新增开发纪律文件，尚未提交。
