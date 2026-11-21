# 小组件设计

> 日期：2026-11-20。问题：给 Fuyu 面板页设计一套好看、优雅的默认组件（至少 20 个），先学习优秀的小组件设计。范围：Apple Human Interface Guidelines 的 Widgets 页和 WWDC 小组件设计讲座、Nook X / NotchNest / NotchThings 等刘海类应用的商店页、几篇 2026 年 Mac 桌面组件的盘点文章，加上用户给的 Nook X 截图。预览页：[panel-default-widgets-preview.html](../investigations/panel-default-widgets-preview.html)。

## 结论

- **一个组件只讲一件事，扫一眼就懂**。Apple 把「glanceable」放在第一位：一个大数字或一句话加一个小标签，不在组件里塞完整功能。Fuyu 的组件照此做：标题行小而淡，主信息大而亮，操作最多一两个按钮。
- **尺寸宁少勿全**。Apple 的建议是给内容挑一个合适的尺寸，比把每种尺寸都做一遍更重要。Fuyu 只用现有的四种：1×1、2×1、2×2、4×1；每个组件有一个默认尺寸，最多再给一个备选。
- **内容要随一天变化**。好组件会自己变：早上是天气和会议，晚上提醒休息。Fuyu 的「今日」组件按时段换问候和水母的表情，番茄钟、年进度、专注统计都会自己走。
- **统一的底、克制的颜色**。Nook X 的做法值得学：深色底上每个组件只用一种强调色（橙色时钟、绿色打卡、橙色番茄环），其余是灰阶。Fuyu 沿用岛的黑底和 6% 白的卡片，每个组件挑一种强调色。
- **一点性格**。Nook X 用像素小人，Fuyu 已有水母标志，可以把它放进「今日」组件当吉祥物，按时段和 Agent 状态换表情。
- **默认首屏放最常看的**。刘海类应用的首屏都是时间天气、待办、番茄钟、音乐。Fuyu 的默认首屏（6×2）放今日、下一个会议、待办、番茄钟、打卡、正在播放，往右滚是 Agent、歌词、系统状态等。

## 详细

### Apple 的小组件指南要点

- 小组件用来显示及时、扫一眼就能看懂的内容，并提供少量功能，各平台外观一致（HIG Widgets）。
- 设计第一步是选定一个和应用主要用途相关的想法（HIG Widgets）。
- 一个尺寸合适的组件比提供所有尺寸更重要；推荐显示一天中会变化的动态信息（HIG Widgets）。
- 「看一眼就懂」以天气组件为例：大温度、小地点、一个图标（WWDC26 session 277）。WWDC20「Design great widgets」讲了内容、颜色、尺寸、布局和字体。

### 刘海 / 灵动岛类应用

- Nook X：商店页列出歌词、日期时间、天气、快速启动、快捷指令、待办、AI 对话、番茄钟、快速笔记和前置摄像头镜子，10 多种场景。用户截图里的组件页是一排：时钟天气、月度打卡格、便签、页切换、番茄环。
- NotchThings 有接 Apple 日历的日历页；NotchNest 有日历和对日程的 AI 提要。
- 共同点：首屏信息密度高，但每块只有一个主信息；深色底；强调色少。

### 桌面组件应用

- 盘点文章里被夸好看的是 BetterMacWidgets 的天气组件，晴雨雪有实时动画；Things 3、Drafts、Weathergraph 的组件常被推荐。
- WidgetWall 这类应用用自己的窗口模拟组件，不进系统组件栏，和 Fuyu 的做法相近。

### Fuyu 的默认组件清单

28 个，预览页里都能看到，按岛上已有的功能优先：

| 类别 | 组件 |
|---|---|
| 时间与日程 | 今日（时钟、天气、水母）、下一个会议、月历、世界时钟、倒数日、日出日落、年进度 |
| 专注 | 番茄钟、秒表、专注统计、打卡热力、习惯 |
| 待办与记录 | 今天的待办、便签、剪贴板、文件中转、截图 |
| 媒体 | 正在播放、歌词、音量亮度 |
| Agent 与消息 | Agent 会话、未读消息、翻译 |
| 系统 | 系统状态（CPU、内存）、电池、网速、快捷启动、喝水 |

## 来源

- [Apple Human Interface Guidelines：Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets)
- [WWDC20：Design great widgets](https://developer.apple.com/videos/play/wwdc2020/10103)
- [WWDC26 session 277](https://developer.apple.com/videos/play/wwdc2026/277/)
- [Nook X 商店页](https://apps.apple.com/app/id6733240772)
- [NotchThings 商店页](https://apps.apple.com/us/app/notchthings/id6762610441)
- [NotchNest 商店页](https://apps.apple.com/app/id6747612321)
- [Digital Trends：BetterMacWidgets](https://digitaltrends.com/computing/i-never-cared-about-mac-desktop-widgets-until-i-found-this-app/)
- [iGeeksBlog：9 best widgets for your Mac desktop](https://www.igeeksblog.com/best-widgets-for-mac/)
- [Setapp：WidgetWall](https://setapp.com/apps/widgetwall)
