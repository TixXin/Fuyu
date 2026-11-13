# 接入更多 AI 代理：Antigravity、WorkBuddy、DeepSeek Harness

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
