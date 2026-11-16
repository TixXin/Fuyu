# 插件平台第 3 版第 3 阶段「内置功能插件化」：分步计划

任务 E36.3（#293），父任务 E36（#289）。组长会话「[任务] 第 3 阶段内置功能插件化」2026-11-15 整理，开它的是「Fuyu-[总控] 插件系统」。**状态：草稿，等用户确认**（见文末「要你定的事」）。

第 3 阶段的地基（E36.3.1–E36.3.19：服务、宿主调 Rust、标记宏、内置插件加载、计时器和翻译的宿主样板、密钥修复、安装包带宿主）已经合入，计划和结论在 [v3-phase3-foundation-plan.md](v3-phase3-foundation-plan.md)。这份计划管剩下的主体：把 `src/features/` 的各个领域逐个变成内置插件。地基留下的三个跟进 E36.3.20（#550）、E36.3.21（#551）、E36.3.22（#552）原来先放着，用户 2026-11-15 改口交给本组，一并排进下面的批次。

做子任务的会话开工先读这份，再读 [进度](v3-progress.md)、[流程](v3-workflow.md)、[服务](v3-services.md)、[内置插件](v3-builtins.md)、[边界](v3-boundary.md)。

## 目标和做完的标志

来自 #293 和 [方案](v3-everything-plugin.md)「内置功能怎么变成插件」「分阶段」：

- `src/features/` 下的每个领域都变成一个内置插件：宿主部分注册服务，界面部分往插槽注册。
- 功能之间只通过服务和事件互相调用，不再直接 import。
- 设置里的插件页列出全部内置插件，每个都能单独关掉。
- 每个功能迁完后，在测试通道默认打开。

验收：每个内置功能都能关掉，关掉后不留界面、不跑后台；密钥类数据不再经过 JS；满足条件时发基座的第一个公开版本；Windows、macOS 真岛各验收一次。

**第 3 阶段只把现有功能原样迁成插件，不做可替换**：翻译引擎、歌词来源、日历来源、AI 代理接入、剪贴板动作、截图后动作、消息来源这些「换一个实现」的接缝是第 4 阶段（E36.4）。第 3 阶段里服务按现在唯一的实现来命名和声明，第 4 阶段再在它上面开接缝。

## 现状（摸底结果，2026-11-15）

三个只读子代理把 25 个领域各查了一遍：大小、注册到哪些插槽、开关在哪、Rust 有没有后台、和别的功能的 import。结论有五条：

1. **开关有三套。**
   - `fuyu-settings`（`localStorage`）里的 `todoEnabled`、`calendarEnabled`、`musicEnabled`、`shelfEnabled`、`screenshotEnabled`、`mailEnabled`、`agentStatusEnabled`、`translationEnabled`、`deviceAlerts`、`levelPopup`、`deviceUseIndicator`；剪贴板、语音输入、QQ、微信各自的存储里还有自己的开关。
   - 第 2 版的 7 个内置插件 `focusd.timer`、`focusd.local-api`、`focusd.cc-connect`、`focusd.ssh-proxy-tunnel`、`focusd.claude-usage`、`focusd.session-ring`、`focusd.center-pattern`：开关和设置存在第 2 版的 `plugins.json`，`plugin_host/builtin.rs` 负责起停。
   - 第 3 版的 `plugins.yml`：现在只有 `timer`、`translation` 两个宿主样板，而且只在设了 `FUYU_PLUGINS_V3=1` 时才读。
2. **关掉一个功能，Rust 的线程多半不停。** `lib.rs` 的 setup 里无条件起了剪贴板监听（Mac 上每 400 ms 轮询一次）、媒体会话（Mac 上还有一个 perl 子进程）、QQ 和微信的监听（Mac 上每秒一次的前台程序轮询）、设备提示、音量亮度、Agent 审批的 HTTP 服务和 OpenCode 轮询、截图、翻译、语音的快捷键线程。功能关掉后，这些线程只是靠一个 `AtomicBool` 空转。只有第 2 版内置插件（本机接口、cc-connect、SSH 隧道、Claude 用量）是真起真停的。翻译的快捷键在 Mac 上开机就注册，要等岛把「关」发过来才撤掉。
3. **界面的注册集中在窗口里。** 展开页、页头、收起条、刘海提醒的注册在 `src/windows/island/slots/` 的 5 个文件里，设置分类在 `src/windows/settings/slots/categories.tsx`，设置分节在各个 `*SettingsPage.tsx` 里，所有项的拥有者都是 `builtin`。另外还有不少直接写在外壳里的部分：`islandNotice.tsx` 的各种提示、`IslandShell` 和 `IslandCollapsedBar` 里的会议行、设备弹窗、音量弹窗、歌词，`IslandApp.tsx` 里的接线 hook，`SettingsWindow.tsx` 里挂的 QQ、微信 hook。窗口里也不知道哪个插件开着。
4. **功能之间的 import，多数其实是共享代码。**
   - `appearance` 是全应用的设置层，81 个文件 import 它；它反过来也 import 歌词、日历、待办、Agent 各自的那一份设置。
   - 剪贴板的快捷键工具（`shortcut.ts`、`useShortcutCapture`）被截图、翻译、语音、外观、Agent、插件页共用；`useReducedMotion` 放在 `center-pattern` 里，却是全局用的。
   - 真正在运行时调用别的功能的只有几处：截图 → 文件中转（`addFileShelfPaths`）、翻译（交给翻译窗口）、Agent（`focusAgentWindow`）；剪贴板 → 翻译（AI 改写）；待办 → 计时器（`pushIslandReminder`）；Agent 推送 ↔ cc-connect；Claude 用量和会话环 → Agent 的数据；本机接口 → 待办、笔记、Agent 状态。
5. **三个功能有自己的窗口。** 剪贴板（`clipboard`、`clipboard-preview`）、翻译（`translation`）是 `tauri.conf.json` 里写死、开机就建的窗口；截图的 `screenshot-<n>`、`pin-<n>` 是用到时才建。

各领域一览（行数只算 `src/features/<领域>/` 里的 ts、tsx、css）：

| 领域 | 大小 | 后台（Rust） | 现在的开关 | 打算 |
|---|---|---|---|---|
| todos | 51 个文件 / 4520 行，L | 无线程；本机接口和第 2 版插件会调它 | `todoEnabled` | 插件 `todos` |
| calendar | 21 / 1647，S–M | 无线程，前端轮询 | `calendarEnabled` | 插件 `calendar`（第三个样板） |
| media（含歌词） | 46 / 3288，L | 媒体会话常驻，关不掉 | `musicEnabled` | 插件 `music` |
| clipboard | 81 / 7383，L | 监听线程和轮询常驻；自己的两个窗口 | 剪贴板设置里的 `enabled`，存在 Rust | 插件 `clipboard` |
| screenshot（含录屏） | 30 / 2229，另有窗口 1843，L | 快捷键线程常驻；动态窗口 | `screenshotEnabled` | 插件 `screenshot` |
| file-shelf | 9 / 858，S | 无 | `shelfEnabled` | 插件 `file-shelf` |
| translation | 14 / 1203，M | 快捷键线程常驻；自己的窗口 | `translationEnabled` | 插件 `translation`（样板，宿主部分已有） |
| voice-input | 13 / 725，S–M | 快捷键线程常驻 | `fuyu-voice-input.enabled` | 插件 `voice-input` |
| timer（含休息提醒） | 23 / 1292，S–M | 无（宿主样板已在 Node 里计时） | 第 2 版 `focusd.timer`；休息提醒另有开关 | 插件 `timer`（样板） |
| agent-status | 115 / 8505，L；Rust 约 2.2 万行 | 审批 HTTP 服务、OpenCode 轮询常驻；远程 SSH 连接关了也不断 | `agentStatusEnabled` | 插件 `agents` |
| session-ring | 3 / 368，S | 无 | 第 2 版 | 插件 `session-ring` |
| claude-usage | 7 / 312，S | 轮询（第 2 版起停，正常） | 第 2 版 | 插件 `claude-usage` |
| cc-connect | 11 / 734，S–M | 子进程（第 2 版起停，正常），只有 Windows | 第 2 版 | 插件 `cc-connect` |
| ssh-tunnel | 7 / 357，S | 隧道（第 2 版起停，正常），只有 Windows | 第 2 版 | 插件 `ssh-tunnel` |
| local-api | 4 / 127，M | HTTP 服务（第 2 版起停，正常） | 第 2 版 | 插件 `local-api` |
| center-pattern | 15 / 852，S–M | 光标转发（引用计数） | 第 2 版 | 插件 `center-pattern` |
| messages（邮箱、QQ、微信、横幅） | 46 / 3385，L | QQ、微信监听常驻；Mac 上每秒轮询；邮箱关了线程还在 | `mailEnabled` 和 QQ、微信各自的开关 | 插件 `messages`（三个来源先作它的设置，第 4 阶段拆成来源） |
| device-events | 5 / 170，M | 线程常驻空转 | `deviceAlerts` | 插件 `device-events` |
| system-levels | 4 / 148，S–M | 线程常驻空转 | `levelPopup` | 插件 `system-levels` |
| device-use | 5 / 129，S | 无，前端每 2 秒轮询 | `deviceUseIndicator` | 插件 `device-use` |
| theme-market | 4 / 230，S | 无 | 无 | 插件 `theme-market` |
| updater | 26 / 2382，M | 无常驻线程，窗口里定时检查 | `autoCheck`（只是设置） | **必需**（`essential`）：列在插件页，不能关 |
| appearance | 61 / 4704，L | 无 | — | **不做成插件**：拆到 `src/lib/settings`、`src/lib/theme` 和 `src/windows/settings`，各功能那一份设置还给各自的功能 |
| settings-backup | 13 / 685，M | 无 | — | **不做成插件**：设置文件和数据目录是基础设施，搬到 `src/lib` 和 `src/windows/settings` |
| system-permissions | 4 / 97，S | 无 | — | **不做成插件**：新手引导也用，搬到 `src/lib` 和 `src/components` |
| first-hints | 5 / 235，S | 无 | — | **不做成插件**：属于岛的外壳，搬到 `src/windows/island` |

`plugins`、`plugin-views`、`plugin-dev` 是冻结的第 2 版，`plugin-kernel` 是第 3 版的窗口一侧，都不迁。

## 关键设计（第 0 批一次定死，后面的任务照着做）

### 1. 一个功能一个开关，存在 `plugins.yml`，由 Rust 管

- **内置插件的开关就是功能开关。** 上面三套开关合成一套：数据目录 `plugins-v3/plugins.yml` 里内置插件的 `disabled`（[v3-builtins.md](v3-builtins.md) 已经定了它的写法）。
- **由 Rust 读写，和宿主开没开无关。** Rust 新增一张内置插件开关表（放在 `plugin_kernel/` 下）。它启动时读 `plugins.yml`，提供命令 `get_builtin_plugins` / `set_builtin_plugin_enabled`，开关变化时发事件 `builtin-plugins-changed`。写文件只经 Rust 这一处。宿主照旧读同一份文件；宿主在跑时，Rust 写完就让它重读（正式版的宿主现在不监视文件，这一步要补）。
- 这样一来，`FUYU_PLUGINS_V3` 没开时，开关、界面的显示和隐藏、后台的起停也都照常工作，不用为每个功能维持两条路。依赖宿主的只剩下宿主里的服务。
- **旧开关一次性迁过来**：每个功能的任务负责迁自己的旧开关（`fuyu-settings` 的字段、各自存储里的开关、第 2 版 `plugins.json` 的启用状态和设置）。迁移要兼容读旧值，记进 `contracts.md` 和 `data-storage.md`。设置的备份和恢复（`BACKUP_KEYS`）要把开关一起带上。
- 概览页的功能卡片和插件页的开关改的是同一个东西。

### 2. 内置插件的界面留在窗口的打包里，按开关过滤

- 内置插件的界面部分仍然静态 import、随窗口一起打包，首帧就注册，冷启动和现在一样。不改成经 `fuyu-plugin://builtin/` 动态加载（那条路留给第三方插件）。
- 注册项的拥有者从 `builtin` 改成插件 id。窗口的注册表按开关表过滤：拥有者被关掉的项不渲染，元数据（`enabled`、`shown`、`active`）也不再参与计算。
- 各功能的注册从 `windows/*/slots/` 的集中文件搬到 `src/features/<领域>/plugin/`：岛的部分在 `island.tsx`，设置窗口的部分在 `settings.tsx`，无界面的接线在 `runners.tsx`。窗口用 `import.meta.glob(..., { eager: true })` 收集，这样加一个功能不用改任何集中的列表。
- 写在外壳里的部分（提示、会议行、设备弹窗、歌词、接线 hook、设置窗口挂的 hook）改成经插槽注册。为此要新加几个插槽，第 0 批一次加好：
  - `island.notice/v1`：岛上的提示；
  - `island.runner/v1`：不画界面、挂着就运行接线 hook 的组件，卸下就停；
  - `settings.runner/v1`：设置窗口里的同类组件；
  - 外壳要读的功能状态（收起保持、宽度这类）用插槽项的元数据给出。
- 组件拿到的 props 仍是实验接口（第 2 阶段定的），第 5 阶段对第三方开放前再统一。

### 3. 关掉就真停：Rust 的后台挂在开关表上

- 有后台的模块在自己的 `init` 里向开关表登记 `start` / `stop`，按插件 id 登记。开关表在启动时和开关变化时调它们。线程要能真正退出，不能靠 `AtomicBool` 空转；快捷键要撤掉。
- 开机就建的窗口（剪贴板的两个、翻译的一个）改成插件开着才建，关掉就销毁。
- 宿主部分的后台（受管定时器、监听器）随插件停用撤掉，内核已经保证（地基 E36.3.6）。
- 宿主崩溃不影响 Rust 的后台：后台的起停跟着开关表走，不跟宿主走（[边界](v3-boundary.md)规则 7）。

### 4. 功能之间：共享代码上提，运行时调用走服务

- 不算「调用别的功能」的共享代码（设置模型、主题、快捷键工具、`useReducedMotion`）先上提到 `src/lib`、`src/components`、`src/utils`。
- 运行时的调用走服务，服务有两个地方提供：
  - **宿主**：已有的 `ctx.services`。第三方插件、Rust 和宿主里的别的插件都能调；
  - **窗口里的服务表**（新增，放在 `@fuyu/plugin-base/client`）：用和宿主同一套 `defineService` 定义、同一套错误码，功能的界面部分在窗口里 `provide`，同一个窗口里的别的功能 `get`。窗口里的调用先找本窗口的提供者，找不到再经 WebSocket 找宿主。没有宿主时窗口里的服务照常能用，所以 `FUYU_PLUGINS_V3` 关着也不会坏。
- 提供者被关掉时，调用方拿到 `not-ready`，自己显示「这个功能没开」。
- 加一个边界测试：`src/features/<甲>` 不能 import `src/features/<乙>`。现有的违例记进白名单，只减不增，到第 3 阶段结束时清零。

### 5. 服务只在要用的地方加

不把 325 个 Tauri 命令都包成服务。只在下面三种情况下声明服务、给 Rust 函数加 `#[host_service]` 标记：

1. 别的功能要调（第 4 条里那几处）；
2. 第 4 阶段的接缝会建在它上面（翻译、歌词、日历、Agent 接入、剪贴板、截图、消息）；
3. 后台本来就该在宿主里跑（计时器）。

别的功能，宿主部分只是一个能开关的空插件（`apply` 什么都不注册），界面照旧经 `api.ts` 调自己的命令。

### 6. 通用的「关掉后不留界面、不跑后台」检查

第 0 批做一套检查，新加一个内置插件就自动被覆盖，不用每个任务各写一遍：

| 层 | 检查 | 怎么做 |
|---|---|---|
| 宿主 | 关掉后 `state` 是 `disabled`，`usage` 的定时器、监听器、服务、界面文件全是 0 | `tests/unit/builtins-off.test.mjs` 按 `builtins.json` 逐个起宿主、逐个关 |
| Rust | 关掉后这个插件登记的后台都停了（线程退出、快捷键撤掉、窗口销毁），再打开能恢复 | 开关表的单元测试按 `builtins.json` 逐个开关，核对每个登记项的 `running()`；`builtins.json` 里每个 id 要么有登记，要么在清单里写明「没有后台」 |
| 窗口 | 关掉后注册表里没有它拥有的可见项；之后它不再调自己领域的命令，不留自己领域的事件监听 | 新回归页 `builtins-off`：挂上岛（收起、每个展开页、页头、提醒）和设置窗口，逐个关掉内置插件。mock 的 `invoke` / `listen` 按命令名和事件名记账（命令属于哪个领域按各 `api.ts` 归），关掉后这个领域的调用数不增加，监听数归零 |
| 真岛 | 两个系统上逐个关、看占用 | 开发版加一个只读的诊断命令，列出每个内置插件的 Rust 后台、宿主 `usage`、各窗口里它的插槽项数和监听数；`pnpm lab` 加一个按钮「逐个关掉内置插件并核对」，打出一张表。再看进程的线程数（Windows 用 `Get-Process`，Mac 用 `ps -M`）关前关后的变化 |

## 任务、顺序和文件

编号接着地基往下排：E36.3.23 起（20–22 已经被占用）。**scope 是认领时写的 `--scope`**，两个会话不改同一个文件。

### 每个功能任务都按这个标准算做完

1. `builtins.json` 里有它（第 0 批已经列全），宿主部分能起；通用检查的宿主、Rust、窗口三层都过。通用的 Rust 测试用的是假后台，所以每个任务再加一条测试，核对 `builtins.json` 的 `background` 和 Rust 里登记的名字一致。
2. 它的插槽项（岛、设置、提示、接线）都在 `src/features/<领域>/plugin/`，拥有者是它的 id。拥有者一改，回归页 `builtins-off` 就开始查这个插件，所以这一条做完马上跑一次。
3. 有后台的都登记进开关表（`builtins::register(id, 名字, Arc<dyn Background>)`），关掉就真停；开着时行为和以前一样。关着时改了它的设置（例如快捷键），只记下来、不报错，下次开的时候生效。在 `builtins.json` 里自己那一行写上 `background`，列出登记的后台名字：没写这个字段，通用测试当作还没迁完，不会检查。每个任务只改自己那一行。
4. 旧开关迁进 `plugins.yml`，兼容读旧值；`contracts.md`、`data-storage.md` 记上；备份带上。`fuyu-settings` 里的开关在 `LEGACY_SWITCHES` 加一行就够，镜像会让备份自动带上；存在各自存储里的开关（例如第 2 版 `plugins.json`）要另写迁移并核对备份。
5. 不 import 别的功能，边界白名单里删掉它的条目；要调别的功能的，走服务。
6. 回归页的 DOM 快照不变。确实该变时（比如关掉的项不再渲染）用 `--update-snapshots`，提交说明写清楚是哪些快照、为什么变。
7. 设置的插件页里有它，能开关；`v3-services.md` 的服务清单补上它的服务；`platforms.md` 核对一次。
8. 「待人工验收」加上它的行（两个系统各一行）；只有 Windows 的模块（cc-connect、SSH 隧道、录屏、QQ、微信的监听）在 Mac 上测不了，写实测清单。

各部分放在哪、怎么写，照 E36.3.29（翻译）的样板：任务文件 `docs/tasks/0-archive/E/E36.3.29.md`「备注」有完整的表。

验证：`pnpm check` + `pnpm build` + `pnpm test:regression`；改了 Rust 的再加 `pnpm heavy -- cargo test --manifest-path src-tauri/Cargo.toml`、Windows 交叉 clippy、`pnpm build:exe`。

### 第 0 批：地基上再补一层（先做，后面都依赖它）

| 编号 | 内容 | scope | 依赖 | 编译 | 做完的标志 |
|---|---|---|---|---|---|
| **E36.3.23** | **内置插件的开关表**（设计第 1、3 条）：Rust 的开关表和 `get_builtin_plugins` / `set_builtin_plugin_enabled` / `builtin-plugins-changed`；写 `plugins.yml`，并让在跑的宿主重读；后台登记的接口（`start` / `stop` / `running`）和它按 `builtins.json` 逐个开关的通用测试；`builtins.json` 一次列全 21 个内置插件（加上 `updater` 共 22 个，`updater` 是 `essential`），每个领域放一个空的宿主入口；窗口里的开关读取（hook 加事件）；注册表按拥有者的开关过滤；插件页列出全部内置插件、能开关（宿主没开时也能用）；插件名的中英文一次加全 | `src-tauri/src/plugin_kernel/`、`src-tauri/src/lib.rs`（只加一行登记）、`src/features/builtins.json`、`src/features/*/host/index.mjs`（新建的空入口，已有的两个不动）、`src/features/plugin-kernel/`、`packages/plugin-base/src/client/slots.mjs` 及测试、`src/windows/settings/PluginsV3SettingsPage.tsx` 和它的 css、对应 i18n 分区、`contracts.md`、`data-storage.md` | 无 | 要 | 关掉一个插件后它的插槽项消失、Rust 登记的后台停掉；宿主没开时开关照样生效；通用的 Rust 测试和宿主测试在两个样板上跑通 |
| **E36.3.24** | **共享代码上提**（设计第 4 条前半，纯搬迁）：`appearance` 拆成 `src/lib/settings`（类型、默认值、读写）、`src/lib/theme`（主题、强调色、动效），各设置分节组件搬进 `src/windows/settings`；歌词、日历、待办、Agent 那一份设置搬回各自的功能，`appearance` 改成从各功能汇总；快捷键工具搬到 `src/lib/shortcut`，`useReducedMotion` 搬到 `src/lib`；`settings-backup`、`system-permissions` 搬到 `src/lib` 和 `src/windows/settings`，`first-hints` 搬到 `src/windows/island`；加功能边界测试和白名单 | `src/features/appearance/`、`settings-backup/`、`system-permissions/`、`first-hints/`、`src/lib/`、`src/windows/settings/`（只改 import 和搬进来的组件）、各处 import 这些东西的文件（只改 import 路径）、`tests/unit/` 里对应的 import、新的边界测试和白名单 | 无 | 不要 | 零行为变化，回归页 DOM 快照全部不变；边界白名单列出剩下的跨功能 import |
| **E36.3.25** | **岛的外壳不再 import 功能**（设计第 2 条，纯搬迁）：`windows/island/slots/` 里各功能的注册搬到 `src/features/<领域>/plugin/island.tsx`，用 glob 收集；加 `island.notice/v1`、`island.runner/v1`，把 `islandNotice.tsx` 的提示、外壳里直接 import 的会议行、设备弹窗、音量弹窗、歌词，以及 `IslandApp.tsx` 里的接线 hook 改成插槽项；外壳要读的功能状态改成元数据。拥有者暂时仍是 `builtin` | `src/windows/island/`（除了 E36.3.23 碰的文件）、`src/features/*/plugin/island.tsx`、`src/features/*/plugin/runners.tsx`、`packages/plugin-base/src/protocol.mjs` 和 `.d.mts`（只加插槽定义）、`v3-boundary.md`「插槽」一节 | E36.3.24 | 不要 | 外壳只 import `plugin-kernel` 和 `lib` / `components`；回归页 DOM 快照全部不变 |
| **E36.3.26** | **设置窗口不再 import 功能**（同上，设置窗口这一半）：各设置页的分节注册搬到 `src/features/<领域>/plugin/settings.tsx`；`categories.tsx` 的分类注册也搬过去；加 `settings.runner/v1`，把 `SettingsWindow.tsx` 挂的 QQ、微信 hook、快捷键页的跨功能 import 改成插槽项 | `src/windows/settings/`（除了 E36.3.23 碰的文件）、`src/features/*/plugin/settings.tsx`、`searchIndex.json`（重新生成，应当不变） | E36.3.24；和 E36.3.25 并行（文件不重叠） | 不要 | 同上；`pnpm settings:index` 跑出来的和以前一样 |
| **E36.3.27** | **窗口里的服务表和通用检查**（设计第 4 条后半、第 6 条）：`@fuyu/plugin-base/client` 加窗口服务表（`provide` / `get`，先找本窗口，再找宿主）；回归页 `builtins-off` 和 mock 的记账；宿主的 `builtins-off` 测试；开发版的诊断命令和 `pnpm lab` 的按钮 | `packages/plugin-base/src/client/services*.mjs` 及测试、`tests/regression/builtins-off.*`、`scripts/run-regression.mjs`（只加页面）、`tests/unit/builtins-off.test.mjs`、`src-tauri/src/local_api/lab.rs` 和诊断命令、`scripts/island-lab/` | E36.3.23 | 要（诊断命令） | 两个样板（计时器、翻译）在三层检查里都能被查出「关掉后还有残留」，修好后通过 |

地基留下的两个跟进也放进第 0 批，任务和 issue 已经建好：

| 编号 | 内容 | scope | 依赖 | 编译 | 做完的标志 |
|---|---|---|---|---|---|
| **E36.3.22**（#552） | **安全：`fuyu-plugin://` 不再把 `data/` 和配置交给窗口**。改成白名单，只放行 `__shared/`、`packages/` 下已安装的包和开发文件夹（以后的 `builtin/<id>/`、`dev/<id>/` 映射也走白名单），`data/`、`plugins.yml*`、`safe-mode.json`、`bisect.json` 和没登记的路径一律 404；另外评估 `Access-Control-Allow-Origin: *` 能不能收窄。不依赖开关表 | `src-tauri/src/plugin_kernel/protocol.rs` 及它的测试；要动 `plugin_kernel/mod.rs` 时先告诉组长，和 E36.3.23 错开；`v3-builtins.md`「界面文件的地址」、`v3-sources.md` 里相关的几行 | 无 | 要 | 任务文件的验收；窗口读 `data/`、`plugins.yml` 都是 404，演示插件和已安装的包照常加载 |
| **E36.3.21**（#551） | **宿主部分的 lint**：`src/features/*/host/` 和 `packages/plugin-base/src/host/` 不能 import 浏览器的东西和 `@tauri-apps/api`，不能用 `window`、`document`、`localStorage`。赶在 E36.3.23 加一大批 `host/` 入口之前或同时上 | `eslint.config.js`、根 `package.json` 的 lint 脚本（只改这一行）、`tests/scripts/` 下的规则测试、`v3-builtins.md` 的后续表、`src/AGENTS.md` 的 `host/` 说明 | 无 | 不要 | 任务文件的验收 |

顺序：E36.3.23 和 E36.3.22（都要编译，正好占满两个名额），加上 E36.3.24、E36.3.21（都不编译）同时开工 → E36.3.25 和 E36.3.26 并行 → E36.3.27。E36.3.23 和 E36.3.22 都在 `plugin_kernel/` 里：E36.3.23 不碰 `protocol.rs`，E36.3.22 不碰开关表的文件，`mod.rs` 谁要动先说。第 0 批大约要一周。

**2026-11-15 调整（E36.3.25 摸底后）**：岛的外壳有 51 个文件、247 处 import 功能。其中一部分是外壳拿各功能的状态算布局：收起条文字、收起宽度、贴边时保持展开、刘海和侧边气泡的弹窗、封面取色、悬停时先切到哪一页、弹出高度。要去掉这些 import 就得改外壳的数据流，不再是纯搬迁。所以 E36.3.25 只做纯搬迁（插槽注册搬进 `features/<领域>/plugin/`，加 `island.notice/v1`、`island.runner/v1`，自成一体的接线 hook 改成插槽项，页面之间的交叉改成插槽元数据）；布局这部分拆成 **E36.3.51**（#619）：定一套通用的贡献元数据，各功能经 runner 交结果，外壳只认元数据。

- E36.3.51 不挡三个样板。
- **E36.3.51 的方案（2026-11-16 组长批）**：见 [island-shell-contributions.md](../../investigations/island-shell-contributions.md)。功能在 runner 里跑 hook、写自己的 store，外壳只读 plugin-kernel 里的贡献表；新插槽 `island.line/v1`、`island.side/v1`、`island.overlay/v1`、`island.decor/v1`。功能之间的数据先暂记进功能边界白名单（约 8 条，这是「只减不增」的一次例外），由 E36.3.36、E36.3.37、E36.3.38 的服务去掉，三个任务的验收已写上。第 2 版插件系统（`plugins`、`plugin-views`）的 import 留在 `island` 白名单里算清零，第 6 阶段随第 2 版删。它第 5 步每做完一个功能就告诉组长，那个功能的迁移任务（E36.3.31、.33、.37、.38、.44）就能开工，不用等整个 E36.3.51；file-shelf 那两个 hook 等 E36.3.32 提交后由 E36.3.51 挪。
- **E36.3.22 做完（2026-11-16）**：`fuyu-plugin://` 只放行 `__shared/`、`packages/**` 和宿主经协议 2 通知 `clients` 报上来的界面目录，`data/`、`plugins.yml*`、状态文件一律 404。`Access-Control-Allow-Origin: *` 这次不收窄（评估在归档后的 E36.3.22 备注里）：自定义协议只在浮屿自己的 WebView 里用，收窄的收益小，写错源字符串所有插件界面都会挂，只能真机验。留到做 `dev/<id>/`、`builtin/<id>/` 映射或第 5 阶段之前一起收窄，两个系统实测。
- 第 2 批里在外壳布局里有份的功能要等它：E36.3.31、E36.3.33、E36.3.37、E36.3.38、E36.3.44；E36.3.39 经 E36.3.37 间接等它。
- 功能边界测试把 `src/features/plugin-kernel` 当平台层放行，和 `lib` 一样。

### 第 1 批：三个样板（定下迁移的写法，也是基座公开发布的条件）

| 编号 | 功能 | 要点 | 依赖 | 编译 |
|---|---|---|---|---|
| E36.3.28 | timer（含休息提醒） | 拥有者改成 `timer`；第 2 版 `focusd.timer` 的启用状态、设置（声音）和快捷键 Ctrl+Alt+K 迁过来，并从 `plugin_host/builtin.rs` 去掉；待办 → 计时器的 `pushIslandReminder` 改成窗口服务。**岛上的计时还用现在的 `localStorage`**，改用宿主的 `timers/v1` 等第 3 版默认打开（E36.3.48） | 第 0 批 | 要（第 2 版内置插件表） |
| E36.3.29 | translation | 拥有者改成 `translation`；翻译窗口改成开着才建；快捷键在关着时一开机就不注册；剪贴板的 AI 改写、截图转翻译改成调 `translator/v1`（窗口服务，宿主没开时也能用） | 第 0 批 | 要 |
| E36.3.30 | calendar | 拥有者改成 `calendar`；会议行留在外壳，关掉时靠旧开关的镜像停轮询、不显示，改经插槽挪给 E36.3.51（会议行和歌词轮播、弹窗先后、加入按钮缠在一起，属于外壳算布局）；`calendar/v1` 服务（读日程，第 4 阶段的日历来源建在它上面） | 第 0 批 | 要（服务标记） |

翻译样板之后接着做 **E36.3.20**（#550）：用户在设置里存的自定义翻译地址交给 Rust 保存，宿主这条路上的 `translator/v1` 用 Rust 存的地址重新开放自定义引擎；宿主入口照旧不收地址参数，已经填过地址的用户升级后不用重填。scope 是 `src-tauri/src/translation/`、`src/features/translation/` 里存设置的部分、`v3-services.md`、`v3-secrets.md`、`data-storage.md`、`contracts.md`。它依赖 E36.3.29（两个都改 `translation/`，不能同时做），而且必须在 E36.3.47（默认打开）之前完成。要编译。

三个样板做完后，组长回看一次：迁移标准有没有要改的地方，基座的接口有没有因为样板变过；结论写进这份计划，再派第 2 批。

样板做到一半先定下的约定（2026-11-16，E36.3.29 提出，组长同意）：

- **`fuyu-settings` 里的旧开关**：`plugin-kernel` 有一张 `LEGACY_SWITCHES` 表（字段名 → 插件 id），每个功能任务只加自己那一行。
  - `useLegacySwitches` 读的时候用开关表的值。
  - 写的时候调 `set_builtin_plugin_enabled`，所以概览卡片、引导页这些写开关的地方不用改。
  - 两边的对账在岛里做。存的值变了（恢复备份、同步、别的窗口写）而且和开关表不同，就以存的值为准，这也就是一次性迁移。开关表变了，就写回 `fuyu-settings` 当镜像，备份照常带上。
  - 这个镜像在 E36.3.50 去掉。
- **窗口服务**写在 `src/features/<领域>/plugin/services.ts`，`src/main.tsx` 用 glob 收集，每个窗口都注册一遍，所以宿主没开也能用。
- **两个功能之间只是交接数据的**（例如截图转翻译存的 `fuyu-translation-handoff`），读写函数上提到 `src/lib/`，算共享代码，不为它加服务方法。

**三个样板做完后的回看（2026-11-16，组长）**：计时器（E36.3.28）、翻译（E36.3.29）、日历（E36.3.30）都已做完，回归页 `builtins-off` 查这三个插件，关掉后都没有残留。

- **迁移的写法**：照翻译样板的表，写在 `docs/tasks/0-archive/E/E36.3.29.md`「备注」。日历样板补了几条坑，写在 `docs/tasks/0-archive/E/E36.3.30.md`「备注」：
  - 服务的 `.d.mts` 不要重新声明 `gen:rust-types` 已经生成的同名类型，否则报 TS2308；直接 `export type {…} from "../generated/rust.mjs"`。
  - ts-rs 把 `i64` 生成成 `bigint`，时间戳要加 `#[cfg_attr(test, ts(type = "number"))]`。
  - `UserError::code()` 只在测试构建里有。release 代码要用错误码时从序列化结果里读，否则 Rust 单元测试能过、`build:exe` 会挂。所以 `build:exe` 必须跑。
  - `ServiceClient` 不支持可选参数，参数写成对象，调用时传 `{}`。
  - 宿主和窗口各有一份服务实现时，两边都经 `host/index.mjs` 里同一个规整函数出结果，回答才一致。
  - 服务标记不写 `inject(app)`：它把 `AppHandle` 留进静态登记，Windows 上没有 manifest 的 Rust 测试程序一启动就报 0xc0000139，Mac 上看不出来（PR #640，c811bcbf 修）。数据目录用 `crate::home_dir::current()`，Tauri 命令照旧用 `AppHandle` 求目录，再交给同一个函数。
  - 不只是 `inject(app)`：静态登记的方法体里只要调了 `AppHandle` 的方法（例如 `emit_to`），都会把 wry 留进测试程序；间接走到的也算，例如经 `plugin_host::publish_event` 走到 `sensitive::check(&app, …)`（E36.3.32 的 dbe0cc6e）。要发事件，就在 `init` 里登记一个 `Box<dyn Fn()>`，方法里只调它；改了这类服务要过一次 Windows CI（`pnpm mq:try`）。
- **基座的接口**：三个样板都没改 `@fuyu/plugin-base` 的接口，只新加了窗口服务和旧开关的镜像。基座公开发布要求的「三个样板按同一套写法迁完」满足了，E36.3.49 核对条件时记上。
- **标准不改**：只在第 1、2、3、4 条里补充了说明（上面已改）。
- **第 2 批**：E36.3.31、E36.3.33、E36.3.37、E36.3.38、E36.3.44 要等 E36.3.51；E36.3.34 等剪贴板预览 C101.1–C101.3。现在能开工的有 E36.3.51、E36.3.32、E36.3.42、E36.3.45、E36.3.46、E36.3.49。E36.3.47（测试通道默认打开）只差 E36.3.22。

E36.3.21（111b02d5）的 lint 禁止宿主部分 import 任何 `lib/`、`components/`、`windows/`、`client/` 下的模块。E36.3.24 把共享代码搬进 `src/lib/` 之后，宿主部分要用里面的纯函数（例如设置的类型和默认值）时，在 `eslint.config.js` 的宿主规则里给那个子目录开例外，不要把纯函数复制一份。

### 第 2 批起：其余功能（同时最多 2 个要编译的会话）

| 编号 | 功能 | 要点 | 依赖 |
|---|---|---|---|
| E36.3.31 | device-events、system-levels、device-use | 三个小插件放在一个会话里做：两个常驻线程改成真停；设备占用的轮询改成跟着插件开关 | 第 1 批 |
| E36.3.32 | file-shelf | `fileShelf/v1`（截图、录屏要用的「加进中转」） | 第 1 批 |
| E36.3.33 | music（媒体加歌词） | 媒体会话（Mac 上的 perl 子进程）改成真停；`media/v1`（第 4 阶段的歌词来源建在它上面；收起保持、Agent 读「在放音乐」改走它） | 第 1 批 |
| E36.3.34 | clipboard | 两个窗口改成开着才建；监听线程和 Mac 上的轮询真停；`clipboard/v1`；第 2 版插件读剪贴板的那条路保留到第 6 阶段 | E36.3.29；剪贴板预览（[clipboard-preview-plan.md](../clipboard-preview-plan.md)）的 P1–P3 合入后再开工 |
| E36.3.35 | screenshot（含录屏） | 快捷键线程真停；调文件中转、翻译、Agent 改走服务 | E36.3.32、E36.3.34、E36.3.37 |
| E36.3.36 | voice-input | 快捷键线程真停；写待办、笔记改走 `todos/v1` | E36.3.38 |
| E36.3.37 | agents | 审批 HTTP 服务、OpenCode 轮询、远程 SSH 连接真停；`agents/v1`（会话列表、用量、聚焦窗口），给会话环、用量环、截图、本机接口用；推送和 cc-connect 的双向 import 拆开 | 第 1 批 |
| E36.3.38 | todos | `todos/v1`（本机接口、语音、日历加待办要用）；`TodosGate` 的迁移门留在外壳 | 第 1 批 |
| E36.3.39 | claude-usage | 用量命令从 `agent_status` 挪出来，或者改调 `agents/v1`；第 2 版的启用状态和设置迁过来 | E36.3.37 |
| E36.3.40 | session-ring | 改读 `agents/v1`；第 2 版的启用状态和设置迁过来 | E36.3.37 |
| E36.3.41 | cc-connect | 第 2 版的启用状态和设置迁过来；插件详情页里的设置改成 `settings.section/v1`；和 Agent 推送之间改走服务。只有 Windows | E36.3.37 |
| E36.3.42 | ssh-tunnel | 同上（设置搬进第 3 版的分节）。只有 Windows | 第 1 批 |
| E36.3.43 | local-api | 同上；路由里转给待办、笔记、Agent 状态的部分改调服务；令牌照旧只由 Rust 复制 | E36.3.37、E36.3.38 |
| E36.3.44 | messages | 一个插件，邮箱、QQ、微信三个来源作它的设置；QQ、微信的监听、Mac 上的轮询和 Dock 角标循环、邮箱的线程都真停 | 第 1 批 |
| E36.3.45 | center-pattern | 光标转发跟着插件开关；宠物设置从第 2 版插件详情页搬到第 3 版的分节 | 第 1 批 |
| E36.3.46 | theme-market、updater | 主题市场作普通插件；更新标 `essential`，窗口里的定时检查从 `useIslandTodos` 挪到它自己的 runner | 第 1 批 |

建议的派法（每波 2 个要编译的会话，再加不编译的）：E36.3.31 + E36.3.33 → E36.3.37 + E36.3.32 → E36.3.38 + E36.3.34 → E36.3.44 + E36.3.35 → E36.3.39 / 40 / 41 / 42 / 43 / 45 / 46 两两一波 → E36.3.36。哪个会话先做完，就从后面的任务里补位。

### 收尾的几项

| 编号 | 内容 | 依赖 |
|---|---|---|
| E36.3.47 | **第 3 版在测试通道默认打开**：`FUYU_PLUGINS_V3` 在 beta 默认是开，正式通道晚一个版本；时机见「要你定的事」第 3 条；电脑上没有 Node、正在下载时，岛和插件页要显示状态，失败能重试；量内存和冷启动，记进 `v3-progress.md` 的「第 3 阶段后」那一列 | 第 1 批、E36.3.20、E36.3.22 |
| E36.3.48 | **计时器的界面改用宿主的 `timers/v1`**：`fuyu-timers` 一次迁进宿主的数据文件，属于对外契约的变更，要兼容读旧值 | E36.3.47 |
| E36.3.49 | **基座公开发布的准备**：一个不带浮屿业务的最小示例应用、文档、每条保证的说明；核对方案「基座做成开源项目」的四个条件。发布本身（建仓库、发 npm 包）是对外的动作，要你点头 | 第 1 批 |
| E36.3.50 | **收口**：去掉旧开关的代码路径（`IslandFeatures` 改成从开关表来）；边界白名单清零；`v3-progress.md`、`overview.md`、`src/AGENTS.md` 的目录地图（`plugin/` 子目录）、`contracts.md`、`platforms.md`；两个系统的真岛验收 | 全部 |

## 公共文件怎么排队

| 文件 | 规则 |
|---|---|
| `src/features/builtins.json` | E36.3.23 一次列全，之后不再是热点。改 `kind` 等字段先告诉组长 |
| `packages/plugin-services/src/index.mjs`、`index.d.mts`、`test/types.check.mts` | 每个服务只加自己的几行，加完马上用 `pnpm mq:commit-part --take` 单独提交 |
| `packages/plugin-services/src/generated/rust.d.mts`、`rust.mjs` | `pnpm gen:rust-types` 会把别的会话还没提交的标记也生成进去。所以**同一时间只有一个会话加 `#[host_service]` 标记**（组长按编译名额排），提交时只带自己的那几行 |
| `src-tauri/src/lib.rs`、`Cargo.toml`、`tauri.conf.json`、`capabilities/` | 只改自己那一行，改完马上单独提交。剪贴板（E36.3.34）和翻译（E36.3.29）都要改 `tauri.conf.json` 的窗口，两个不同时做 |
| `contracts.md`、`data-storage.md`、`platforms.md`、`v3-services.md` 的服务清单 | 每个任务只加自己的行，改完马上提交 |
| `src/windows/settings/searchIndex.json` | 改了设置项就重新生成，马上提交 |
| `packages/plugin-base/src/protocol.*`（插槽定义） | 只在 E36.3.25、E36.3.26 里加，之后要加插槽先找组长 |
| 外壳 `src/windows/island/`、`src/windows/settings/` | 第 0 批之后，功能任务原则上不碰外壳；要碰的先在任务里写明，组长排开 |
| `v3-progress.md` | 只有组长改（阶段开头、结尾和待人工验收） |

## 关掉后的残留：第 0 批末的基线

E36.3.27 的回归页 `builtins-off` 默认只查「迁完了」的插件，即在插槽注册表里拥有至少一项的插件，不看 `builtins.json` 的 `background` 字段；E36.3.23 给 8 个插件预填了 `background: []`，它们的界面其实还没搬。Rust 一层照旧按 `background` 查。

- 宿主一层：两个样板都通过，因为内核替它们收拾了定时器、监听和服务。能不能查出漏收拾，由一个故意用裸 `setInterval` 的假插件证明。
- 用 `?all=1` 查全部插件，`?only=a,b` 查点名的。下表是 2026-11-15 的 `?all=1` 结果，迁移时对照，修完对应的行应该消失。

| 插件 | 残留 |
|---|---|
| 没残留 | session-ring、claude-usage、cc-connect、ssh-tunnel、center-pattern |
| translation | 岛的翻译页还渲染 `.translation-panel` 等 21 个 class；关掉后还调 `has_translation_secret`、`set_translation_shortcut`、`set_translation_selection_shortcut`（各 4 次）和 `read_translation_clipboard`（2 次）；还听 `translation-selection`、`translation-island-shortcut` |
| timer | 岛的计时器页还渲染 `.timer-panel` 等 6 个 class（命令和事件和岛、Agent 推送共用，记不到它名下） |
| todos | `.todo-island`、`.todo-date-picker` 在收起的岛、展开的岛、待办页、截图页上 |
| calendar | 日历页 `.calendar-panel`；设置 → 日历 `.calendar-form`；调 `get_calendar_events`、`list_calendar_sources` |
| music | 音乐页 `.media-waveform` 等；设置 → 音乐、歌词、歌词样式；调 `get_media_state`、`get_inflink_state`；听 `media-session-changed` |
| clipboard | 剪贴板页 `.clipboard-page`；设置 → 片段；调 `get_clipboard_history`（35 次）、`get_clipboard_shortcut_error`、`get_clipboard_links`；听 `clipboard-history-changed`、`clipboard-item-copied`、`clipboard-links-changed`、`clipboard-history-shortcut` |
| screenshot | 听 `screenshot-text`、`screenshot-taken`、`recording-state`、`recording-finished` |
| file-shelf | 调 `get_file_shelf`；听 `file-shelf-changed` |
| voice-input | 听 `voice-input-state` |
| agents | Agent 页、设置 → Agent 各标签；调 `get_agent_status`（13 次）等 11 个命令；听 `agent-approval-requested`、`agent-approval-closed` |
| local-api | 听 `local-api-request`、`dev-island-action` |
| messages | `.island__summary-layer`、`.island-message-button` 在岛的外壳里到处都有（属于 E36.3.51），消息页和设置里的 `.message-brand-icon`；调 `get_qq_mail_state`；听 `qq-mail-changed`、`qq-notifications-changed`、`wechat-reminder-changed` |
| device-events | 听 `device-alert` |
| system-levels | 听 `system-level-changed` |
| device-use | 调 `get_device_use` |
| theme-market | 设置 → 主题市场 `.theme-market__grid`；调 `get_theme_market` |

**回归页查不到的残留（2026-11-16，E36.3.32 发现）**：两类东西不归哪个功能的插槽项，`builtins-off` 看不到，功能关掉后还在。
- 设置 → 收起条项目里列出的各功能项目，例如「文件中转数量」、日历的倒计时：列表要按开关表的关掉名单过滤，所有功能共用一处，由 E36.3.50 收口时统一做。如果哪个功能任务顺手做了，在这里划掉。
- 托盘卡片（C99.3）里的功能入口，例如「文件中转」「剪贴板」（E36.3.34 也报了：剪贴板关着时入口还显示，点了没反应）：托盘卡片是新窗口，要从开关表读关掉名单。由托盘卡片那边的任务做，组长已转告。
- 剪贴板关着时，密钥类条目不按时过期，要等下次打开才清（E36.3.34 报）。E36.3.50 收口时决定：关着时也留一个过期定时器，或者在插件页写明。
- 待办关掉后，本机接口照旧能读写待办（`local-api.md` 写明「模块关掉时接口仍可用」），文件中转关掉时却回 503，两边不一致。由 E36.3.43（本机接口）统一定一条规则，并改 `local-api.md`（E36.3.38 报）。
- 设置 → 待办的页面还留在设置窗口里，没搬进 `features/todos`：项目分节用了 plugin-views 的样式类，搬过去会多一条跨功能引用。分类的拥有者已是 todos，关掉时会消失。E36.3.50 收口时一起搬（E36.3.38 报）。

## 不在这一阶段做的

- **接缝**（第 4 阶段）：换翻译引擎、歌词来源、日历来源、Agent 接入，剪贴板和截图的动作，消息来源。消息先作为一个插件迁，三个来源到第 4 阶段再拆。
- 内置插件的界面经 `fuyu-plugin://builtin/` 动态加载、开发版的内置插件界面热重载：内置插件的界面留在窗口的打包里（设计第 2 条），不需要这两样。
- 第三方插件能往岛上放页面、分类时需要的统一 props 和元数据（第 5 阶段）。
- 第 2 版的插件页和插件视图（冻结，第 6 阶段删）。迁走的第 2 版内置插件只从第 2 版的内置插件表里去掉，不改第 2 版的接口。

## 要开的 issue

E36.3.20–E36.3.22 的任务和 issue 已经有了（#550–#552）。用户确认后：其余每个任务一个 issue（E36.3.23–E36.3.50，共 28 个），标题 `[<编号>] <标题>`，正文写清要做什么、怎样算做完，链接这份计划；再 `pnpm tasks add … --issue <N>`，填好依赖。父 issue #293 下回复这份计划。

## 要你定的事

| # | 事 | 建议 | 备选和代价 |
|---|---|---|---|
| 1 | **功能开关合成一套，存进 `plugins.yml`，由 Rust 管**（设计第 1 条） | 合。概览的功能卡片、插件页的开关、第 2 版内置插件的开关都改成这一个；旧开关一次性迁过来，兼容读旧值 | 不合：内置插件的开关另算一套，和功能开关两头对，「关掉插件」和「关掉功能」会不一致。开关的存放位置是对外契约的变更，要迁移，这一点两种做法都免不了 |
| 2 | **内置插件的界面留在窗口的打包里，按开关过滤**（设计第 2 条），并加窗口里的服务表（设计第 4 条） | 照这样做：首帧不变，冷启动不变；`FUYU_PLUGINS_V3` 关着时功能也照常，不用每个功能维持两条路 | 改成经 `fuyu-plugin://builtin/` 动态加载：更像第三方插件，但首帧要等加载，开发版还要另做 TSX 的加载，第 2 阶段定的「冷启动不变慢」难保证 |
| 3 | **第 3 版什么时候在测试通道默认打开** | 三个样板和 E36.3.20 做完就做 E36.3.47（E36.3.22 在第 0 批已经做完）。开关、界面和后台都不依赖宿主，所以默认打开主要是让宿主里的服务和第 4 阶段的接缝用起来 | 等全部功能迁完再默认打开：风险都压在最后一次，测试通道里的人这几周也用不上第 3 版 |
| 4 | **哪些不做成插件**：`appearance`、`settings-backup`、`system-permissions`、`first-hints` 不做插件，拆到 `lib` 和窗口；`updater` 作必需项，不能关；`messages` 先作一个插件 | 照这样 | 也做成插件：它们没有可关的意义（关掉外观设置、关掉设置文件，岛就没法用），只会多出几行永远开着的开关 |
| 5 | **第三个样板选哪个** | 日历：有页面、会议行、设置分节、密钥和服务，大小适中 | 待办：最能考验写法，但它是岛的核心，又和外壳缠得最紧，第一批就做风险大 |

另外两件事，不用现在定：
- 第 3 阶段结尾的内存长跑，照第 1 阶段的做法跑 1 小时（用户 2026-11-15 定的口径）。
- 基座的名字和仓库到 E36.3.49 时再问。
