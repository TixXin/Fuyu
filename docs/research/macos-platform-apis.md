# macOS 上各功能的系统 API 与权限

> 日期：2026-11-13。问题：浮屿要移植到 macOS（用户自用 + 正式对外发布），每个原生功能在 macOS 上用什么 API 实现、需要什么权限、有没有私有 API 或系统版本限制、Rust/Tauri 有没有现成的 crate 或插件。范围：Apple 开发者文档与论坛、Tauri v2 文档、docs.rs、GitHub（mediaremote-adapter、boring.notch、nowplaying-cli、MonitorControl、Doll、tauri-nspanel、keyring-rs、WeChat-MCP）、mjtsai.com、9to5mac、Microsoft Learn；关键词：MediaRemote 15.4、pasteboard privacy、ScreenCaptureKit monthly prompt、notification center database Sequoia、kAudioDevicePropertyDeviceIsRunningSomewhere、AXStatusLabel Dock badge、WeChat Mac Accessibility、SMAppService、tauri-plugin-autostart/deep-link/updater、PowerShell macOS。GitHub 未按 star 筛选，只看与问题直接相关的仓库。相关任务：G1（macOS 适配，计划见 [macos-port-plan.md](../architecture/macos-port-plan.md)）

先说明两个背景事实，后文的版本门槛都以此为参照：

- 当前 macOS 已到 **27（Golden Gate）**，并且 **27 起只支持 Apple Silicon**；PowerShell 官方支持列表为 macOS 27（arm64）、26 Tahoe、15 Sequoia（[Microsoft Learn，查询于 2026-11-13，页面更新于 2026-09-22](https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-macos)）。
- 本文中「本次核对」指我打开了来源页面；标「未核实」的是凭开发常识或只看到搜索摘要，没有打开可靠来源确认，落地前要实测。

## 结论

### 总表

模块名指 `src-tauri/src/` 下的目录。「可行性」：可做 = 有公开 API、权限常规；受限 = 能做但要私有 API / 敏感权限 / 体验打折；基本做不了 = 公开途径已封或只剩很脆弱的办法。

| 功能 | Windows 现在的实现 | macOS 方案 | 所需权限 | 可行性 | 风险 |
|---|---|---|---|---|---|
| 悬浮岛窗口（`island`） | Win32 窗口样式、DWM 毛玻璃、鼠标穿透、置顶、外部点击检测 | Tauri 透明窗口 + `tauri-nspanel` 转成 NSPanel（浮于其他窗口之上）；毛玻璃用已依赖的 `window-vibrancy`（NSVisualEffectView）；穿透用 `set_ignore_cursor_events`；顶部居中要避开刘海 | 无；全局鼠标位置轮询无需权限，监听全局事件需辅助功能 | 可做 | 在全屏 App 的 Space 上显示需要 NSPanel + collectionBehavior 调试；刘海机型几何不同 |
| 托盘（`tray.rs`） | Tauri tray-icon | 同一套 Tauri tray → NSStatusItem 菜单栏图标 | 无 | 可做 | 菜单栏图标需模板图（单色），刘海机型图标可能被挤掉 |
| 开机自启（`system/startup.rs`） | 注册表 Run 值 `Fuyu` | `SMAppService.mainApp.register()`（macOS 13+）；或 `tauri-plugin-autostart`（只有 LaunchAgent / AppleScript 两种方式） | 用户在「登录项」里可关闭；状态可能为 requiresApproval | 可做 | 插件不支持 SMAppService，正式发布建议自己用 objc2 调 SMAppService |
| 凭据（`mail/credentials`、`rename_migration`） | 凭据管理器（keyring windows-native） | Keychain：`keyring` 4.x 的 `apple-native-keyring-store` feature | 无（签名变化时可能弹钥匙串授权） | 可做 | 未签名/签名身份变化后每次读取弹框 |
| 全局快捷键（`win32/hotkey`、翻译、截图、剪贴板） | RegisterHotKey + 低级键盘钩子接管 Win+V | Carbon `RegisterEventHotKey`（`tauri-plugin-global-shortcut`/`global-hotkey` crate）；接管系统组合键需 CGEventTap | 普通快捷键无需权限；CGEventTap 需「辅助功能」或「输入监控」 | 可做（接管 Cmd+V 类：受限） | macOS 没有 Win+V 对应物（26 起 Spotlight 自带剪贴板历史，见下），建议默认 ⌘⇧V 而非劫持 ⌘V |
| `fuyu://` 链接（`win32/url_protocol`、插件市场链接） | 运行时写注册表 | Info.plist 里的 CFBundleURLTypes，打包时声明；`tauri-plugin-deep-link`，用 `on_open_url` 接收 | 无 | 可做 | macOS 不能运行时注册，dev 模式无法测试，必须装进 /Applications |
| 单实例 | tauri-plugin-single-instance | 同插件（macOS 本身一个 bundle 一个实例，链接走 open-url 事件） | 无 | 可做 | 无 |
| 自动更新（`system/updater*`） | tauri-plugin-updater + latest.json | 同插件，产物是 `.app.tar.gz` + `.sig`，平台键 `darwin-aarch64` / `darwin-x86_64` | 无；但正式发布需 Developer ID 签名 + 公证 | 可做 | 未公证的 App 会被 Gatekeeper 拦；`latest.json` 要加 darwin 平台键（对外契约） |
| 媒体控制与歌词（`media_control`、`lyrics`） | SMTC（GlobalSystemMediaTransportControls） | 私有 MediaRemote：15.4 起对非 Apple 进程封锁，现行绕法是 `mediaremote-adapter`（借 `/usr/bin/perl` 加载）；兜底 AppleScript 控 Music/Spotify | 无系统权限；AppleScript 兜底需「自动化」授权 | 受限 | 依赖私有 API + 社区绕法，任何系统更新都可能失效；27 上是否可用只看到 CI 徽章 |
| 剪贴板历史（`clipboard_history`） | 剪贴板监听 + Win+V 钩子 | NSPasteboard `changeCount` 轮询；读内容用 `readObjects`；粘贴回去用 CGEvent 模拟 ⌘V | 读剪贴板：15.4 起的「粘贴自其他 App」隐私提示（26 上默认未启用，27 状态未核实）；模拟按键需「辅助功能」 | 可做（隐私提示风险待实测） | Apple 已预告读剪贴板会弹提示，若在 27.x 正式启用，需引导用户永久允许 |
| 文件中转（`file_shelf`） | OLE 拖放 | Tauri 的拖入事件 + 拖出需 NSDraggingSource（`tauri-plugin-drag` / `drag` crate，未核实） | 无 | 可做 | 拖出到 Finder 需原生实现 |
| 截图（`screenshot`） | Windows.Graphics.Capture / DWM | ScreenCaptureKit（`SCScreenshotManager`，macOS 14+）；旧的 `CGWindowListCreateImage` 已弃用 | 「屏幕与系统录音」权限；15 起每月弹一次重新确认 | 可做 | 每月提示无法通过公开途径消除（Persistent Content Capture 权利无公开申请方式） |
| OCR（翻译、截图） | Windows.Media.Ocr | Vision `VNRecognizeTextRequest`（macOS 10.15+，中文 11+，未核实）；crate `objc2-vision` / `apple-vision` | 无 | 可做 | 无 |
| 划词翻译（`translation/selection`） | 模拟 Ctrl+C 读剪贴板 | 先用 AX `kAXSelectedTextAttribute` 读选中文字，不行再模拟 ⌘C | 「辅助功能」 | 可做 | 模拟 ⌘C 会触发剪贴板隐私逻辑，读后需恢复原剪贴板 |
| 音量 / 输出设备（`system_levels`、`win32/audio*`） | Core Audio（IAudioEndpointVolume） | CoreAudio `kAudioHardwareServiceDeviceProperty_VirtualMainVolume`、默认输出设备监听（`coreaudio-rs` / `objc2-core-audio`） | 无 | 可做 | 部分 HDMI/DisplayPort 输出没有软件音量 |
| 亮度（`win32/brightness`） | WMI / DDC/CI | 内建屏：私有 `DisplayServices`；外接屏：DDC（Apple Silicon 上走私有 IOAVService），参考 MonitorControl | 无系统权限 | 受限 | 全部是私有 API；M1 与入门 M2 Mac mini 的 HDMI 口不支持 DDC |
| 摄像头/麦克风占用（`device_use`） | 注册表 CapabilityAccessManager，能列出使用的 App | 设备级：`kCMIODevicePropertyDeviceIsRunningSomewhere`、`kAudioDevicePropertyDeviceIsRunningSomewhere`；麦克风按进程：macOS 14+ `kAudioHardwarePropertyProcessObjectList` + `kAudioProcessPropertyIsRunningInput` | 读属性预计无需权限（未核实） | 可做（摄像头只能到设备级） | 蓝牙麦克风设备级属性一直报未使用（Apple 论坛已确认待修） |
| 设备插拔、电源、蓝牙电量（`device_events`） | CM_* devnode、电源状态、音频端点 | IOKit 通知（`IOServiceAddMatchingNotification`）、`IOPSNotificationCreateRunLoopSource`、CoreAudio 设备列表监听；蓝牙电量读 IORegistry `BatteryPercent`（未核实） | 无 | 可做（蓝牙电量受限） | 蓝牙电量键名是非公开约定 |
| 锁屏/空闲（`phone_push`、`win32/session_notifications`） | WTS 会话通知、GetLastInputInfo | 分布式通知 `com.apple.screenIsLocked/Unlocked`、`NSWorkspace` 睡眠通知；空闲用 `CGEventSourceSecondsSinceLastEventType` | 无 | 可做 | 锁屏通知名是非公开约定（未核实） |
| 全屏/勿扰判断（`system/fullscreen`、`notification_state`） | SHQueryUserNotificationState | `NSWorkspace` 前台 App + CGWindowList 判断全屏窗口；专注模式状态无公开读取 API（未核实） | 读其他窗口标题需屏幕录制权限，判断全屏只用尺寸不需要 | 受限 | 专注模式只能间接判断 |
| 强调色、网络计费（`system/accent_color`、`network_cost`） | 注册表、WinRT Connectivity | `NSColor.controlAccentColor`；`NWPathMonitor` 的 `isExpensive` / `isConstrained` | 无 | 可做 | 无 |
| 读系统通知（`qq_notifications` 的通知监听、`notification_diagnostics`） | UserNotificationListener（WinRT） | 无公开 API。Sequoia 起通知数据库移到 `~/Library/Group Containers/group.com.apple.usernoted/db2/db`，受 TCC 保护；27 起其他开发者的组容器默认拒绝 | 完全磁盘访问（推测，未核实能否读到） | 基本做不了 | 依赖未公开的数据库格式；Apple 明确把它当隐私漏洞修（有 CVE） |
| QQ 提醒（`qq_notifications`） | 通知监听 + 窗口操作 | ① 读 Dock 角标（AX 读 Dock 的 `AXStatusLabel`，Doll 已这么做）只拿到未读数；② NTQQ 是 Electron，AX 树需对它设 `AXManualAccessibility` 才展开（未核实） | 「辅助功能」 | 受限 | 拿不到消息内容与发送者，或要依赖 Electron 内部结构 |
| 微信提醒（`wechat_reminders`） | UIA 读会话列表 + 任务栏闪烁 | 微信 Mac 4.x 仍向 AX 暴露会话列表等对象（WeChat-MCP 已在用）；未读数可读 Dock 角标 | 「辅助功能」 | 受限 | 只有单一开源项目佐证；微信改版可能断；发送者识别要靠像素判断 |
| 点会话跳转（`agent_status/window_focus`、`messenger_activation`） | SetForegroundWindow、UIA 切标签页 | `NSRunningApplication.activate`；Terminal/iTerm2 用 AppleScript 按 tty 选会话；VS Code 用已有扩展 + URL scheme；窗口级激活用 AX `AXRaise` | 「自动化」（每个目标 App 单独授权）+「辅助功能」（AXRaise） | 可做 | iTerm2 的 AppleScript 已标记弃用；每个终端要单独适配 |
| AI 代理 hook 安装（`agent_status/*_hooks`） | 写 `%USERPROFILE%\.claude` 等，PowerShell 脚本 | 路径换成 `~/.claude` 等；钩子脚本改 sh 或直接调用 Node/岛屿自带二进制 | 无 | 可做 | hook 运行时 PATH 不含 `/opt/homebrew/bin`，必须写绝对路径 |
| 插件宿主（`plugin_host`） | 子进程 + Job Object；示例插件 PowerShell | 子进程放进独立进程组（`setpgid`），退出时 `killpg`；岛屿崩溃时子进程自查父进程（kqueue `NOTE_EXIT`）；pwsh 需用户自装 | 无 | 可做 | 没有 Job Object 的「父死子随」，要自己补；PowerShell 示例插件在 Mac 上不能默认可用 |
| 插件网页视图（`win32/webview_page`） | 直接创建 WebView2 子窗口 | 改用 Tauri 多 webview / 子窗口（未核实 Tauri 2 的 `unstable` 多 webview 在 mac 的状态） | 无 | 可做 | 需重写 |
| 桌面全部最小化（`win32/desktop`，新手引导） | Shell 的最小化全部 | 无等价公开 API；可用 AppleScript 隐藏其他 App 或 `NSWorkspace.hideOtherApplications` | 无 | 可做（行为不同） | 引导演示需重新设计 |
| SSH 隧道、cc-connect、本地 API、日历、邮件、待办、宠物 | 纯 Rust / 网络，少量 registry 读代理设置 | 系统代理读 `SCDynamicStoreCopyProxies`（`system-configuration` crate） | 无 | 可做 | 无 |
| Claude 用量（`claude_usage`） | 读注册表找 Claude 桌面版 | 读 `~/Library/Application Support/Claude` 等（未核实具体路径） | 27 起读其他开发者的容器需授权；非沙盒目录不受影响 | 可做 | 若目标数据在容器里会被 27 的新限制挡住 |

### 建议

**第一期（自用版能跑、对外可发布）**：悬浮岛窗口、菜单栏图标、开机自启（SMAppService）、Keychain、全局快捷键（不劫持系统键）、`fuyu://`、单实例、自动更新（含签名公证）、待办/日历/邮件/翻译（含 Vision OCR）、音量、摄像头麦克风占用（设备级）、设备插拔与电源、AI 代理状态与 hook、插件宿主（Node 插件优先）、截图（ScreenCaptureKit）、剪贴板历史。理由：都有公开 API，权限是常规的「辅助功能 / 屏幕录制」，能过公证；这些覆盖了浮屿的主要日常价值。

**第一期可选（需要用户拍板接受私有 API）**：媒体控制与歌词（mediaremote-adapter），亮度（DisplayServices / DDC）。这两项在 Mac 上的同类产品（boring.notch、MonitorControl）都靠私有 API 在做，技术上成熟，但随系统更新可能失效；放进单独的模块，失败时整块隐藏，不影响其他功能。

**先不做**：读系统通知（没有公开途径，数据库方案与 Apple 的修补方向冲突，对外发布不应依赖）；QQ/微信的消息内容读取。第二期可以先做「Dock 角标未读数」这一档（只要辅助功能权限，Doll 已验证可行），微信的会话列表读取等有 Mac 实机后再评估。

**分发方式**：只能走 Developer ID 签名 + 公证的直接下载（dmg + updater），不能上 Mac App Store：沙盒下辅助功能、AppleScript 控制其他 App、私有 API、读其他 App 的 Dock 角标都不可用（推测，基于沙盒的一般限制，未逐项核实）。

**最低版本**（推测，供拍板）：建议 **macOS 14 Sonoma**。13 能用 SMAppService，但截图的 `SCScreenshotManager` 和麦克风按进程检测都要 14；15/26/27 的限制（剪贴板提示、每月录屏提示、组容器）在 14 起的代码路径里都能按运行时版本分支处理。若只考虑 Apple Silicon 也没问题（27 已放弃 Intel），但 15/26 仍支持 Intel，构建两个架构或 universal 成本不高。

## 详细

### 1. 浮屿用到的原生能力清单（来自代码）

`src-tauri/src/win32/` 下的封装和调用它们的模块（2026-11-13 的 lane/1 工作树）：

- 窗口与输入：`window`、`dwm`、`input`（Alt/鼠标状态、模拟 Ctrl+C/V/Enter）、`win_key_hook`（Win+V、小键盘）、`hotkey`、`shell_hook`、`taskbar`（任务栏按钮闪烁）、`desktop`（最小化全部）、`message_window`、`message_box`
- 系统：`registry`、`known_folder`、`credentials`、`url_protocol`、`power`、`session_notifications`（锁屏、空闲）、`notification_state`（全屏/勿扰）、`chinese`（简繁转换，用于歌词）
- 媒体与设备：`audio`、`audio_outputs`、`brightness`、`devnode`（设备容器、蓝牙电量）、`capture_targets`、`screen_capture`、`ocr`
- 进程：`process*`、`job`（Job Object）、`process_tree`、`process_env`、`process_times`
- 读其他应用：`uia_list`、`uia_tabs`（UI Automation）、`webview_page`、`ole`（拖放）
- 另有 WinRT：`Media_Control`（SMTC）、`UI_Notifications_Management`、`Media_Ocr`、`Networking_Connectivity`

`chinese`（LCMapStringEx 简繁转换）在 Mac 上没有同名 API，可用 `NSString.applyingTransform`（ICU 的 `Hans-Hant`）或纯 Rust 的 OpenCC 实现（未核实具体 crate）。

### 2. 窗口、托盘、自启、凭据、链接、更新

- **透明窗口**：Tauri 配置里的 `macOSPrivateApi` 原用于开启透明背景，文档说 2.12.1 起是空操作、API 总是开启（[Tauri config 参考，查询于 2026-11-13](https://v2.tauri.app/reference/config/)）。旧版本 Tauri 开这个选项意味着不能上 App Store（未核实，常见说法）。
- **NSPanel**：`tauri-nspanel` 能把 Tauri 窗口转成 NSPanel，支持 Tauri v2（`v2.1` 分支），MIT/Apache-2.0，428 star（[GitHub，查询于 2026-11-13](https://github.com/ahkohd/tauri-nspanel)）。README 没写是否能浮在全屏 App 上，这要靠 `NSWindowCollectionBehavior.canJoinAllSpaces | fullScreenAuxiliary`（未核实，依据 AppKit 常识）。boring.notch 这类刘海应用就是这类窗口。
- **开机自启**：`tauri-plugin-autostart` 的 `MacosLauncher` 只有 `LaunchAgent`（写 `~/Library/LaunchAgents` plist）和 `AppleScript`（通过 System Events 加登录项）两种（[docs.rs，查询于 2026-11-13](https://docs.rs/tauri-plugin-autostart/latest/tauri_plugin_autostart/enum.MacosLauncher.html)）。Apple 推荐的是 macOS 13 起的 `SMAppService.mainApp`（[Apple 文档](https://developer.apple.com/documentation/servicemanagement/smappservice)；页面正文本次没抓到，最低版本 13 与 `requiresApproval` 状态出自常识，未核实）。分析：AppleScript 方式需要「自动化」授权，LaunchAgent 方式在 13 起会出现在「允许在后台」列表里且显示为脚本而非 App 名，体验都不如 SMAppService。
- **Keychain**：仓库用的 `keyring` 4.x 有 `apple-native-keyring-store` feature（子 feature `keychain` 默认、`protected` 可选）（[docs.rs features，查询于 2026-11-13](https://docs.rs/crate/keyring/latest/features)）。数据格式要与 Windows 一致才能共用 `contracts.md` 里的凭据条目名。
- **`fuyu://`**：`tauri-plugin-deep-link` 在 macOS 上**不能运行时注册**，只能打包声明，并且只能在装到 `/Applications` 的打包产物上测试；运行中收到链接用 `on_open_url`，启动时用 `get_current`（[Tauri 文档，查询于 2026-11-13](https://v2.tauri.app/plugin/deep-linking/)）。浮屿现在 Windows 是运行时写注册表，Mac 上这个流程改成纯配置。
- **自动更新**：macOS 用 `.app.tar.gz` 和 `.sig`，平台键 `darwin-aarch64` / `darwin-x86_64`，签名不能关闭（[Tauri updater，查询于 2026-11-13](https://v2.tauri.app/plugin/updater/)）。`latest.json` 格式属于对外契约，加平台键是兼容扩展，旧版 Windows 岛屿只读自己的键（推测）。Developer ID 签名与公证页面未涉及，属于另一份发布流程调研。

### 3. 全局快捷键与 Win+V

- 普通全局快捷键：`tauri-plugin-global-shortcut` / `global-hotkey` crate 在 macOS 上基于 Carbon `RegisterEventHotKey`，不需要权限（未核实，依据 crate 源码常识）。
- Windows 上接管 Win+V 用的是低级键盘钩子。Mac 上等价的是 `CGEventTap`，需要「辅助功能」或「输入监控」权限（未核实）。Mac 上剪贴板管理器的惯例是 ⌘⇧V 或自定义键，而不是改 ⌘V；另外有文章称 macOS 26 Tahoe 的 Spotlight 自带剪贴板历史（[DEV Community，只看到标题，未打开](https://dev.to/jrw0ng/macos-tahoe-has-built-in-clipboard-history-heres-what-its-still-missing-for-developers-2026-4eko)），默认快捷键要避开冲突（未核实具体键）。
- 截图的小键盘数字钩子同理，Mac 键盘多数没有小键盘，建议改设计。

### 4. 媒体控制与同步歌词（重点）

事实：

- macOS 15.4 起，`mediaremoted` 加了权利检查，没有所需权利的客户端拿不到 NowPlaying 信息（[media-remote crate README，查询于 2026-11-13](https://docs.rs/crate/media-remote/0.3.7/source/README.md)）；nowplaying-cli、Keyboard Maestro、BetterTouchTool 都受影响（[nowplaying-cli #28，查询于 2026-11-13](https://github.com/kirtan-shah/nowplaying-cli/issues/28)、[Keyboard Maestro 论坛](https://forum.keyboardmaestro.com/t/beware-upgrading-to-macos-15-4-if-you-need-now-playing-data/40285)）。
- **mediaremote-adapter**（ungive，BSD-3-Clause，307 star，查询于 2026-11-13）：用系统自带的 `/usr/bin/perl`（bundle id 为 `com.apple.perl`，属于有权限的 `com.apple.` 前缀进程）动态加载一个自带的 `MediaRemoteAdapter.framework`，把正在播放信息以 JSON 打到 stdout；你的 App 只调用脚本，不直接链接私有框架。README 写支持「所有 macOS 版本，包括 15.4 及以上」，测试徽章显示最近在 macOS 27.0 上测过（2026-09-04）。已知限制：API 仍可能破坏性变化；`get` 可能暂时缺封面；只提供 x86_64 与 arm64；TIDAL 需要防抖选项（[GitHub](https://github.com/ungive/mediaremote-adapter)）。「`com.apple.` 前缀即有权限」是社区研究结论，不是 Apple 文档。
- 同作者还有 `media-control` 命令行工具（Homebrew 安装、`stream` 子命令），nowplaying-cli 2026-04-05 的版本也已改用 adapter 的代码恢复 15、26 的支持（[nowplaying-cli #28](https://github.com/kirtan-shah/nowplaying-cli/issues/28)）。
- **boring.notch**（GPL-3.0，11.3k star，最低 macOS 14，查询于 2026-11-13）致谢中写明靠 MediaRemoteAdapter 在 15.4+ 拿到 Now Playing（[GitHub](https://github.com/TheBoredTeam/boring.notch)）。
- **Rust**：`media-remote` crate 0.3.7 封装了 MediaRemote，并提供三种 15.4+ 方案：内嵌 Perl 适配器（推荐，支持实时更新与封面，会多一个 perl 后台进程）、AppleScript/JXA（无封面、轮询）、代码注入（需关 SIP，不考虑）（[docs.rs](https://docs.rs/crate/media-remote/0.3.7/source/README.md)）。
- AppleScript 覆盖面：只能针对提供脚本字典的播放器（Music、Spotify 等）分别写脚本，浏览器里的视频、网易云等拿不到（[nowplaying-cli #28 中的讨论](https://github.com/kirtan-shah/nowplaying-cli/issues/28)；网易云不支持属于推测）。另有人用 AppleScript 调私有 `MRNowPlayingRequest` 做通用方案（[SKaplanOfficial gist](https://gist.github.com/SKaplanOfficial/f9f5bdd6455436203d0d318c078358de)，未打开核对）。

macOS 27 现状：除了 adapter 的 CI 徽章，没有找到 27 上 MediaRemote 是否再次收紧的报道；adapter 的 issue 里也没看到 27 相关的破坏（[issue 搜索，查询于 2026-11-13](https://github.com/ungive/mediaremote-adapter/issues?q=is%3Aissue+27)）。**未核实**，要在 27 实机上测。

分析：Windows 的 SMTC 是公开 API，Mac 上没有对等的公开 API，这一项在 Mac 上永远是「私有 API + 社区绕法」。adapter 走的是子进程 + JSON 流，正好和浮屿插件宿主的子进程模型相似，集成成本低；BSD-3 许可与 GPL-3.0 的浮屿兼容。歌词本身（`lyrics/` 走网络）不受影响，只依赖拿到的曲名、进度。

### 5. 剪贴板

- 事实：Apple 宣布从 macOS 15.4 开始，App 以编程方式读通用剪贴板（不是由用户的粘贴操作触发）时系统会提示；提示里的「允许」只管一次，「隐私与安全性 → 粘贴自其他 App」有询问/允许/拒绝三档。`detect` 系列方法只判断类型不读内容，不会触发提示；只读属性 `accessBehavior` 能查当前是允许、拒绝还是会询问。剪贴板管理器 ClipBar 遇到每次变化都弹提示，最后用启动时的说明框引导用户去设置里永久允许才过审（[mjtsai.com，查询于 2026-11-13](https://mjtsai.com/blog/2025/05/12/pasteboard-privacy-preview-in-macos-15-4)、[MacRumors](https://www.macrumors.com/2025/05/12/apple-mac-apps-clipboard-change/)、[Apple 文档 accessBehavior](https://developer.apple.com/documentation/appkit/nspasteboard/accessbehavior-swift.enum/default.md)）。
- 现状：2025-09 有开发者反映 macOS 26 里除非用 defaults 手动打开，这个特性实际没有启用；2026-09-21 有评论说 27.2 beta 2 起开发者预览开关 `EnablePasteboardPrivacyDeveloperPreview` 已弃用、不再起作用（同上 mjtsai 页面评论）。弃用开关可能意味着要正式启用，也可能意味着放弃，**未核实**。
- `changeCount`：这次的来源都没提它是否触发提示。按 iOS 的经验它不触发（推测）。轮询 `changeCount` + 变化后读取，是 Maccy 等的通用做法（未核实）。
- 粘贴回目标 App：Mac 上通常写剪贴板后用 CGEvent 模拟 ⌘V，需要「辅助功能」权限（未核实）。
- 分析：实现上没有障碍，风险全在隐私提示上线后的体验。代码层面应提前用 `accessBehavior` 判断，并准备引导页。

### 6. 截图与 OCR

- 事实：Sequoia 起使用 ScreenCaptureKit 的 App 也会被要求重新确认录屏权限，测试版中从每周改为每月，提示有「允许一个月」和「打开系统设置」两个选项；Craig Hockenberry 提到过「Persistent Content Capture」权利可能能免除提示，但 Apple 没有公开如何申请（[9to5mac，2024-08-14](https://9to5mac.com/2024/08/14/macos-sequoia-screen-recording-prompt-monthly/)）。受影响的 App 包括 CleanShot X、Zoom、Bartender。
- 截图 API：`SCScreenshotManager` 是 macOS 14 起的单帧截图 API，`CGWindowListCreateImage` 在 14 起已弃用（未核实，依据 Apple SDK 常识）。系统的 `SCContentSharingPicker`（14+）由用户选择内容、不需要提前授权（未核实），但不适合「框选区域」的截图交互。
- OCR：Vision 的 `VNRecognizeTextRequest`；Rust 有 `objc2-vision`（objc2 生成的绑定）和 `apple-vision`（较高层封装，0.16.x）（[docs.rs objc2-vision](https://docs.rs/crate/objc2-vision/latest/source/README.md)、[docs.rs apple-vision](https://docs.rs/crate/apple-vision/latest)，只看到搜索结果，未打开）。中文识别支持的最低版本未核实。
- 分析：截图是能做的，但每月一次的系统提示无法规避，要在产品文案里说明。

### 7. 音量、亮度、摄像头麦克风、设备事件

- **亮度**：MonitorControl（MIT，34.7k star，查询于 2026-11-13）外接屏走 DDC，内建屏和 Apple 显示器走「原生 Apple 协议」；M1 与入门 M2 Mac mini、2018 Intel Mac mini 的内建 HDMI 口不支持 DDC；只有用原生亮度/媒体键时才需要辅助功能权限；macOS 27 需要 v4.4.0 以上（[GitHub](https://github.com/MonitorControl/MonitorControl)）。README 没写具体用了哪些私有框架；内建屏用 `DisplayServices`、Apple Silicon 的 DDC 用 `IOAVService` 是社区常见说法，**未核实**。
- **麦克风/摄像头占用**：`kAudioDevicePropertyDeviceIsRunningSomewhere` 能判断麦克风设备是否被某个进程使用，但蓝牙麦克风一直报未使用，Apple 工程师 2024-10 回复需要调查（[Apple 论坛 741026](https://developer.apple.com/forums/thread/741026)）。摄像头对应 `kCMIODevicePropertyDeviceIsRunningSomewhere`（[Apple 论坛 697124](https://developer.apple.com/forums/thread/697124)，只看到标题）；OverSight、`is-camera-on` 用的是这类属性（[Objective-See](https://objective-see.org/products/oversight.html)，未打开）。按进程区分麦克风使用者可用 macOS 14 起的 `kAudioHardwarePropertyProcessObjectList` + `kAudioProcessPropertyIsRunningInput` / `PID` / `BundleID`（出自 CoreAudio 头文件，经抓取工具转述，**未核实**）。Windows 版能列出「哪些 App 在用」，Mac 上摄像头这一项只能做到「有没有在用」。
- **音量**：CoreAudio 默认输出设备的音量与静音属性，Rust 有 `coreaudio-rs`、`objc2-core-audio`（未核实版本）。
- **设备插拔与电源**：IOKit 匹配通知与 IOPowerSources（未核实，Apple 常规 API）。

### 8. 读系统通知

- 事实：Sequoia 之前，通知中心数据库放在 `/private/var/folders` 的临时目录里，任何进程都能读；Sequoia 把它移到 `~/Library/Group Containers/group.com.apple.usernoted/db2/db`，受 TCC 保护（[9to5mac，2024-09-01](https://9to5mac.com/2024/09/01/security-bite-apple-addresses-privacy-concerns-around-notification-center-database-in-macos-sequoia/)、[mjtsai](https://mjtsai.com/blog/2024/07/15/sequoia-finally-addresses-notification-center-privacy)）。之后还有相关 CVE（CVE-2024-40838、CVE-2025-24142，标题为「恶意 App 可能访问通知」，[来源](https://radar.offseq.com/threat/cve-2024-40838-a-malicious-app-may-be-able-to-acce-2929bd85)，只看到标题）。
- 有第三方文章称 macOS 27 起访问其他开发者的应用容器和组容器不再弹提示而是默认拒绝，需在隐私设置里授权，完全磁盘访问也覆盖（[macos-tahoe.com](https://macos-tahoe.com/blog/macos-27-app-data-containers-access-denied-operation-not-permitted-fix-2026/)；非 Apple 来源，**未核实**）。
- 分析：完全磁盘访问「可能」能读到数据库（mjtsai 作者只是推测），但这是让用户为一个提醒功能授予最高级别的文件权限，加上 Apple 把读通知当漏洞修，对外发布不应做。macOS 没有 Windows `UserNotificationListener` 的对应公开 API。

### 9. QQ 与微信

- **Dock 角标**：Doll（1.2k star）用辅助功能 API 读 Dock 元素上各 App 的角标文字，每秒轮询（AX 没法监听属性变化），需要辅助功能权限（[GitHub，查询于 2026-11-13](https://github.com/xiaogdgenuine/Doll)）。属性名 `AXStatusLabel` 出自搜索摘要，未打开核对。这一档只能拿到「有几条未读」，不知道是谁。
- **微信 Mac 4.x**：2026-03-27 的一份调研认为，Windows 版微信 4.0.5 改用 Qt Quick 渲染后 UIA 只剩空壳窗口，而 Mac 版 4.x 仍向辅助功能 API 暴露会话列表等对象；WeChat-MCP（133 star）用 AX 导航到会话、读可见消息，但 AX 树不暴露发送者，靠气泡两侧像素颜色猜「自己还是对方」（[yage.ai 调研](https://yage.ai/share/wechat-uia-platform-feasibility-survey-20260327.html)、[WeChat-MCP](https://glama.ai/mcp/servers/@BiboyQG/WeChat-MCP)）。该调研本身说结论可能几个月就过期，且只基于一个项目。仓库里已有 `docs/research/wechat-message-content.md` 关于 Windows 的调研，可对照。
- **QQ（NTQQ）**：NTQQ 已用 Electron 统一三端（[36kr](https://www.36kr.com/p/2329529869966977)，只看到标题）。没有找到在 Mac 上通过 AX 读 NTQQ 未读或消息的开源项目。Electron 应用默认不构建完整 AX 树，外部辅助工具可通过设置 `AXManualAccessibility` 属性让它开启（[Electron 无障碍文档](https://electronjs.org/docs/latest/tutorial/accessibility)，只看到标题，**未核实**）。
- 分析：Mac 上现实的路线是「Dock 角标未读数」做提醒、点击后激活 QQ/微信；读会话名或消息内容需要逐版本跟进 AX 结构，放到后期。

### 10. AI 代理：hook 安装与跳转

- hook 安装：Claude Code、Codex 的配置目录在 Mac 上是 `~/.claude`、`~/.codex`（未核实 Codex）。浮屿现在把钩子脚本 `include_str!` 进二进制，Windows 版是 PowerShell；Mac 上改 sh 或让钩子直接调用 Node / 岛屿内的小工具。hook 进程不加载 shell profile、PATH 里没有 `/opt/homebrew/bin`，命令要写绝对路径或显式补 PATH（这是本机已踩过的坑，见用户全局说明里的 Bark 推送一节）。
- 跳转到终端：iTerm2 的 AppleScript 会话对象有 `tty` 属性，可以按 tty 找到会话；但 `select` 不会切换窗口焦点，需要再选标签、调窗口顺序并 `activate`；iTerm2 官方已把 AppleScript 标为弃用、推荐 Python API（[iTerm2 文档](https://iterm2.com/applescript.html)，只看到搜索摘要）。Rust 的 `claudectl` crate 已实现这套逻辑（遍历窗口/标签/会话匹配 tty → select → `set index of w to 1` → activate），`focal` crate 用 JXA + System Events 的 `AXRaise` 只抬起目标窗口（[claudectl iterm2.rs](https://docs.rs/crate/claudectl/latest/source/src/terminals/iterm2.rs)、[focal iterm2.rs](https://docs.rs/crate/focal/0.2.8/source/src/terminals/iterm2.rs)，只看到搜索摘要）。Terminal.app 也有按 tty 的 AppleScript（未核实）。
- 编辑器：浮屿已有 VS Code 扩展（`packages/vscode-extension`），Mac 上可沿用「扩展 + URL」切终端的方式（`vscode://` 打开扩展 URI 处理器，未核实细节）。
- 权限：AppleScript 控制其他 App 需要用户对每个目标 App 授权「自动化」，Info.plist 需写 `NSAppleEventsUsageDescription`（未核实，Apple 常规要求）；`AXRaise` 需要辅助功能。

### 11. 插件宿主

- pwsh：PowerShell 7 在 macOS 15/26/27 有官方支持，PKG 从 2026 年 5 月起由微软签名公证，安装后在 `/usr/local/bin/pwsh`；系统不自带（[Microsoft Learn，查询于 2026-11-13](https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-macos)）。所以 PowerShell 示例插件在 Mac 上要求用户自装，Node SDK 插件也要求有 Node（未核实浮屿是否自带 Node 运行时）。
- 子进程管理：Windows 用 Job Object 保证岛屿退出时子进程一起结束。Mac 没有等价物，常规做法是子进程放进新的进程组、退出时 `killpg`，再加子进程侧监听父进程退出（kqueue `EVFILT_PROC` + `NOTE_EXIT`）或 stdin 关闭即退出（未核实，POSIX 常识）。插件协议是 stdio JSON-RPC 的话（`plugin_host/rpc.rs`），「stdin EOF 即退出」最简单。

### 需要用户拍板的问题

1. 是否接受私有 API：媒体控制（mediaremote-adapter，经 `/usr/bin/perl`）、亮度（DisplayServices / DDC）。不接受则 Mac 版没有「正在播放」和歌词。
2. 最低 macOS 版本：建议 14；选 13 要放弃 ScreenCaptureKit 单帧截图与按进程麦克风检测，选 15 会少一部分用户（未核实各版本装机比例）。
3. 是否同时支持 Intel：27 已只支持 Apple Silicon，但 15/26 仍有 Intel 用户。
4. 通知读取与 QQ/微信消息内容：是否接受 Mac 版只做「未读数提醒」。
5. 剪贴板历史若触发系统提示，是否接受在首次启动时引导用户去设置里永久允许。
6. 分发方式：确认只做 Developer ID + 公证的直接下载，不上 Mac App Store（需要 Apple 开发者账号，年费）。

## 来源

查询日期均为 2026-11-13，标「只看到标题/摘要」的未打开页面。

- Microsoft Learn：[Install PowerShell 7 on macOS](https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-macos)
- Tauri：[config 参考](https://v2.tauri.app/reference/config/)、[deep-linking](https://v2.tauri.app/plugin/deep-linking/)、[updater](https://v2.tauri.app/plugin/updater/)、[autostart](https://v2.tauri.app/plugin/autostart/)、[MacosLauncher](https://docs.rs/tauri-plugin-autostart/latest/tauri_plugin_autostart/enum.MacosLauncher.html)
- [tauri-nspanel](https://github.com/ahkohd/tauri-nspanel)、[keyring features](https://docs.rs/crate/keyring/latest/features)
- Apple：[SMAppService](https://developer.apple.com/documentation/servicemanagement/smappservice)、[NSPasteboard accessBehavior](https://developer.apple.com/documentation/appkit/nspasteboard/accessbehavior-swift.enum/default.md)、[论坛 741026（麦克风占用）](https://developer.apple.com/forums/thread/741026)、[论坛 697124（摄像头占用，只看到标题）](https://developer.apple.com/forums/thread/697124)、[论坛 847151（与第三方 MediaRemote 无关，排除）](https://developer.apple.com/forums/thread/847151)
- 媒体：[mediaremote-adapter](https://github.com/ungive/mediaremote-adapter)、[issue 搜索](https://github.com/ungive/mediaremote-adapter/issues?q=is%3Aissue+27)、[media-remote crate](https://docs.rs/crate/media-remote/0.3.7/source/README.md)、[nowplaying-cli #28](https://github.com/kirtan-shah/nowplaying-cli/issues/28)、[boring.notch](https://github.com/TheBoredTeam/boring.notch)、[Keyboard Maestro 论坛](https://forum.keyboardmaestro.com/t/beware-upgrading-to-macos-15-4-if-you-need-now-playing-data/40285)、[SKaplanOfficial gist（只看到标题）](https://gist.github.com/SKaplanOfficial/f9f5bdd6455436203d0d318c078358de)
- 剪贴板：[mjtsai：Pasteboard Privacy Preview in macOS 15.4](https://mjtsai.com/blog/2025/05/12/pasteboard-privacy-preview-in-macos-15-4)、[MacRumors（只看到标题）](https://www.macrumors.com/2025/05/12/apple-mac-apps-clipboard-change/)、[DEV Community：Tahoe 自带剪贴板历史（只看到标题）](https://dev.to/jrw0ng/macos-tahoe-has-built-in-clipboard-history-heres-what-its-still-missing-for-developers-2026-4eko)
- 截图：[9to5mac：Sequoia 录屏提示改为每月](https://9to5mac.com/2024/08/14/macos-sequoia-screen-recording-prompt-monthly/)；OCR：[objc2-vision](https://docs.rs/crate/objc2-vision/latest/source/README.md)、[apple-vision](https://docs.rs/crate/apple-vision/latest)（只看到摘要）
- 亮度与设备：[MonitorControl](https://github.com/MonitorControl/MonitorControl)、[OverSight（只看到标题）](https://objective-see.org/products/oversight.html)
- 通知：[9to5mac：Sequoia 通知数据库](https://9to5mac.com/2024/09/01/security-bite-apple-addresses-privacy-concerns-around-notification-center-database-in-macos-sequoia/)、[mjtsai：Sequoia Finally Addresses Notification Center Privacy](https://mjtsai.com/blog/2024/07/15/sequoia-finally-addresses-notification-center-privacy)、[CVE-2024-40838（只看到标题）](https://radar.offseq.com/threat/cve-2024-40838-a-malicious-app-may-be-able-to-acce-2929bd85)、[macos-tahoe.com：macOS 27 容器访问（非官方）](https://macos-tahoe.com/blog/macos-27-app-data-containers-access-denied-operation-not-permitted-fix-2026/)
- QQ/微信：[Doll](https://github.com/xiaogdgenuine/Doll)、[yage.ai 微信 UIA 平台可行性调研（2026-03-27）](https://yage.ai/share/wechat-uia-platform-feasibility-survey-20260327.html)、[WeChat-MCP](https://glama.ai/mcp/servers/@BiboyQG/WeChat-MCP)、[36kr：QQ 用 Electron 重构（只看到标题）](https://www.36kr.com/p/2329529869966977)、[Electron 无障碍文档（只看到标题）](https://electronjs.org/docs/latest/tutorial/accessibility)
- 终端跳转：[iTerm2 AppleScript](https://iterm2.com/applescript.html)、[claudectl iterm2.rs](https://docs.rs/crate/claudectl/latest/source/src/terminals/iterm2.rs)、[focal iterm2.rs](https://docs.rs/crate/focal/0.2.8/source/src/terminals/iterm2.rs)（均只看到摘要）
