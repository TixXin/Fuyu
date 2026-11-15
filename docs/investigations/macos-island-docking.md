# 岛屿吸附在 macOS 上的问题与计划

2026-11-15，「岛屿吸附 Mac 适配」主 agent 写。用户 2026-11-15 确认按计划开始，Q2、Q3 按推荐。用户的原话只有「岛屿的吸附 mac 适配有很多细节问题」，没有具体清单，下面是读代码找出来的疑似问题。

## 现状

- 吸附到四边已经做完：顶边（原有）、底边 C54.3、左右侧竖向岛 C54.1，托盘隐藏 C82，都已合入（PR #393、#400、#403）。做这批的「岛位置与托盘主 agent」（island-edges-lead）已经收口、空闲，没有认领中的岛屿文件。C54 下只剩 C54.2（Windows 任务栏模式），和 Mac 无关。
- Mac 的岛是 NSPanel，层级在菜单栏上方 3 级，加进私有的顶层 Space（`macos/island_panel.rs`、`macos/top_space.rs`）。坐标在 Mac 上统一成全局逻辑点（`island/screen.rs`）。
- 吸附的几何（`island/geometry.rs`、`top_edge.rs`、`bottom_edge.rs`、`side.rs`、`drag_hint.rs`）两个平台共用；工作区在 Mac 上取 `NSScreen.visibleFrame`（去掉菜单栏和 Dock，已核对 tauri-runtime-wry 2.12.3 的实现）。
- 已有的真机清单：`island-bottom-manual-tests.md`、`island-side-manual-tests.md`（在 island-edges-lead 的笔记目录），里面 Mac 项都还没人看过。

## 疑似问题清单

「确定」= 读代码能确认逻辑不对；「推断」= 要在真机上看。

### 1. 拖动中坐标单位错了，岛可能跳走（确定，Retina 屏）

- 现象：在 Retina 屏上拖动岛的过程中，只要有别的东西触发一次重新摆放（前端同步状态、刘海检查等），岛会跳到大约两倍坐标的地方，或找不到所在屏幕而跳回顶部正中。
- 原因：`lib.rs` 把 `WindowEvent::Moved` 的位置交给 `state.rs` 的 `record_dragged_position`，这个位置是物理像素；而 Mac 上 `custom_position` 约定是逻辑点（`screen.rs`）。拖动中 `apply_stage_geometry` 会按 `custom_position` 摆窗口（`geometry.rs` 的 `resolve_stage_position`）。拖完时拖动线程用 `screen::window_position` 覆盖成正确值，所以松手后看起来又对了。
- 改法：Mac 上不用 `Moved` 的物理坐标（换算成点，或拖动中不按 `custom_position` 摆窗口，只改大小）。

### 2. 默认「压在菜单栏上」时，拖回顶边吸不住、回不到刘海（确定）

- 现象：把岛拖走再拖回顶部，岛停在菜单栏下沿，形状是悬空的胶囊，不是贴边造型；有刘海的 MacBook 上也回不到刘海形态，只能去设置里把「吸附到」改回顶边。
- 原因：
  - `geometry.rs` 在 Mac 且不是「放在菜单栏下面」时把顶边算成屏幕最上沿（`top_inset = 0`），但 `top_edge.rs` 的 `snap_to_top` 和 `drag_hint.rs` 的顶边提示线一直按工作区上沿（菜单栏下沿）算。拖到菜单栏下沿会先吸住、随后 `sync_from_stage` 又按屏幕上沿判断成「没贴边」。
  - 刘海形态要求 `custom_position` 为空（`notch.rs` 的 `wants_notch`），拖过一次就一直有自定义位置。
  - （推断）macOS 拖窗口时系统不让窗口上沿越过菜单栏，所以拖不到屏幕最上沿。
- 改法：顶边吸附、提示线和 `geometry.rs` 用同一个「顶边」（Mac 压菜单栏时是屏幕上沿）；拖到顶边、并且水平方向靠近正中时，清掉自定义位置，回到默认的顶部正中（有刘海时自动回到刘海形态），发 `island-position-cleared` 让前端也清掉 `fuyu-position`。见问题 Q2。

### 3. 「显示在：跟随鼠标 / 跟随前台窗口」在 Mac 上不起作用（确定）

- 现象：设置 → 位置 →「显示在」在 Mac 上照样能选，选了没反应，岛一直在主屏。
- 原因：`island/mod.rs` 里 `follow` 在非 Windows 上用 `follow_unsupported.rs`（空函数）；`follow.rs` 用的是 Win32 的光标、前台窗口，`monitor_bounds` 直接读 `monitor.position()` 物理坐标。
- 改法：做 Mac 版：光标用 `macos::input::cursor_point`，前台窗口用 `macos/fullscreen.rs` 里已有的读最前面窗口的办法，屏幕范围统一走 `screen::`。贴底、贴侧边换屏后保持边和比例（Windows 已有）。

### 4. 插拔显示器、改分辨率、Dock 变化后岛不重新摆（确定 + 推断）

- 现象（推断）：外接屏拔掉后，原来在外接屏上的岛可能停在看不见的地方；改分辨率、把 Dock 换到左右或打开自动隐藏后，贴底和贴侧边的岛和 Dock 之间留空或压在 Dock 上，要拖一下才对。
- 原因（确定）：Mac 上唯一的屏幕监听是 `notch.rs` 的 `start_notch_watch`，每 2 秒只比较刘海信息；屏幕的位置、大小、工作区变了而刘海没变时不会重新调用 `apply_stage_geometry`。Windows 上由跟随循环和系统窗口管理兜底。
- 改法：把这个监听改成比较全部屏幕的 frame 和 visibleFrame（加刘海），有变化就重摆；保存的位置所在屏幕没了时按现有逻辑回到主屏，屏幕回来后回到原位。

### 5. 贴底时和 Dock 的关系（推断，需要真机确认）

- 贴边收起的底边岛往下缩，会压到 Dock 上沿；Dock 自动隐藏时，鼠标移到屏幕下沿会同时弹出 Dock 和岛，岛的层级比 Dock 高，可能挡住 Dock。
- 先看真机现象再决定改法（例如 Dock 自动隐藏时贴底岛让出 Dock 的弹出区）。

### 6. 其他要真机看的（推断）

- 台前调度（Stage Manager）开着时，左侧竖向岛和左边的应用缩略图条重叠。
- 菜单栏设成自动隐藏时，顶边岛的位置和「放在菜单栏下面」的效果。
- 全屏应用、切换 Space、Mission Control 时贴底和贴侧边的岛（游戏模式的贴边隐藏对底边、侧边是否正常）。
- 外接屏在主屏上方、两块屏缩放不同时，顶边、底边、侧边的吸附与「两屏相接的边不吸」。

## 任务和分工

先建 issue，再建任务（编号以 `pnpm tasks` 的空号为准，G1.23（#404）、G1.24（#405），父任务 G1）。两个任务按文件切开，可以**并行两个子会话**。

### 任务 A：拖动与顶边吸附（问题 1、2）— 子会话 `mac-dock-drag`

- scope：`src-tauri/src/island/state.rs`、`geometry.rs`、`top_edge.rs`、`drag_hint.rs`、`tests.rs`；如需前端配合（清掉 `fuyu-position`），只改 `src/windows/island/useIslandWindow.ts` 里处理 `island-position-cleared` 的那几行；`docs/design/macos.md`「位置」一节。
- 不碰 `lib.rs`、`notch.rs`、`mod.rs`、`follow*.rs`（任务 B 在改）。
- 做完：Mac 上拖动中不跳；拖回顶部正中回到默认位置（有刘海时回刘海）；拖到顶边但偏离正中时贴边造型正确；两种菜单栏设置下提示线位置和吸附位置一致。单元测试覆盖顶边计算和「回到正中」的判断。

### 任务 B：多显示器跟随与屏幕变化（问题 3、4）— 子会话 `mac-dock-screens`

- scope：`src-tauri/src/island/mod.rs`（只改 follow 的 cfg）、`follow.rs`（拆出平台相关的取点）、新文件 `follow_macos.rs` 或平台层 `src-tauri/src/macos/` 下的新文件、`notch.rs`（`start_notch_watch` 改成屏幕监听，函数名不变，免得改 `lib.rs`）、`follow_unsupported.rs`。
- 不碰任务 A 的文件。`platforms.md` 的「显示在」一行和 `macos-port-plan.md` 的记录写进笔记目录 `mac-dock-screens-docs.md`，主 agent 收口改。
- 做完：Mac 上三种「显示在」都生效；拔插外接屏、改分辨率、改 Dock 位置后 2 秒内岛回到正确位置；Windows 行为不变（`follow.rs` 是 Windows 代码，要跑交叉 clippy）。

### 之后

- 问题 5、6 等用户真机看过再定，需要改的另开任务（可能是任务 C）。
- 收口：主 agent 看两个会话的 diff，改 `platforms.md`、`macos-port-plan.md`，把 Mac 吸附的真机清单合成一份，回复并关闭 issue。

## 验证

- 两个任务都是 Rust：`cargo test --manifest-path src-tauri/Cargo.toml`（`CARGO_TARGET_DIR=src-tauri/target/agents`）、`cargo clippy --all-targets -- -D warnings`、交叉 `cargo clippy --target x86_64-pc-windows-gnu --all-targets`（保证 Windows 不坏）、`pnpm build:exe`。
- 任务 A 若改了前端：再跑 `pnpm check`、`pnpm build`、`pnpm test:regression island`。

## 真机实测清单（用户在 `pnpm tauri dev` 里看）

1. Retina 屏上拖岛来回移动 5 秒，中途不跳。
2. 默认「压在菜单栏上」：把岛拖走，再拖回顶部正中 → 回到顶部正中（有刘海时回到刘海形态）；拖回顶部但偏左 → 贴顶造型、位置记住。
3. 「放在菜单栏下面」：同上，贴在菜单栏下沿。
4. 拖动时顶边提示线出现在岛实际会吸到的位置。
5. 接外接屏：设置「显示在」选跟随鼠标、跟随前台窗口，岛跟着换屏；贴底、贴侧边的岛换屏后仍贴同一条边。
6. 岛放在外接屏上，拔掉外接屏 → 岛回到内屏；再插上 → 回到外接屏原位。
7. 贴底时把 Dock 改到左边、改成自动隐藏 → 岛 2 秒内贴到新的工作区下沿。
8. 问题 5、6 列的几项，看到什么记下来。
9. 之前没人看过的两份 Mac 清单（底边 4 项、侧边各项）顺手一起看。

## 要用户回答的问题

- Q1：你实际遇到的是哪些现象？上面的 1–6 有没有，或者还有别的（截图或一句话描述就行）。有的话我会并进任务里，没列到的另开。
- Q2：拖回顶部正中时，自动回到默认位置（有刘海时回到刘海形态）吗？推荐是，判断范围是离正中 ±40pt 以内。
- Q3：「显示在：跟随前台窗口」Mac 上也做吗？推荐做（和 Windows 一致）；不做的话 Mac 上隐藏这个选项。
