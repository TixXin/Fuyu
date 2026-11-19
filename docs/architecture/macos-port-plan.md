# macOS 适配计划

目标：让浮屿在 macOS 上可用，既供用户自己日常使用，也正式对外发布（用户 2026-11-13 定）。Windows 版的行为在整个过程中不变。

总任务 [G1](/docs/tasks/G/G1.md)，每一步对应若干子任务。各功能在每个平台上的支持情况以 [platforms.md](platforms.md) 为准，本文只记计划、决定和进度。全部做完后本文移到 `history/`，`platforms.md` 留着继续维护。

## 依据

调研（2026-11-13）：

- [macOS 上各功能的系统 API 与权限](../research/macos-platform-apis.md)
- [用 Tauri 2 在 macOS 上做悬浮岛窗口](../research/macos-tauri-window.md)
- [macOS 版的打包、签名、分发与更新](../research/macos-distribution.md)
- [macOS 刘海岛 / 灵动岛类应用调研](../research/macos-notch-apps.md)

要点：

- 大部分功能有公开 API，可以做；媒体控制与歌词、亮度只能靠私有 API；读其他应用的系统通知基本做不了，QQ / 微信提醒在 Mac 上最多做到读 Dock 角标的未读数。
- 悬浮岛要用 NSPanel（`tauri-nspanel`）加 `ActivationPolicy::Accessory`，才能浮在全屏应用之上、出现在所有桌面、点了不抢焦点。
- 对外发布必须 Developer ID 签名加公证（个人开发者账号 99 美元/年），不上 Mac App Store。
- 通用刘海岛在 Mac 上是红海；浮屿的定位是「中文效率岛 + AI 代理 + 插件市场 + Windows / Mac 两端都有」。

## 执行规则

- 按步骤顺序推进；同一步里互不依赖的子项可以调整顺序。每个子任务完成时，在同一个提交里：勾掉本文的复选框，在「进度记录」追加一行，`pnpm tasks done` 对应子任务，更新 [platforms.md](platforms.md) 里状态变了的行。
- **Windows 零回归**：每个改动 Rust 的提交都要过 CI 的 Windows `rust` job；改窗口、托盘、注册表的提交另请用户在 Windows 上 `pnpm build:exe` 试用。
- 结构性搬迁按 AGENTS.md「重构约定」：搬迁和改写分开提交，搬迁提交用 `refactor(<范围>): ...`，零行为变化。
- 新的系统 API 调用（`unsafe`、objc2、私有框架）只放在平台层（见决定 M10），业务模块不直接调。
- 用到私有 API 的能力都要有开关、有降级、失效时告诉用户，不能让整个岛跟着出问题。
- 新增或改变对外契约（数据目录、Keychain 条目、`latest.json` 的键、链接协议、Tauri 命令）时，同步写进 [contracts.md](contracts.md) 和 [data-storage.md](data-storage.md)。
- 踩到值得记录的坑，写成 `docs/investigations/macos-<主题>.md`，在本文「备注」里留一行链接。
- 做了决定立刻写进下面的「决定」表；改变界面形态的决定同时写进 `docs/design/macos.md`（第一个界面决定确认后再建这个文件）。

## 决定

用户拍板记在子任务 [G1.1](/docs/tasks/G/G1.1.md)。状态：**待定**（等用户拍板）、**已定**（写明日期和谁定的）、**建议**（Agent 的推荐，用户没反对前按它做）。

| 编号 | 问题 | 选项 | 推荐 | 状态 |
|---|---|---|---|---|
| M1 | Apple 开发者账号 | 现在就买 / 先用自签名证书自用，第 3 步前再买 | 第 3 步开始前买；在那之前用钥匙串里的自签名证书签名，避免每次重编后辅助功能等授权失效 | 已定（2026-11-13，用户）：正式发布时再买，之前只在本机用自签名证书测试 |
| M2 | 最低 macOS 版本 | 13 / 14 / 15 | 14：截图的 `SCScreenshotManager`、麦克风按进程检测都要 14；主流竞品的下限也是 14 | 已定（2026-11-13，用户）：**15**，不写 15 以下的兼容分支 |
| M3 | 芯片架构 | universal / 只发 Apple Silicon | universal：额外成本主要是包体积和 CI 时间；但手上只有 Apple Silicon 能测，Intel 出问题只能尽力修。macOS 27 起已不支持 Intel | 已定（2026-11-13，用户）：**只发 Apple Silicon**（`aarch64-apple-darwin`） |
| M4 | 岛的位置 | 刘海处 / 顶部正中 | 先做顶部正中（无刘海屏和外接屏本来就要这种形态），刘海形态作为第 2 步的可选项 | 已定（2026-11-13，用户）：按推荐 |
| M5 | 顶部正中时与菜单栏的关系 | 压在菜单栏上 / 贴在菜单栏下面 | 贴在菜单栏下面，不挡应用菜单和状态图标 | 已定（2026-11-13，用户）：**默认压在菜单栏上**，设置里可改成贴在菜单栏下面 |
| M6 | 有全屏应用时 | 照常显示 / 隐藏，有提醒时短暂出现 | 隐藏，有提醒时短暂出现（竞品用户呼声最高的需求之一） | 已定（2026-11-13，用户）：**两种都做，设置里选**；默认按推荐 |
| M7 | 私有 API（媒体与歌词、亮度） | 接受，做成可关、可降级的模块 / 不做 | 接受，放进单独模块，失效时整块隐藏 | 已定（2026-11-13，用户）：按推荐 |
| M8 | QQ / 微信提醒 | 只做 Dock 角标未读数 / 先做技术验证再决定 / 不做 | 先做技术验证，对外只承诺未读数 | 已定（2026-11-13，用户）：按推荐 |
| M9 | Tauri 升级与 `tauri-nspanel` | 升到 ≥ 2.12.1 并依赖 `tauri-nspanel` / 自己用 objc2 改 NSWindow | 升级 Tauri（单独提交）；用 `tauri-nspanel`，同时把用到的部分封装在平台层，日后能换成自己的实现 | 已定（2026-11-13，用户）：按推荐 |
| M10 | 平台层目录 | 保留 `win32/`，新建同级 `macos/` / 统一改名为 `platform/{windows,macos}` | 保留 `win32/`、新建 `macos/`：搬迁量小，`unsafe` 只在这两处的规则直接沿用 | 已定（2026-11-13，用户）：按推荐 |
| M11 | Mac 包怎么出 | CI 的 macOS runner 出 Mac 包、Windows 包继续本机出 / 整个发布搬到 Actions | Mac 包在 CI 出，两边上传到同一个 Release 草稿，再由本机汇总 `latest.json` | 已定（2026-11-13，用户）：按推荐 |
| M12 | 两个平台是否同时发版 | 必须同时 / Mac 可以落后 | 必须同时：`latest.json` 只有一份，Mac 落后时 Mac 用户检查更新会报错 | 已定（2026-11-13，用户）：按推荐 |
| M13 | 收费 | 免费 / 赞助 / 付费分发渠道 | 免费（项目是 AGPL-3.0），以后再议 | 已定（2026-11-13，用户）：按推荐 |
| M14 | 剪贴板历史触发系统隐私提示时 | 首次启动引导用户在设置里永久允许 / 只在出现提示时说明 | 首次用到时引导一次 | 已定（2026-11-13，用户）：按推荐 |

## 第 0 步：在 Mac 上能编译、能跑测试

不改任何功能，只让 Rust 端在 macOS 上编得过、`cargo test` 跑得起来。这一步的收益和要不要出 Mac 版无关：代理在 Mac 上就能跑 Rust 测试和 clippy。

- [x] **G1.2 平台隔离。**
  - 先列迁移表：`src-tauri/src` 里直接用 `windows::` 或 `crate::win32` 的模块（2026-11-13 约 26 个，`win32/` 约 3400 行），每个模块写清楚 Mac 上是「暂不支持」「换实现」还是「通用」。表写在本节下面。
  - `windows`、`windows-future` 等依赖挪到 `[target.'cfg(windows)'.dependencies]`；`win32/` 和直接调 Windows API 的代码加 `cfg(windows)`，Mac 上先给「不支持」的空实现。
  - 前端：新增查询平台和能力的命令，Mac 上不支持的功能在设置和岛上隐藏，不报错。（2026-11-13 已做：命令 `get_platform_support`；设置侧边栏隐藏音乐、翻译、剪贴板、截图、手机连接、远程主机，消息页隐藏 QQ 和微信；岛上这些页面关掉，快捷键跳过）
  - CI 加一个 `macos-latest` 的 `cargo check` + `cargo test` + clippy job，并入 `check` 汇总。
  - 验收：Mac 上 `cargo test`、clippy 通过；Windows 上 CI 全绿、行为不变；`pnpm tauri dev` 在 Mac 上能启动出一个窗口（形态不要求）。

## 第 1 步：Mac 上能日常使用

- [ ] **G1.3 悬浮岛窗口。** Tauri 升到 ≥ 2.12.1（单独提交，M9）；主窗口用 `tauri-nspanel` 转成非激活 NSPanel，`collectionBehavior` 设所有桌面、全屏辅助、不进 Cmd+Tab；`ActivationPolicy::Accessory`；鼠标穿透沿用「轮询 + 整窗开关」；定位改用逻辑坐标，避开多显示器缩放比不同时的坐标 bug（tauri#7890、tao#816）；顶部正中形态（M4；默认压在菜单栏上，设置里可改成贴在菜单栏下面，M5），全屏应用时照常显示还是隐藏做成设置（M6），界面约定见 [design/macos.md](../design/macos.md)。新手引导遮罩和截图选区窗口在 Mac 上可用。验收：Retina 内屏 + 1x 外接屏下定位正确；两种菜单栏设置下位置都正确；全屏应用时两种设置的行为都正确；点岛不抢前台焦点；打成 dmg 后透明窗口不变白（tauri#13415）。
- [x] **G1.4 系统集成。** 菜单栏图标（模板图）；开机自启用 SMAppService；凭据换 Keychain（`keyring` 的 apple-native）；全局快捷键（2026-11-13 挪到 G1.6：用它的功能在 Mac 上都还没做，随剪贴板一起做）；`fuyu://` 用 Info.plist 声明；单实例；数据目录与家目录在 Mac 上的位置写进 contracts.md 和 data-storage.md。
- [x] **G1.5 Mac 上的开发流程。** `pnpm dev:lane`、`build:exe`（Mac 上改成把 `.app` 放进 `~/Applications`）、停止运行中岛屿的脚本、`run-regression.mjs` 找浏览器、`prune:target` 等在 Mac 上可用；AGENTS.md 和 lanes.md 补 Mac 上的命令和验证要求。（2026-11-13 已做：单元测试在 Mac 上全过，市场包按解压后的内容比较；`build:exe` 装 `.app`；停止岛屿、回归页找浏览器、`--fresh` 支持 Mac；lane 预览改进程名，WebView 存储和主工作区分开）。**之后的变化**：`pnpm dev:lane` 随 F32 去掉 lane 删除（2026-11-13），现在用户自己跑 `pnpm tauri dev`，开发版用独立身份 `com.tixxin.fuyu.lane-<N>`（`dev_lane.rs`），见 [workflow.md](workflow.md)「开发版和正式版同时开」；`build:exe` 默认只打出 `src-tauri/target/release/bundle/macos/Fuyu.app`，不再碰 `~/Applications`（设 `FUYU_SYNC_SHORTCUT=1` 才放进去）
- [x] **G1.34 开发版的固定签名（M1 的开发版部分）。** `tauri dev` 经 `build.runner`（`scripts/macos/dev-cargo.sh`）编出的 `target/debug/fuyu` 用登录钥匙串里免费的 Apple Development 证书重签，标识 `com.tixxin.fuyu.dev`，带 Team ID，钥匙串的分区列表记 `teamid:`，重编后「始终允许」不再失效；没有这张证书时退回 `~/.tauri/fuyu/macos-dev/` 的自签名证书并警告（自签名没有 Team ID，分区列表记 cdhash，照样每次弹）；release 原样交给 cargo。建证书的步骤见 [workflow.md](workflow.md)「开发版和正式版同时开」。
- [ ] **G1.6 日常功能。** 全局快捷键的 Mac 平台层（Carbon `RegisterEventHotKey`，不劫持系统组合键，剪贴板默认 ⌘⇧V，从 G1.4 挪来）；剪贴板历史（`changeCount` 轮询，隐私提示按 M14）、文件中转（含拖出到 Finder）、截图（ScreenCaptureKit）和 OCR（Vision）、划词翻译（AX 读选中文字）、音量、摄像头 / 麦克风占用、设备插拔与电源、锁屏与空闲、强调色、网络计费、全屏判断。每项需要的权限在首次使用时引导，设置里能看到授权状态。
- [ ] **G1.7 AI 代理状态。** hook 安装改用 `~/.claude` 等路径和 sh 脚本，命令里写绝对路径（hook 环境的 PATH 不含 `/opt/homebrew/bin`）；点会话跳转支持 Terminal、iTerm2、VS Code（AppleScript / URL scheme / AX）；用量读取的路径。
- [ ] **G1.8 插件宿主。** 子进程放进独立进程组，退出时 `killpg`，岛屿崩溃时子进程能自己退出。2026-11-18 起（E36.6.5、E36.6.6）第 2 版插件宿主、网页视图、PowerShell 插件和清单的平台字段都已删除，这一项只剩第 3 版：`plugin_kernel/containment.rs` 把 Node 宿主交给平台层的 `Job`（Windows 是 `win32/job.rs` 的作业对象加挂起启动，Mac 是 `macos/job.rs` 的进程组，`Job` 销毁时 `killpg`），插件快捷键在 `plugin_kernel/keybindings.rs` 里按平台分开。

## 第 2 步：和系统深度绑定的功能

- [ ] **G1.9 媒体控制、歌词与亮度（私有 API，按 M7）。** 媒体读取用 mediaremote-adapter 的思路，失败时对 Apple Music / Spotify 用 AppleScript 兜底；亮度参考 MonitorControl。设置里显示当前来源和失效提示。每个 macOS 大版本发布后复测。
- [x] **G1.10 QQ / 微信提醒的技术验证（按 M8）。**（2026-11-13 已做：验证见 [macos-messengers.md](../investigations/macos-messengers.md)，并按结论做了只显示未读数的 Mac 版） 先验证读 Dock 角标未读数；微信会话列表（AX）和 NTQQ 的 `AXManualAccessibility` 只做验证、写进 `docs/investigations/`，结论出来后再决定对外承诺什么。
- [ ] **G1.15 插件自定义网页界面（待研究）。** Windows 用独立的 WebView2 页面，Mac 上暂不支持；Tauri 子 webview 有安全问题，要么自己用 WKWebView 做，见任务 G1.15。
- [ ] **G1.11 刘海形态（可选，按 M4）。** 读 `safeAreaInsets` 和 `auxiliaryTop*Area` 得到刘海几何；折叠态和刘海融为一体；无刘海屏回退到顶部正中。

## 第 3 步：签名与发布

- [ ] **G1.12 用户准备账号和证书（只有用户本人能做，M1）。** 个人开发者账号、Developer ID Application 证书（导出 `.p12`）、App Store Connect API key（`.p8`）；放进仓库 Secrets。步骤见 [macos-distribution.md](../research/macos-distribution.md)「用户本人必须做的事」。
- [ ] **G1.13 Mac 版发布流程。** `tauri.conf.json` 加 `bundle.macOS`（最低版本 15.0（M2）、entitlements、Info.plist 用途说明的中英文）；新增 macOS 发布工作流（M11），出 dmg 和 `.app.tar.gz` + `.sig`，签名、公证、staple；`make-latest-json.mjs` 写 `darwin-aarch64`（只发 Apple Silicon，M3；和 Windows 同时发版，M12）；冒烟测试加 macOS（`spctl`、`stapler validate`、能启动）；发布后核对两个通道都有 darwin 条目；自建 Homebrew tap。改动清单见 [macos-distribution.md](../research/macos-distribution.md)「对现有发布流程的改动清单」。
- [ ] **G1.14 对外文档。** README 中英文的系统要求和 Mac 安装方法、`docs/features/updater.md` 的 macOS 部分、插件文档里的平台说明、官网下载页。

## 第 0 步的迁移表

2026-11-13 G1.2 的做法见 [overview.md](overview.md)「平台层」。「暂不支持」= Mac 上用 `unsupported.rs` / `*_unsupported.rs` 空实现，命令返回 `platform.unsupported`；「换实现」= 原处写 Windows / Mac 两份；「平台层」= 经 `platform.rs` 取 `win32/` 或 `macos/` 的同名模块，`macos/` 里目前是空实现。

| 模块 | 用到的 Windows API | Mac 上的处理（第 0 步） | 正式实现的子任务 |
|---|---|---|---|
| `island`（focus、follow、glass、modifier、outside_click、passthrough） | 窗口、前台、按键与鼠标状态、窗口区域 | 这几个子模块暂不支持（follow 已由 G1.24 做了 Mac 版，取点在 `follow_point_macos.rs`）；`mod.rs` 的 Alt / 左键判断换实现（Mac 上为 false）；几何、状态、贴边照常编译 | G1.3 |
| `onboarding_window` | 最小化全部窗口、光标位置、岛的窗口矩形 | 换实现（G1.3 已做）：隐藏其他应用、Tauri 的光标位置和窗口矩形 | G1.3 |
| `system`：`startup`、`network_cost` | 注册表（reg.exe）、WinRT 网络计费 | 自启换实现（G1.4 已做：`SMAppService`）；网络计费换实现（G1.6 已做：`network_cost_macos.rs`，平台层 `macos/network.rs`） | G1.4、G1.6 |
| `system`：`accent_color`、`fullscreen`、`updater`、`update_notifications`、`settings_backup` | 注册表、前台全屏、系统代理、Toast、下载文件夹 | 换实现：强调色读系统强调色（G1.6，`macos/appearance.rs`）、全屏 false、只读环境变量代理、不弹系统通知、诊断报 `sw_vers` 版本、下载文件夹 `~/Downloads` | G1.4、G1.6 |
| `system`：`CommandExt` / `CREATE_NO_WINDOW` | `CreationFlags` | 换实现：`system/command_flags.rs`，Mac 上 `creation_flags` 什么都不做 | — |
| `home_dir`、`system::windows_home_dir` | `USERPROFILE`、消息框 | 换实现：Mac 上用 `HOME`，冲突提示打到 stderr；G1.4 补上应用数据目录（`~/Library/Application Support/<标识>`）和锁文件的电脑名 | G1.4 |
| `clipboard_history`、`translation` | 剪贴板监听、热键、弹窗、UIA 选中文字 | 剪贴板换实现（G1.6 已做：`*_macos.rs` 的监听、热键、弹窗、system，平台层 `macos/pasteboard.rs`、`apps.rs`、`input.rs`）；翻译换实现（G1.6 已做：`translation/hotkey_macos.rs`、`placement_macos.rs`，划词在 `selection.rs` 里先读 AX，平台层 `macos/hotkeys.rs`、`accessibility.rs`） | G1.6 |
| `screenshot` | 屏幕截图、热键、钉图窗口、剪贴板 | 换实现（G1.6 已做：`capture_macos.rs`、`clipboard_macos.rs`、`hotkeys_macos.rs`、`targets_macos.rs`，平台层 `macos/screen_capture.rs`、`ocr.rs`、`capture_targets.rs`，选区窗口用 `island_panel::make_overlay_panel`；`session.rs`、`pin.rs`、`long.rs` 两个平台共用，帧里记每个窗口单位几个像素） | G1.6 |
| `file_shelf` | 剪贴板文件列表、OLE 拖出 | 换实现（G1.6 已做：`transfer_macos.rs`，复制走 `NSPasteboard`，拖出用 `drag` crate）；列表、预览、打开照常 | G1.6 |
| `device_use`、`device_events`、`system_levels` | 注册表、音频端点、设备节点、WMI 亮度、电源 | `device_events` 换实现（G1.6 已做：`readers_macos.rs`，平台层 `macos/audio_devices.rs`、`bluetooth.rs`、`power.rs`）；音量换实现（G1.6 已做）；`device_use` 换实现（G1.6 已做：`device_use/macos.rs`，平台层 `macos/camera.rs`）；亮度暂不支持 | G1.6、G1.9 |
| `phone_push` | 锁屏与空闲时间 | 换实现（G1.6 已做）：平台层 `macos/session.rs`，空闲读 `CGEventSourceSecondsSinceLastEventType`，锁屏读 `CGSessionCopyCurrentDictionary` 的 `CGSSessionScreenIsLocked`；业务代码经 `platform::session` 调用 | G1.6 |
| `lyrics` | 繁简转换 | 换实现：Mac 上不转换 | G1.9 |
| `mail` | 下载文件夹 | 换实现：`system::downloads_dir()` | — |
| `pets` | `FILE_FLAG_OPEN_REPARSE_POINT` | 换实现：`O_NOFOLLOW` | — |
| `claude_usage` | 注册表里的系统代理 | 换实现：Mac 上只看插件设置和环境变量；凭据文件不在时读钥匙串（G1.7 已做） | G1.7 |
| `agent_status`（focus、session_*、window_focus、wezterm、orca、host_icon） | 进程树、进程启动时间与环境变量、窗口枚举与前台、UIA 标签页、程序图标 | 换实现（G1.7 已做）：hook 脚本 `hooks/*.sh`；平台层 `macos/proc_info.rs`（`proc_pidinfo`、`proc_pidpath`、tty）、`process_tree.rs`（launchd 下的进程接到负责进程）、`terminal_tabs.rs`；窗口跳转激活前台应用；`approval_hotkeys_macos.rs`；进程环境变量仍为空 | G1.7 |
| `plugin_kernel`（containment、keybindings） | 作业对象、挂起启动、热键 | 平台层：`plugin_kernel/containment.rs` 经 `platform::job` 管住 Node 宿主，Windows 是 `win32/job.rs`（作业对象、挂起启动），Mac 是 `macos/job.rs`（进程组，销毁时 `killpg`，不挂起启动）；插件快捷键在 `keybindings.rs` 里按平台分开（Mac 走 `global-hotkey`）。第 2 版的 `plugin_host`（会话通知、WebView2 页面、注册 `fuyu://`）已随 E36.6.5 删除 | G1.8、E36.6.5 |
| `media_control` | SMTC、音频峰值、程序图标 | 换实现（G1.9 已做）：`service_macos.rs`、`events_macos.rs`、`adapter_macos.rs`（mediaremote-adapter）、`applescript_macos.rs`（兜底）；状态类型在共用的 `state.rs` | G1.9 |
| `qq_notifications`、`wechat_reminders`、`messenger_activation` | 通知监听、窗口闪烁、UIA | QQ、微信换实现（G1.10 已做：`qq_notifications/macos.rs`、`wechat_reminders/macos.rs`，平台层 `macos/dock_badges.rs`，插件动态复用 `plugin_view.rs`）；`messenger_activation` 仍暂不支持 | G1.10 |
| `cc_connect`、`ssh_tunnel` | 作业对象、注册表代理、程序查找 | `cc_connect` 本机换实现（G1.28 已做：`darwin` tar.gz 下载校验、`~/.local/bin` / Homebrew / 登录 shell `PATH` 查找、进程组看护与飞书扫码，新手引导放开本机）；`ssh_tunnel` 仍暂不支持 | G1.8、G1.28 |
| `rename_migration` | 注册表、凭据、卸载旧版 | 暂不支持（Mac 上没有旧版可迁移）；`data_dirs::copy_tree` 照常给 `home_dir` 用 | 不做 |
| `examples/` 四个探测程序 | 全部 | Mac 上只打印「只能在 Windows 上运行」 | 不做 |

Mac 上跳过的测试（依赖 Windows 路径、程序或 API，标了 `#[cfg(windows)]`）：`agent_status` 的 9 个（会话宿主、窗口匹配、Codex 标题、Orca 记录、程序图标、Windows Terminal 标签页、进程启动时间、符号链接）、`home_dir` 的 3 个（盘符路径）、`lyrics` 的 2 个（繁简转换）、`pets` 的 1 个（目录联接）、`fs_write` 的 1 个（共享锁）、`plugin_host` 的基线内存、stdin 队列、快捷键与网页视图两组测试，以及插件清单和音效包里两条 `C:\` 路径断言。对应子任务做 Mac 实现时补上 Mac 版测试。

## 进度记录

| 日期 | 子任务 | 提交 | 改了什么 | 验证 |
|---|---|---|---|---|
| 2026-11-17 | G1.28 Mac 本机运行 cc-connect（#569） | （本次提交） | `cc_connect` 本机模块在 Mac 上启用：`install.rs` 下载 `darwin-{arm64,amd64}.tar.gz`、核对 `checksums.txt` 并解出 `0755` 的 `cc-connect`；`locate.rs` 支持 `~/` 展开与 `~/.local/bin`、`/opt/homebrew/bin`、`/usr/local/bin`、登录 shell `PATH` 查找，并向托管子进程注入扩展 `PATH`；`runner.rs` 与 `feishu.rs` 改用 `platform::job::Job` + `process_group(0)`；新手引导「推送到手机」去掉 Mac 本机拦截，并修飞书扫码期间轮询刷新卸掉扫码行的竞态 | Mac：`cc_connect` 59 项单测 + GitHub 真实 `v1.5.2` `darwin-arm64.tar.gz` 下载与运行 `--version` 通过、前端单测与 `onboarding-push` 回归页通过；Windows / Mac CI `check` |
| 2026-11-19 | G1.34 改用 Apple Development 证书（#891） | （本次提交） | 用户实测自签名后仍弹：没有 Team ID 时钥匙串分区列表记 cdhash。`dev-signing.mjs` 先找 `Apple Development:` 开头的有效身份（取 `find-identity -v` 里第一个），用它签，不带 `--keychain`；找不到退回自签名并警告；「已签过」按现在会用的那张证书判断 | Mac：脚本测试（挑身份、跳过判断）；`target/agents` 经 runner 实签，`codesign -dv` 是 `TeamIdentifier=RDQ7JWUGXY`，`--verify --strict` 通过，之后普通编译签名还在、再跑 runner 跳过；`pnpm build:exe` 签名照旧；Windows CI |
| 2026-11-18 | G1.34 开发版固定签名（#891） | （本次提交） | `tauri.macos.conf.json` 加 `build.runner`；`scripts/macos/dev-cargo.{sh,mjs}` 判断哪些调用要签（debug 的 `run` / `build`，release、别的 profile、别的 bin 原样透传），`dev-signing.mjs` 生成开发证书和专用钥匙串并重签；`createCertificate` 可传证书名 | Mac：脚本测试（参数判断、假 cargo 走一遍 runner 外壳）；对复制出来的 debug 二进制实签，`codesign -d -r-` 是 `identifier "com.tixxin.fuyu.dev" and certificate leaf = H"…"`，第二次跳过，登录钥匙串搜索列表不变；`pnpm build:exe` 经 runner 后 `.app` 签名和以前一样；Windows CI。没在真的 `tauri dev` 里重编两次看弹框（见待人工验收） |
| 2026-11-13 | — | — | 4 份调研、本计划、[platforms.md](platforms.md)、任务 G1 | 仅文档 |
| 2026-11-13 | G1.1 | 3ccc9b6c | 用户拍板 M1–M14，写进决定表；界面形态（M4–M6）写进 [design/macos.md](../design/macos.md) | 仅文档 |
| 2026-11-13 | G1.13 第一个带 Mac 版的发布 | v0.3.8-beta.2 | Windows 上 `pnpm release` 触发 Mac 构建，草稿里有 dmg、`.app.tar.gz` 和 `.sig`，`latest.json` 有 `darwin-aarch64`；Windows 冒烟测试通过后公开（beta 通道）。随后 README 写上 Mac 版的下载与放行，仓库简介加 macOS、标签去掉 AI 类换成灵动岛相关 | 读回草稿的 `latest.json` 核对 darwin 条目；用户在 Mac 上下载安装、第一次放行、自动更新还没走一遍 |
| 2026-11-15 | C80 语音输入的识别组件 | （C80 的功能提交） | `Entitlements.plist` 加 `com.apple.security.cs.disable-library-validation`（用户 2026-11-15 定）。原因：识别组件 sherpa-onnx 的动态库不进安装包，用户在设置里点「下载」才下到家目录，签名和本应用不同；发布版开了 hardened runtime，库校验会拒绝加载它（"mapping process and mapped file (non-platform) have different Team IDs"），用户机器上又没有我们的证书，没法给下载的库重签。风险：关掉库校验后进程能加载任何签名或未签名的动态库，注入面变大。约束：只从写死的路径（`models/voice-input/sherpa-onnx-2.0.1/`）加载，每次加载前核对每个库文件写死的 SHA-256（`voice_input/packs.rs`、`model::verify`），不加载别的动态库 | 用 ad-hoc 签名加 `-o runtime` 的小程序实测：不带这个授权时 dlopen 被拒，带上后能加载并返回版本 2.0.1 |
| 2026-11-13 | G1.13 Mac 构建工作流试跑 | 6d45f639 上的 [run 43496744561](https://github.com/TixXin/Fuyu/actions/runs/43496744561) | 自签名证书写进仓库 Secrets 后，第一次在 GitHub 的 macOS runner 上跑 `release-macos.yml`（只出 artifact，没发布） | 全部步骤通过；下载产物核对：`codesign --verify --deep --strict` 通过，应用和内置适配器的指定要求都是证书叶哈希 `0ed462a5…`（与本机证书指纹一致），开了 hardened runtime，带 Apple Events 权限声明，最低系统 15.0；dmg 13 MB；产物里的适配器能读到正在播放 |
| 2026-11-13 | G1.13 无账号发布、引导的权限一步 | （本次提交） | `release-macos.yml`（macOS runner 编 app 和 dmg、自签名、启动检查）；`scripts/macos/self-signed-cert.mjs`；`pnpm release` 触发并下载 Mac 构建、本机签 updater 签名、`latest.json` 加 `darwin-aarch64`、上传 dmg；新手引导加 Mac 的权限一步，设置与引导共用权限列表，新命令 `request_system_permission`；[macos-install.md](../features/macos-install.md) 与 README | 脚本测试（清单、Mac 构建、证书）、`pnpm test`、类型检查、全部回归页；本机用自签名证书在临时钥匙串里签 `Fuyu.app` 成功，指定要求是 `identifier "com.tixxin.fuyu" and certificate leaf = H"…"`；工作流要合入后实际跑一次 |
| 2026-11-13 | G1.13（不需要证书的部分） | （本次提交） | `tauri.macos.conf.json` 加最低系统版本 15.0、`Entitlements.plist`（Apple Events，签名后才生效）、中英文 `InfoPlist.strings`；`Info.plist` 加 `NSAppleEventsUsageDescription`、本地化列表。签名、公证、发布工作流和 `latest.json` 的 darwin 条目等 G1.12 的证书 | `pnpm build:exe` 后检查 `Info.plist`（`LSMinimumSystemVersion` 15.0、用途说明、链接协议）、`Resources` 里的两种语言、可执行文件 `minos 15.0`；`cargo check` 通过 |
| 2026-11-13 | G1.10 QQ / 微信未读数 | （本次提交） | 程序坞角标读取；QQ、微信的 Mac 模块；未读数在消息页、横幅、收起预览里显示；Mac 专用的设置说明和授权提示 | Mac：clippy、`cargo test`（548）、`pnpm test`（674）、类型检查、设置与消息回归页；本机实测读到「系统设置」角标 1，微信、QQ 在程序坞里且无角标；Windows：交叉 clippy 通过 |
| 2026-11-13 | G1.9 媒体控制与亮度 | f97cfffc（搬迁），（本次提交） | mediaremote-adapter 的构建脚本与打包；正在播放、播放控制、进度、封面；AppleScript 兜底；内建屏亮度提示 | Mac：clippy、`cargo test`、`pnpm test`、音乐回归页、`pnpm build:exe`；打包后的 `.app` 里适配器读到正在播放（汽水音乐，含封面）；本机读到亮度 25%；Windows：交叉 clippy 通过 |
| 2026-11-14 | G1.17 插件运行的差异 | （本次提交） | 插件 CPU 按进程组统计（mach 时间换成 100 纳秒）；`node` / `pwsh` 的空闲内存基线，组长排第一；找 `node` / `pwsh` 时加上登录 shell 的 PATH 和版本管理器目录；`secrets.*` 报错写钥匙串 | Mac：clippy、`cargo test`（含忙循环 CPU、组长排序、空闲 node 基线、nvm 目录排序）、`pnpm build:exe`；Windows：交叉 clippy 通过。没在真机上从访达启动看卡片 |
| 2026-11-13 | G1.8 插件宿主 | （本次提交） | 进程组、`node` / `pwsh` 查找、`.exe` 插件拒绝启动；清单 `platforms` 字段（schema、文档、SDK 同步）；设置和市场里的平台与 PowerShell 提示；插件快捷键、系统事件 | Mac：clippy、`cargo test`、`pnpm test`、类型检查、设置回归页、`pnpm build`、`pnpm build:exe`；Windows：交叉 clippy 通过 |
| 2026-11-13 | G1.7 AI 代理状态 | （本次提交） | `/bin/sh` 版 hook 脚本和 Claude Code / Codex 的 hook 命令；Mac 进程平台层；点会话跳到终端或编辑器（Terminal、iTerm2 按 tty 选标签页）；审批快捷键；编辑器扩展的安装；用量的钥匙串凭据 | Mac：clippy、`cargo test`（含真跑四个脚本再用 Rust 读结果的测试）、`pnpm test`、`pnpm build`、`pnpm build:exe`；本机实测进程链从 CLI 一路走到前台应用；Windows：交叉 clippy 通过 |
| 2026-11-13 | G1.6 强调色、网络计费、授权状态 | （本次提交） | 「跟随系统」强调色读 `NSColor.controlAccentColor`；更新的「按流量计费」读 Network.framework 的 `nw_path_is_expensive` / `is_constrained`；设置 → 通用里新增「系统权限」，显示辅助功能、屏幕录制是否已允许，没允许的能一键打开系统设置 | Mac：clippy、`cargo test`、`pnpm test`、设置回归页、`pnpm build`、`pnpm build:exe`；本机实测强调色 `#007aff`、Wi-Fi 不计费；Windows：交叉 clippy 通过 |
| 2026-11-13 | G1.6 截图与识字 | 48d26bb8、75bbc594、77efc7e6（搬迁），（本次提交） | 截图的剪贴板、快捷键类型、平台调用先搬到可替换的文件（Windows 零行为变化）；Mac 上截屏（ScreenCaptureKit）、选区窗口（NSPanel）、复制 / 保存 / 贴图 / 拖出 / 长截图 / 历史、窗口吸附、快捷键；识字（Vision）同时给截图和剪贴板图片用 | Mac：`cargo clippy --all-targets -D warnings`、`cargo test`（519 过）；Vision 识别 README 截图实测中英文都对、词框位置对；截屏在没授权的终端里返回失败、不崩；Windows：交叉 `clippy --target x86_64-pc-windows-gnu --all-targets` 通过 |
| 2026-11-13 | G1.11 刘海形态 | （本次提交） | 读刘海几何（`macos/notch.rs`）；菜单栏选项新增「贴合刘海」并设为默认；折叠态纯黑、高度等于刘海、中间让开刘海分成左右两翼；贴边收起时缩进刘海、窗口不动；每 2 秒检查一次屏幕变化 | Mac：clippy、`cargo test`、`pnpm check`、`pnpm build`、回归页；没在真机上看效果（见待人工验收） |
| 2026-11-15 | G1.23 拖动与贴顶 | 48ac0bdf | 拖动中 `apply_stage_geometry` 只改大小不摆位置（两个平台），Mac 上不记 `WindowEvent::Moved` 的物理像素，Retina 屏拖动中不再跳；顶边抽成 `top_edge::TopEdge`，`geometry.rs`、`snap_to_top`、`drag_hint.rs` 共用，压菜单栏时吸到屏幕上沿；只在 Mac：默认位置所在屏上拖回顶部正中 ±40pt 清掉自定义位置、发 `island-position-cleared`，有刘海时回刘海 | Mac：`cargo test`、clippy、`pnpm build:exe`；Windows：交叉 clippy；没在真机上拖（见待人工验收） |
| 2026-11-15 | G1.29 吸顶与老设置迁移（#615） | a86d8604、（本次提交） | 松手时顶边以上（菜单栏里、屏幕上沿外）一律吸回顶边，提示线同步；岛整个在屏幕外时归正下方最近的屏；新命令 `primary_screen_has_notch`，启动时把没有形态的老设置迁成刘海（主屏有真刘海）或贴顶，Windows 不迁 | Mac：`cargo test`、clippy、`pnpm build:exe`、`pnpm check`、`pnpm build`、回归页；Windows：交叉 clippy；没在真机上拖（见待人工验收） |
| 2026-11-15 | G1.24 多显示器跟随与屏幕变化 | c612de0a | 「显示在：跟随鼠标 / 跟随前台窗口」Mac 上生效（光标、最前面的别家窗口，坐标走 `island::screen`）；贴底、贴侧边换屏保持边和比例；屏幕监听（`island/screen_watch.rs`）从只比较刘海改成比较全部屏幕的 frame、visibleFrame、缩放和刘海，插拔显示器、改分辨率、Dock 换位置或自动隐藏后 2 秒内重摆 | Mac：`cargo test`、clippy、`pnpm build:exe`；Windows：交叉 clippy；本机只有一块屏，多屏、插拔没在真机上看 |
| 2026-11-13 | G1.2（Rust 部分） | （本次提交） | Windows 依赖只在 Windows 上编译；`macos/` 平台层与 `platform.rs`；Mac 上暂不支持的模块用 unsupported 空实现；CI 加 `rust-macos`；迁移表 | Mac：`cargo clippy --all-targets -D warnings`、`cargo test`（421 过）、`pnpm dev:lane` 起窗口；Windows：在 Mac 上交叉 `clippy --target x86_64-pc-windows-gnu --all-targets` 通过，测试看 CI |

## 待人工验收

只有在真机上操作才能确认的项目，按任务分组。做到对应子任务时在这里补充；验收时逐条勾选，一组全过后在任务里写结果并 `pnpm tasks done`，有问题的开新任务或 issue。标「外接屏」的要接一块外接显示器，最好和内屏缩放不同。G1.3、G1.6、G1.7、G1.8、G1.9、G1.11 的代码 2026-11-13 已做完，状态是「待用户确认」，等的就是这里。

### G1.3 悬浮岛窗口

- [ ] 点岛不抢前台焦点，岛不出现在 ⌘Tab 里
- [ ] 全屏应用、多桌面、Mission Control 下岛的表现，两种全屏设置（照常显示 / 隐藏）都对
- [ ] 新手引导：遮罩盖到岛所在的位置、卡片能点、其他应用被隐藏，关掉引导后全部显示回来
- [ ] 外接屏：Retina 内屏 + 1x 外接屏，岛在两块屏上都停在顶部正中，拖到另一块屏后贴顶和点穿都正确
- [ ] 打成 dmg 安装后透明窗口不变白（tauri#13415）

拖动和多屏跟随拆在 G1.23、G1.24 里，已完成，验收一起做：

- [ ] 拖动与贴顶（G1.23）：Retina 屏上拖岛 5 秒中途不跳；「压在菜单栏上」时拖回顶部正中回到默认位置（有刘海时回刘海），重启后仍是默认位置；偏离正中 40pt 以上时贴屏幕最上沿、位置记住；离菜单栏下沿 20pt 以外松手不吸；「放在菜单栏下面」时贴菜单栏下沿；两种设置下顶边提示线 = 松手后吸到的位置。问题和清单见 [macos-island-docking.md](../investigations/macos-island-docking.md)
- [ ] 外接屏（G1.23）：副屏顶部正中松手只记住位置、不回主屏
- [ ] 老设置迁移（G1.29，#615）：用 C65 之前的设置（没有「形态」）启动，有刘海的屏上岛是刘海形态，设置 → 外观 → 形态显示「刘海」；没有刘海的 Mac（或只用外接屏当主屏）上是「贴顶」
- [ ] 三种形态（G1.29）：刘海——拖走后偏离正中松在顶部贴屏幕最上沿、记住位置，拖回正中 ±40pt 回刘海，重启仍是刘海；贴顶（刘海屏）——贴菜单栏下沿，拖到菜单栏里或更高处松手吸回菜单栏下沿；药丸——离菜单栏下沿 10px
- [ ] 拖出屏幕（G1.29）：任何形态下把岛往屏幕上沿外拖再松手，都回到顶边，不留在屏幕外或菜单栏里；拖动中提示线和松手吸到的位置一致
- [ ] 外接屏（G1.29）：副屏上方超出松手吸回副屏顶边，不跳到别的屏；两块屏上下排列时，上面那块屏的岛不会被吸到下面那块
- [ ] 外接屏（G1.24）：「跟随鼠标」「跟随前台窗口」换屏（点岛和设置窗口不触发，展开和拖动中不换）；贴底、贴侧边的岛换屏后贴同一条边；两块屏缩放不同、外接屏在上方或左边时也对；岛在外接屏上时拔掉回内屏、插回回原位
- [ ] 屏幕变化（G1.24）：Dock 换到左右或自动隐藏、改分辨率、合盖开盖后 2 秒内回到正确位置；菜单栏自动隐藏时「放在菜单栏下面」跟着调
- [ ] 贴底、贴侧边（C54.3、C54.1）：贴底时和 Dock（含自动隐藏时鼠标移到下沿）谁挡谁；台前调度开着时左侧竖向岛和应用缩略图条；全屏应用、切换 Space、Mission Control 下贴底和贴侧边的岛

启动抢焦点和悬停样式（G1.30 #631、G1.31 #632）：

- [ ] 启动不抢焦点（G1.30）：在 TextEdit 里一直打字时让开发版重编重启，字不断、前台应用不变；正式版登录时启动、更新后重启同样不打断；启动后岛照常显示，过一会儿也不会自己消失
- [ ] 悬停不拿键盘（G1.31）：在别的应用里打字时鼠标划过岛（折叠和展开都试），字照常进那个应用；设置里「悬停时拿键盘」打开时才会拿走键盘，移开后交还
- [ ] 悬停样式（G1.31）：鼠标停在展开的面板上，按钮、列表行直接有悬停样式，不用先点；折叠岛上的按钮和新消息横幅也有
- [ ] 点击（G1.31）：悬停展开后直接点面板里的按钮，按钮生效、面板不收起；鼠标移开按原设置收起（开了悬停展开的按延迟收起，点开的不因移开收起）
- [ ] 输入（G1.31）：点岛、快捷键打开岛后翻译输入框、待办输入框照常能打字；点别的应用后岛照原设置收起
- [ ] 形态（G1.30、G1.31）：贴边收起、刘海、药丸形态下各试一次上面几条

拖动提示和截图快捷键（G1.32 #693）：

- [x] 鼠标停在岛上按 ⌃⇧1 截图（折叠、展开各一次），图里没有移动光标、调整大小提示和按钮悬浮提示（2026-11-16 用户在开发版上截展开的面板：没有拖动提示；用量行的悬停卡片还在，它不是按钮提示，没收）
- [ ] 单独按住 Control 约 0.2 秒后出现拖动提示，能拖岛；按着 Control 直接拖不用等；Control+右键拖动照常；展开时按住 Control 面板保持展开
- [ ] 按住 ⌃⇧ 拖岛，岛不动；⌃⇧4、⌃Space 这类组合键按下时岛上不闪提示
- [ ] 先单按 Control 等提示出来，再加 Shift+1 截图：图里也没有提示；松开 Control 再按住，提示照常出来
- [ ] 设置 → 位置的说明：Mac 上写 Control，Windows 上写 Alt（中英文）

自动形态（G1.33 #725）：

- [ ] 新装（或清掉 `islandForm` 的设置）后，设置 → 外观 →「形态」选中的是「自动」，MacBook 屏上岛和刘海连成一块
- [ ] 形态是「自动」时把岛拖到外接屏顶部正中：变成贴顶；拖回 MacBook 屏顶部正中：变回刘海；合盖只用外接屏、再开盖同样跟着变
- [ ] 选贴顶、药丸、刘海，都和以前一样；Windows 上「形态」里没有「自动」

### G1.11 刘海

- [ ] 有刘海的 MacBook 上选「压在菜单栏上（有刘海时贴合刘海）」：折叠的岛纯黑，中间正好让开摄像头，左右两翼的图标和文字没被挡；高度和刘海一样、上缘两侧的弧度接得上
- [ ] 贴边收起后整块缩进刘海里看不见，鼠标移到刘海上能弹出来
- [ ] 展开后照常用主题颜色，页面标签栏、Agent 提醒卡片和消息卡片的第一行都在刘海下面
- [ ] 改成「放在菜单栏下面」或拖走、调上边距后回到原来的样子
- [ ] 外接屏：合盖时外接屏上照常顶部正中，开盖后回到刘海（屏幕变化 2 秒内跟上）

### G1.6 日常功能

- [ ] 系统权限：辅助功能、屏幕录制、自动化的授权弹窗；设置 → 通用 →「系统权限」里的状态和真实授权一致，在系统设置里改完切回设置窗口会刷新；「打开系统设置」打开对应的隐私页
- [ ] 剪贴板：复制文字、图片、Finder 里的文件都进历史；密码管理器复制的不进；有没有系统的剪贴板隐私提示
- [ ] 剪贴板：⌘⇧V 在鼠标旁弹出，选中后贴回原来的应用（第一次要允许辅助功能）；贴到终端时多行命令合成一行；其他桌面和全屏应用里 ⌘⇧V
- [ ] 剪贴板：按住空格出预览、剪贴板窗口不关，松开收起，固定时方向键仍在剪贴板窗口里（G1.18）；外接屏：缩放不同的屏上预览贴在旁边
- [ ] 剪贴板：顺序粘贴依次贴出每条，没授权或关了自动粘贴时第一条不被跳过；从 Safari、访达、终端复制时来源图标对；图片和文件拖到访达
- [ ] 剪贴板：展开管理视图、多选删除、撤销；外接屏：高 DPI 和多屏上展开收起的位置（C69）；截屏时剪贴板窗口被隐藏（G1.20）
- [ ] 文件中转：从 Finder 拖文件进来；拖到 Finder、桌面、邮件附件里，放下的地方收到文件；开着「拖出后移除」时条目消失、拖到一半取消时还在；多选后一起拖；「复制」后在 Finder 里 ⌘V 能粘贴出文件
- [ ] 快捷翻译：⌃⇧F 在光标所在屏幕正中打开翻译窗口，再按一次关掉；在备忘录、Safari、Chrome、VS Code 里选中文字按 ⌃⌥T，翻译出选中的文字，剪贴板里原来的内容还在；没给辅助功能授权时系统弹一次提示；改快捷键后旧的失效、新的生效，⌘⇧V 同时还能用
- [ ] 截图：第一次按 ⌃⇧1 时系统弹「屏幕录制」提示；授权并重开浮屿后再按，所有显示器都盖上冻结的画面，菜单栏和岛也被盖住；全屏应用里也能截
- [ ] 截图：框选、标注、复制后在备忘录里 ⌘V 是图片、在 Finder 里 ⌘V 是 PNG 文件；保存进「图片」文件夹；悬停时能吸附到整个窗口；岛上的截图卡片能拖到 Finder
- [ ] 截图：贴图停在原位、Retina 屏上不模糊、滚轮缩放正常；⌃⇧3 识字、⌃⇧4 翻译；长截图在 Safari 里自动往下滚并拼接（滚动方向要确认），按 Esc 能停
- [ ] 音量：按键盘音量键、静音，收起的岛上出现音量提示；换输出设备（耳机、AirPods）后还能跟上
- [ ] 设备与电源：连上、断开蓝牙耳机时岛上有提醒，电量低于 20% / 10% 时提醒一次；插上 USB 耳麦有提醒；插拔充电线有提醒并显示电量
- [ ] 摄像头 / 麦克风：开 FaceTime、Photo Booth 或浏览器视频会议时岛上出现图标；悬停说明里麦克风写应用名（浏览器写浏览器名，不是 Helper），摄像头写「摄像头正在使用」；关掉后图标消失；点图标打开系统设置对应的隐私页
- [ ] 手机推送：离开电脑（空闲）或锁屏后，Agent 完成的推送能发出
- [ ] 强调色：选「跟随系统」后用系统设置 → 外观里的强调色；改了系统强调色后重开设置窗口能跟上

### G1.7 AI 代理

- [ ] 在设置里安装 hook 后，`~/.claude/settings.json` 和 `~/.codex/config.toml` 里是 `/bin/sh` 加 `~/.fuyu/fuyu-agent-*.sh` 的命令
- [ ] 在 Terminal、iTerm2、VS Code 里跑 Claude Code，岛上显示运行中、完成、等待确认
- [ ] 点会话切到对应的应用，Terminal 和 iTerm2 切到对应标签页（第一次要允许「自动化」）；VS Code 里装了浮屿扩展时切到对应终端
- [ ] 在岛上审批和审批快捷键能用
- [ ] 开了「直接向 Anthropic 查询」时系统问一次是否允许读钥匙串，允许后用量环有数

### G1.8 插件宿主

- [ ] 装一个第 3 版插件能跑起来（第 2 版的 Node / PowerShell 插件已删除，原来的 pwsh 提示和 `.exe` 平台标记两项不再验）
- [ ] 退出浮屿或插件宿主重启后 `ps` 里没有残留的 Node 宿主进程
- [ ] 第 3 版插件声明的快捷键能触发（原来的锁屏、解锁事件是第 2 版的，已删除）
- [ ] Mac 本机 cc-connect（G1.28，#569）：设置 → AI Agent → 提醒里点「下载 cc-connect」并打开「由岛启动 cc-connect」，关掉开关或退出岛后 `ps` 里无残留 `cc-connect` 进程；设置页与新手引导「推送到手机」里对「本机」做飞书真机扫码建机器人、手机发一句话后发测试消息收到推送

### G1.9 媒体与亮度

- [ ] Apple Music、Spotify、网易云、QQ 音乐、汽水音乐、浏览器里的视频播放时，岛上和音乐页显示曲名、歌手、封面、进度
- [ ] 播放 / 暂停 / 上下首 / 拖进度 / 随机 / 循环都生效；暂停后状态跟上；浮屿自己的提示音不出现在音乐页
- [ ] 歌词能对上
- [ ] 按亮度键时岛上出现亮度提示

### 已完成任务的复查

- [ ] QQ / 微信（G1.10）：设置里打开 QQ、微信提醒；有人发消息、程序坞图标出现角标时岛上出现「N 条未读」，消息页列出；点条目打开对应应用；没允许辅助功能时显示「需要授权」，按钮打开系统设置
- [x] ~~`fuyu://` 链接（G1.4）~~：不用验了，链接随第 2 版插件宿主删除，`Info.plist` 也不再声明协议（E36.6.5，2026-11-18）；第 3 版待接手（E56，#893）
- [ ] 开机自启（G1.4）：打包后的 `.app` 在设置里打开自启，「系统设置 → 通用 → 登录项」里出现浮屿，重新登录后岛自动起来；关掉后登录项消失

- [ ] 开发版签名（G1.34）：`pnpm tauri dev` 启动时有一行 `[dev-signing] signed … with Apple Development: …`；钥匙串条目第一次弹框点「始终允许」后，改一行 Rust 重编两次，不再弹；`codesign -dv src-tauri/target/debug/fuyu` 有 `TeamIdentifier`

### G1.13 发布（等 G1.12 的证书）

- [ ] 签名、公证后的 dmg 在一台没装过浮屿的 Mac 上首次打开

## 备注

- **岛的坐标（G1.3）**：Mac 上 tao 的「物理坐标」不是一套全局坐标——显示器位置按该显示器的缩放换算，窗口位置按窗口当前所在屏幕的缩放换算，光标按主屏的缩放换算，缩放不同的两块屏上三者对不上（tauri#7890、tao#816）。所以岛的定位、拖动、贴顶、点穿和新手引导都经 `island/screen.rs` 取坐标：Windows 上原样转发 Tauri 的物理像素；Mac 上各自除以自己的缩放，统一成全局的逻辑点（缩放记为 1），设位置时用 `Position::Logical`，光标直接读 `NSEvent::mouseLocation`。拖动后保存的自定义位置在 Mac 上也是逻辑点。
- QQ / 微信（G1.10）：只有 Dock 角标的未读数可靠，见 [macos-messengers.md](../investigations/macos-messengers.md)。
- 调研里标「未核实」的说法（例如 SMAppService 的最低版本、剪贴板隐私提示在 macOS 27 上的状态、mediaremote-adapter 在 27 上是否可用）在对应子任务开工时先实测，结论记在这里或 `docs/investigations/`。
