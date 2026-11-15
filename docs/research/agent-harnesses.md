# 接入更多 AI 代理：Antigravity、WorkBuddy、DeepSeek Harness、opencode

> 2026-11-15 追加豆包（issue #312，任务 B29），见下面「豆包」一节，结论在那一节开头。

> 2026-11-14 追加 opencode（issue #349，任务 B30），见下面「opencode」一节，结论在那一节开头。

> 日期：2026-11-13。问题：Agent 页的会话列表能不能接入 Antigravity、WorkBuddy、DeepSeek Harness，本地和 SSH 都行不行，用量环能不能扩到这三家（issue #155）。范围：三家的官方文档、GitHub 仓库和 issue、社区文章；Atoll（macOS 刘海岛）读 Antigravity 额度的源码；本机 `~/.workbuddy`（WorkBuddy 5.3.8 留下的 17 个会话文件）。本机没装 Antigravity 和 DeepSeek Harness，zcm6 上三家都没装，所以只有 WorkBuddy 5.3.8 的会话格式是看过真实文件的，其余按文档。相关任务：B23（B23.1 本文，B23.2 WorkBuddy，B23.3 Antigravity）。

## 结论

| | 本地会话列表 | 「等你」 | SSH | 用量环 | 从岛上应答审批 |
|---|---|---|---|---|---|
| WorkBuddy（国内版） | 能，格式和 Claude Code 很像 | 能，钩子有 `PermissionRequest` 和 `Notification` | 不适用，只有桌面版 | 没有接口，只有每条记录消耗的积分 | 社区实测能在钩子里阻塞应答 |
| Antigravity | 能，`brain/<id>/.system_generated/logs/transcript.jsonl`；格式未核实 | 不能：钩子没有等待或审批事件 | CLI 能跑 Linux，但要 glibc ≥ 2.28（未核实），zcm6 跑不了 | 能读 5 小时和每周额度，但靠不公开的本地 RPC | `PreToolUse` 能返回 `allow` / `deny` / `ask` |
| DeepSeek Harness | 会话是 zstd 压缩的 JSONL，要解压 | 不能：钩子桥不支持 `PermissionRequest` / `Notification` | 是 Node 程序，能跑服务器 | 只有账户余额，不是额度窗口 | 钩子桥的 `PreToolUse` 只认 deny / ask |

建议（用户 2026-11-13 定）：

- **这一轮内置 WorkBuddy 国内版（B23.2）和 Antigravity（B23.3）**，做到会话列表、标题、亮灯和品牌图标。WorkBuddy 能做到三态；Antigravity 只有运行中 / 完成两态。
- WorkBuddy 国际版（`~/.workbuddy-ai`）是另一个产品，钩子写进去没人实测成功过，会话格式也没找到，这一轮不做。
- DeepSeek Harness 是开发者预览版，会话要解压、钩子缺等待事件，这一轮只记录，等它稳定或有人在用时再定是内置还是写插件。2026-11-13 追加（B24）：参考 flyl1u/fly-island 的接法内置了，不解压会话、不用钩子，读 DSH 自己写的投影检查点（`storages/session_projcache/sessions/<id>.json`，普通 JSON），能做到三态（等你来自 `userQuestions` 里打开的提问），见 [agent-status-hooks.md](../features/agent-status-hooks.md#deepseek-harness)。
- SSH、用量环、从岛上应答审批这一轮都不做，做法记在下面，以后照着做。

## 详细

### WorkBuddy

**两个产品**：`~/.workbuddy` 是国内版 WorkBuddy，`~/.workbuddy-ai` 是国际版 WorkBuddy AI，不是同一个产品的新旧两代 [6]（未核实，来自 issue 讨论）。国内版最新正式版 5.9.3（2026-10-27），灰度 5.11.0（2026-11-03）[8]。没有 Linux 官方下载入口，社区找到了腾讯 CDN 上的 deb / rpm（5.6.2）[9]，没有服务器或无头版本，所以 SSH 不适用。

**会话文件**（国内版，本机 5.3.8 实测）：

- `~/.workbuddy/projects/<编码后的 cwd>/<sessionId>.jsonl`，一行一条记录，每条都带 `sessionId`、`cwd`、`timestamp`（毫秒）。
- 记录类型：`message`（`role` 是 `user` / `assistant`，`status` 是 `completed` / `incomplete`，内容是 `input_text` / `output_text`）、`function_call` / `function_call_result`（`name`、`callId`）、`reasoning`、`file-history-snapshot`、`ai-title`（`aiTitle` 就是标题）。
- 模型在 `providerData.requestModelName`（如 `Kimi-K3`、`Hy3`）。
- `~/.workbuddy/sessions/<pid>.json` 是活动进程登记：`pid`、`sessionId`、`cwd`、`lastHeartbeat`、`version`，和 Claude Code 的 `~/.claude/sessions` 一样，能判断会话是否已退出。
- 判断状态：最后一条是 `function_call` 或没有结果的工具调用时算运行中；最后一条是 `assistant` 的 `completed` 消息时算这一轮结束。

国际版有 `sessions/` 目录，没见到 `projects/`，格式没找到 [6]。

**钩子**：官方文档和实测不一致。

- 官方文档 [5] 写的是 `~/.codebuddy/settings.json` 和工作区的 `.codebuddy/settings.json`，格式和 Claude Code 相同；事件有 `SessionStart`、`SessionEnd`、`PreToolUse`、`PostToolUse`、`UserPromptSubmit`、`Stop`、`PreCompact`；公共字段 `session_id`、`transcript_path`、`cwd`、`hook_event_name`。
- 社区实测 [7]：写在 `~/.workbuddy/settings.json` 的 `hooks` 下才会触发，改完要完全退出 WorkBuddy 再启动。实测触发的还有 `PermissionRequest`（dontAsk 模式下不触发）和 `Notification`（见过 `idle_prompt`），能在钩子里阻塞，等用户点允许或拒绝再回传。
- `Stop` 的输入没有 `session_id` [7][10]。对我们影响不大：完成状态从会话文件读，钩子只用来亮「等你」。

**用量**：没有接口。每条记录的 `providerData.rawUsage.credit` 是单次消耗的积分，剩余额度要用户自己填 [11]。用量环不做。

### Antigravity

**三个产品**：App、IDE、CLI（替代了 Gemini CLI）。数据目录分别是 `~/.gemini/antigravity`、`~/.gemini/antigravity-ide`、`~/.gemini/antigravity-cli` [1]。

**钩子** [1]：

- 位置：全局 `~/.gemini/config/hooks.json`，工作区 `.agents/hooks.json`，三个产品都读。
- 格式：`{"<钩子名>": {"enabled": true, "<事件>": [...]}}`。`PreToolUse` / `PostToolUse` 的元素是 `{"matcher": "<工具正则>", "hooks": [{"type": "command", "command": "...", "timeout": 30}]}`，其余事件直接写 handler 列表。超时单位是秒，默认 30。
- 事件只有 6 个：`SessionStart`、`PreToolUse`、`PostToolUse`、`PreInvocation`（每次调模型之前，可以当「这一轮开始」）、`PostInvocation`、`Stop`（带 `terminationReason`，后台任务还在跑时 `fullyIdle` 为 false）。
- **没有** `Notification` 或 `PermissionRequest`，所以看不出它在等用户确认，「等你」做不了。
- 输入（camelCase）：`conversationId`、`workspacePaths[]`、`transcriptPath`、`artifactDirectoryPath`、`modelName`、`lastUserInput`。属于哪个产品要从 `transcriptPath` 反推。2026-11-13 用 `agy` CLI 1.5.8 实测：输入里其实有 `cwd`（Windows 反斜杠路径），还有 `hookEventName`；`workspacePaths` 是 `C:/...` 正斜杠写法；PreInvocation 多 `invocationNum`，Stop 多 `fullyIdle`、`terminationReason`、`error`。
- `PreToolUse` 能在 stdout 返回 `decision`（`allow`、`deny`、`ask` 等），所以以后可以做成从岛上应答审批：钩子阻塞，等岛上点了再回答。

**会话文件**：

- 记录在 `<数据目录>/brain/<conversationId>/.system_generated/logs/transcript.jsonl` [1]；CLI 1.5.8 实测文件名是 `transcript_full.jsonl`。每行的格式没找到文档，B23.3 要做成读不懂的记录就跳过。
- 标题：CLI 有 `conversation_summaries.db`（SQLite，表 `conversation_summaries` 有 `title`、`status`、`last_modified_time`）和 `annotations/<id>.pbtxt`（`title:"..."`）[12]（未核实）。App 和 IDE 的 `conversations/*.pb` 是加密的 protobuf，新版 IDE 改成 `*.db` [13]（未核实）。为了不读加密文件、不加 SQLite 依赖，标题先用第一条用户输入，读不到就用文件夹名，和 Claude Code 没有标题时的做法一样。

**用量**：`/usage` 按模型组（Gemini、第三方模型）给出 5 小时和每周两个窗口，显示剩余量 [2]，和现在的用量环正好对得上。Atoll 的做法 [14]：

1. 找命令行里含 `language_server` 的 Antigravity 进程，从参数取 `--csrf_token` 和端口；桌面版端口是 0，要查进程实际在听哪个端口。
2. `POST http(s)://127.0.0.1:<端口>/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`（失败再试 `GetUserStatus`），请求头带 `x-codeium-csrf-token`，返回 `groups[].buckets[]`，每个桶有 `bucketId`（`gemini-5h`、`gemini-weekly`、`3p-5h`、`3p-weekly`）、`remainingFraction`、`resetTime`。
3. 岛没开时用凭据里的 token 调 `cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary`。

这些都是内部接口，随版本可能失效，而且在 Windows 上没人验证过。用户定这一轮不做，等有人能实测时再新增 `UsageSource::Antigravity`。

**Linux**：CLI 用 `install.sh` 装到 `~/.local/bin/agy` [3]。官方只给 App 和 IDE 写了 Linux 要求（glibc ≥ 2.28）[4]，社区说 CLI 也要 2.28，另有说法是 2.17 也行，互相矛盾（未核实）。zcm6 是 CentOS 7、glibc 2.17，大概率跑不了。

### DeepSeek Harness（dsh）

- 仓库 `deepseek-ai/deepseek-harness`，MIT，2026-08-13 建，开发者预览版，最新 tag `dsh-v0.2.2-rc.3`（2026-11-13）[15]。`npx @deepseek-ai/dsh web` 在 `127.0.0.1:3080` 起 Web UI；另有 Electron 桌面版。Node 能跑的地方都能跑，所以能上服务器。
- 数据在 `$DSH_HOME`（默认 `~/.dsh`）。会话在 `sessions/--<规范化的 cwd>--/<编码后的 id>/session.v3.jsonl.zstd`，默认是带校验的 zstd 帧拼接，不能按行直接读，写的时候有 `session.lock` [15]。
- 钩子桥 `@deepseek-ai/dsh-hooks-claude-code` 在 `cordis.yml` 里挂载，读一份 Claude Code 格式的钩子配置，支持 `SessionStart`、`UserPromptSubmit`、`PreToolUse`（只认 deny / ask）、`PostToolUse`、`Stop`、`SubagentStart`、`SubagentStop`；`transcript_path` 恒为空；不支持 `PermissionRequest`、`Notification`、`SessionEnd` [15]。
- 审批：内部服务，结果有 `allowed-once` / `rejected` / `cancelled` / `unavailable`，会话日志里有 `approval/asked` / `approval/decided` 事件 [15]。所以以后「等你」可以从解压后的会话日志读出来。
- 本地 HTTP API `POST /api/<namespace>/<method>`，要认证 [15]。社区文章提到的 `dshctl` 在仓库里没找到。
- 用量：DeepSeek API 按量付费，只有余额 `GET https://api.deepseek.com/user/balance`（`balance_infos[].total_balance`）[16]，不是额度窗口，放不进用量环。

最省事的接法是写一个现成的钩子脚本：用钩子桥的 `SessionStart` / `UserPromptSubmit` / `Stop` 调本地 API `PUT /v1/agent-status/{source}` 上报（见 [agent-status-hooks.md](../features/agent-status-hooks.md)「其他工具」），能做到运行中 / 完成两态和会话名，不用改岛的代码。要做到会话列表和「等你」，就要内置：解压 zstd（要加依赖）、读 `approval/asked`。

### SSH（以后做）

现在的远程读取（`remote_fetch.rs`）是一条长连接加一段 `sh` 脚本，把远端会话文件的头尾拉回 `remote-sessions/<主机>/`，按家目录的结构摆好，再交给本地扫描读。新工具只要会话文件是纯文本，就只需要在脚本要拉的目录里加上它的目录；远端钩子照现有做法把输入写成文件，放进 `~/.fuyu/agent-notifications/`。

- WorkBuddy：没有服务器版，不做。
- Antigravity CLI：加 `~/.gemini/antigravity-cli/brain/`；钩子写进远端的 `~/.gemini/config/hooks.json`。前提是服务器的 glibc ≥ 2.28。
- DeepSeek Harness：会话是 zstd，远端脚本只用 `head` / `tail` 拉不了，要远端有 `zstd` 解压后再拉，或者整个文件拉回来在本地解压。

## opencode（2026-11-14 追加）

> 日期：2026-11-14。问题：岛能不能接入 opencode（issue #349），会话列表、三态、等你、审批、回复标记、用量、SSH、跳转各能做到哪一步。范围：opencode 仓库 `anomalyco/opencode`（原 `sst/opencode`，226k star，查询日期 2026-11-14）的 `main`（提交 `d432a06`，即 v2.3.0，2026-11-13 发布）和 v1.19.5 标签（2026-10-28 发布）的源码与 `CHANGELOG.md`，仓库里的自述文档 `packages/core/src/plugin/skill/opencode.md`；cc-connect 的 README。本机没装 opencode，下面全部**按文档和源码，未实测**。相关任务：B30。

### 结论

opencode 现在有两条线同时在发：**2.x**（2.0 在 2026-10 初发布，最新 v2.3.0）和仍在维护的 **1.x**（最新 v1.19.5）。两条线的会话都在同一个 sqlite 文件 `~/.local/share/opencode/opencode.db` 里，但表不同；2.x 启动时把 1.x 的会话导进新表（导入后旧表删不删未核实）。2.x 改成了「后台服务 + 客户端」：TUI、桌面版、`opencode serve`、VS Code 扩展都连同一个后台服务，服务把地址、pid 和密码写在 `~/.local/state/opencode/service.json`。

推荐做法（分两步，和 B31 之后的代理列表对齐）：

1. **会话列表和三态：读 sqlite**（2.x 读 `session_v2`，1.x 读 `session` / `message`），只读打开，不装任何东西，TUI、桌面版、serve、IDE 的会话都在里面。2.x 的会话表直接有 `time_busy`、`time_idle`、`idle_outcome`（`succeeded` / `failed` / `interrupted`），三态不用自己猜。代价是岛要加一个 sqlite 依赖（Rust 侧现在没有，推荐 `rusqlite` 的 `bundled` 特性）。
2. **等你和在岛上审批：2.x 直接调后台服务的 HTTP 接口**，不写插件：从 `service.json` 取地址和密码（Basic 认证），`GET /api/permission/request` 列出所有待批的请求，`POST /api/session/:sessionID/permission/:requestID/reply` 回 `once` / `always` / `reject`；想要实时就订阅 `GET /api/event` 的 SSE（`permission.asked`、`permission.replied`、`session.execution.*`）。TUI 里照样弹框，谁先回谁算。1.x 没有这个服务，要等你只能装一个 1.x 插件（`permission.ask` 钩子 + `event` 钩子写事件文件），建议先不做 1.x 的等你和审批。

岛屿插件（写事件文件）这条路能做，但 2.x 和 1.x 的插件接口互不兼容（官方说 2.x 唯一有意的破坏性改动就是服务端 API 和插件 API），要写两份，2.x 的插件还要按 Effect 4 的约定打包；而它能拿到的东西 2.x 的 HTTP 接口都有。所以不推荐作为主路线，只在要支持 1.x 的「等你」时再写。

| 功能 | 预计能做到 | 说明 |
|---|---|---|
| 会话列表、标题、模型、目录 | ✓ | 2.x：`session_v2.title`、`model`（JSON，`providerID` / `id` / `variant`）、`directory`、`time_updated`；1.x：`session` 表同名字段。子代理会话有 `parent_id`，列表里应过滤或挂到父会话下 |
| 最近提问和回复 | ✓ | 2.x：`session_message` 按 `seq` 取最后的 `user` / `text` 类消息，`data` 是 JSON；1.x：`message` / `part` 两表 |
| 运行中 / 完成 / 出错 | ✓ 2.x，◐ 1.x | 2.x：`time_busy > coalesce(time_idle, 0)` 为运行中，否则按 `idle_outcome` 分完成 / 出错 / 中断。1.x：运行状态只在内存里，只能从最后一条 assistant 消息有没有 `time.completed`、`error` 推断 |
| 判断会话已退出 | ◐ | 2.x 会话属于后台服务而不是 TUI，服务退出时正在跑的会话记为 `interrupted` 原因 `shutdown`，但这种情况**不写** `time_idle`，会一直像在运行；要用 `service.json` 的 pid 判断服务还在不在。1.x 没有进程登记，只能靠超时 |
| 「等你」 | ✓ 2.x（服务在跑时），✗ 1.x | 见上面第 2 步。不开服务的 `--standalone` TUI 用的是私有服务，不写 `service.json`，看不到 |
| 在岛上审批 | ✓ 2.x，✗ 1.x 先不做 | 2.x 用 HTTP 回复，不用挂起钩子；1.x 的 `permission.ask` 钩子能把 `output.status` 改成 `allow` / `deny`，要写插件 |
| 在岛上回答提问 | ✗ 未调研 | 2.x 有表单（`form`）接口，没细看 |
| 回复标记 | ✓ | 全局提示词文件 `~/.config/opencode/AGENTS.md`（`XDG_CONFIG_HOME` 优先），改完不用重启 |
| 用量环 | ◐ | 只有用 OpenCode Go 订阅时才有额度窗口：`GET /api/experimental/usage/limits` 返回 `rolling` / `weekly` / `monthly` 三个窗口的 `percent` 和 `resetsAt`，和用量环对得上；用自己的 API key 时只有每个会话的 token 和花费（`session_v2.cost`、`tokens_*`），没有额度 |
| SSH 远程 | ◐ | CLI 有 linux-x64 / arm64 和 musl 版。会话在 sqlite 里，现在的 `head` / `tail` 拉取脚本拉不了，要整个 `opencode.db`（连同 `-wal`）拉回来再读，或者远端有 `sqlite3` 时在远端查好再拉；远端服务的 HTTP 接口要转发端口才能用。glibc 要求未核实 |
| 点会话跳过去 | ◐ | 进程名 `opencode`（Windows `opencode.exe`），但 2.x 的会话由后台服务跑，服务进程不是用户看的窗口，要找连着它的 TUI 终端；桌面版是 Electron 应用「OpenCode」，注册了 `opencode://` 协议，但没找到打开指定会话的链接（只见到 `opencode://open`）；VS Code 扩展只有「打开终端」的命令 |
| cc-connect | ✓ 按 README | cc-connect 的 README 列出支持 OpenCode，配置细节未核实 |

做不到或这一轮不做的：1.x 的「等你」和审批（要写 1.x 插件）；`--standalone` TUI 的等你和审批；跳到具体会话；用自己 API key 时的用量环；不转发端口时的远程等你和审批。

### 形态

- **CLI / TUI**：`opencode`，Bun 编译的单个可执行文件，装法有安装脚本、npm、Homebrew 等 [17]。2.x 的 TUI 是客户端，连本机后台服务；`opencode --standalone` 起一个只给自己用的私有服务 [18]。
- **后台服务**：2.x 新增，`opencode service status` / `restart` 管理，会话、配置、插件、权限、工具执行都在服务里 [18]。登记文件 `service.json`（正式渠道；其他渠道是 `service-<渠道>.json`），在 `$XDG_STATE_HOME/opencode/`，默认 `~/.local/state/opencode/`，内容 `{id, version, url, pid, password}`，权限 0600；默认端口 49374（0xC0DE），Windows 上是 28894 [19]。`opencode serve` 和桌面版自带的 CLI 也走这个服务。
- **桌面版**：Electron，产品名 OpenCode，用自带的 CLI 启动或复用同一个后台服务 [20]。
- **VS Code 扩展**：`sdks/vscode`，在编辑器里开终端跑 TUI [21]。
- **结论**：2.x 的几种形态共用一个服务、一个数据库、一份配置；会话来自哪种形态在库里分不出来（未核实，没找到相关字段）。

### 数据位置

所有平台都按 XDG 目录，Windows 也是 `%USERPROFILE%\.local\share\opencode`，不用 `%APPDATA%` [22]：

| | 默认位置 | 说明 |
|---|---|---|
| 数据 | `~/.local/share/opencode/`（`XDG_DATA_HOME`） | `opencode.db`；`log/opencode.log` |
| 配置 | `~/.config/opencode/`（`XDG_CONFIG_HOME`） | `opencode.json(c)`、`cli.json`、`AGENTS.md`、`plugin(s)/` |
| 状态 | `~/.local/state/opencode/`（`XDG_STATE_HOME`） | `service.json` |

数据库文件名：环境变量 `OPENCODE_DB` 优先；正式渠道（latest / beta / prod，2.x 还有 dev / next）是 `opencode.db`，其他渠道是 `opencode-<渠道>.db` [23]。1.x 早期把会话存成 JSON（`storage/session/info/*.json`、`storage/session/message/<会话>/*.json`、`storage/session/part/...`），后来的版本启动时把它们迁进 sqlite [24]；现在两条线都不再写 JSON。

### 会话表

**2.x**（表 `session_v2`）[25]：

- `id`、`project_id`、`parent_id`（子代理会话）、`directory`（Windows 上存成正斜杠）、`title`、`version`、`agent`、`model`（JSON）、`cost`、`tokens_input` / `output` / `reasoning` / `cache_read` / `cache_write`、`time_created` / `time_updated`（毫秒）、`time_archived`。
- 运行状态：`session.execution.started` 时写 `time_busy`；`succeeded` / `failed` / `interrupted` 时写 `time_idle` 和 `idle_outcome`；原因为 `shutdown` 的中断不写 [26]。
- 消息在 `session_message`（`session_id`、`type`、`seq`、`data` JSON），类型有 `user`、`text`、`tool`、`shell`、`synthetic`、`system`、`skill`、`agent-switched`、`model-switched` 等 [27]；工具调用等细节在 `session_part`。

**1.x**（表 `session`、`message`、`part`）[28]：`session` 的字段和 2.x 基本相同，但没有 `time_busy` / `time_idle`；运行状态（`idle` / `busy` / `retry`）只在内存里，通过事件 `session.status`、`session.idle` 发出 [29]。消息的 `data` 是 1.x 的消息 JSON：assistant 消息有 `time.created` / `time.completed`、`finish`、`error`、`modelID` / `providerID`。

2.x 导入时按 id 判断 `session` 里的会话是否已在 `session_v2`，所以同一个库里两张表可能都有同一个会话（导入后旧表删不删未核实）；读的时候以 `session_v2` 为准，`session` 只读 `session_v2` 里没有的 id。

### 插件和事件

**2.x**：插件用 `Plugin.define({ id, setup })`，在 `setup` 里通过 `ctx.<领域>.hook(...)` 注册 [30]。和岛有关的：

- `ctx.event.subscribe({ types })`：订阅服务的全部事件，包括 `session.execution.started` / `succeeded` / `failed` / `interrupted`、`session.idle`、`session.status`、`permission.asked`、`permission.replied`、`session.created` / `updated` / `deleted` [31]。
- `ctx.permission.hook("evaluate", ...)`：每次判定权限时调用，可以把 `effect` 改成 `allow` / `deny` / `ask`，回调是异步的，所以能挂起等结果 [32]；`ctx.permission.reply(...)` 回复已经弹出的请求。
- `ctx.session.hook("experimental.idle", ...)`：会话要空闲前调用，实验性 [30]。
- 插件放在 `~/.config/opencode/plugin(s)/` 或项目的 `.opencode/plugin(s)/`，或写进配置的 `plugins` 字段；改完配置自动重新加载，不用重启 [18][33]。

**1.x**：插件是导出一个异步函数，返回钩子对象：`event`（所有总线事件）、`permission.ask`（`output.status` 可改成 `allow` / `deny`）、`tool.execute.before` 等 [34]。放在 `~/.config/opencode/plugin(s)/*.{ts,js}`。2.x 不加载 1.x 插件 [18]。

**HTTP 接口代替钩子（2.x）**：所有接口都要 Basic 认证（密码来自 `service.json`）[35]。

- `GET /api/event`：SSE，可用 `types` 过滤；官方说明它是「易失」的，消费慢了会断流，断开期间的事件会丢 [36]。所以只用来提速，状态仍以数据库为准。
- `GET /api/permission/request`：所有待批请求；`GET /api/session/:id/permission`、`POST /api/session/:id/permission/:requestID/reply` [37]。
- `GET /api/session`、`GET /api/session/active`；`GET /api/experimental/usage/limits` [37]。

### 用量

`/api/experimental/usage/limits` 只对登录了 OpenCode Console、订阅 OpenCode Go 的用户有数据：`go.rolling` / `weekly` / `monthly` 三个窗口，每个有 `percent`、`limited`、`resetsAt`；另有工作区设的月度花费上限 `budgets` [38]。用自己的模型 key 时没有额度，只有会话表里累计的 token 和花费。接口带 `experimental`，随版本可能变。

### 其他

- **全局提示词文件**：`~/.config/opencode/AGENTS.md`，加上项目里从当前目录往上找到的 `AGENTS.md` [39]。回复标记写进全局这份即可。
- **Linux CLI**：安装脚本提供 linux-x64 / arm64，检测到 musl 时装 musl 版，老 CPU 装 baseline 版 [17]。glibc 版的最低要求没找到（未核实），zcm6（CentOS 7，glibc 2.17）能不能跑要实测。
- **cc-connect**：README 的支持列表里有 OpenCode [40]，具体怎么接（ACP 还是 `opencode run`）未核实。
- **跳转**：见结论表。2.x 的会话执行在服务进程里，岛要找的是连着服务的 TUI 进程，进程名同为 `opencode`，命令行里能看到会话 id 的情况未核实。

### 接入时要注意

- 只读打开数据库（`mode=ro`），opencode 开了 WAL，读的时候要能看到 `-wal` 里还没合并的写入，不要只复制 `.db` 文件本身。
- 数据库权限是 0600，岛和 opencode 同一个用户运行，读得到。
- 2.x 的 `session.directory` 在 Windows 上是正斜杠，比较路径前先规范化。
- `service.json` 里有密码，岛只在内存里用，不写日志、不推送到手机。

## 豆包（2026-11-15 追加）

> 日期：2026-11-15。问题：Agent 页能不能接入「豆包」（issue #312），豆包旗下哪种形态能当 harness 接：豆包桌面版、TRAE / TRAE CN（IDE）、TRAE CLI，以及其他字节系的编程代理；每种的会话、三态、钩子、等你和审批、用量、Windows 和 macOS 的差别。范围：本机 `/Applications/Doubao.app`（2.24.10，App Store 版）的安装包结构；TRAE 官方文档 docs.trae.ai（钩子两页）和 docs.trae.cn（TRAE CLI 2.0 各页）；GitHub 上读写 TRAE 数据的第三方项目（deja-vu、CodeIsland、perch、tokscale）；8 月下旬字节整合 TRAE 的报道。本机没装 TRAE 和 TRAE CLI，除豆包桌面版的安装包外都**按文档和第三方源码，未实测**。相关任务：B29。

### 结论

先理清名字：2026-08-24 字节把 TRAE 和扣子并入豆包，**TRAE IDE 和 TRAE CLI 继续作为编程产品、纳入豆包品牌**，另出了办公代理「豆包工作」（来源 43）。所以用户说的「支持豆包」，能落地的是豆包旗下的编程代理 TRAE，豆包聊天客户端本身不是编程代理。

| 形态 | 谁能用 | 会话能不能读 | 运行中 / 完成 | 等你 | 在岛上审批 | 用量 | 判断 |
|---|---|---|---|---|---|---|---|
| 豆包桌面版（聊天客户端） | 所有人 | ✗ 对话存在云端；本地只有浏览器缓存，且 macOS 的 App Store 版在沙盒容器里，外部进程读不了 | ✗ | ✗ | ✗ | ✗ | 不接 |
| 豆包工作（办公代理客户端） | 所有人 | 未核实，没找到本地数据的说明 | 未核实 | 未核实 | 未核实 | 未核实 | 不接，不是编程代理 |
| **TRAE / TRAE CN（IDE，含 SOLO、Agent 模式）** | 所有人，个人免费版也有 | ◐ 本地会话库是 SQLCipher 加密的，读不了；会话只能**从钩子攒出来**（和岛上 Antigravity 的做法一样），装钩子之前的会话看不到 | ✓ 钩子 | ✓ `Notification` 的 `permission_prompt` | ✓ `PreToolUse` 能挂起、回 `allow` / `deny` / `ask` | ✗ 只有账号级用量，走官方接口 | **推荐接** |
| TRAE CLI 2.0（`traecli`） | **只有 TRAE 企业版旗舰版** | ✓ Codex 格式的 rollout JSONL | ✓ | ✓ 钩子（Codex 格式，未核实） | 未核实 | 未核实 | 第二步再做，能复用 Codex 的解析 |
| TRAE CLI 1.x（内部叫 CoCo） | 已进入弱维护 | ✓ `events.jsonl` | ◐ | ✗ 未调研 | ✗ 未调研 | ✗ | 不接 |
| trae-agent（字节开源的 Python 研究项目） | 所有人 | ◐ 只有跑完写到工作目录的轨迹 JSON | ✗ 没有钩子 | ✗ | ✗ | ✗ | 不接 |

**推荐：接 TRAE IDE（国际版和 TRAE CN 一起），用钩子。** 理由：用户群最可能在用的是免费的 TRAE / TRAE CN；它的钩子是 Claude Code 格式的六个事件，岛的钩子脚本和审批流程基本能直接复用；会话列表靠钩子存下的输入拼出来，Antigravity 已经是这么做的（`agent-antigravity/`），有现成的路子。名字在岛上显示为「TRAE」，用 TRAE 的图标；要不要在名字里带「豆包」由用户定。

能做到的：

| 功能 | 预计 | 说明 |
|---|---|---|
| 会话列表、品牌图标 | ◐ | 从钩子攒：`SessionStart` 建会话，`session_id` 做键，`cwd` / `workspace_roots` 做目录。只有装钩子之后、且钩子在跑的会话 |
| 标题、最近提问和回复 | ◐ | 钩子输入没有 `transcript_path`，没有会话文件可读；标题用第一次 `UserPromptSubmit` 的 `prompt` 截断，最近回复用 `Stop` 的 `last_assistant_message`。TRAE CN 另有 `~/.trae-cn/memory/projects/**/session_memory_*.jsonl`，第一条记录的 `intent` 可当标题（perch 这样做，来源 48；只读结构，未实测） |
| 运行中 / 完成 | ✓ | `UserPromptSubmit`、`PreToolUse`、`PostToolUse` 记运行中，`Stop` 或 `Notification` 的 `idle_prompt` 记完成 |
| 「等你」 | ✓ | `Notification` 的 `notification_type` 为 `permission_prompt`、`ask_user_question`、`document_review`、`browser_interaction` 时。注意 `Notification` 是异步的，输出被忽略 |
| 在岛上审批 | ✓ | `PreToolUse` 挂起等岛的结果，回 `hookSpecificOutput.permissionDecision`；`timeout` 默认 30 秒、可在 `hooks.json` 里调。限制：TRAE 的工具在「手动确认」模式时，回 `allow` 也还要用户在 TRAE 里点（文档原话的意思），所以岛上只能可靠地「拒绝」，「允许」只在 TRAE 设成自动执行时生效 |
| 当前工具、待办、模型、权限模式、上下文 token | ◐ / ✗ | 当前工具从 `PreToolUse` 的 `tool_name`（`RunCommand`、`Edit` 等）拿；钩子里没有模型、权限模式、待办和 token |
| 判断会话已退出 | ◐ | 只能看 TRAE 进程在不在（macOS `Trae.app` / `Trae CN.app`，CN 的 bundle id 是 `cn.trae.app`，来源 47），分不清单个会话 |
| 点会话跳过去 | ◐ | 只到 TRAE 窗口，没找到打开指定会话的链接 |
| 回复标记 | ◐ 未核实 | 个人规则文件，第三方文章说是 `~/.trae/user_rules.md`（来源 51），官方没写路径；CN 版是不是 `~/.trae-cn/` 未核实。`Stop` 的 `last_assistant_message` 能拿到回复正文，标记能认 |
| 用量环 | ✗ | 本地没有额度文件；tokscale 是登录后调官方接口同步（来源 49）。和其他几家一样等插件平台第 3 版（#170） |
| SSH 远程 | — | IDE 没有 Linux 无头形态；它自己的 SSH 远程开发是 IDE 连服务器，钩子在本机跑（未核实） |
| cc-connect | ✗ 未调研 | |

工作量估计：和 Antigravity 那次差不多，**约 1.5–2 天**。新模块 `trae.rs`（钩子安装、从钩子存下的输入拼会话、等你）、`HARNESSES` 和前端 `AGENTS` 各一行、品牌图标、`hooks/` 三份脚本加 `trae` 分支、审批 `Agent` 枚举加一项和答复格式（`hookSpecificOutput.permissionDecision`，和 Claude Code 基本一样）、单元测试、文档。真机实测要用户装 TRAE 或 TRAE CN 后做，本机 Mac 现在没装。

要用户定的：

1. 接 TRAE IDE（推荐），还是等 TRAE CLI，或两个都要？TRAE CLI 2.0 只给企业旗舰版，个人用户用不到。
2. 国际版 TRAE 和 TRAE CN 算一家显示，还是分成两家（两个开关、两个名字）？推荐算一家，会话卡片上标国际版 / CN。
3. 「允许」受 TRAE 自身确认模式限制，岛上审批先只做「拒绝 / 交回 TRAE」，还是照样给「允许」按钮、在说明里写明限制？
4. 名字显示「TRAE」还是「豆包 TRAE」？

### 豆包桌面版（本机看过安装包）

- `Doubao.app` 2.24.10，bundle id `com.bot.neotix.doubao`，App Store 版（带 `_MASReceipt`），开了 App 沙盒和应用组 `96L78H6LMH.group.com.bot.neotix.doubao`。界面是自带的 Chromium（`Doubao Browser.app`，内核 147）加载 doubao.com 的网页，注册了 `doubao://` 协议；另带 `mcp-helper`、`command_helper`，说明能在本机跑 MCP 和命令，但这些是聊天里的工具，不是写会话文件的编程代理。
- 数据不在任务里写的 `~/Library/Application Support/Doubao`，而在沙盒容器 `~/Library/Containers/com.bot.neotix.doubao/Data/` 和组容器 `~/Library/Group Containers/96L78H6LMH.com.bot.neotix.doubao/`。在本机终端里 `ls` 这两处都报 `Operation not permitted`：macOS 的「App 数据」保护不让别的应用读沙盒容器，岛来读也一样会被拦，除非用户给岛「完全磁盘访问权限」。官网下载的非 App Store 版放哪未核实。
- 对话存在云端（登录豆包账号后多端同步），本地只有浏览器缓存（LevelDB / IndexedDB 一类），没有可解析的会话格式，没有钩子、审批和用量接口。**结论：不接**。能做的最多是「豆包在运行」这种进程级提示，没有意义。
- Windows 版未看，按同样的结构推断也是 Chromium 外壳 + 云端对话，未核实。

### TRAE / TRAE CN（IDE）

- **形态**：国际版 TRAE（trae.ai）和国内版 TRAE CN（trae.cn），VS Code 分支。2026 年 TraeWork 和 TraeCode 合并成新 TRAE，有 Agent 模式和 IDE 模式，桌面、网页、手机三端（来源 44）。网页和手机上发起的任务跑在云端，岛看不到。
- **会话存储**：现在的版本把对话存在用户数据目录下的 `ModularData/ai-agent/database.db`，SQLCipher 加密；老版本存在 `User/globalStorage/state.vscdb`、`workspaceStorage/*/state.vscdb` 的 `ItemTable`，键 `memento/icube-ai-agent-storage[-<user-id>]`，里面有 `sessionId`、`title`、`createdAt`、`updatedAt`、`messages`，新版本里已经没有对话（来源 45）。用户数据目录按 VS Code 分支的习惯是 macOS `~/Library/Application Support/Trae`（或 `Trae CN`）、Windows `%APPDATA%\Trae`（或 `Trae CN`），未核实。**结论：本地会话读不了，只能靠钩子。**
- **钩子**（来源 42，官方文档）：
  - 配置：全局 `~/.trae/hooks.json`（Windows `%userprofile%/.trae/hooks.json`），项目 `<项目>/.trae/hooks.json`；TRAE CN 用 `~/.trae-cn/hooks.json`（来源 47，CodeIsland 实测）。顶层 `"version": 1`，`hooks.<事件名>` 下是带 `matcher` 的组，组里 `command`、`timeout`（秒，默认 30）；`Stop` 的组另有 `loop_limit`。
  - 六个事件：`SessionStart`（`source` 只有 `startup`）、`UserPromptSubmit`（`prompt`）、`PreToolUse`（`tool_use_id`、`tool_name`、`llm_tool_name`、`tool_input`）、`PostToolUse`（多 `tool_response`）、`Stop`（`stop_hook_active`、`loop_count`、`last_assistant_message`）、`Notification`（`notification_type`、`message`、`tool_use_id`）。驼峰写法的旧事件名不触发（来源 47）。没有 `SessionEnd`、`PermissionRequest`、子代理事件。
  - 公共输入：`session_id`、`cwd`、`hook_event_name`、`workspace_roots`；**没有 `transcript_path`**。CodeIsland 实测还带 `agent_id`、`agent_type`，主会话也带（CN 版主代理见过 `solo_agent`）。环境变量 `TRAE_PROJECT_DIR`，兼容 `CLAUDE_PROJECT_DIR`。
  - 输出：退出码 0 解析 stdout 的 JSON，2 是阻断（`PreToolUse` 时等于 `deny`），其他忽略；`PreToolUse` 回 `hookSpecificOutput.permissionDecision` = `allow` / `deny` / `ask`、`permissionDecisionReason`、`updatedInput`。多个钩子并行时按 `deny` > `ask` > `allow` 取。工具本身是手动确认模式时，`allow` 不跳过确认。
  - 执行环境：macOS / Linux 用 bash，Windows 用 PowerShell。**钩子默认可能在沙箱里跑**（设置 → Hooks 的执行方式有「沙箱中运行」和「本地自动运行」两种），沙箱里的文件访问受限，岛的钩子要写岛的数据目录，可能要用户切到「本地自动运行」，未核实默认值。
  - 启用：在设置 → Hooks 里新建时要点过安全提示才启用；岛直接写 `hooks.json` 后 TRAE 认不认、要不要用户再点一次，未核实（CodeIsland 是直接写文件的）。
  - **和 Claude Code 钩子的关系**：TRAE 能「导入 Claude Code 的钩子」（设置里的开关，读 `~/.claude/settings.json` 和项目的 `.claude/settings*.json`）。用户打开这个开关时，岛装给 Claude Code 的钩子会在 TRAE 里也跑起来，输入是 TRAE 的格式（没有 `transcript_path`），会被岛当成 Claude Code 会话。接入时钩子脚本要能认出是 TRAE（例如有 `workspace_roots` 或 `agent_type` 字段）再分家。
- **用量**：账号级的请求次数 / 额度在官方后台，本地没有文件；tokscale 的 Trae 支持是登录后调官方接口同步成 `~/.config/tokscale/trae-cache/sessions/*.json`（来源 49）。
- **跳转**：进程和窗口是 `Trae` / `Trae CN`；没有打开指定会话的链接（perch 也只能激活应用，来源 48）。
- **Windows 和 macOS**：钩子格式一样，路径换成 `%userprofile%`，命令用 PowerShell 跑；其余未核实。

### TRAE CLI

- **2.0**（命令 `traecli`，第三方见到的别名 `traex`）：官方写明**仅 TRAE 企业版旗舰版客户可用**（来源 46）。macOS、Linux、Windows 都有（Windows 建议 WSL2，原生版首次启动要初始化沙箱），装法是 `install_v2.sh` / `install_v2.ps1`。配置 `~/.trae/traecli.toml`，键名是 Codex 的（`approval_policy`、`default_permissions`、`[mcp_servers.*]`、`[projects."<路径>"] trust_level`），`TRAE_HOME` 能改目录；支持 ACP 和 `traecli exec --json`。
  - 会话：第三方见到的是 `~/.trae/cli/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl`、`archived_sessions/`、`history.jsonl`，**是闭源的 codex-rs 分支写的 Codex rollout**，记录类型 `session_meta`、`event_msg`、`response_item`、`turn_context`，`originator` 是 `codex-tui`；0.201.4 起多了 `item_completed`、`history_mutation`（来源 45）。TRAE 会把运行时注入的内容写成 `role=user` 的 `response_item`，不能直接当用户提问。官方文档写的配置目录 `~/.trae` 和第三方见到的 `~/.trae/cli` 对不上，未核实。
  - 钩子：`~/.trae/cli/hooks.json`，Codex 格式，项目目录要先「信任」钩子才生效（来源 45、46）。
  - 判断：能复用岛的 Codex 解析，会话列表、三态、等你预计都能做，还能做 SSH 远程。但只有企业旗舰版能用，受众小，放第二步。
- **1.x**（内部叫 CoCo，已弱维护，启动 2.0 时会提示迁移）：会话在 macOS `~/Library/Caches/coco/sessions/<id>/events.jsonl`、Linux `~/.cache/coco/sessions/`，字段 `message.message.{role, content}`、`created_at`，真实提问带 `extra.is_original_user_input: true`（来源 45）。不接。

### 其他字节系

- **trae-agent**（GitHub `bytedance/trae-agent`）：开源的 Python 研究型代理，命令也叫 `trae-cli`，和上面的 TRAE CLI 不是一个东西；只把轨迹写成 JSON（`--trajectory-file`），钩子还只是提案（来源 50）。不接。
- **豆包工作**：办公代理，有自己的桌面客户端，和飞书打通，Mac 上能控制电脑；没找到本地数据的说明，未核实。不是编程代理，不接。
- **用豆包模型跑别家代理**：火山方舟的编程套餐让 Claude Code、Codex 等用豆包模型，这种情况岛已经按 Claude Code / Codex 显示，不用另接。

## 来源

1. Antigravity Hooks 文档：https://antigravity.google/docs/hooks/
2. Antigravity CLI `/usage`：https://antigravity.google/docs/cli/commands/usage/
3. Gemini CLI 迁移到 Antigravity CLI：https://github.com/google-gemini/gemini-cli/discussions/27274
4. Antigravity 入门（系统要求）：https://antigravity.google/docs/getting-started/
5. WorkBuddy Enterprise Hooks 文档：https://cloud.tencent.com/document/product/1831/134517
6. teamai-cli #1273（`~/.workbuddy-ai` 与 hooks，2026-11-10 仍未解决）：https://github.com/Tencent/teamai-cli/issues/1273
7. WorkBuddy 桌宠的 hooks 实测（社区）：https://developer.cloud.tencent.com/article/2713175
8. WorkBuddy 更新记录（查询日期 2026-11-13）：https://www.workbuddy.cn/docs/workbuddy/Changelog
9. 社区整理的 WorkBuddy Linux 包：https://github.com/ziyue67/workbuddy-linux
10. TencentDB-Agent-Memory #1741（Stop 钩子没有 `session_id`）：https://github.com/TencentCloud/TencentDB-Agent-Memory/issues/1741
11. workbuddy-usage-dashboard：https://github.com/zhuofupan/workbuddy-usage-dashboard
12. agentgrep #176（Antigravity CLI 的会话存储，社区）：https://github.com/tony/agentgrep/issues/176
13. antigravity-conversation-fix（App / IDE 的会话存储，社区）：https://github.com/FutureisinPast/antigravity-conversation-fix
14. Atoll `AntigravityUsageProvider.swift`：https://github.com/Ebullioscopic/Atoll
15. DeepSeek Harness 仓库（`packages/util/home-paths`、`packages/session/session-persistence-jsonl`、`packages/experimental/hooks-claude-code`、`docs/subsystems/approval.md`、`docs/api-gateway.md`）：https://github.com/deepseek-ai/deepseek-harness
16. DeepSeek 余额接口：https://api-docs.deepseek.com/api/get-user-balance
17. opencode 安装脚本 `install`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/install
18. opencode 自述文档 `packages/core/src/plugin/skill/opencode.md`（v2.3.0，含「Service」「V1 to V2 migration」「Plugins」几节）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/core/src/plugin/skill/opencode.md
19. `packages/cli/src/services/service-config.ts`、`service-registration.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/cli/src/services/service-config.ts
20. 桌面版 `packages/desktop/README.md`、`electron-builder.config.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/desktop/README.md
21. VS Code 扩展 `sdks/vscode/package.json`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/sdks/vscode/package.json
22. `packages/util/src/global-roots.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/util/src/global-roots.ts
23. `packages/cli/src/database-path.ts`（v2.3.0）；1.x 的 `packages/core/src/database/database.ts`（v1.19.5）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/cli/src/database-path.ts
24. 1.x 的 JSON 迁移 `packages/opencode/src/storage/storage.ts`（v1.19.5）：https://github.com/anomalyco/opencode/blob/v1.19.5/packages/opencode/src/storage/storage.ts
25. 2.x 会话表 `packages/core/src/session/sql.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/core/src/session/sql.ts
26. `packages/core/src/session/projector.ts`（v2.3.0，`projectIdle`、`Execution.Started`）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/core/src/session/projector.ts
27. `packages/schema/src/session-message.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/schema/src/session-message.ts
28. 1.x 会话表 `packages/core/src/session/sql.ts`（v1.19.5）：https://github.com/anomalyco/opencode/blob/v1.19.5/packages/core/src/session/sql.ts
29. 1.x 运行状态 `packages/opencode/src/session/status.ts`（v1.19.5）：https://github.com/anomalyco/opencode/blob/v1.19.5/packages/opencode/src/session/status.ts
30. 2.x 插件接口 `packages/plugin/src/README.md`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/plugin/src/README.md
31. `packages/plugin/src/promise/event.ts`、`adapter.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/plugin/src/promise/adapter.ts
32. `packages/plugin/src/promise/permission.ts`、`packages/schema/src/permission.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/plugin/src/promise/permission.ts
33. 插件目录名 `packages/core/src/plugin/source-directory.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/core/src/plugin/source-directory.ts
34. 1.x 插件接口 `packages/plugin/src/index.ts`、`packages/opencode/src/config/plugin.ts`（v1.19.5）：https://github.com/anomalyco/opencode/blob/v1.19.5/packages/plugin/src/index.ts
35. `packages/server/src/middleware/authorization.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/server/src/middleware/authorization.ts
36. `packages/protocol/src/groups/event.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/protocol/src/groups/event.ts
37. `packages/protocol/src/groups/permission.ts`、`session.ts`、`usage.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/protocol/src/groups/permission.ts
38. `packages/schema/src/usage-limits.ts`、`packages/core/src/usage-limits.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/schema/src/usage-limits.ts
39. `packages/core/src/config/plugin/instruction.ts`（v2.3.0）：https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/core/src/config/plugin/instruction.ts
40. cc-connect README（查询日期 2026-11-14）：https://github.com/chenhg5/cc-connect
41. opencode 发布记录（v2.3.0 2026-11-13，v1.19.5 2026-10-28，查询日期 2026-11-14）：https://github.com/anomalyco/opencode/releases
42. TRAE 钩子配置参考、用钩子自动化（查询日期 2026-11-15）：https://docs.trae.ai/ide/hook-configuration-reference ，https://docs.trae.ai/ide/automate-actions-with-hooks
43. TRAE、扣子并入豆包（21 财经，2026-08-25）：https://m.21jingji.com/article/20260825/herald/959868d794e53db709962399c070a072.html
44. TraeWork 和 TraeCode 合并为新 TRAE：https://docs.trae.ai/ide/traework-to-traecode-data-migration
45. deja-vu #4680（TRAE CLI 2.0 的 rollout、1.x 的 CoCo 会话、IDE 会话库加密）：https://github.com/vshulcz/deja-vu/issues/4680
46. TRAE CLI 2.0 文档（概述、快速开始、升级、权限与沙箱、配置文件、环境变量，查询日期 2026-11-15）：https://docs.trae.cn/cli_about-trae-code-cli-2 ，https://docs.trae.cn/cli_get-started-with-trae-cli-2 ，https://docs.trae.cn/cli_upgrade-trae-cli ，https://docs.trae.cn/cli_config-file
47. CodeIsland #341（TRAE CN 钩子路径、事件名、`agent_id`、bundle id）：https://github.com/wxtsky/CodeIsland/pull/341
48. perch #1（从 TRAE CN 钩子和 memory 文件拼会话）：https://github.com/sbwkl/perch/pull/1
49. tokscale README（Trae 用量同步）：https://github.com/junhoyeo/tokscale
50. trae-agent 仓库与钩子提案 #397：https://github.com/bytedance/trae-agent ，https://github.com/bytedance/trae-agent/issues/397
51. TRAE CN 个人规则 `user_rules.md`（第三方文章，路径未经官方核实）：https://gitcode.csdn.net/6aa0de041a35784c84208747.html
