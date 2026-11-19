# Agent 接入协议

这份文档规定岛怎么描述一家 AI 代理（harness）、一个额度来源和一个跳转宿主。目的有两个：接一家新代理时有一份清单可以照着填，不用在十来个文件里找要改的地方；第三方不改浮屿源码也能接入。

状态：**第 1 步**（B77，#884）。协议和 schema 定下来了（B76，#883）；Qoder、CodeBuddy、Qwen Code 三家已经只剩描述文件（`src-tauri/src/agent_status/harnesses/<id>.json`），其余家还按现状写在代码里。各项字段对应现在的哪段代码，见文末「和现有代码的对照」。后面几步见「分步迁移」。

Schema 和示例在 [protocol/](protocol/)：

| 文件 | 内容 |
|---|---|
| `harness.schema.json` | harness 描述 |
| `quota.schema.json` | 额度来源 |
| `host.schema.json` | 跳转宿主 |
| `examples/harnesses/qwen.json` | 纯数据的一家（照抄 Claude Code 钩子） |
| `examples/harnesses/dsh.json` | 会话和钩子都要适配器的一家 |
| `examples/harnesses/antigravity.json` | 三种形态、远程、按形态跳转 |
| `examples/quota/glm.json` | 模型厂商的额度（不是 harness） |
| `examples/hosts/zed.json` | 一个编辑器宿主 |

## 三份描述和适配器

| | 描述什么 | 一份管几家 | 例子 |
|---|---|---|---|
| **harness** | 一家 AI 代理：形态、会话、钩子、信号、回复标记、远程、跳转偏好 | 一家 | Claude Code、Qwen Code、DSH |
| **额度来源**（quota） | 用量环上的一个来源：显示成环还是只在悬停时显示、有哪些窗口、凭据、怎么取 | 一个账号体系 | Anthropic 订阅、Codex、GLM、Kimi |
| **跳转宿主**（host） | 会话跑在哪个程序里：怎么认出来、怎么切到前台、能不能精确到标签 | 一个终端或编辑器 | Windows Terminal、WezTerm、VS Code、Zed |

三者分开是因为它们不是一一对应的：GLM 的 key 可以给 Qwen Code、opencode、Claude Code 用；Claude Code 能跑在任何终端或编辑器里。harness 只按 id 引用另外两种。

**描述文件只放数据，不放代码。** 能写成数据的（路径、进程名、事件名、文件名）写进描述文件；数据格式特殊、要写代码解析的（DSH 的检查点、opencode 的 sqlite、Antigravity 的 pbtxt、额度接口的返回值），描述文件里写 `adapter: "<名字>"`，由同名的适配器实现。内置的适配器是 Rust 模块，第三方的适配器是第 3 版插件里的代码（见「分发」）。

不把所有东西都塞进 JSON：要表达「检查点有 v3–v7 五个版本」「两代 sqlite 按 id 合并、新的为准」，JSON 就得长出条件和循环，成了一门难用的编程语言。也不把数据和代码合成一个 JS 文件：那样所有家都得在第 3 版的 Node 宿主里跑，而 Node 宿主是第一次启动时才下载的，Agent 状态是核心功能，不该依赖它。

## harness 描述

文件名是 `<id>.json`，`id` 和文件名一致。下面按块说明，完整的约束看 `harness.schema.json`。

### 身份

| 字段 | 说明 |
|---|---|
| `protocol` | 协议版本，现在是 `1`。三种描述都有这个字段，不兼容的改动才加一 |
| `id` | 驼峰，`[a-z][A-Za-z0-9]{0,31}`，和现有的 provider id 一致（`claudeCode`、`traeCn`）。写进 `agent-status.json`、会话 key、设置里的隐藏列表，定了就不改 |
| `name` | 显示名，`{ "zh-CN": …, "en": … }`；两种语言一样时可以只写一个字符串 |
| `icon` | 品牌图标的文件名，放在 `src/assets/brands/`，来源写进同目录的 `README.md` |
| `aliases` | 改名前的旧 id，读旧数据时认 |

### 形态 `forms`

键是 `cli`、`app`、`ideExtension`，每种形态各写各的；几种形态共用一套数据时，只在一处写 `home`，其他形态写 `"sharesWith": "cli"`。

| 字段 | 说明 |
|---|---|
| `home` | 家目录的候选，按顺序找，第一个存在的为准；元素是 `{ "path": "~/.qwen", "env": "QWEN_HOME" }`，`env` 有值时优先，只有 `env` 没有 `path` 也行。`path` 只能以 `~/`、`%APPDATA%/`、`%LOCALAPPDATA%/`、`<AppData>/`（Windows 的 `%APPDATA%`，macOS 的 `~/Library/Application Support`）开头。要读别的程序的指针文件才知道目录的（DSH 几个桌面版），由会话适配器处理 |
| `process` | `{ "windows": ["qwen.exe"], "macos": ["com.example.app"] }`，判断这家在不在跑、会话退出没有；Mac 上写 bundle id 或可执行文件名 |
| `linux` | 只有 `cli` 用：能不能在 Linux 服务器上跑、对 glibc 的要求，决定 `remote` 能不能写 |
| `sharesWith` | 和哪种形态共用数据 |

### 会话 `sessions`

| 字段 | 说明 |
|---|---|
| `format` | 内置格式之一：`claude-jsonl`（Claude Code 的 `projects/<项目>/<会话>.jsonl`）、`codebuddy-jsonl`、`qwen-jsonl`（对应 `claude_compat.rs` 的 `Records`）、`pi-jsonl`；或者 `adapter` |
| `adapter` | `format` 是 `adapter` 时必填，适配器的名字 |
| `dirs` | 会话目录，相对 `home`；`claude-jsonl` 一族默认 `projects` |
| `chats` | 项目目录下还有一层子目录时写它（Qwen Code 是 `chats`） |
| `subagents` | 子代理会话怎么处理：`hide`（默认）或 `nest`（挂到父会话下） |

会话的字段（标题、模型、推理强度、当前工具、待办、上下文 token、权限模式）由格式或适配器决定，不在描述文件里一项项写。缺哪项由适配器的输出体现，功能矩阵按输出自动标 ◐。

### 钩子 `hooks`

| 字段 | 说明 |
|---|---|
| `format` | `claude-compatible`（照抄 Claude Code 的 `hooks` 结构）、`codex`（`config.toml`）或 `adapter` |
| `adapter` | `format` 是 `adapter` 时必填。DSH（生成 Cordis 插件）、opencode 1.x（生成 JS 插件）、Antigravity（`hooks.json` 自有格式）都是这种 |
| `file` | 钩子配置文件，相对 `home` |
| `events` | 岛的事件对应这家的哪个事件名：`start`、`activity`、`stop`、`failed`、`waiting`、`approval`。没有的写 `null`。`claude-compatible` 的几家装的是固定的一组：`UserPromptSubmit`、`PreToolUse`、`Stop`、`StopFailure`，等授权是 `PermissionRequest`（`waitingKind` 为 `permissionRequest`）或带 `permission_prompt` 匹配的 `Notification`，审批是 `PermissionRequest`；`build.rs` 会核对描述文件写的和这组一致 |
| `waitingKind` | `permissionRequest`（有单独的等授权事件）或 `permissionPrompt`（从 `Notification` 一类事件里认），对应 `Compat.waiting` |
| `inputAliases` | 钩子输入的字段和 Claude Code 不同名时的对照，对应 `Compat.aliases` |
| `restartRequired` | 改完配置要不要彻底退出再开才生效（WorkBuddy 要） |

`install`、`check`、`uninstall` 三个动作对所有格式都一样，协议只规定它们要遵守的规则（这些规则已经是 B73 的要求）：

- `uninstall` 只剥离浮屿受管的条目、标记块和独占的插件文件；剥完变空的事件或 `hooks` 键一起删；内容没变不写盘；配置文件不存在时不新建。
- 写进外部配置的命令要包一层脚本存在性守卫，脚本不在时直接退出 0。
- 写文件前先确认家目录存在，不自己创建顶层家目录。

### 审批 `approval`

| 字段 | 说明 |
|---|---|
| `reply` | 岛上点了允许 / 拒绝后怎么答复：`permissionRequest`、`preToolUse`（附带工具名匹配）、`behavior`、`none`（只能交回终端），这四种对应 `Compat.reply`；钩子是适配器的（DSH、Antigravity）写 `adapter`，答复格式由钩子适配器决定 |
| `tools` | 只拦哪些工具；不写表示全部（Antigravity 只拦 `run_command`） |
| `questions` | 能不能在岛上回答提问（现在只有 Claude Code） |

### 信号 `signals`

岛上的会话状态 `light` 由几种信号推出来（见下一节）。每家声明自己能提供哪几种、从哪来：

| 信号 | 取值 | 说明 |
|---|---|---|
| `running` | `hook`、`session`、`adapter`、`null` | 一轮开始、进行中。`hook` 指钩子写的运行标记，`session` 指从会话文件末尾推断 |
| `done` | 同上 | 一轮结束 |
| `waiting` | `hook`、`approval`、`adapter`、`null` | 等授权。`approval` 指只有岛上审批挂起时才知道（Antigravity） |
| `replyMarker` | `true` / `false` | 能不能从最后一条回复里认出 `↩ ⋯ ✓`，要求 `replyMarker.promptFiles` 有值 |
| `exited` | `hook`、`process`、`adapter`、`timeout` | 怎么判断会话已经退出。`hook` 指钩子记下的结束时间或进程号（`session_records.rs`）；`process` 指按 `forms.*.process` 看程序还在不在；`timeout` 指只靠 10 分钟没动静 |

缺 `waiting` 的家，会话环上不会出现红色；缺 `replyMarker` 的，不会出现黄色。设置页的说明和功能矩阵按这里生成，不再手写。

### 回复标记 `replyMarker`

| 字段 | 说明 |
|---|---|
| `promptFiles` | 全局提示词文件，相对 `home`，回复标记那一段写在文件末尾。例如 Qwen Code 的 `QWEN.md`、DSH 的 `AGENTS.md` |

### 额度 `quota`

额度来源 id 的数组，例如 Claude Code 写 `["claudeCode", "glm", "kimi"]`（GLM、Kimi 的编程套餐都能接进 Claude Code），DSH 写 `["dsh"]`。用量环只显示用户在设置里打开、而且凭据可用的那几个。

### 远程 `remote`

只给 `forms.cli.linux` 写了能跑的 CLI 形态做。远端只有用户自己装的 CLI，岛的 Rust 和 Node 宿主都跑不到远端，所以远端只做两件事：按 `pull` 把文件拉回本机的镜像目录，按 `hooks` 改远端的配置文件。会话的解析全在本机，用同一个格式或适配器读镜像目录。

| 字段 | 说明 |
|---|---|
| `pull.find` | 远端执行的 `find` 片段，列出时间窗内要拉的文件；`$W` 是分钟数 |
| `pull.sessionDirs` | 会话目录前缀，下面的 `.jsonl` 都拉 |
| `pull.files` | 单独要拉的文件 |
| `pull.checkpointDirs` | 检查点目录，下面一层的 `.json` / `.pbtxt` 整份拉，单个不超过 512 KB |
| `extract` | 远端要先抽一份小数据再拉回的，写抽取脚本的名字（opencode 的 sqlite）；远端的抽取只能用 `sh`、`sqlite3`、`python3` 这类服务器上一般都有的命令 |
| `hooks` | 远端也装钩子：复用上面的 `hooks`，路径按远端家目录解析 |
| `approval` | `reverseForward`（经 SSH 反向转发回岛）或 `null` |
| `replyMarker` | 远端的提示词文件也写回复标记 |

`pull` 的几项同时是镜像目录的白名单：不在里面的路径不写进镜像。

### 跳转 `focus`

| 字段 | 说明 |
|---|---|
| `apps` | 这家自己的窗口程序，按 `forms` 分开：`{ "app": ["workbuddy"], "ideExtension": ["antigravity ide"] }`。值是跳转宿主的 id |
| `adapter` | 要先按会话判断是哪种形态时写（Antigravity 按钩子的 `transcriptPath` 判断） |
| `exact` | 能不能定位到具体会话：`tab`（能）、`window`（只到窗口，给提示）。只写 CLI 形态的话，跳转交给终端宿主，这里不用写 |

### cc-connect 和推送

| 字段 | 说明 |
|---|---|
| `ccConnect` | cc-connect 配置里这家的 `agent` 名（`claudecode`、`codex`）；不支持写 `null` |
| `push.takeover` | 手机推送的接管命令模板，`{sessionId}`、`{cwd}` 会被替换；没有写 `null` |

## 会话状态 `light`

会话环、Agent 页的状态灯和中心图案的宠物都只读 `light` 和 `unseen`，不认是哪一家。`light` 按下面的顺序推出来（现在的实现是 `agent_status/host.rs` 的 `light()`）：

| 条件（从上往下，命中即停） | `light` | 会话环颜色 |
|---|---|---|
| `phase` 是 `waiting` | `needs` | 红 |
| `phase` 是 `running` | `working` | 绿 |
| `phase` 是 `stale`（10 分钟没动静） | `stale` | 淡绿 |
| `phase` 是 `failed` | `failed` | 红 |
| 回复标记是 `↩` | `yourTurn` | 黄 |
| 回复标记是 `⋯` | `working` | 绿 |
| 有别的回复标记 | `done` | 灰 |
| 没有标记，但最后一句是在提问 | `yourTurn` | 黄 |
| 没有标记，还有后台任务 | `working` | 绿 |
| 其他 | `done` | 灰 |

`needs`、`yourTurn`、`failed` 被用户看过之后（`unseen` 为 false）在会话环上按 `done` 算。`phase` 由信号得出：`waiting` 信号优先，其次 `running`，都没有时看 `done` 和超时。

所以一家 harness 只要适配器输出 `phase`、`replyMarker`、`replyAsks`、`backgroundTasks` 这几项，就自动接上会话环，不用改会话环的代码。

## 额度来源

文件名是 `<id>.json`，完整约束看 `quota.schema.json`。

| 字段 | 说明 |
|---|---|
| `id`、`name` | 同 harness。现有的 id（`claudeCode`、`codex`、`antigravity`、`glm`、`kimi`、`workbuddy`、`dsh`）存在用量环的设置里，不改名，所以有几个和 harness 的 id 一样 |
| `display` | `ring`（画圆环，数据是百分比）或 `hover`（只在悬停时显示，例如积分、钱包余额） |
| `windows` | 能提供哪些窗口：`fiveHour`、`sevenDay`、`models`（按模型分）、`balance`。和 `agents/v1` 的 `AgentUsageReport` 字段对应 |
| `auth` | 凭据从哪来：`{ "kind": "credential", "entry": "glm" }`（凭据管理器 `com.tixxin.fuyu.plan-usage` 下的条目）、`{ "kind": "file", "path": "~/.claude/.credentials.json" }`、`{ "kind": "none" }` |
| `adapter` | 取数和解析的适配器。HTTP 接口的地址也写在适配器里，不写进描述文件，免得第三方描述把 key 发到别的地址 |
| `refreshSeconds` | 最短刷新间隔 |
| `color` | 环的颜色，写 CSS 变量名（`--usage-glm`），深色模式由主题处理 |

额度来源的数据统一成 `AgentUsageReport`（`updatedAt`、`fiveHour`、`sevenDay`、`models`、`plan`、`source`、`error`）。第三方插件经 `agents/v1` 的 `usage().extra` 贡献，键是额度来源的 id。

## 跳转宿主

文件名是 `<id>.json`，完整约束看 `host.schema.json`。

| 字段 | 说明 |
|---|---|
| `id` | 小写的程序名（不带 `.exe`），和现在 `KNOWN_HOSTS` 的第一列一致，例如 `windowsterminal`、`zed` |
| `name` | 显示名 |
| `kind` | `terminal`、`editor`、`app` |
| `process` | `{ "windows": ["zed.exe"], "macos": ["zed"] }`；一个宿主在两个平台上程序名不同时都写 |
| `cli` | 宿主自己的命令行，`{ "windows": "zed.exe", "macos": "zed" }`；用到 `openFolder` 或 `editorExtension` 时必填（现在 `editor_extension.rs` 的 `EDITORS` 第三列就是它） |
| `focus` | 按顺序试的聚焦策略名，前一个失败就试下一个 |

harness 的 `focus.apps` 里写的 App（WorkBuddy、DSH 桌面版）也是跳转宿主，`kind` 是 `app`。

聚焦策略是内置的一组，不让描述文件里写任意命令：

| 策略 | 做什么 | 精确到 | 现在的实现 |
|---|---|---|---|
| `processChain` | 沿会话进程往上找到宿主窗口 | 窗口 | `focus.rs` 的 `process_chain` + `window_focus` |
| `windowTitle` | 按工作目录名、会话标题匹配窗口标题 | 窗口 | `window_focus::focus_session_window` |
| `windowsTerminalTab` | Windows Terminal 按标题切标签 | 标签 | `wt_selected` 一路 |
| `weztermPane` | `wezterm cli activate-pane` | 窗格 | `wezterm.rs` |
| `tmuxPane` | `tmux select-pane` | 窗格 | `tmux.rs` |
| `orcaTerminal` | Orca 的切终端接口 | 标签 | `orca.rs` |
| `editorExtension` | 浮屿的编辑器扩展切到对应终端 | 标签 | `editor_extension.rs`，只支持 VS Code 一族 |
| `macTerminalTab` | Terminal、iTerm2、Ghostty 用 AppleScript 选标签 | 标签 | `select_mac_terminal_tab` |
| `openFolder` | 用宿主自己的命令行打开工作目录，让它把那个窗口切到前台 | 窗口 | 还没有。Zed 打算用这个（`examples/hosts/zed.json`）；`zed <目录>` 会不会切到已开的窗口、Windows 上命令行叫什么，都没实测 |

新的终端或编辑器跳不过去时，先看能不能只靠加一个宿主描述、组合已有的策略解决；确实要新的切换方式，再加一种策略。

## 适配器的规则

适配器是描述文件里数据写不下的那部分代码。内置的是 Rust 函数，第三方的是第 3 版插件里的函数。规则对两种一样：

1. **会话适配器是纯函数**：输入是一个根目录（本机的家目录，或者 SSH 拉回来的镜像目录）和时间窗，输出是会话列表。不联网、不开子进程、不写文件。只有这样，本机和远程才能共用一个适配器。
2. **要调实时接口的不算会话适配器**：opencode 2.x 的后台服务、额度接口这类，各自是单独的适配器，并在 `remote` 里写明远端不支持。
3. **输出的字段**是 `AgentSessionSummary` 的子集：`sessionId`、`cwd`、`title`、`model`、`effort`、`phase`、`lastMessage`、`replyMarker`、`replyAsks`、`updatedAt`、`currentTool`、`permissionMode`、`todos`、`contextTokens`、`backgroundTasks`、`closed`、`parentId`。不认识的字段丢掉。
4. **钩子适配器**实现 `install`、`check`、`uninstall`，遵守上面「钩子」一节的规则。
5. **额度适配器**返回 `AgentUsageReport`；凭据只由 Rust 读，不经过前端或插件。第三方插件要用凭据的，走第 3 版的密钥规则（[v3-secrets.md](../plugins/v3-secrets.md)）。

## 分发

| 层 | 放在哪 | 能带代码吗 | 谁用 |
|---|---|---|---|
| **内置** | 仓库里，`include_str!` 编进程序 | 能，Rust 适配器 | 随浮屿发布的十八家 |
| **本机** | `<fuyu-home>/agent-providers/<id>.json` | **不能**，只认数据：`format` 只能写内置格式，`adapter` 只能引用内置适配器 | 用户自己接一家照抄 Claude Code 格式的代理 |
| **插件** | 第 3 版插件包里的描述文件，由 `package.json` 列出路径 | 能，插件里的代码经 `agents/v1` 接缝提供适配器 | 进插件市场的第三方接入 |

本机这一层是 B71 的 `agent-providers.json` 的正式格式：旧文件照旧能读，读成只有 `id`、`name`、`sessions.dirs` 的描述。

插件这一层要在第 3 版清单的 `fuyu` 下加一个字段，打算写成 `"agents": { "harnesses": ["agents/my-agent.json"], "quotas": [], "hosts": [] }`，只列文件路径，描述本身照本协议写。现在的清单「全部字段」里没有它，第 5 步动手前要先改清单 schema（`packages/plugin-manifest`）和[方案](../plugins/v3-everything-plugin.md)里的字段表。

**钩子是一项权限。** 描述文件能让岛往别人的配置文件里写钩子命令，所以本机这一层的描述**不能**写 `hooks`，只能读会话和状态。要装钩子的第三方接入必须走插件，经签名和安装确认（[v3-everything-plugin.md](../plugins/v3-everything-plugin.md)「第 5 阶段开头定下的细则」）。内置和插件里的钩子命令都只能调浮屿自己的脚本（`running`、`status`、`approval`），不能写任意命令。

## 和现有代码的对照

迁移时每一项从左边搬到右边；搬完的左边删掉。

| 现在 | 协议里 |
|---|---|
| `harness.rs` 的 `Harness { id, hooks, status_light, sessions, remote }` | `id`、`hooks`、`signals`、`sessions`、`remote` |
| `claude_compat.rs` 的 `Compat { homes, chats, records, prompt_file, waiting, hooks_file, reply, aliases }` | `forms.cli.home`、`sessions.chats`、`sessions.format`、`replyMarker.promptFiles`、`hooks.waitingKind`、`hooks.file`、`approval.reply`、`hooks.inputAliases` |
| 各家模块的 `prompt_files()`、`reply_marker.rs` 的 `PROMPT_FILES` | `replyMarker.promptFiles` |
| `StatusLight { running_marker, running_hold }` 的文件名 | 不写：一律按 `agent-<id>-running.flag` 生成 |
| `RemoteFiles { find, session_dirs, files, checkpoint_dirs }` | `remote.pull` |
| `remote_setup.rs` 只认 Claude Code 和 Antigravity | `remote.hooks`、`remote.approval` |
| `agent_approval/decision.rs` 的 `Agent` 枚举 | 有 `approval` 的 harness 都能审批，路由按 id |
| 前端 `agents.ts` 的 `AGENTS { label, statusLight, remote }` | `name`、`signals`、`remote` |
| `usageRing.ts` 的 `USAGE_PROVIDERS`、`HOVER_USAGE_PROVIDERS` | 额度来源描述的 `display` |
| `claude_usage/plan.rs` 的 GLM、Kimi | `examples/quota/glm.json` 这类描述 + 适配器 |
| `session_host.rs` 的 `KNOWN_HOSTS` | 跳转宿主描述 |
| `focus.rs` 的 `provider_apps` | `focus.apps`、`focus.adapter` |
| `editor_extension.rs` 的 `EDITORS` | 宿主描述里 `focus` 含 `editorExtension` 的那几个 |
| `cc_connect/config_file.rs` 的 agent 名 | `ccConnect` |
| `third_party.rs` 的 `agent-providers.json` | 本机这一层 |

## 分步迁移

1. **第 0 步（B76，已完成）**：协议、schema、示例。
2. **照抄 Claude Code 钩子的几家改成只有 JSON**：
   - **已完成（B77）**：qoder、codebuddy、qwen。描述文件在 `src-tauri/src/agent_status/harnesses/<id>.json`；`src-tauri/build.rs` 编译时读它们，在 `OUT_DIR/compat_harnesses.rs` 里给每家生成一行 `claude_compat::compat_harness!(…)`，宏（`claude_compat.rs`）展开成和原来 `qwen.rs` 一样的模块（`PROVIDER`、`SPEC`、`HARNESS`、`prompt_files`），`agent_status/mod.rs` 用 `include!` 引入，所以 `harness.rs`、`reply_marker.rs` 这些引用的地方不用改。描述文件写错（缺字段、取值不认识、事件名和实际装的不一致、`id` 和文件名不同）时编译失败，报出文件和字段。这一步只读协议里生成 `Compat` 用得到的字段，`signals`、`icon`、`ccConnect` 等先只是记录。
   - **还没做**：grok、copilot、droid 有各自的额外代码，只把 `Compat` 部分挪进 JSON，`Reply::PreToolUse` 的工具匹配要先在生成里支持；前端的 `AGENTS` 从同一批 JSON 生成（现在前端还是手写的一行）。
   - **接一家新的照抄 Claude Code 的代理**：加一份 `harnesses/<id>.json`，再在 `harness.rs` 的 `HARNESSES`、`claude_compat.rs` 的 `SPECS`、`reply_marker.rs` 的 `PROMPT_FILES`、三份钩子脚本、审批的 `Agent` 枚举、前端 `AGENTS` 和图标里各加一项（照 `fuyu-agent-harness` skill，第 3 步之前还是手写）。
3. **其余家挪声明**：路径、进程名、提示词文件、远程、cc-connect 挪进 JSON，解析代码原地不动，JSON 里写 `adapter` 指向它。审批的 `Agent` 枚举改成按 id 路由。
4. **额度来源和跳转宿主**：`USAGE_PROVIDERS`、`KNOWN_HOSTS`、`provider_apps` 改成读描述；拿 WorkBuddy（#862 / #852）和 Zed 的跳转作为第一批验收。
5. **第三方接入**：本机这一层（兼容 B71 的旧文件），插件清单的 `fuyu.agents`；`fuyu-agent-harness` skill 精简成指向本文。

每一步都不改对外契约：provider id、`agent-status.json` 的格式、标记文件名、设置里的 key 都保持不变（[contracts.md](../contracts.md)）。
