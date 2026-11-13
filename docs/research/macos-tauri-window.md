# 用 Tauri 2 在 macOS 上做悬浮岛窗口

> 日期：2026-11-13。问题：浮屿要移植到 macOS（自用 + 正式发布），Tauri 2 能不能在 Mac 上做出现在这种透明、无边框、置顶、点击穿透的悬浮岛及其附属窗口；怎么做；有哪些坑。范围：tauri-apps/tauri、tauri-apps/tao 的 GitHub issue（关键词 macOS transparent、visible_on_all_workspaces、fullscreen、set_ignore_cursor_events、multiple monitors / scale factor），v2.tauri.app 配置文档与发布日志，docs.rs（tauri 2.12.5），tauri-nspanel 仓库与文档，window-vibrancy 仓库，Apple AppKit 文档（NSWindow.Level、NSScreen.auxiliaryTopLeftArea），开源刘海应用 boring.notch、NotchDrop、Atoll、DynamicNotchKit 的仓库与窗口源码，9to5mac 等对 Sequoia 录屏权限的报道。相关任务：G1（macOS 适配，计划见 [macos-port-plan.md](../architecture/macos-port-plan.md)）

## 结论

### 能不能做

**能做，但不能只靠 Tauri 的跨平台窗口 API**。透明无边框、置顶、整窗点击穿透、菜单栏图标、不进 Dock 这些 Tauri 本身就有；「浮在全屏应用之上、出现在所有桌面、点击不抢焦点、层级压过菜单栏」这几项 Tauri 没有直接 API（tao 的功能请求 #189 自 2021 年起仍是 open），要把主窗口换成 NSPanel（用 tauri-nspanel 插件）或自己用 objc2 改 NSWindow 的 `level` / `collectionBehavior` / `styleMask`。开源刘海应用（boring.notch、NotchDrop）全部是这么做的，路子已被验证，只是它们是 Swift 原生。

### 推荐的窗口方案

1. **Tauri 升到 ≥ 2.12.1**（仓库当前锁的是 tauri 2.11.5 / tao 0.35.3 / wry 0.55.1，2026-11-13 查 `src-tauri/Cargo.lock`）。2.12.1 起透明和全屏不再需要 `macOSPrivateApi` / `macos-private-api` 特性，可以上架 App Store 级别的「不用私有 API」；低于这个版本就要在 `tauri.conf.json` 里开 `app.macOSPrivateApi: true`（会用私有 API，Mac App Store 不收，直接分发不影响）。
2. **主岛窗口**：沿用现有配置（`transparent`、`decorations: false`、`shadow: false`、`alwaysOnTop`、`skipTaskbar`），在 macOS 上启动后用 **tauri-nspanel** 把它转成 NSPanel：
   - styleMask：`borderless` + `nonactivating_panel`（点击不激活应用、不抢前台焦点）；
   - collectionBehavior：`can_join_all_spaces` + `stationary` + `full_screen_auxiliary` + `ignores_cycle`（所有桌面、全屏应用上方、不进 Cmd+Tab、不随 Mission Control 移动）；
   - level：顶部正中形态用 `Status`（statusBar）即可；刘海形态要压过菜单栏，用 `Custom(mainMenu + 3)` 或 `statusBar + 8` 这类值（boring.notch / NotchDrop 的取值）。
   - 需要键盘输入时（岛内输入框）让 panel `can_become_key_window: true`，非激活面板也能成为 key window 接收键盘，不会把前台应用切走。
3. **应用级**：`app.set_activation_policy(ActivationPolicy::Accessory)`（不在 Dock、不进 Cmd+Tab；放在 `#[cfg(target_os = "macos")]` 里）；托盘照用 Tauri tray（在 Mac 上就是菜单栏图标），图标设为 template（`icon_as_template(true)`）以适配深浅菜单栏。
4. **点击穿透**：保持现在的做法——大的透明「舞台窗口」+ 后台线程轮询鼠标位置 + 在岛外时 `set_ignore_cursor_events(true)`。macOS 的 `ignoresMouseEvents` 也是整窗开关，没有按区域穿透，所以轮询方案原样适用；只要把 `win32::window::cursor_position`、`is_alt_key_down` 换成 macOS 实现（`NSEvent.mouseLocation`、`NSEvent.modifierFlags`），或直接用 Tauri 的 `cursor_position()`。
5. **刘海几何**：自己写一小段 objc2 代码读 `NSScreen.safeAreaInsets.top` 和 `auxiliaryTopLeftArea` / `auxiliaryTopRightArea`（macOS 12+），两块之间的空隙就是刘海的宽，`safeAreaInsets.top` 是刘海高；没有刘海时这两个值为 nil / 0，回退到「顶部正中」。
6. **需要自己写的原生代码**（建议放 `src-tauri/src/macos/`，与 `win32/` 对称，`unsafe` 只在这里）：刘海几何、鼠标位置与修饰键、全局快捷键之外的键盘状态、屏幕录制权限检查、多显示器坐标换算的修正（见下文 tao 的 bug）、截图（ScreenCaptureKit）。窗口层级和面板化尽量交给 tauri-nspanel。

### 主要风险（按严重程度）

1. **多显示器 + 不同缩放比时 Tauri 报的物理坐标是错的**（tauri#7890、tao#816，2026-11-13 仍 open）。浮屿的定位、贴边、跟随显示器全部基于 `PhysicalPosition` 和 `monitor.position()`，在 Retina 内屏 + 1x 外接屏的常见组合下会算错、甚至把岛挪到另一块屏。macOS 上应改用逻辑坐标（points）做全部计算，或自己从 `NSScreen.frame` 取屏幕几何。
2. **透明窗口打包后变白**（tauri#13415，open，2025-05 报告、2025-11 仍有人复现）。只在 dmg 打包后出现、dev 正常。要尽早在 CI 打 dmg 实测；如果 2.12.1 去掉私有 API 依赖后这个问题仍在，就是阻塞项。**未核实**是否已被 2.12.x 修好。
3. **只设 `alwaysOnTop` + `visibleOnAllWorkspaces` 不能浮在全屏应用之上**（tauri#9557 open，tao#189 open）。社区解法是 Accessory 激活策略 + 上述两项，或改 level / collectionBehavior；有人反映改 level 在 dev 有效、release 无效（tao#189 评论）。用 NSPanel + `full_screen_auxiliary` 是开源刘海应用的标准做法，更稳。
4. **截图需要「屏幕录制」权限**，macOS 15 起还会周期性（最初每周，后改为每月）再次弹窗确认，ScreenCaptureKit 也一样（9to5mac 2024-08、2024-10 报道）。对截图功能的体验影响大。
5. **签名与公证**：对外发布必须 Developer ID 签名 + 公证，否则 Gatekeeper 拦截；`tauri-plugin-updater` 的 macOS 产物也需签名。这不是窗口问题，但是「正式发布」的前提（本次未深入查，细节**未核实**）。
6. WKWebView 与 WebView2 的渲染、性能差异要回归，尤其大面积 `backdrop-filter` 的岛（见下文）。

### 两种形态对比（待用户决定）

| | 岛放在刘海处 | 顶部正中（无刘海也一样） |
|---|---|---|
| 层级 | 必须高于菜单栏（`mainMenu` 以上），否则被菜单栏盖住 | `statusBar` / `Floating` 即可；可选择在菜单栏下方（避开菜单栏高度）或压在菜单栏上 |
| 几何 | 要读 `safeAreaInsets` 和 `auxiliaryTop*Area` 算刘海宽高；折叠态要和刘海严丝合缝（黑色、圆角对齐），不同机型刘海宽度不同 | 只要屏幕可见区域（`visibleFrame`）和菜单栏高度 |
| 无刘海 / 外接屏 | 要回退方案（伪刘海或顶部正中），等于两套都要做 | 天然一致 |
| 视觉 | 折叠态必须纯黑才能和刘海融为一体，和现有「玻璃 / 主题市场」的外观体系冲突；展开态从刘海往下长 | 可沿用现有外观、主题 |
| 菜单栏冲突 | 刘海两侧的菜单栏图标可能被展开的岛挡住；用户用 Bartender 等工具时也会和刘海区抢位置（**未核实**具体冲突） | 若压在菜单栏上，会挡住应用菜单或状态图标；放在菜单栏下方则不挡 |
| 贴边收起 | 「收在刘海里」很自然（刘海就是收起态） | 沿用现在的贴顶收起，露出 10px 边 |
| 实现难度 | 高：层级、几何、多机型、无刘海回退、全屏应用时菜单栏隐藏后的表现都要单独处理 | 中：主要工作是面板化、坐标系换算和穿透 |

**我的推荐（推测）**：先做「顶部正中」形态，把面板化、穿透、多显示器坐标这些两种形态都需要的基础打牢；刘海形态作为第二步、在有刘海的内屏上可选，因为它在无刘海屏上本来就要回退到顶部正中。

## 详细

### 0. 浮屿在 Windows 上做了哪些窗口技巧（读代码所得）

- 主窗口是固定 820×460（会按展开高度加高）的透明「舞台」，岛画在舞台里；位置、缩放、贴边、动画都在 `src-tauri/src/island/geometry.rs` 用物理像素计算，`top_edge.rs` 做贴顶吸附（16 逻辑像素）、`follow.rs` 每 300ms 轮询判断是否跟随鼠标所在显示器。
- 点击穿透：`island/passthrough.rs` 后台线程轮询鼠标，在岛外或横幅外时整窗 `set_ignore_cursor_events(true)`，同时发 hover、Alt 拖动等事件给前端。新手引导（`onboarding_window/overlay.rs`）和截图贴图（`screenshot/pin.rs`）也用同样方法。
- 焦点：`island/focus.rs` 悬停时把岛激活为前台、记住之前的前台窗口，离开时还回去；`win32/window.rs` 里有 `WS_EX_NOACTIVATE` / `WS_EX_TOOLWINDOW` 判断、`force_foreground`。
- DWM：`win32/dwm.rs` 关闭窗口过渡动画、读扩展边框；玻璃材质已经退回到 CSS（`island/glass.rs` 只清 acrylic）。
- 这些在 macOS 上的对应：穿透 → `ignoresMouseEvents`（Tauri 已封装）；焦点技巧 → 非激活 NSPanel，不需要「抢前台再还回去」；DWM 过渡 → NSWindow `animationBehavior = .none`（**未核实** Tauri 是否暴露，需原生代码）；物理像素计算 → 需改逻辑坐标（见第 6 节）。

### 1. 透明无边框窗口

- **macOSPrivateApi**：Tauri 配置文档写明它启用透明背景 API 并把 `fullScreenEnabled` 偏好设为 true；tauri 2.12.1（2026-09-30）发布日志：macOS 上透明和全屏「不再需要」`macos-private-api` 特性和 `macOSPrivateAPI` 配置（PR #16166）。最新版为 2.12.5（2026-10-21）。
- **透明背景**：窗口 `transparent: true` + 前端 `html, body { background: transparent }`（window-vibrancy README 对 Tauri 的说明）。
- **已知 bug**：tauri#13415「transparent 窗口在 dmg 打包后失去透明」，2026-11-13 仍 open，未见维护者诊断；报告者已开 `macOSPrivateApi` 仍复现。
- **圆角和阴影**：浮屿的岛是在透明舞台里用 CSS 画的圆角，不依赖窗口圆角，所以 tauri#14165（窗口设了圆角后子 WebView 不跟着裁剪，open，带 `scope: unstable flag` 标签，只在多 WebView 的 unstable 特性下出现）基本不影响。窗口阴影要关（`shadow: false`），否则 macOS 会给整个透明舞台的不透明像素画系统阴影，且阴影随内容变化时可能残留（经验推测，**未核实**）；阴影用 CSS 画。
- **vibrancy**：window-vibrancy 的 `apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)` 支持 macOS 10.10+，需透明窗口；新版还有 `apply_liquid_glass`（带 `radius`）。但 vibrancy 作用在整个窗口上，浮屿是大舞台里画小岛，整窗模糊会把透明区域也糊掉——**不适合主岛**，除非岛窗口和岛一样大。适合设置窗口、翻译窗口这类不透明的整窗。主岛继续用 CSS `backdrop-filter`（注意它在 WKWebView 里只能模糊网页内的内容，透不到桌面，和 WebView2 一样，所以现有 CSS 回退方案的视觉不变）。

### 2. 普通 NSWindow 还是 NSPanel

- **tauri-nspanel**（ahkohd/tauri-nspanel）：把 Tauri 的 WebviewWindow 转成 NSPanel，或用 `PanelBuilder` 新建。2026-11-13 查：428 star，默认分支 `v2.1`，最后推送 2026-10-25，1 个 open issue，未归档；crates.io 版本 `2.1`。提供 `tauri_panel!` 宏（`can_become_key_window`、`is_floating_panel` 等）、`StyleMask`（含 `nonactivating_panel`、`borderless`、`hud_window`）、`CollectionBehavior`（`can_join_all_spaces`、`stationary`、`ignores_cycle`、`full_screen_auxiliary` 等）、`PanelLevel`（`Floating`、`Status`、`PopUpMenu`、`ScreenSaver`、`Custom(n)` 等）、鼠标进出 / 移动事件，并说明 AppKit 调用会派发到主线程。Cap（CapSoftware/Cap）等项目在用。文档里的「HUD」示例正是 `can_join_all_spaces + stationary + ignores_cycle + full_screen_auxiliary`，和刘海应用一致。
- **为什么用 NSPanel**：带 `nonactivatingPanel` 的面板被点击时不会激活本应用，前台应用保持焦点——这正好替代 Windows 上 `focus.rs` 那套「抢前台再还回去」。boring.notch 的窗口就是 `NSPanel` 子类（`isFloatingPanel = true`、`canBecomeKey = false`、`canBecomeMain = false`）。NotchDrop 用普通 `NSWindow`，但它需要接收拖放、`canBecomeKey = true`。
- **风险**：tauri-nspanel 是单人维护（ahkohd），依赖 Tauri 内部窗口类，Tauri 升级时可能要等它跟进（推测）。备选是自己用 `objc2-app-kit` 对 `ns_window()` 改 `level`、`collectionBehavior`（这两项普通 NSWindow 也能改），只有「非激活」必须是 NSPanel 的 styleMask。
- 另有 tauri-nspopover-plugin（freethinkel），做菜单栏弹出气泡，不适合本场景。

### 3. 窗口层级、所有桌面、全屏应用之上

- Apple 的层级从低到高：`normal` < `floating` < `tornOffMenu/submenu` < `modalPanel` < `mainMenu` < `statusBar` < `popUpMenu` < `screenSaver`（另有 `dock`）。同层内按前后，跨层一律高层在上（Apple NSWindow.Level 文档）。
- Tauri 的 `alwaysOnTop` 在 macOS 上对应 `floating` 层（推测，基于 tao 实现惯例，**未核实**具体值）——低于菜单栏，所以岛不会盖住菜单栏，也不会出现在全屏应用里。
- `visibleOnAllWorkspaces`：配置文档说明它在 Windows 上不支持（所以浮屿现在没用），macOS 支持；但 tauri#9557（2024-04 起 open）报告只设它和 `alwaysOnTop` 仍不能出现在其他桌面、也画不到全屏应用上方。tao#189（open，2021 年起）的评论给出的可行组合：`ActivationPolicy::Accessory` + `set_visible_on_all_workspaces(true)` + `set_always_on_top(true)`，有人在 M1 + Tauri v2 上确认有效；改 `setLevel_` 的方案有人反映 release 构建无效。
- 开源刘海应用的取值（读 2026-11-13 的 main 分支源码）：
  - boring.notch：`NSPanel`，level `mainMenu + 3`，collectionBehavior `fullScreenAuxiliary + stationary + canJoinAllSpaces + ignoresCycle`，不透明 false、无阴影、背景 clear。
  - NotchDrop：`NSWindow`，level `statusBar + 8`，collectionBehavior 同上，`isMovable = false`。
- 结论：要浮在全屏应用上并出现在所有桌面，用 NSPanel + `full_screen_auxiliary + can_join_all_spaces + stationary`；要和刘海重叠就把 level 放到 `mainMenu` 之上。
- 注意（推测）：全屏应用会自动隐藏菜单栏，刘海处那一条在全屏时是黑的；level 足够高的面板仍会显示在那里。浮屿要决定全屏时岛是否继续显示（Windows 上有没有类似「全屏时隐藏」的设置，移植时对齐）。

### 4. 刘海

- **API**（AppKit，macOS 12+）：`NSScreen.safeAreaInsets.top` 非 0 表示顶部被遮挡；`auxiliaryTopLeftArea` / `auxiliaryTopRightArea` 是刘海左右两侧可用的矩形（全局屏幕坐标），顶部未被遮挡时为 nil（Swift）或 `NSZeroRect`（ObjC）。刘海矩形 = 屏幕宽中间、左区右边到右区左边之间，高 = `safeAreaInsets.top`。
- **无刘海机型和外接显示器**：上述值为 nil / 0，按「无刘海」处理。DynamicNotchKit 在没有刘海的 Mac 上回退为浮动窗口；Atoll 说明支持无刘海 Mac；DynamicNotch 在无刘海 Mac 上显示浮动胶囊（各自 README / 介绍页）。多屏时应只在带刘海的那块屏（内屏）上走刘海形态，其他屏走顶部正中。
- Tauri 不提供这些值，需要原生代码（objc2-app-kit 读 `NSScreen`），并把结果折算成和 Tauri 一致的坐标（见第 6 节）。
- **开源刘海应用（2026-11-13 查 GitHub API）**：
  - boring.notch（TheBoredTeam）：11,342 star，GPL-3.0，Swift，最后推送 2026-11-12；安装需 macOS 14+。
  - Atoll（Ebullioscopic，前名 DynamicIsland）：5,253 star，GPL-3.0，Swift，最后推送 2026-11-12。
  - NotchDrop（Lakr233）：2,128 star，MIT，最后推送 2026-05-18。
  - DynamicNotchKit（MrKai77）：Swift 包，MIT（据第三方索引），最新 1.1.0；star 数各站不一致，**未核实**。
  - 只参考思路（层级、collectionBehavior、几何算法），GPL 项目的代码不能搬进浮屿。

### 4b. 刘海形态的开源实现细节（2026-11-13 补充，为 G1.11 读源码）

读了 boring.notch、Atoll、NotchDrop、DynamicNotchKit、jackson-storm/DynamicNotch 的 main 分支源码（下载在本机 scratchpad，不进仓库）。

- **刘海尺寸**：五家公式一致，刘海宽 = `frame.width` − `auxiliaryTopLeftArea.width` − `auxiliaryTopRightArea.width`；刘海高多数用 `safeAreaInsets.top`（jackson-storm 用左侧区域的高）。boring.notch、Atoll 再加 4pt 余量；NotchDrop 不加，闭合态画成刘海宽高各减 4，命中区外扩 4。
- **没有刘海**：都画一块「假刘海」（宽 150–300、高等于菜单栏或 32），或改成离顶边约 6pt 的浮动胶囊（Atoll 的外接屏样式、DynamicNotchKit 的 `.floating`）。
- **屏幕变化**：都监听 `NSApplication.didChangeScreenParametersNotification`（合盖、插拔外接屏、改排列都会触发），NotchDrop 销毁重建窗口，boring.notch 比较屏幕列表后重新定位。
- **窗口**：固定大小的透明窗口贴顶居中（640×210、整屏宽×200 等），在里面画形状，不随内容改窗口大小；boring.notch / Atoll 用 NSPanel、`.mainMenu + 3`，和浮屿 G1.3 的取值一样。
- **闭合态形状**：纯黑；上缘两侧是内凹的「肩」，下面两角收圆。boring.notch / Atoll / DynamicNotchKit 闭合时肩半径 6、底圆角 14，展开时 19 / 24（DynamicNotchKit 15 / 20）；形状总宽 = 刘海宽 + 2 × 肩半径。
- **两翼**：boring.notch 播放音乐时每侧只伸出约 30pt（左边 20×20 封面，右边频谱），不放文字。
- **悬停**：停留 0.3 秒展开、移出 0.1 秒收起，进入时一次触觉反馈；空闲时整块收成刘海大小，和真刘海融成一体。
- **全屏**：boring.notch 默认「只在播放时显示」，另有总是隐藏 / 不隐藏。

浮屿的取法见 [design/macos.md](../design/macos.md)「刘海」一节。

### 5. 点击穿透

- Tauri 的 `set_ignore_cursor_events` 在 macOS 映射到 `NSWindow.ignoresMouseEvents`（整窗开关，推测基于 tao 实现，**未核实**源码）。没有「按像素 / 按区域」的穿透。
- 浮屿已有的轮询方案正是 Tauri 维护者在 tauri#9250 里建议的做法（「轮询鼠标位置，自己做相交计算」），该 issue 因此加了 `cursor_position()`（PR #9297，已合并）。所以 macOS 上可原样沿用，只换掉 Win32 的取鼠标、取修饰键函数。
- 注意：穿透打开时 WebView 收不到 `mousemove`，hover 只能靠后端轮询发事件（浮屿已经这样做）。tauri#11461（`setIgnoreCursorEvents` 不生效）是 Windows 10 上的报告，已以 not planned 关闭，与 macOS 无关。
- tauri-nspanel 自带鼠标进出 / 移动事件，可作为降低轮询频率的补充（**未核实**穿透状态下是否还能收到 tracking 事件；按 AppKit 惯例 `ignoresMouseEvents` 时收不到，推测仍需轮询）。

### 6. 多显示器、Retina、坐标系

- **Mac 原点在主屏左下、y 向上**（AppKit 坐标）；Tauri/tao 已把窗口和显示器坐标换成左上原点、y 向下，所以一般不用自己翻转，但自己写的原生代码（刘海矩形、`NSEvent.mouseLocation`）拿到的是 AppKit 坐标，必须按主屏高度翻转后才能和 Tauri 坐标比较。
- **混合缩放 bug**：tauri#7890（2023-09 起 open，最新评论 2026-07）：在不同缩放比的多屏下，显示器尺寸是未缩放的而偏移是缩放后的，副屏上窗口报出的物理坐标会和主屏重叠，`set_position()` 写回当前位置都可能把窗口挪到别的屏。2026-07 有贡献者定位为 tao 混用 point 和 pixel，提出 tao#1272、tray-icon#343、plugins-workspace#3502 等补丁，**合并状态未核实**。tao#816（open）：`outer_position` / `set_outer_position` 用的是窗口当前所在屏的缩放比换算，跨屏时不对称。
- **对浮屿的影响**：`geometry.rs`、`top_edge.rs`、`follow.rs` 全部用 `PhysicalPosition`、`monitor.position()`、`monitor.work_area()`、`scale_factor()`。macOS 上建议：几何计算统一在逻辑坐标（points）里做，用 `LogicalPosition` 设置位置；显示器几何直接从 `NSScreen.frame` / `visibleFrame` 取（自己翻转 y），不依赖 tao 的物理坐标。Mac 的 Retina 屏是整数 2x，几乎不会有 Windows 那种 125%/150% 小数缩放，但「Retina 内屏 2x + 普通外接屏 1x」非常常见，正好踩中上面的 bug。
- `work_area` 在 macOS 上应等于 `visibleFrame`（去掉菜单栏和 Dock）；`top_edge.rs` 的 `work_area_top_inset` 在 Mac 上会得到菜单栏高度（有刘海的屏约等于刘海高）。「顶部正中」形态贴在菜单栏下方还是压住菜单栏，取决于这里用 frame 还是 visibleFrame。

### 7. 不在 Dock、不进 Cmd+Tab、菜单栏图标

- `app.set_activation_policy(tauri::ActivationPolicy::Accessory)`：不在 Dock、不进 Cmd+Tab，也是 tao#189 里让窗口出现在全屏应用上方的关键一步。Tauri 还有 `set_dock_visibility`（较新版本，**未核实**引入版本）。注意 Accessory 应用没有自己的菜单栏菜单，设置窗口打开时如需 Cmd+Q / 复制粘贴快捷键要另行处理（推测）。
- 托盘（`tray-icon` 特性，项目已开）在 macOS 显示为菜单栏右侧状态图标；图标应为单色并设 `icon_as_template(true)`，系统会按深浅色自动反色。菜单栏图标在有刘海的机型上可能被刘海挡住（菜单栏图标多时被挤到刘海后面），这是系统行为，浮屿自己的图标也可能被藏（推测）。
- `skipTaskbar` 在 macOS 上没有意义（没有任务栏），Accessory 策略已覆盖。

### 8. 新手引导全屏遮罩、截图选区窗口

- **新手引导**：透明、无边框、置顶、整窗穿透（`set_ignore_cursor_events(true)` 后按区域打开），做法与主岛一致。要盖住菜单栏和 Dock，就要 level 至少 `statusBar`、窗口尺寸用 `NSScreen.frame` 而不是 `visibleFrame`；也要 `full_screen_auxiliary` 才能在全屏应用上显示。建议同样转 NSPanel。只要 level 够高，窗口就能盖住菜单栏区域（推测，依据是 boring.notch 用 `mainMenu + 3` 在菜单栏之上绘制）。
- **截图选区**：每个显示器一个全屏窗口的结构在 macOS 上可以照搬（level `screenSaver` 或 `popUpMenu` 以上、`can_join_all_spaces`、`full_screen_auxiliary`，每个窗口用对应 `NSScreen.frame`）。主要问题不在窗口：
  - 截屏需「屏幕录制」权限（系统设置 → 隐私与安全性）。macOS 15 Sequoia 起对屏幕录制权限周期性再确认，Apple 在 beta 期间从每周改为每月，15.1 起对常用应用减少弹窗；ScreenCaptureKit 不经系统内容选择器时同样会触发（9to5mac、AppleInsider、TidBITS 报道，**是否仍适用于当前 macOS 版本未核实**）。
  - Windows 侧的 `win32/screen_capture.rs`、`capture_targets.rs`、`ocr.rs` 要重写为 ScreenCaptureKit / Vision 框架（推测；也可评估 xcap 等跨平台 crate，**未核实**其 macOS 实现与权限行为）。

### 9. WKWebView 与 WebView2 的差异

- **CSS**：`backdrop-filter` WKWebView 支持（Safari 18 起不再需要 `-webkit-` 前缀，旧版本需要前缀；**未核实**最低支持版本，建议同时写带前缀版本）。滚动条：macOS 默认是覆盖式、自动隐藏的滚动条（跟随系统「显示滚动条」设置），`::-webkit-scrollbar` 样式在 WebKit 里有效，但覆盖式滚动条下表现与 Windows 不同（推测）。字体：Windows 上的 `Segoe UI` / `Microsoft YaHei` 在 Mac 不存在，字体栈要加 `-apple-system`、`PingFang SC`。
- **性能**：大面积透明 + `backdrop-filter` + 动画在 WKWebView 的合成开销未找到可靠对比（**未核实**）；后台节流可用 `background_throttling`（docs.rs：macOS 14+ 支持），浮屿常驻隐藏的翻译、剪贴板窗口要确认隐藏时脚本是否被暂停。
- **localStorage 位置**：WKWebView 不支持自定义 `data_directory`，docs.rs 说明 `data_store_identifier`（仅 macOS / iOS）是它的替代；默认数据在系统管理的 WebKit 目录下按 bundle identifier（`com.tixxin.fuyu`）区分（具体路径**未核实**，常见为 `~/Library/WebKit/<bundle id>/`）。对外契约里的 `fuyu-*` key 不变，但 Windows 和 Mac 之间数据不共享；`data-storage.md` 要补 Mac 位置。
- **开发者工具**：Tauri `devtools` 默认在 debug 启用，release 需要 `devtools` 特性（配置文档）；Mac 上是 Safari Web Inspector（右键「检查元素」或 Safari 的「开发」菜单）。
- **拖动区域**：`data-tauri-drag-region` 在 macOS 可用（推测，Tauri 通用功能）；但岛转成 NSPanel 后若 `isMovable = false`，拖动要走浮屿现有的自绘拖动逻辑（Alt 拖动是 Win32 修饰键实现，要换成 Mac 的 Option 键检测）。
- **首次点击**：`acceptFirstMouse`（配置文档：「点击非活动窗口时是否同时把点击传给 WebView」，macOS 专属）。非激活面板 + 岛上的按钮，要开它，否则第一次点击只用来激活窗口、按钮不响应（推测，需实测）。
- **拖放**：配置文档说 `dragDropEnabled` 在 Windows 上要关掉才能用 HTML5 拖放；macOS 上无此限制说明。文件中转功能的拖放需在 Mac 上重测。

### 10. 已知问题清单（2026-11-13 查询）

| issue | 内容 | 状态 |
|---|---|---|
| [tauri#13415](https://github.com/tauri-apps/tauri/issues/13415) | 透明窗口 dmg 打包后变白 | open（2025-05 起，2025-11 仍有人复现） |
| [tauri#9557](https://github.com/tauri-apps/tauri/issues/9557) | 窗口不能加入其他桌面、画不到全屏应用上方 | open（2024-04 起），被标为 #9439 的重复 |
| [tao#189](https://github.com/tauri-apps/tao/issues/189) | 请求 `set_visible_on_fullscreen` | open（2021-08 起，功能请求） |
| [tauri#7890](https://github.com/tauri-apps/tauri/issues/7890) | 混合缩放多屏下物理坐标错误 | open（2023-09 起，2026-07 有补丁提议） |
| [tao#816](https://github.com/tauri-apps/tao/issues/816) | 不同 DPI 多屏下 `outer_position` / `set_outer_position` 不对称 | open（2023-10 起） |
| [tauri#14165](https://github.com/tauri-apps/tauri/issues/14165) | 窗口圆角时子 WebView 不裁剪（unstable 多 WebView） | open（2025-09 起） |
| [tauri#9250](https://github.com/tauri-apps/tauri/issues/9250) | 穿透时的鼠标进出事件 → 改为暴露 `cursor_position` | closed（2024-04，PR #9297） |
| [tauri#11461](https://github.com/tauri-apps/tauri/issues/11461) | `setIgnoreCursorEvents` 不生效（Windows 10） | closed，not planned（2025-07） |

## 来源

- 刘海实现（4b 节，2026-11-13 读源码）：[boring.notch](https://github.com/TheBoredTeam/boring.notch)（`sizing/matters.swift`）、[Atoll](https://github.com/Ebullioscopic/Atoll)、[NotchDrop](https://github.com/Lakr233/NotchDrop)（`Ext+NSScreen.swift`、`NotchWindowController.swift`）、[DynamicNotchKit](https://github.com/MrKai77/DynamicNotchKit)（`NSScreen+Extensions.swift`）、[jackson-storm/DynamicNotch](https://github.com/jackson-storm/DynamicNotch)

- Tauri 配置参考（`macOSPrivateApi`、`visibleOnAllWorkspaces`、`acceptFirstMouse`、`windowEffects`、`devtools`、`dragDropEnabled`）：https://v2.tauri.app/reference/config/
- tauri 2.12.1 发布日志（透明 / 全屏不再需要私有 API，2026-09-30）：https://v2.tauri.app/release/tauri/v2.12.1/
- Tauri 2.12 公告（2026-09-26）：https://v2.tauri.app/blog/tauri-2.12/
- Tauri releases（2.12.5，2026-10-21；3.0.0-alpha.6，2026-11-06）：https://github.com/tauri-apps/tauri/releases
- docs.rs WebviewWindowBuilder（`data_store_identifier`、`background_throttling`，tauri 2.12.5）：https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html
- tauri-nspanel：https://github.com/ahkohd/tauri-nspanel ，README https://raw.githubusercontent.com/ahkohd/tauri-nspanel/v2.1/README.md ，类型说明 https://raw.githubusercontent.com/ahkohd/tauri-nspanel/v2.1/docs/key-types.md ，仓库数据 https://api.github.com/repos/ahkohd/tauri-nspanel
- tauri-nspopover-plugin：https://github.com/freethinkel/tauri-nspopover-plugin
- window-vibrancy：https://github.com/tauri-apps/window-vibrancy
- Apple NSWindow.Level：https://developer.apple.com/documentation/appkit/nswindow/level-swift.struct
- Apple NSScreen.auxiliaryTopLeftArea：https://developer.apple.com/documentation/appkit/nsscreen/auxiliarytopleftarea-uglc
- Apple NSScreen：https://developer.apple.com/documentation/appkit/nsscreen
- boring.notch：https://github.com/TheBoredTeam/boring.notch ，窗口源码 https://github.com/TheBoredTeam/boring.notch/blob/main/boringNotch/components/Notch/BoringNotchWindow.swift
- NotchDrop：https://github.com/Lakr233/NotchDrop ，窗口源码 https://github.com/Lakr233/NotchDrop/blob/main/NotchDrop/NotchWindow.swift
- Atoll：https://github.com/Ebullioscopic/Atoll ，https://hellogithub.com/en/repository/Ebullioscopic/Atoll
- DynamicNotchKit：https://github.com/MrKai77/DynamicNotchKit ，https://swiftpackageindex.com/mrkai77/DynamicNotchKit
- DynamicNotch：https://github.com/jackson-storm/dynamicnotch
- 刘海与全屏（背景阅读）：https://notes.alinpanaitiu.com/Fullscreen%20apps%20above%20the%20MacBook%20notch
- Sequoia 屏幕录制权限周期确认：https://9to5mac.com/2024/08/14/macos-sequoia-screen-recording-prompt-monthly/ ，https://9to5mac.com/2024/10/07/macos-sequoia-screen-recording-popups/ ，https://appleinsider.com/articles/24/08/07/users-have-to-confirm-screen-recording-permission-every-week-in-macos-sequoia ，https://talk.tidbits.com/t/apple-reduces-excessive-sequoia-permission-requests-shifts-to-monthly/28621
- 各 issue 链接见第 10 节表格。
