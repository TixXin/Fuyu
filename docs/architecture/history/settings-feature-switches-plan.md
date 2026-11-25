# 设置窗口：功能开关只放概览，以及细节完善

更新：2026-11-15。主会话的计划，用户同意后按这里派子会话；做完移到 `history/`。

用户原话：「设置页面细节完善，另外功能的每个页面都有开关，去掉，改为只在概览中显示，关掉后，功能的菜单选项也不显示」。

## 现状（核实过的）

### 各功能页的启用开关在哪

| 功能 | 页面文件 | 开关怎么画 | 存在哪 |
|---|---|---|---|
| 待办 | `src/windows/settings/TodosSettingsPage.tsx` | `FeatureHeader`（页头右边的开关） | `fuyu-settings` 的 `todoEnabled` |
| 日历 | `CalendarSettingsPage.tsx` | `FeatureHeader` | `calendarEnabled` |
| 音乐 | `MusicSettingsPage.tsx`（三个标签，关着时每个标签都只剩页头） | `FeatureHeader` | `musicEnabled` |
| 翻译 | `TranslationSettingsPage.tsx`（关着时快捷键组仍显示） | `FeatureHeader` | `translationEnabled` |
| 剪贴板 | `ClipboardSettingsPage.tsx`（四个标签） | `FeatureHeader` | 剪贴板自己的设置 `enabled`（`useClipboardSettings`，不在 `fuyu-settings` 里） |
| 文件中转 | `ShelfSettingsPage.tsx` | `FeatureHeader` | `shelfEnabled` |
| 截图 | `ScreenshotSettingsPage.tsx`（两个标签） | `FeatureHeader` | `screenshotEnabled` |
| AI Agent | `AgentSettingsPage.tsx` | 旧式的一行开关 `ModuleSwitchSection`「启用 AI Agent 状态灯」，和别的功能页不一样；关着时其余设置和另外 6 个标签照常显示 | `agentStatusEnabled` |
| 消息 | `MessagesSettingsPage.tsx` | 没有总开关，页头右边写开着几个来源；QQ、微信、邮箱三组各有开关 | 各来源自己的设置 |

概览卡片（`OverviewSettingsPage.tsx`）的开关来自 `useFeatureSwitches.ts`，读写的是**同一批字段**；岛上读的也是这些字段。所以去掉功能页里的开关只是少一个改它的地方，**不动 localStorage key、数据格式和事件，没有对外契约要兼容**。

### 关掉后左边菜单

已经做了：`useFeatureSwitches` 算出 `hiddenPages`（`categories.ts` 的 `FEATURE_PAGES`），`SettingsSidebar.tsx` 不列关掉的功能，AI Agent 关着时整项不显示，「功能」组最后多一行「＋ 开启更多功能」回到概览。例外：正在看的那一页照常列出；搜索时照样能搜到。回归页 `settings-sidebar` 有检查。这部分**不用改**。

### 关掉的页面还能从哪进去

- 侧栏搜索（搜索索引里现在有 7 条「启用待办 / 启用日历 …」，指向功能页）。
- 岛上的深链接（`SettingsWindow.tsx` 的 `focusRequestedSection`：翻译、音乐、日历、邮箱、Agent 连接等）。
- 侧栏里「正在看的那一页」的例外。

去掉开关后，这些情况进到一个关着的功能页，页面上得有「这个功能关着」的说明和回概览的路。

## 计划

### D64 功能页去掉启用开关，只在概览开关（一个会话）

做法：

1. `SettingsWindow.tsx` 统一判断：当前页属于一个关着的功能（用 `features.hiddenPages`），就不渲染那一页，换成一个「已关闭」页：功能页头（图标、名字、一句说明，变灰）加一句「这个功能关着，在概览里打开」和「去概览 ›」链接。功能的各个标签页都一样。
2. `FeatureHeader.tsx` 去掉 `checked` / `onChange` 和开关；页头只剩图标、名字、说明、状态胶囊（剪贴板的「按 … 打开」）、`aside`（消息的来源数）。
3. 各功能页删掉 `settings.xxEnabled &&` 这类判断和传给页头的开关（关着时已经进不来）。翻译页的快捷键组不再在关着时出现。
4. AI Agent 页：删掉 `ModuleSwitchSection`（文件一起删），换成和其他功能一样的 `FeatureHeader`；关着时 7 个标签都是「已关闭」页。
5. 文案：`settings.modules` 里只给功能页开关用的条目删掉（中英文），新增「已关闭」页的两句（中英文）。消息页仍用 `modules.mail` / `modules.hint`，保留。
6. `pnpm settings:index` 重写搜索索引（7 条「启用 XX」消失）。
7. 回归页：`settings.tsx` 里点功能页开关的检查改成在概览上关、再看功能页是「已关闭」页；`settings-search` 搜「待办」仍能到待办页。`tests/regression/settings.tsx` 正好 400 行，新检查放进新的回归页或拆出去，不让它超限。
8. 文档：`docs/design/settings.md` 第 52 行（功能页头带总开关）和第 57 行（开关放各自设置页）改成新做法，写明用户 2026-11-15 的要求；`docs/features/` 里提到「在设置页里打开 XX」的说明一起改。

认领范围（`--scope`）：`src/windows/settings/SettingsWindow.tsx`、`FeatureHeader.tsx`、`FeatureHeader.css`、`ModuleSwitchSection.tsx`、`TodosSettingsPage.tsx`、`CalendarSettingsPage.tsx`、`MusicSettingsPage.tsx`、`TranslationSettingsPage.tsx`、`ClipboardSettingsPage.tsx`、`ShelfSettingsPage.tsx`、`ScreenshotSettingsPage.tsx`、`AgentSettingsPage.tsx`、新的「已关闭」页组件、`src/windows/settings/searchIndex.json`、`src/i18n/sections/settings/`（modules 那一节）、`tests/regression/settings*.tsx`、`docs/design/settings.md`、`docs/features/`。

做完的标准：任何功能页里都没有启用开关；概览上关掉一个功能后，侧栏不列它，从搜索或深链接进去看到「已关闭」页，点「去概览」回到概览；打开后各页和原来一样。岛上的行为不变。

验证：`pnpm settings:index`、`pnpm check`、`pnpm build`、`pnpm test:regression`。

### D65 设置窗口细节完善（一个会话，和 D64 同时做）

只改概览和标签栏，不碰 D64 的文件。候选清单（用户勾选后只做选中的）：

1. 概览「消息」卡的「选择消息来源 ›」在右上角（开关的位置），别的卡的「设置 ›」在右下角，对不齐。改成也放右下角。
2. 概览「接下来」四块：窗口默认宽度下标题折行（「再看一遍新手引导」的「导」单独一行），说明折成三行、最后一行只有一两个字。调宽度或改成两行两列。
3. 「已开 9 / 9」和舞台上的「岛上开着 9 个功能」把没有开关的消息算成永远开着。改成只数有开关的功能（「已开 8 / 8」），或消息按开着的来源算。
4. 概览「开机自启动」在开发版里是禁用的（蓝底灰钮），没说明为什么点不动。加一句提示（中英文）。
5. 功能卡片关着时没有任何去设置页的入口，只能先打开。和 D64 的「已关闭」页配合：关着的卡也给一个淡一点的「设置 ›」？（默认不做，用户要再加。）
6. AI Agent 的 7 个标签在窄窗口（约 650 宽以下）放不下，横向滚动但看不出还有，「SSH 远程」被截在外面。两侧加渐隐或换行。

认领范围：`src/windows/settings/OverviewSettingsPage.tsx`、`OverviewSettingsPage.css`、`OverviewStage.tsx`、`OverviewStage.css`、`SettingsTabs.css`、`src/i18n/sections/settings/` 里 overview 那一节、`docs/design/settings.md` 里概览那几条（第 11–14 行）。回归页如果要改，新开一个 `tests/regression/settings-overview.tsx`，不碰 `settings.tsx`（D64 在改）。

`docs/design/settings.md` 两个会话都要改，但改的是不同的段落；后提交的那个先 `git diff` 看一眼，只提交自己那几行（`git add -p` 不能用时整文件提交前确认对方的改动已经提交）。

验证：`pnpm check`、`pnpm build`、`pnpm test:regression`（浅色岛对比度检查也在里面）。

## 顺序和依赖

- D64 和 D65 文件不重叠，可以同时派。
- 已有的 E36.2.8「设置窗口的分类改成插槽」、E36.2.9「分节改成插槽」（issue #431、#432，还没建任务、没人做）以后会重写 `categories.ts` 和侧栏。这次两个任务都不改 `categories.ts`、`SettingsSidebar.tsx`，不冲突；那两项开工时要知道功能页的「已关闭」页在 `SettingsWindow.tsx` 里。

## 用户的决定（2026-11-15，「按推荐开始」）

1. 关着的功能页只给「去概览 ›」链接，不放「打开」按钮；开关只在概览。
2. 消息页的 QQ、微信、邮箱三个来源开关保留在消息页。
3. D65 做清单的 1、2、3、4、6；第 5 条不做。

## 本机测不了的

- 真窗口里关掉功能后岛上的表现（隐藏入口、停后台）没变，靠用户在 `pnpm tauri dev` 里看一眼。
- Mac 上的设置窗口（`SettingsMac.css`）。
