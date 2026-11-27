# 同类产品全景与浮屿的位置

> 日期：2026-11-27（价格、star 数、版本号都是这天查的）。问题：用户让「全网调研同类产品、开源项目」，给浮屿下一阶段的功能扩展和完善定方向。范围：分四路查——① Mac 刘海岛与 Windows 灵动岛（商业 + 开源，近半年新功能、定价、用户评价）；② AI 编码代理的桌面伴侣、编排工具、手机远程；③ 启动器与效率工具箱（uTools、Quicker、Raycast、PowerToys 等）及插件生态冷启动；④ 桌面 AI 助手和 Windows / macOS 2026 年新系统能力。来源是官网、GitHub releases、更新日志、Hacker News、Product Hunt、少数派、V2EX、linux.do；Reddit 拒绝抓取，凡只从 Reddit 搜索摘要得来的写「未核实」。相关计划：[roadmap-plan.md](../architecture/roadmap-plan.md)。
>
> 之前的清单式调研不重复：开源灵动岛名单见 [dynamic-island-desktop-projects.md](dynamic-island-desktop-projects.md)，Mac 刘海应用格局见 [macos-notch-apps.md](macos-notch-apps.md)，eIsland 见 [eisland.md](eisland.md)，剪贴板见 [clipboard-apps.md](clipboard-apps.md)，截图见 [screenshot-tools.md](screenshot-tools.md)，各家代理接入见 [agent-harnesses.md](agent-harnesses.md)。

## 结论

1. **品类在两头被挤压。**
   - **系统在吃基础层**：苹果 10 月 28 日给 OLED MacBook Pro 做了真灵动岛，macOS 27.3 让所有 Mac 的菜单栏显示实时活动（Live Activities），第三方应用也能接 [1][2]。Windows 11 的任务栏开放给第三方代理（MCP 接入、`Windows.UI.Shell.Tasks` 显示长任务进度，实验性）[18][28]。
   - **官方产品在吃 Agent 的「看状态」层**：Claude Code 有 Remote Control、Agent View；Codex app 有 Windows 版；GitHub 手机端用实时活动显示 Copilot CLI 进度 [21][22][23]。
   - 第三方岛要活，只能做**系统和官方不做的那一层：跨平台、跨多家、中立、能直接操作**。
2. **浮屿最大的护城河是「Windows + Mac 都有、免费开源、中文优先、功能面最宽」。**
   - AI 代理刘海岛 2026 年冒出 13 款以上，几乎全是 Mac 独占、核心功能收费（Vibe Island 买断 19.99 美元，多会话和审批要付费）[20][24]。
   - Windows 侧刚有收费产品进场：NotchNook 11 月出了 Windows 版（9.9 美元，能在岛里回 WhatsApp、审批 Claude Code）[6]，还有 NotchPixel、Notchify [13]。**这是浮屿第一次在 Windows 上遇到成规模的商业对手**，要抢在它们口碑起来前把体验差距拉开。
3. **AI 代理伴侣：竞品比的是「能在岛上做完多少事」，不是「能看到多少家」。** 浮屿已接 17 家、有审批、提问作答、用量、SSH、手机推送，在广度上领先；缺的是深度：**计划审阅、审批卡里的 diff 摘要、按状态分组 + 「下一个等你的会话」快捷键、花费和预算告警、跑完提示开 PR / 看 CI**。用户最大的痛点已经从「写」变成「审」：一份约 3000 人的调查显示开发者每周审 AI 代码 11.4 小时，多于写新代码的 9.8 小时 [25]。
4. **AI 入口：2026 年标配是「全局快捷键 + 置顶小窗」，浮屿天生就是这个形态，却还没有通用 AI 入口。**
   - ChatGPT、Claude、Gemini 桌面版都是快捷键唤出、置顶 [26][27]。豆包有划词工具栏和截图提问 [29]。
   - 浮屿已有零件：翻译接了 7 家模型并支持本机 Ollama、划词翻译、截图 OCR、剪贴板 AI 改写、离线语音。**把零件串成「岛上快问」和「划词 / 截图问 AI」成本低、收益高。**
   - 用户反感很明确：Recall 被迫改成默认关闭，微软 4 月从记事本、截图工具撤掉 Copilot 按钮 [30][31]。所以浮屿的 AI **一律默认关、不常驻扫屏、标清本地还是云端**。
5. **MCP 是 2026 年的入场门槛。** Raycast 2.13 内置 MCP 服务让外部 Agent 调用它 [7]；uTools、ZTools 2.3 都接了 MCP [8][9]。浮屿的插件后台本来就是 Node 进程，**把岛（待办、通知、审批、插件命令）暴露成 MCP 工具，同时也是给 Agent 功能加一条比 hooks 更通用的接入路**。
6. **开放的「实时活动」接口没有行业标准，浮屿可以抢先定一个。** 各家都是自建本机接口：Atoll 的 RPC、WinLand 的 `winisland://notify`、Notchwork 的 `/v1/activity`（带按钮）[16][19]。浮屿的 `POST /v1/notify` 只能一次性弹出，不能按 id 更新进度、没有按钮回调。
7. **插件生态起量靠「样板 + 低门槛格式」，不靠钱。**
   - Raycast 把内置功能改写成开源扩展当样板，公测约 6 周就有 100 多个扩展 [10]。Quicker 的「动作」是配置不是代码，用户分享门槛低，量就是这样堆起来的。没查到哪家给开发者公开分成（未核实）。
   - uTools v7 起免费用户最多装 10 个插件，挨骂很多 [11]。**浮屿永远不限插件数量**，并补一种比完整插件低得多的「动作」格式。
8. **商业模式：行业通行是买断 10–20 美元 + 跨端捆绑**（NotchNook 买 Mac 送 Windows，Droppy 买 Mac 送 iPhone）[3][6][12]。要避开的坑是授权服务器挂掉引发差评潮（NotchNook 9 月因创始人纠纷授权失效 [4]）和 GPL 项目之间的 DMCA（Droppy 被 Atoll 作者告下架 [15]）。**浮屿建议走「开源免费 + 自愿支持 + 增值服务」，不锁功能**（与 D114「支持」页一致）。

## 详细

### 一、灵动岛 / 刘海岛

**近半年的新东西**

| 产品 | 平台 / 模式 | 新功能（2026 下半年） |
|---|---|---|
| 苹果系统灵动岛 | Mac（OLED MacBook Pro） | 来电、音乐、AirDrop；macOS 27.3 菜单栏实时活动，第三方可接 [1][2] |
| NotchNook | Mac 买断 19 美元或 3 美元/月；Windows 9.9 美元 | Windows 版：岛内回 WhatsApp、审批 Claude Code / Codex、Wi‑Fi 蓝牙开关、每块屏一个岛 [3][6] |
| boring.notch 2.8-rc | Mac，开源，约 1.15 万 star | 用辅助功能镜像任意应用的通知横幅（按应用过滤、排队）；会议一键入会、周视图；实时波形、切换音频输出；稳定 / Beta / Nightly 三通道 [5] |
| Atoll 2.3.3 beta | Mac，开源，约 5400 star | 分应用调音量、防休眠；歌词钉在刘海下（网易云兜底）；LLM 用量面板含 New API 中转站余额；扩展市场已上线但还没有扩展 [14] |
| Droppy 16 | Mac，闭源买断 9.08 欧元 | 扩展 SDK DroppyKit；免费 iPhone 伴侣：端到端加密同步剪贴板、文件、笔记，手机锁屏显示状态 [12] |
| FluentFlyout 2.16 | Windows，开源 | 下载 50 万，已适配任务栏移到上 / 左 / 右边和小任务栏 [17] |
| Flylet（ModernFlyouts 续作） | Windows，开源 | 音量混合器 [32] |
| WinLand 1.2 | Windows，开源 | 插件中心、`winisland://notify` 推送 [16] |
| eIsland | Windows，开源 | 11 月从 Electron 迁到 Tauri，与浮屿同栈 |

**用户常夸**：动效像原生；一个应用顶替多个小工具；免费开源。**常骂**：授权失效、开发者失联；耗电；鼠标一过就展开并抢焦点；没签名要手动放行；免费改收费（Notchy、Crest、Droppy）[12][33]（r/macapps 部分未核实）。

**已成标配**：媒体 + 歌词、文件架、音量亮度提示、日历入会、剪贴板、AI 代理状态与审批。浮屿全有。

**差异化方向**：镜像任意应用通知 / 岛内回复聊天、手机伴侣、扩展 SDK、分应用音量与输出切换、跨平台。

### 二、AI 编码代理伴侣

| 类别 | 代表 | 现状 |
|---|---|---|
| 刘海审批岛 | Vibe Island（26 家代理，3 家能岛上作答，买断 19.99 美元）、Vibe Notch、CodeIsland、Notchi、AgentPeek、Crest、NotchPilot | 几乎全 Mac；比的是作答家数、计划审阅、额度、SSH、跳回终端 [20][24] |
| Windows 叠加层 | coucou、Glint（Tauri）、Agent Island | 小项目，未成气候 [34] |
| 官方 | Claude Code Remote Control / Agent View（工作中 / 需要输入 / 待审阅 / 完成分组）、Codex app（Windows 版 3/4，Automations 定时任务）、GitHub 手机实时活动、Cursor iOS beta | 吃掉「发通知」层 [21][22][23] |
| 多代理编排 | Conductor（Mac 免费）、cmux（GPL，未读提示圈）、Nimbalyst（原 Crystal，iOS 推送）、Paradev（原 Superset）；Vibe Kanban 母公司 4 月关停 | 洗牌中 [35][36] |
| 手机远程 | Happy（E2E，开源）、Paseo（语音、本机识别，AGPL）、Omnara（转向托管） | 手机能看 diff、审批、审计划已是标配 [37] |
| 用量 | ccusage、claude-hud、QuotaView | 按 5 小时窗口算钱、上下文占用 [38] |

**用户声音**（HN、Product Hunt、linux.do）：批之前要看全，命令不能截断，不能超时自动允许；装钩子不能搞坏原配置，卸载只删自己的；远程和 devcontainer 里的会话要认得出；不只看还要能回；别抢全局快捷键（Vibe Island 默认快捷键盖掉了 shell 清行键）；担心「权限疲劳」[39]。

**浮屿已做到、竞品普遍没有的**：Windows 支持、17 家接入、SSH 远程、cc-connect 聊天里继续指挥、钩子安装与卸载清理（B73）。

### 三、启动器与效率工具箱

| 产品 | 2026 动向 | 商业化 |
|---|---|---|
| Raycast | Windows 2.0 正式版；2.13 内置 MCP 服务；扩展可自带模型；口述给 AI；AI Chat 与 Inline Replace 上 Windows [7] | 免费版无 AI；Pro 10 美元/月起 |
| uTools | 自然语言生成应用；MCP 让 Agent 调用插件；官网称 5618+ 插件、500 万+ 用户 [8] | 会员 + 插件内购；v7 免费用户限 10 个插件，挨骂 [11] |
| ZTools / Rubick | 兼容 uTools 接口；ZTools 2.3 加 MCP 和 WebDAV 插件同步 [9] | 开源，生态单薄 |
| Quicker | 动作库、鼠标手势、超级面板 | 专业版 96 元/年 |
| PowerToys | Command Palette 扩展库（0.100）、Advanced Paste 接 Ollama / Foundry Local / Phi Silica [40] | 免费 |
| Listary V7 | 接 AI 和 Gety 语义搜索 | 买断 |

**中文用户的空位**：uTools 收费反复、Electron 臃肿；Raycast 无中文、拼音弱；开源平替插件少。「轻量 + 中文优先 + 不限插件数」没人占 [11][41]。

**浮屿已有对应零件**：`@fuyu/launcher`（拼音启动应用）、`@fuyu/file-search`、剪贴板常用短语与 `Ctrl+K` 动作面板（含 AI 改写、插件动作）、划词翻译。缺的是把它们**合成一个入口**。

**插件市场冷启动**：Raycast 内测先拉小群开发者、官方开源内置扩展当样板、强制 MIT + 单仓 PR + 审核、每月精选，公测约 6 周 100+ 扩展 [10]；Alfred Gallery 从社区现有作品里挑，提前开放时约 100 个 [42]；Quicker 靠「动作是配置」。

### 四、桌面 AI 与系统能力

| 形态 / 能力 | 情况 | 对浮屿 |
|---|---|---|
| 快捷键 + 置顶小窗（ChatGPT ⌥Space、Claude 双击 ⌥、Gemini Alt+Space） | 标配 [26][27] | 浮屿本来就常驻，做「岛上快问」最顺 |
| 划词 / 截图提问（豆包、Kimi 原型） | 高频轻交互 [29] | 已有划词翻译和 OCR，扩成动作条 |
| 代理干活（ChatGPT 并入 Codex、Claude Cowork、豆包虚拟桌面） | 主战场 | 不正面做，做它们的「仪表盘」 |
| Windows 任务栏 Agent（MCP + `Windows.UI.Shell.Tasks`） | 实验性，需打包身份 [18][28] | 与 Agent 页重叠；可选对接，主打跨平台 |
| macOS 27 Foundation Models | 只有 Swift 接口，端上上下文约 4096 token（另有说 8192，未核实），浮屿最低 macOS 15 要降级 [43] | 中低优先 |
| 本地小模型 | Qwen3.5 4B 量化约 2.5 GB；Phi Silica 只在 Copilot+ PC [44] | 检测用户自装的 Ollama / LM Studio，不随包分发 |
| iPhone 实时活动上 Mac 菜单栏 | 系统闭环，第三方读不到（未核实） | 做不了 |
| Windows Widgets 第三方组件 | 很少 | 价值低 |

## 浮屿的缺口汇总（按价值）

已在仓库核对过：`agent-status/approvals` 有审批卡和提问卡，没有计划审阅和 diff；`local_api` 只有一次性的 `/v1/notify`；`phone_push` 是推送，没有手机端应用；岛显示在一块屏（可跟随）；`toast_notifications` 已用 UserNotificationListener，任意应用通知上岛是待做的 [C57](/docs/tasks/C/C57.md)。

| 缺口 | 谁有 | 价值 | 难度 |
|---|---|---|---|
| 计划审阅（岛上渲染计划，批准或写反馈） | Vibe Island、Nimbalyst | 高 | 中 |
| 审批卡里的 diff 摘要 / ±行数 | Vibe Island、Crest、CodeIsland | 高 | 中 |
| 按状态分组 + 「下一个等你」快捷键；正在看的会话不提醒 | Claude Agent View、cmux、CodeIsland | 高 | 低 |
| 浮屿 MCP 服务（Agent 推通知、加待办、请求确认；插件命令变工具） | Raycast、uTools、ZTools | 高 | 中 |
| 实时活动接口 v2（按 id 更新、进度、按钮回调） | Notchwork、ActivityKit、Windows Tasks | 高 | 中 |
| 岛上快问 + 划词 / 截图问 AI（复用翻译的模型配置，默认关） | ChatGPT、Claude、豆包、Raycast | 高 | 低～中 |
| 统一搜索入口（应用、文件、插件命令、剪贴板、计算） | 所有启动器 | 高 | 中 |
| 任意应用通知上岛（C57） | boring.notch、NotchNook | 高 | 中 |
| 适配任务栏移到上 / 左 / 右和小任务栏 | FluentFlyout | 高（Windows） | 中 |
| 低门槛「动作」格式 | Quicker、Alfred | 高（生态） | 中 |
| 花费估算与预算告警；中转站（New API、OpenRouter）余额 | ccusage、Atoll | 中 | 低～中 |
| 跑完提示开 PR / 看 CI | Conductor、Claude 桌面版 | 中 | 中 |
| 手机伴侣（先 PWA，看状态、审批、传剪贴板） | Droppy、Happy、CodeIsland | 中高 | 高 |
| 分应用音量与输出设备切换 | Atoll、Flylet、boring.notch | 中 | 中 |
| 每块屏一个岛 | NotchNook Windows | 中 | 中高 |
| 文件架里转格式、压缩 | NotchNook、Droppy | 中 | 低 |
| 会议纪要（离线识别 + 大模型） | 豆包、各家会议工具 | 中 | 高 |
| 防休眠、Wi‑Fi / 蓝牙开关 | Atoll、NotchNook | 低 | 低（适合插件） |

**不做**：常驻扫屏 / 屏幕感知 / 长期记忆（隐私争议，见 Recall）；窗口管理（系统自带够用）；Widgets 面板组件；转发 iPhone 实时活动（系统私有）；锁功能收费、限插件数。

## 来源

1. [MacRumors：苹果把灵动岛带到 Mac（2026-10-28）](https://macrumors.com/2026/10/28/apple-brings-dynamic-island-to-mac/)
2. [MacRumors：macOS 27.3 菜单栏实时活动（2026-11-04）](https://www.macrumors.com/2026/11/04/macos-27-3-live-activities-in-menu-bar/)
3. [NotchNook 官网与价格](https://lo.cafe/notchnook)
4. [What happened to NotchNook](https://lo.cafe/journal/what-happened-to-notchnook/)
5. [boring.notch v2.8-rc.0](https://github.com/TheBoredTeam/boring.notch/releases/tag/v2.8-rc.0)
6. [NotchNook for Windows](https://lo.cafe/notchnook/windows/)
7. [Raycast Windows 2.13（MCP）](https://www.raycast.com/changelog/windows/2-13)、[Windows 2.0](https://www.raycast.com/changelog/windows/2-0)、[价格](https://www.raycast.com/pricing)
8. [uTools 官网](https://www.u-tools.cn/index.html)
9. [ZTools README](https://raw.githubusercontent.com/ZToolsCenter/ZTools/main/README.md)、[ZTools v2.3.0](https://newreleases.io/project/github/ZToolsCenter/ZTools/release/v2.3.0)
10. [Raycast A 轮公告（100+ 扩展）](https://raycast.com/blog/series-a)、[扩展机制](https://www.raycast.com/blog/how-raycast-api-extensions-work)
11. [V2EX：uTools 限 10 个插件](https://v2ex.com/t/1129804)、[什么值得买](https://post.smzdm.com/p/apqxo3x9/)
12. [Droppy 官网](https://getdroppy.app)
13. [NotchPixel 指南（竞品方）](https://notchpixel.com/guides/mac-notch-apps-on-windows)
14. [Atoll releases](https://github.com/Ebullioscopic/Atoll/releases)
15. [GitHub DMCA：Atoll 对 Droppy（2026-02-10）](https://github.com/github/dmca/blob/master/2026/02/2026-02-10-atoll.md)
16. [WinLand releases](https://github.com/luolangaga/WinLand/releases)
17. [FluentFlyout releases](https://github.com/unchihugo/FluentFlyout/releases)、[任务栏可移到三边](https://pureinfotech.com/windows-11-taskbar-move-top-left-right-bottom/)
18. [Windows Latest：任务栏 AI 代理（2026-04-18）](https://www.windowslatest.com/2026/04/18/microsoft-confirms-ai-agents-are-still-coming-to-the-windows-11-taskbar-as-it-prepares-for-public-rollout/)
19. [Notchwork](https://github.com/jesseglab/notchwork)
20. [Vibe Island 官网](https://vibeisland.app)、[评测（2026-08-29）](https://vibecoding.app/blog/vibe-island-review)
21. [Claude Code Remote Control](https://code.claude.com/docs/en/remote-control)、[桌面版重设计](https://claude.com/blog/claude-code-desktop-redesign)、[Agent View](https://rits.shanghai.nyu.edu/ai/anthropic-ships-agent-view-a-multi-session-dashboard-for-claude-code/)
22. [Codex app](https://developers.openai.com/codex/app)
23. [GitHub Agent HQ](https://github.blog/news-insights/company-news/welcome-home-agents/)、[Copilot CLI 实时通知（2026-07-08）](https://github.blog/changelog/2026-07-08-github-mobile-live-notifications-for-copilot-cli-sessions)
24. [刘海审批类应用横评（FavTray，2026-11-23）](https://favtray.com/blog/approve-claude-code-from-notch)
25. [HackerNoon：审阅瓶颈](https://hackernoon.com/ai-is-writing-more-codeand-creating-a-review-bottleneck)、[Bain 报告](https://www.ciodive.com/news/bain-co-technology-AI-coding-deployment/831938/)
26. [ChatGPT 桌面版发布说明](https://help.openai.com/en/articles/9703738-desktop-app-release-notes)、[Claude 桌面应用导览](https://claude.com/resources/tutorials/navigating-the-claude-desktop-app)
27. [Gemini Mac 版](https://blog.google/innovation-and-ai/products/gemini-app/gemini-app-now-on-mac-os/)、[Gemini Windows 版](https://www.techspot.com/news/113826-google-finally-launches-gemini-desktop-app-windows-10.html)
28. [Microsoft Learn：Windows.UI.Shell.Tasks](https://learn.microsoft.com/windows/apps/api-reference/compliance/windows-ui-shell-tasks)
29. [豆包电脑版 2026-08 更新](https://finance.sina.cn/2026-08-21/detail-inipaens1380641.d.html)、[Kimi 划词工具栏原型](https://runtimewire.com/zh/article/kimi-selection-toolbar-highlighted-text-desktop)
30. [PC Gamer：Recall 改为手动开启](https://www.pcgamer.com/software/windows/microsoft-changes-course-on-the-controversial-windows-11-feature-that-constantly-takes-screenshots-of-your-pcs-screen-now-youll-have-to-opt-in-if-you-want-to-use-it)
31. [SlashGear：Copilot 收缩](https://www.slashgear.com/2147512/microsoft-removing-copilot-ai-windows/)、[Windows Central：信任问题](https://www.windowscentral.com/microsoft/windows-11/user-reactions-show-microsofts-ai-problem-on-windows-11-isnt-technical-its-trust)
32. [Flylet releases](https://github.com/ItsMrZxD/Flylet/releases)
33. [FavTray：Mac 刘海应用（竞品方）](https://favtray.com/blog/dynamic-island-for-mac-notch-apps)；r/macapps「Droppy 16」「Making Sense of macOS Notch Apps」只拿到搜索摘要（未核实）
34. [Glint](https://github.com/anasm266/glint)、[Agent Island](https://github.com/tristan666666/agent-island/wiki)
35. [9 款编排工具对比（2026-07）](https://dev.to/agentiknet/9-coding-agent-orchestrators-honestly-compared-dated-sourced-and-one-of-them-is-mine-3kpk)
36. [cmux vs Conductor](https://cmux.com/compare/cmux-vs-conductor)、[Paradev vs Conductor](https://paradev.com/compare/superset-vs-conductor)、[Nimbalyst 定价](https://nimbalyst.com/pricing/)
37. [Happy](https://github.com/slopus/happy)、[Paseo](https://raw.githubusercontent.com/getpaseo/paseo/main/README.md)
38. [claude-hud](https://github.com/jarrodwatts/claude-hud)
39. HN：[nah 权限守卫](https://news.ycombinator.com/item?id=47343927)、[手机审批](https://news.ycombinator.com/item?id=47111171)、[权限疲劳小游戏](https://news.ycombinator.com/item?id=48308376)；[linux.do Clawd on Desk](https://linux.do/t/1896904)
40. [PowerToys 0.96 Advanced Paste](https://devblogs.microsoft.com/commandline/powertoys-0-96-is-here-endpoints-for-advanced-paste-metadata-support-for-powerrename-and-more)、[0.100 扩展库](https://devblogs.microsoft.com/commandline/powertoys-0-100-is-here-new-shortcut-guide-command-palette-improvements-and-much-more/)
41. [少数派：中文用户的启动器需求](https://sspai.com/post/95005)
42. [Alfred Gallery 提前开放](https://www.alfredapp.com/blog/releases/alfred-gallery-now-in-early-access/)
43. [WWDC26 macOS 指南](https://developer.apple.com/wwdc26/guides/macos/)、[TN3193 端上模型上下文](https://developer.apple.com/tutorials/data/documentation/technotes/tn3193-managing-the-on-device-foundation-model-s-context-window.md)
44. [纯 CPU 本地模型（PopularAI）](https://www.popularai.org/p/best-cpu-only-local-llm-2026)、[Raycast 本地模型](https://manual.raycast.com/ai/local-models)
