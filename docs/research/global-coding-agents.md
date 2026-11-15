# 海外常见 AI 编程代理能不能接进 Agent 页

> 日期：2026-11-15。问题：国内几家（[china-coding-agents.md](china-coding-agents.md)）之后，用户要求再调研海外的：Cursor、GitHub Copilot CLI、Kiro、Cline、Amp、Aider、Grok CLI、Gemini CLI，以及调研里发现的其他常见代理，逐家查清会话文件、钩子、能不能判断「等你」、能不能在岛上审批、用量、能不能复用 Claude Code 兼容层（`claude_compat.rs`）或 opencode 适配、工作量，再给接入顺序。范围：各家官方文档和 GitHub 源码、读这些代理数据的第三方项目（agentsview、clawd-on-desk、cc-connect、codeburn、lore-cli 等）、论坛；本机装了 Cursor 3.25.9、Grok CLI 1.0.77，`~/.copilot` 和 `~/.gemini` 有目录，只读了目录结构、文件名、配置和钩子 JSON、数据库表结构，**没有读任何会话内容、令牌和登录文件**，其他家本机没装、没装。事实标注：**实测**=本机看到的，**文档**=官方文档或源码，**二手**=第三方项目或论坛，**未核实**=没查到或来源互相矛盾；没标的按文档。相关任务：B51（issue #527）。

## 结论

海外这批和国内最大的不同：**钩子这件事已经趋同**，一半以上直接抄 Claude Code 的格式，还有几家**直接读 `~/.claude/settings.json` / `.claude/settings.json`**。会话文件则各写各的，没有一家和 Claude Code 的 JSONL 一样。

1. **Claude Code 兼容、能直接套 `claude_compat` 的钩子**：Grok CLI、Factory Droid。Copilot CLI 钩子也很接近，但回包字段（`permissionRequest` 的 `behavior`）不同，要在声明层加一种回包格式。
2. **钩子思路相同但字段不同**：Cursor（驼峰事件、`permission` 回包、`conversation_id`）、Cline、Kiro、Auggie、Gemini CLI（`BeforeTool` 等事件名、字段相近、有 `transcript_path`）。
3. **插件式，像 opencode**：Amp（Bun 上跑的 TS 插件，`tool.call` 能返回放行 / 拒绝并继续 / 改参数，可以做真审批）。
4. **几乎接不了**：Aider（没有钩子，只有「要输入时执行一条命令」，不带内容）。
5. **不接**：Roo Code（2026-05-15 停服）、Continue `cn`（没查到钩子）、Warp（是终端不是代理）。

**必须先解决一件事：重复触发。** Grok、Copilot CLI、Goose 都会读 `.claude/settings.json`，岛给 Claude Code 装的钩子会被它们一并执行，同一个会话会被当成 Claude Code 报一次、再当成它自己报一次。本机的 Vibe Island 给 Grok 单独写了 `~/.grok/hooks/vibe-island.json`，没有靠这条兼容。做法见「横向设计」。

| 优先级 | 代理 | 工作量 | 能做到 | 主要限制 |
|---|---|---|---|---|
| 第一批 | **Grok CLI**（xAI） | 低–中，约 1.5 天 | 会话列表和标题、三态、等你（`Notification` 三种类型）、岛上允许 / 拒绝（`PreToolUse`）、回复标记 | 会话是多文件目录，不能复用 Claude 的 JSONL 解析；额度只在 `/usage` 里；会读 Claude 的钩子要去重；**本机已装，可实测** |
| 第一批 | **GitHub Copilot CLI** | 中，约 2 天 | 会话列表（`events.jsonl`）、三态、等你（`notification` 的 `permission_prompt`）、岛上允许 / 拒绝（`permissionRequest`）；用户面比 Grok 大得多 | 回包格式和 Claude 不同；`events.jsonl` 哪些事件落盘未核实；本机没装；会读 Claude 的钩子要去重；VS Code 里的 Copilot 会话位置没查到 |
| 第一批 | **Factory Droid** | 低，约 0.5–1 天 | 钩子逐字段对齐 Claude Code，含 `Notification`、`permissionDecision`；会话从 `transcript_path` 取 | 会话目录结构没文档，要用户装了看；`hooks.json` 是整个共享文件，要读了合并再写；用户面不大 |
| 第二批 | **Cursor**（编辑器 + `agent` CLI） | 中–高，约 2–3 天 | 三态、岛上审批（`beforeShellExecution` 等返回 `permission`）；会话读 `agent-transcripts` 加两个 sqlite 取标题 | 没有「等批准」事件，只能近似；转录没有时间戳也没有标题；CLI 会话分开存且是 `store.db`；额度没有官方接口；本机已装，IDE 侧能实测 |
| 第二批 | **Amp** | 中，约 2 天 | 复用 opencode 的思路：装一个 TS 插件，`tool.call` 里等岛的回应；会话读 `threads/T-*.json` | 插件在进程内，不是外部命令；没有「等批准」事件；agentsview 标本地线程文件已弃用，**可能不是所有版本都写**（未核实） |
| 第二批 | **Kiro**（IDE + `kiro-cli`） | 中，约 2 天 | 会话列表（IDE v2 的 `session.json` 有标题）、三态、拒绝（`exit 2`） | 没有「放行 / 询问」回包，只能阻塞等岛再 `exit 0` 或 `exit 2`；没有「等批准」事件；CLI 新旧版会话存储不同（jsonl 和 sqlite），说法互相矛盾 |
| 第二批 | **Goose**（Block） | 中，约 2 天 | 会话在 sqlite（`description` 当标题）、三态、`PreToolUse` 拦截 | 钩子 1.34 才有；`Notification` 和 `PermissionRequest` **定义了但不触发**，做不了等你；会读 Claude 的钩子 |
| 第三批 | **Cline** | 中–高 | 扩展钩子能拦（`cancel`）；会话文件两套布局 | 钩子限 macOS / Linux（说法不一）；新 SDK 插件钩子 3 秒超时，没法等人；会话是整文件 JSON |
| 第三批 | **Augment Auggie CLI** | 中 | 钩子可用（Claude 风格） | 没有 `transcript_path`，会话位置没查到，要像 TRAE 一样从钩子攒；用户面小 |
| 第三批 | **Gemini CLI**（旧版） | 中 | 钩子 11 个事件，`BeforeTool` 能 `deny`、不能 `ask` | 2026-06-18 起个人订阅用户被迁走，只剩 API key 和企业；**现有 Antigravity 适配不覆盖它**；`Notification` 只有 `ToolPermission` 一种；会话没标题 |
| 第三批 | **Crush**（Charm） | 低但价值小 | `PreToolUse` 兼容 Claude | 官方文档只有一个事件，没有停下事件，做不了三态；会话在每个项目的 sqlite 里 |
| 暂不接 | **Aider** | — | 最多「要输入了」的通知 | 没有钩子、没有会话 id、没有标题，历史是 markdown；无法审批 |
| 不接 | Roo Code、Continue `cn`、Warp | — | — | 停服 / 没查到钩子 / 是终端 |

用量环：**这一批没有一家给出可读的本地额度数据**。Copilot 有非官方接口 `copilot_internal/user`，Cursor 有要浏览器 cookie 的非官方接口，都未文档化；建议都不做，和国内那批的处理一致。

要用户定的：

1. 第一批是不是就 Grok、Copilot CLI、Droid 三家？Droid 用户面小，只因为几乎白送；要不要换成优先做 Cursor（用户面最大，但最费劲）？
2. 重复触发的处理：给每家单独写钩子（推荐，和 Vibe Island 同路），还是要岛给 Claude Code 装的钩子认出这些来源？这会改已有的 Claude Code 钩子脚本。
3. 做不了「等你」或审批的几家（Goose、Crush、Aider、Gemini 只做通知）要不要接，还是先只记在这份文档里？
4. Cursor 的会话要读 `state.vscdb`（体积可到几十 GB）吗？推荐只读 `ai-code-tracking.db` 和 `conversation-search.db`（小），不碰 `state.vscdb`。

用户 2026-11-15 回复「可以按你推荐的来」：第一批 Grok、Copilot CLI、Droid，Cursor 排在第二批；每家单独写钩子、不改已有的 Claude Code 脚本；做不了等你或审批的几家先只记在这里；Cursor 只读两个小库、不碰 `state.vscdb`。

## 推荐接入顺序

1. **先做横向的两件事**（约 1 天，不接新家就先做）：（a）给 `claude_compat.rs` 的声明加「回包格式」和「stdin 字段别名」两项，让 Grok、Droid、Copilot 能只填声明；（b）定好重复触发的去重规则。
2. **Grok CLI**。本机已装，钩子和 Claude Code 最接近，实测条件最好；它的 `events.jsonl` 有 `permission_prompt` 阶段，等你可以有两路。
3. **Copilot CLI**。用户面最大的新增，钩子完整；先装一份实测 `events.jsonl` 落盘了什么再写会话解析。
4. **Droid**。顺手。
5. **Cursor**。用户面大但最费劲，排在钩子趋同的那批之后；先做钩子和审批，会话先读 `agent-transcripts` 加小库取标题。
6. **Amp**，然后 **Kiro**、**Goose**；Cline、Auggie、Gemini CLI、Crush 等有人提了再做。

工作量粗估按国内那批的经验：横向 1 天；Grok 1.5 天；Copilot 2 天；Droid 0.5–1 天；Cursor 2–3 天；Amp、Kiro、Goose 各约 2 天。全部不含真机实测。

## 能不能复用现有适配

| 代理 | 复用什么 | 要新写什么 |
|---|---|---|
| Grok、Droid | `claude_compat` 的钩子安装和 `PreToolUse` 审批回包；stdin 解析基本原样 | 会话读取（Grok 多文件目录；Droid 没文档）；声明里加配置文件路径 |
| Copilot CLI | stdin 在 PascalCase 事件名下和 Claude 一样 | `permissionRequest` 回包（`{behavior, message, interrupt}`）、`events.jsonl` 解析、`~/.copilot/hooks/*.json` 的格式（带 `version:1`、`bash` / `command` 字段） |
| Cursor | 钩子脚本的转发思路 | 驼峰事件到内部事件的映射、`permission` 回包、会话发现 |
| Amp | opencode 的思路（装插件，插件把事件转给岛，岛回应） | TS 插件本身、`~/.local/share/amp/threads/` 的读取 |
| Kiro、Cline、Auggie、Gemini CLI、Goose、Crush | stdin JSON 解析的一部分 | 各自的事件名映射、安装器、会话读取 |

## 横向设计

- **通用安装器的参数**：配置文件路径、写入方式（单文件目录合并 / 改整个共享文件）、事件名映射、stdin 字段别名（`session_id` / `sessionId` / `conversation_id`）、有没有 `Notification`、回包格式（Claude 的 `hookSpecificOutput.decision.behavior`、Grok 的 `decision`、Copilot 的 `behavior`、Cursor 的 `permission`）。
- **写入方式**：Grok、Copilot 的钩子目录是合并语义，岛加一个自己的 JSON 即可（Grok 实测：别的软件已在 `~/.grok/hooks/` 放了自己的文件）。Droid 的 `hooks.json`、Gemini 的 `settings.json`、Cursor 的 `hooks.json` 是整个共享文件，要读了合并再写，不能覆盖。
- **去重**：钩子命令带 `--source <代理>`，Rust 侧按「来源 + `session_id`」收；Grok 有环境变量 `GROK_HOOK_EVENT`、`GROK_SESSION_ID`、`GROK_WORKSPACE_ROOT` 可识别（文档），Copilot 的 payload 里有驼峰键可区分，其他家未核实。给 Claude Code 装的钩子在被兼容代理触发时，应按这些线索丢掉。这条会改已有脚本，要用户定（问题 2）。
- **会话列表**：这批没有可以直接扫 `~/.<代理>/projects/*.jsonl` 的，每家都要自己的读取。Grok 和 Copilot 有 `summary.json` / `workspace.yaml` 直接给标题，最省事。
- **SSH 远程**：全是 Linux 原生，钩子目录都在 `$HOME` 下，沿用岛的远程安装思路。

## 详细

### Grok CLI（xAI）

版本 `grok 1.0.77`（**实测**，`~/.grok/docs/user-guide/` 是随程序装的产品文档，下面的文档项指它）。

- **形态**：终端 TUI，另有 headless（`-p`）、daemon（`grok host-server`）、`grok sessions` 子命令；支持 macOS、Linux、Windows（Git Bash）。
- **会话**：根目录 `~/.grok`（`GROK_HOME` 可改）；`~/.grok/sessions/<URL 编码的 cwd>/<会话 id>/`，id 是 UUIDv7，编码超 255 字节时换成 slug 加 hash、原路径记在 `.cwd` 文件里（文档）。实测每个会话目录里有 `summary.json`、`updates.jsonl`、`chat_history.jsonl`、`events.jsonl`、`usage.json`、`signals.json`、`prompt_context.json` 等；`summary.json` 的键含 `generated_title`、`created_at`、`updated_at`、`last_active_at`、`num_messages`、`current_model_id`、`last_turn_summary`、`reasoning_effort`（只看了键名，**实测**）。标题在 `generated_title`；`/rename` 手改的存哪个键未核实。全局还有 `active_sessions.json`、`worktrees.db`（表 `meta`、`worktrees`，列含 `session_id`、`creator_pid`、`status`，**实测**）。
- **状态源**：`events.jsonl` 每行带 `schema_version`、`session_id`，类型含 `phase_changed`（phase 有 `streaming_text`、`tool_execution`、`waiting_for_model`、`permission_prompt` 等）、`turn_started`、`turn_ended`、`permission_requested`、`permission_resolved`（**实测**，只统计了 `type` 值）。**这个格式文档没写，是内部格式，可能随版本变**（稳定性未核实）。
- **钩子**（文档）：`~/.grok/hooks/*.json`、项目 `.grok/hooks/*.json`、`config.toml` 的 `[[hooks.PreToolUse]]`；**同时读 `~/.claude/settings.json`、`.claude/settings.json`（默认开，可关）和 `~/.cursor/hooks.json`**；项目钩子要先信任文件夹。事件：`SessionStart`、`UserPromptSubmit`（可拦）、`PreToolUse`（可拦）、`PostToolUse`、`PostToolUseFailure`、`PermissionDenied`、`Stop`（可拦）、`StopFailure`、`StopCancelled`、`Notification`、`SubagentStart/Stop`、`PreCompact`、`PostCompact`、`SessionEnd`。stdin 同时送驼峰键（`sessionId`、`toolName`、`permissionMode`）和 Claude 的下划线键（`session_id`、`transcript_path`、`tool_name`、`tool_input`、`hook_event_name`、`last_assistant_message`、`notification_type`），所以 Claude 的钩子脚本几乎原样能跑。
- **审批**：`PreToolUse` 回 `{"decision":"allow|deny|ask|defer","reason":...}` 或 `hookSpecificOutput.permissionDecision`；退出码 2 拒绝；其他非 0 和超时放行（`failClosed: true` 例外）；默认超时 5 秒（`Stop`、`PostToolUse` 600 秒），岛要自己设大。`ask` 会强制弹 Grok 自己的提示。**注意**：clawd-on-desk 的说明是 Grok 没有阻塞式 `PermissionRequest` 钩子（二手）——岛的审批只能做在 `PreToolUse` 阶段，会和 Grok 自己的 `permission_mode` 叠加，而不是接管用户已经看到的提示。
- **等你**：`Notification` 的 `permission_prompt`（权限界面真在等）、`idle_prompt`（轮次结束后空闲约一分钟）、`task_complete`；`Stop` 系三选一必报一个，但文档提醒若有阻塞式 `Stop` 钩子，观察者要改靠 `idle_prompt`；文件侧 `events.jsonl` 的 `permission_requested` / `permission_resolved` 配对。
- **用量**：`/usage` 页显示账号额度，没查到本地文件或公开接口；`usage.json` 只有会话 token；外部 OTEL（`GROK_EXTERNAL_OTEL=1`，alpha）要自己起收集器。额度环做不了。
- **其他**：本机另一个软件（Vibe Island）已往 `~/.grok/hooks/vibe-island.json` 写了钩子，覆盖 8 个以上事件，说明目录是合并语义，也说明同机装多个岛会都收到事件（**实测**，只看结构）。Cursor 条目直接写在事件下的格式 Grok 现在不跑（文档）。
- **SSH**：Linux 同布局，远端写 `~/.grok/hooks/<名>.json`。
- 来源：本机 `~/.grok/docs/user-guide/{10-hooks,17-sessions,23-dashboard,24-monitoring-usage,25-status-line}.md`；https://github.com/rullerzhou-afk/clawd-on-desk/blob/main/docs/guides/supported-agents.md

### GitHub Copilot CLI 和 VS Code 里的 Copilot

本机没装 `copilot`；`~/.copilot` 是 VS Code 集成留下的空壳（`settings.json` 只有 `{"version":1}`，`session-state/` 只有锁文件，`hooks/`、`chats/` 为空，**实测**），所以会话格式没有实样。

- **形态**：终端 TUI，npm `@github/copilot`，有 SDK；VS Code 里的 Copilot agent 模式（agent hooks 为预览版，可能变）；github.com 上的云端 coding agent 只读 `.github/hooks/*.json`。
- **会话**（文档）：`~/.copilot`（`COPILOT_HOME`）下 `session-state/<sessionId>/events.jsonl`（事件日志）、`session-store.db`（跨会话检索、可重建）、`settings.json`、`permissions-config.json` 等。`events.jsonl` 每行 `{"type","data"}`，类型有 `user.message`、`assistant.message`、`assistant.turn_start/turn_end`、`tool.execution_start`、`session.task_complete`、`session.start`、`session.title_changed`（带 `title`）、`assistant.usage` 等；toolpath-copilot 说格式未文档化、按 CLI 1.0.67 抓包反推；`session.idle`、`user_input.requested` 这类瞬态事件**是否落盘未核实**。第三方（recall-cli）说 `workspace.yaml` 的 `summary` 当标题（二手）。VS Code 内的会话存放位置没查到。
- **钩子**（文档）：用户 `~/.copilot/hooks/*.json`、仓库 `.github/hooks/*.json`、`settings.json` 的 `hooks` 字段、**`.claude/settings.json`**、插件、`/etc/github-copilot/policy.d/*.json`（策略，不可被关）。格式 `{"version":1,"hooks":{事件:[{type:"command"|"http"|"prompt", bash, powershell, command, timeoutSec(默认30), matcher}]}}`。事件：`sessionStart`、`sessionEnd`、`userPromptSubmitted`、`preToolUse`、`postToolUse`、`postToolUseFailure`、**`permissionRequest`**、`agentStop`、`subagentStart/Stop`、`preCompact`、`errorOccurred`、**`notification`**。stdin 默认驼峰；事件名写 PascalCase 时改成 snake_case 的 VS Code / Claude 兼容格式（`session_id`、`tool_name`、`tool_input`、`transcript_path`）。
- **审批**：`permissionRequest` 回 `{"behavior":"allow|deny","message":...,"interrupt":bool}`，`{}` 落回正常提示，这是岛审批最合适的钩子；`preToolUse` 回 `permissionDecision`；退出码 2 拒绝；超时 30 秒默认且放行，但 `preToolUse` 出错算拒绝。
- **等你**：`notification` 的 `notification_type` 含 `permission_prompt`、`elicitation_dialog`、`agent_idle`、`agent_completed`；`permissionRequest` 本身就是批准即将弹出的信号。
- **用量**：事件里的 `assistant.usage`、`session.usage_checkpoint` 有 token 和 credits，是否落盘未核实；远程只有非官方 `api.github.com/copilot_internal/user`（返回 `quota_snapshots`，二手，可能变）。
- **和 Claude 的距离**：钩子很近；风险是会读 `.claude/settings.json`，要去重（见横向设计）。
- **SSH**：Node 应用，Linux 可跑，钩子在 `~/.copilot/hooks/`；`http` 钩子对 `preToolUse` / `permissionRequest` 要求 https，SSH 场景仍用 command 钩子加端口转发。
- 来源：https://docs.github.com/en/copilot/reference/hooks-configuration 、https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference 、https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/streaming-events 、https://code.visualstudio.com/docs/copilot/customization/hooks 、https://docs.rs/toolpath-copilot 、https://docs.rs/recall-cli/0.1.0/src/recall_cli/providers/copilot.rs.html

### Factory Droid

本机没装。全部按文档（https://docs.factory.com/cli/configuration/hooks-guide ）。

- **钩子**：`~/.factory/hooks.json`、项目 `.factory/hooks.json`（没有 `hooks.json` 时读 `settings.json` 的 `hooks` 键）。事件 `PreToolUse`、`PostToolUse`、`UserPromptSubmit`、`Notification`（类型 `permission_prompt`、`idle_prompt`、`auth_success`、`elicitation_dialog`）、`Stop`、`SubagentStop`、`PreCompact`、`SessionStart`、`SessionEnd`。stdin、输出（含 `hookSpecificOutput.permissionDecision` 的 `allow` / `deny` / `ask`）、退出码 2 都和 Claude Code 一致。
- **会话**：文档例子里 `transcript_path` 指向 `~/.factory/projects/` 下的 `session.jsonl`，目录结构没文档，未核实。
- **用量**：未核实。**SSH**：Linux 可。
- **工作量**：钩子几乎白送，会话读取要装了之后看一份。

### Cursor（编辑器和 `agent` CLI）

本机 Cursor 3.25.9（**实测**）；没有 Cursor CLI（本机的 `~/.local/bin/agent` 是软链到 Grok 的，**实测**），CLI 一侧只按文档。

- **形态**：编辑器的 Agent（Composer）；CLI 命令名是 `agent`（旧名 `cursor-agent`，安装脚本 `cursor.com/install`，支持 macOS、Linux、WSL、Windows）；云端 Background Agent 只跑 command 钩子，不加载用户级钩子（文档）。
- **会话（IDE）**（**实测**）：转录 `~/.cursor/projects/<工作区路径>/agent-transcripts/<会话 id>/<会话 id>.jsonl`，每行 `{"role","message":{"content":[{"type":"text"|"tool_use"}]}}`，外形像 Claude，但**没有 sessionId、时间戳，也没有标题**。标题在 `~/.cursor/ai-tracking/ai-code-tracking.db` 的 `conversation_summaries(conversationId, title, tldr, model, mode, updatedAt)`，和 `~/Library/Application Support/Cursor/User/globalStorage/conversation-search.db` 的 `conversations(id, title, updated_at, is_archived, source)`；标题是异步生成的摘要。`state.vscdb` 里有表 `composerHeaders`，其 JSON 值有 `hasBlockingPendingActions`，很可能就是「等批准」，**语义未核实**；这个库会膨胀到几十 GB（二手，论坛多帖），不建议读。
- **会话（CLI）**（二手，论坛）：`~/.cursor/chats/<工作区 hash>/<agentUuid>/store.db`，SQLite，表 `meta`（十六进制 JSON）、`blobs`；论坛确认 IDE 和 CLI 分开存储。本机没有（没用过 CLI）。
- **钩子**（文档）：`~/.cursor/hooks.json`、项目 `.cursor/hooks.json`、企业路径、团队云下发、插件；格式 `{"version":1,"hooks":{事件:[{command,type,timeout,matcher,loop_limit,failClosed}]}}`，事件是驼峰：`sessionStart`、`sessionEnd`、`preToolUse`、`postToolUse`、`beforeShellExecution`、`afterShellExecution`、`beforeMCPExecution`、`beforeReadFile`、`afterFileEdit`、`beforeSubmitPrompt`、`stop`、`afterAgentResponse` 等 18 个。stdin 公共字段 `conversation_id`、`generation_id`、`model`、`hook_event_name`、`workspace_roots`、`transcript_path`（可空），**没有 `session_id`**（只有 `sessionStart` / `sessionEnd` 有）。本机 `hooks.json` 现在只有 `{"version":1}`，备份里是 Vibe Island 的 11 个事件钩子（**实测**）。
- **审批**：`beforeShellExecution`、`beforeMCPExecution`、`preToolUse` 回 `{"permission":"allow|deny|ask"}`，退出码 2 拒绝，其他非 0 放行（`failClosed` 例外）；`preToolUse` 的 `ask` 文档说「接受但不强制」。超时默认值文档没写，岛要自己设大（单位秒）。
- **等你**：**没有专门事件**，官方论坛承认缺口（二手）。近似：`beforeShellExecution` / `beforeMCPExecution` 在 Run / Reject 提示前触发；`stop` 的 `status` 标完成。非 shell 的批准和 agent 提问看不到。
- **用量**：没有官方个人额度接口；非官方 `cursor.com/api/usage-summary` 要浏览器 cookie；管理员 API 要团队管理员密钥。不建议做。
- **和 Claude 的距离**：思路一致（JSON、退出码 2、matcher），字段和事件名都不同；Cursor 文档提供 `CLAUDE_PROJECT_DIR` 环境变量别名，另有「第三方钩子」读 `.claude/settings.json` 的说法，**本次没打开那一页，未核实**。
- **SSH**：Remote-SSH 下钩子在远端执行（`CURSOR_CODE_REMOTE=true`），读远端 `~/.cursor/hooks.json`；CLI 在 Linux 可用（文档）。
- **CLI 是否触发这些钩子**：文档页没写，未核实。
- 来源：https://cursor.com/docs/hooks 、https://cursor.com/docs/cli/overview 、https://forum.cursor.com/t/fire-a-hook-when-agent-waits-for-command-tool-approval/166947 、https://forum.cursor.com/t/local-ide-agent-chats-and-the-agent-cli-still-use-separate-session-stores/165486 、https://forum.cursor.com/t/usage-api-cli-command/160967

### Kiro（AWS）

本机没装，全部按文档。

- **形态**：IDE（VS Code 系）、`kiro-cli`（2.x 和 V3）、Web。
- **会话**：CLI 新版 `~/.kiro/sessions/cli/<id>.jsonl` 加同名 `<id>.json`（`KIRO_HOME` 可改；jsonl 每行 `{version,kind,data}`，json 含 `session_state`、`metering_usage`、`meta.cwd`）；旧 CLI 是 SQLite `data.sqlite3`（macOS `~/Library/Application Support/kiro-cli/`、Linux `~/.local/share/kiro-cli/`），哪个版本写哪个存储来源说法有出入，未核实。IDE v2 `~/.kiro/sessions/<workspace-hash>/sess_<id>/`，含 `session.json`（`title`、`modelId`、`workspacePaths`、`contextUsage`）、`messages.jsonl`；IDE v1 在 globalStorage `kiro.kiroagent`。标题只确认 IDE v2 有，CLI 的没找到。
- **钩子**：CLI 2.x 写在 agent 配置 JSON 的 `hooks` 里（`.kiro/agents/*.json`），触发器 `agentSpawn`、`userPromptSubmit`、`preToolUse`、`postToolUse`、`stop`；V3 和 IDE 1.x 是 `.kiro/hooks/<id>.json`（工作区）和 `~/.kiro/hooks/`（全局，CLI V3），PascalCase 触发器（`PreToolUse`、`Stop`、`SessionEnd` 等），`timeout` 默认 60 秒。stdin snake_case（`hook_event_name`、`session_id`、`cwd`、`tool_name`、`tool_input`），和 Claude 很接近。
- **审批**：退出码 2 只对 `PreToolUse` 拦截（stderr 回给模型）；Kiro 钩子页另一处写「非 0 即拦」，两处文字不一致，未核实。awslabs 的第三方实测描述（IDE 1.x）：stdout 写 JSON `deny` 且退出 0 时工具照样运行，只有退出码 2 加 stderr 真拦。**没有 `allow` / `ask` 回包**，岛只能阻塞等用户点，再 `exit 0` 或 `exit 2`（推断，未核实）。
- **等你**：钩子页没有权限请求或通知类触发器，只能靠 `PreToolUse` 到 `PostToolUse` 的间隔近似。
- **用量**：`metering_usage`（credits）、IDE 的 `usage_summary`；剩余额度的接口没找到。
- **SSH**：`kiro-cli` 有 Linux 版，钩子和会话都在 `~/.kiro`。
- 来源：https://kiro.dev/docs/hooks/ 、https://kiro.dev/docs/cli/v3/hooks-migration/ 、https://awslabs.github.io/aidlc-workflows/reference/kiro-ide-hook-payload/ 、https://raw.githubusercontent.com/getagentseal/codeburn/main/docs/providers/kiro.md 、https://github.com/rullerzhou-afk/clawd-on-desk

### Cline

本机没装，全部按文档。

- **形态**：VS Code 扩展（`saoudrizwan.claude-dev`）；新 CLI（`npm i -g cline`，基于新 SDK）；ACP（Zed、JetBrains）。
- **会话**：扩展在 VS Code globalStorage `saoudrizwan.claude-dev/`，`state/taskHistory.json` 是索引，`tasks/<taskId>/` 下 `ui_messages.json`、`api_conversation_history.json`、`task_metadata.json`，都是整文件 JSON 数组。新 CLI `~/.cline/data/sessions/<sessionId>/<sessionId>.json`（含 provider、model、cwd、`started_at`、`ended_at`、`usage`）加 `.messages.json`；旧会话可能在 `sessions.db`（未核实）。新 CLI 元数据没有标题；扩展的标题字段本次没确认。
- **钩子**：扩展（v3.36 起）脚本放 `~/Documents/Cline/Rules/Hooks/` 或 `.clinerules/hooks/`，文件名即钩子名且要可执行（Windows 支持情况文档和博客不一致，未核实）。事件 `PreToolUse`、`PostToolUse`、`UserPromptSubmit`、`TaskStart`、`TaskResume`、`TaskCancel`。stdin 驼峰（`clineVersion`、`hookName`、`taskId`、`preToolUse:{toolName, parameters}`，外层包装各处文档不一致，未核实）；stdout `{"cancel":true|false,"errorMessage","contextModification"}`。新 SDK 插件钩子（`beforeTool` 可 `skip`）**每个 3 秒超时**，不适合人工审批。没有 `Stop` 和通知事件。
- **等你**：没有专门事件；扩展里的批准是 `ui_messages` 里的 `ask` 类消息（该格式本次未在文档核实）。
- **用量**：只有按调用的花费，没有配额接口。
- **SSH**：CLI 在 Linux 可跑；扩展走 VS Code Remote，路径是推断。
- 来源：https://docs.cline.bot/sdk/plugins.md 、https://cline.bot/blog/cline-v3-36-hooks 、https://docs.cline.bot/cline-cli/overview.md 、https://raw.githubusercontent.com/getagentseal/codeburn/main/docs/providers/cline-cli.md

### Amp（Sourcegraph）

本机没装，全部按文档。

- **形态**：CLI（含 `amp -x` 执行模式）、编辑器扩展、网页线程。
- **会话**：`~/.local/share/amp/threads/T-<uuid>.json`，每线程一个 JSON：`id`、`created`、`title`（可选）、`messages[]`、`env.initial.trees`（含工作目录）、`usage`（字段未核实）。官方没文档化，格式可能随版本变；线程也同步到服务端，本地文件是否所有版本都写未核实；agentsview 把它标成已弃用（二手，原因没查）。
- **插件**：官方插件系统，TypeScript，Bun 执行；位置 `.amp/plugins/`、`~/.config/amp/plugins/`；事件 `session.start`、`tool.call`（返回 `allow` / `reject-and-continue` / `modify` / `synthesize` / `error`）、`tool.result`、`agent.start`、`agent.end`（可 `continue`）；`ctx.ui.confirm` 等。插件是**进程内函数，不是外部命令**，岛要装一个插件，插件里把事件转给岛，`tool.call` 里等岛的回应再返回——可行，但插件里能不能发网络请求没核实（推断，Bun 里应该可以）。
- **等你**：没有「等批准」事件（`tool.call` 文档写正常的权限和确认仍然生效），只能把 `tool.call` 到 `tool.result` 之间超过阈值近似成在等人。
- **用量**：官方页面没取到，本地 `usage` 未核实。
- **和现有适配的距离**：和 opencode 的插件事件很像（`tool.call` 对应 `tool.execute.before`），与 Claude 钩子差距大。
- 来源：https://ampcode.com/docs/plugin-api 、https://docs.rs/lore-cli/0.1.13/lore_cli/capture/watchers/amp 、https://github.com/kenn-io/agentsview

### Aider

本机没装。

- **会话**：`.aider.chat.history.md` 默认在仓库根（`--chat-history-file` 可改），markdown；每次启动追加 `# aider chat started at <时间>`，用户输入前缀 `#### `，工具输出和确认提示以 `> ` 引用写入；没有结构化字段、会话 id、标题。一个目录一份历史，不按会话分文件。`--llm-history-file` 默认不写。
- **钩子**：没有。只有 `--notifications` 和 `--notifications-command`，用 `subprocess.run(cmd, shell=True)` 执行，无参数、无 stdin、不带内容（读 `aider/io.py` 源码）。
- **等你**：这是唯一真有的信号：`llm_started()` 之后，在 `get_input()`、`confirm_ask()`、`prompt_ask()` 开头调 `ring_bell()`，所以「跑完要输入」和「要确认」都会触发命令，但命令分不清是哪种；要区分得读 `.aider.chat.history.md` 末尾（推断，未核实）。
- **审批**：不能拦，确认只在终端里答。**用量**：没有配额，花费只写在历史的 `> ` 行里。
- **结论**：最多做一个「要输入了」的通知，会话列表没法做，暂不接。
- 来源：https://aider.chat/docs/config/options.html 、https://raw.githubusercontent.com/Aider-AI/aider/main/aider/io.py

### Gemini CLI（google-gemini/gemini-cli）和岛已有的 Antigravity

本机没有 `gemini` 命令，`~/.gemini/settings.json` 是 `{}`，没有 `tmp/` 目录，说明这台机器没跑过旧版（**实测**）。

- **现状**（文档）：Google 2026-05-19 宣布 Antigravity CLI（`agy`）取代 Gemini CLI，**2026-06-18 起 Gemini CLI 不再为 Google AI Pro / Ultra 订阅用户和免费 Gemini Code Assist 个人用户服务**；企业许可不变，仍可用付费 Gemini API key，仓库保持 Apache 2.0。所以现在遇到它的多半是 API key 或企业用户。
- **岛已有的 Antigravity 适配能不能覆盖它：不能。** 两者都在 `~/.gemini` 下但子路径不同：Gemini CLI 的钩子在 `~/.gemini/settings.json` 的 `hooks` 键，会话在 `~/.gemini/tmp/<hash>/chats/`；Antigravity CLI 数据在 `~/.gemini/antigravity-cli/`，钩子在 `~/.gemini/config/hooks.json`（岛读的是这个）。事件名和 stdin 字段也不同：Antigravity 是 `conversationId`、`workspacePaths`、`hookEventName: Stop`（见 `antigravity.rs` 测试样例），Gemini CLI 是 `session_id`、`transcript_path`。本机 `~/.gemini/config/` 下是 `config.json`、`mcp_config.json`、`plugins/`（**实测**）。
- **钩子**（文档）：11 个事件（`BeforeTool`、`AfterTool`、`BeforeAgent`、`AfterAgent`、`SessionStart`、`SessionEnd`、`Notification` 等），配置在 `settings.json`，`timeout` 毫秒默认 60000。stdin 有 `session_id`、`transcript_path`、`cwd`；回包 `decision`（`allow` / `deny`，没有 `ask`）、退出码 2 阻塞。`BeforeTool` 能 deny；`allow` 能否跳过 Gemini 自己的确认弹窗文档没写；`Notification` 只观察，唯一类型是 `ToolPermission`。**所以岛上批准 Gemini 的命令做不成，只能做「有人在等」的通知。**
- **会话**（二手）：`~/.gemini/tmp/<project_hash>/chats/session-<日期时间>-<短 hash>.json`，整文件 JSON（有第三方说新版是追加式 JSONL，当前到底哪种未核实）；没有标题字段，只能取第一条用户消息；`cwd` 不在文件里，只有项目路径的 SHA-256。
- **用量**：`/stats` 只在 CLI 里，没有公开本地文件。
- **Qwen Code 是它的分叉**，岛已有 `qwen.rs`。
- **结论**：等有人提需求再做；要做就在 Antigravity 适配旁加一个事件名映射。
- 来源：https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/ 、https://github.com/google-gemini/gemini-cli/discussions/27274 、https://geminicli.com/docs/hooks/reference/ 、https://geminicli.com/docs/cli/session-management/

### 其他

- **Goose**（Block，仓库已移到 aaif-goose）：会话 `~/.local/share/goose/sessions/sessions.db`（SQLite，`description` 当标题，`working_dir`，1.10.0 起不用 jsonl，桌面和 CLI 共用，文档）。钩子随 1.34 发布（来自 PR #9093 的说明，版本号未核实）：全局 `~/.config/goose/hooks.json`，项目 `.goose/settings.json` 或 `.claude/settings.json`；接通的事件有 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`Stop`、`SessionEnd` 等，**`Notification`、`PermissionRequest` 定义了但不触发**，能拦的只有 `PreToolUse` 和 `UserPromptSubmit`。所以做不了「等你」。会读 `.claude/settings.json`。来源：https://block.github.io/goose 、https://github.com/block/goose/pull/7411
- **Crush**（Charm）：钩子在 `crush.json`，官方文档目前只有 `PreToolUse`（二手来源冲突，有页声称 13 个事件，未核实），兼容 Claude，退出码 2 拦；会话在 `<项目>/.crush/crush.db`（二手，表结构未核实）。没有停下事件，三态做不了，先不做。来源：https://next-docs.charm.land/crush/configuration/hooks.html （只见搜索摘要）
- **Augment Auggie CLI**：`~/.augment/settings.json`，事件 `PreToolUse`（可拦）、`PostToolUse`、`Stop`、`SessionStart`、`SessionEnd`、`PromptSubmit`、`Notification`；stdin 有 `conversation_id`、`workspace_roots`，**没有 `transcript_path`，会话位置官方没写、也没搜到**（`auggie session list/resume` 存在）。会话只能像 TRAE 那样从钩子攒。来源：https://docs.augmentcode.com/cli/hooks
- **Roo Code**：二手消息称 2026-05-15 扩展、Cloud、Router 停服，仓库归档，转向云端的 Roomote；已装的还能用，存储和 Cline 同构（`globalStorage/rooveterinaryinc.roo-cline/tasks/<id>/`，agentsview），没有钩子。跳过。
- **Continue `cn`**：只查到权限在 `~/.continue/permissions.yaml`，没查到钩子和会话位置。跳过。
- **Warp**：是终端，不是代理；它靠各代理的钩子做通知。岛能做的只有终端宿主识别，已有 `focus` / `session_host` 的思路。不接。
- **没有深查、未核实**：Zed agent（走 ACP，会话在 `~/Library/Application Support/Zed/`，agentsview 二手）、JetBrains Junie、Jules（云端，没有本地文件）、Devin CLI（cc-connect 经 ACP 接入，二手）、OpenHands（CLI 会话在 `~/.openhands/conversations/`，agentsview 二手）。用户没提需求前不做。

## 要实测的

1. **Grok**（本机已装）：往 `~/.grok/hooks/` 放一个测试钩子，核实 `PreToolUse` 阻塞等待、`Notification` 三种类型是否真的触发、`events.jsonl` 的 `permission_prompt` 配对、`transcript_path` 指向哪个文件、`/rename` 后标题存哪个键。
2. **Copilot CLI**（本机没装，要用户装）：`events.jsonl` 真实落盘了哪些事件（尤其 `session.idle`、`user_input.requested`）、`permissionRequest` 钩子能否真的替用户点允许、VS Code 内 Copilot 会话落在哪。
3. **Cursor**：IDE 本机可测 `beforeShellExecution` 阻塞等岛；`agent` CLI 要用户装，核实钩子是否触发、`store.db` 的 `meta` 和 `blobs` 结构；`hasBlockingPendingActions` 的语义；官方「第三方钩子」页是否真的读 `.claude/settings.json`。
4. **Droid、Amp、Kiro**：都要用户装，先看会话文件实样。
5. 本机没装的不要装，按此清单请用户或另一台机器测。

## 来源

各家来源已写在上面各节。横向参考：
- https://github.com/rullerzhou-afk/clawd-on-desk （各代理钩子接入）
- https://github.com/kenn-io/agentsview 、https://github.com/wesm/agentsview （会话路径表，二手）
- https://github.com/chenhg5/cc-connect （支持列表）
- https://github.com/getagentseal/codeburn （Kiro、Cline 会话格式，二手）
- 本机：Cursor 3.25.9、Grok 1.0.77 的目录结构和 `~/.grok/docs/user-guide/`（只读目录名、配置、钩子 JSON、数据库表结构）
