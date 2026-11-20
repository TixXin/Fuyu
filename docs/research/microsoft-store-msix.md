# 上架 Microsoft Store：Snow Shot 的做法和浮屿要改什么

起因：#1074（D114）要给 Windows 安装包签名，现定走 SignPath Foundation。用户问截图软件 [Snow Shot](https://github.com/mg-chao/snow-shot) 是怎么上架微软商店的，浮屿能不能也上。

调研时间：2026-11-20。Snow Shot 的部分读的是它仓库 `main` 分支的源码，浮屿的部分读的是本仓库代码；微软政策部分没有逐条重新查官方文档，标了「待核实」的要开工前再确认。

## 结论

- **Snow Shot 走的是 MSIX 包，不是把 exe 安装包交给商店。** 交上去的 `.msix` 不签名，由 Microsoft Store 签名后再分发，所以它不用自己买证书。商店版和官网的 NSIS 安装包、便携版并存，是两个渠道。
- **浮屿可以照这个做。** 它的好处正好对上 D114 的问题：商店装的包由微软签名，没有 SmartScreen「未知发布者」，也不用证书费。代价是商店版要单独打一个渠道，有四处行为要改（见下面「浮屿要改的」），其中 AI 代理钩子那一处最大。
- **商店版不能替代安装包签名。** 官网直接下载的 exe 照样没签名，SignPath 那条路还要走；商店是多一个不报警的下载入口。

## Snow Shot 怎么做的

文件：`docs/snow-shot-msix.md`（流程）、`snow_shot/packaging/msix/AppxManifest.xml.in`（清单模板）、`snow_shot/packaging/msix/store-identity.json`（商店身份）、`scripts/package-snow-shot-msix.ps1`（打包）。

1. **先在 Partner Center 保留产品名**，拿到包名、Publisher（`CN=<GUID>` 形式）和商店产品 ID，写进 `store-identity.json`。以后每版都用这一个身份，换了就会丢自启设置和已有的商店数据。
2. **单独的商店构建**：CMake 预设 `snow-shot-msvc-store-release`，打包时 `DistributionChannel = 'store'`。打包脚本会检查包里不许有 updater、卸载程序、测试程序，也就是商店版不带自更新，更新全交给商店。
3. **打一个不签名的 x64 `.msix`**，用 Windows SDK 的 MakeAppx、MakePri，最低 Windows 10 19041。本地测试时另用自签证书签一份副本，管理员把公钥导入「本地计算机 → 受信任的人」后再装。提交是手动在 Partner Center 上传，发布脚本不自动传。
4. **清单是完全信任的桌面应用**：`runFullTrust`，`EntryPoint="Windows.FullTrustApplication"`，`uap10:RuntimeBehavior="packagedClassicApp"`，普通权限（mediumIL）。用到的扩展：
   - `windows.startupTask`：开机自启，代替写注册表 Run 键，默认关，带 `--autostart` 参数；
   - `windows.appExecutionAlias`：给 MCP 进程起一个命令行别名，外部程序靠它调用；
   - `windows.comServer` 加 `windows.fileExplorerContextMenus`：资源管理器右键菜单；
   - `windows.fileTypeAssociation`：文件关联；
   - 设备能力 `microphone`、`webcam`（录屏用）。
5. **提交前要有隐私政策**（中英文，挂在官网），并在干净的 Windows 10 19041 和 Windows 11 上装商店包实测：自启开关、被策略关掉的自启、麦克风摄像头拒绝、右键菜单、多语言。
6. 官网「Windows 商店」那一栏的下载按钮是商店的网页安装器：下一个小程序，由 Microsoft Store 完成安装和后续更新。

## 浮屿要改的

按 Snow Shot 的路子（MSIX + `runFullTrust` + `packagedClassicApp`），浮屿用到的 Win32 能力（置顶透明窗口、低级键盘钩子、UIA、Toast 读取、媒体会话、任务栏嵌入）在完全信任下照常能用。要改的是 MSIX 的虚拟化和安装方式带来的四处：

| 问题 | 现在的做法 | 商店版要怎么改 |
|---|---|---|
| **AI 代理钩子（最大的一处）** | hook 脚本 `fuyu-agent-*.{cmd,ps1}`、`agent-status.json`、运行标记都在应用数据目录 `%APPDATA%\com.tixxin.fuyu`，由 Claude Code 等外部进程执行和写入（`data-storage.md`） | MSIX 里应用往 AppData 新写的文件会被重定向到 `%LOCALAPPDATA%\Packages\<包>\LocalCache\Roaming\…`，外部进程按原路径找不到脚本，也写不到岛读的地方（Claude 桌面版的 MSIX 就是这样，岛已经在读它的 LocalCache，见 `agent-status-hooks.md`）。两条路：共享文件挪到 `~\.fuyu`（Mac 已经这样），或在清单里关掉文件写虚拟化（`desktop6:FileSystemWriteVirtualization` + 受限能力 `unvirtualizedResources`，要在提交时写理由，能不能过审待核实）。前一条更稳 |
| 开机自启 | 写 `HKCU\…\Run` 的 `Fuyu`（`system/startup.rs`，对外契约） | 商店版改用 `windows.startupTask`，前端开关读写它的状态；HKCU 的写入在包里也会被虚拟化，写了不生效。正式版仍写注册表，契约不变 |
| 自动更新 | Tauri updater 读 `latest.json` | 商店版不打包 updater、关掉检查更新入口，更新走商店（Snow Shot 同样） |
| 卸载清理 | NSIS 卸载时跑 `fuyu.exe --uninstall-cleanup` 移除钩子 | MSIX 卸载不能跑自定义程序，外部钩子会留下。靠设置里的「移除钩子」和钩子命令的存在性守卫兜底（Mac 已经是这样） |

还要定的：

- **两个版本的数据**：商店版的 WebView2 数据（`localStorage`）和应用数据都在包的私有目录，和安装版不是一份。从安装版换到商店版，设置和待办不会跟过来，要做一次导入，或者先只说明「二选一」。两个版本同时装时单实例和快捷键会抢，要互相检测。
- **其他注册表访问**：`ssh_tunnel/local_proxy.rs`、`claude_usage/source.rs` 只读 `Internet Settings` 的系统代理，`device_use`、`im_sources`、`accent_color` 也是读；读不受虚拟化影响。注册表写入目前只有自启和改名迁移（`rename_migration/legacy.rs`，商店版没有旧安装，不需要跑）。
- **身份和名字**：商店的包名、Publisher 是 Partner Center 给的，和 `com.tixxin.fuyu` 不是一回事，不影响对外契约；但商店版的应用数据路径会不同，`contracts.md` 和 `data-storage.md` 要加一节。
- **CI**：Tauri 不直接出商店用的 MSIX，要像 Snow Shot 一样写一个打包脚本（MakeAppx + 清单模板 + 图标资源），放进发版流程，产物手动或用 Partner Center 的提交接口上传。

## 费用和账号（待核实）

- 个人开发者账号：微软 2025 年起对个人开发者免费注册（之前是一次性 19 美元），开工前到 Partner Center 确认现行条件和国内身份验证要求。
- 交 MSIX 由商店签名，不需要自己的证书；交 exe / MSI 的话要自己用受信任 CA 的证书签名，那就又回到 SignPath / Certum。所以浮屿上商店应该交 MSIX。
- 提交要隐私政策链接（浮屿读剪贴板、通知、邮箱，要写清楚）和年龄分级问卷；`runFullTrust` 是受限能力，提交时要说明用途。

## 建议

1. D114 里 Windows 签名那部分不变，仍申请 SignPath，官网下载的安装包靠它。
2. 另开一个任务做商店版，顺序是：先把 Windows 上的钩子共享文件挪到 `~\.fuyu`（对安装版也是好事，和 Mac 统一）→ 商店渠道的构建开关（去 updater、自启改 startupTask）→ MSIX 打包脚本和本地自签测试 → Partner Center 保留名字、写隐私政策 → 提交。
3. 用户本人要做的：注册 Partner Center 账号、保留「浮屿 / Fuyu」名字、确认隐私政策内容。

## 参考

- Snow Shot：`docs/snow-shot-msix.md`、`snow_shot/packaging/msix/AppxManifest.xml.in`、`scripts/package-snow-shot-msix.ps1`（github.com/mg-chao/snow-shot，main 分支）
- 微软：[MSIX 本地签名指南](https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide)、[受信任证书排障](https://learn.microsoft.com/en-us/windows/msix/app-installer/troubleshoot-appinstaller-issues#trusted-certificates)
- 浮屿：#1074 / `docs/tasks/D/D114.md`、`docs/architecture/data-storage.md`、`docs/features/agent-status-hooks.md`
