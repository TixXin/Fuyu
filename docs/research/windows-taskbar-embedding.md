# 把窗口放进 Windows 11 任务栏

> 日期：2026-11-20。问题：汽水音乐那样把歌词组件放进 Win11 任务栏是怎么做的，岛屿的「吸附到」能不能加一个「任务栏」。范围：本机实测正在运行的汽水音乐 3.7.0（枚举窗口树和窗口样式）；联网搜索「Windows 11 taskbar SetParent Shell_TrayWnd」「汽水音乐 任务栏歌词」「TrafficMonitor Win11 任务栏窗口」「BetterNCM TaskbarLyrics」「Windhawk taskbar」，读了 Deskband11Lib、ComposeWindowsTaskBar 的 README。相关任务：暂无。

## 结论

- **汽水音乐没有把窗口塞进任务栏**。本机实测：任务栏 `Shell_TrayWnd` 下面没有它的子窗口；它的歌词条是一个**普通的顶层窗口，所有者（owner）设成了任务栏**，再把位置摆在任务栏托盘区左边。看起来像嵌在里面，其实是浮在上面。
- 这一招的关键是 **owner = `Shell_TrayWnd`**：Windows 保证被拥有的窗口永远在所有者上面，点任务栏、任务栏抢到前台时也不会把歌词条盖住，不用自己定时抢置顶。
- 其他公开做法（TrafficMonitor、Deskband11Lib、ComposeWindowsTaskBar）是 `SetParent` 把窗口变成任务栏的子窗口。跨进程子窗口在 Win11 上有模糊、输入队列互相卡住、Explorer 重启时窗口被一起销毁这些坑，对 WebView2 的岛更不友好。
- **建议**：岛屿加「吸附到 → 任务栏」时照汽水音乐的做法：岛的窗口保持顶层、透明、置顶，加 `WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW`，用 `SetWindowLongPtrW(GWLP_HWNDPARENT, Shell_TrayWnd)` 把所有者设成任务栏；折叠态高度贴合任务栏，放在空白区域里，展开时向上开（复用底边吸附的逻辑）。不用 `SetParent`，不注入 Explorer。
- 动手前要先实测的一件事：**Explorer 重启 / 崩溃时被拥有的跨进程窗口会怎样**（被一起销毁，还是所有者被清空）。岛是主窗口，不能跟着没了。见下文「风险」。

## 详细

### 本机实测：汽水音乐 3.7.0

用 `EnumChildWindows(Shell_TrayWnd)` 和 `EnumWindows` 枚举（屏幕 3072×1728，任务栏靠左对齐 `TaskbarAl=0`，任务栏矩形 `0,1680–3072,1728`）：

| 窗口 | 类名 | 样式 | 扩展样式 | 位置 |
|---|---|---|---|---|
| 任务栏 | `Shell_TrayWnd` | | | `0,1680–3072,1728` |
| 任务栏的子窗口（全是 explorer 的） | `Windows.UI.Composition.DesktopWindowContentBridge`（XAML 内容）、`Start`、`TrayNotifyWnd`、`ReBarWindow32` / `MSTaskSwWClass` / `MSTaskListWClass`（旧任务列表，Win11 上不可见或只是占位） | | | 托盘区 `TrayNotifyWnd` 在 `2624–3072` |
| 汽水音乐歌词条 | `Chrome_WidgetWin_1`（Electron），**parent = 0，owner = `Shell_TrayWnd`** | `0x14000000`（`WS_VISIBLE \| WS_CLIPSIBLINGS`） | `0x08080088`：`WS_EX_NOACTIVATE \| WS_EX_LAYERED \| WS_EX_TOOLWINDOW \| WS_EX_TOPMOST` | `2222,1684–2612,1735`，右边离托盘区 12px |
| 汽水音乐另一个窗口 | 同上，owner 也是任务栏 | 同上 | 少了 `WS_EX_LAYERED` | `-26214,-26214`（藏在屏幕外，推测是弹层或备用窗口，未核实） |

读出来的做法：

1. 顶层、无边框、分层透明的窗口（Electron 透明窗口）。
2. `NOACTIVATE`：点它不抢焦点，任务栏和当前应用的焦点不变。
3. `TOOLWINDOW`：不在任务栏和 Alt+Tab 里出现。
4. `TOPMOST` + owner 是任务栏：始终压在任务栏上面。
5. 位置：以 `TrayNotifyWnd` 的左边为右锚点往左摆；这台机器任务栏靠左，图标只占到 `435`，所以不会撞。任务栏居中且图标很多时它怎么避让，本机没法测（未核实）。

### 公开的几种做法

| 做法 | 谁在用 | 优点 | 问题 |
|---|---|---|---|
| **A. 顶层窗口，owner 设为任务栏** | 汽水音乐（本机实测） | 不改窗口父子关系，WebView2 照常渲染；z 序由系统保证在任务栏之上；改动最小 | 位置要自己跟（任务栏自动隐藏、换屏、DPI、对齐方式）；Explorer 重启后要重新设 owner |
| **B. `SetParent` 成任务栏的子窗口** | TrafficMonitor、Deskband11Lib、ComposeWindowsTaskBar | 随任务栏一起移动、隐藏；被裁在任务栏里 | 跨进程子窗口会把两个进程的输入队列连在一起，我们卡住时任务栏也卡；Win11 上有被模糊、被 DWM 当成顶层绘制的反馈；Explorer 重启时子窗口被一起销毁，要重建窗口 |
| C. 注入 explorer 改任务栏 XAML | Windhawk 的任务栏 mod | 真正在任务栏里面，和系统控件排版一致 | 要往 explorer.exe 注入 DLL，Windows 更新就可能坏，杀软会报；不适合作为普通应用的功能 |
| D. 只是置顶覆盖，不设 owner | — | 最简单 | 点任务栏后任务栏会盖上来，要定时抢置顶，会闪 |
| E. `IDeskBand` 工具栏 | Win10 及以前的任务栏歌词 | 官方 API | Win11 已删除 |

几个项目的细节：

- **Deskband11Lib**（MIT）：把窗口样式从弹出窗口改成子窗口，`SetParent` 到 `Shell_TrayWnd`（副屏是 `Shell_SecondaryTrayWnd`），用 `SetWindowPos` + `SetWindowRgn` 摆位置和裁剪。空白区域用 UI Automation 找开始按钮、小组件按钮、任务按钮组和托盘区，算出任务按钮和托盘之间的空当；对齐方式读注册表 `TaskbarAl`，读不到就看开始按钮的位置。Explorer 重启、DPI 变化、显示器断开时窗口要**重建**，不能重新挂上。有 Tauri 插件 `tauri-plugin-deskband11lib`，但要带一个 `deskband11lib.dll`。默认每 500ms 刷新一次布局。
- **ComposeWindowsTaskBar**：同样 `WS_CHILD` + `SetParent`，几个锚点（开始按钮后、任务列表后、居中、托盘前），每秒几次对照任务栏的实时几何；重挂失败时有一个 `Overlay` 模式兜底（没写细节）。
- **TrafficMonitor**：Win11 上同样挂进任务栏，靠 `TaskbarAl` 判断对齐，用户没改过对齐时这个值不存在会误判；更新日志里修过和小组件按钮重叠、触屏设备上位置不对。
- **Lyricify Lite**：更新日志提到「优化任务栏歌词嵌入」「任务栏崩溃后自动重新打开」，具体做法未核实。

### 放到岛屿上要做什么

现有代码：吸附边是 `src-tauri/src/island/state.rs` 的 `Edge { Top, Left, Right, Bottom }`，底边吸附在 `island/bottom_edge.rs`，设置页的选项在 `src/windows/settings/sections/PositionSettingsSection.tsx`，前端类型是 `src/lib/settings/api.ts` 的 `IslandDockEdge`。

1. **新的吸附位置**：`Edge` 加 `Taskbar`，前端 `IslandDockEdge` 加 `"taskbar"`，设置页「吸附到」加「任务栏」（只在 Windows 显示）。这会改写到设置里的值，旧版本读到 `taskbar` 要能退回默认（对外契约，见 contracts.md）。
2. **窗口样式**（`src-tauri/src/win32/` 里加一个 `taskbar_owner.rs` 之类）：`FindWindowW("Shell_TrayWnd")`（副屏用 `Shell_SecondaryTrayWnd`，按岛所在显示器挑）；`SetWindowLongPtrW(GWLP_HWNDPARENT, tray)`；加 `WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW`。离开任务栏吸附时把 owner 设回 0、样式还原。
3. **位置和大小**：折叠态高度 = 任务栏高度（不同缩放和「小任务栏」下不一样，要按实际矩形算）。空白区域：
   - 靠左对齐：任务按钮的右边到 `TrayNotifyWnd` 的左边，岛靠托盘那一侧放（和汽水音乐一样）。
   - 居中对齐：任务按钮组左边或右边，挑宽的那边。
   - 任务按钮的范围用 UI Automation 取（`win32/uia_list.rs` 已有 UIA 遍历），`MSTaskListWClass` 的矩形在 Win11 上不可靠。
   - 空间不够时缩窄岛（只放歌词一行），再不够就退回底边吸附并提示。
4. **展开**：向上展开，复用 `bottom_edge.rs` 的舞台定位；展开时窗口超出任务栏是允许的（顶层窗口不会被裁）。
5. **要跟随的变化**：任务栏自动隐藏（任务栏移出屏幕时岛也藏起来或跟着走）；任务栏位置、对齐、图标数量变化；DPI 和显示器变化；全屏应用（任务栏退到下面时岛也要让开，岛现在有没有全屏检测要查一下）。可以用 `SetWinEventHook(EVENT_OBJECT_LOCATIONCHANGE)` 盯 `Shell_TrayWnd`，再加一个慢的轮询兜底。
6. **Explorer 重启**：监听 `RegisterWindowMessage("TaskbarCreated")`（托盘图标那边可能已经有），重新找任务栏、重新设 owner、重新算位置。

### 风险

- **owner 被销毁时会发生什么（未核实，必须先测）**：同进程里所有者销毁时被拥有的窗口会被一起销毁；跨进程的情况文档没写清楚。要在虚拟机或测试机上 `taskkill /f /im explorer.exe` 和正常重启 Explorer 各试一次，看岛的窗口还在不在。如果会被带走，就在 Explorer 要退出前（`TaskbarCreated` 之前收不到信号）想别的办法，比如退回做法 D：只置顶、不设 owner，定时把自己放到任务栏上面。
- **跨进程 owner 的输入问题**：设 owner 不会像 `SetParent` 那样连输入队列（这是推测，汽水音乐用着没问题可以佐证，但要自己测：岛卡住时任务栏还能不能点）。
- **和任务栏抢点击**：岛盖住的地方点不到任务栏。岛只占空白区域，空白区域本来没有按钮；但「任务栏右键菜单」在那块会点不到。
- **Windows 10**：任务栏结构不同（没有 XAML），对齐也只有靠左；可以先只做 Win11，Win10 上不显示这个选项。
- **macOS**：没有任务栏，不显示这个选项；platforms.md 要加一行。

## 来源

- 本机实测：汽水音乐 3.7.0（`C:\Users\tixxin\AppData\Local\Programs\Soda Music\3.7.0\SodaMusic.exe`），2026-11-20，用 PowerShell 调 `EnumChildWindows` / `EnumWindows` / `GetWindow(GW_OWNER)` / `GetWindowLongPtr` 枚举。
- [Deskband11Lib（GitHub，airtaxi）](https://github.com/airtaxi/Deskband11Lib)
- [ComposeWindowsTaskBar wiki（GitHub，LionZXY）](https://github.com/LionZXY/ComposeWindowsTaskBar/wiki)
- [r/windowsdev：Application inside taskbar for Win11](https://redlib.hackliberty.org/r/windowsdev/comments/1fwo9p4/application_inside_taskbar_for_win11)
- [Microsoft Q&A：Win11 上 SetParent 后仍按顶层窗口绘制](https://learn.microsoft.com/en-us/answers/a/12736602)
- [TrafficMonitor 帮助文档](https://github.com/0nahid/TrafficMonitor/blob/master/Help_en-us.md)、[TrafficMonitor V1.85 更新日志](https://newreleases.io/project/github/zhongyang219/TrafficMonitor/release/V1.85)
- [Lyricify Lite 1.2.1 更新日志](https://newreleases.io/project/github/WXRIW/Lyricify-App/release/lite-v1.2.1)
- [Windhawk mods for the Windows 11 taskbar](https://ramensoftware.com/windhawk-mods-for-the-windows-11-taskbar)
