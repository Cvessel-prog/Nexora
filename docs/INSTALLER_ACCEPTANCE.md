# Windows Installer Acceptance

状态：**未执行；验收模板已建立**  
数据边界：仅使用临时合成 Vault，不使用真实用户 Vault。

## 测试环境记录

- Windows edition/build：待记录
- VM/快照 ID：待记录
- 用户类型及 SID：待记录
- 安装包版本、来源、SHA-256、签名状态：待记录
- 前置软件：必须记录 Python/Node 是否不存在
- 网络、代理、杀毒/SmartScreen 状态：待记录

## 验收用例

| ID | 任务 | 验证命令/证据 | 预期 | 状态 | 人工验收 |
|---|---|---|---|---|---|
| I-01 | 全新安装 | `Get-FileHash`; installer log; 安装目录清单 | per-user 安装，无私人数据，无需管理员 | 未测试 | 是 |
| I-02 | 首次启动 | 进程、runtime、浏览器 URL、health | 单实例启动，token 不进 query/log | 未测试 | 是 |
| I-03 | 创建合成 Vault | UI + schema/identity 检查 | 模板完整，源码目录外隔离 | 未测试 | 是 |
| I-04 | Web/API | health、鉴权正/负测试、核心页面 | loopback-only，错误 token 被拒绝 | 未测试 | 否 |
| I-05 | 正常关闭 | shutdown API、进程退出码、runtime 清理 | 有界时间退出，无敏感残留 | 未测试 | 否 |
| I-06 | 再次启动 | 新进程、新 token、原 Vault identity | 数据保留，旧 token 失效 | 未测试 | 否 |
| I-07 | 升级安装 | v1.0.4→候选版，安装日志和文件版本 | 程序升级，Vault/本机配置保留 | 未测试 | 是 |
| I-08 | 卸载 | 应用和功能、uninstaller log、残留清单 | 程序移除；用户数据按文档保留 | 未测试 | 是 |
| I-09 | 重装恢复 | 重装后选择原合成 Vault | 身份一致且无重复初始化 | 未测试 | 否 |
| I-10 | 异常安装恢复 | 中断/磁盘不足/文件占用/损坏包 | 明确失败，不留可误启动半安装状态 | 未测试 | 是 |
| I-11 | 普通用户权限 | `whoami /groups`; 启动/升级/卸载 | 不依赖管理员写权限 | 未测试 | 是 |
| I-12 | ACL | `Get-Acl`; `icacls` | 满足 R1 的 owner/读写边界 | 未测试 | 否 |

## 标准命令

```powershell
Get-FileHash .\NEXORA-Setup-<version>.exe -Algorithm SHA256
Get-AuthenticodeSignature .\NEXORA-Setup-<version>.exe | Format-List *
Get-Process | Where-Object ProcessName -Match 'nexora|personal-ai-profile'
Invoke-RestMethod http://127.0.0.1:<port>/api/v1/health
Get-Acl <runtime-or-app-data-path> | Format-List
icacls <runtime-or-app-data-path>
```

构建参考：`./scripts/build_windows.ps1 -Version <version>`；自动 smoke：`./tests/windows_installer_smoke.ps1 -Version <version>`。自动 smoke 不能替代 I-01、I-07、I-08、I-10 的人工观察。

## 失败记录

每项失败记录：时间、VM snapshot、命令、原始退出码/日志、残留进程/文件、是否可重现、影响数据、建议修复位置。没有记录即不得改为通过。

## 验收结论

当前：**未验收**。需要干净 Windows VM、两个安装包版本以及 R1 ACL 判据。

