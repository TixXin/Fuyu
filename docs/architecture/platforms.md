# 各功能的平台支持

每个功能在 Windows 和 macOS 上的支持情况，以本表为准。README 的系统要求、插件文档和设置里的说明都引用这里，不在别处另写一份。

## 维护规则

- **和代码同一个提交改**：某个功能在某个平台上的状态变了（开始做、做完、降级、放弃），就在那个提交里改对应的行。
- 新增功能或 `src-tauri/src/` 下新增顶层模块时，在表里加一行。
- 「最后验证」写验证时的系统版本和日期，例如 `macOS 15.6，2026-11-20`。系统大版本更新后复测依赖私有 API 或敏感权限的行。
- 状态只用下面几种：

| 状态 | 含义 |
|---|---|
| 已支持 | 可以正常使用 |
| 部分支持 | 能用，但比另一个平台少了一部分，写在「说明」里 |
| 开发中 | 有子任务在做 |
| 未开始 | 打算做，还没开始 |
| 不支持 | 做不了或暂不做，「说明」写原因 |

macOS 的计划和决定见 [macos-port-plan.md](macos-port-plan.md)，各功能的 API 与可行性见 [macos-platform-apis.md](../research/macos-platform-apis.md)。

## 支持情况

更新：2026-11-13（G1.2：Rust 端在 Mac 上能编译、clippy 与测试通过，`pnpm dev:lane` 能起窗口；功能都还没做，表里的 macOS 状态不变）。

| 功能 | 模块 | Windows | macOS | macOS 的做法与权限 | 子任务 | 最后验证（macOS） |
|---|---|---|---|---|---|---|
| 悬浮岛窗口（折叠、展开、贴边收起） | `island` | 已支持 | 开发中 | NSPanel（`tauri-nspanel`）+ Accessory；无需权限 | G1.3 | — |
| 游戏模式（前台全屏时勿扰、贴边） | `system::fullscreen` | 已支持 | 开发中 | CoreGraphics 窗口列表：最前面的普通窗口盖住整块显示器；无需权限。Mac 上默认贴边开、勿扰关（M6） | G1.3 | — |
| 新手引导 | `onboarding_window` | 已支持 | 开发中 | 透明遮罩铺满岛所在的整块屏幕（岛默认压在菜单栏上）；「最小化全部窗口」改为隐藏其他应用，关掉时全部显示回来；无需权限 | G1.3 | — |
| 设置窗口 | `settings_window` | 已支持 | 未开始 | 普通窗口 | G1.4 | — |
| 家目录与数据位置 | `home_dir` | 已支持 | 未开始 | 默认 `~/.fuyu`；应用数据目录在 `~/Library/Application Support/` 下，写进 contracts.md | G1.4 | — |
| 从岛上打开 QQ / 微信 | `messenger_activation` | 已支持 | 未开始 | `NSWorkspace` 打开应用 | G1.10 | — |
| 通知诊断 | `notification_diagnostics` | 已支持 | 不支持 | 读不到系统通知，Mac 上隐藏 | G1.2 | — |
| 托盘 / 菜单栏图标 | `tray.rs` | 已支持 | 未开始 | Tauri tray，模板图标 | G1.4 | — |
| 开机自启 | `system` | 已支持 | 未开始 | SMAppService | G1.4 | — |
| 凭据存储 | `mail`、`rename_migration` | 已支持 | 未开始 | Keychain | G1.4 | — |
| 全局快捷键 | `win32/hotkey` | 已支持 | 未开始 | Carbon 热键；不接管系统组合键 | G1.4 | — |
| `fuyu://` 链接 | `win32/url_protocol` | 已支持 | 未开始 | Info.plist 声明，只在安装后的 `.app` 可用 | G1.4 | — |
| 自动更新 | `system` | 已支持 | 未开始 | 同一个 updater，`latest.json` 加 darwin 键；需签名公证 | G1.13 | — |
| 待办、笔记与归档 | `todos` | 已支持 | 未开始 | 通用代码 | G1.2 | — |
| 日历与会议提醒 | `calendar` | 已支持 | 未开始 | 通用代码 | G1.2 | — |
| 多邮箱 | `mail` | 已支持 | 未开始 | 通用代码 + Keychain | G1.4 | — |
| 快捷翻译 | `translation` | 已支持 | 未开始 | 划词用 AX（辅助功能）；OCR 用 Vision | G1.6 | — |
| 剪贴板历史 | `clipboard_history` | 已支持 | 未开始 | `changeCount` 轮询；可能有系统隐私提示；粘贴回去要辅助功能 | G1.6 | — |
| 文件中转 | `file_shelf` | 已支持 | 未开始 | 拖出到 Finder 要原生实现 | G1.6 | — |
| 截图 | `screenshot` | 开发中 | 未开始 | ScreenCaptureKit；屏幕录制权限，系统每月重新确认 | G1.6 | — |
| 音量 | `system_levels` | 已支持 | 未开始 | CoreAudio | G1.6 | — |
| 亮度 | `system_levels` | 已支持 | 未开始 | 私有 API（DisplayServices / DDC），可关、可降级 | G1.9 | — |
| 摄像头 / 麦克风提示 | `device_use` | 已支持 | 未开始 | 设备级占用；麦克风按进程要 macOS 14 | G1.6 | — |
| 设备插拔、电源 | `device_events` | 已支持 | 未开始 | IOKit、CoreAudio 通知 | G1.6 | — |
| 媒体控制 | `media_control` | 已支持 | 未开始 | 私有 MediaRemote（mediaremote-adapter 思路）+ AppleScript 兜底 | G1.9 | — |
| 同步歌词 | `lyrics` | 已支持 | 未开始 | 依赖媒体控制拿到的曲目信息 | G1.9 | — |
| QQ 通知 | `qq_notifications` | 已支持 | 未开始 | 读不到系统通知；最多读 Dock 角标未读数（辅助功能），待验证 | G1.10 | — |
| 微信提醒 | `wechat_reminders` | 已支持 | 未开始 | 同上；会话列表的 AX 读取待验证 | G1.10 | — |
| 手机推送 | `phone_push` | 已支持 | 未开始 | 锁屏、空闲判断换 macOS 实现 | G1.6 | — |
| AI 代理状态与 hook | `agent_status`、`agent_approval` | 已支持 | 未开始 | `~/.claude` 等路径、sh 脚本、绝对路径 | G1.7 | — |
| 点会话跳到终端 / 编辑器 | `agent_status` | 已支持 | 未开始 | AppleScript（自动化权限）、VS Code URL、AX | G1.7 | — |
| Claude 用量 | `claude_usage` | 已支持 | 未开始 | 读取路径换成 Mac 的位置 | G1.7 | — |
| 插件 | `plugin_host` | 已支持 | 未开始 | 进程组代替 Job Object；PowerShell 插件需用户装 pwsh | G1.8 | — |
| 本地 API、SSH 隧道、cc-connect | `local_api`、`ssh_tunnel`、`cc_connect` | 已支持 | 未开始 | 通用代码；系统代理读 SCDynamicStore | G1.2 | — |
| 宠物 | `pets` | 已支持 | 未开始 | 通用代码 | G1.2 | — |
| 刘海形态 | — | 不支持（没有刘海） | 未开始 | 读刘海几何，可选 | G1.11 | — |

不对应用户功能、不单列的模块：`lib.rs`、`main.rs`、`dev_lane.rs`、`fs_write.rs`、`settings_file.rs`、`user_error.rs`。它们在 G1.2 里随平台隔离一起处理。
