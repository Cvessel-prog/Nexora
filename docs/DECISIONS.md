# Decisions

1. **Web-first, Obsidian-optional**：网页是主要入口；Vault 是开放 Markdown，Obsidian/其他编辑器可选，避免产品被单一编辑器锁定。
2. **Vault as source of truth**：业务事实保存在 Markdown/本地系统记录；React、API response、backup、Git history 都不是实时事实源。
3. **Public code / private data separation**：公开仓库只含代码、空模板、文档和合成数据；Vault 备份使用用户自己的私有 GitHub 仓库。
4. **Human confirmation owns memory**：AI 只能提出 candidate；正式确认、拒绝、遗忘、替代与发布是本地用户操作。
5. **Four-level access policy**：`allowed` 可返回正文；`summary-only` 只返回显式摘要；`local-only` 和 `denied` 不经 MCP 返回；缺失/非法默认 denied。
6. **Server-enforced least privilege**：客户端 scope、token、状态和 access policy 都在 Core/MCP 服务端执行，UI 不是安全边界。
7. **Vault identity fail closed**：MCP 配置的 `PROFILE_VAULT_ID` 与当前 Vault 不一致即拒绝访问，防止多 Vault 串线。
8. **Growth stays local-only**：不增加 growth/monthly/privacy MCP scope；不自动推断等级、诊断或成长分数。
9. **Local-first security audit**：审计链在 Vault 内防篡改并在完整性失败时阻断受保护操作；暂不依赖外部透明度服务。
10. **Explicit provider authorization**：Provider 调用需 provider/scope 授权、精确 payload 预览、逐次决定和本地审计；无授权不联网。
11. **Conflict-safe writes and recovery**：正式写入使用锁、revision、原子替换/事务；恢复前创建安全备份，不静默合并或覆盖。
12. **Windows without Electron/Tauri**：当前形态是 Python/FastAPI + 静态 React + 本地 launcher/installer，降低桌面运行时复杂度。
