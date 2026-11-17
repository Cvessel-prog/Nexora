# NEXORA v1.0.4 Release Hardening Plan

状态：**计划已建立，执行待人工确认**  
基线：`main@8862bd5`，2026-11-17，Windows 本地工作区干净并与 `origin/main` 一致  
目标：为“可靠稳定版”建立可重复、可审计的真实环境证据；本阶段不开发 NEXORA v1.1 功能。

## 执行规则

- 不访问私人 Vault；全部测试使用 `TemporaryDirectory` 或专用合成 Vault。
- 先保存环境、命令、原始结果和失败证据，再讨论修复。
- 不以跳过、弱化断言、扩大超时掩盖产品缺陷。
- 每个 R 阶段独立验收；没有真实证据即标记 `未验证`。
- 修复前重新检查 Git 状态；不自动 commit、push、merge。

## 依赖关系

```text
R1 Windows security ───────┐
                           ├─> R2 installer acceptance ──┐
R3 Playwright E2E ─────────┤                              ├─> Release readiness decision
R4 PR/docs closure ────────┤                              │
R5 MCP protocol simulation ──> R5 real-host matrix ──────┘
```

- R1 必须先定义 runtime/token/log/temp 的权限判据，R2 才能验证安装后状态。
- R2 的升级测试需要两个明确版本的安装包；至少使用 v1.0.4 与候选构建。
- R3 可与 R1 并行，但 E2E 结论必须包含浏览器来源和缓存证据。
- R4 的文档结论依赖 R1–R3、R5 的真实结果，不能提前写成通过。
- R5 协议模拟可先执行；真实客户端验证依赖客户端已安装且版本可记录。

## R1 — Windows Security Validation

状态：`未开始`  
环境：Windows 11/Windows Server；NTFS；至少两个非管理员本地用户；Python 源码运行与安装版各一轮。

### 判据与命令

1. 记录当前 SID、文件所有者、继承和 ACL：
   `whoami /user`、`Get-Acl`、`icacls <path>`。
2. 覆盖 launcher runtime JSON/lock、token 所在载体、日志、临时目录、应用数据 registry、managed backup metadata。
3. User A 创建并运行；User B 尝试读取/修改/删除 User A 的 runtime、token、日志及应用数据。预期 fail closed。
4. 以非管理员用户执行初始化、Vault A→B 切换、正常 shutdown、强制终止、再次启动与 transaction/recovery 检查。
5. 检查文件是否继承 `Users`/`Authenticated Users` 的意外写权限；Windows 上不能把 `chmod 0600` 当作 ACL 证据。

### 交付证据

- 每类文件的绝对类别（路径需脱敏）、owner、ACL、创建主体和跨用户访问结果。
- 正常关闭与异常终止后的残留文件、下次启动行为、进程退出码和日志。
- 修复建议按最小范围分类：installer ACL、launcher 创建时 ACL、日志位置/脱敏、测试覆盖。

人工验收：**需要**。多用户隔离需要真实双用户 Windows 环境。

## R2 — Windows Installer Validation

状态：`未开始，依赖 R1 判据`  
环境：干净 Windows 11 VM 快照、普通用户、无预装 Python/Node；另准备 v1.0.4 和候选安装包及 SHA-256。

执行顺序：快照→全新安装→首次启动→合成 Vault→Web/API→关闭→重启→升级→数据一致性→卸载→数据保留→重装恢复→损坏/中断安装恢复。

验证命令包括 `Get-FileHash`、`Get-AuthenticodeSignature`、`Get-Process`、loopback health probe、`icacls`、卸载注册表项检查。详细记录模板见 `INSTALLER_ACCEPTANCE.md`。

人工验收：**需要**。安装 UI、UAC/SmartScreen、应用和功能、升级/卸载行为必须观察。

## R3 — Playwright E2E

状态：`待本机复验；CI 当前通过`  
已知事实：`@playwright/test 1.65.0`；Chromium 由 `npx playwright install --with-deps chromium` 安装；测试服务器为 `tests/e2e_web_server.py`，固定 `127.0.0.1:8766`，单 worker，无显式 Playwright timeout 覆盖。

调查顺序：

1. `npx playwright --version`、`npx playwright install --list`、检查 `%LOCALAPPDATA%\ms-playwright` 和 `PLAYWRIGHT_BROWSERS_PATH`。
2. 保存 CDN/代理/DNS/TLS/吞吐证据；区分“下载超时”和“测试超时”。
3. 优先复用匹配 revision 的缓存；不手工复制不匹配浏览器。
4. 单独启动 `python ../../tests/e2e_web_server.py` 验证 health、端口占用和清理，再由 Playwright 管理启动。
5. 执行 `npm run e2e` 全量 17 项；保存 HTML/trace/screenshot（仅失败时）和退出码。
6. CI 继续使用官方安装命令；如需缓存，只缓存 Playwright browser revision，并以 lockfile/hash 为 key。

人工验收：本地下载失败根因需要网络/代理所有者确认；测试本身不需要人工判定。

## R4 — PR 和文档收口

状态：`完成`。

- #47：E2E locator/focus race；重跑全绿，已合并。
- #48：drawer focus；全绿，已合并。
- #52：launcher shutdown timeout；失败为 runner communication/旧 10 秒等待，重跑全绿，已合并。
- #53：API/规划文档/CI timeout；全绿，已合并。
- 当前开放 PR：0。

`PROJECT_STATUS.md` 已更新到 `main@8862bd5`，移除旧开放 PR 和过期测试结论并修复格式错误。历史 Phase 文档保留历史语义并指向权威状态文件。FastAPI 源码清点得到 103 个 `/api/v1` routes；`LOCAL_API.md` 覆盖该清单（`memories?status=candidate` 是 `/api/v1/memories` 的查询示例）。

人工验收：需要确认历史文档保留策略和最终 release wording。

## R5 — AI 客户端兼容性

状态：`协议模拟已有证据；真实客户端未验证`。

先执行公共协议矩阵：initialize、tools/list、受权调用、缺 scope、错误/旧 token、Vault identity mismatch、撤销、重签、删除、多客户端隔离。然后分别在 Claude Desktop、Codex、Cursor、VS Code 上验证真实 Host 启动、工具发现和调用。

真实客户端不可安装时必须标记 `Blocked/Not tested`，不能以模拟测试替代。详细矩阵见 `MCP_COMPATIBILITY_MATRIX.md`。

## 阶段出口

只有 `RELEASE_READINESS_CHECKLIST.md` 中所有 P0 门禁有当前证据且无未接受的高风险缺陷，才能宣布可靠稳定版。下一里程碑名称建议为 **NEXORA v1.1 — Stable User Experience**，但仅在本 hardening 结论通过后启动。

