# macOS 刘海岛 / 灵动岛类应用调研

> 日期：2026-11-13。问题：Mac 上的刘海岛 / 灵动岛类应用现在是什么格局；浮屿做 Mac 版（自用 + 正式对外发布）靠什么和它们区分，哪些做法值得借鉴，哪些坑要避开。范围：产品官网（lo.cafe、tryalcove.com、dynamiclake.com、topnotch.app、vibeisland.app 等）、Mac App Store（美区 / 国区页面）、GitHub（仓库页与 REST API 的 star、`pushed_at`、releases，issue 搜索 `repo:TheBoredTeam/boring.notch fullscreen` / `"external display"`）、Setapp 评价、MacRumors 论坛、Reddit r/macapps（经镜像检索）、Product Hunt、少数派、V2EX、Apple Developer Forums；关键词：`NotchNook`、`Alcove`、`DynaNotch`、`MediaMate`、`Notchmeister`、`TopNotch`、`DynamicLake`、`best notch apps 2026`、`macOS 15.4 MediaRemote`、`Claude Code notch`、`Mac 灵动岛 微信 QQ 歌词 网易云` 等。已有调研 [dynamic-island-desktop-projects.md](dynamic-island-desktop-projects.md) 列过的 macOS 开源项目不再重复罗列，只在需要时引用。相关任务：G1（macOS 适配，计划见 [macos-port-plan.md](../architecture/macos-port-plan.md)）

## 结论

### 格局（事实，附来源见「详细」）

1. **通用刘海岛已经是成熟、拥挤的红海。** 收费的头部是 NotchNook（lo.cafe，买断或订阅，分 Pro / Classic 两档）、Alcove（$12.99 买断）、DynamicLake Pro（约 $14–17 买断，价格未核实）；免费开源的头部是 boring.notch（11.3k star）和 Atoll（5.3k star），两者都在持续更新（截至 2026-11-12 仍有推送）。功能高度同质：媒体控制 + 音频波形、日历、文件暂存 / AirDrop、系统 HUD 替换（音量亮度）、Live Activities（蓝牙、充电、下载、录屏）、剪贴板、番茄钟 / 待办。
2. **头部产品基本都不在 Mac App Store。** NotchNook、Alcove、DynamicLake、boring.notch、Atoll、Vibe Island 都是官网 / Gumroad / GitHub / Homebrew 分发；上架 App Store 的（Notchmeister、NotchBox、Nook X）功能较轻。Alcove 的 FAQ 直接写明依赖 Apple 私有 API、功能「不保证一直可用」。（推测：媒体读取用的 MediaRemote 私有框架和辅助功能权限与 App Store 沙盒不兼容，是头部产品不上架的主因。）
3. **macOS 15.4 之后，第三方应用直接加载 MediaRemote 读「正在播放」失效。** 社区的通行解法是 [mediaremote-adapter](https://github.com/ungive/mediaremote-adapter)：借 `/usr/bin/perl`（bundle id 是 `com.apple.perl`，被系统放行）加载辅助框架，把播放状态打到 stdout；boring.notch 明确致谢并内置了它。这是一个「借道」方案，作者自己也称是权宜之计，随时可能被 Apple 封堵。
4. **AI 编码代理的刘海工具在 2026 年爆发，已经不是空白。** 收费的 Vibe Island（$19.99，号称支持 30 种代理、刘海里审批 / 回答问题 / 看计划）、开源的 CodeIsland（2.6k star，MIT，30+ 工具，带 iPhone / Watch 伴侣和 Bark 推送）、Claude Island（2.5k star）、MioIsland、Notchi 等一大批；**NotchNook Pro 也已把「在刘海里批准 Claude Code 和 Codex」做成付费功能**，Atoll 加了 Claude 用量徽标。agentbro 反而不算活跃（166 star）。所以「有 Agent 状态」本身已不足以成为浮屿的差异点。
5. **中文生态是明显的缺口。** 没有找到任何 Mac 刘海应用做 QQ / 微信消息提醒；Apple DTS 明确表示 macOS **没有**读取其他应用通知的公开 API。国内音乐软件方面，Atoll 新加了网易云歌词兜底，开源的 Lyrimuse 支持 QQ 音乐 / 网易云 / 酷狗的逐字歌词并有「灵动岛胶囊」模式，国区 App Store 的 Nook X 有中文、国产大模型对话和第三方播放器歌词，但没有一个把「国内 IM + 国内音乐 + 中文日历（农历节假日）」做全。
6. **用户抱怨集中在四类：** 悬停误触（经过菜单栏时刘海展开、抢走焦点）、全屏时刘海仍然露出、外接屏 / 无刘海机型上显示突兀或过大、更新后耗电 / CPU 升高或 macOS 升级后功能失效、开发者失联。

### 浮屿 Mac 版的定位建议（分析与推测）

- **不要以「又一个 NotchNook」进场。** 媒体 + 文件架 + HUD 这套标配上，免费的 boring.notch / Atoll 已经够好，付费的 NotchNook / Alcove 动效打磨远超一个 Tauri WebView 版本能在短期达到的水准。
- **定位成「中文用户的效率岛 + AI 代理控制台」，并以跨平台为卖点**：同一套待办、笔记、日历、剪贴板、插件和主题在 Windows 与 Mac 上同步体验。竞品全部只做 Mac，浮屿是少数 Windows 起家、同时覆盖两端的岛，这是别人短期复制不了的。
- **差异化的三根柱子**：①中文场景（农历节假日日历、网易云 / QQ 音乐歌词、邮箱、国产翻译模型、QQ / 微信提醒尽力而为）；②AI 代理（Claude Code / Codex 状态、审批、用量、离开时推手机，已在 Windows 做成，Mac 上与 CodeIsland / Vibe Island 正面竞争，要靠「不是单功能工具」取胜）；③插件市场与主题市场（boring.notch 的扩展系统还在路线图上，商业产品都是封闭的）。
- **分发上先走「签名 + 公证 + 官网 / GitHub + Homebrew cask」，不以 App Store 为目标。** 正式对外发布必须买 Apple Developer（$99/年）做 Developer ID 签名和公证，否则会和 boring.notch 一样让用户手动绕过 Gatekeeper，这对非技术用户是劝退点。

### 值得借鉴的具体做法（详见文末）

1. 无刘海屏 / 外接屏回退成「屏幕顶部正中的紧凑胶囊」，并提供「跟随当前活动屏 / 固定一块屏 / 所有屏」三选一（boring.notch 2.8 刚加「跟随活动屏」，Vibe Island 的外接屏胶囊）。
2. 全屏应用时默认隐藏岛，只在有提醒时短暂出现（boring.notch 用户长期呼声最高的需求之一）。
3. 媒体读取用 mediaremote-adapter 的思路，并在播放器层面做降级：读不到系统「正在播放」时，对 Apple Music / Spotify 用 AppleScript 兜底，网易云 / QQ 音乐用歌词源匹配。
4. 双指下滑打开、上滑收起作为悬停之外的第二种手势（Atoll、Alcove），悬停加延迟并提供「仅点击」开关（浮屿 Windows 版已有，NotchBox / Nook X 用户在要）。
5. 试用 + 买断 + 多设备授权（NotchNook 48 小时、Alcove 72 小时试用，Alcove 3 台设备、14 天退款）——如果 Mac 版要收费，这是用户已经习惯的模式。

### 需要避免的坑

- 鼠标悬停就展开且抢焦点：多个应用被抱怨「经过菜单栏就弹开」「悬停切走了别的应用的焦点」。展开时绝不激活应用、不抢键盘焦点。
- 全屏视频 / Quick Look 时露出刘海或 1px 黑线（boring.notch #426、#892、#1630）。
- 接管亮度 / 音量键导致 BetterDisplay、Lunar 等外接屏工具失效（boring.notch #943、#880），默认不接管系统 HUD。
- 把私有 API 当长期依赖：MediaRemote 在 15.4 已断过一次，Alcove 也明说不保证。所有私有 API 能力要有开关、有降级、有失效提示。
- 不签名就发布、或签名后却被用户从第三方站点下载到仿冒包（notch-island-tools 的下载安全规则专门提醒过 DynamicLake 仿冒域名）。

## 详细

### 一、商业产品（价格与版本均为 2026-11-13 查询）

| 产品 | 主要功能 | 价格与收费模式 | App Store | 最低 macOS | 用户常见抱怨 |
|---|---|---|---|---|---|
| **NotchNook**（lo.cafe） | Classic：音乐控制、日历、Nook 小组件、文件 Tray、基础 Live Activities。Pro 另有：液态玻璃刘海、全部 Live Activities（蓝牙、下载等）、Pocket 与剪贴板、番茄钟与待办、文件格式转换、**歌词**、**在刘海里批准 Claude Code 与 Codex**、提词器与终端 [1] | 官网按地区显示人民币：Pro 买断 ¥129 或 ¥20/月；Classic 买断 ¥99 或 ¥13/月；48 小时免费试用、无需绑卡；一份授权 2 台 Mac [1]。2024 年评测记为 $25 买断或 $3/月 [2] | 否（官网直销；另在 Setapp 上架 [3]） | 14.6；Pro 仅限 Apple 芯片 [1]（Setapp 版标 14.4 [3]） | Setapp 评价里有 1.5.5 更新后明显耗电；MacRumors 论坛有人怀疑它拉低 MacBook Air 续航、建议回退 1.4.6；媒体控制有时要在播放中重启应用才生效 [3][4]。Setapp 好评率 89%（1438 个评分，查询时）[3] |
| **Alcove**（tryalcove.com） | 流畅过渡动画、即时通知、Live Activities、滑动手势、可自定义 HUD、锁屏小组件 [5] | $12.99 买断（Stripe），含后续更新；72 小时试用；一份授权 3 台设备；14 天无理由退款 [5][6] | 否（官网直销） | 15 [5] | Reddit 上有「某次 macOS 升级后不好用、开发者一度失联」的抱怨，AlternativeTo 上有人因开发者沉寂打低分、恢复更新后改回五星 [7]。FAQ 自称依赖私有 API，不保证功能长期可用 [6] |
| **DynamicLake Pro** | 通知、拖放、格式转换、来电、AirDrop、计时器、电量与日历提醒、液态玻璃（外接屏可单独开）、精简的 miniLake 模式 [8] | 官网未显示价格（只有「限时 8 折」）；第三方页面记录为 $13.99–$16.90 买断，退款期 14 或 30 天，说法不一，**未核实** [9] | 否 | 未核实 | 未找到集中的抱怨来源，未核实。notch-island-tools 提醒只从 dynamiclake.com 下载，存在仿冒域名 [17] |
| **DynaNotch** | 没有搜到叫这个名字的产品。最接近的是开源的 **DynamicNotch**（jackson-storm，GPL-3.0，免费，未用付费开发者证书签名、首次打开要「仍要打开」），已在已有调研中列过 [10]；另有同名的 Gumroad 付费文件架工具「Dynamic Notch」，是另一个产品 [10] | DynamicNotch 免费 | 否 | 未核实 | notch-island-tools 把 DynamicNotch 标为「过时 / 早期演示」[17] |
| **MediaMate**（Wouter01） | 替换系统音量 / 亮度 HUD，增加可显示在刘海处的「正在播放」HUD [11] | Gumroad 一次性购买，标价 €6.99 起（搜索摘要，**未核实**当前价格）[11] | 否（Gumroad） | 未核实 | 第三方追踪显示 3.8.3 版，2026-04-14 更新 [12]；macOS 15.4 后 r/macapps 有人问何时修复「正在播放」，**修复情况未核实** [13]。notch-island-tools 把它标为「存档 / 边缘」[17] |
| **Notchmeister**（Iconfactory） | 光标经过刘海时的趣味特效（发光、等离子、雷达等），无刘海 Mac 可加一个假刘海 [14] | 免费 | 是 | 11.0 [14] | 评分太少无汇总；仅有的差评是 2022 年的「无法退出导致阻止关机重启」[14]。属于玩具类，不是同类竞品 |
| **TopNotch**（CleanShot 团队） | 把菜单栏涂黑让刘海「消失」，可选壁纸圆角，支持动态壁纸、多显示器和多桌面 [15] | 免费 | 否（官网下载）| 11.0 [15] | 页面无版本与更新日期，维护状态未核实 [15]。属于「藏刘海」类，与浮屿不竞争 |
| **NotchBox**（App Store） | 音乐动画（Apple Music、Spotify、Safari 内网页播放）、文件暂存 + AirDrop、番茄钟、计时、镜子、网速、剪贴板、日历、应用快捷方式等 [16] | 免费 + Pro 内购 $7.99 [16] | 是 | 13.0 [16] | 悬停就展开，在用菜单栏时很烦，希望改成点击 / 长按；刘海挡住一个菜单栏图标；Roon / Qobuz 不能控制；不能设默认打开的页 [16] |
| **Nook X - 效率岛**（国区 App Store） | 中文效率岛：歌词（第三方播放器与 Safari，具体播放器未列出）、日期天气、待办、番茄钟、速记、启动器、文件暂存、镜子、**AI 对话（DeepSeek、通义、GLM、豆包、星火、文心）**、喝水久坐提醒 [18] | 免费 + 内购：永久会员 ¥38、Pro 年卡 ¥38、月卡 ¥12 [18] | 是 | 14.0 [18] | 鼠标离开后收起慢、卡顿；外接屏上岛比菜单栏高、凸出来；悬停会切走其他应用的焦点，希望有「只做动画」选项 [18] |

其他在榜单里反复出现、本次未展开的商业产品：MacNotch（Setapp）、LookieLoo（有 Spotify / Apple Music / YouTube 歌词）、Notchable、Notchpad、ChatNotch（中文官网，歌词、提词器、暂存架，DMG 直装，macOS 14+）[17][19]。

### 二、开源项目（活跃度最高的几个，数字为 2026-11-13 经 GitHub API 查询）

已有调研列过 boring.notch、Atoll、NotchDrop、DynamicNotch 等，这里只补维护情况和本次关心的技术问题。

| 项目 | star / 许可 | 近期维护 | 媒体控制（15.4 后） | 无刘海与外接屏 | 交互 |
|---|---|---|---|---|---|
| [boring.notch](https://github.com/TheBoredTeam/boring.notch) | 11,342 / GPL-3.0；开放 issue 430 | `pushed_at` 2026-11-12；v2.8-rc.2（2026-10-10）加入「刘海跟随活动显示器」，rc.1（2026-09-25）修 CPU 占用过高并改名 Boring Notch [20][21] | README 致谢 MediaRemoteAdapter「让我们在 macOS 15.4+ 能用『正在播放』来源」，仓库内带 `mediaremote-adapter` 目录 [20] | 设置里有「所有显示器都显示」和「首选显示器」，用户要求「只在当前聚焦的屏显示」（#1424）；无刘海屏上收起态是个空胶囊（PR #1718 加时钟）、外接屏默认收起态偏大（#969）[22] | 悬停展开；菜单栏星形图标打开设置 [20] |
| [Atoll](https://github.com/Ebullioscopic/Atoll) | 5,253 / GPL-3.0；开放 issue 240 | `pushed_at` 2026-11-12；v2.3.3-alpha.4 / beta.3（2026-09-07）是近期最大版本：钉住歌词、逐字高亮、**网易云歌词兜底**、按应用调音量、Claude 套餐徽标与用量修复、Antigravity 用量跟踪 [23][24] | README 未写明做法，未核实 | README 写需要带刘海的 MacBook；alpha.4 修了外接屏工具（BetterDisplay、Lunar）占用亮度键时的处理 [23][24] | 靠近刘海悬停展开、点击进入控制；关闭悬停后可用双指下滑打开、上滑收起；设置里可开横向媒体手势 [23] |

**macOS 15.4 媒体控制受限的来龙去脉**：从 15.4 起，应用内直接加载 MediaRemote 私有框架完全不可用；[mediaremote-adapter](https://github.com/ungive/mediaremote-adapter)（BSD-3-Clause）发现 bundle id 以 `com.apple.` 开头的进程仍被放行，于是让系统自带的 `/usr/bin/perl` 加载一个辅助框架，把「正在播放」事件打印到 stdout 供应用读取；作者称其为权宜之计，README 的「最近测试」标记为 2026-09-04、macOS 27.0 beta（26A5425a）[25]。Keyboard Maestro 论坛、BetterTouchTool 社区在 15.4 时都出现过同类故障报告 [26]。使用它的有 Lyrimuse、Music Presence、Aerial 等 [25]。

### 三、中文用户关心的点

| 需求 | Mac 上的现状 | 来源 |
|---|---|---|
| QQ / 微信消息提醒上岛 | **没有找到任何刘海应用支持。** Apple DTS 在开发者论坛答复：macOS 没有读取或拦截其他应用通知的公开 API，`DistributedNotificationCenter`、Darwin 通知、`NSWorkspace` 都拿不到 [27]。SuperIsland 中文增强版的通知只能收集扩展、WhatsApp 和部分应用广播，自己写明「并非所有应用的系统通知镜像」[28]。中文工具索引 notch-island-tools 里也没有一个提到微信 / QQ [17] | [27][28][17] |
| 网易云 / QQ 音乐歌词 | Atoll 2026-09 加了网易云歌词兜底 [24]；SuperIsland 中文增强版用 MediaRemote Adapter 支持 QQ 音乐、QRC 逐字歌词、酷狗备选源，未提网易云 [28]；Lyrimuse（GPL-3.0，免费）支持 QQ 音乐、网易云、酷狗的逐字歌词，有桌面、灵动岛胶囊、歌词窗口、菜单栏四种显示 [29]；LyricsX 有 163 / QQ / 酷狗歌词源，但 2022 年后无新版本 [30] | [24][28][29][30] |
| 网易云 / QQ 音乐的媒体控制 | 这两个 Mac 客户端是否向系统「正在播放」上报状态，**未找到可靠说明，未核实**；SuperIsland 说 QQ 音乐可经 adapter 识别 [28] | [28] |
| 中文本地化的刘海岛 | Nook X（国区 App Store，中文 + 国产大模型对话）[18]、ChatNotch（中文官网）[19]；CodeIsland 有完整中文 README [31] | [18][19][31] |

（分析）浮屿 Windows 版的 QQ 提醒靠 Windows 通知监听、微信提醒靠任务栏闪烁与 UI Automation（见 `docs/features/qq-notifications.md`、`wechat-reminders.md`），这两条路在 macOS 上都没有直接对应物。可能的替代路线是用辅助功能 API 读 Dock 图标的角标（badge），只能得到「有新消息 / 未读数」，拿不到联系人与正文——**这一点是推测，未验证**，Mac 版立项时要先做技术验证。

### 四、AI 编码代理状态类工具（2026-11-13 查询）

| 工具 | 形态 / 收费 | 支持的代理 | 关键能力 | 维护 |
|---|---|---|---|---|
| Vibe Island | 刘海，闭源，$19.99 买断（1 台 Mac），可免费下载试用 [32] | 30 种，含 Claude Code、Codex、Gemini CLI、Cursor、OpenCode、Kiro [32] | 刘海里批准权限、回答 AskUserQuestion、看计划（Markdown）、用量、8-bit 提示音、SSH 远程；20+ 终端精确跳到标签 / 分屏；**无刘海或外接屏时显示为屏幕顶部正中的悬浮条** [32] | 活跃（官网在售） |
| CodeIsland（wxtsky） | 刘海，MIT，免费 | 30+ 工具，含 Claude Code、Codex、Gemini CLI、Cursor、Copilot CLI | 状态、当前工具、最新回复、git 分支 / worktree、用量、像素吉祥物、安静时段、SSH 远程、iPhone / Watch 伴侣、ESP32 桌面摆件、Bark / Slack 推送；能等待决策的钩子可在刘海里批准 / 拒绝 / 总是允许；外接屏与无刘海屏可用；macOS 14+ [31] | 2,570 star，`pushed_at` 2026-10-28 [33] |
| Claude Island | 刘海，Apache-2.0，免费 | Claude Code | 多会话监控、聊天记录、首启自动装钩子、刘海里批准工具调用；macOS 15.6+ [34] | 2,537 star，`pushed_at` 2026-04-20（半年未推送）[35] |
| MioIsland | 刘海，开源但非商用许可 | Claude Code | 监控、批准、跳转会话；靠 `~/.claude/settings.json` 钩子 + Python 脚本 + Unix socket；未签名；有 iPhone 伴侣 CodeLight [36] | 二手资料记 v3.1.3（2026-08-13），未核实 [36] |
| NotchNook Pro | 通用刘海岛的付费档 | Claude Code、Codex | 刘海里批准 [1] | 活跃 |
| Atoll | 通用刘海岛，开源 | — | Claude 套餐徽标与用量、Antigravity 用量 [24] | 活跃 |
| agentbro | 刘海 + 桌宠市场，Apache-2.0 | Claude Code、Codex 等 | 官网标题为「桌宠市场与 AI 代理灵动岛」，细节未核实 [37] | 166 star，`pushed_at` 2026-10-01 [37] |
| CodexBar（steipete） | 菜单栏 | Claude Code、Codex | 5 小时 / 每周额度与重置时间、CLI；v0.42.0 可选查找并聚焦活跃会话 [38] | Homebrew cask 分发 [38] |
| Clabar | 菜单栏 | Claude Code | 用量 + 通过钩子发系统通知（权限请求、提问、计划就绪、完成、失败）[38] | 未核实 |

另有 Open Island（GPL-3.0）、Notchi、xisland、Notch Pilot、Ping Island 等，见 notch-island-tools 的「AI 编码岛」表 [17] 和 Vibe Island 自己做的对比页（自述，有立场）[39]。

（分析）这个赛道已经从「看状态」进化到「在刘海里审批、回答、看计划、跨终端跳转、推手机」，CodeIsland 免费且功能比浮屿 Windows 版的 Agent 页更全。浮屿在 Mac 上的 Agent 能力只能算「基本盘」，真正的差异在于它是一座综合效率岛顺带把 Agent 做好，而不是单功能工具；对重度 Agent 用户，单功能工具会更强。

### 五、交互惯例

| 维度 | 主流做法 | 来源 |
|---|---|---|
| 展开方式 | 悬停展开是默认（boring.notch、NotchNook、Atoll、NotchBox、Nook X）；Atoll 在关闭悬停后提供双指下滑打开、上滑收起；Alcove 主打滑动手势。抱怨最多的正是悬停误触，NotchBox、Nook X 用户都要求点击 / 长按或「只动画不抢焦点」 | [20][2][23][5][16][18] |
| 和菜单栏的关系 | 岛占据刘海两侧的菜单栏区域，展开后盖在菜单栏下方；刘海会挡菜单栏图标（NotchBox 评价），于是 TopNotch / Bartender / Hidden Bar 这类「藏刘海、管图标」的工具常被一起推荐；macOS 26 起菜单栏默认透明、可在系统设置里把任意菜单栏项移入控制中心或隐藏（Alcove FAQ 也提到可在 Tahoe 的菜单栏设置里藏它的图标） | [16][40][41][6] |
| 全屏应用 | 期望是全屏时隐藏，boring.notch 至今仍有多个未关的相关 issue / PR：全屏后才开始播放时音乐 Live Activity 仍会出现（PR #1630）、全屏 Quick Look 时刘海仍显示（#426）、外接屏全屏时留 1px 黑线（#892）、悬停后全屏的灰色菜单栏卡住（#1359）、「全屏时隐藏刘海」功能请求（#1278） | [42] |
| 多屏 | 三种策略并存：所有屏都显示 / 固定首选屏（boring.notch 旧有）、跟随活动屏（boring.notch 2.8-rc.2 新增，#1424 的诉求）；无刘海屏统一回退为顶部正中的胶囊（Vibe Island、iMore 记录的 NotchNook 在 iMac 上的表现、DynamicNotch） | [21][22][32][2] |
| 外接屏的尺寸 | 用户希望无刘海屏上的收起态更小、更像一条细线（boring.notch #969 拿 NotchNook 作对比；Alcove 也有人要「缩成细条」） | [22][7] |

### 六、浮屿 Mac 版功能对比表

图例：✓ 有；△ 部分 / 付费档才有 / 有限；✗ 没有；? 未核实。浮屿一列是**Windows 版现有功能**，能否在 Mac 上实现另见备注。竞品信息来源同上文，查询日期 2026-11-13。

| 功能 | 浮屿（Windows 现有） | NotchNook | Alcove | boring.notch | Atoll | Nook X | CodeIsland / Vibe Island |
|---|---|---|---|---|---|---|---|
| 媒体控制 + 波形 | ✓ | ✓ | ? | ✓ | ✓ | ✓ | ✗ |
| 同步歌词 | ✓ | △（Pro） | ? | ✗ | ✓（含网易云兜底） | ✓ | ✗ |
| 网易云 / QQ 音乐适配 | ?（Windows 靠 SMTC，Mac 需重做） | ? | ? | ? | △（网易云歌词） | ? | ✗ |
| 待办 / 笔记 | ✓（含每日归档） | △（Pro 待办） | ✗ | ✗ | ✗ | ✓ | ✗ |
| 日历 / 会议倒计时 | ✓（农历节假日、一键入会） | ✓ | ? | ✓ | ✓（预览） | ✗ | ✗ |
| 剪贴板历史 | ✓ | △（Pro） | ✗ | ✗ | ✓ | ✗ | ✗ |
| 文件暂存 / 中转 | ✓ | ✓ | ✗ | ✓（含 AirDrop） | ✓ | ✓ | ✗ |
| 快捷翻译（大模型） | ✓ | ✗ | ✗ | ✗ | ✗ | △（AI 对话） | ✗ |
| QQ / 微信提醒 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 多邮箱阅读回复 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 系统 HUD（音量亮度） | ✓ | ✓ | ✓ | ✓ | ✓ | ? | ✗ |
| 摄像头 / 麦克风占用提示 | ✓ | ? | ? | ? | ✓（隐私指示） | ? | ✗ |
| AI 代理状态 / 用量 | ✓ | △（Pro 审批） | ✗ | ✗ | △（用量） | ✗ | ✓ |
| 刘海里审批 / 回答 | ✓（审批） | △（Pro） | ✗ | ✗ | ✗ | ✗ | ✓（含回答、看计划） |
| 离开时推手机 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓（CodeIsland Bark 等） |
| 插件市场 / 扩展 | ✓ | ✗ | ✗ | 路线图中 | ✗ | ✗ | ✗ |
| 主题市场 | ✓ | △（液态玻璃） | ✗ | ✗ | △（布局动画可调） | ✗ | ✗ |
| Windows 版 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 中文界面 | ✓ | ? | ? | ? | ? | ✓ | ✓（CodeIsland 有中文 README） |
| 价格 | 免费开源（GPL-3.0） | ¥99–129 买断 / 订阅 | $12.99 | 免费 | 免费 | 免费 + ¥38 | 免费 / $19.99 |

### 七、值得借鉴的具体做法（分析）

1. **显示器策略三选一 + 无刘海胶囊回退**：设置里给「跟随活动屏（默认）/ 固定某块屏 / 所有屏」；检测 `NSScreen.safeAreaInsets.top`（或 `auxiliaryTopLeftArea`）判断有无刘海，无刘海时用浮屿 Windows 版现成的顶部正中胶囊形态，收起态尽量细（boring.notch #969 的诉求）。这正好复用浮屿已有的「贴顶胶囊」设计。
2. **全屏隐藏是默认值**：监听活动空间的全屏状态，全屏时整座岛隐藏，提醒到来只弹一条横幅后退场；同时覆盖 Quick Look、外接屏全屏，避免 1px 残线。
3. **媒体读取分层降级**：首选 mediaremote-adapter 式的系统「正在播放」；失败时对 Apple Music / Spotify 用 AppleScript；歌词按网易云 → QQ → 酷狗 → LRCLIB 的顺序匹配（Atoll、Lyrimuse 的做法）。所有基于私有 API 的能力都在设置里显示「当前来源」和失效提示。
4. **手势 + 点击二选一，展开不抢焦点**：沿用 Windows 版「点击（默认）/ 悬停 + 延迟」，再加触控板双指下滑打开、上滑收起（Atoll）；展开用不激活应用的面板窗口（`NSPanel` + `nonactivatingPanel`），从根上避免 Nook X 被抱怨的「切走焦点」。
5. **Agent 页对齐 Mac 社区的事实标准**：除审批外，补「在岛上回答 AskUserQuestion」「看计划 Markdown」「跳到具体终端标签 / 分屏」（Vibe Island、CodeIsland）；钩子安装时显式列出改了哪些配置文件，方便用户撤销（notch-island-tools 的安全建议）。

### 八、应避免的坑（分析）

- 悬停默认开启、经过菜单栏误展开；展开时激活应用导致输入焦点丢失。
- 接管系统音量 / 亮度键默认开启，和 BetterDisplay、Lunar 冲突。HUD 替换做成可选，默认关。
- 未签名分发：会被 Gatekeeper 拦截，且教用户「去系统设置里仍要打开」会降低信任。正式发布至少 Developer ID 签名 + 公证，Tauri updater 的 macOS 产物也要签名。
- 只适配 Apple 芯片或只适配某个 macOS 版本：NotchNook Pro 仅 Apple 芯片、Claude Island 要 15.6+，这些都会被用户拿来比较。建议最低 macOS 14（boring.notch、Atoll、CodeIsland、Nook X 的共同下限）。
- 更新后耗电 / CPU 回归：NotchNook、boring.notch 都出过。Mac 版发布流程里要有空闲 CPU 与能耗的回归测量（Windows 版已有 `docs/investigations/idle-usage.md` 的做法可沿用）。
- 把 QQ / 微信提醒承诺成和 Windows 一样：macOS 没有公开 API，最多做到角标级别，文案和设置里要讲清楚。

### 九、需要用户拍板的问题

1. Mac 版是否收费？竞品里商业产品普遍 $13–25 买断 + 短试用；浮屿是 GPL-3.0，收费的可行形式（捐赠 / 赞助 / 付费分发渠道）需要你决定。
2. 是否购买 Apple Developer Program（$99/年）做签名与公证？正式对外发布基本绕不开。
3. 是否接受依赖私有 API（MediaRemote 借道、辅助功能读 Dock 角标）？接受就意味着不上 App Store、每次 macOS 大版本都要回归。
4. Mac 版首发范围：建议先做「待办 / 日历 / 剪贴板 / 文件中转 / Agent / 翻译 / 媒体」，QQ / 微信提醒先做技术验证再决定是否承诺。
5. 最低系统版本与芯片：建议 macOS 14+、同时支持 Intel 与 Apple 芯片（通用二进制），是否认可。

## 补充（2026-11-13）：开源刘海岛的媒体控制与亮度是怎么做的

> 问题：用户问「其他开源 Mac 灵动岛是怎么做（媒体控制）的」。起因：G1.9 在本机试 `media-remote` crate 的 Perl 适配器时，被开发环境的权限检查拦下。范围：GitHub 上 boring.notch、Atoll、MewNotch、DynamicNotch、NotchDrop 的源码（REST API 读文件、代码搜索 `MediaRemote` / `DisplayServices` / `tell application`），mediaremote-adapter 的 README。相关任务：G1.9。

### 结论

1. **四个活跃的开源刘海岛全都用 mediaremote-adapter，没有别的路。** boring.notch（11,350 star）、Atoll（5,256）、MewNotch（556）、DynamicNotch（654）的仓库里都带着 `mediaremote-adapter.pl` 和 `MediaRemoteAdapter.framework`；NotchDrop 没有媒体功能。数字为 2026-11-13 查询。[S1][S2][S3][S4]
2. **适配器是随应用一起打包、签名的，不是运行时从别处解压。** boring.notch 把框架放在 `.app` 的 `Contents/Frameworks`（`Bundle.main.privateFrameworksPath`），脚本放在 `Resources`，运行 `/usr/bin/perl <脚本> <框架路径> stream` 读一行一个 JSON 的正在播放流 [S5]；adapter 的 README 也要求框架「随应用打包、但不要链接」[S6]。`media-remote` crate 的做法是把一个预编译的 tar.gz 编进二进制、运行时解压到临时目录（见本地 `~/.cargo/registry/src/*/media-remote-0.5.2/src/high_level/now_playing_perl.rs`），这不随浮屿一起签名公证，不建议照搬。
3. **只有「读」需要借道 perl，「控制」不需要。** boring.notch 在自己进程里 `dlopen` 私有的 `MediaRemote.framework`，直接调 `MRMediaRemoteSendCommand`（播放、暂停、上下首）、`MRMediaRemoteSetElapsedTime`（拖进度）、`MRMediaRemoteSetShuffleMode` / `SetRepeatMode` [S5]；DynamicNotch 先直接发命令，失败时再经 perl 的 `send` 命令兜底 [S7]。
4. **都有探测与兜底。** boring.notch 启动时跑 adapter 的 `test` 命令（10 秒超时）判断这台系统上能不能用，不能用时退回只支持 Apple Music、Spotify 的 AppleScript 控制器（`tell application "Spotify"`，再用 `DistributedNotificationCenter` 听曲目变化）[S5][S8]。
5. **adapter 在 macOS 27 上实测可用。** README 徽章写着在 macOS 27.0（26A5425a）上测过，最后一次测试 2026-09-04；作者在开头呼吁 Apple 别封、给第三方开个正式的权利 [S6]。仍是借道，随时可能失效。
6. **亮度同样全靠私有接口，不要权限。** 内建屏：boring.notch、Atoll 都 `dlopen` `DisplayServices.framework`，用 `DisplayServicesGetBrightness` / `DisplayServicesSetBrightness`，再退回公开但已废弃的 `IODisplayGet/SetFloatParameter` [S9][S10]；键盘背光用 `CoreBrightness` 里的 `KeyboardBrightnessClient` [S9]。外接屏的 DDC 它们都没做（boring.notch 在 issue 里让用户配合 BetterDisplay / Lunar，见上文「坑」一节），MonitorControl 才做。
7. **没有人用 AppleScript 做主路径**：它只认识少数几个播放器、拿不到封面、要「自动化」授权。

### 对浮屿的建议

- 按上面这套做，和同类一致：`MediaRemoteAdapter.framework`（BSD-3-Clause）和脚本随 `Fuyu.app` 打包进 `Contents/Frameworks`、`Contents/Resources`，跟 `.app` 一起签名公证；Rust 端起一个常驻的 `/usr/bin/perl … stream --no-diff`（或带封面的 `stream`）读 JSON 行，转成现有的媒体状态；播放控制在岛自己进程里 `dlopen` MediaRemote 发命令，失败时用 perl 的 `send`；启动时跑一次 `test`，失败就整块隐藏并在设置里说明，Apple Music / Spotify 用 AppleScript 兜底（按 M7 可关、可降级）。
- 不用 `media-remote` crate 的运行时解压方案；可以参考它的 JSON 解析和进程管理。
- 亮度：内建屏走 DisplayServices（`dlopen`，失败退回 IODisplay），外接屏先不做。
- 开发环境：用 perl 加载 adapter 的这一步在 Claude Code 的自动模式里被权限检查拦下（判为越权访问）。要在本机验证，需要用户放行这一类命令，或自己在终端跑 adapter 的 `test` / `get` 看能否读到正在播放。

### 来源

- [S1] boring.notch：<https://github.com/TheBoredTeam/boring.notch>（`mediaremote-adapter/`、`boringNotch/MediaControllers/NowPlayingController.swift`）
- [S2] Atoll：<https://github.com/Ebullioscopic/Atoll>（`mediaremote-adapter/`、`Frameworks/MediaRemoteAdapter.framework`）
- [S3] MewNotch：<https://github.com/monuk7735/mew-notch>（`MewNotch/Resources/Libs/mediaremote-adapter.pl`）
- [S4] DynamicNotch：<https://github.com/jackson-storm/DynamicNotch>（`DynamicNotch/Resources/MediaRemoteAdapter/`）
- [S5] boring.notch `NowPlayingController.swift`：<https://github.com/TheBoredTeam/boring.notch/blob/main/boringNotch/MediaControllers/NowPlayingController.swift>
- [S6] mediaremote-adapter README（BSD-3-Clause，308 star，`pushed_at` 2026-11-11）：<https://github.com/ungive/mediaremote-adapter>
- [S7] DynamicNotch `MediaRemoteCommandDispatcher.swift`：<https://github.com/jackson-storm/DynamicNotch/blob/main/DynamicNotch/Features/NowPlaying/Services/MediaRemoteCommandDispatcher.swift>
- [S8] boring.notch `MediaChecker.swift`、`SpotifyController.swift`：<https://github.com/TheBoredTeam/boring.notch/tree/main/boringNotch>
- [S9] boring.notch `BoringNotchXPCHelper.swift`：<https://github.com/TheBoredTeam/boring.notch/blob/main/BoringNotchXPCHelper/BoringNotchXPCHelper.swift>
- [S10] Atoll `DisplayServicesDynamic.swift`：<https://github.com/Ebullioscopic/Atoll/blob/main/DynamicIsland/helpers/DisplayServicesDynamic.swift>

## 来源

查询日期均为 2026-11-13，除非另注。

1. [NotchNook 官网（lo.cafe）](https://lo.cafe/notchnook)
2. [iMore：This $25 app gives my MacBook Pro a Dynamic Island（2024-07-23）](https://www.imore.com/apps/mac-apps/this-dollar25-app-gives-my-macbook-pro-a-dynamic-island-and-it-was-worth-every-penny)
3. [Setapp：NotchNook 评价](https://setapp.com/apps/notchnook/customer-reviews)
4. [MacRumors 论坛：NotchNook](https://forums.macrumors.com/threads/notchnook.2463695/)
5. [Alcove 官网](https://tryalcove.com)
6. [Alcove FAQ](https://tryalcove.com/faqs)
7. [AlternativeTo：Alcove](https://alternativeto.net/software/alcove/about)；[r/macapps：Alcove question（镜像）](https://axebps-redlib.hf.space/r/macapps/comments/1jhktyp/alcove_question)
8. [DynamicLake 官网](https://dynamiclake.com)
9. [TheSweetBits：DynamicLake Pro 评测](https://thesweetbits.com/tools/dynamiclake-review/)；[Gumroad：DynamicLake](https://avirok1.gumroad.com/l/nyyfw)
10. [DynamicNotch 官网](https://dynamicnotch.pages.dev/)；[GitHub：jackson-storm/DynamicNotch](https://github.com/jackson-storm/dynamicnotch)；[Gumroad：Dynamic Notch（同名另一产品）](https://notchdynamic.gumroad.com/l/dynamicnotch)
11. [Gumroad：MediaMate](https://wouter01.gumroad.com/l/mediamate)；[AlternativeTo：MediaMate](https://alternativeto.net/software/mediamate/about)
12. [Desktop Insights：MediaMate](https://desktopinsights.com/apps/mediamate)
13. [r/macapps：Does anyone know when MediaMate will be updated（镜像）](https://axebps-redlib.hf.space/r/macapps/comments/1jzsr8m/does_anyone_know_when_mediamate_will_be)
14. [Mac App Store：Notchmeister](https://apps.apple.com/us/app/notchmeister/id1599169747?mt=12)
15. [TopNotch 官网](https://topnotch.app)；[KnowTechie（2021）](https://knowtechie.com/this-simple-macos-app-makes-the-notch-on-the-new-macbook-pro-disappear)
16. [Mac App Store：NotchBox](https://apps.apple.com/au/app/id6737410946)
17. [GitHub：ChenSiWu/notch-island-tools（页面更新于 2026-11-09）](https://github.com/ChenSiWu/notch-island-tools)
18. [国区 Mac App Store：Nook X - 效率岛](https://apps.apple.com/cn/app/id6733240772)
19. [ChatNotch 官网](https://chatnotch.com/)
20. [GitHub：TheBoredTeam/boring.notch](https://github.com/TheBoredTeam/boring.notch)；[仓库 API](https://api.github.com/repos/TheBoredTeam/boring.notch)
21. [boring.notch releases（API）](https://api.github.com/repos/TheBoredTeam/boring.notch/releases?per_page=3)
22. [boring.notch issue 搜索：external display](https://github.com/TheBoredTeam/boring.notch/issues?q=%22external+display%22)（#943、#880、#969、#1424、#1718、#1734）
23. [GitHub：Ebullioscopic/Atoll](https://github.com/Ebullioscopic/Atoll)；[仓库 API](https://api.github.com/repos/Ebullioscopic/Atoll)
24. [Atoll releases（API）](https://api.github.com/repos/Ebullioscopic/Atoll/releases?per_page=3)
25. [GitHub：ungive/mediaremote-adapter](https://github.com/ungive/mediaremote-adapter)
26. [Keyboard Maestro 论坛：Beware upgrading to macOS 15.4 if you need “now playing” data](https://forum.keyboardmaestro.com/t/beware-upgrading-to-macos-15-4-if-you-need-now-playing-data/40285)；[BetterTouchTool 社区：Now playing / Spotify issues](https://community.folivora.ai/t/now-playing-spotify-issues/43610)
27. [Apple Developer Forums：Seeking guidance on intercepting system-wide notifications in macOS app](https://developer.apple.com/forums/thread/758451)
28. [GitHub：TheInitialDream1/SuperIsland（macOS 灵动岛中文增强版）](https://github.com/TheInitialDream1/SuperIsland)
29. [Product Hunt：Lyrimuse](https://www.producthunt.com/products/lyrimuse)
30. [SourceForge：LyricsX](https://sourceforge.net/app/lyricsx/mac/)
31. [GitHub：wxtsky/CodeIsland](https://github.com/wxtsky/CodeIsland)
32. [Vibe Island 官网](https://vibeisland.app/)
33. [CodeIsland 仓库 API](https://api.github.com/repos/wxtsky/CodeIsland)
34. [GitHub：farouqaldori/claude-island](https://github.com/farouqaldori/claude-island)
35. [Claude Island 仓库 API](https://api.github.com/repos/farouqaldori/claude-island)
36. [GitHub：MioMioOS](https://github.com/MioMioOS)；[SourcePulse：MioIsland](https://www.sourcepulse.org/projects/27991906)
37. [GitHub：shirenchuang/agentbro 仓库 API](https://api.github.com/repos/shirenchuang/agentbro)；[agentbro 官网](https://www.agentbro.net/)
38. [CodexBar v0.42.0 发布记录](https://newreleases.io/project/github/steipete/CodexBar/release/v0.42.0)；[GitHub：Magir/clabar](https://github.com/Magir/clabar)
39. [Vibe Island：AI Agent Notch Apps for macOS — Compared](https://vibeisland.app/alternatives/)
40. [V2EX：推荐一个 mac 软件 whisperkeyboard（2025-01，评论区把 DynamicLakePro、NotchNook、boring.notch 当作同类推荐）](https://www.v2ex.com/t/1105795)；TopNotch / Bartender / Hidden Bar 常被一起推荐来自 V2EX 搜索结果摘要，具体帖子未逐一核实
41. [Apple Newsroom：macOS Tahoe 26](https://www.apple.com/newsroom/2025/06/macos-tahoe-26-makes-the-mac-more-capable-productive-and-intelligent-than-ever/)
42. [boring.notch issue 搜索：fullscreen](https://github.com/TheBoredTeam/boring.notch/issues?q=fullscreen)（#1630、#1278、#426、#1359、#892）
