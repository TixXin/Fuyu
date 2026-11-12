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
| M1 | Apple 开发者账号 | 现在就买 / 先用自签名证书自用，第 3 步前再买 | 第 3 步开始前买；在那之前用钥匙串里的自签名证书签名，避免每次重编后辅助功能等授权失效 | 待定 |
| M2 | 最低 macOS 版本 | 13 / 14 / 15 | 14：截图的 `SCScreenshotManager`、麦克风按进程检测都要 14；主流竞品的下限也是 14 | 待定 |
| M3 | 芯片架构 | universal / 只发 Apple Silicon | universal：额外成本主要是包体积和 CI 时间；但手上只有 Apple Silicon 能测，Intel 出问题只能尽力修。macOS 27 起已不支持 Intel | 待定 |
| M4 | 岛的位置 | 刘海处 / 顶部正中 | 先做顶部正中（无刘海屏和外接屏本来就要这种形态），刘海形态作为第 2 步的可选项 | 待定 |
| M5 | 顶部正中时与菜单栏的关系 | 压在菜单栏上 / 贴在菜单栏下面 | 贴在菜单栏下面，不挡应用菜单和状态图标 | 待定 |
| M6 | 有全屏应用时 | 照常显示 / 隐藏，有提醒时短暂出现 | 隐藏，有提醒时短暂出现（竞品用户呼声最高的需求之一） | 待定 |
| M7 | 私有 API（媒体与歌词、亮度） | 接受，做成可关、可降级的模块 / 不做 | 接受，放进单独模块，失效时整块隐藏 | 待定 |
| M8 | QQ / 微信提醒 | 只做 Dock 角标未读数 / 先做技术验证再决定 / 不做 | 先做技术验证，对外只承诺未读数 | 待定 |
| M9 | Tauri 升级与 `tauri-nspanel` | 升到 ≥ 2.12.1 并依赖 `tauri-nspanel` / 自己用 objc2 改 NSWindow | 升级 Tauri（单独提交）；用 `tauri-nspanel`，同时把用到的部分封装在平台层，日后能换成自己的实现 | 待定 |
| M10 | 平台层目录 | 保留 `win32/`，新建同级 `macos/` / 统一改名为 `platform/{windows,macos}` | 保留 `win32/`、新建 `macos/`：搬迁量小，`unsafe` 只在这两处的规则直接沿用 | 建议 |
| M11 | Mac 包怎么出 | CI 的 macOS runner 出 Mac 包、Windows 包继续本机出 / 整个发布搬到 Actions | Mac 包在 CI 出，两边上传到同一个 Release 草稿，再由本机汇总 `latest.json` | 待定 |
| M12 | 两个平台是否同时发版 | 必须同时 / Mac 可以落后 | 必须同时：`latest.json` 只有一份，Mac 落后时 Mac 用户检查更新会报错 | 待定 |
| M13 | 收费 | 免费 / 赞助 / 付费分发渠道 | 免费（项目是 GPL-3.0），以后再议 | 待定 |
| M14 | 剪贴板历史触发系统隐私提示时 | 首次启动引导用户在设置里永久允许 / 只在出现提示时说明 | 首次用到时引导一次 | 待定 |

## 第 0 步：在 Mac 上能编译、能跑测试

不改任何功能，只让 Rust 端在 macOS 上编得过、`cargo test` 跑得起来。这一步的收益和要不要出 Mac 版无关：代理在 Mac 上就能跑 Rust 测试和 clippy。

- [ ] **G1.2 平台隔离。**
  - 先列迁移表：`src-tauri/src` 里直接用 `windows::` 或 `crate::win32` 的模块（2026-11-13 约 26 个，`win32/` 约 3400 行），每个模块写清楚 Mac 上是「暂不支持」「换实现」还是「通用」。表写在本节下面。
  - `windows`、`windows-future` 等依赖挪到 `[target.'cfg(windows)'.dependencies]`；`win32/` 和直接调 Windows API 的代码加 `cfg(windows)`，Mac 上先给「不支持」的空实现。
  - 前端：新增查询平台和能力的命令，Mac 上不支持的功能在设置和岛上隐藏，不报错。
  - CI 加一个 `macos-latest` 的 `cargo check` + `cargo test` + clippy job，并入 `check` 汇总。
  - 验收：Mac 上 `cargo test`、clippy 通过；Windows 上 CI 全绿、行为不变；`pnpm tauri dev` 在 Mac 上能启动出一个窗口（形态不要求）。

## 第 1 步：Mac 上能日常使用

- [ ] **G1.3 悬浮岛窗口。** Tauri 升到 ≥ 2.12.1（单独提交，M9）；主窗口用 `tauri-nspanel` 转成非激活 NSPanel，`collectionBehavior` 设所有桌面、全屏辅助、不进 Cmd+Tab；`ActivationPolicy::Accessory`；鼠标穿透沿用「轮询 + 整窗开关」；定位改用逻辑坐标，避开多显示器缩放比不同时的坐标 bug（tauri#7890、tao#816）；顶部正中形态（M4、M5），全屏时的行为（M6）。新手引导遮罩和截图选区窗口在 Mac 上可用。验收：Retina 内屏 + 1x 外接屏下定位正确；全屏应用上方能显示（或按 M6 隐藏）；点岛不抢前台焦点；打成 dmg 后透明窗口不变白（tauri#13415）。
- [ ] **G1.4 系统集成。** 菜单栏图标（模板图）；开机自启用 SMAppService；凭据换 Keychain（`keyring` 的 apple-native）；全局快捷键（不劫持系统组合键，剪贴板默认 ⌘⇧V）；`fuyu://` 用 Info.plist 声明；单实例；数据目录与家目录在 Mac 上的位置写进 contracts.md 和 data-storage.md。
- [ ] **G1.5 Mac 上的开发流程。** `pnpm dev:lane`、`build:exe`（Mac 上改成把 `.app` 放进 `~/Applications`）、停止运行中岛屿的脚本、`run-regression.mjs` 找浏览器、`prune:target` 等在 Mac 上可用；AGENTS.md 和 lanes.md 补 Mac 上的命令和验证要求。
- [ ] **G1.6 日常功能。** 剪贴板历史（`changeCount` 轮询，隐私提示按 M14）、文件中转（含拖出到 Finder）、截图（ScreenCaptureKit）和 OCR（Vision）、划词翻译（AX 读选中文字）、音量、摄像头 / 麦克风占用、设备插拔与电源、锁屏与空闲、强调色、网络计费、全屏判断。每项需要的权限在首次使用时引导，设置里能看到授权状态。
- [ ] **G1.7 AI 代理状态。** hook 安装改用 `~/.claude` 等路径和 sh 脚本，命令里写绝对路径（hook 环境的 PATH 不含 `/opt/homebrew/bin`）；点会话跳转支持 Terminal、iTerm2、VS Code（AppleScript / URL scheme / AX）；用量读取的路径。
- [ ] **G1.8 插件宿主。** 子进程放进独立进程组，退出时 `killpg`，岛屿崩溃时子进程能自己退出；插件网页视图改用 Tauri 的 webview；PowerShell 插件在没装 pwsh 时给出说明；插件清单加平台字段，市场标出插件支持哪些平台。

## 第 2 步：和系统深度绑定的功能

- [ ] **G1.9 媒体控制、歌词与亮度（私有 API，按 M7）。** 媒体读取用 mediaremote-adapter 的思路，失败时对 Apple Music / Spotify 用 AppleScript 兜底；亮度参考 MonitorControl。设置里显示当前来源和失效提示。每个 macOS 大版本发布后复测。
- [ ] **G1.10 QQ / 微信提醒的技术验证（按 M8）。** 先验证读 Dock 角标未读数；微信会话列表（AX）和 NTQQ 的 `AXManualAccessibility` 只做验证、写进 `docs/investigations/`，结论出来后再决定对外承诺什么。
- [ ] **G1.11 刘海形态（可选，按 M4）。** 读 `safeAreaInsets` 和 `auxiliaryTop*Area` 得到刘海几何；折叠态和刘海融为一体；无刘海屏回退到顶部正中。

## 第 3 步：签名与发布

- [ ] **G1.12 用户准备账号和证书（只有用户本人能做，M1）。** 个人开发者账号、Developer ID Application 证书（导出 `.p12`）、App Store Connect API key（`.p8`）；放进仓库 Secrets。步骤见 [macos-distribution.md](../research/macos-distribution.md)「用户本人必须做的事」。
- [ ] **G1.13 Mac 版发布流程。** `tauri.conf.json` 加 `bundle.macOS`（最低版本、entitlements、Info.plist 用途说明的中英文）；新增 macOS 发布工作流（M11），出 dmg 和 `.app.tar.gz` + `.sig`，签名、公证、staple；`make-latest-json.mjs` 写 `darwin-aarch64`（universal 时也写 `darwin-x86_64`，M3、M12）；冒烟测试加 macOS（`spctl`、`stapler validate`、能启动）；发布后核对两个通道都有 darwin 条目；自建 Homebrew tap。改动清单见 [macos-distribution.md](../research/macos-distribution.md)「对现有发布流程的改动清单」。
- [ ] **G1.14 对外文档。** README 中英文的系统要求和 Mac 安装方法、`docs/features/updater.md` 的 macOS 部分、插件文档里的平台说明、官网下载页。

## 第 0 步的迁移表

（G1.2 开工时填写：模块 | 用到的 Windows API | Mac 上的处理 | 所在子任务）

## 进度记录

| 日期 | 子任务 | 提交 | 改了什么 | 验证 |
|---|---|---|---|---|
| 2026-11-13 | — | （本次提交） | 4 份调研、本计划、[platforms.md](platforms.md)、任务 G1 | 仅文档 |

## 待人工验收

只有在真机上操作才能确认的项目，做到对应子任务时补充：

- 全屏应用、多桌面、Mission Control 下岛的表现（G1.3）
- 辅助功能、屏幕录制、自动化的授权弹窗和设置里的状态（G1.6、G1.7）
- 签名、公证后的 dmg 在一台没装过浮屿的 Mac 上首次打开（G1.13）

## 备注

- 调研里标「未核实」的说法（例如 SMAppService 的最低版本、剪贴板隐私提示在 macOS 27 上的状态、mediaremote-adapter 在 27 上是否可用）在对应子任务开工时先实测，结论记在这里或 `docs/investigations/`。
