# 岛的外壳只认贡献：E36.3.51 的方案

任务 [E36.3.51](../tasks/E/E36.3.51.md)（#619），计划 [v3-phase3-plan.md](../architecture/plugins/v3-phase3-plan.md)「2026-11-15 调整」。2026-11-15 摸底，e36-3-51 写，等组长看过再动代码。

## 现在是什么样

E36.3.25 之后，`src/windows/island/` 还有 46 个文件 import 功能目录（清单在 [E36.3.25 的备注](../tasks/0-archive/E/E36.3.25.md)）。外壳的数据流是：`IslandApp` 调各功能的 hook，拿到状态后自己算收起条显示什么、多宽、贴边要不要保持、弹窗、颜色、弹出多高，再把整包状态往 `IslandShell`、`IslandCollapsedBar`、`IslandSideColumn`、`IslandPages` 里传。功能的插槽项（E36.3.25 搬进 `features/<领域>/plugin/` 的那些）拿到的也是外壳拼好的 props。

所以要做的不是删 import，而是把数据流倒过来：**功能自己跑 hook，把结果交出来；外壳只认交上来的通用数据，不知道是谁交的。**

## 机制

### 1. 功能在 runner 里跑 hook

每个功能在 `features/<领域>/plugin/runners.tsx` 里登记 `island.runner/v1` 的项（E36.3.25 已有这个插槽），把现在 `IslandApp` 替它调的 hook 挪进去：`useMediaState`、`useIslandLyrics`、`useCalendar`、`useIslandAgents` 等。runner 拿到结果后做两件事：

- **给自己的插槽项**：写进功能自己的窗口内 store（`features/<领域>/plugin/store.ts`，`useSyncExternalStore`，和 `timer/store.ts` 一样的写法）。展开页、收起条项、提醒这些插槽项直接读这个 store，不再从外壳拿 props 包。
- **给外壳**：调 `plugin-kernel` 的 `useIslandContributions(id, 贡献[])`，交下面「贡献」一节的通用数据。

runner 的 props（`IslandRunnerProps`）补外壳本来就有、功能要用的几样：`isTucked`、`quiet`（游戏模式）、`barText`（收起条显示文字）、`background`、`accent`（算封面取色的变量要用）。

### 2. 贡献存在 plugin-kernel，按拥有者撤

新文件 `src/features/plugin-kernel/islandContributions.ts`：

- 一个窗口内的表，键是 `<拥有者>:<id>`，值是这一项交的贡献数组。
- `useIslandContributions(id, list)`：在 `useLayoutEffect` 里写入，浅比较没变就不写；组件卸下时删掉自己那一项。
- 外壳读：`useIslandContributed()` 返回按种类分好、排好序的结果（见下）。
- **读的时候再按开关过滤一次**：拥有者在 `registry` 的关掉名单里（`followBuiltinSwitches` 已经在维护），它的贡献一律不算。runner 被撤掉时 effect 的清理本来就会删，这一层是保底，防止撤掉和重算之间差一帧。
- 开发版里把整张表挂到诊断上（`diagnostics.ts` 已有的那条路），`builtins-off` 回归页据此查「关掉后还在交贡献」。

贡献只放能序列化成 JSON 的值（[v3-boundary.md](../architecture/plugins/v3-boundary.md) 规则 1），不放函数和 React 元素。要画东西的走插槽项，贡献里写插槽项的 `id`。这样第 5 阶段第三方插件经宿主也能交同一种数据。要回调的（点收起条打开翻译速览）用 `useIslandAction(id, fn)` 登记，贡献里写 action 的 id。

### 3. 首帧

runner 和 `IslandShell` 是同一棵树里的兄弟，runner 的 `useLayoutEffect` 写表后外壳在同一次提交、上屏前重渲染，看不到闪。要注意的是 `useIslandWindow` 发给 Rust 的尺寸：第一次提交时贡献还是空的，可能多发一次「最小宽度」再发正确的。做的时候看 `island-forms`、`notch-island` 回归页和真岛启动，有问题就让 `useIslandWindow` 等贡献表第一次写完（表上加一个 `settled` 标记）再发。

## 贡献的种类

`IslandContribution` 是下面几种之一，都带 `kind`：

| `kind` | 字段 | 外壳拿它做什么 | 现在外壳里对应的代码 |
|---|---|---|---|
| `line` | `item`（`island.line/v1` 项的 id）、`priority`、`measure`（量宽度用的文字）、`extra`（图标等额外宽度，px）、`page`（点它、悬停时去的页）、`lead`（悬停时是否先切到 `page`）、`action`（点它时调的 action，优先于 `page`）、`label`（读屏文字）、`center`（是否把中心图案嵌在这一行里）、`shareable`（上面的 `beat` 行可以和它轮流）、`beat`（这一行要和下面的 `shareable` 行轮流） | 收起条主行：按 `priority` 取最高的一条渲染；收起宽度按它的 `measure` + `extra` 算；收起条和侧边岛的点击目标、悬停领头页取它的 `page` / `lead` | `IslandCollapsedBar` 里那串 `notice ? … : deviceAlert ? … : translationPeek ? … : showMeeting ? … : agent / lyric / todo`；`useCollapsedTodo` 的宽度；`openTarget`；`leadPage` |
| `alert` | `item`（`island.alert/v1` 项的 id） | 刘海提醒、侧边气泡、收起条上的弹窗：按插槽的 `order` 取第一个有贡献的项；同时让刘海的翼加宽（`notchFittedWidth` 的 `alerted`） | `hasNotchAlert`、`sideBubbleShown`、`DeviceAlertPopup` / `QuotaAlertPopup` / `LevelPopup` 的三选一 |
| `notice` | `item`（`island.notice/v1` 项的 id）、`measure` | 收起条上的提示：按 `order` 取第一个；宽度按提示的宽度算 | `useIslandNotice` 的来源包 |
| `preview` | `item`（`island.line/v1` 里的覆盖层项）、`source`（给侧边岛标热的行 id） | 收起条上的消息预览：盖在主行上，过渡动画（`.island__summary-layer`）留在外壳 | `banner.barPreview`、`CollapsedMessageContent` |
| `reveal` | `when`（`always` 或 `revealOnMessage`） | 贴边时探出来、暂停悬停展开和闲置收起 | `useIslandTucking` 的 `hasMessagePreview`、`hasPermissionPrompt`、`hasTranslationPeek`；`useIslandHover` 的 `hasMessagePreview` |
| `hold` | `reason`（只给诊断看） | 贴边收起时保持露出 | `useTuckHold`、`holdsTuck` |
| `side` | `item`（`island.side/v1` 项的 id）、`height`、`hot` | 侧边岛的行：外壳按插槽 `order` 排，按 `height` 算放得下几行 | `useSideColumnRows` 里写死的 agent、unread、mail、music、todo、device、shelf |
| `status` | `state`、`label`、`page` | 状态灯：收起条的脉冲、侧边把手的圆点、刘海弹出条的图标，CSS class 照旧是 `island__pulse--agent-<state>` | `useAgentIndicator` 的 `agentVisualState`、`agentStatusLabel` |
| `popup` | `page`、`height`（已含这个面板自己的边框和节省） | 弹出：有任一项时 `useIslandPopup` 进弹出态；展开高度在当前页有 `popup` 时用它 | `getExpandedIslandHeight` 的 `agentAlertRowHeight`、`messageArrivalsHeight`；`useIslandPopup` 的 `messagePanel.arrivals !== null \|\| alertPopup` |
| `style` | `vars`（舞台的 CSS 变量）、`className`、`tint`（玻璃的取色） | 合进 `stageStyle`、`main` 的 class、`useIslandGlass` 的 `cover` | `coverAccentVariables`、`cover-color`、`glassCover` |
| `busy` | 无 | 收起条被占着：第一次提示让路 | `useIslandFirstHints` 的 `busy`、`showsMessage` |

主行的优先级是 plugin-kernel 里的一张常量表，数字大的先：

| 优先级 | 行 | 交的功能 |
|---|---|---|
| 70 | 翻译速览、截图识字（`action` 打开速览） | translation、screenshot |
| 60 | 会议（`beat`，`page: calendar`，`lead: false`） | calendar |
| 50 | Agent 的插话（`agentInterjection`） | agent-status |
| 45 | 歌词（设置是「歌词优先」时，`shareable`、`lead`） | media |
| 40 | Agent 会话标题（`agentTitleMode` 不是 `changes` 时，`lead`） | agent-status |
| 35 | 歌词（设置是「Agent 优先」时） | media |
| 20 | 待办标题（轮播在待办自己的 runner 里） | todos |
| 10 | 待办数（`center: true`） | todos |
| 0 | 应用名（`showTitle`） | 外壳自己 |

提醒（`alert`）和提示（`notice`）盖在主行上面，顺序照现在的：提示 > 设备 > 额度 > 音量亮度 > 主行。这个先后由外壳定（`notice` > `alert` > `line`），同一种里按插槽的 `order`。

**会议行**：`useMeetingBeat` 和会议行的组件都进日历的 runner 和插槽项。日历 runner 用 `useLineBelow(60)` 看自己下面那条是不是 `shareable`：是（歌词在显示）就按 `useMeetingBeat` 轮流交、不交；不是就一直交。这和现在一样：会议压过 Agent 和待办，只和歌词轮流。加入按钮是会议行插槽项的一部分，`openTarget` 变成会议行贡献的 `page: "calendar"`。`IslandApp` 里 `useCalendar` 算好往日历页和收起条两处传的状态，改成日历 runner 写进 `calendar/plugin/store.ts`，日历页从 store 读。

Agent 和歌词的先后现在是 `agentTitleMode` 和 `lyricsIslandPriority` 一起算出来的，拆成上表的数字后，两个 runner 各按自己的设置决定交哪一档，结果和现在的表达式一样（插话总在歌词前；「歌词优先」时有歌词就不显示会话标题）。这条写单元测试逐种组合核对。

## 新的插槽和元数据

都要组长点头（计划「公共文件怎么排队」：插槽定义只在 E36.3.25、E36.3.26 里加，之后加先找组长）。

| 插槽 | 种类 | 元数据 | 放什么 |
|---|---|---|---|
| `island.line/v1`（新） | list | 无（显示与否、先后都看 `line` / `preview` 贡献） | 收起条主行：会议、Agent 标题、歌词、待办标题、待办数、翻译速览、消息预览 |
| `island.side/v1`（新） | list | 无（高度看 `side` 贡献） | 侧边岛的行 |
| `island.overlay/v1`（新） | list | 无 | 舞台上不归岛体的浮层：消息横幅 `MessageBanner` |
| `island.decor/v1`（新） | single，按 `place` 分组 | `place`（`center`、`status-light`、`agent-icon`、`agent-count`）、`width` | 中心图案、宠物换掉 Agent 图标、标记灯换掉脉冲、会话环换掉 Agent 数；`island.collapsed-center/v1` 并进来作 `place: center`（这个插槽名只在 E36.3.25 里出现过，没有第三方用） |
| `island.alert/v1`（加字段） | — | 加 `popup`（收起条和侧边气泡里的那种完整弹窗组件）；`active(sources)` 去掉，改看 `alert` 贡献 | 设备、额度、音量亮度 |
| `island.notice/v1`（改字段） | — | `active(sources)` 去掉，改看 `notice` 贡献 | 录屏、语音、计时响铃、截图、复制、提醒卡片、第一次提示 |
| `island.header/v1`（用现有的） | — | — | Agent 状态按钮从 `IslandHeader` 里写死的位置挪成插槽项；展开页右上的 `AgentArrangeButton`（现在是 `pageActions`）也挪成项，`enabled` 看当前页 |

插槽项拿到的 props 只剩外壳自己的东西（`t`、`showTitle`、`onOpenPage`、`mode`、`page` 这类），功能的状态全从功能自己的 store 读。`IslandPagesProps` 那一大包没有了，展开页的 props 只剩 `IslandPageProps` 里外壳的部分（`onOpenSettings`、`todoScrollStartRows`、`extraView`、`embedded`、`isOpen`）。

## 各功能交什么

| 功能 | runner 里跑的（从外壳挪过来） | 交的贡献 | 自己的 store 给谁读 |
|---|---|---|---|
| **media** | `useMediaState`、`withDemoMedia`、`useIslandLyrics`、`useCoverColor`、`useAudible` | `line`（歌词，35 或 45）、`hold`（在播放且设置要保持）、`side`（音乐行，封面时高度不同）、`style`（封面取色的变量、`cover-color`、玻璃 `tint`） | 音乐页、收起条的音乐项、侧边岛音乐行 |
| **calendar** | `useCalendar`（连同 `todoEvents`：待办的定时事件改从 `todos/plugin/store.ts` 读，见下面「功能之间」）、`useMeetingBeat` | `line`（会议，60，`beat`） | 日历页、会议行（含加入按钮） |
| **todos** | `useIslandTodos`（不含它顺带跑的本机接口和更新检查，见下）、`useCollapsedTodo` 的轮播和标题 | `line`（标题 20 / 待办数 10）、`hold`（有进行中的待办且设置要保持）、`side`（待办数） | 待办页、截图页里的待办、语音输入加待办 |
| **agent-status** | `useIslandAgents`、`useIslandAgentAlerts`、`useQuotaAlert`、`useAgentIndicator` | `line`（插话 50、标题 40）、`hold`（有会话在等）、`side`（会话环行）、`status`、`popup`（审批卡，高度用 `getAgentAlertExpandedHeight` 算好）、`alert`（额度） | Agent 页、页头按钮、排序按钮、额度提醒 |
| **messages** | `useQQNotifications`、`useWeChatReminders`、`useMail`、`useLatestMessagePreview`、`useIslandBanner`、`useIslandMessagePanel`、`useMessageView`、邮箱总开关的同步（现在在 `useIslandFeatures` 里） | `preview`、`reveal`、`hold`（有未读且设置要保持，邮箱基线的计算跟过来）、`side`（未读、邮件）、`popup`（到达面板）、`busy` | 消息页、页头的消息按钮、横幅、刘海里的消息翼（`NotchMessage` 挪进来） |
| **device-events** | `useDeviceAlert` | `alert` | 设备提醒 |
| **system-levels** | `useLevelPopup` | `alert` | 音量亮度提醒 |
| **device-use** | `useDeviceUse` | `side`（每个在用的设备一行） | 收起条的设备占用项、侧边岛行 |
| **translation** | `useQuickTranslation`、`useIslandTranslation` | `line`（速览，70，`action`）、`reveal`（`revealOnMessage`）、`busy` | 页头的翻译按钮 |
| **screenshot** | `useScreenshotText`、`useIslandScreenshot`、`useScreenshotCard`、`useScreenshotNotice`、`useRecording`、截图快捷键（现在在 `useIslandKeyboard` 里） | `line`（识字的速览，70）、`notice`（截图卡片、录屏）、`reveal`（截图卡片） | 页头的截图按钮、截图页 |
| **clipboard** | `useClipboardHistory`、`useClipboardCopyCard`、剪贴板快捷键（从 `useIslandKeyboard` 拆出来） | `notice`（复制卡片） | 剪贴板页 |
| **timer** | `useIslandTimer`（响铃） | `notice`（响铃） | 计时器页 |
| **voice-input** | `useIslandVoiceInput` | `notice` | 语音提示 |
| **file-shelf** | `useIslandShelf`、`useFileShelfDrop` | `side`（中转数） | 中转页、收起条项 |
| **updater** | `useIslandAutoUpdate`、`useBackgroundUpdateCheck`（现在借在 `useIslandTodos` 里） | 无 | 设置按钮的更新圆点、收起条的更新项 |
| **local-api** | `useLocalApiBridge`（现在借在 `useIslandTodos` 里） | 无 | — |
| **center-pattern**、**session-ring**、**claude-usage** | `useCollapsedSlots` 里各自那段 | `island.decor/v1` 的项和宽度 | — |

外壳留下的：模式、页、贴边、刘海、玻璃、窗口尺寸和位置、悬停、页面快捷键（Alt+数字、上一页下一页）、第一次提示、应用名、`useIslandFeatures` 里页面开关和回退的算法（`IslandFeatures` 的取值改由各功能 runner 交，见下）。

### 页面开关

`useIslandFeatures` 现在从设置和消息、剪贴板的状态拼出 `IslandFeatures`。改成：页面的 `enabled(features)` 照旧，`features` 里每一项由对应功能的 runner 交（再加一种贡献 `page`：`{ page, enabled }`），外壳只合并。平台不支持（`withoutUnsupported`）和截图折进剪贴板（`foldScreenshotsIntoClipboard`）是外壳的通用规则，留着。

### 功能之间

现在 `IslandApp` 顺手把一个功能的状态递给另一个功能，挪进 runner 后这些就成了功能 import 功能：

| 谁要 | 要谁的 | 用来 |
|---|---|---|
| todos | agent-status 的状态快照 | 待办和 Agent 的联动 |
| calendar | todos 的待办 | 日历上显示有时间的待办 |
| screenshot | agent-status 的会话 | 截图卡片的「发给 Agent」 |
| updater | agent-status 的会话 | 空闲时才装更新 |
| session-ring、center-pattern | agent-status 的会话、活动 | 会话环、宠物心情 |
| voice-input | todos 的 `addTodoOn`、笔记 | 语音加待办（计划 E36.3.36 改走 `todos/v1`） |

这些正是计划里 `agents/v1`（E36.3.37）、`todos/v1`（E36.3.38）要接的。这次有两种做法，**要组长定**：

- **A（建议）**：先 import 对方的 store，记进 `feature-boundary-allowlist.json` 的 `features`（大约 8 条），每条标明由 E36.3.37 / E36.3.38 的服务去掉。白名单「只减不增」，这次是例外，要组长同意。
- B：这次就先做 `agents/v1`、`todos/v1` 的窗口服务（只有窗口一侧，宿主一侧留给 E36.3.37 / 38）。功能之间干净了，但 E36.3.51 会更大，而且服务的形状要在 Agent、待办迁移之前定死。

## 关掉功能后怎么保证不再影响

1. **现在**（功能还没各自迁成插件，插槽项的拥有者大多还是 `builtin`）：功能 runner 在功能的开关（`settings.musicEnabled` 这些，或 `LEGACY_SWITCHES` 镜像出来的值）关着时什么都不交。runner 里每一种贡献都包在开关后面，单元测试逐个功能核对：开关关着时交的是空数组。
2. **各功能迁完后**（E36.3.31–.46 把拥有者改成插件 id）：关掉插件，registry 撤掉它的 runner，effect 清理删掉它的贡献；读的时候按关掉名单再滤一遍。这一条不用各功能再写。
3. **回归页**：`builtins-off` 加一项检查，关掉插件后贡献表里还有它的项就算残留；`?all=1` 能直接看到现在哪些功能还没做到第 2 条。
4. **单元测试**：`tests/unit/island-contributions.test.mjs` 核对写入、撤掉、关掉名单过滤、主行的先后、会议和歌词的轮流、宽度。

## 边界测试

现在 `tests/unit/feature-boundaries.test.mjs` 只管功能之间、共享层和功能 import 窗口，**没有管窗口 import 功能**，所以白名单里还没有外壳的条目。验收「外壳相关的条目清零」我的理解是：加一条测试，`src/windows/island/` 只能 import `src/features/plugin-kernel/`，其余功能目录一律不行；白名单新加 `island` 一组，最后只剩第 2 版插件系统（`plugins`、`plugin-views`，冻结，第 6 阶段随第 2 版删）的那些 import（`usePluginPages`、`usePluginOpenView`、`usePluginKeybindings`、`usePluginHostEvents`、`useFirstRunGuide`、`PluginPageButtons`、权限提示、右键菜单、插件通知）。第 2 版冻结、不加新接口，没法改成贡献。**要组长确认**这样算不算清零；不算的话，第 2 版那几处要另想办法（比如收进一个 `src/windows/island/v2/` 目录单独放行）。

## 分几个提交

搬迁和改行为分开。功能目录下的新文件按功能各自的 scope 补进任务的 `--scope`。

| # | 类型 | 内容 |
|---|---|---|
| 1 | 搬迁 | 功能要用的外壳类型和小工具上提：`IslandPage`、`IslandMode`、`BuiltinPage` 这些从 `windows/island/types.ts` 挪到 `plugin-kernel/islandTypes.ts`（外壳那边 re-export）；`usePageHidden` 从 center-pattern 挪到 `lib/`；`layout.ts` 里 Agent 页的高度挪到 agent-status。零行为变化 |
| 2 | 改写 | `plugin-kernel/islandContributions.ts`、`useIslandAction`、`useLineBelow`、优先级表；新插槽和改了的元数据（`packages/plugin-base/src/protocol.*`）；单元测试；`v3-boundary.md`「插槽」下加「岛的贡献」一节。外壳还没用 |
| 3 | 改写 | 外壳的布局改成只读贡献，每一类一个提交：3a 主行、宽度、点击目标、悬停领头、会议行；3b 提醒、提示、侧边气泡、刘海翼；3c 保持和探出；3d 侧边岛的行和状态灯；3e 弹出高度、横幅、消息预览；3f 样式和装饰位。这一步 `IslandApp` 里临时有一个 `legacyContributions.ts`，把还在外壳里的功能状态转成贡献交给同一张表，外壳的布局代码只看表。DOM 不变 |
| 4 | 搬迁 | 外壳里专属某个功能的 hook 文件挪进功能目录（`useIslandLyrics` → media，`useIslandAgents` / `useIslandAgentAlerts` / `useAgentIndicator` → agent-status，`useCollapsedTodo` / `useIslandTodos` → todos，消息那几个 → messages，`useIslandScreenshot` → screenshot，`useIslandTranslation` → translation，`useIslandAutoUpdate` → updater，`useIslandVoiceInput` → voice-input，`NotchMessage` → messages），还由 `IslandApp` 调。零行为变化 |
| 5 | 改写 | 每个功能一个提交：hook 从 `IslandApp` 挪进它的 runner、写进它的 store，插槽项改读 store，从 `legacyContributions.ts` 里删掉它那段。顺序：timer、voice-input、device-events、system-levels、device-use（小的先，验证写法）→ translation、screenshot、clipboard → calendar、media → todos → agent-status（连同 center-pattern、session-ring、claude-usage 的装饰位）→ messages → updater、local-api → file-shelf |
| 6 | 改写 | 收尾：删 `legacyContributions.ts`，`IslandPagesProps` 只剩外壳的部分；边界测试加 `island` 一组；`builtins-off` 查贡献；`v3-boundary.md` 写全 |

一共十几个提交，比计划里一个阶段通常的 1–5 个多。每个都能单独验证（每步都跑 `pnpm check`、`pnpm build`、`pnpm test:regression`），中途停下也不会留下坏掉的 `main`。

## 回归页

**DOM 快照都不该变**：外壳渲染的结构、class、顺序都照旧，第三步每个提交的验证就是「快照不变」。

要改源码的回归页（它们现在直接给 `IslandShell` / `IslandCollapsedBar` 传功能的 props）：`bottom-island`、`claude-usage`、`collapsed-message-animation`、`collapsed-slots`、`i18n`、`island-forms`、`liquid-glass`、`lyrics-handoff-checks`、`message-banner`、`message-panel`、`notch-island`、`session-ring`、`side-island`、`update-reminder`，以及 `builtins-off`。加一个 `tests/regression/islandContributionsFixture.tsx`，回归页往贡献表和功能的 store 里塞数据，代替传 props。

可能会变、变了要说明的：

- `side-island`：Agent 行现在总在第一行（即使 Agent 关着也有一个空圆点），改成贡献后 Agent 关着就没有这一行。**这是行为变化**（关掉 Agent 后侧边岛不该再有它），快照会变，单独一个提交并写明。其他页如果有同样「功能关着还显示占位」的，同样处理，逐个列出。
- `builtins-off?all=1`：messages 那行里 `.island__summary-layer`、`.island-message-button` 在外壳里的残留应该消失（这两个跟着消息预览和页头按钮进了消息插件）。

## 和别的会话撞的地方

- `src/windows/island/IslandRunners.tsx`、`api.ts` 现在有托盘卡片（C99.3）没提交的改动，`trayMenuPage.ts`、`useTrayMenuOpenPage.ts` 也是它的。第 2 步改 `IslandRunnerProps` 之前等它提交。G1.31 也在 `src/windows/island/`，动同一个文件前先看 `git status`。
- **file-shelf 归 E36.3.32**：`useIslandShelf`、`useFileShelfDrop` 和 `features/file-shelf/plugin/` 留到最后，等 E36.3.32 合入后再挪，或者请 E36.3.32 顺手把这两个 hook 挪进它的 runner（只交 `side` 贡献）。**要组长定**。
- 第 2 批里等 E36.3.51 的五个任务（E36.3.31、.33、.37、.38、.44）：第 5 步做完一个功能，那个功能的迁移任务就可以开工，不用等整个 E36.3.51 做完。组长可以据此提早派。

## 要组长定的

1. 新插槽 `island.line/v1`、`island.side/v1`、`island.overlay/v1`、`island.decor/v1`，以及 `island.alert/v1`、`island.notice/v1` 去掉 `active(sources)`（改看贡献）、`island.collapsed-center/v1` 并进 `island.decor/v1`。
2. 功能之间的数据：A（暂记白名单，由 E36.3.37 / 38 去掉）还是 B（这次先做窗口服务）。
3. 第 2 版插件系统的 import 留在 `island` 白名单里算不算「清零」。
4. file-shelf 那两个 hook：等 E36.3.32 合入后我来挪，还是交给 E36.3.32。
5. 提交数：照上表十几个，还是要我合并（例如第 3 步合成一个）。
6. 第 5 步每做完一个功能就告诉组长，好提早派那个功能的迁移任务；还是全部做完再说。
