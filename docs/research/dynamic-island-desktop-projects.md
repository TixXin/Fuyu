# 桌面灵动岛（Dynamic Island）开源项目调研

> 日期：2026-11-12。问题：GitHub 上有哪些类似 Mac 或 Windows 的灵动岛（Dynamic Island）开源项目（不限 Star 数量）。范围：GitHub 全局检索（关键词：`"Dynamic Island" windows`、`"Dynamic Island" macOS`、`灵动岛`、`boring.notch`、`NotchDrop` 等技术栈与平台交叉组合）。相关任务：无（用户临时调研）。

## 结论

1. **生态差异显著**：
   - **macOS**：大多基于 MacBook 屏幕物理刘海（Notch）或顶部状态栏延伸，主要使用 **Swift / SwiftUI + AppKit** 开发。代表作以硬件交互适配、文件暂存（AirDrop / Shelf）、媒体 HUD 和系统通知为主。
   - **Windows**：由于没有物理刘海，大多设计为位于屏幕顶部正中的胶囊型浮动窗口（Floating Pill/Overlay）。主要技术栈分为两大流派：**C# (.NET / WPF / WinUI)** 与 **Tauri (Rust + Web / WebView2)**。早期的 Electron 方案因内存占用大已较少被新项目采用。
2. **功能重合度高**：
   - 基础标配：媒体播放控制（SMTC / Spotify / Apple Music）、音量/亮度/电量系统 HUD、待办便签与剪贴板历史。
   - 进阶特色：文件暂存与中转架（File Shelf）、AI 编码代理监控（如 Claude Code / Codex 终端状态集成，如 Fuyu、agentbro、cc-island）、桌面宠物与插件扩展系统。

---

## 详细清单

### 一、Windows 平台灵动岛项目

| 项目名称与仓库 | 主要技术栈 | 核心定位与特色功能 |
|---|---|---|
| [TixXin/fuyu](https://github.com/TixXin/fuyu) (浮屿) | Tauri 2 + React 19 + Rust | 本项目。待办、笔记归档、剪贴板与文件中转、QQ/微信/多邮箱提醒、快捷翻译、AI Agent (Claude Code/Codex) 状态监控与审批、插件市场。 |
| [flyl1u/fly-island](https://github.com/flyl1u/fly-island) | Tauri + React + Rust | 浮屿的前身上游。轻量级 PC 灵动岛，支持 QQ/微信/邮箱提醒、媒体控制与剪贴板。 |
| [warpirate/pillar-dynamic-island-for-windows](https://github.com/warpirate/pillar-dynamic-island-for-windows) | Tauri + React + Rust | 开源胶囊岛，集成媒体控制、专注定时器、系统通知、硬件监控与本地私有 AI 助手。 |
| [649472774/win-dynamic-island](https://github.com/649472774/win-dynamic-island) | Tauri 2 + React + TS | Windows 桌面悬浮灵动岛，支持媒体播放状态、音量/电量 HUD、系统信息与文件暂存架。 |
| [ypyik0669/winfinger-windows-island](https://github.com/ypyik0669/winfinger-windows-island) (WinFinger) | WPF / .NET 8 (C#) | 结合刘海工具与悬浮岛，支持网速/内存实时展示，展开提供剪贴板历史、番茄钟、AI 对话、OCR 识字等六功能面板。 |
| [BillyNabil/nabyscape](https://github.com/BillyNabil/nabyscape) | C# (.NET) + WPF | 强调极低 CPU/内存占用与零遥测隐私，包含媒体控制、音频波形可视化、便签、剪贴板与本地日历。 |
| [H7gamer/d-island](https://github.com/H7gamer/d-island) | WPF / .NET 8 (C#) | 桌面覆盖层，支持音乐播放控制、天气预报、日历、待办事项、便签、文件暂存架与系统警报。 |
| [Doulor/FluidBar](https://github.com/Doulor/FluidBar) | .NET 10 / C# 14 + SkiaSharp | 分层窗口自绘，高度模仿 macOS 动态岛视觉，包含媒体、系统状态、剪贴板与插件市场模式。 |
| [FlorianButz/DynamicWin](https://github.com/FlorianButz/DynamicWin) / [59xa/DynamicWin](https://github.com/59xa/DynamicWin) | C# (.NET) + WPF + SkiaSharp | 灵感源于 macOS NotchNook 与 iOS 灵动岛，支持快捷键展开、多功能小组件（天气/倒计时/剪贴板/文件架）。 |
| [WinIslandProject/WinIsland](https://github.com/WinIslandProject/WinIsland) | Rust (原生) | 采用 Rust 开发的高性能 Windows 灵动岛组件，主打简洁原生与无追踪遥测。 |
| [sadeeshasathsara/dynamic-island-on-windows](https://github.com/sadeeshasathsara/dynamic-island-on-windows) | WPF + WinRT (C#) | 侧重 Windows 11 原生 Toast 通知拦截与 iOS 风格弹出动效。 |
| [rajsriv/dynamic-island-for-windows](https://github.com/rajsriv/dynamic-island-for-windows) | Python + PyQt6 | 基于 PyQt6 实现的动态胶囊，具备弹性物理动效和模块化状态胶囊。 |
| [ClassIsland/ClassIsland](https://github.com/ClassIsland) | C# / WPF | （细分场景衍生）基于灵动岛交互风格设计的班级课表与课间提醒多媒体悬浮岛。 |

---

### 二、macOS 平台灵动岛 / Notch 交互项目

| 项目名称与仓库 | 主要技术栈 | 核心定位与特色功能 |
|---|---|---|
| [TheBoredTeam/boring.notch](https://github.com/TheBoredTeam/boring.notch) | Swift / SwiftUI | macOS 上知名度极高的开源刘海岛（GPL-3.0）。支持悬浮展开、媒体控制（封面与波形）、日历会议提醒、电池、文件 AirDrop 暂存、镜像检查与自定义 HUD。 |
| [Ebullioscopic/Atoll](https://github.com/Ebullioscopic/Atoll) (原 DynamicIsland) | Swift / SwiftUI | 将 MacBook 刘海转变为操作控制中心，支持媒体控制（Spotify/Apple Music/Cider）、系统硬件状态（CPU/GPU/内存）、计时器与剪贴板历史。 |
| [Lakr233/NotchDrop](https://github.com/Lakr233/NotchDrop) | Swift / AppKit | 专注于把屏幕刘海变为“文件暂存架”与 AirDrop 拖放中转站，支持自动保留期与快捷拖放。 |
| [jackson-storm/DynamicNotch](https://github.com/jackson-storm/DynamicNotch) | Swift / SwiftUI | 流体物理动效刘海岛，支持系统事件（电池/Wi-Fi/蓝牙）、下载进度、录屏指示、硬件 HUD 以及无刘海 Mac 的浮动胶囊模式。 |
| [sayweer/dynamicIsland](https://github.com/sayweer/dynamicIsland) | Swift / SwiftUI | 开源刘海实用工具，主打文件拖拽暂存区、AirDrop 投放区与剪贴板管理。 |
| [AdityaKasal/NotchIsland](https://github.com/AdityaKasal/NotchIsland) | Swift / SwiftUI | 灵感源于 Boring Notch，具有鼠标悬停展开、实时动态事件（Live Activities）与多活动折叠堆叠。 |
| [eliasemon/mac-island](https://github.com/eliasemon/mac-island) | Swift / SwiftUI | 模块化 Mac 灵动岛，包含实时媒体控制、音频频谱可视化、番茄钟、硬件遥测监控与临时文件架。 |
| [vendavalsc/Shima](https://github.com/vendavalsc/Shima) | Swift | 针对现代 macOS 优化的极轻量级刘海岛，强调空闲 CPU 占用接近 0%。 |
| [shirenchuang/agentbro](https://github.com/shirenchuang/agentbro) | Swift / Web | 专为 AI 编码助手（Claude Code、Codex 等）设计的 macOS 灵动岛，实时汇总 Agent 工具调用状态与完成通知。 |
| [bistin/cc-island](https://github.com/bistin/cc-island) | Swift | 针对终端命令行 AI 工具（Claude Code 等）的刘海状态展示器。 |
| [bring-shrubbery/dynamic-landing](https://github.com/bring-shrubbery/dynamic-landing) | Swift / SwiftUI | 贴靠屏幕顶边缘或刘海的动态展开胶囊组件。 |
| [govijr/DynamicNotch-MacOS](https://github.com/govijr/DynamicNotch-MacOS) | Swift (Package) | 面向开发者的 SwiftUI + AppKit 刘海胶囊开发包与状态调度控制器。 |
| [duongductrong/NotchKit](https://github.com/duongductrong/NotchKit) | Swift (Package) | 专注于单形状变形动画（Shape Morphing）的 macOS 刘海 UI 库。 |

---

### 三、跨平台项目（Windows / macOS / Linux）

| 项目名称与仓库 | 主要技术栈 | 核心定位与特色功能 |
|---|---|---|
| [TopMyster/Ripple](https://github.com/TopMyster/Ripple) | Node.js / Electron | 跨平台桌面通知中枢与微件系统，提供静止（Still）、快速（Quick）、大号展开（Large）三种形态。 |

---

## 来源

1. [GitHub: TheBoredTeam/boring.notch](https://github.com/TheBoredTeam/boring.notch)
2. [GitHub: Ebullioscopic/Atoll](https://github.com/Ebullioscopic/Atoll)
3. [GitHub: Lakr233/NotchDrop](https://github.com/Lakr233/NotchDrop)
4. [GitHub: jackson-storm/DynamicNotch](https://github.com/jackson-storm/DynamicNotch)
5. [GitHub: shirenchuang/agentbro](https://github.com/shirenchuang/agentbro)
6. [GitHub: sayweer/dynamicIsland](https://github.com/sayweer/dynamicIsland)
7. [GitHub: warpirate/pillar-dynamic-island-for-windows](https://github.com/warpirate/pillar-dynamic-island-for-windows)
8. [GitHub: 649472774/win-dynamic-island](https://github.com/649472774/win-dynamic-island)
9. [GitHub: ypyik0669/winfinger-windows-island](https://github.com/ypyik0669/winfinger-windows-island)
10. [GitHub: BillyNabil/nabyscape](https://github.com/BillyNabil/nabyscape)
11. [GitHub: Doulor/FluidBar](https://github.com/Doulor/FluidBar)
12. [GitHub: FlorianButz/DynamicWin](https://github.com/FlorianButz/DynamicWin)
13. [GitHub: TopMyster/Ripple](https://github.com/TopMyster/Ripple)
14. [GitHub: flyl1u/fly-island](https://github.com/flyl1u/fly-island)
15. [GitHub: TixXin/fuyu](https://github.com/TixXin/fuyu)
