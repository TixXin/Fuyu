# 插件平台第 3 版第 4 阶段「接缝」：分步计划

任务 E36.4（#294），父任务 E36（#289）。**状态：已完成（E36.4.1–E36.4.9 全部完成，待真岛验收）**（2026-11-17）。

第 3 阶段（E36.3）把 `src/features/` 的各个领域原样迁成了内置插件，并建起了宿主 `ctx.services` 与窗口 `windowServices` 两套同构的服务表。第 4 阶段在此基础上，把 7 项核心能力做成**可替换、可扩展的接缝（Seam = 接口定义 + 提供者 + 使用者）**，并补齐**服务冲突时的启用选择、替换关系展示、内置插件缺依赖超时提醒**。

开工前先读这份计划，再读 [进度](v3-progress.md)、[流程](v3-workflow.md)、[服务契约](v3-services.md)、[内置插件](v3-builtins.md)、[边界](v3-boundary.md)。

---

## 一、目标和做完的标志

来自 #294 和 [方案](v3-everything-plugin.md)「服务的替换和冲突」「分阶段」：

1. **7 项能力全部做成接缝**：翻译引擎、歌词来源、日历来源、AI 代理接入、剪贴板动作、截图后动作、消息来源。
2. **每个接缝都满足「写一个插件就能换掉或扩充内置实现」**：使用者只调服务或读接缝注册表，不绑死内置实现。
3. **服务冲突在启用时选择**：两个插件提供同一个服务时，在启用时提示用户选一个（停用另一个或停用其冲突服务），不等运行时报 `failed`；插件页显示「谁替换了什么」，可一键恢复内置提供者。
4. **缺依赖不静默消失**：内置插件启动 10 秒后仍处于 `waiting`（等待某个服务）时，在岛上给出提示并引导去插件页处理。
5. **双端验收**：每个接缝有自动化测试（含用一个测试插件换掉内置实现的端到端测试），Windows 和 macOS 真岛各验收一次。

---

## 二、现状摸底（第 3 阶段末基线）

盘点第 3 阶段完成后的代码，7 项能力的现状如下：

| 接缝 | 现有服务 / 插槽 | 现在的提供者与使用者 | 还差什么才算「可替换接缝」 |
|---|---|---|---|
| **1. 翻译引擎** | `translator/v1`（`translate`、`rewrite`、`engines`） | `translation` 插件提供；翻译窗口、岛上翻译页、剪贴板 AI 改写、截图翻译调它 | ① `builtins.json` 和 `package.json` 还没标 `provides: ["translator/v1"]` 参与启用冲突选择；② 外部插件只能整套换掉 `translator/v1`，还不能只往内置翻译里**多加一个翻译引擎**（如 DeepL、本地 Ollama）而复用现有翻译窗口与改写界面 |
| **2. 歌词来源** | 尚无 `lyrics/v1`（目前只有 `media/v1` 管播放状态与控制） | `src/features/media/lyrics/useLyrics.ts` 直接调 Tauri 命令 `get_lyrics`（Rust 读本地 `.lrc`、网易云、QQ 音乐、LRCLIB） | 歌词查询还绑在 `media/lyrics/api.ts` 的 `invoke("get_lyrics")` 上，没有抽成 `lyrics/v1` 服务；插件既换不掉歌词实现，也加不了新的歌词源 |
| **3. 日历来源** | `calendar/v1`（`events`、`sources`） | `calendar` 插件提供（Rust 拉取 ICS 订阅与 CalDAV）；岛上日历页、会议倒计时调它 | 日历页 `CalendarPanel` 仍直接调 `getCalendarEvents` 命令而非 `calendar/v1`；外部插件还不能作为新增的日历源（例如飞书日历、Google Calendar OAuth、本地日程）把日程汇入 `calendar/v1` |
| **4. AI 代理接入** | `agents/v1`（`sessions`、`usage`、`focus`、`remoteHosts`） | `agents` 插件提供；会话环、用量环、中心图案、截图「发给 Agent」调它 | 现有的会话来源（Claude、Codex、Gemini 等）和用量来源写死在 Rust `agent_status` 与前端设置里；外部插件还不能经标准服务接口往 `agents/v1` 贡献新的 Agent 会话流、额度卡片或窗口聚焦器 |
| **5. 剪贴板动作** | `clipboard/v1`（只有 `history` 读最近文本） | `clipboard` 插件提供；剪贴板弹窗 `ClipboardActionPanel` 的动作列表在 `popupActions.ts` 里写死 | 弹窗 `Ctrl+K` 动作面板和条目右键/快捷动作是写死的数组；插件没法往剪贴板条目上注册自定义动作（如「发到飞书」「Base64 解码」「上传图床」），也没法拿到当前选中条目的文本并写回/粘贴 |
| **6. 截图后动作** | 无独立动作表（截图通知卡片调 `file-shelf/v1`、`agents/v1`、`translator/v1`） | `ScreenshotNotice.tsx`、`useScreenshotNotice.ts`、`ScreenshotToolbar.tsx` 写死了「加进中转、发给 Agent、翻译」几个按钮 | 调用方虽然走了服务，但「截图完成后有哪些动作按钮」本身是写死的，插件不能往截图完成卡片或选区工具栏上加一个新动作（如「贴到笔记」「OCR 提取表格」「上传图床」） |
| **7. 消息来源** | `messages` 插件（内部 `island-notices` 窗口服务只给第 2 版插件用） | 邮箱（`qqMail`）、QQ（`qq`）、微信（`wechat`）三个来源硬编码在 `Messages.tsx`、`MessagesSettingsPage.tsx` 和 `messagesIsland` 状态里 | 第 3 阶段按计划把三个来源先合在一个 `messages` 插件里迁了；它们的未读状态、到达卡片、来源切换标签和设置分节还没抽成统一的「消息来源」契约 |

---

## 三、关键设计

### 1. 接缝的两种形态：既能「整体换掉」，也能「多加一个来源/动作」

7 个接缝按性质分为两类，用同一套服务机制覆盖：

| 形态 | 适用接缝 | 怎么做 |
|---|---|---|
| **A. 服务整体替换**（1 对 1） | 全部 7 个领域的核心服务（`translator/v1`、`lyrics/v1`、`calendar/v1`、`agents/v1`、`clipboard/v1`、`messages/v1`） | 内置插件在 `builtins.json` 的 `provides` 中声明自己提供的服务名；第三方插件在 `package.json` 的 `fuyu.provides` / `fuyu.replaces` 中声明。换掉内置提供者时，使用者经 `windowServices.get(...)` / `ctx.services.get(...)` 自动调到新提供者 |
| **B. 来源 / 动作贡献**（多对 1 汇聚） | 翻译引擎、歌词来源、日历来源、AI 代理来源、剪贴板动作、截图后动作、消息来源 | 在对应核心服务（或配套扩展服务）上提供受管的 `register*`（宿主插件经服务调用登记，窗口插件经窗口服务表登记，插件停用时自动撤销）。核心服务把内置来源和各插件贡献的来源/动作汇总后交给界面，使用者不用关心来源有几个 |

这样一来：
- 想**彻底换掉**内置日历或内置翻译的插件，直接 `provides: ["calendar/v1"]`、`replaces: ["calendar/v1"]`；
- 只想**多加一个**翻译引擎、一个歌词源、一个剪贴板动作、一个截图后动作、一个消息来源（比如 Telegram / 飞书提醒）的插件，只需注册那一个来源或动作，不用把整个日历页或剪贴板弹窗重写一遍。

### 2. 服务冲突与启用时选择（`provides` / `replaces`）

按 [方案](v3-everything-plugin.md)「服务的替换和冲突」与 [v3-services.md](v3-services.md)「替换和冲突」：

1. **内置插件补齐 `provides` 声明**：在 `src/features/builtins.json` 里为提供公开服务的内置插件补上 `provides` 字段（例如 `translation` → `["translator/v1"]`，`timer` → `["timers/v1", "reminders/v1"]`，`calendar` → `["calendar/v1"]`，`music` → `["media/v1", "lyrics/v1"]` 等）。
2. **启用前静态冲突检查**：
   - Rust 的开关表与插件配置管理（`src-tauri/src/plugin_kernel/`）读取所有已启用内置插件的 `provides` 和已安装第三方插件 `package.json` 的 `fuyu.provides` / `fuyu.replaces`。
   - 当用户在设置 → 插件页打开某个插件（或安装后启用）时，若它声明的 `provides` 与当前已启用的另一个插件重合：
     - 若新插件声明了 `replaces` 包含该服务，或用户在弹窗中确认「用 `<新插件>` 替换 `<旧插件>` 的 `<服务名>`」，则原子地将该服务的拥有权切给新插件（若旧插件只提供这一个功能，自动停用旧插件；若旧插件还管别的部分，在 `plugins.yml` 记录 `disabledServices: ["lyrics/v1"]`，让旧插件跳过该服务的 `provide`）。
     - 插件页在条目上显示「**已替换 `translation` 的 `translator/v1`**」，被替换的内置插件显示「**由 `@someone/deepl` 接管**」并提供「恢复内置」按钮。
3. **窗口服务与宿主服务同步优先级**：
   - 当第三方宿主插件替换了某个内置服务（如 `translator/v1`）时，窗口里的内置提供者随之让出（按开关表或 `disabledServices` 停用本窗口的内置提供者），使 `windowServices.get(translatorV1)` 自动走 WebSocket 调到宿主里的新提供者。

### 3. 内置插件缺依赖超时（`waiting` 超过 10 秒）提醒

- 宿主和窗口的插件状态视图已能拿到 `state === "waiting"` 和 `waitingFor: ["..."]`。
- 插件页对 `waitingFor` 给出三种明确解释（[v3-services.md](v3-services.md)「状态视图」）：
  1. 「`timer` 插件提供 `timers/v1`，但它已停用」→ 配「打开 `timer`」按钮；
  2. 「提供 `timers/v1` 的插件启动出错或被安全模式拦下」→ 配跳转链接；
  3. 「没有已启用的插件提供 `timers/v1`」。
- 内置插件启动后若连续 **10 秒** 仍处于 `waiting`，通过 `island.notice/v1` 在岛上弹一条非打扰提示：「内置功能 `<名>` 正在等待服务 `<服务>`」，点击直达设置 → 插件（第 3 版）页。

---

## 四、7 个接缝的具体设计

### 接缝 1：翻译引擎（`translator/v1`）

- **整体替换**：任何插件声明 `provides: ["translator/v1"]`、`replaces: ["translator/v1"]` 即可整体接管翻译窗口、岛上翻译页、剪贴板 AI 改写与截图翻译；同时把翻译窗口 `TranslationWindow` 和岛上翻译面板 `TranslationPanel` 里直接调 `api.ts` 的 `translateText` 改为统一调 `windowServices.get(translatorV1)`。
- **新增引擎扩展**：`translator/v1` 新增受管方法或配套服务 `translator.engines/v1`：
  - 插件可注册自定义引擎 `{ id, label: { "zh-CN", en }, models?: string[], translate(params), rewrite?(params, caller) }`；
  - `translator/v1.engines()` 返回内置 4 个引擎 + 已注册的插件引擎；翻译设置的「翻译服务」下拉框自动列出插件引擎，选中后 `translate` / `rewrite` 路由到对应插件。

### 接缝 2：歌词来源（`lyrics/v1`）

- **声明 `lyrics/v1` 服务**（放入 `@fuyu/plugin-services`）：
  - 方法：`lookup({ title, artist, album?, durationMs?, trackId?, chinese? })` → `{ lrc: string; translation?: string; source: string } | null`；`sources()` → `{ sources: { id, name }[] }`。
- **提供者与使用者解耦**：
  - 内置 `music` 插件在宿主和窗口提供 `lyrics/v1`（底层调 Rust 的 `lyrics.lookup`，涵盖本地 `.lrc`、InfLink、网易云、QQ、LRCLIB）；
  - `src/features/media/lyrics/useLyrics.ts` 改为调 `windowServices.get(lyricsV1).lookup(...)`，不再直接调 Tauri 命令 `get_lyrics`；
  - 第三方插件既可以整体替换 `lyrics/v1`，也可以通过歌词源扩展注册新的在线/本地歌词提供者（按优先级参与回退查找）。

### 接缝 3：日历来源（`calendar/v1`）

- **使用者全面改走服务**：岛上日历页 `useCalendar.ts` 从直接调 `api.ts` 的 `getCalendarEvents` / `listCalendarSources` 改为调 `windowServices.get(calendarV1)`，确保换掉 `calendar/v1` 提供者时日历页和收起条会议倒计时一起切换。
- **多来源汇总**：
  - 开放日历来源注册接口（插件提供 `{ id, name, host, fetchEvents({ fromMs, toMs, refresh }) }`）；
  - 内置 `calendar` 服务将 Rust 的 ICS/CalDAV 日程与各插件来源返回的日程按时间合并去重，单个插件来源出错记入 `problems`，不拖垮整页。

### 接缝 4：AI 代理接入（`agents/v1`）

- **外部会话与额度提供者**：
  - 在 `agents/v1` 上开放会话来源与额度来源贡献接口：插件可以上报或提供外部 AI 代理的会话列表（`{ provider, sessionId, title, cwd, phase, light, updatedAt }`）、自定义窗口聚焦处理函数（`focus`），以及自定义额度数据（`usage`）；
  - 这样新接入一家编辑器或云端 Agent 时，既可以写成内置接入，也可以完全由一个独立的第 3 版插件提供，自动出现在 Agent 页、收起条会话环和用量环里。

### 接缝 5：剪贴板动作（`clipboard/v1` + 动作接缝）

- **扩充 `clipboard/v1` 与动作注册表**：
  - `clipboard/v1` 增加安全的操作方法：`copyText({ text })`、`pasteText({ text })`（供动作插件把处理后的结果写回剪贴板或直接粘贴到前台窗口）；
  - 新增剪贴板动作接缝（`clipboard.actions/v1`）：每项动作声明 `{ id, title: { "zh-CN", en }, icon?, keywords?, match?: (item: { kind, text?, truncated? }) => boolean, run(item) }`；
  - 内置的转换动作与插件注册的动作统一汇总进剪贴板弹窗 `Ctrl+K` 面板（`ClipboardActionPanel`）和岛上剪贴板页，按 `order` 与搜索词过滤。

### 接缝 6：截图后动作（`screenshot/v1` 动作接缝）

- **把写死的后处理按钮抽成动作接缝**：
  - 定义截图后动作注册表（`screenshot.actions/v1`），上下文传入 `{ path, width, height, text? }`（截图文件路径、尺寸及 OCR 识别出的文字）；
  - 内置的三个联动动作（「放进文件中转」调 `file-shelf/v1`、「发给 Agent」调 `agents/v1`、「翻译」调 `translator/v1`）改用同一套动作注册接口实现；
  - 第三方插件注册的截图后动作自动出现在截图完成通知卡片（`ScreenshotNotice`）和截图历史面板的操作栏中，对应插件关闭时按钮自动消失。

### 接缝 7：消息来源（`messages/v1`）

- **把邮箱、QQ、微信三个来源改造成标准消息来源接缝**：
  - 定义 `messages/v1` 服务与消息来源契约 `{ id, title, icon, unreadCount, pending, arrivals, open(), clearAll?(), component? }`；
  - 内置的 `qqMail`、`qq`、`wechat` 拆为三个独立的内部来源模块注册到 `messages` 中（按各自开关起停）；
  - 外部插件可以通过 `messages/v1` 推送结构化到达消息（带操作按钮，替代第 2 版的 `plugin-notification` 私有桥），也可以注册一个新的消息来源标签页进岛上消息面板，或替换内置的某个消息来源。

---

## 五、子任务拆分与先后顺序（E36.4.1–E36.4.9）

按「先做冲突与替换机制底座，再并行推进 7 个接缝，最后端到端验收」排成两批：

### 第 0 批：服务替换与冲突机制

| 编号 | 内容 | `--scope` | 依赖 | 编译 |
|---|---|---|---|---|
| **E36.4.1** | **服务替换、启用冲突选择与缺依赖提醒**：`builtins.json` 补齐 `provides`；开关表支持 `disabledServices`（只停用冲突的那项服务而不必关掉整个内置插件）和启用时冲突检测命令；当第三方插件替换某项服务时，窗口内同名内置服务自动让出，改走宿主 WebSocket；插件页显示「谁替换了什么」「在等哪个服务」及冲突选择弹窗；内置插件 `waiting` 超 10 秒在岛上提示 | `packages/plugin-base/`、`src-tauri/src/plugin_kernel/`、`src/features/builtins.json`、`src/features/plugin-kernel/`、`src/windows/settings/PluginsV3SettingsPage.tsx`、`src/windows/settings/BuiltinPluginsGroup.tsx`、对应 i18n 与测试 | E36.3.23, E36.3.27 | 要 |

### 第 1 批：7 个接缝（互不重叠，可并行推进）

| 编号 | 接缝 | 要点 | `--scope` | 依赖 | 编译 |
|---|---|---|---|---|---|
| **E36.4.2** | **翻译引擎接缝** | 翻译窗口与岛上翻译页统一改调 `translator/v1`；支持插件注册自定义翻译引擎并出现在翻译设置下拉框，也支持整体替换 `translator/v1` | `packages/plugin-services/src/services/translator.*`、`src/features/translation/`、`src/windows/translation/`、`tests/unit/translation*` | E36.3.29 | 否 |
| **E36.4.3** | **歌词来源接缝** | 新增 `lyrics/v1` 服务与 Rust `#[host_service("lyrics.lookup")]`；`useLyrics.ts` 改调 `lyrics/v1`；支持插件注册额外歌词来源或整体替换 `lyrics/v1` | `packages/plugin-services/src/services/lyrics.*`、`src-tauri/src/lyrics/`、`src/features/media/lyrics/`、`src/features/media/host/`、`tests/unit/lyrics*` | E36.3.33 | 要 |
| **E36.4.4** | **日历来源接缝** | `useCalendar.ts` 改调 `calendar/v1`；支持插件向 `calendar/v1` 注册自定义日历来源并合并日程，或整体替换 `calendar/v1` | `packages/plugin-services/src/services/calendar.*`、`src/features/calendar/`、`tests/unit/calendar*` | E36.3.30 | 否 |
| **E36.4.5** | **AI 代理接入接缝** | `agents/v1` 支持插件贡献外部会话列表、窗口聚焦器与额度来源；会话环、用量环与 Agent 页无感汇总 | `packages/plugin-services/src/services/agents.*`、`src/features/agent-status/`、`tests/unit/agents*` | E36.3.37 | 否 |
| **E36.4.6** | **剪贴板动作接缝** | `clipboard/v1` 补 `copyText` / `pasteText`；开放剪贴板动作注册表，接入弹窗 `ClipboardActionPanel` 与剪贴板页 | `packages/plugin-services/src/services/clipboard.*`、`src-tauri/src/clipboard/`、`src/features/clipboard/`、`tests/unit/clipboard*` | E36.3.34 | 要 |
| **E36.4.7** | **截图后动作接缝** | 开放截图后动作注册表；把「加进中转、发给 Agent、翻译」迁为内置注册项，支持插件往截图通知卡片和历史面板加动作 | `packages/plugin-services/src/services/screenshot.*`、`src/features/screenshot/`、`tests/unit/screenshot*` | E36.3.35 | 否 |
| **E36.4.8** | **消息来源接缝** | 新增 `messages/v1`；把邮箱、QQ、微信三个来源抽成标准消息来源注册项；支持插件推送到达通知、注册新消息来源或替换内置来源 | `packages/plugin-services/src/services/messages.*`、`src/features/messages/`、`tests/unit/messages*` | E36.3.44 | 否 |

### 第 2 批：收口与双端验收

| 编号 | 内容 | `--scope` | 依赖 |
|---|---|---|---|
| **E36.4.9** | **第 4 阶段收口**：集成测试（用一组示例插件逐一替换/扩展 7 个接缝并验证冲突提示与恢复）、更新 `v3-services.md` / `v3-progress.md` / `contracts.md`、Windows 与 macOS 真岛验收 | `tests/unit/`、`tests/regression/`、`docs/architecture/plugins/` | E36.4.2–E36.4.8 |

---

## 六、要你定的事

| # | 事项 | 推荐做法 | 备选与代价 |
|---|---|---|---|
| 1 | **接缝是只做「整体替换服务」，还是同时支持「往内置功能里多加一个来源/动作」？** | **两边都支持**（第三节设计 1）：整体替换靠 `provides` / `replaces`；同时在 7 个接缝上开放轻量级的「注册一个引擎/来源/动作」入口 | 只做整体替换：外部作者想加一个 DeepL 翻译引擎或一个剪贴板动作，就得把整个翻译界面或剪贴板动作面板重写一遍，实用性大打折扣 |
| 2 | **当第三方插件替换内置插件的某项服务时（如只换掉 `music` 里的 `lyrics/v1`），内置插件怎么处理？** | **只停用内置插件冲突的那一项服务（`disabledServices`）**，不关掉整个内置插件（音乐播放控制 `media/v1` 和音乐页照常运行）；如果内置插件只有这一项功能，也可以提示用户直接关掉内置插件 | 冲突时一律关掉整个内置插件：换个歌词源会把整个音乐播放器也关掉，不符合预期 |
| 3 | **消息来源（邮箱、QQ、微信）在第 4 阶段是做成 `messages` 插件下的三个可开关来源，还是拆成 3 个独立的内置插件？** | **保持插件页里是一个「消息」内置插件**，把邮箱、QQ、微信抽成 `messages/v1` 接缝下的三个内置来源（各自有开关，第三方插件可新增第 4 个来源或按 `id` 替换其中一个） | 拆成 3 个独立内置插件（`mail`、`qq`、`wechat`）：插件页从 22 个变成 24 个（Mac 上还多出两个不支持的插件条目），而且第 3 阶段刚把开关存进 `messages` 的 `config: { mail, qq, wechat }`（E36.3.44），再拆又要做一次配置迁移 |
| 4 | **`tauri-cordis` 公开发布的时机** | **等第 3 阶段收口（`E36.3.50`）或第 4 阶段做完后一起对外建仓**（现在四项条件和名字 `tauri-cordis` 都已就绪，随时可发，但对外建 GitHub 仓库和发 npm 包前先问你） | 现在立刻对外建 `TixXin/tauri-cordis` 仓库：也可以，只要你点头 |

---

## 七、收口总结（2026-11-17）

1. **服务替换与等待诊断（E36.4.1）**：`src/features/builtins.json` 补齐全部内置服务提供者的 `provides`；宿主 `builtins.mjs` 与 `services.mjs` 支持 `disabledServices` 与 `replaces`（仅让出冲突的那项服务而不停掉整个内置插件，如 `music` 让出 `lyrics/v1` 时 `media/v1` 照常运行）；窗口 `createWindowServices` 在宿主有非同名拥有者提供同一服务或设了 `setDisabledServices` 时自动让出给宿主，恢复后自动切回；插件设置页展示「谁替换了什么」与 `waitingFor` 三种原因说明；主窗口内置插件 `waiting` 超 10 秒通过 `island-notices/v1` 弹提示。
2. **7 个接缝全部落地并经端到端测试验证（E36.4.2–E36.4.9）**：
   - **翻译引擎接缝（E36.4.2）**：`translator/v1` + `ctx.translatorEngines` / `registerTranslationEngine`，翻译主面板、独立翻译窗口、选区浮条与设置页统一走 `translator/v1`。
   - **歌词来源接缝（E36.4.3）**：新增 `lyrics/v1`（`lookup`、`sources`、`changed`）+ `ctx.lyricsSources` / `registerLyricsSource`，`useLyrics.ts` 统一走 `lyrics/v1`。
   - **日历来源接缝（E36.4.4）**：`calendar/v1`（新增 `changed` 事件）+ `ctx.calendarSources` / `registerCalendarSource`，`useCalendar.ts` 统一走 `calendar/v1` 并按源隔离错误进 `problems`。
   - **AI 代理接入接缝（E36.4.5）**：`agents/v1` + `ctx.agentSources` / `registerAgentSource`，支持外部会话流、窗口聚焦器与额外额度来源汇总。
   - **剪贴板动作接缝（E36.4.6）**：`clipboard/v1` 新增 `copyText`、`pasteText`，新增 `ctx.clipboardActions` / `registerClipboardAction` 接入剪贴板弹窗 `Ctrl+K` 面板与岛内剪贴板行菜单。
   - **截图后动作接缝（E36.4.7）**：`ctx.screenshotActions` / `registerScreenshotAction` 接入截图完成通知卡与截图历史面板，内置「用浮屿翻译」迁为默认注册项。
   - **消息来源接缝（E36.4.8）**：新增 `messages/v1`（`sources`、`notify`、`clear`、`changed`、`arrived`、`action`）+ `ctx.messageSources` / `registerMessageSource`，内置 `qq`、`wechat`、`qqMail` 统一登记，支持新增消息来源、按 `id` 替换内置来源与推送到达通知。
   - **端到端验证（E36.4.9）**：`tests/unit/phase4-seams-e2e.test.mjs` 与 `tests/unit/plugin-service-replacement.test.mjs` 一次性覆盖全部 7 个接缝的扩充、按服务让出、整服务替换与停用恢复。
