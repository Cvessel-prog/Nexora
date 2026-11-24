# Product Roadmap

## P0 — 稳定版发布门禁

1. 在本机复用匹配版本浏览器缓存并重跑全量 Playwright，定位此前下载超时根因；#47、#48 已合并且 CI 全绿。
2. 在干净 Windows VM 构建、安装、启动、切换 Vault、卸载并验证下一版本；验证 runtime/token 文件 ACL。
3. 保持 API、阶段和当前状态文档一致；#53 已合并，FastAPI 的 103 个 `/api/v1` routes 已与 `LOCAL_API.md` 清点。
4. 建立可重复的外部用户安装验收：首次启动、空 Vault、恢复、错误凭据、离线模式、升级/回滚。
5. 消除 lint warning，并评估前端主 chunk 分包；后者是性能/可维护性而非安全阻断。

## P1 — 数据韧性与可理解性

1. 设计用户可控、默认关闭或明确告知的定时本地备份；覆盖磁盘满、权限失败、保留策略和恢复演练。
2. 为月度复盘加入未保存内容离页/切月提醒，不改变显式保存原则。
3. 增强恢复中心对 backup/Git 两类恢复点、影响范围和安全备份的解释。
4. 增加 release artifact 校验、签名状态和升级路径文档。

## P2 — 连接生态

1. 在真实 Claude Desktop、Cursor、VS Code 上做版本化兼容矩阵与端到端验收。
2. 评估 MCP Resources/Prompts；只有在不扩大权限、候选记忆和 access policy 边界时实施。
3. 将 Provider adapter 扩展为可测试的插件接口，同时保持逐次 outbound preview 和授权。

## P3 — 产品成熟度

1. 可访问性人工验收（屏幕阅读器、高对比、200% zoom、键盘流）。
2. 性能基线：大 Vault、数千记忆、长审计链、备份/恢复耗时和 UI 响应。
3. 发布支持：迁移策略、故障诊断包（脱敏）、贡献者文档和稳定版支持周期。
