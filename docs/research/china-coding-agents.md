# 国内常见 AI 编程代理能不能接进 Agent 页

> 日期：2026-11-15。问题：用户要求「国内常见的 agent 都适配」（issue #312 的延伸），逐家查清能不能接、能做到哪些功能、按什么顺序接。范围：各家官方文档和 GitHub 源码、npm 包信息、读这些代理数据的第三方项目（agentsview、cc-connect、clawd-on-desk、Orca、tape、ORG2、Coffee-CLI 等）、媒体报道；本机只读看了 Kimi 桌面版 3.2.21 和 `~/.codebuddy/` 的目录结构（不看会话内容）。除这两处外都**按文档和源码，未实测**。豆包和 TRAE 见 [agent-harnesses.md「豆包」](agent-harnesses.md#豆包2026-11-15-追加)。相关任务：B29。

## 结论

国内的编程代理大致三类：

1. **Claude Code 的「方言」**：钩子配置、stdin 字段、`PermissionRequest` 的回包和 Claude Code 一样或几乎一样，会话是 Claude Code 风格的 JSONL。Qoder CLI / Qoder CN CLI、CodeBuddy Code（和已接的 WorkBuddy 是同一套内核）、Qwen Code 都属于这类，TRAE IDE、ZCode、Qoder IDE 的钩子输入输出也兼容、只是配置外壳不同。
2. **opencode 的分支**：小米 MiMo Code、华为码道 CLI，插件事件和 opencode 一样，能复用岛已有的 opencode 适配。
3. **自有格式**：Kimi Code（TOML 钩子，只能拒绝）、MiniMax Code（钩子只能装成插件）、CodeBuddy IDE 和插件（私有会话格式，钩子缺等待事件）。

**建议先做一件基础工作**：在 `HARNESS` 里加一种「Claude Code 兼容」的声明（数据目录、钩子配置文件、会话目录、`PermissionRequest` 回包是 `decision.behavior` 还是 `permissionDecision`、超时单位），把 Claude Code 的钩子安装、钩子脚本分支和 JSONL 会话解析做成按这份声明走。之后第一批每家主要是填一份声明加图标，不用每家写一个模块。

| 优先级 | 代理 | 难度 | 预计能做到 | 主要限制 |
|---|---|---|---|---|
| 第一批 | **Qoder CLI**（`qodercli`）和 **Qoder CN CLI**（`qodercn`，原通义灵码这条线） | 低 | 会话列表和标题、三态、等你、岛上允许 / 拒绝、回复标记（`~/.qoder[-cn]/AGENTS.md`）、cc-connect 已支持 | 会话每行是 Claude 格式还是 Qwen 格式第三方说法不一，要本机看一行；用量只能在 `/usage` 里看 |
| 第一批 | **CodeBuddy Code**（腾讯，`codebuddy`） | 低 | 会话列表和标题（套 WorkBuddy 的解析，多拆一层 `payload`）、三态、等你、岛上审批、回复标记（`~/.codebuddy/CODEBUDDY.md`） | auto 模式下 `PermissionRequest` 连会被自动放行的调用也触发，「等你」要改认 `Notification(permission_prompt)`；改钩子要新开会话 |
| 第一批 | **Qwen Code**（阿里，`qwen`） | 低 | 会话列表和标题、运行中（官方给外部程序的 `<id>.runtime.json` 带 pid）、等你、岛上允许 / 拒绝、回复标记（`~/.qwen/QWEN.md`） | `timeout` ≥1000 按毫秒算；1.0 Preview 合了 Qoder 的 harness，正式版可能改格式；额度接口未核实 |
| 第二批 | **TRAE / TRAE CN**（豆包旗下 IDE） | 中 | 三态、等你、岛上审批；会话从钩子攒 | 会话库加密；「允许」受 TRAE 自身确认模式限制（详见 agent-harnesses.md） |
| 第二批 | **智谱 ZCode**（桌面 + CLI，开源） | 低–中 | 等你、岛上允许 / 拒绝（输入输出兼容 Claude Code）；会话读 `~/.zcode/cli/db/db.sqlite` | 钩子配置外壳是自有格式（`~/.zcode/cli/config.json`），项目级钩子被忽略，改了要新开会话；表结构未核实 |
| 第二批 | **Kimi Code CLI**（月之暗面，`kimi`） | 中 | 会话列表（`session_index.jsonl` + `state.json` 直接有标题、最近提问、上一轮完成 / 取消 / 失败）、三态、等你、用量环（`/coding/v1/usages` 岛已在用） | 钩子是 TOML `[[hooks]]`，要新写安装器；岛上只能「拒绝」；Kimi 桌面版内嵌的是另一份目录，钩子能不能装未核实 |
| 第二批 | **小米 MiMo Code**（opencode 分支） | 低 | 同 opencode：会话、三态、等你、审批 | 插件目录、事件签名有没有改未核实 |
| 第三批 | **Qoder IDE / Qoder CN IDE**（含 JetBrains 插件） | 中 | 三态、等你、岛上审批 | 回包是 `permissionDecision`（和 CLI 不同）；默认 30 秒超时**按放行**，要写大；国际版改钩子要重启 IDE；会话路径只有第三方依据 |
| 第三批 | **MiniMax Code**（桌面 + `mcode`） | 中 | 等你、岛上允许 / 拒绝 | 钩子要打包成本地插件；会话库格式未核实 |
| 第三批 | **华为码道 CLI** | 低–中 | 同 opencode 插件 | 会话路径未核实，用户量未知 |
| 第三批 | **CodeBuddy IDE / 插件** | 中–高 | 会话列表、亮灯、完成 | 私有会话格式；官方钩子没有 `Notification` / `PermissionRequest`，做不了等你和审批 |
| 不接 | 豆包桌面版、豆包工作 | — | — | 云端对话 / 不是编程代理（见 agent-harnesses.md） |
| 不接 | iFlow CLI | — | — | 2026-04-17 已停服 |
| 不接 | 百度文心快码 Comate | 高 | 最多列会话 | 没查到钩子，CLI 周下载不到一千；据报道已并入百度搭子 |
| 不接 | 智谱 CodeGeeX、讯飞 iFlyCode、快手 CodeFlicker、美团 CatPaw（妙手）、MiniMax Mini-Agent、阶跃 / 百川 / 零一 | — | — | 只有补全插件、只给内部员工、已转向办公、演示项目或没有编程代理 |
| 不接（用别家） | GLM Coding Plan、火山方舟编程套餐、百炼 Coding Plan | — | — | 只是给 Claude Code、Codex、opencode 等提供模型，岛已按那几家显示 |
| TRAE CLI 2.0 | — | 低 | Codex rollout，能复用 Codex 解析 | 只给 TRAE 企业旗舰版 |

工作量粗估（按现有六家的经验）：「Claude Code 兼容」声明那一步约 1.5 天；之后第一批每家约半天到 1 天（含图标、测试、文档）；TRAE、ZCode、Kimi Code 各约 1.5–2 天；MiMo Code 约 1 天。全部只能按文档写，真机实测要用户装上对应代理（本机只装了 Kimi 桌面版、WorkBuddy、豆包桌面版）。

要用户定的：

1. 先做「Claude Code 兼容」这一层再接第一批（推荐），还是每家单独接？
2. 第一批是不是就 Qoder（含 CN）、CodeBuddy Code、Qwen Code 三家？第二批里 TRAE、ZCode、Kimi Code、MiMo Code 的顺序？
3. 第三批和「不接」的那些，要不要每家建一个 issue 记着，还是只记在这份文档里？

## 详细

下面三节是三路调研的整理。腾讯、阿里那一节用 [C1] 这类编号，来源列在那一节末尾；另外两节的来源直接写在正文链接里。

### Kimi Code、Qwen Code、iFlow CLI

查询日期：2026-11-15。来源以 GitHub 仓库的默认分支文件为主（用 `gh api` 读取），链接指向 GitHub 上的文件。kimi.com 帮助页和 iFlow 告别帖用 WebFetch 打不开，相关事实以仓库文档为准。

| 产品 | 查到的版本 / 最近发布 |
|---|---|
| Kimi Code CLI（新，TypeScript） | `@moonshot-ai/kimi-code@2.6.2`，2026-11-13（[releases](https://github.com/MoonshotAI/kimi-code/releases)；changelog 写 2.6.2 是 2026-11-14） |
| 旧 kimi-cli（Python） | 1.52.0，2026-09-22，仓库已归档（[MoonshotAI/kimi-cli](https://github.com/MoonshotAI/kimi-cli)） |
| Kimi 桌面版（本机） | 3.2.21，内嵌的 Kimi Code 运行时是上游 0.5.1（本机 `daimon/releases/release-pins.v2.json`） |
| Qwen Code | v0.27.4，2026-11-15；另有 desktop-v0.27.4，和「Qwen Code 1.0 Preview」分支（[releases](https://github.com/QwenLM/qwen-code/releases)） |
| iFlow CLI | npm `@iflow-ai/iflow-cli` latest 0.5.19（2026-04-25 发布）；**2026-04-17 已停止服务** |

---

#### 1. Kimi Code CLI（月之暗面）

**重要前提**：原来的 `MoonshotAI/kimi-cli`（Python，数据在 `~/.kimi/`）已归档，仓库描述写着改用 Kimi Code CLI：[MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code)（TypeScript，命令仍叫 `kimi`，数据在 `~/.kimi-code/`）。新版第一次启动会提示从 `~/.kimi/` 迁移配置和会话，迁移不改旧数据（[migration.md](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/guides/migration.md)）。下面都说新版。

##### 形态
- CLI（TUI），另有 `kimi web`、VS Code 扩展（仓库 `apps/vscode`）、ACP 服务（`kimi acp`，[kimi-acp.md](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/reference/kimi-acp.md)）、本地 Server API（[server-api-sessions.md](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/reference/server-api-sessions.md)）。
- 平台：macOS / Linux 用 `install.sh`，Windows 用 PowerShell `install.ps1`，Windows 需要 Git for Windows（用 Git Bash 当 shell）；也能 `npm i -g @moonshot-ai/kimi-code`（[getting-started.md](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/guides/getting-started.md)）。Windows/macOS/Linux 都支持。

##### 会话
- 根目录 `~/.kimi-code/`，可用环境变量 `KIMI_CODE_HOME` 改（[data-locations.md](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/configuration/data-locations.md)）。
- `session_index.jsonl`：每行一个会话，字段 `sessionId`、`sessionDir`、`workDir`。能直接列出全部会话。
- `sessions/<workspaceId>/<sessionId>/`：`workspaceId` 是 `wd_<slug>_<sha256 前 12 位>`（隐式工作区）或 `wm_<uuid>`（显式创建的项目）。
  - `state.json`：会话元数据。字段（[klient metadata.ts](https://github.com/MoonshotAI/kimi-code/blob/main/packages/klient/src/contract/session/metadata.ts)）：`id`、`title`、`titleKind`（replaceable/generated/custom）、`lastPrompt`、`createdAt`、`updatedAt`、`archived`、`cwd`、`forkedFrom`、`agents`、**`lastTurnReason`（`completed` / `cancelled` / `failed`）**。标题、目录、最近提问、上一轮结果都能直接读。
  - `agents/main/wire.jsonl`：主代理事件流，首行 `{"type":"metadata","protocol_version":"1.5",...}`，之后每行 `{"type", ...payload, "time"}`，共 67 种记录，包括 `turn.prompt`、`turn.ended`、`turn.cancel`、`context.append_message`、`usage.record`、`permission.record_approval_result`、`config.update` 等（[wire-manifest.d.ts](https://github.com/MoonshotAI/kimi-code/blob/main/packages/agent-core-v2/docs/wire-manifest.d.ts)）。模型从 `config.update` 或 SessionStart 钩子的 `model` 字段拿（wire 里具体字段名未核实）。子代理在 `agents/agent-0/` 等目录各有一份 `wire.jsonl`。
  - `tasks/<task_id>.json`：后台任务状态、pid、退出码。
- 运行中 / 完成：`wire.jsonl` 最后一条是 `turn.prompt` 且没有对应 `turn.ended` → 运行中；`state.json.lastTurnReason` 给出完成 / 取消 / 失败。
- 会话是否还开着：`~/.kimi-code/locks/sessions/` 是「客户端正在写某会话」的跨进程占用锁（[data-locations.md](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/configuration/data-locations.md)），锁文件的格式和是否带 pid 未核实；也可用 `SessionEnd` 钩子（matcher `exit` / `archive`）和 `SessionHeartbeat`（每 60 秒）判断。
- 文档提醒不要手改 `sessions/` 里的文件；只读没问题。

##### 钩子
- 配置：`~/.kimi-code/config.toml` 里的 `[[hooks]]` 数组，每条只允许 `event`、`matcher`（正则）、`command`、`timeout`（1–600 秒，默认 30）四个字段，多写字段会让整个配置加载失败。**没有项目级钩子**，只有用户级和本地插件（[hooks.md](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/customization/hooks.md)，中文版 [docs/zh](https://github.com/MoonshotAI/kimi-code/blob/main/docs/zh/customization/hooks.md)）。
- 格式：TOML 扁平一条一事件（不像 Claude Code 的嵌套 JSON），stdin 送 JSON，字段 snake_case，公共字段 `hook_event_name`、`session_id`、`session_title`、`client_type`、`cwd`；PreToolUse 带 `tool_input`。退出码 0 放行、2 阻止（stderr 是理由），也可 stdout 回 `{"hookSpecificOutput":{"permissionDecision":"deny",...}}`。语义接近 Claude Code，但配置格式不同。
- 事件：`UserPromptSubmit`、`UserPromptQueued`、`PreToolUse`、`Stop`、`TurnStarted`、`PostToolUse`、`PostToolUseFailure`、`PermissionRequest`、`PermissionResult`、`SessionStart`、`SessionEnd`、`SessionHeartbeat`、`SubagentStart`、`SubagentStop`、`TaskStarted`、`StopFailure`、`Interrupt`、`PreCompact`、`PostCompact`、`Notification`。
- 等授权事件：`PermissionRequest`（「等用户批准之前」触发）和 `PermissionResult`。**这两个只观察**，源码里是 fire-and-forget（[agentExternalHooksService.ts](https://github.com/MoonshotAI/kimi-code/blob/main/packages/agent-core-v2/src/features/externalHooks/agent/agentExternalHooksService.ts)），用来亮「等你」灯够用。没有「等用户回答问题」的专门事件；后台 `TaskStarted` 的 kind 有 `question`，是否覆盖前台提问未核实。
- 能否挂起回 allow/deny：**只能回 deny**。能阻塞的只有 `PreToolUse`、`Stop`、`UserPromptSubmit`；`PreToolUse` 在权限检查之前跑，脚本可以挂起最多 600 秒；源码只认 `permissionDecision: "deny"` 和退出码 2，其他都当放行（[runHook.ts](https://github.com/MoonshotAI/kimi-code/blob/main/packages/agent-core-v2/src/features/externalHooks/internal/runHook.ts)）。「放行」只是继续走 Kimi 自己的权限检查，终端里该弹的批准框照样弹，**岛上点「允许」不能替用户批准**。超时、出错一律 fail-open。
- 改完要不要重启：文档写「保存配置后开一个新会话」生效，已在跑的会话不重新读（未见热重载说明）。

##### 桌面版内嵌的 Kimi Code
- 本机 Kimi 桌面 3.2.21 内嵌的是 `@moonshot-ai/agent-core-v2` 等库（上游 commit `7ccac2b`，版本 0.5.1），作为库在桌面进程里跑，不是调用 `kimi` 命令（本机 `release-pins.v2.json` 的 `kimiCodeRuntime.runtimePackageNames`）。
- 它用自己的 home：`~/Library/Application Support/kimi-desktop/daimon-share/daimon/runtime/kimi-code/home/`（有 `config.toml`、`workspaces.json`、`device_id`、`logs/`），**和 CLI 的 `~/.kimi-code/` 不共用会话也不共用钩子**。该目录的 `config.toml` 由桌面写入（provider `daimon-kimi-code`，`agent-gw.kimi.com`），目前没有 `[[hooks]]`；往里写钩子是否生效、会不会被桌面版覆盖，未核实。
- 桌面版会话索引在 `agents/main/sessions/hosted-logical/conversations.sqlite`，列 `kernel_type`、`kernel_session_id`、`kernel_session_dir`、`kernel_records_path`、`workspace_path`，指向内核会话目录，本机目前为空，所以内核会话目录的实际结构未核实（推测与 CLI 的 `state.json` + `wire.jsonl` 相同，因为是同一个 agent-core-v2，但未验证）。

##### 全局提示词文件
- `~/.kimi-code/AGENTS.md`（Kimi 专用，随 `KIMI_CODE_HOME` 移动），跨工具通用的放 `~/.agents/AGENTS.md`（[data-locations.md](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/configuration/data-locations.md)）。旧版 kimi-cli 是 `~/.kimi/AGENTS.md`（cc-connect 的 [kimi.go](https://github.com/chenhg5/cc-connect/blob/main/agent/kimi/kimi.go) 这样写）。

##### 用量 / 额度
- `GET https://api.kimi.com/coding/v1/usages`（海外 `api.kimi.ai`），返回 `usages.limit_5h`、`limit_7d`、`limit_month_total`、`limit_month_code` 和 `extraUsage`（[managed-usage.ts](https://github.com/MoonshotAI/kimi-code/blob/main/packages/oauth/src/managed-usage.ts)）。浮屿已经在 `plan_usage.rs` 里用 API key 调这个接口。CLI 用 OAuth 登录时凭据在 `~/.kimi-code/credentials/<name>.json`（0600），能否直接拿它的 token 调 `/usages` 未核实。
- 本地每轮用量在 `wire.jsonl` 的 `usage.record`。

##### 跳转
- 命令 `kimi`；安装脚本装出的可执行文件形态（独立二进制还是 node 脚本、进程名是 `kimi` 还是 `node`）未核实。
- 能定位会话：`kimi --session <id>` 恢复指定会话、`kimi --continue` 恢复当前目录最近一个（[sessions.md](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/guides/sessions.md)）。找到正在跑会话的终端窗口要靠进程 cwd，和其他 CLI 一样。

##### cc-connect
- 支持，README 支持矩阵写「Kimi CLI (Moonshot) ✅」，Kimi 还是赞助商（[README](https://github.com/chenhg5/cc-connect/blob/main/README.md)）。适配器 `agent/kimi/kimi.go` 同时认旧版 `~/.kimi/sessions` 和新版 `$KIMI_CODE_HOME/sessions`。cc-connect 最新 v1.5.2-beta.1（2026-11-05）。

##### 接入难度：中
会话读取很好做（`session_index.jsonl` + `state.json` 已有标题、目录、`lastPrompt`、`lastTurnReason`，比 Codex rollout 还省事），亮灯和「等你」用钩子能做（`PermissionRequest`、`Stop`、`StopFailure`、`Interrupt`、`SessionEnd`）。难点：钩子配置是 TOML `[[hooks]]`，安装器要新写一套（多一个字段整个配置加载失败，写入要小心）；**岛上批准只能做「拒绝」**，「允许」做不到真正的替批。复用：会话列表按 Codex rollout 的做法读 JSONL；钩子脚本的 stdin 处理可复用 Claude Code 式脚本。桌面版独立一套目录，要单独做，且钩子能否装进去未核实。

---

#### 2. Qwen Code（阿里，QwenLM/qwen-code）

##### 形态
- CLI（命令 `qwen`，Node ≥ 22），还有官方桌面版（macOS / Windows / Linux）、IDE 插件（VS Code、Zed、JetBrains）、Web UI、SDK、聊天渠道（钉钉、飞书、微信等）、ACP（[README](https://github.com/QwenLM/qwen-code/blob/main/README.md)）。Windows/macOS/Linux 都支持。
- 注意：README 置顶「Qwen Code 1.0 Preview」，说它合并了 Qoder 的 agent harness，在单独的 `v1.0.0-preview` 分支和 1.x 文档里。下面写的是主分支（0.27.x）；1.0 正式后存储和钩子是否变化未核实，接入前要再查一次。

##### 会话
- 全局目录 `~/.qwen/`（`QWEN_HOME` 可改）；会话等运行数据放在运行目录，默认等于 `QWEN_HOME`，可用 `QWEN_RUNTIME_DIR` 或 `advanced.runtimeOutputDir` 改（[settings.md](https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md)）。
- 路径：`<运行目录>/projects/<清理后的项目根路径>/chats/<sessionId>.jsonl`（[storage.ts](https://github.com/QwenLM/qwen-code/blob/main/packages/core/src/config/storage.ts) 的 `getProjectDir`，[chatRecordingService.ts](https://github.com/QwenLM/qwen-code/blob/main/packages/core/src/services/chatRecordingService.ts)）。Gemini CLI 原来的 `tmp/<hash>/chats/*.json` 和 checkpoint 已不是会话主存储；`checkpoints` 现在在项目临时目录里，给回滚用。
- 格式：JSONL，每行一个 `ChatRecord`：`uuid`、`parentUuid`、`sessionId`、`timestamp`、`type`（user / assistant / tool_result / system）、`subtype`、`cwd`、`version`、`gitBranch`、`model`、`usageMetadata`、`message`。整体很像 Claude Code 的 transcript。
- 标题：`system` 记录的 `subtype: 'custom_title'`，带 `titleSource`（`manual` / `auto`，/rename 或自动生成）；另外源码里还有 title sidecar 文件（`session-title-sidecar.js`，具体文件名未核实）。模型有 `session_model` 子类型记录和每条 assistant 的 `model`。
- **运行中判断**：同目录 `chats/<sessionId>.runtime.json` 是专门给外部观察者（终端复用器、IDE、状态守护进程）的运行状态文件，字段 `schema_version`、`pid`、`proc_start`、`pid_ns`、`session_id`、`work_dir`、`hostname`、`started_at`、`qwen_version`（[runtimeStatus.ts](https://github.com/QwenLM/qwen-code/blob/main/packages/core/src/utils/runtimeStatus.ts)、storage.ts `getRuntimeStatusPath` 的注释）。pid 还活着且 `proc_start` 对得上 → 会话进程在；退出时是否删除文件未核实，用 pid 判断更稳。一轮是否结束：看最后一条记录（有 `tool_loop_end`、`goal_turn_end` 等子类型），或用 `Stop` 钩子。
- 设计说明另见 [daemon-session-runtime-status.md](https://github.com/QwenLM/qwen-code/blob/main/docs/design/daemon-session-runtime-status.md)（未细读）。

##### 钩子
- 配置：`settings.json` 的 `hooks` 字段，用户级 `~/.qwen/settings.json`，项目级 `.qwen/settings.json`（项目钩子要用户批准或信任文件夹才运行）。格式和 Claude Code 一样：`{"hooks":{"PreToolUse":[{"matcher":"...","hooks":[{"type":"command","command":"...","timeout":10}]}]}}`。另有 `http`、`prompt`、`function` 三种钩子类型；command 钩子 `timeout` 单位是秒，默认 60，**值 ≥1000 当毫秒**（要等 30 分钟就写 `1800000`）（[hooks.md](https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/hooks.md)）。
- stdin 公共字段：`session_id`、`transcript_path`、`cwd`、`hook_event_name`、`timestamp`、`permission_mode`，子代理里带 `agent_id`。字段名和 Claude Code 一致。
- 事件：`PreToolUse`、`PostToolUse`、`PostToolUseFailure`、`PostToolBatch`、`UserPromptSubmit`、`UserPromptExpansion`、`SessionStart`、`SessionEnd`、`SessionDelete`、`MessageDisplay`、`Stop`、`StopFailure`、`SubagentStart`、`SubagentStop`、`PreCompact`、`PostCompact`、`Notification`（matcher `permission_prompt` / `idle_prompt` / `auth_success`）、`PermissionRequest`、`PermissionDenied`、`TodoCreated`、`TodoCompleted`、`InstructionsLoaded`、`FileChanged`。
- 等授权事件：`PermissionRequest`（权限框弹出时）和 `Notification` 的 `permission_prompt`；等回答可用 `idle_prompt`。
- **能挂起回 allow/deny**：`PermissionRequest` 钩子回 `{"hookSpecificOutput":{"decision":{"behavior":"allow"|"deny","message":..,"interrupt":..}}}`，和 Claude Code 的 PermissionRequest 一样；`PreToolUse` 也能回 `permissionDecision` allow / deny / ask（allow 不跳过权限框，ask 改由 TUI 确认）。ACP 会话里替换输入后不运行；无头模式 ask 当 deny。
- 改完要不要重启：settings 里的钩子启动时注册一次；在会话里打开 `/hooks` 菜单会重读用户、项目、系统三级配置，不用重启；`disableAllHooks` 等开关仍要重启。

##### 全局提示词文件
- `QWEN.md`，用户级在 `~/.qwen/QWEN.md`（文件名可用 `context.fileName` 改成数组，比如 `["CONTEXT.md","QWEN.md"]`）；另有 `~/.qwen/memory.md`（storage.ts）。`~/.qwen/QWEN.md` 这条路径是按 Gemini CLI 的约定和 settings 文档推断的，文档里没找到原句，算半核实。

##### 用量 / 额度
- 本地：每条 assistant 记录有 `usageMetadata`（token 数）；源码有 `tokenUsageService`、`usageHistoryService`、`usage-dashboard-service`。
- 额度接口：Qwen OAuth 现在要 chat.qwen.ai 的 Plus / Pro 订阅（免费额度不再是文档主推），百炼 Coding Plan 是「每周额度」（[auth.md](https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/auth.md)）。有没有可查剩余额度的 HTTP 接口，**未核实**。

##### 跳转
- 命令 `qwen`（npm 包 `@qwen-code/qwen-code`），进程名大概率是 `node`，未核实。`runtime.json` 直接给出 pid 和 `work_dir`，定位会话进程比其他家容易。恢复会话的参数（`--resume`）未核实。

##### cc-connect
- README 支持矩阵**没有单列 Qwen Code**，`agent/` 目录也没有 qwen 适配器；README 说支持「任何兼容 ACP 的代理」，Qwen Code 支持 ACP，所以理论上能用通用 ACP 适配接，未实测（[README](https://github.com/chenhg5/cc-connect/blob/main/README.md)）。

##### 接入难度：低
它就是 Claude Code 式钩子：`~/.qwen/settings.json` 结构、stdin 字段、`PermissionRequest` 回 `decision.behavior` 都和 Claude Code 一样，浮屿的 Claude Code 钩子脚本和安装逻辑几乎能直接套（只要注意 timeout 单位：≥1000 才是毫秒）。会话是 Claude Code 风格的 JSONL，外加官方给外部程序准备的 `runtime.json`（带 pid），判断「会话还开着」比 Claude Code 还直接。风险是 1.0 Preview（合了 Qoder harness）上线后格式可能变。

---

#### 3. iFlow CLI（心流）

**已停止服务**：官方仓库 README 置顶公告「iFlow CLI will be shutting down on April 17, 2026 (UTC+8)」，并链接告别帖（[iflow-ai/iflow-cli README](https://github.com/iflow-ai/iflow-cli)，最后一次提交 2026-03-20 就是加这条公告）。告别帖页面（vibex.iflow.cn/t/topic/4819）本次打不开；第三方 issue 转述官网公告说让用户迁移到 Qoder（[CLIProxyAPI#2561](https://github.com/router-for-me/CLIProxyAPI/issues/2561)），迁移目标未在官方原文里核实。npm 上 latest 是 0.5.19（2026-04-25，停服后仍有一次发布，内容未核实）。

下面只列停服前的情况，供参考：

##### 形态
- Gemini CLI 的分支，CLI（命令 `iflow`，npm `@iflow-ai/iflow-cli`，也有 Homebrew），VS Code / JetBrains 插件、SDK、ACP（README）。Windows/macOS/Linux 都有安装说明（README），细节未核实。

##### 会话
- `iflow --resume` 和 `/chat` 能恢复会话（README）。存储路径和格式**未核实**（大概率在 `~/.iflow/` 下，未查到原文）。

##### 钩子
- 配置 `~/.iflow/settings.json` 的 `hooks`，Claude Code 式嵌套 JSON（`matcher` + `hooks:[{type:"command",command,timeout}]`），9 个事件：`PreToolUse`、`PostToolUse`、`SetUpEnvironment`、`Stop`、`SubagentStop`、`SessionStart`、`SessionEnd`、`UserPromptSubmit`、`Notification`（[platform.iflow.cn Hooks 文档](https://platform.iflow.cn/en/cli/examples/hooks)）。`PreToolUse` 能阻止工具，`Notification` 可匹配 `permission` 文字但退出码 2 不阻止。**没有 PermissionRequest 事件**，能否回 allow 未核实。

##### 全局提示词文件
- 未核实（Gemini 分支，推测是 `~/.iflow/IFLOW.md`，没查到原文）。

##### 用量 / 额度
- 主打免费模型（iFlow 开放平台），无额度接口资料，未核实。

##### 跳转
- 命令 `iflow`，进程名未核实。

##### cc-connect
- README 支持矩阵写「iFlow CLI ✅」，有 `agent/iflow` 适配器（[README](https://github.com/chenhg5/cc-connect/blob/main/README.md)）。服务停了，这个适配器实际已无用。

##### 接入难度：不建议做
服务 2026-04-17 已关，新用户装不上能用的后端。若要覆盖它的老用户，应该去看迁移目标 Qoder CLI（cc-connect 有 `agent/qoder` 适配器），不在本次范围。

---

#### 结论

| 代理 | 难度 | 能做到 | 做不到 / 未核实 |
|---|---|---|---|
| Kimi Code CLI | 中 | 会话列表（标题、目录、最近提问、上一轮完成/取消/失败）、亮灯、「等你」、会话退出、用量环（`/usages`，已有） | 岛上「允许」不能替批（只能 deny）；钩子要写 TOML；桌面版目录独立且能否装钩子未核实 |
| Qwen Code | 低 | 会话列表、运行中（`runtime.json` pid）、亮灯、「等你」、岛上允许/拒绝（`PermissionRequest` 和 Claude Code 一样） | 额度接口未核实；1.0 Preview 可能改格式 |
| iFlow CLI | 不做 | — | 2026-04-17 已停服 |

### 腾讯 CodeBuddy、通义灵码（Qoder CN）、Qoder

查询日期：2026-11-15。只联网查文档、npm 和 GitHub 源码，本机只看了 `~/.codebuddy/settings.json` 的钩子结构，没有读任何会话内容，也没装这几家的软件，所以下面写的会话格式都没在本机核实过。

**先说三条最重要的结论：**

1. **CodeBuddy Code（CLI）和 WorkBuddy 是同一套内核。** 官方 CLI 文档同时挂在 codebuddy.ai 和 workbuddy.ai 上，环境变量文档也把 `workbuddy.ai` 列为 CodeBuddy Code 的国际版接口 [C3]。会话 JSONL 的记录类型（`message` + `role`、`ai-title`/`aiTitle`、`function_call`）和我们 `workbuddy.rs` 已经读的一样 [C5]。所以 CLI 基本能照搬 WorkBuddy 的做法，数据目录从 `~/.workbuddy` 换成 `~/.codebuddy`。
2. **通义灵码 2026-05-20 起改名 Qoder CN** [L1]。「通义灵码 IDE」现在叫 Qoder CN IDE，插件叫「Qoder CN (Formerly Lingma)」。另有 Qoder CN CLI（`qodercn`），数据目录是 `~/.qoder-cn`。所以第 2 项和第 3 项其实是同一家阿里产品线的国内版和国际版。
3. **Qoder CLI 和 Qoder CN CLI 几乎是 Claude Code 的翻版。** 会话存在 `~/.qoder[-cn]/projects/<项目>/<id>.jsonl`，钩子和 Claude Code 一样（28 个事件，含 `PermissionRequest`，回包是 `hookSpecificOutput.decision.behavior`）[Q1][Q2][Q3]，cc-connect 也已经支持 [X1]。在所有形态里它的接入难度最低。

---

#### 1. 腾讯 CodeBuddy

##### 1.1 CodeBuddy Code（CLI，`codebuddy` / `cbc`）

版本：npm `@tencent-ai/codebuddy-code` 2.184.0（2026-11-13 发布）。bin 有 `codebuddy`、`cbc`、`codebuddy-code`，homepage 是 cnb.cool/codebuddy/codebuddy-code（`npm view`）。国内版和国际版是同一个包，用环境变量 `CODEBUDDY_INTERNET_ENVIRONMENT` 切换（`internal` 是国内版，`ioa` 是 iOA 企业版）[C3]。数据目录都是 `~/.codebuddy`，可以用 `CODEBUDDY_CONFIG_DIR` 改 [C3]。

- **形态**：Windows / macOS / Linux 都能用（npm 包，第三方实现都写了三个平台的进程名 [C6]）。
- **会话**：
  - 路径：`~/.codebuddy/projects/<压缩后的 cwd>/<uuid>.jsonl`，子代理的记录在 `<uuid>/subagents/*.jsonl` [C2][C5]。另外 `~/.codebuddy/history.jsonl` 是全局输入历史（`/resume` 用）；`~/.codebuddy/sessions/` 官方只写了「活动会话数据」[C2]。
  - 格式：JSONL。新版每行包一层信封 `{type, uuid, timestamp, payload:{…}}`，旧版和 `session-meta` 行没有信封。内容的记录类型和 WorkBuddy 相同：`message`（`role` 为 user / assistant），标题有 `custom-title`/`customTitle`（用户改名，优先）、`ai-title`/`aiTitle`、`topic`，每条带 `cwd`。文件名就是 `codebuddy --resume <id>` 用的 id [C5]。
  - 能列出会话、拿到标题：能（标题优先级参照 CLI 自己的 `getEffectiveSessionTitle`，见 [C5]）。
  - 运行中 / 完成：官方没写。记录类型和 WorkBuddy 一样，可以先套 `workbuddy.rs` 的 `parse_tail`（最后是 `function_call` 算运行中，最后是 assistant 的 completed 消息算这轮结束）。**未核实**，要本机跑一次确认。
  - 退出：WorkBuddy 用 `sessions/<pid>.json`（`pid`、`lastHeartbeat`）判断退出。CodeBuddy 的 `sessions/` 官方只写「活动会话数据」，里面是不是同样的进程登记**未核实**。还有两个兜底：`SessionEnd` 钩子，或者按进程名 `codebuddy` 判断。
- **钩子**：
  - 配置：`~/.codebuddy/settings.json`，项目级 `.codebuddy/settings.json` 和 `.codebuddy/settings.local.json`，各层合并 [C1]。本机这个文件目前是 Vibe Island 装的 9 个事件，类型都是 command，没装 `PermissionRequest`。
  - 格式：Claude Code 格式（`matcher` + `hooks:[{type, command|url, timeout}]`），支持 `command` / `http` / `prompt` / `agent` 四种类型 [C1][C3]。
  - 事件：文档主表列了 10 个（`PreToolUse`、`PostToolUse`、`Notification`、`UserPromptSubmit`、`Stop`、`SubagentStop`、`PreCompact`、`PostCompact`、`SessionStart`、`SessionEnd`）[C1]，插件参考里的全表有 26 个，含 `PermissionRequest`、`PermissionDenied`、`PostToolUseFailure`、`StopFailure`、`Elicitation` 等 [C4]。公共输入字段：`session_id`、`transcript_path`、`cwd`、`permission_mode`、`hook_event_name` [C1]。
  - 等授权：`Notification`，`notification_type=permission_prompt` [C1]；还有 `PermissionRequest`。**要注意**：auto 模式下，`PermissionRequest` 在自动审查之前就会触发，连最后被自动放行的调用也会触发。所以用它亮「等你」会误报，Orca 已经改成只认 `Notification(permission_prompt)`（对照的是 2.159.0 / 2.180.0 的包）[C7]。
  - 挂起回 allow/deny：
    - `PreToolUse` 有官方文档，回 `hookSpecificOutput.permissionDecision`（allow / deny / ask）[C1]。
    - `PermissionRequest` 能挂起审批，clawd-on-desk 已经在用：装 `type:"http"` 钩子，`timeout: 600`，在桌面气泡上让用户允许或拒绝 [C6]。回包格式官方没写，按我们给 WorkBuddy 用的 `hookSpecificOutput.decision.behavior` 应该能用，**未核实**。
    - 默认超时 60 秒，审批钩子要自己写大 [C1]。
    - 和上面同一个问题：auto 模式下挂起 `PermissionRequest`，会让用户去点本来会被自动放行的调用。
  - 改完要不要重启：不热加载。会话启动时对钩子做快照，配置在外部被改了会提示，要在 `/hooks` 面板里确认后才生效，等于新开会话才生效 [C1]。
- **全局提示词文件**：`~/.codebuddy/CODEBUDDY.md`，另有 `~/.codebuddy/rules/*.md`。项目里没有 `CODEBUDDY.md` 时才读 `AGENTS.md` [C8]。
- **用量 / 额度**：`/cost`、`/stats` 只有 token 和调用次数，没有额度命令 [C9]。`~/.codebuddy/usage-data/` 官方写的是「使用统计」，文件格式**未核实** [C2]。WorkBuddy 每条记录有 `providerData.rawUsage.credit`，CodeBuddy 有没有**未核实**。用量环先不做。
- **跳转**：CLI 跑在终端里，进程名是 `codebuddy`（Windows 上是 `codebuddy.exe`）[C6]。可以复用现有的终端跳转，用 `cwd` 定位窗口，用会话 id 回到 `--resume`。
- **cc-connect**：README 没有点名 CodeBuddy，但支持「任何 ACP 代理」[X1]，而 CodeBuddy Code 支持 `codebuddy --acp`，也在 ACP 官方注册表里 [C10]。理论上能接，**未实测**。
- **接入难度：低**。会话照搬 WorkBuddy 的 JSONL 解析，多处理一层 `payload` 信封；钩子用 Claude Code 式，换个目录。能做到：会话列表、标题、亮灯、「等你」（用 `Notification(permission_prompt)`），以及岛上审批（`PermissionRequest`，要处理 auto 模式的问题）。

##### 1.2 CodeBuddy IDE（独立 IDE，国内版 「CodeBuddy CN」，国际版 「CodeBuddy」）

版本：腾讯云更新日志里，Hooks 是 4.3.0（2026-01-15）加的，后面还有 4.10.4 [C11]，当前最新版本号**未核实**。

- **形态**：Windows / macOS（Homebrew 有 `codebuddy-cn` cask；macOS 数据目录 `~/Library/Application Support/CodeBuddy CN/` [C12]）。Linux **未核实**。
- **会话**：
  - 路径：`CodeBuddyExtension/Data/history/<workspace_hash>/<session_id>/`，Windows 在 `%LOCALAPPDATA%\CodeBuddyExtension\Data\`，macOS 在 `~/Library/Application Support/CodeBuddyExtension/Data/`，Linux 在 `~/.config/CodeBuddyExtension/Data/`。IDE 和插件共用这一份 [C13]。
  - 格式：每个会话一个 `index.json` 清单加 `messages/<msg_id>.json`，一条消息一个文件。工作区元数据在上一层的 `index.json`；消息里有 `lastStepInputTokens` / `lastStepOutputTokens` 这类计数 [C13]。这是 agentsview 看本机数据反推的，**没有公开格式**。
  - 能列出会话、拿到标题：能列；标题字段**未核实**。
  - 运行中 / 完成、退出：**未核实**（没有公开字段，要靠钩子和进程判断）。
  - 和 CLI、WorkBuddy 的关系：不共用。CLI 用 `~/.codebuddy/projects`，IDE 和插件用 `CodeBuddyExtension/Data` [C2][C13]。
- **钩子**：
  - 配置：和 CLI 同一个 `~/.codebuddy/settings.json`，项目里是 `.codebuddy/settings.json`。腾讯云文档写的是「完全兼容 Claude Code Hooks 规范」[C11][C14]。
  - 事件：腾讯云文档（2026-03-02 更新）只列了 7 个：`SessionStart`、`SessionEnd`、`PreToolUse`、`PostToolUse`、`UserPromptSubmit`、`Stop`、`PreCompact`，**没有 `Notification` 和 `PermissionRequest`** [C14]。clawd-on-desk 把 IDE 和 CLI 当一类处理（进程名列了 `CodeBuddy.exe`）[C6]，但 IDE 会不会发 `PermissionRequest` **未核实**。
  - 等授权：按官方文档做不了，**未核实**。
  - 挂起回 allow/deny：`PreToolUse` 回 `permissionDecision`（allow / deny / ask）[C14]。可以在 PreToolUse 里挂起等岛上的结果，但这样每个工具调用都要先过一遍岛，和 IDE 自己的授权弹窗不是一回事。
  - 改完要不要重启：文档只说「新开会话」验证 [C14]。
- **全局提示词文件**：和 CLI 共用 `CODEBUDDY.md`、rules，**未核实**。
- **用量 / 额度**：没有本地额度数据，**未核实**。
- **跳转**：进程名 Windows `CodeBuddy.exe`，macOS `CodeBuddy` [C6]（国内版 app 叫 `CodeBuddy CN` [C12]）。能激活窗口；定位到具体会话**未核实**。
- **cc-connect**：不支持（IDE 没有命令行入口）。
- **接入难度：中**。会话要按私有的 index.json 加 messages 目录写新的读取器，格式随时可能变；钩子事件少，「等你」和岛上审批都没有官方支持，只能做亮灯和完成提示。

##### 1.3 CodeBuddy 的 VS Code / JetBrains 插件

版本：VS Code 市场 `Tencent-Cloud.coding-copilot` 4.12.39997873（2026-10-08）。

- **形态**：VS Code、JetBrains，Windows / macOS / Linux。
- **会话**：和 IDE 同一份 `CodeBuddyExtension/Data/history`，格式同 1.2 [C13]。插件的登录信息在 `Tencent-Cloud.coding-copilot.info`，那是凭据，不要读。
- **钩子**：插件会不会读 `~/.codebuddy/settings.json`，官方没写，**未核实**。
- **全局提示词文件、用量**：**未核实**。
- **跳转**：宿主是 VS Code / JetBrains，只能激活宿主窗口，定位到会话**未核实**。
- **cc-connect**：不支持。
- **接入难度：中到高**。只能读会话列表（私有格式），钩子没有官方依据。

---

#### 2. 阿里通义灵码 Lingma（2026-05-20 起叫 Qoder CN）

官方说明：「Qoder CN 系列原名『智能编码助手通义灵码』（Lingma），将于 2026 年 5 月 20 日正式更名」，现在包含 Qoder CN IDE、JetBrains 插件、QoderWork CN、Qoder CN CLI 等子产品 [L1]。新文档站是 docs.qoder.cn。

##### 2.1 Qoder CN IDE（原通义灵码 IDE / Lingma IDE）

- **形态**：Windows / macOS（Linux **未核实**），版本号**未核实**。
- **会话**：IDE 里可以搜索、打开历史会话 [L3]，本地存储路径和格式**未核实**。agentsview 看到的是：新的 Qoder CN 桌面应用把标题存在 `com.qodercn.app.stable/main.sqlite` 的 `chat_sessions` 表里，正文在 `~/.qoder-cn/projects` [Q5]，但那是新的「Qoder CN」桌面产品，不是 IDE。
- **钩子**：
  - 配置：`~/.qoder-cn/settings.json`，项目里是 `.qoder/settings.json` 和 `.qoder/settings.local.json`；和 Qoder CN CLI 共用同一份文件，但各入口只执行自己支持的事件 [L2]。
  - 格式：Claude Code 式（matcher + hooks）。支持 `command` 和 `http` 两种；工具名同时认 Claude Code 的名字（`Bash` 等于 `run_in_terminal`）[L2]。
  - 事件（12 个）：`SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PermissionRequest`、`PostToolUse`、`PostToolUseFailure`、`SubagentStart`、`SubagentStop`、`Stop`、`SessionEnd`、`PreCompact`、`Notification` [L2]。
  - 等授权：`PermissionRequest`（可阻断），`Notification` 不可阻断 [L2]。
  - 挂起回 allow/deny：能。回 `hookSpecificOutput.permissionDecision` = allow / deny / ask。**和 CLI 的回包结构不一样**（CLI 要嵌套的 `decision.behavior`），文档专门提醒不要一个脚本两边共用 [L2]。默认超时 30 秒，**超时按放行处理** [L2]，审批钩子必须把 `timeout` 写大；上限**未核实**。
  - 改完要不要重启：CN IDE「修改配置后可在下一次请求中生效」[L2]。
- **全局提示词文件**：IDE 有「规则」和「记忆」功能 [L4]，用户级文件路径**未核实**（CLI 是 `~/.qoder-cn/AGENTS.md`，见 2.3）。
- **用量 / 额度**：Credits 制，订阅席位按 Credits 计 [L1]；本地没有可读的额度，**未核实**。
- **跳转**：进程名**未核实**。
- **cc-connect**：不支持。
- **接入难度：中**。钩子齐全（亮灯、「等你」、岛上审批都能做，回包要单独写一种）；会话存储没有公开说明，列表要先在本机反查。

##### 2.2 Qoder CN 的 VS Code / JetBrains 插件（原通义灵码插件）

版本：VS Code 市场 `Alibaba-Cloud.tongyi-lingma`，显示名「Qoder CN (Formerly Lingma)」2.6.11（2026-11-07）。

- **形态**：VS Code、JetBrains（2020.3 以上，支持远程开发）[L5]，Windows / macOS / Linux。
- **会话**：旧版 VS Code 插件把对话存在 `~/.lingma/cache/db/local.db`（SQLite），`chat_record` 表有 `summary`、`chat_prompt`、`extra` 列 [L6]。工具最后更新于 2026-05，改名后的新版本还是不是这样**未核实**。插件设置里有「本地存储路径」可以改 [L5]。有没有运行中、完成、退出字段，**未核实**。
- **钩子**：Qoder（国际版）的文档写钩子适用于「Qoder IDE and JetBrains plugin」[Q4]；国内版文档只写了 IDE [L2]。VS Code 插件有没有钩子**未核实**。
- **全局提示词文件**：`~/.lingma/` 下面有 `skills/`（第三方 skill 管理器都往这里装）[L7]，用户级规则文件**未核实**。
- **用量**：**未核实**。
- **跳转**：只能激活宿主 IDE。
- **cc-connect**：不支持。
- **接入难度：高**。会话在 SQLite 里，要加 SQLite 依赖，字段私有，改名后可能已经变了；钩子只有 JetBrains 插件可能有（未核实），VS Code 插件没有依据。

##### 2.3 Qoder CN CLI（`qodercn` / `qoderclicn`）

版本：npm `@qodercn-ai/qoderclicn` 1.1.89（2026-11-13）。官方推荐用安装脚本装原生版，npm 只为兼容保留 [L8]。

- **形态**：Windows / macOS / Linux [L8]。
- **会话**：`~/.qoder-cn/projects/<处理后的项目路径>/<session-id>.jsonl`（对话），`…/<session-id>/state.json`（会话状态）；配置目录可以用 `QODERCN_CONFIG_DIR` 改 [L9]。格式同 3.2。
- **钩子**：
  - 配置：`~/.qoder-cn/settings.json`，项目里是 `.qoder/settings.json` 和 `.qoder/settings.local.json`，三层合并 [L2b]。
  - 事件：阿里云旧文档列了 `SessionStart`、`SessionEnd`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`PostToolUseFailure`、`Stop`、`SubagentStart`、`SubagentStop`、`PreCompact`、`Notification`（`notification_type`：`permission` / `result`）、`PermissionRequest` [L2b]；新文档站有 Hooks 参考 [L10]。
  - 等授权：`PermissionRequest`、`Notification(permission)`。
  - 挂起回 allow/deny：`PermissionRequest` 能阻断。国内文档没写回包格式，按国际版 CLI 应该是 `hookSpecificOutput.decision.behavior`（见 3.2），**未在国内版核实**。旧文档默认超时 60 秒 [L2b]。
  - 改完要不要重启：旧文档写「编辑配置文件即可生效」[L2b]。
- **全局提示词文件**：同 3.2，应该是 `~/.qoder-cn/AGENTS.md`，**未核实**。
- **用量**：`/usage`（Credits），同 3.2 [L11]。
- **跳转**：终端里的进程，复用终端跳转。
- **cc-connect**：README 只点名 Qoder CLI。cc-connect 的 qoder 适配器能指定命令（默认 `qodercli`），换成 `qoderclicn` 能不能用**未核实** [X2]。
- **接入难度：低**，做法同 3.2，目录换成 `~/.qoder-cn`。

---

#### 3. 阿里 Qoder（国际版）

Qoder 现在有五种形态：Qoder IDE（VS Code 系）、JetBrains 插件、Qoder CLI、新的「Qoder」桌面应用（从 IDE 的 Quest 模式独立出来，和 IDE 并存，**两边的会话历史分开存**）[Q6]，以及 QoderWork。

##### 3.1 Qoder IDE（含 JetBrains 插件）

- **形态**：Windows / macOS / Linux，版本号**未核实**。
- **会话**：agentsview 认为新版 IDE 把会话写成 CLI 格式，放在 `SharedClientCache/cli/projects/` 下面，文件直接平铺在目录里，不按项目分子目录。Windows 是 `%APPDATA%\Qoder\SharedClientCache\cli\projects`，macOS 是 `~/Library/Application Support/Qoder/SharedClientCache/cli/projects`，Linux 是 `~/.config/Qoder/SharedClientCache/cli/projects` [Q5]。这是第三方观察，**未核实**；标题存在哪里也没确认 [Q5]。
- **钩子**：
  - 配置：`~/.qoder/settings.json`，项目里是 `.qoder/settings.json` 和 `.qoder/settings.local.json`；和 CLI 共用同一份文件，各入口只执行自己支持的事件 [Q4]。
  - 格式：Claude Code 式，支持 `command` 和 `http`，工具名兼容 Claude Code 的名字 [Q4]。
  - 事件（12 个）：同 2.1。输入里还有 `extra`（`email`、`repo`、`branch`…）；`Notification` 带 `notification_type`、`title`、`message` [Q4]。
  - 等授权：`PermissionRequest`（可阻断）。
  - 挂起回 allow/deny：能。回 `hookSpecificOutput.permissionDecision`（allow / deny / ask）。和 CLI 的回包结构不同 [Q4]。默认超时 30 秒，**超时按放行处理** [Q4]。
  - 改完要不要重启：**要重启 IDE**，暂不支持热加载 [Q4]。
- **全局提示词文件**：IDE 有记忆和规则功能，用户级文件**未核实**。
- **用量**：Credits [Q7]，本地没有额度数据，**未核实**。
- **跳转**：进程名**未核实**（agentsview 文档里的应用数据目录名是 `Qoder`）。
- **cc-connect**：不支持。
- **接入难度：中**。钩子齐全，能做亮灯、「等你」、岛上审批（回包和 CLI 不同，改钩子要重启 IDE）；会话路径只有第三方依据，要先在本机核实。

##### 3.2 Qoder CLI（`qodercli` / `qoder`）

版本：npm `@qoder-ai/qodercli` 1.1.89（2026-11-13），bin 有 `qoder`、`qodercli`。官方安装方式是 `curl -fsSL https://qoder.com/install | bash` [X1]。tape 的源码注释说它是 iFlow CLI 的后继、和 Qwen Code 同源 [Q8]。

- **形态**：Windows / macOS / Linux。
- **会话**：
  - 路径：`~/.qoder/projects/<处理后的项目路径>/<session-id>.jsonl`（对话），`…/<session-id>/state.json`（会话状态）；可以用 `QODER_CONFIG_DIR` 改 [Q9]。另外还有 `<session-id>-session.json` 元数据（`title`、`working_dir`、`parent_session_id`、`fork_from`），`/resume` 列表就是读它 [Q5][Q8]。子代理在 `<session-id>/subagents/` [Q5]。
  - 格式：agentsview 和 ORG2 都直接用 Claude Code 的 JSONL 解析器解析 [Q5][Q10]；tape 说是 Qwen 的 `ChatRecord`（`uuid`、`parentUuid`、`sessionId`、`type`、`message.parts`）[Q8]。两种说法有出入，**要本机看一行确认**。
  - 能列出会话、拿到标题：能。标题看 `-session.json` 的 `title`，`-n` 和 `/rename` 可以改名 [Q9]。
  - 运行中 / 完成：可以按 Claude Code 的规则从 JSONL 末尾判断（**未核实**），或者用钩子（`UserPromptSubmit` → `Stop`）。另外 CLI 会通过 OSC 7501 向终端上报状态（`QODER_PROGRAM_STATUS`）[Q11]。
  - 退出：有 `SessionEnd` 钩子；有没有像 `~/.claude/sessions` 那样的进程登记**未核实**。
- **钩子**：
  - 配置：`~/.qoder/settings.json`，项目里是 `.qoder/settings.json` 和 `.qoder/settings.local.json`，合并执行 [Q2]。
  - 格式：和 Claude Code 一样。支持 `command` / `http` / `prompt` / `agent`，条目字段 `name`、`timeout`、`if`、`async` [Q1]。
  - 事件（28 个）：`PreToolUse`、`PostToolUse`、`PostToolUseFailure`、`UserPromptSubmit`、`SessionStart`、`SessionEnd`、`Stop`、`StopFailure`、`SubagentStart`、`SubagentStop`、`PreCompact`、`PostCompact`、`Notification`、`ConfigChange`、`InstructionsLoaded`、`CwdChanged`、`FileChanged`、`WorktreeCreate`、`WorktreeRemove`、`Elicitation`、`ElicitationResult`、`TaskCreated`、`TaskCompleted`、`PermissionRequest`、`PermissionDenied`、`TeammateIdle`、`Setup` 等 [Q1]。公共字段：`session_id`、`transcript_path`、`cwd`、`hook_event_name`、`permission_mode` [Q1]。
  - 等授权：`PermissionRequest`，输入有 `tool_name`、`tool_input`、`permission_suggestions`；还有 `Notification`，`notification_type` 为 `permission_prompt` / `idle_prompt` / `elicitation_dialog` 等 [Q2]。
  - 挂起回 allow/deny：能。回 `hookSpecificOutput.decision.behavior` = allow / deny，可以带 `updatedInput`、`message`、`interrupt`，和 Claude Code 完全一样，我们现在的 `hook_response` 能直接用。command 和 http 钩子默认超时 600 秒 [Q2]。
  - 改完要不要重启：文档说改完「立即生效」，会触发 `ConfigChange` [Q2]。
- **全局提示词文件**：`~/.qoder/AGENTS.md`，项目里是 `AGENTS.md`、`AGENTS.local.md`、`.qoder/rules/**/*.md`；`context.fileName` 可以改文件名 [Q12]。
- **用量 / 额度**：按 Credits 计。`/usage` 显示 Plan、Plan Credits 用量/总量、Add-on Credits、Org 资源包 [Q7]，需要登录，只能在交互界面里看；没有本地文件或公开接口，**未核实**。自定义状态栏命令（`statusLine.command`）从 stdin 收到会话 id、cwd、模型、上下文用量等 [Q11]，里面没有写额度。用量环先不做。
- **跳转**：终端进程 `qodercli` / `qoder`，复用终端跳转，按 cwd 和会话 id（`qoder -r <id>`）定位。
- **cc-connect**：**支持**，README 点名了 Qoder CLI。适配器用 `qodercli -p -f stream-json --input-format stream-json` 驱动 [X1][X2]。
- **接入难度：低**。基本就是 Claude Code：钩子复用 Claude Code 式安装和 `decision.behavior` 审批，会话按 Claude Code JSONL 读加上 `-session.json` 标题，cc-connect 现成。唯一要先确认的是 JSONL 每行到底是 Claude 格式还是 Qwen 格式。

##### 3.3 新「Qoder」桌面应用（参考，不在本次重点）

- 钩子：读 `~/.qoder/settings.json`，「与 Qoder CLI 兼容」，事件和处理器类型和 CLI 一样，含 `PermissionRequest` [Q13]。
- 会话：标题在 `~/Library/Application Support/com.qoder.app.stable/main.sqlite` 的 `chat_sessions` 表（`session_id`、`title`），正文在 `~/.qoder/projects` [Q5]（第三方在单台机器上看到的）。
- 接入难度：**低到中**。钩子和 CLI 共用；标题要读 SQLite，不读的话可以用第一条用户输入代替。

---

#### 来源

CodeBuddy：
- [C1] CodeBuddy Code Hooks 文档（v1.16.0+，Beta）：https://www.codebuddy.ai/docs/cli/hooks
- [C2] `~/.codebuddy` 目录说明：https://www.codebuddy.ai/docs/cli/codebuddy-dir （同一页也在 https://www.workbuddy.ai/docs/cli/codebuddy-dir ）
- [C3] 环境变量（`CODEBUDDY_CONFIG_DIR`、`CODEBUDDY_INTERNET_ENVIRONMENT`，把 workbuddy.ai 列为国际版接口）：https://www.codebuddy.ai/docs/cli/env-vars
- [C4] 插件参考（26 个钩子事件，含 PermissionRequest）：https://www.codebuddy.ai/docs/cli/plugins-reference
- [C5] Coffee-CLI 的 CodeBuddy 会话解析：https://github.com/edison7009/Coffee-CLI/blob/main/src/tools/codebuddy.rs 、https://github.com/edison7009/Coffee-CLI/blob/main/src/server/history.rs
- [C6] clawd-on-desk 的 CodeBuddy 接入（PermissionRequest 用 http 钩子、timeout 600、进程名）：https://github.com/rullerzhou-afk/clawd-on-desk/blob/main/agents/codebuddy.js 、https://github.com/rullerzhou-afk/clawd-on-desk/blob/main/hooks/codebuddy-install.js
- [C7] Orca PR #38009（auto 模式下 CodeBuddy 的 PermissionRequest 会误报「等你」）：https://github.com/stablyai/orca/pull/38009
- [C8] 记忆文件：https://www.codebuddy.ai/docs/cli/memory
- [C9] 斜杠命令（`/cost`、`/stats`、`/statusline`）：https://www.codebuddy.ai/docs/cli/slash-commands
- [C10] ACP：https://www.workbuddy.ai/docs/cli/acp 、https://zed.dev/acp/agent/codebuddy-code
- [C11] CodeBuddy IDE 更新日志（4.3.0 加 Hooks）：https://www.tencentcloud.com/document/product/1256/77264
- [C12] Mole 清理脚本里的 `CodeBuddy CN` 数据目录：https://github.com/tw93/Mole/blob/main/lib/clean/app_caches.sh ；Homebrew cask：https://github.com/Homebrew/homebrew-cask/blob/master/Casks/c/codebuddy-cn.rb
- [C13] agentsview 的 CodeBuddy IDE / 插件会话格式：https://github.com/kenn-io/agentsview/blob/main/docs/internal/session-format-sources.md#codebuddy 、https://github.com/kenn-io/agentsview/blob/main/docs/configuration.md
- [C14] 腾讯云 CodeBuddy Hook 指南（7 个事件，2026-03-02 更新）：https://www.tencentcloud.com/document/product/1256/77296

通义灵码 / Qoder CN：
- [L1] 什么是 Qoder CN 系列（原通义灵码，2026-05-20 改名）：https://help.aliyun.com/zh/lingma/product-overview/introduction-of-lingma
- [L2] Qoder CN IDE Hooks：https://docs.qoder.cn/user-guide/hooks.md
- [L2b] Qoder CN CLI Hooks（阿里云旧站）：https://help.aliyun.com/zh/lingma/qodercli-cn/user-guide/hook
- [L3] Qoder CN IDE 会话管理：https://docs.qoder.cn/user-guide/editor/conversation-management.md
- [L4] 规则 / 记忆：https://docs.qoder.cn/user-guide/rules.md 、https://docs.qoder.cn/user-guide/knowledge-engine/memory.md
- [L5] Qoder CN 插件概览和设置：https://docs.qoder.cn/plugins/introduction.md 、https://docs.qoder.cn/plugins/settings.md
- [L6] lingma-export（通义灵码 VS Code 插件对话导出，`~/.lingma/cache/db/local.db`）：https://github.com/dingdinglz/lingma-export
- [L7] 第三方 skill 管理器把 Qoder CN 的 skills 装在 `~/.lingma/skills`：https://github.com/MichengAI/dsh-skills-manager/blob/main/src/core.ts
- [L8] Qoder CN CLI 安装：https://docs.qoder.cn/cli/installation.md
- [L9] Qoder CN CLI 会话管理（`~/.qoder-cn/projects`、`QODERCN_CONFIG_DIR`）：https://docs.qoder.cn/cli/sessions.md
- [L10] Qoder CN CLI Hooks 参考：https://docs.qoder.cn/cli/hooks-reference.md
- [L11] Qoder CN CLI 用量与额度：https://docs.qoder.cn/cli/usage.md

Qoder：
- [Q1] Qoder CLI Hooks 参考（28 个事件）：https://docs.qoder.com/cli/hooks-reference
- [Q2] Qoder CLI Hooks 指南（PermissionRequest 回包 `decision.behavior`，默认超时 600 秒，立即生效）：https://docs.qoder.com/cli/hooks
- [Q3] npm `@qoder-ai/qodercli` 1.1.89 和 `@qodercn-ai/qoderclicn` 1.1.89（`npm view`，2026-11-15）
- [Q4] Qoder IDE / JetBrains 插件 Hooks（12 个事件，超时 30 秒按放行，要重启）：https://docs.qoder.com/extensions/hooks
- [Q5] agentsview 的 Qoder 解析（路径、`-session.json`、`main.sqlite` 标题）：https://github.com/kenn-io/agentsview/blob/main/internal/parser/qoder_paths.go 、https://github.com/kenn-io/agentsview/blob/main/internal/parser/qoder.go 、https://github.com/kenn-io/agentsview/blob/main/internal/parser/qoder_titles.go 、https://github.com/kenn-io/agentsview/blob/main/docs/internal/session-format-sources.md
- [Q6] 新 Qoder 桌面应用概览（和 IDE 并存，历史分开存）：https://docs.qoder.com/qoder/overview.md
- [Q7] Qoder CLI 用量（`/usage`，Credits）：https://docs.qoder.com/cli/usage.md
- [Q8] tape 的 Qoder 适配器（说是 Qwen ChatRecord 格式）：https://github.com/chenhg5/tape/blob/c40d46d16a32295da63221629293a000b0675df2/internal/source/qoder/qoder.go
- [Q9] Qoder CLI 会话管理：https://docs.qoder.com/cli/sessions.md
- [Q10] ORG2 用 Anthropic JSONL 解析器读 Qoder CLI：https://github.com/org2AI/ORG2/blob/main/src-tauri/crates/orgtrack-core/src/sources/qoder_cli/history.rs
- [Q11] Qoder CLI 配置参考（`QODER_CONFIG_DIR`、`QODER_PROGRAM_STATUS`、statusLine）：https://docs.qoder.com/cli/settings-reference.md 、https://docs.qoder.com/cli/interface.md
- [Q12] Qoder CLI 记忆（`~/.qoder/AGENTS.md`）：https://docs.qoder.com/cli/memory.md
- [Q13] 新 Qoder 应用 Hooks：https://docs.qoder.com/qoder/hooks.md

cc-connect：
- [X1] cc-connect README（点名 Qoder CLI、iFlow CLI，以及任意 ACP 代理；没有 CodeBuddy 和 Lingma）：https://github.com/chenhg5/cc-connect
- [X2] cc-connect 的 qoder 适配器：https://github.com/chenhg5/cc-connect/blob/main/agent/qoder/qoder.go

### 其他国内编程代理摸底

查询日期：2026-11-15。只列「能在本机跑、自己改文件跑命令」的代理。接入要两样：能读到本机会话文件，能装钩子，而且钩子能挂起并回 allow/deny。热度数字都是当天查的；「未核实」表示没查到可靠来源。

#### 总表

| 家 | 本地形态 | 会话可读 | 钩子 | 热度（2026-11-15） | 难度 |
|---|---|---|---|---|---|
| 智谱 ZCode | 桌面（Electron，Win/mac/Linux）+ 终端 CLI/TUI，开源 | 能：`~/.zcode/cli/db/db.sqlite`（SQLite） | 有。写在用户级 `~/.zcode/cli/config.json`，外层格式是 ZCode 自己的；事件名和 stdin/stdout 字段兼容 Claude Code；PreToolUse 和 PermissionRequest 都能回 allow/deny | GitHub 8.7k star；媒体报道用户破 100 万 | **低–中** |
| 小米 MiMo Code | 终端 CLI，Win/mac/Linux，开源，是 opencode 的分支 | 能：数据目录里的 SQLite（`~/.local/share/mimocode/`，Windows、macOS 上也是这个位置；B54 按源码核实） | 有。插件格式和 opencode 一样（`tool.execute.before`、`permission.ask`） | GitHub 13.8k star | **低**（复用 opencode 适配） |
| MiniMax Code（原 MiniMax Agent 桌面版） | 桌面（mac/Win）+ `mcode` CLI（mac/Linux/WSL/Win），CLI 开源 | 能读，但格式未核实：数据根 `~/.minimax`，源码里有 SQLite 持久化模块 | 有，但只能放在插件里；能读 Claude Code 格式的插件；PreToolUse 和 PermissionRequest 能回 allow/deny | GitHub 2.2k star；npm 周下载 1.78 万 | **中** |
| 华为 码道 CLI（CodeArts Agent CLI） | 终端 TUI/CLI，Win/mac/Linux；另有 IDE 形态 | 未核实 | 有。JS/TS 插件，事件和 opencode 一致（`tool.execute.before`、`permission.ask` 能回 allow/deny/ask），放在 `~/.codeartsdoer/plugin` | 未核实 | **低–中**（复用 opencode 适配，路径要核实） |
| 百度 文心快码 Comate | IDE 插件、Comate AI IDE、Zulu CLI（`@comate/zulu`，偏无头）、`comatecli` 交互终端 | 大概能：`~/.comate-engine/store/chat_session_*` | 未查到 | 报道称服务开发者超过 1000 万（整体口径）；CLI 周下载很低（zulu 727，comatecli 89） | **高**（只能列会话，做不了审批） |
| 智谱 CodeGeeX | 只有 IDE 插件 | — | — | 插件仓库最后更新 2025-12 | 不可行（没有本地代理形态） |
| 智谱 GLM Coding Plan | 只是模型套餐 | — | — | — | 用别家代理（Claude Code、ZCode、opencode 等），不用另接 |
| MiniMax Mini-Agent | 开源 demo（Python CLI） | 未核实 | 未核实 | 3.1k star，2026-02 之后没有推送 | 不建议（是演示项目） |
| 快手 CodeFlicker | IDE + 插件；CLI `flickcli` 只给快手内部员工 | — | 未核实 | 报道称快手内部 80% 以上工程师在用 | 不可行（公开版没有 CLI） |
| 美团 CatPaw（现「妙手」） | IDE（2025-11 公测）→ 改成通用 AI 工作台（桌面端 + 云端） | 未核实 | 未核实 | 内部覆盖 9 万员工 | 高（已不是编程代理，资料少） |
| 讯飞 iFlyCode | 只有 IDE 插件 | — | — | 未核实 | 不可行 |
| 阶跃 / 百川 / 零一 | 没查到编程代理客户端 | — | — | — | 不可行 |
| AtomCode（社区，Rust） | 终端 TUI + WebUI，mac/Linux/Win/鸿蒙 PC | 会话会保存，位置未核实 | 未核实（报道说在加 hook 系统） | AtomGit star 数未核实 | 中–高 |
| pi（pi-mono，海外开源，国内也有人用） | 终端 CLI | 能：`~/.pi/agent/sessions/--<路径>--/*.jsonl` | 是 TS 扩展，不兼容 Claude Code；`tool_call` 事件能 block | 122k star；npm 周下载 51 万 | 中 |

#### 推荐优先接的前三家

1. **ZCode**：用户最多（报道 100 万），钩子最完整。PermissionRequest 能直接回 allow/deny，stdin 带 `session_id`、`transcript_path` 这些 Claude Code 字段，岛现有的 Claude 钩子脚本几乎能直接用，只要按 ZCode 的格式写进 `~/.zcode/cli/config.json`。
2. **MiMo Code**：开源里 star 最多（13.8k），本身就是 opencode 的分支，岛已经有 opencode 的插件适配，主要工作是换数据目录和插件路径。
3. **MiniMax Code**：CLI 周下载 1.78 万，桌面版和 CLI 共用会话；钩子能直接读 Claude Code 格式的插件，但要装成本地插件，不是改配置文件。

码道 CLI 排第四：它也是 opencode 那一套，接入成本低，但用户量查不到。

---

#### 各家详情

##### 1. 智谱 ZCode
- **形态**：一份代码出 Electron 桌面、浏览器工作台和终端 Agent CLI/TUI（[jimmysong landscape](https://landscape.jimmysong.io/zh/projects/zcode/)）；开源在 [zai-org/ZCode](https://github.com/zai-org/ZCode)（TypeScript，2026-11-13 还有推送）。Linux 发 AppImage（[ZCode Linux/WSL 文档](https://zcode.z.ai/en/docs/linux-wsl)）。
- **会话**：CLI 的会话和任务库是 `~/.zcode/cli/db/db.sqlite`（带 wal/shm）。子代理的记录在 `cli/agents/<会话>/<代理>/transcript.jsonl`；桌面端另有 `~/.zcode/v2/sessions`、`v2/*.sqlite` 存任务索引（[docs/settings-storage-management.md](https://github.com/zai-org/ZCode/blob/main/docs/settings-storage-management.md)）。数据根可以在 `config.json` 的 `storage.dir` 里改，所以读的时候要先看配置。
- **钩子**（[ZCode Hooks 文档](https://zcode.z.ai/en/docs/hooks)）：
  - 用户级配置写在 `~/.zcode/cli/config.json`，要 `hooks.enabled: true`；结构是 `hooks.events.<事件>[].hooks[]`，`type: "process"`，命令和参数分开写（`command` + `args`）。插件里的 `hooks/hooks.json` 也会读；`.claude/settings.json` 只是导入的来源，不会执行；**项目级 hooks 整个被忽略**。
  - 事件有 SessionStart、UserPromptSubmit、PreToolUse、PermissionRequest、PostToolUse、PostToolUseFailure、Stop 等。stdin 是一行 JSON，同时给 camelCase 和 Claude Code 的 snake_case 字段（`session_id`、`transcript_path`、`hook_event_name`、`tool_name`…）。
  - PreToolUse 回 `permissionDecision: allow|deny|ask`；PermissionRequest 回 `behavior: allow|deny`；退出码 2 等于拦截。有超时（`timeoutMs`，例子里是 60000）。
  - 钩子配置在会话启动时取快照，改了要新开会话才生效；失败会记到 `~/.zcode/cli/log/zcode-<日期>.jsonl`。
  - 结论：输入输出兼容 Claude Code，配置外壳不兼容。
- **热度**：8,696 star（GitHub API）；报道称 8 月用户破 100 万（[新京报](https://m.bjnews.com.cn/detail/1786430136129187.html)、[IT之家](https://www.ithome.com/0/963/985.htm)，媒体口径）。GLM Coding Plan 把它列为官方工具（[docs.z.ai](https://docs.z.ai/devpack/overview)）。
- **难度：低–中。** 钩子脚本能复用 Claude 那套，要做的是按 ZCode 格式写配置，以及读 SQLite 列会话（表结构未核实）。

##### 2. 小米 MiMo Code
- **形态**：终端原生，MIT 开源，在 opencode 上二次开发（[腾讯新闻](https://news.qq.com/rain/a/20260612A02E2J00)、[掘金](https://juejin.cn/post/7697664935023968306)）。有 macOS/Linux 的 curl 安装和 Windows 的 PowerShell 安装（[README](https://github.com/XiaomiMiMo/MiMo-Code)）。
- **会话**：data 目录 `~/.local/share/mimocode/` 放 SQLite 数据库、凭据、记忆和日志，`MIMOCODE_HOME` 可以覆盖。（2026-11-15 更正：早先写的 mac `~/Library/Application Support/mimocode/`、Windows `%LOCALAPPDATA%\mimocode\` 不对，`xdg-basedir` 不分平台，Windows、macOS 上也是 `~/.local/share/mimocode/` 和 `~/.config/mimocode/`；B54 按源码核实。）配置在 `~/.config/mimocode/mimocode.jsonc`（同一份 README）。
- **钩子**：仓库里有 `packages/plugin/src/index.ts`、`tool.execute.before`、`permission.ask`（[packages/plugin](https://github.com/XiaomiMiMo/MiMo-Code/tree/main/packages/plugin)），和 opencode 的插件机制一样。插件放在 `~/.config/mimocode/plugin/`，事件和 opencode 一致（B54 按源码核实）。
- **热度**：13,787 star，2026-11-13 还有推送（GitHub API）。
- **难度：低。** 照搬岛的 opencode 插件和读库逻辑，改目录名和包名就行。

##### 3. MiniMax Code（原 MiniMax Agent 桌面版）
- **形态**：2026 年 5 月桌面版从 MiniMax Agent 改名 MiniMax Code（官方 changelog，见 [文档索引](https://code.minimax.io/docs/llms.txt)），桌面版支持 macOS/Windows。CLI 叫 `mcode`（npm `@minimax-ai/code`），有 TUI、headless 和 ACP 三种入口，和桌面版共用会话、模型、插件和权限（[CLI 功能](https://code.minimax.io/docs/cli/features.md)）。开源在 [MiniMax-AI/minimax-code](https://github.com/MiniMax-AI/minimax-code)（只有 CLI）。
- **会话**：数据根默认 `~/.minimax`（用 profile 时是 `~/.minimax-<profile>`），`MINIMAX_DATA_DIR` 可以覆盖，里面放配置、会话、日志、插件（[配置文档](https://code.minimax.io/docs/cli/configuration.md)）。源码里有 `packages/local-runtime/src/persistence/sqlite-*`，所以多半是 SQLite，**具体格式未核实**。
- **钩子**：只能通过插件提供（manifest 里的 `hooks` 字段或 hooks JSON），有 MiniMax、Claude 兼容和 Codex 兼容三种格式的适配。事件有 SessionStart、UserPromptSubmit、PreToolUse、PermissionRequest、PostToolUse、Stop 等（[docs/hooks.md](https://github.com/MiniMax-AI/minimax-code/blob/main/docs/hooks.md)）；PermissionRequest 和 PreToolUse 能回 allow/deny/ask（[contracts.ts](https://github.com/MiniMax-AI/minimax-code/blob/main/packages/agent-modules/plugin-hooks/src/contracts.ts)）。官方插件市场不收带 hooks 的插件，但本地插件目录可以放（`mcode plugin marketplace list` 能看到目录；[插件提交说明](https://code.minimax.io/docs/code/agents/plugin-submission.md)）。headless 模式不支持 `ask`。
- **热度**：2,245 star；npm `@minimax-ai/code` 一周下载 17,825（2026-11-08 到 14）。
- **难度：中。** 要把岛的钩子打包成一个本地插件，装到 profile 对应的目录；桌面版会不会读同一个插件目录、会话库的表结构，都还没核实。

##### 4. 华为 码道 CLI（CodeArts Agent CLI）
- **形态**：TUI 加命令行两种形态，支持 Windows 10/11 x64、macOS 11+（含 ARM）和多种 Linux（[什么是码道CLI](https://support.huaweicloud.com/usermanual-cli/codeartsagent_cli_0001.html)）。
- **钩子**：JS/TS 插件导出 Hook 对象，放在 `%USERPROFILE%/.codeartsdoer/plugin(s)` 或项目里的 `.codeartsdoer/`。事件有 `tool.execute.before/after`、`permission.ask`（allow/deny/ask）、`user.approval`、`chat.finished`、`turn.end`、`experimental.session.compacting` 等，命名和 opencode 插件一致（[Hooks 文档](https://support.huaweicloud.com/usermanual-cli/codeartsagent_cli_0018.html)）。和 Claude Code 不兼容，和 opencode 兼容。
- **会话**：有 `sessions` 命令，但存在哪里**未核实**。社区工具 agent-acta 能读它的本地日志（[npm @yxzpro/agent-acta](https://www.npmjs.com/package/@yxzpro/agent-acta)），说明本机有记录。
- **热度**：未核实。
- **难度：低–中。** 插件可以复用 opencode 那份，要核实会话路径和格式。

##### 5. 百度 文心快码 Comate
- **形态**：IDE 插件、Comate AI IDE（内置编程智能体 Zulu，[量子位 2025-06](https://www.qbitai.com/2025/06/300135.html)）。终端有两个包：`@comate/zulu`（命令 `zulu run`，偏无头和脚本；1.7.21，2026-09 发版，[pkgstats](https://www.pkgstats.com/pkg:@comate/zulu)）和 `@comate/comatecli`（交互式终端，2.0.0，2026-09，[npm](https://www.npmjs.com/package/@comate/comatecli)），后者内置 comate-engine 子进程。报道称文心快码 2026 年 9 月已并入百度搭子 DuMate（[界面新闻](https://m.jiemian.com/article/15064078.html)、[观察者网](https://www.guancha.cn/economy/2026_09_08_830369.shtml)，知情人士口径）。
- **会话**：Zulu 的 README 写对话历史在 `~/.comate-engine/store`，文件以 `chat_session_` 开头，日志在 `~/.comate-engine/log/`（pkgstats 镜像的 README）。IDE 里的会话存在哪里**未核实**。
- **钩子**：官方文档和 README 里**都没查到**。
- **热度**：报道称服务开发者超过 1000 万（整个产品）；CLI 一周下载 `@comate/zulu` 727、`@comate/comatecli` 89。
- **注意**：PyPI 上的 `comate-cli` 是个人项目（作者邮箱 aliyun、仓库 AndyLee1024/agent-sdk），[不是百度的](https://pypi.org/project/comate-cli/)。
- **难度：高。** 没有钩子就只能列会话，亮灯和审批都做不了；CLI 用的人也很少。

##### 6. 智谱 CodeGeeX、GLM Coding Plan
- CodeGeeX 是 IDE 插件（[Gitee 仓库](https://gitee.com/codegeex/codegeex-vscode-extension)，最后更新 2025-12-13），没有本地代理形态，智谱的代理产品现在是 ZCode。**不可行。**
- GLM Coding Plan 是模型订阅，能给 ZCode、Claude Code、Codex、OpenCode 等用（[docs.z.ai devpack](https://docs.z.ai/devpack/overview)）。**用别家代理，不用另接。**

##### 7. MiniMax Mini-Agent
- 官方定位是演示项目（Python，`uv tool install`，支持 ACP），3,072 star，2026-02-14 之后没有推送（[GitHub](https://github.com/MiniMax-AI/Mini-Agent)）。MiniMax 的正式产品是上面的 MiniMax Code。**不建议接。**

##### 8. 快手 CodeFlicker / KAT-Coder
- 2025-10 发布，有 IDE 和 VS Code/JetBrains 插件，Jam 和 Duet 两种模式（[量子位](https://www.qbitai.com/2025/10/345503.html)）。KAT-Coder 是模型，也给 Claude Code、Cline 等适配过。
- CLI `flickcli`（`@ks-codeflicker/cli`）要走快手内网 npm 源、用 SSO 登录，只给员工用（[ClawHub 社区页](https://clawhub.ai/skills/codeflicker)，非官方）；公开 npm 上查不到这个包。
- **不可行。** 公开用户只有 IDE，IDE 有没有钩子也未核实。

##### 9. 美团 CatPaw
- 2025-11-10 开始公测，是 AI IDE，有 Ask 和 Agent 两种模式（[品玩](https://www.pingwest.com/w/308933)）。之后改成全场景 AI 工作台「妙手」，有桌面端（本机模式和云端模式）和移动端，主要面向商家和办公（[妙手文档](https://catpaw.meituan.com/docs)、[人人都是产品经理](https://www.woshipm.com/ai/6481282.html)）。
- 会话和钩子都**未核实**。**难度高**，而且已经不算编程代理了。

##### 10. 讯飞 iFlyCode
- IDE 插件，支持 VS Code、IntelliJ 等，可以公有化或私有化部署（[ai-bot.cn](https://ai-bot.cn/iflycode/)），没查到 CLI 或独立代理客户端。**不可行。**

##### 11. 阶跃 / 百川 / 零一
- 阶跃 2026-07 发布的是 Step AOS、手机和个人智能体（[36氪](https://36kr.com/p/3895632583394947)），没有编程代理客户端。百川和零一**没查到**。**不可行。**

##### 12. 社区和其他开源代理
- **AtomCode**（Rust，托管在 AtomGit）：有 TUI、`-p` 无头模式、WebUI，能用手机远程看会话，支持 mac/Linux/Win/鸿蒙 PC，配置在 `~/.atomcode/config.toml`，会话持久化（`--continue`，[README](https://gitcode.com/atomgit_atomcode/atomcode)）。钩子：报道说最近在加 hook 系统（[CSDN](https://aicoding.csdn.net/6a61657210ee7a33f2918a20.html)），格式**未核实**。热度未核实。**中–高。**
- **pi**（[badlogic/pi-mono](https://github.com/badlogic/pi-mono)）：海外项目，热度最高（122k star，npm `@mariozechner/pi-coding-agent` 一周 51 万下载）。会话是 `~/.pi/agent/sessions/--<路径>--/<时间>_<id>.jsonl`（[session-format.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/session-format.md)）。钩子是 TS 扩展：`~/.pi/agent/extensions/*.ts` 里写 `pi.on("tool_call")`，回 `{ block: true }` 就能拦截（[extensions.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md)），handler 是 async 的，理论上可以挂起等岛回复。**中**，要单独写一个 TS 扩展。
- **Kode CLI**（[shareAI-lab/Kode-cli](https://github.com/shareAI-lab/Kode-cli)，国内社区，5.2k star）、**Neovate Code**（[neovateai/neovate-code](https://github.com/neovateai/neovate-code)，1.6k star，2026-03 之后没有推送）：会话和钩子都**未核实**，优先级低。
