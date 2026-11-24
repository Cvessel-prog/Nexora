# NEXORA D1-0：Windows Desktop Runtime Stabilization

记录时间：2026-11-18（Asia/Shanghai）
工作分支：`fix/desktop-ux-hardening`（基于 `a0cd387`）
证据范围：本机 Windows（10.0.26200，x64，非提升进程）、自动化测试、源码检查。

> 说明：任务书列出的 `docs/desktop-experience/DESKTOP_UX_AUDIT.md`、`DESKTOP_REDESIGN_PLAN.md`、`DESKTOP_ACCEPTANCE_CRITERIA.md` 在当前工作区和仓库中均不存在。本阶段的判断以 `docs/PROJECT_STATUS.md`、`docs/KNOWN_ISSUES.md`、`docs/ARCHITECTURE.md`、`docs/WINDOWS_LAUNCHER.md`、`docs/WINDOWS_INSTALLER.md`、`docs/RELEASE_READINESS_CHECKLIST.md` 和当前代码/测试为准，没有臆造 D0 结论。

## 1. 根因分析

### 1.1 公开 v1.0.4 安装包无法正常启动

已确认的直接崩溃点：

- 安装包由 PyInstaller `console=False` 构建，窗口化进程的 `sys.stdout` / `sys.stderr` 为 `None`。
- 项目锁定 `uvicorn 0.54.0`。其 `ColourizedFormatter.__init__` 在未显式传入 `use_colors` 时执行 `self.use_colors = sys.stdout.isatty()`。
- 默认 uvicorn 日志配置会实例化该 formatter，因此在服务真正开始监听前抛出 `AttributeError: 'NoneType' object has no attribute 'isatty'`。
- 源码中已用 `uvicorn.Config(..., log_config=None, access_log=False)` 绕开默认 formatter；窗口化启动另加服务线程、健康等待和异常日志。修复位于 `launcher.py`。
- 公开 v1.0.4 构建早于该修复，所以“源码已修复”不等于“已发布安装包可用”。v1.0.5 尚未重建。
- 对 tag `v1.0.4` 的源码复核：`launcher.py` 中 `uvicorn.Server(uvicorn.Config(app, host=HOST, port=port, log_level="warning"))` 未传 `log_config`；`write_runtime` 仅 `os.chmod(0o600)`；`show_error` 只是写日志并尝试弹 Tk 窗口。未捕获的 formatter 异常因此可能表现为“点了没反应”或只有一条错误日志。

观察到的相关启动风险（已一并处理）：

- v1.0.4 形态下首次启动可能弹出 Tk 文件夹选择框；在无桌面/受限会话中会阻塞或抛错。现在默认 Vault 自动创建，不再把文件对话框放在服务启动前。
- 选到非 Vault 的非空文件夹时，旧逻辑会照常启动，随后在 UI/API 层失败。现在启动前给出单条可操作错误。
- Windows 上 `SO_REUSEADDR` 允许绑定已被其他进程监听的端口，导致冲突被“成功”掩盖。现在使用 `SO_EXCLUSIVEADDRUSE`，冲突会显式失败并提示。
- 压测下发现关闭可能被 HTTP keep-alive 连接拖住。Uvicorn 现设 `timeout_graceful_shutdown=5`，窗口关闭或“关闭服务”不会无限等待。

### 1.2 binding.key ACL 拒绝访问

根因链：

1. `os.open(key_file, O_CREAT | O_EXCL, 0o600)` 在 Windows 上只影响只读位，不会创建 DACL；文件继承所在目录的 ACL。
2. 一旦目录/文件 DACL 被清空或保护为空（例如 `icacls <file> /inheritance:r` 后没有 ACE），连文件所有者也会被拒绝访问。
3. 原代码用 `os.chmod(0o600)` 尝试加固，但 chmod 在 Windows 不修复 DACL，因此读取 `binding.key` 时抛 `PermissionError`。
4. 受管备份的绑定依赖这把 key；重新生成 key 会让既有备份无法再验证。因此修复必须“只改权限、不改内容”。

现状：

- `core/win_acl.py` 通过 `whoami /user` 取得当前用户 SID，使用 `icacls /inheritance:r`、移除宽泛/拒绝 ACE、再 `grant:r` 当前用户 + SYSTEM + Administrators 全控制。
- 读取失败时先尝试修复 DACL，再读原文件；不重建、不轮换 key。
- 覆盖 `binding.key`、`runtime.json`、`providers.json`、`provider-audit.jsonl`、`launcher-error.log`。
- 本机实测（非提升进程，当前用户）：`binding.key`、`runtime.json`、`provider-audit.jsonl` 均为非继承 DACL，仅 SYSTEM / Administrators / 当前用户；`providers.json` 继承自已加固的目录，同样只有这三类主体。没有 Every/Users/Authenticated Users。

## 2. 修改文件清单

本阶段（未提交）：

- `launcher.py`：启动日志、端口冲突友好错误、Windows 独占端口、Vault 启动前校验、runtime 读取走 ACL 修复路径、错误弹窗给出日志位置、失败日志脱敏（不写 token）、关闭超时上限 5 秒。
- `tests/test_launcher_runtime.py`（新增）：端口冲突、Vault 校验、旧 schema、损坏 runtime、健康等待错误、窗口化 `sys.stdout=None` 回归、日志/错误脱敏、用户级 runtime 与 Vault 路径、runtime 私密写入。
- `tests/test_installer_contract.py`（新增）：按用户安装、最低权限、不得卸载删除用户数据、不把 Vault 作为安装目标、窗口化构建与桌面依赖契约。
- `tests/test_launcher.py`：日志断言、硬终止后 stale runtime/lock 的恢复场景。
- `.github/workflows/test.yml`：新增 pytest 文件与 installer contract 测试。

已在前一提交 `a0cd387` 中、属于 D1 范围：

- `desktop_shell.py`：WebView2 → Edge `--app` → 系统浏览器三级降级。
- `core/win_acl.py`：DACL 创建、修复、ACL 感知读写。
- `core/provider_auth.py`、`core/vault_management.py`：私有文件读写接入 ACL 助手。
- `packaging/windows/personal-ai-profile.spec`、`scripts/build_windows.ps1`、`requirements-desktop.txt`、`.github/workflows/release.yml`：桌面依赖与打包。
- `docs/ARCHITECTURE.md`、`docs/DECISIONS.md`、`docs/KNOWN_ISSUES.md`、`docs/PROJECT_STATUS.md`：架构与状态同步。

## 3. 架构与运行流程

```text
personal-ai-profile.exe (PyInstaller onedir, console=False)
        │
        ▼
launcher.py
  1. %LOCALAPPDATA%\PersonalAIProfile 建立 runtime 目录与 launcher.log
  2. 单实例锁 launcher.lock
  3. 定位/创建 Vault（默认 ~\Nexora\vault\my-ai-profile）
  4. 校验 Vault schema，读取已存在的 Vault
  5. SO_EXCLUSIVEADDRUSE 绑定 127.0.0.1（默认随机端口）
  6. 生成一次性 bearer token（只写入受保护 runtime.json 与 URL fragment）
  7. 启动 uvicorn：log_config=None, access_log=False
  8. 健康检查通过后：WebView2 窗口 / Edge app / 系统浏览器
  9. 原生窗口关闭 → 停止服务；浏览器模式 → 由界面“关闭服务”
 10. 退出：删除 runtime.json、释放锁、保留 launcher.log
```

异常路径：

- 第二个实例：拿不到锁时读取现有 `runtime.json`，健康则复用并打开窗口；不健康则在 5 秒后给出“已有进程但服务未就绪”的提示。
- 端口冲突：`bind()` 失败即给出中文提示，建议关闭占用程序或不指定 `--port`。
- 服务异常：服务线程收集异常，健康等待立即失败，`launcher-error.log` 保存 traceback，弹窗显示摘要和日志路径。
- 进程被强杀：`runtime.json` / `launcher.lock` 可能残留；下次启动重新拿锁并覆盖 runtime，测试覆盖该场景。
- Vault 切换：服务退出后由新进程重新拉起（WebView 不能在同一进程启动两次）。
- 升级/卸载：Vault 在 `%USERPROFILE%\Nexora\vault`，安装器只写 `%LOCALAPPDATA%\Programs\Personal AI Profile`，没有 `[UninstallDelete]`。

## 4. 测试结果（本机）

- `python -m pytest -q`：28 passed（含 ACL、窗口、launcher runtime）。
- `tests/test_launcher.py`：通过；覆盖首次启动、重复启动、Vault 切换、旧 token 失效、优雅关闭、硬终止后恢复、日志不含 token。
- `tests/test_installer_contract.py`：通过。
- `ruff check .`：All checks passed。
- `python scripts/check_release.py`：release privacy gate passed（上一轮；本阶段未改隐私策略）。
- 前端未在本阶段修改；上一轮 `tsc --noEmit`、Vitest 29/29、production build 均通过。

## 5. Windows 验收记录

| # | 验收项 | 状态 | 证据/备注 |
|---|---|---|---|
| 1 | 全新 Windows 环境安装 | 未执行 | 需要在干净 VM 安装 v1.0.5 候选包 |
| 2 | 普通用户权限安装和启动 | 部分 | 本机以非提升进程运行通过（`WindowsPrincipal.IsInRole(Administrator)=False`）；账户仍属本机管理组，需标准用户 VM 复验 |
| 3 | 首次启动及重复启动 | 通过（源码形态） | `test_launcher.py`；重复启动复用现有服务 |
| 4 | 关闭服务后重新启动 | 通过（源码形态） | 优雅关闭后 runtime 清理；硬终止后恢复通过 |
| 5 | 端口冲突明确提示 | 通过（单元） | `SO_EXCLUSIVEADDRUSE` + 中文错误；未做安装包实机弹窗验证 |
| 6 | 异常退出后恢复 | 通过（源码形态） | 硬终止后 stale runtime/lock 恢复 |
| 7 | binding.key ACL | 通过（本机） | 非继承 DACL，仅 SYSTEM/Administrators/当前用户；修复不轮换 key |
| 8 | 升级不丢用户数据 | 静态约束通过 | 安装器不包含 Vault 目录，无删除动作；需 v1.0.4→v1.0.5 实机验证 |
| 9 | 卸载不删除私人 Vault | 静态约束通过 | 无 `[UninstallDelete]`；需实机卸载验证 |
| 10 | 不同 Windows 用户数据隔离 | 未执行 | 路径按 `%LOCALAPPDATA%`/`%USERPROFILE%` 分用户；需双用户 VM |
| 11 | 安装包重新构建 | 未执行 | 公开 v1.0.4 仍含旧崩溃点 |
| 12 | 安装包数字签名 | 未执行 | 现有发布流程未包含签名 |

## 6. 尚未解决的问题

1. v1.0.5 安装包尚未构建，公开 v1.0.4 的启动崩溃仍未对最终用户消失。
2. 干净 VM 的全新安装、升级、卸载、数据保留没有实测记录。
3. 标准用户（非管理员账户）与双用户隔离未实测。
4. WebView2 缺失/企业策略禁用时的视觉与交互未做真机截图归档。
5. 本机 Playwright 下载根因未复验；CI 通过不能替代本机证据。
6. 安装包未签名，SmartScreen 体验未评估。
7. `pytest` 在 CI 中仍以非哈希锁安装，若要求全依赖哈希需纳入 `requirements-ci`。

## 7. D2 首次使用体验改造建议

1. 单一入口向导：欢迎页只回答三件事——NEXORA 是什么、数据放在哪里、下一步做什么；不出现 MCP/Provider/端口等术语。
2. 默认零选择：首次启动自动创建 Vault 并展示路径；高级用户才展开“选择其他文件夹”。
3. 关系图前置：用一张图说明 Vault（唯一事实源）→ Obsidian（可选编辑器）→ 快照/GitHub（副本）→ MCP/Provider（按次授权的出口），与工作台概念地图复用文案。
4. 首次 Profile 只收 3–5 个问题：称呼、当前关注、希望 AI 如何称呼/协助；其余留到后续。
5. 完成页给出“第一件事”按钮：记录一条记忆、建立第一个项目、或查看示例；避免空白首页。
6. 失败恢复语言：端口占用、文件夹不可写、Vault 版本不匹配各给一条“现在做什么”，而不是 traceback。
7. 可跳过、可重入：向导关闭后能从 Settings 重新进入；未完成不阻塞工作台。
