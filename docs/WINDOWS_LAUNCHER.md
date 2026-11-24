# Windows 本地启动与桌面窗口

## 用户入口

双击 `start-review.vbs` 静默启动；排查问题时运行 `start-review.cmd` 查看输出。也可以直接运行：

```powershell
python launcher.py --vault C:\absolute\path\my-ai-profile
```

未传入 Vault 时，Launcher 依次检查 `PROFILE_VAULT`、框架同级的 `my-ai-profile`，最后自动创建默认 Vault（`%USERPROFILE%\Nexora\vault\my-ai-profile`）。首次启动不再弹出文件夹选择框；切换 Vault 由首次向导或设置页完成。

## 启动流程

1. 在 `%LOCALAPPDATA%\PersonalAIProfile` 建立运行目录并写入 `launcher.log`（不记录 token 或 Vault 内容）。
2. 获取单实例锁 `launcher.lock`。
3. 缺少前端构建时自动执行 `npm install` 和 `npm run build`；已有构建可回退使用。
4. 定位或创建 Vault，并校验 `profile.config.yml` 的 schema；非 Vault 文件夹会给出明确错误。
5. 在 `127.0.0.1` 绑定端口。Windows 使用 `SO_EXCLUSIVEADDRUSE`；指定端口被占用时明确提示，默认端口 `0` 由系统选择空闲端口。
6. 生成本次运行专用 Bearer token，写入受保护 `runtime.json`，启动 Uvicorn（`log_config=None`、`access_log=False`，适配无控制台的窗口化 exe）。
7. 健康检查通过后，Windows 优先打开 pywebview/WebView2 窗口；不可用时退到 Edge `--app`；最后退到系统浏览器。
8. token 通过 URL fragment 交给 React；React 读取后立即清除地址栏，只在页面内存中保存。
9. 关闭原生窗口会停止本地服务；浏览器模式保留服务，由界面“关闭服务”调用认证后的 `/api/v1/shutdown`。
10. 退出时删除 `runtime.json`，释放锁并保留 `launcher.log`。

## 错误与恢复

- **启动失败**：弹窗显示一句可读原因和 `launcher-error.log` 路径；完整 traceback 只写入该私有日志。
- **端口冲突**：提示占用端口，建议关闭占用程序或不指定 `--port`。
- **第二个实例**：拿不到锁时读取现有 `runtime.json`；服务健康则复用并打开窗口，不启动第二个服务。
- **异常退出**：残留的 runtime/lock 会在下次启动重新获取锁后被覆盖；Vault 内 pending 事务由 Core 在下次加锁时恢复。
- **Vault 切换**：服务退出后由新进程重新拉起（WebView 不能在同一进程启动两次）。
- **ACL 损坏**：`core/win_acl.py` 只修复 DACL，不轮换 `binding.key`，以免使既有受管备份失效。

## 当前边界

- 仅监听 loopback，不接受 LAN 或公网连接。
- 源码运行仍依赖系统 Python；缺少已构建前端时还需要 Node.js。无需开发环境的 Windows 安装包（PyInstaller + Inno Setup）见 [`WINDOWS_INSTALLER.md`](WINDOWS_INSTALLER.md)。
- WebView2 是可选运行时；缺失时自动降级，不阻断使用。
- `review_app.py` 和旧审核界面继续保留一个兼容周期。

## 验证

```powershell
cd apps/web
npm run build
cd ../..
python tests/test_launcher.py
python -m pytest -q tests/test_win_acl.py tests/test_desktop_shell.py tests/test_launcher_runtime.py
python tests/test_installer_contract.py
```

集成测试使用临时合成 Vault，验证首次启动、自动端口、health、重复启动复用、Vault 切换、认证关闭、runtime 清理，以及硬终止后的恢复；日志断言确认 token 不会出现在 `launcher.log`。
