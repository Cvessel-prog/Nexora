# MCP Compatibility Matrix

状态：**计划完成；协议模拟已有历史证据；真实 Host 待验证**。

## 公共安全判据

每个客户端必须验证：initialize、tools/list、最小 scope 成功、缺 scope 拒绝、错误 token 拒绝、token 重签后旧 token 失效、撤销后拒绝、删除后拒绝、Vault identity mismatch fail closed、candidate 正文不返回、`denied/local-only` 不返回、`summary-only` 仅显式摘要。

## 客户端矩阵

| Client | 配置形式 | 协议模拟 | 真实客户端 | 需要记录 | 人工验收 |
|---|---|---|---|---|---|
| Claude Desktop | `mcpServers` stdio JSON | 已由生成器/协议测试覆盖，需本轮重跑 | 未验证 | 客户端版本、配置路径、日志、tools 可见性 | 是 |
| Codex | 本地 stdio MCP 配置 | MCP server 可协议测试；Codex 专用配置待确认 | 未验证 | Codex 版本、配置 schema、进程环境继承 | 是 |
| Cursor | Cursor MCP stdio 配置 | 生成器支持，需本轮重跑 | 未验证 | Cursor 版本、配置路径、重启行为 | 是 |
| VS Code MCP client | VS Code MCP 配置 | 生成器支持，需本轮重跑 | 未验证 | VS Code/扩展版本、配置 schema、日志 | 是 |

“协议模拟通过”不能填写到“真实客户端”列。

## 协议模拟命令

```powershell
python tests/test_mcp_host_config.py
python tests/test_mcp_protocol.py
python tests/test_mcp_security.py
python tests/test_security_lifecycle.py
python tests/test_ai_connections.py
```

测试必须使用临时合成 Vault。对每个 Host 生成到临时文件，验证绝对 Python/server/Vault 路径、`PROFILE_AGENT_ID`、`PROFILE_CLIENT_TOKEN`、`PROFILE_VAULT_ID`，测试结束删除临时凭据文件。

## 真实客户端流程

1. 记录客户端准确版本及下载来源。
2. 创建独立客户端 ID，仅授予一个最小 scope。
3. 生成临时配置并人工合并到 Host；不覆盖现有配置。
4. 完全退出并重启 Host，记录 server spawn、initialize 和 tools/list。
5. 执行允许调用与缺 scope 调用。
6. 重签 token：旧 token 必须立即失败，新 token 成功。
7. 撤销：下一次调用必须失败；重新授权必须创建新客户端（revoked 为终态）。
8. 配置错误 Vault ID：启动/访问必须 fail closed。
9. 删除测试客户端并清理 Host 配置；保留脱敏日志和审计事件 ID。

## 阻塞项

- 客户端未安装或无法确定版本：标记 `Blocked`。
- Host 不支持当前配置 schema：记录兼容缺口，不修改权限边界绕过。
- Token 配置文件 ACL 不满足 R1：真实 Host 验收失败。

## 当前结论

MCP Core/stdio 协议具备自动化覆盖；四个真实 Host 均缺当前环境实机证据。发布前至少应完成项目明确宣称支持的 Host；其余可在文档中降级为“实验性/未验证”。

