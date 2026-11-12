# 新手引导：参考与改版方案

> 日期：2026-11-11。问题：用户觉得第一版新手引导（C47，四步表单）「太普通」，要求发挥想象力，全网搜索参考后整理出新方案。范围：WebSearch / WebFetch 搜了 Linear、Superhuman、Raycast、Arc、Warp、PowerToys、Duolingo、macOS 刘海岛工具（NotchNook、Boring Notch、Alcove）、Windows 上的同类岛（DynamicWin、WinIsland 等）、游戏教学关卡（超级马里奥 1-1）和几篇引导设计总结。关键词：onboarding、first launch、learn by doing、progressive disclosure、aha moment。相关任务：C47（第一版）、C48（改版）、C50（岛上的「第一次」提示）。
>
> 2026-11-12 按这个方案做完了五幕（C48），和下文的不同：开机启动放在第 5 幕里，不在真岛的横幅上；真岛的招呼是收起条上的一行字，不是横幅。做成什么样见 [新手引导](../features/onboarding.md)。

## 结论

第一版的问题不在样式，在于它是**一张设置表单**：用户读完说明、拨几个开关，但从头到尾没碰过岛。好的引导都在做同一件事：**让用户亲手做一次产品最核心的动作，并且在做的过程中就看到效果。**

参考里最值得学的四条：

1. **练习，不讲解**。Superhuman 的新用户先在一个假收件箱里练快捷键，再碰真邮件 [1]；Linear 在引导里让你真的按一次 ⌘K、输入命令、被夸一句 [2]；Duolingo 让人先上完一课再注册 [3]；马里奥 1-1 不写一个字，用关卡布局教会跳跃和蘑菇 [4]。
2. **选择立刻可见**。Linear 第一屏就让你选深浅色 [2]；Warp 选主题时先预览，确认才保留 [5]；Arc 在引导里让你亲手开关广告拦截，看到效果 [6]。
3. **签名动画只放一次，但要值得**。PowerToys 新欢迎页用了组合动画，有评测标题直说「美到只能看一次很可惜」[7]；苹果的 hello 手写字成了品牌记忆 [8]。
4. **引导结束不等于教学结束**。Superhuman 每次用命令面板都顺带显示快捷键，靠重复教会 [1]；渐进式引导把提示放到用户第一次遇到某个场景的时候 [9]。

同类刘海岛 / 灵动岛工具（NotchNook、Boring Notch、DynamicWin、WinIsland 等）**都没查到像样的首次引导**，最多一页说明 [10][11]。这是浮屿能做出差异的地方。

### 建议：把引导做成「岛的第一次见面」

保留单独的引导窗口（用户的要求），但窗口里不再是表单，而是一张**迷你桌面**：上方停着一座按真实设置画出来的岛，用户在这座岛上完成操作。核心是五幕，约 60 秒：

| 幕 | 名字 | 用户做什么 | 学到什么 | 参考 |
|---|---|---|---|---|
| 1 | 落岛 | 看一个光点从顶部落下、拉长成岛，岛里依次滑过「你好 / Hello」；点岛开始 | 这东西住在屏幕顶部 | Apple hello、PowerToys 欢迎动画 |
| 2 | 捏岛 | 在迷你桌面上选深 / 浅 / 跟随系统、强调色（含「用 Windows 主题色」）、圆角，岛实时变形变色 | 岛可以长成我喜欢的样子 | Linear、Warp |
| 3 | 装岛 | 先选「你平时主要用电脑做什么」：写代码 / 办公 / 学习 / 娱乐，岛按身份装好一组功能；再把功能贴纸拖到岛上或拖走来微调，收起条上马上多出或少掉对应图标 | 岛上有哪些功能，怎么开关 | Duolingo 的个性化问题 |
| 4 | 玩岛 | 迷你桌面「活」起来：一首歌在放，一个 Claude Code 会话在跑。依次完成三个小任务，完成一个亮一颗星：① 鼠标停在岛上 → 展开；② 把桌面上的一个假文件拖给岛 → 进文件中转；③ 真按一次剪贴板快捷键（默认 Ctrl+Shift+W）→ 剪贴板弹出。任务里顺带问「悬停还是点击展开」「要不要 Win+V」 | 岛怎么用，而且是手学会的 | Superhuman、Linear ⌘K、马里奥 1-1 |
| 5 | 放岛 | 点「开始使用」：引导窗口缩小，飞向屏幕顶部真正的岛并淡出；真岛做一次欢迎脉冲，横幅写「浮屿已就绪」，开机启动作为横幅上的一个开关 | 真正的岛就在那里 | Arc 的「可感知的价值」 |

几条原则：

- **随时能走**：每幕右上角都有「跳过」，已经做的选择保留。第 4 幕的任务可以只做一个。
- **只用真设置**：每个选择写的都是现有的设置，和 C47 一样，不新增设置项。
- **键盘能走完**：Tab / Enter / 方向键能完成每一幕，拖拽有按钮代替。
- **减弱动效**：系统开了减少动画时，落岛和飞回都换成淡入淡出。
- **不要账号、不要权限**：邮箱、AI 工具连接放到之后的提示里。

### 引导之后：岛上的「第一次」提示

第 4 幕只教三件事，其余的放到用户第一次遇到时，在岛上轻轻提一句（一天最多一条，点一下就不再出现）：

- 第一次有 Claude Code / Codex 会话开始：「这是 Agent 状态灯，点开能看所有会话」，并给「连接更多工具」入口。
- 第一次有新消息横幅：「点横幅直接看，右键可以静音这个来源」。
- 第一次贴边收起：「鼠标碰一下顶边，岛就回来」。
- 用了三次鼠标展开某一页：「下次可以按 Alt+数字直接打开」（Superhuman 的做法）。

这部分需要一个新的 localStorage key 记哪些提示看过，属于对外契约，做的时候写进 contracts.md。

## 详细

### 第一版为什么显得普通

- 四步都是「标题 + 一段说明 + 一组开关」，和设置窗口长得一样，用户会觉得「我刚装完就在填设置」。
- 用户没有和岛发生任何互动，第一次「哇」要等到他自己去点岛。
- 第 2 步的 8 个开关逼用户在还不了解功能时做决定；大多数人会全部保持默认，直接点下一步。

### 参考逐条

**Linear** [2]：注册后先选深浅色，紧接着是一个很短的 ⌘K 练习：按下去、输入命令、得到夸奖、提醒以后多用；然后才是加入团队、GitHub、邀请同事。最后一屏是「You're good to go」，让你按 C 建第一个任务。作者注意到它把主题和快捷键放在团队设置之前，文案短而安静，几乎不用配图。对我们的启发：把「摸一下产品」放在最前面，最后一屏直接给一个能马上做的动作。

**Superhuman** [1]：一对一 30 分钟的入门课，先在合成的假收件箱里用 E 归档、R 回复、J/K 移动，练出肌肉记忆再进真收件箱。之后命令面板每次都显示对应快捷键，按键有短暂的屏幕提示，撤销提示也写着快捷键。文中称这让快捷键使用率提高 20%（数字未核实）。对我们的启发：迷你桌面就是我们的「假收件箱」；引导后的提示可以借它「重复中顺带教」的做法。

**Raycast** [12]：官方入门是七件事的清单（搜索、操作面板、快捷链接、设热键、AI、扩展、日常工具），建议「练几天」。它没有在首屏做互动练习，靠文档。说明清单式入门对工具类软件够用，但没有记忆点。

**Arc** [6]：用「先试一周」代替「设为默认浏览器」；引导里让用户自己开关广告拦截，亲眼看到效果；用俏皮的动画。Deceptive Patterns 网站批评过它早期强制注册 [13]，我们不要账号，这一点天然没问题。

**Warp** [5]：选主题是「先预览，再确认或撤回」。第 2 幕的捏岛照这个来，岛实时变，但离开这一幕之前随时能还原。

**PowerToys** [7][14]：每个工具一页，有动图展示核心功能、能打开设置；欢迎页正在换成组合动画。它的结构是「功能目录」，适合工具很多、彼此独立的软件；浮屿是一个整体，更适合「一座岛逐步长出来」的叙事。

**Duolingo** [3]：先问学习目标和水平，再上一课，最后才注册，并通过 A/B 测试确认推迟注册有效。第 3 幕「你平时主要用电脑做什么」借的是这个：用一个问题代替八个开关。

**超级马里奥 1-1** [4]：宫本茂讲过这一关如何不用文字教会玩家：第一个敌人迫使你学会跳，蘑菇出现的位置让你一定会碰到它。第 4 幕的任务也这样布置：鼠标自然会经过岛，假文件就摆在岛下方。

**同类岛工具** [10][11]：DynamicWin、WinIsland、eIsland、Navi 等 Windows 项目的 README 和发布说明里没有找到首次引导；macOS 的 NotchNook 等也只查到功能介绍。（只看了公开页面和搜索摘要，没装软件实测。）

### 第 3 幕的身份预设（草案）

| 身份 | 打开 | 关掉 |
|---|---|---|
| 写代码 | AI Agent 状态、剪贴板（含 Win+V）、截图、待办、文件中转 | 邮箱 |
| 办公 | 待办、日历、邮箱、剪贴板、快捷翻译、截图 | AI Agent 状态 |
| 学习 | 待办、快捷翻译、剪贴板、音乐 | AI Agent 状态、邮箱 |
| 娱乐 | 音乐（含歌词）、文件中转 | AI Agent 状态、邮箱、待办 |

可以多选，取并集；选完仍然可以拖贴纸改。

### 实现要点（给之后做的人）

- 迷你桌面里的岛不是真的主窗口，是 `IslandPreview` 一类的绘制加上一点交互（展开、收起、接受拖放），沿用岛的 CSS 变量，所以和真岛一样随设置变化。
- 第 4 幕检测真实快捷键：剪贴板快捷键是全局热键，按下时会弹出真的剪贴板窗口。引导里可以监听已有的 `clipboard-popup-opened` 事件来判定完成，不需要新的快捷键逻辑。
- 第 5 幕的「飞回」：前端拿到真岛的位置（主窗口），引导窗口用几帧 `setPosition` + `setSize` 动画缩过去，再关窗；真岛那边收到一个跨窗口请求（照 `fuyu-panel-preview` 的做法用 localStorage 事件）后做欢迎脉冲和横幅。
- 窗口可能要从 720 × 560 加大到约 860 × 600，给迷你桌面留地方。
- 回归页：每一幕一个 `?act=` 参数，自动检查身份预设写入的设置、贴纸拖放、任务完成判定。

## 来源

（查询日期都是 2026-11-11）

1. Superhuman 的设计分析，入门课与命令面板教学：<https://blakecrosley.com/ko/guides/design/superhuman>；Superhuman 帮助中心：<https://help.superhuman.com/hc/en-us/articles/45191759067411-Speed-Up-With-Shortcuts>
2. Growth Dives，Linear 引导拆解：<https://growth-dives.kit.com/posts/growth-dives-inside-linear-s-onboarding-3-things-i-didn-t-expect>
3. Duolingo 推迟注册的 A/B 测试：<https://taplytics.com/blog/duolingo-ab-test-onboarding>；Appcues 的拆解：<https://goodux.appcues.com/blog/duolingo-user-onboarding>
4. 宫本茂讲 1-1：<https://mcvuk.com/development-news/video-miyamoto-shares-his-level-design-secrets/>；分析文章：<https://medium.com/swlh/the-perfect-game-tutorial-analyzing-super-marios-level-design-92f08c28bdf7>
5. Warp 主题文档：<https://docs.warp.dev/terminal/appearance/themes>
6. Built for Mars 的 Arc 页（大部分付费，只看了公开部分）：<https://builtformars.com/company/arc>
7. Windows Central，PowerToys 欢迎动画（只看到标题，正文没取到）：<https://www.windowscentral.com/software-apps/this-powertoys-animation-is-so-stunning-im-sad-ill-only-see-it-once>
8. 苹果 hello 屏保：<https://www.macrumors.com/2021/04/21/hello-screen-saver-macos-big-sur-11-3/>
9. 渐进式引导：<https://blessingokpala.substack.com/p/progressive-onboarding-learning-the>；<https://dockyard.com/blog/2019/12/23/divebomb-or-the-dipping-toe-onboarding-vs-progressive-disclosure>
10. macOS 刘海岛工具列表：<https://alternativeto.net/software/notchnook/>
11. Windows 灵动岛项目：<https://github.com/FlorianButz/DynamicWin>、<https://alternativeto.net/software/winisland/about/>
12. Raycast 入门：<https://manual.raycast.com/quickstart>
13. Deceptive Patterns 对 Arc 强制账号的批评：<https://deceptive.design/articles/arc-browsers-pushy-account-requirements>
14. PowerToys OOBE 规格（要求每页有展示核心功能的图或动图）：<https://github.com/microsoft/PowerToys/wiki/OOBE-Dialog>
