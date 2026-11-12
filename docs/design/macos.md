# macOS 上的岛

计划和全部决定见 [macos-port-plan.md](../architecture/macos-port-plan.md)「决定」，任务 G1.3、G1.11。调研见 [macos-notch-apps.md](../research/macos-notch-apps.md)、[macos-tauri-window.md](../research/macos-tauri-window.md)。

## 位置（2026-11-13）

- 岛先做**顶部正中**形态，所有屏幕（有刘海、无刘海、外接屏）都一样；和刘海融为一体的形态放到第 2 步（G1.11），作为可选项。（用户确认，M4）
- 顶部正中时**默认压在菜单栏上**；设置里可以改成**贴在菜单栏下面**，不挡应用菜单和状态栏图标。（用户确认，M5）

## 全屏应用（2026-11-13）

- 前台是全屏应用时，岛怎么显示做成设置，两种都能选：**隐藏，有提醒时短暂出现**（默认），或**照常显示**。（用户确认两种都做，M6；默认值按 Agent 推荐）
