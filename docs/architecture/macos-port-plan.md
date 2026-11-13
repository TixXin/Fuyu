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
| M13 | 收费 | 免费 / 赞助 / 付费分发渠道 | 免费（项目是 GPL-3.0），以后再议 | 已定（2026-11-13，用户）：按推荐 |
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
- [x] **G1.5 Mac 上的开发流程。** `pnpm dev:lane`、`build:exe`（Mac 上改成把 `.app` 放进 `~/Applications`）、停止运行中岛屿的脚本、`run-regression.mjs` 找浏览器、`prune:target` 等在 Mac 上可用；AGENTS.md 和 lanes.md 补 Mac 上的命令和验证要求。（2026-11-13 已做：单元测试在 Mac 上全过，市场包按解压后的内容比较；`build:exe` 装 `.app`；停止岛屿、回归页找浏览器、`--fresh` 支持 Mac；lane 预览改进程名，WebView 存储和主工作区分开）
- [ ] **G1.6 日常功能。** 全局快捷键的 Mac 平台层（Carbon `RegisterEventHotKey`，不劫持系统组合键，剪贴板默认 ⌘⇧V，从 G1.4 挪来）；剪贴板历史（`changeCount` 轮询，隐私提示按 M14）、文件中转（含拖出到 Finder）、截图（ScreenCaptureKit）和 OCR（Vision）、划词翻译（AX 读选中文字）、音量、摄像头 / 麦克风占用、设备插拔与电源、锁屏与空闲、强调色、网络计费、全屏判断。每项需要的权限在首次使用时引导，设置里能看到授权状态。
- [ ] **G1.7 AI 代理状态。** hook 安装改用 `~/.claude` 等路径和 sh 脚本，命令里写绝对路径（hook 环境的 PATH 不含 `/opt/homebrew/bin`）；点会话跳转支持 Terminal、iTerm2、VS Code（AppleScript / URL scheme / AX）；用量读取的路径。
- [ ] **G1.8 插件宿主。** 子进程放进独立进程组，退出时 `killpg`，岛屿崩溃时子进程能自己退出；插件网页视图改用 Tauri 的 webview；PowerShell 插件在没装 pwsh 时给出说明；插件清单加平台字段，市场标出插件支持哪些平台。

## 第 2 步：和系统深度绑定的功能

- [ ] **G1.9 媒体控制、歌词与亮度（私有 API，按 M7）。** 媒体读取用 mediaremote-adapter 的思路，失败时对 Apple Music / Spotify 用 AppleScript 兜底；亮度参考 MonitorControl。设置里显示当前来源和失效提示。每个 macOS 大版本发布后复测。
- [ ] **G1.10 QQ / 微信提醒的技术验证（按 M8）。** 先验证读 Dock 角标未读数；微信会话列表（AX）和 NTQQ 的 `AXManualAccessibility` 只做验证、写进 `docs/investigations/`，结论出来后再决定对外承诺什么。
- [ ] **G1.11 刘海形态（可选，按 M4）。** 读 `safeAreaInsets` 和 `auxiliaryTop*Area` 得到刘海几何；折叠态和刘海融为一体；无刘海屏回退到顶部正中。

## 第 3 步：签名与发布

- [ ] **G1.12 用户准备账号和证书（只有用户本人能做，M1）。** 个人开发者账号、Developer ID Application 证书（导出 `.p12`）、App Store Connect API key（`.p8`）；放进仓库 Secrets。步骤见 [macos-distribution.md](../research/macos-distribution.md)「用户本人必须做的事」。
- [ ] **G1.13 Mac 版发布流程。** `tauri.conf.json` 加 `bundle.macOS`（最低版本 15.0（M2）、entitlements、Info.plist 用途说明的中英文）；新增 macOS 发布工作流（M11），出 dmg 和 `.app.tar.gz` + `.sig`，签名、公证、staple；`make-latest-json.mjs` 写 `darwin-aarch64`（只发 Apple Silicon，M3；和 Windows 同时发版，M12）；冒烟测试加 macOS（`spctl`、`stapler validate`、能启动）；发布后核对两个通道都有 darwin 条目；自建 Homebrew tap。改动清单见 [macos-distribution.md](../research/macos-distribution.md)「对现有发布流程的改动清单」。
- [ ] **G1.14 对外文档。** README 中英文的系统要求和 Mac 安装方法、`docs/features/updater.md` 的 macOS 部分、插件文档里的平台说明、官网下载页。

## 第 0 步的迁移表

2026-11-13 G1.2 的做法见 [overview.md](overview.md)「平台层」。「暂不支持」= Mac 上用 `unsupported.rs` / `*_unsupported.rs` 空实现，命令返回 `platform.unsupported`；「换实现」= 原处写 Windows / Mac 两份；「平台层」= 经 `platform.rs` 取 `win32/` 或 `macos/` 的同名模块，`macos/` 里目前是空实现。

| 模块 | 用到的 Windows API | Mac 上的处理（第 0 步） | 正式实现的子任务 |
|---|---|---|---|
| `island`（focus、follow、glass、modifier、outside_click、passthrough） | 窗口、前台、按键与鼠标状态、窗口区域 | 这几个子模块暂不支持；`mod.rs` 的 Alt / 左键判断换实现（Mac 上为 false）；几何、状态、贴边照常编译 | G1.3 |
| `onboarding_window` | 最小化全部窗口、光标位置、岛的窗口矩形 | 换实现（G1.3 已做）：隐藏其他应用、Tauri 的光标位置和窗口矩形 | G1.3 |
| `system`：`startup`、`network_cost` | 注册表（reg.exe）、WinRT 网络计费 | 自启换实现（G1.4 已做：`SMAppService`）；网络计费暂不支持（不计费） | G1.4、G1.6 |
| `system`：`accent_color`、`fullscreen`、`updater`、`update_notifications`、`settings_backup` | 注册表、前台全屏、系统代理、Toast、下载文件夹 | 换实现：强调色 None、全屏 false、只读环境变量代理、不弹系统通知、诊断报 `sw_vers` 版本、下载文件夹 `~/Downloads` | G1.4、G1.6 |
| `system`：`CommandExt` / `CREATE_NO_WINDOW` | `CreationFlags` | 换实现：`system/command_flags.rs`，Mac 上 `creation_flags` 什么都不做 | — |
| `home_dir`、`system::windows_home_dir` | `USERPROFILE`、消息框 | 换实现：Mac 上用 `HOME`，冲突提示打到 stderr；G1.4 补上应用数据目录（`~/Library/Application Support/<标识>`）和锁文件的电脑名 | G1.4 |
| `clipboard_history`、`translation` | 剪贴板监听、热键、弹窗、UIA 选中文字 | 暂不支持；快捷键文字解析（`shortcut.rs`）照常编译 | G1.6 |
| `screenshot` | 屏幕截图、热键、钉图窗口、剪贴板 | 暂不支持 | G1.6 |
| `file_shelf` | 剪贴板文件列表、OLE 拖出 | 复制和拖出暂不支持，列表、预览、打开照常 | G1.6 |
| `device_use`、`device_events`、`system_levels` | 注册表、音频端点、设备节点、WMI 亮度、电源 | 暂不支持 | G1.6、G1.9 |
| `phone_push` | 锁屏与空闲时间 | 换实现：空闲 None、未锁屏 | G1.6 |
| `lyrics` | 繁简转换 | 换实现：Mac 上不转换 | G1.9 |
| `mail` | 下载文件夹 | 换实现：`system::downloads_dir()` | — |
| `pets` | `FILE_FLAG_OPEN_REPARSE_POINT` | 换实现：`O_NOFOLLOW` | — |
| `claude_usage` | 注册表里的系统代理 | 换实现：Mac 上只看插件设置和环境变量 | G1.7 |
| `agent_status`（focus、session_*、window_focus、wezterm、orca、host_icon） | 进程树、进程启动时间与环境变量、窗口枚举与前台、UIA 标签页、程序图标 | 进程相关走平台层；窗口跳转、前台进程换实现（找不到）；`approval_hotkeys` 暂不支持 | G1.7 |
| `plugin_host`（runtime、baseline） | 作业对象、挂起启动 | 平台层：Mac 上 `Job` 什么都不管，进程直接启动 | G1.8 |
| `plugin_host`（keybindings、system_events、webviews、uri） | 热键、会话通知、WebView2 页面、注册 `fuyu://` | 暂不支持；`uri` 注册换实现（Mac 上不做，等 Info.plist） | G1.4、G1.8 |
| `media_control` | SMTC、音频峰值、程序图标 | 暂不支持 | G1.9 |
| `qq_notifications`、`wechat_reminders`、`messenger_activation` | 通知监听、窗口闪烁、UIA | 暂不支持 | G1.10 |
| `cc_connect`、`ssh_tunnel` | 作业对象、注册表代理、程序查找 | 暂不支持（内置插件在 Mac 上开不起来） | G1.8 |
| `rename_migration` | 注册表、凭据、卸载旧版 | 暂不支持（Mac 上没有旧版可迁移）；`data_dirs::copy_tree` 照常给 `home_dir` 用 | 不做 |
| `examples/` 四个探测程序 | 全部 | Mac 上只打印「只能在 Windows 上运行」 | 不做 |

Mac 上跳过的测试（依赖 Windows 路径、程序或 API，标了 `#[cfg(windows)]`）：`agent_status` 的 9 个（会话宿主、窗口匹配、Codex 标题、Orca 记录、程序图标、Windows Terminal 标签页、进程启动时间、符号链接）、`home_dir` 的 3 个（盘符路径）、`lyrics` 的 2 个（繁简转换）、`pets` 的 1 个（目录联接）、`fs_write` 的 1 个（共享锁）、`plugin_host` 的基线内存、stdin 队列、快捷键与网页视图两组测试，以及插件清单和音效包里两条 `C:\` 路径断言。对应子任务做 Mac 实现时补上 Mac 版测试。

## 进度记录

| 日期 | 子任务 | 提交 | 改了什么 | 验证 |
|---|---|---|---|---|
| 2026-11-13 | — | — | 4 份调研、本计划、[platforms.md](platforms.md)、任务 G1 | 仅文档 |
| 2026-11-13 | G1.1 | 3ccc9b6c | 用户拍板 M1–M14，写进决定表；界面形态（M4–M6）写进 [design/macos.md](../design/macos.md) | 仅文档 |
| 2026-11-13 | G1.2（Rust 部分） | （本次提交） | Windows 依赖只在 Windows 上编译；`macos/` 平台层与 `platform.rs`；Mac 上暂不支持的模块用 unsupported 空实现；CI 加 `rust-macos`；迁移表 | Mac：`cargo clippy --all-targets -D warnings`、`cargo test`（421 过）、`pnpm dev:lane` 起窗口；Windows：在 Mac 上交叉 `clippy --target x86_64-pc-windows-gnu --all-targets` 通过，测试看 CI |

## 待人工验收

只有在真机上操作才能确认的项目，做到对应子任务时补充：

- 全屏应用、多桌面、Mission Control 下岛的表现（G1.3）
- `fuyu://` 链接：装好的 `.app` 在浏览器里点 `fuyu://plugin/<id>/...` 能唤起岛并打开插件，岛没开时也能（G1.4）
- 开机自启：打包后的 `.app` 在设置里打开自启，「系统设置 → 通用 → 登录项」里出现浮屿，重新登录后岛自动起来；关掉后登录项消失（G1.4）
- 新手引导：遮罩是否盖到岛所在的位置、卡片能点、其他应用被隐藏，关掉引导后全部显示回来（G1.3）
- Retina 内屏 + 1x 外接屏：岛在两块屏上都停在顶部正中，拖到另一块屏后贴顶和点穿都正确（G1.3；开发机只有一块屏，没测到）
- 辅助功能、屏幕录制、自动化的授权弹窗和设置里的状态（G1.6、G1.7）
- 签名、公证后的 dmg 在一台没装过浮屿的 Mac 上首次打开（G1.13）

## 备注

- **岛的坐标（G1.3）**：Mac 上 tao 的「物理坐标」不是一套全局坐标——显示器位置按该显示器的缩放换算，窗口位置按窗口当前所在屏幕的缩放换算，光标按主屏的缩放换算，缩放不同的两块屏上三者对不上（tauri#7890、tao#816）。所以岛的定位、拖动、贴顶、点穿和新手引导都经 `island/screen.rs` 取坐标：Windows 上原样转发 Tauri 的物理像素；Mac 上各自除以自己的缩放，统一成全局的逻辑点（缩放记为 1），设位置时用 `Position::Logical`，光标直接读 `NSEvent::mouseLocation`。拖动后保存的自定义位置在 Mac 上也是逻辑点。
- 调研里标「未核实」的说法（例如 SMAppService 的最低版本、剪贴板隐私提示在 macOS 27 上的状态、mediaremote-adapter 在 27 上是否可用）在对应子任务开工时先实测，结论记在这里或 `docs/investigations/`。
