# NEXORA Project Context

NEXORA（知序）是开源、本地优先、模型无关的 Personal Intelligence Platform。核心承诺是：**Your Intelligence. Your Data. Your Control.**

## 用户场景

- 在网页中建立档案、审核候选记忆、完成月度复盘与 Human 3.0 成长记录。
- 可选地用 Obsidian 或其他 Markdown 编辑器直接编辑同一 Vault；Obsidian 不是运行依赖。
- 通过受限 MCP 客户端向 Claude Desktop、Cursor、VS Code 等提供最小化、获授权的上下文。
- 用本地 managed backup 和可选 Git/GitHub 私有仓库进行版本管理、备份与恢复。
- 对外部模型调用逐次预览、授权并审计，不默认上传私人内容。

## 产品原则

1. Markdown Vault 是核心事实源，网页是主要入口，Obsidian 是可选入口。
2. 公共代码仓库不得包含真实私人数据；私人 Vault 与源码仓库必须隔离。
3. 用户拥有记忆的最终确认权。候选记录不能被 AI 或 MCP 自动提升为正式记忆。
4. `allowed`、`summary-only`、`local-only`、`denied` 由服务端强制执行；缺失或非法值默认拒绝。
5. Vault identity 不匹配时 fail closed；客户端、Vault 与审计记录保持可追溯绑定。
6. 外部 Provider 是显式、按 scope、按请求授权的可选适配器；本地能力不应依赖云模型。
7. 冲突、恢复和同步优先保护数据，不静默覆盖。

## 开源边界

仓库公开发布程序、空模板、文档和合成测试数据。真实 Vault、凭据、运行时 token、本机路径登记与备份内容不属于公开仓库。
