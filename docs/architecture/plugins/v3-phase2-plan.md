# 插件平台第 3 版第 2 阶段「插槽化」：分步计划

任务 E36.2（#292），父任务 E36（#289）。主 agent 会话 2026-11-15 整理，用户 2026-11-15 确认「按建议开始」：菜单不做（第 3、4 阶段再说），第 1 阶段的两件小事放进来，内置项也包错误边界，Piral 的结论要改设计时先给用户看。做子任务的会话开工先读这份，再读 [进度](v3-progress.md)、[流程](v3-workflow.md)、[边界](v3-boundary.md)。

## 目标和做完的标志

岛屿（收起条、展开页、页头、通知）、设置窗口（分类、分节）改成插槽，去掉写死的列表（[方案](v3-everything-plugin.md)「分阶段」第 2 阶段）。**纯搬迁，零行为变化，一块界面一个提交。** 做完的标志：现有功能照常，但都经插槽注册；`pnpm test:regression` 全过，且下面「零变化怎么保证」里的 DOM 快照逐页一致；Windows、macOS 真岛各看一次，看不出变化。

## 现在写死的地方（摸底结果）

| 界面 | 写死在哪 | 现在的形状 |
|---|---|---|
| 展开页 | `src/windows/island/IslandPages.tsx` 一串 `page === "x" && <Panel/>`；`features.ts` 的 `BUILTIN_PAGE_ORDER`、`shortcutOrder()`（Alt+数字、切页）、`isPageEnabled` 里对 `qq` 的特判、`IslandFeatures` 固定类型 | 第 2 版插件页另走 `pluginPages` |
| 页头 | `IslandHeader.tsx`：左边 Agent 按钮；中间 `HEADER_DOT_PAGES`（`features.ts`）+ `PAGE_ICONS` 的圆点按钮，后面接 `PluginPageButtons`；右边设置、消息、翻译、截图、复位、最小化 / 收起 | |
| 收起条 | `collapsedBarItems.tsx`（状态灯、邮件、更新、第 2 版插件状态、设备占用、文件中转、音乐、量表、会话数，按 push 顺序）；`useCollapsedSlots.tsx`（中心图案、宠物、会话环、用量环、计时器、状态灯，带宽度）；`IslandCollapsedBar.tsx` 排版 | 已经是 `{ id, node }` 列表，最接近插槽 |
| 通知 | `NotchAlert.tsx`：设备提醒 > 额度提醒 > 音量亮度，三选一按固定优先级；`hasNotchAlert` | 消息横幅 `MessageBanner` 是单个组件，不算列表 |
| 设置分类 | `src/windows/settings/categories.ts`：`SETTINGS_CATEGORIES`、`SETTINGS_GROUPS`、`SETTINGS_TABS`、`FEATURE_PAGES`、`PAGE_FEATURES`、`MERGED_CATEGORIES`；`SettingsSidebar.tsx` 的 `CATEGORY_ICONS`；`SettingsWindow.tsx` 一串 `category === "x" && <Page/>` | 设置搜索索引 `searchIndex.json` 由 `pnpm settings:index` 按分类名生成 |
| 设置分节 | 各 `*SettingsPage.tsx` 里按顺序写死的 `<XxxSection/>` | |
| 菜单 | 岛上只有第 2 版插件的右键菜单（`features/plugins/PluginContextMenu.tsx`，已冻结）；托盘菜单在 Rust（`src-tauri/src/tray.rs`） | 见「要你定的事」第 1 条 |

第 1 阶段的插槽：`packages/plugin-base/src/client/slots.mjs` 的 `createSlots`（list / single、`order`、`max`、`perPlugin`、按 `id` 替换并记下 `replaces`、往没声明的插槽注册就抛 `no-slot`），`react.mjs` 的 `SlotItems`（每项包错误边界和 `Suspense`）；岛这边 `src/features/plugin-kernel/runtime.ts` 只在宿主启用时**异步**建注册表，`PluginSlot.tsx` 在注册表就绪前渲染 `null`，外面包 `.plugin-slot` 给主题变量。

## 关键设计（第 1 步就定死，后面的子任务照着做）

### 1. 注册表不依赖宿主，内置功能同步注册

- 每个窗口在模块加载时**同步**建一个注册表（`windowSlots("island")`、`windowSlots("settings")`），插槽定义一次性写好。内置功能的注册是同步的副作用 import（例如 `IslandPages.tsx` 顶上 `import "./slots/pages"`），首帧就有全部内置项，和现在一样。
- 宿主是否启用、有没有连上，只决定**第三方**项会不会进来：`runtime.ts` 改成往这个已有的注册表里加，不再自己建。`FUYU_PLUGINS_V3` 没开时代码路径和现在一样，只多了一次同步建表。
- 注册接口带 `owner` 参数，内置项默认 `builtin`，第三方按 `plugins.yml` 的 id；不写死，第 3 阶段内置功能变成插件后改传内置插件的 id（`timer`、`translation`），关掉插件就能撤掉它的界面（和第 3 阶段地基计划对过，2026-11-15）。
- 窗口协议第 2 阶段不动。第 3 阶段地基在窗口协议里加 `service.call`、`service.on`（只加不升 `WINDOW_PROTOCOL`），窗口一侧调服务的代理 `packages/plugin-base/src/client/services.mjs` 在 E36.2.3 合入后由地基那边写（新文件加 `client/index.mjs`、`index.d.mts` 各一行导出）。
- **冷启动不能变慢**：`createSlots` 现在和 `Slots` 服务放在一个文件里，会把 Cordis 带进首屏。第 1 步把它拆成不 import Cordis 的纯模块（例如 `@fuyu/plugin-base/client/slots` 子路径），宿主连接、加载器、Cordis 仍在 `runtime.ts` 里按需 `import()`。第 1 步前后量一次首屏 JS 体积（`pnpm build` 的产物）和冷启动，记进任务文件。
- 内置组件现在就是静态 import 的，搬进注册模块后仍是静态 import，不改成懒加载（那是行为变化，留到第 3 阶段）。

### 2. 渲染：内置项不加包裹层

- `.plugin-slot` 包裹层（`display: contents`）对 `>` 子选择器、`:first-child`、`gap` 计数都有影响。内置项直接平铺渲染，只有第三方项包 `.plugin-slot` 拿主题变量。
- 每项照规则包错误边界：内置项出错时 `console.error` 并只撤这一项（现在会把整个岛白屏）。这是唯一的「行为变化」，只在出错时可见，见「要你定的事」第 3 条。
- 插槽项除了 `component` 还可以带元数据（`order`、图标、快捷键顺序、是否在页头出圆点、宽度、是否启用的判断、所属设置分组……），由插槽定义写明有哪些字段。组件收到的 props 由宿主窗口传（例如展开页把现在 `IslandPagesProps` 那一包整体传进去），这些 props 在第 2 阶段是**实验接口**，只给内置项用，第三方插件在第 5 阶段之前不承诺。

### 3. 插槽名和规则（第 1 步一次性定义并登记）

| 插槽 | 种类 | 顺序 | 每插件上限 | 最多显示 / 超出 | 元数据 |
|---|---|---|---|---|---|
| `island.page/v1` 展开页 | list | 页顺序（现 `BUILTIN_PAGE_ORDER`）| 2 | 不限，页头圆点另有上限 | 图标、`shortcutOrder`（Alt+数字顺序）、`headerDot`、`enabled(features)`、回退页 |
| `island.header/v1` 页头右侧按钮 | list | 现在从左到右 | 1 | 按现有 | `enabled` |
| `island.collapsed/v1` 收起条 | list | 现 push 顺序；用户的「收起条布局」照旧覆盖 | 2 | 按现有布局规则 | `group`（`gauges`）、宽度、可隐藏的 id |
| `island.collapsed-center/v1` 中心图案 | single | — | 1 | 1 | 宽度 |
| `island.alert/v1` 刘海提醒 | list，只显示第一个有内容的 | 设备 > 额度 > 音量亮度 | 1 | 1 | `active(sources)` |
| `settings.category/v1` 设置分类 | list | 现 `SETTINGS_GROUPS` 顺序 | 2 | 不限 | 分组、图标、子页（tabs）、`available(...)`、所属功能开关、合并的旧名 |
| `settings.section/v1` 设置分节 | list，按 `category` 分组 | 现在页面里的顺序 | 4 | 不限 | `category` |
| `island.dev/v1` | 保留第 1 阶段的开发插槽 | | | | |

（菜单的插槽等「要你定的事」第 1 条定了再加。）名字带 `/v1`，规则做不兼容的修改时出 `/v2`。插槽定义只有一处（`src/features/plugin-kernel/` 下的定义文件），第 1 步写好，之后的子任务**不改定义文件、不改契约文档**，免得多个会话撞同一个文件；要改规则先找主 agent。

### 4. 契约怎么登记

- `docs/architecture/plugins/v3-boundary.md` 加一节「插槽」：上表（名字、种类、顺序、上限、元数据、组件拿到的 props 是否实验接口）和「替换」「出错隔离」「没声明的不生效」的行为。
- `docs/architecture/contracts.md` 第 3 版那一条后面加一句：插槽名单和规则见 v3-boundary.md「插槽」，名字带版本、只加不改，第 2 阶段的 props 属实验接口。
- 两处都在第 1 步（E36.2.3）的提交里改。

### 5. 零变化怎么保证

- 现有回归页照跑：和这些界面相关的有 `collapsed-slots`、`collapsed-message-animation`、`bottom-island`、`side-island`、`notch-island`、`message-banner`、`session-ring`、`claude-usage`、`center-pattern`、`update-reminder`、`settings`、`settings-sidebar`、`settings-search`、`plugin-slot`、`plugins-v3`、`i18n`。
- **加一道 DOM 快照比对**（E36.2.2）：回归页跑完断言后，把页面根节点的 `outerHTML` 规范化（去掉随机 id、时间）存成快照；先在改动前的 `main` 上生成一次基线并提交，之后每个子任务提交前都比一次，必须逐字一致。插槽化本该一个 DOM 节点都不变，这比截图比对更严格、也不受字体渲染影响。
- 单元测试：`features.ts` 的顺序、快捷键、回退规则（`island-window.test.mjs`、`plugin-pages.test.mjs`）、`settings-search.test.mjs` 不改断言，只改 import 路径；改了断言就说明行为变了。
- 每个子任务做完列进 `v3-progress.md`「待人工验收」，最后两台机器各看一次真岛。

## 子任务、顺序和文件

编号是 E36.2 的子任务。**scope 是认领时写的 `--scope`**，两个会话不碰同一个文件。所有会话：前端验证 `pnpm check` + `pnpm build` + `pnpm test:regression`（含 DOM 快照比对）。

### 阶段 A：可以并行（2 个会话）

| 编号 | 内容 | scope | 做完的标志 |
|---|---|---|---|
| E36.2.1 | **Piral 调研**：它的 extension slot（`registerExtension`、`<ExtensionSlot>`、参数、空状态、排序、`renderEmpty`）、pilet 加载、共享依赖、错误边界，哪些能直接用、哪些借思路、哪些不合适；和 `createSlots` 逐项对比 | `docs/research/piral.md` | 调研文档按 `docs/research/README.md` 的格式写好；结论里写明对上面「关键设计」要不要改，有要改的告诉主 agent 再开 E36.2.3 |
| E36.2.2 | **DOM 快照比对**：回归页运行器加快照存取和比对；在当前 `main` 上生成基线 | `scripts/run-regression.mjs`（**等 D54 把它提交后再动**，现在工作区里有 D54 没提交的改动）、新的快照目录 `tests/regression/snapshots/`、`tests/regression/` 下需要加快照钩子的页面（只加钩子，不改断言） | `pnpm test:regression` 默认比对快照，`--update-snapshots` 重写；基线提交；故意改一个 class 能报出差异 |

### 阶段 B：一个会话独占（等 E36.2.1 的结论）

| 编号 | 内容 | scope | 做完的标志 |
|---|---|---|---|
| E36.2.3 | **插槽核心**：`createSlots` 拆成不 import Cordis 的纯模块并补规则（名字必须带 `/vN`、按 `category` 分组的列表、`replaces` 列表、builtin 拥有者、元数据透传）；每个窗口同步建的注册表 `windowSlots()`；全部插槽定义；内置用的渲染组件（不加包裹层、每项错误边界）和类型化的 `defineSlot<Props, Meta>`；`runtime.ts` 改成往已有注册表里加；契约登记 | `packages/plugin-base/src/client/`、`packages/plugin-base/package.json`、`packages/plugin-base/src/protocol.mjs`、`protocol.d.mts`（只加插槽名单和规则常量 `SLOTS`，纯数据，给第 5 阶段的 `fuyu-plugin build` / `check` 离线检查用；组件和元数据的类型仍在 `src/features/plugin-kernel/`）、`packages/plugin-base/src/index.d.mts`（只改 `ctx.slots`，第 3 阶段地基之后在这里加 `ctx.services` / `ctx.rust`）、`packages/plugin-base/test/slots.test.mjs`、`src/features/plugin-kernel/`、`docs/architecture/plugins/v3-boundary.md`、`docs/architecture/contracts.md`、`tests/unit/plugin-slot-theme.test.mjs` | 包里的测试覆盖每条规则；岛的首屏 JS 不含 Cordis（构建产物里查得到）、体积和冷启动前后对比记进任务；`plugin-slot` 回归页照过；第 1 阶段演示插件照常出现 |

- E36.2.3 开工先 `pnpm mq:sync` 拿最新的 main：第 3 阶段地基的 E36.3.3 会把 `protocol.mjs` / `.d.mts` 的 `HOST_PROTOCOL` 改成 2，那一行别改回去；E36.2.3 只在同文件里加 `SLOTS`（2026-11-15 经理转告）。

- 派子会话一律用 `effort: xhigh`（2026-11-15 用户：「关于插件的会话模型强度都改为 xhigh」，经理转告）。

### 阶段 C：按界面并行（E36.2.3 合入后再派；同时最多 2 个会话，F40 起重命令一律 `pnpm heavy` 排队，整批 land 同一时间只跑一个）

| 编号 | 内容 | scope | 依赖 | 做完的标志 |
|---|---|---|---|---|
| E36.2.4 | 收起条 | `src/windows/island/collapsedBarItems.tsx`、`useCollapsedSlots.tsx`、`IslandCollapsedBar.tsx`、新 `src/windows/island/slots/collapsed.tsx` | E36.2.3 | `collapsedBarItems` 的 push 列表没了，各项经 `island.collapsed/v1`、`island.collapsed-center/v1` 注册；收起条布局设置照旧生效 |
| E36.2.5 | 展开页 | `src/windows/island/IslandPages.tsx`、`features.ts`、新 `src/windows/island/slots/pages.tsx`、`tests/unit/island-window.test.mjs`、`tests/unit/plugin-pages.test.mjs`（只改 import） | E36.2.3 | `BUILTIN_PAGE_ORDER`、`shortcutOrder`、`HEADER_DOT_PAGES` 的数据改由页面项提供，`features.ts` 只剩按注册表算的函数；`IslandFeatures` 固定类型改成按页面 id 的开关表（单独一个提交，见下） |
| E36.2.6 | 页头按钮 | `src/windows/island/IslandHeader.tsx`、`PluginPageButtons.tsx`、新 `src/windows/island/slots/header.tsx` | E36.2.5（圆点按钮的数据来自页面项） | `PAGE_ICONS`、`HEADER_DOT_PAGES` 的用法去掉，右侧按钮经 `island.header/v1` |
| E36.2.7 | 刘海提醒 | `src/windows/island/NotchAlert.tsx`、新 `src/windows/island/slots/alerts.tsx`、`notch.ts` 里只碰 `hasNotchAlert` 相关 | E36.2.3 | 三种提醒经 `island.alert/v1`，优先级由 `order` 决定；`notch-island` 回归页和快照一致 |
| E36.2.8 | 设置分类 | `src/windows/settings/categories.ts`、`SettingsSidebar.tsx`、`SettingsWindow.tsx`、`LayoutEditor.tsx`、新 `src/windows/settings/slots/categories.tsx`、`tests/unit/settings-search.test.mjs` | E36.2.3 | 侧栏、分组、子页、功能开关、平台可用性、旧名合并都来自 `settings.category/v1`；`pnpm settings:index` 跑出来的 `searchIndex.json` 和现在一字不差（不提交它，只核对） |
| E36.2.9 | 设置分节 | 只有一串分节的页面：`GeneralSettingsPage`、`BehaviorSettingsPage`、`AppearanceSettingsPage`、`TodosSettingsPage`、`CalendarSettingsPage`、`ShelfSettingsPage`、`TranslationSettingsPage`、`ScreenshotSettingsPage`、`ClipboardSettingsPage`、`ShortcutsSettingsPage`、Agent 的几页，加新 `src/windows/settings/slots/sections.tsx` | E36.2.3 | 这些页面的分节经 `settings.section/v1`。**`MusicSettingsPage`、`MessagesSettingsPage`、`ThemeSettingsPage`、`AboutSettingsPage` 现在有别的会话在改**（C63、C66、C33.9、D54），等它们提交后在 E36.2.9 的第二个提交里补 |

- 阶段 C 的会话**都不改 `IslandApp.tsx`**（C63、D36 正在改它）：注册模块由被替换的那个组件文件顶上 import，`IslandApp` 里的调用签名不变。
- `tests/regression/settings.tsx`、`settingsMocks.ts`、`collapsed-message-animation.tsx` 现在有别的会话没提交的改动；需要动它们的子任务先 `git status` 看，有改动就等对方提交。
- `G1.3`、`G1.11`（Mac 适配）声明了整个 `src/` / `src/windows/island/`，是长期的宽范围认领；开工前 `pnpm tasks conflicts`、`git status` 看具体文件，不撞文件就照做。
- E36.2.5 里「`IslandFeatures` 固定类型改成开关表」和搬迁分开提交：先搬列表（零变化），再改类型（类型层面的改写，运行时仍零变化）。

### 阶段 D：收口（主 agent）

看每个子任务的 diff 和提交；更新 `v3-progress.md`（阶段表、测试规模、待人工验收、风险「改动面大」）、`overview.md`、`src/AGENTS.md` 的目录地图（新的 `slots/` 目录）、`platforms.md`（预期不变，核对一次）；核对 #292 和子 issue 都已回复并关闭；两台机器各看一次真岛。

## 第 1 阶段留下的小事

| 事 | 建议 |
|---|---|
| 插件页「内存」显示工作集（含共享页，Windows 约 68 MB），验收按私有工作集（约 25 MB） | **放进来**，单独一个子任务 E36.2.10，和阶段 C 并行：改成显示私有工作集（Windows）/ `phys_footprint`（macOS），标签写清口径。scope：`src-tauri/src/plugin_kernel/` 里读进程内存的部分、`src/windows/settings/PluginsV3SettingsPage.tsx`、对应 i18n。只能在 Windows 上测准的部分列进实测清单 |
| 安全模式缺「启动时按 Shift」「连续两次启动失败自动进入」 | **放进来但单独做**，E36.2.11，Rust 为主（`src-tauri/src/plugin_kernel/`），和前端完全不撞，随时可以派。和 E36.2.10 都碰 `plugin_kernel/`，两个排先后或交给同一个会话 |

## 要开的 issue

- 第 2 阶段自己的 issue **已经有了：#292**（任务文件 `issue: 292`），不用再建；开工时在 #292 下回复这份计划的链接。
- 子任务的 issue：E36.2.1 #424、E36.2.2 #425、E36.2.3 #426、E36.2.4 #427、E36.2.5 #428、E36.2.6 #429、E36.2.7 #430、E36.2.8 #431、E36.2.9 #432、E36.2.10 #433、E36.2.11 #434。

## 要你定的事

1. **「菜单」指哪个**：岛上现在唯一的菜单是第 2 版插件的右键菜单（冻结，第 6 阶段随第 2 版删）；托盘菜单在 Rust。建议：**第 2 阶段不做菜单**——托盘菜单要宿主经 Rust 加菜单项，放到第 3 阶段和 Rust 能力的提供者一起做；岛上的右键菜单、剪贴板行动作、截图后动作是第 4 阶段的接缝。备选：第 2 阶段在岛上加一个空的 `island.menu/v1` 定义，先占名字。
2. **第 1 阶段的两件小事放不放进来**（见上表，建议都放、单独并行）。
3. **内置项也包错误边界**：一个内置页面渲染出错时，现在整个岛白屏，改后只有那一项消失（并打日志）。建议接受，这是方案要求的「出错隔离」，只在出错时可见。
4. **Piral 的结论如果建议换实现**（例如直接用它的 extension slot 代替 `createSlots`），是否允许在 E36.2.3 前改「关键设计」。建议：允许，但要先回来给你看。
