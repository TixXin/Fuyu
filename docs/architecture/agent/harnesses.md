# 各家 AI 代理的接入现状

岛接了十四家 AI 代理（harness）：Claude Code、Codex、WorkBuddy（国内版和 WorkBuddy AI）、Antigravity、DeepSeek Harness（DSH）、opencode，钩子照抄 Claude Code 的三家 Qoder、CodeBuddy Code、Qwen Code（B48），TRAE、TRAE CN（B29），ZCode（B53）、Kimi Code（B52）和 MiMo Code（B54）。后八家各有一节在文末。这张表记每家有哪些形态、数据在哪，以及每项功能做到哪一步。改了哪家的哪一项，就在同一个提交里改这里。接入新的一家或给已有功能扩一家，按 `.claude/skills/fuyu-agent-harness/SKILL.md` 的清单走。

核对日期：2026-11-15（按 `main` 上的代码）。各家的调研和来源见 [agent-harnesses.md](../../research/agent-harnesses.md)，用户可见的行为见 [agent-status-hooks.md](../../features/agent-status-hooks.md)。标「未实测」的项都列在实测清单 #179 里。

## 形态和数据位置

| | CLI | 桌面 App | IDE 扩展 | 几种形态是不是一套数据 | 岛读哪里 |
|---|---|---|---|---|---|
| Claude Code | 有 | 有（Code 页、Cowork） | VS Code | CLI、VS Code 扩展、SDK 共用 `~/.claude`（会话里的 `entrypoint` 区分）；App 的 Code 页正文也写在 `~/.claude/projects`（`entrypoint` 是 `claude-desktop`），App 另在 `<Claude 数据目录>/claude-code-sessions/<组织>/<账号>/local_<id>.json` 存标题、模型、档位（按 `cliSessionId` 对上）；Cowork 每个会话一个独立的 `.claude`，不读 `~/.claude/settings.json` | `~/.claude/projects`、`~/.claude/sessions`；Code 页的 `local_*.json`（只取标题、模型、档位，`claude_desktop.rs`）；Cowork 不读 |
| Codex | 有 | 有 | VS Code | 共用 `~/.codex`（或 `CODEX_HOME`），形态看会话的 `originator`（`session_host.rs`）；2026-11-12 起历史迁进 sqlite，老会话的 rollout 文件已不在 | `~/.codex/state_5.sqlite` 的 `threads` 为主（只读，`codex_threads.rs`），列出的 rollout 照旧读；rollout 已不在的会话读 `thread_history_1.sqlite`；`session_index.jsonl` 的名字；库不在或表不对时退回只扫 `~/.codex/sessions` 最近两天 |
| WorkBuddy | 无 | 有（国内版、WorkBuddy AI） | 无 | 只有桌面版；国内版 `~/.workbuddy`、WorkBuddy AI `~/.workbuddy-ai`（应用启动 CLI 时把 `WORKBUDDY_CONFIG_DIR` 设成它）都读，格式相同，显示成同一家（B49） | `~/.workbuddy/projects`、`~/.workbuddy/sessions`、`~/.workbuddy-ai/projects`、`~/.workbuddy-ai/sessions` |
| Antigravity | 有（`agy`） | 有 | 有（IDE） | 三种共用钩子配置 `~/.gemini/config/hooks.json`；数据目录分开（`antigravity`、`antigravity-ide`、`antigravity-cli`），岛只看它们在不在；只有 CLI 实测过（#179） | 钩子存下的输入 `agent-antigravity/`；远程是镜像里的 `.fuyu/agent-antigravity/` |
| DSH | 无（Node 程序，能跑在服务器上） | 有（官方版、anywhere-labs 的 DSH Desktop / Beta / NEXT、dshed 等） | 无 | 几处存储按会话 id 合并，新的为准；分不出会话属于哪个桌面版 | 投影检查点，按顺序找这些目录：`DSH_HOME`、`DSH_DESKTOP_NEXT_HOME`（`~` 开头会展开，相对路径不读）；`~/.dsh`、`~/.dsh-beta`、`%APPDATA%\dsh-desktop\harness`；dshed 的 `<AppData>\dshed\dsh`；DSH NEXT、DSH Desktop Beta、DSH Desktop 在应用里选的目录（读它们 `<AppData>` 下的指针文件）。`<AppData>` 在 macOS 上是 `~/Library/Application Support` |
| opencode | 有（`opencode`，2.x 起 TUI 是后台服务的客户端） | 有（Electron，OpenCode） | VS Code（开终端跑 TUI） | 2.x 几种形态共用一个后台服务（`~/.local/state/opencode/service.json`）和一个库；1.x 没有后台服务 | `~/.local/share/opencode/opencode.db`（`XDG_DATA_HOME`、`OPENCODE_DB` 优先），只读打开；2.x 读 `session_v2`/`session_message`/`session_part`，1.x 读 `session`/`message`/`part`，同一 id 以 2.x 为准 |

远程（SSH）只考虑有 CLI、能在 Linux 服务器上跑的形态：Claude Code、Codex、Antigravity CLI、DSH。Antigravity 官方写的 glibc ≥ 2.28 是给 App 和 IDE 的，CLI 的要求没写，未核实；安装脚本另有 musl 版的包。WorkBuddy 没有 CLI、无头版或服务器版，不做远程。opencode 有 Linux CLI，但会话在 sqlite 里，现在的拉取脚本拉不了，还没做。

## 功能矩阵

✓ 已做，◐ 部分，✗ 没做，— 不适用。括号里是跟进的 issue。

| 功能 | Claude Code | Codex | WorkBuddy | Antigravity | DSH | opencode |
|---|---|---|---|---|---|---|
| 会话列表、标题、品牌图标 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ 未实测（#179）；子代理会话、归档会话不列 |
| 设置里单独显示 / 隐藏 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 「安装/修复」装钩子 | ✓ | ✓ | ✓ 开始、结束、等授权、审批，未实测（#179） | ✓ 开始、结束、`run_command` 审批 | ◐ 岛写钩子文件，用户要在 `cordis.patch.yml` 挂桥接插件（安装结果给出要加的几行），未实测（#179） | ✓ 1.x 插件 `plugin/fuyu-island.js`（opencode 配置目录下），只管等你和审批；2.x 不用，靠后台服务的 HTTP 接口 |
| 状态灯卡片的一行、钩子是否装好 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ 没有状态灯；后端已报插件状态（absent / notInstalled / outdated / current），设置页不显示、插件过期也不提示 |
| 改名后自动重装钩子 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ 1.x 插件 |
| 运行中 / 完成亮灯 | ✓ | ✓ | ✓ 未实测（#179） | ✓ | ◐ 挂了桥接后 ✓，没挂只靠会话数 | ◐ 2.x 读 `time_busy`/`time_idle`/`idle_outcome`，1.x 和 2.2 之前的 2.x 从最后一条消息推断；状态灯只靠会话数 |
| 「等你」 | ✓ | ✓ | ✓ 未实测（#179） | ◐ 只在岛上审批挂起时（钩子没有等授权的事件） | ◐ 打开的提问，和岛上审批挂起时 | ◐ 2.x 后台服务在跑时、1.x 装了插件时 ✓，未实测（#179）；`--standalone`（2.x）✗，私有服务的地址和密码拿不到 |
| 在岛上审批 | ✓ | ✓ | ✓ 允许 / 拒绝，未实测（#179） | ✓ 允许 / 拒绝，只拦 `run_command` | ◐ 只能拒绝或交回 DSH（桥接不认 `allow`） | ◐ 2.x 和 1.x（插件）允许一次 / 拒绝 / 交回终端，不做「总是允许」，未实测（#179）；`--standalone` ✗ |
| 在岛上回答提问 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 会话卡片：模型、推理强度 | ✓ | ✓ | ◐ 只有模型 | ◐ 推理强度只有 CLI（从模型名后缀拆） | ✓ 存档第 2、3 版（#397） | ✓ |
| 会话卡片：权限模式 | ✓ | ✓ | ✗ 会话文件里没有 | ✗ 钩子输入没有 | ✓（#397），未实测（#179） | ◐ 只认「计划」，未实测（#179） |
| 会话卡片：待办 | ✓ | ✓ | ◐ `TodoWrite`，未实测（#179） | ✗ 没有待办工具 | ✓（#397） | ✓ 未实测（#179） |
| 会话卡片：当前工具 | ✓ | ✓ | ✓ | ✓（#397） | ◐ 只有工具名，存档不带参数 | ✓ 未实测（#179） |
| 会话卡片：上下文 token | ✓ | ✓ | ✗ 只见到积分，要 Windows 样本 | ✓（#397） | ✓ | ✓ 未实测（#179） |
| 判断会话已退出 | ✓ | ✓ | ✓ Windows 认 `WorkBuddy.exe`、`WorkBuddyAI.exe`，Mac 按 bundle id `com.workbuddy.workbuddy-ai`；国内版 Mac 版的 bundle id 不知道，认不出 | ✗ | ✗ | ◐ 只有 2.x：`service.json` 的 pid 不在了就记为已退出；1.x 只靠 10 分钟超时 |
| 点会话跳过去 | ✓ 终端 / 编辑器标签 | ✓ 终端 / 编辑器 / App | ◐ 只到 App 窗口 | ◐ 只到窗口 | ◐ 只到窗口 | ◐ 桌面版在跑就到 OpenCode 窗口，否则按目录 / 标题找终端；到不了具体会话 |
| 回复标记 | ✓ 本机和远程都写 `CLAUDE.md`，远程未在服务器实测（#179） | ✓ 本机和远程，远程未实测（#179） | ✓ 未实测（#179） | ✓ 未实测（#179）；远程只有 CLI（远端有 `~/.gemini/antigravity-cli` 时），未实测（#179） | ✓ 本机和远程，远程未实测（#179） | ✓ 未实测（#179）；远程 ✗ |
| 用量环 | ✓ | ✓ | ✗ 等插件平台第 3 版（#170） | ✗ 等插件平台第 3 版（#170） | ✗ 等插件平台第 3 版（#170） | ✗ 只有 OpenCode Go 订阅有额度窗口，等插件平台第 3 版（#170） |
| SSH 远程会话 | ✓ 含远程钩子 | ◐ 只读会话 | — 只有桌面版 | ✓ CLI 的会话、运行中 / 完成、岛上审批（远程「安装/修复」装钩子，`run_command` 审批经 SSH 反向转发），未在服务器实测（#179）；远程会话不显示「等你」 | ✓ 会话和三态，没有钩子和审批，未在服务器实测（#179） | ✓ 会话和三态（远端用 `sqlite3` 或 `python3` 把时间窗内的会话抽成小库再拉回），没有插件、审批和回复标记，未在服务器实测（#179） |
| cc-connect | ✓ | ✓ | ✗ 未调研 | ✗ 未调研 | ✗ 未调研 | ✗ 未接（cc-connect README 说支持 OpenCode） |
| 手机推送的详情、接管命令 | ✓ / ✓ | ✗ / ✓ | ✗ | ✗ | ✗ | ✗ |
| 只读桌面 App 的会话 | ◐ Code 页 ✓（正文本来就在 `~/.claude/projects`，标题、模型取 App 里的），Windows 当前版本待复测（#179）；Cowork 不列（独立的 `.claude`，钩子不生效） | ✓ 共用存储；`state_5.sqlite` 列出前几天开的会话，迁移后 rollout 不在的旧会话也列（没有工具、待办、上下文） | ✓ | ◐ 没实测（#179） | ✓ | ✓ 共用库，未实测（#179） |

开发版（`pnpm tauri dev`）只读正式版的 Agent 状态，不装钩子：设置里不显示「安装/修复」和「清除状态」，也不提示钩子是旧版本。

## 为什么后来的几家缺得多

Claude Code 和 Codex 是最早接的，很多地方曾把「代理」写死成这两家，后来的几家起初只接进了会话列表。B31（#358）起，这些地方都改成按一份代理列表走，缺的功能不再是「写死漏了」，而是这一家在列表里还没声明那项能力：

- **Rust**：`src-tauri/src/agent_status/harness.rs` 的 `HARNESSES`。每家在自己的模块里声明一个 `HARNESS`（`codex.rs`、`claude_code.rs`、`workbuddy.rs`、`antigravity.rs`、`dsh.rs`、`opencode.rs`），字段是这家有的能力：`hooks`（怎么装、怎么判断装没装；本机没有这家时返回 `absent`）、`status_light`（状态灯的标记文件，快照 `agent-status.json` 里有这一家的键）、`sessions`（不走 JSONL 扫描的会话读取，本机和远程镜像两条路都会调，`ScanRoots::local_app_dir` 为空表示在读镜像）、`remote`（SSH 远程要拉的会话文件，同时决定 `mirror_path` 白名单和 `external.rs` 收的 `agent` 字段；`checkpoint_dirs` 里的 `.json` 整份拉取，不超过 512 KB）。安装/修复、改名后的重装、钩子状态、快照、清除状态都遍历这份列表。回复标记的提示词文件在 `reply_marker.rs` 的 `PROMPT_FILES`，每家的 `prompt_files` 写在自己的模块里，测试保证它和 `HARNESSES` 一致。
- **前端**：`src/features/agent-status/agents.ts` 的 `AGENTS` 表写每家的名称和能力，`SessionProvider`、`AgentProvider`（有状态灯的）、`RemoteProvider` 从表里推出来；图标在 `AgentProviderIcon.tsx`。设置里「显示哪些 Agent」按 `AGENT_PROVIDER_LABELS` 生成，隐藏的存在 `agentHiddenProviders`，新加一家不用加设置字段。
- **仍按家写的**：审批的 `Agent` 枚举（`agent_approval/decision.rs`，现在有六家；加一家要加一个枚举值、`path` 的一个分支、答复格式和 `AGENTS` 一项；opencode 2.x 的审批不走钩子，由 `agent_approval/opencode.rs` 轮询后台服务、经 `external.rs` 进队列；1.x 由插件 `hooks/fuyu-opencode-plugin.js` POST 到 `/opencode/permission`）、Claude Code 和 Codex 的 JSONL 会话扫描（`session_scan.rs`）、`hooks/` 里的钩子脚本（running、status、approval 认五家）、远程钩子（`remote_setup.rs`，只有 Claude Code 和 Antigravity）、cc-connect 的配置（`cc_connect/config_file.rs`）、推送接管命令（`push/pushText.ts`）、用量环。

接一家新代理：写它自己的模块并声明 `HARNESS`，在 `HARNESSES` 里加一行，前端 `AGENTS` 加一行、`AgentProviderIcon.tsx` 加图标。之后给它补哪项能力，就在它的 `HARNESS` 里填哪个字段，不用改中心文件。

## Claude Code 兼容的三家（B48）

Qoder（含 Qoder CN）、CodeBuddy Code、Qwen Code 的钩子格式和会话目录都照抄 Claude Code，所以走一个声明层 `claude_compat.rs`：每家的模块（`qoder.rs`、`codebuddy.rs`、`qwen.rs`）只填一份 `Compat`（id、名字、配置目录和环境变量、会话子目录、记录格式、全局提示词文件、等授权用哪个事件），钩子安装和状态、会话列表、标题、等你、审批都由声明层做。再接一家这样的 CLI：写一份声明，再在 `HARNESSES`、三份钩子脚本、审批的 `Agent` 枚举和前端 `AGENTS` 里各加一项。三家都还没在真机上跑过（#179）。

| | Qoder / Qoder CN | CodeBuddy Code | Qwen Code |
|---|---|---|---|
| id | `qoder` | `codebuddy` | `qwen` |
| 配置目录 | `~/.qoder`（`QODER_CONFIG_DIR`）和 `~/.qoder-cn`（`QODERCN_CONFIG_DIR`），两份都装 | `~/.codebuddy`（`CODEBUDDY_CONFIG_DIR`） | `~/.qwen`（`QWEN_HOME`） |
| 会话 | `<目录>/projects/<项目>/<id>.jsonl`，Claude Code 同格式；标题读旁边 `<id>-session.json` 的 `title`；`agent-*.jsonl` 是子代理，跳过 | `<目录>/projects/<项目>/<id>.jsonl`，每条记录套了一层 `{type, uuid, timestamp, payload}` | `<目录>/projects/<项目>/chats/<id>.jsonl`，记录是 Gemini 的 `parts`；标题是 `system`/`custom_title` 记录，`titleSource` 分 manual / auto |
| 钩子 | `settings.json` 的 hooks，Claude Code 格式：UserPromptSubmit、PreToolUse、Stop、StopFailure、PermissionRequest | 同左 | 同左（timeout ≥ 1000 按毫秒算，岛填的 150 秒不受影响） |
| 状态灯 | ✓ `agent-qoder-running.flag` | ✓ | ✓ |
| 等你 | PermissionRequest 存通知 | Notification（matcher `permission_prompt`）存通知：它的 auto 模式对自动放行的工具也发 PermissionRequest，不能拿来判断等你 | PermissionRequest 存通知 |
| 岛上审批 | ✓ `/qoder/permission-request`，回 `hookSpecificOutput.decision.behavior` | ✓ `/codebuddy/permission-request` | ✓ `/qwen/permission-request` |
| 会话卡片 | 按 Claude Code 的记录解析（模型、权限模式、待办、当前工具、上下文 token） | 同左 | ◐ 模型、当前工具、上下文 token；没有推理强度、权限模式、待办 |
| 回复标记 | `AGENTS.md`（两个目录各一份） | `CODEBUDDY.md` | `QWEN.md` |
| 点会话跳过去 | ◐ 通用的终端窗口匹配（目录名、标题），没有专门的 App | 同左 | 同左 |
| 用量环 | ✗ 没有公开的额度接口 | ✗ | ✗ |
| SSH 远程会话 | ✗ 三家都有 Linux CLI，能做，还没做 | ✗ | ✗ |
| cc-connect | — | — | — |

## TRAE 和 TRAE CN（B29）

TRAE IDE 的国际版和 CN 版按用户的决定分成两家：`trae`（显示「TRAE」，`~/.trae`）和 `traeCn`（显示「TRAE CN」，`~/.trae-cn`），钩子、存下的输入、状态灯和设置开关各一套，图标共用。代码在 `trae.rs`。豆包桌面版没有能接的地方，不接（调研见 [agent-harnesses.md](../../research/agent-harnesses.md) 豆包一节）。

没走 Claude Code 兼容层：TRAE 的会话库是 SQLCipher 加密的，没有能读的会话文件，会话只能从钩子输入拼（和 Antigravity 一样）。`hooks.json` 里 `hooks` 下是 Claude Code 的分组格式，所以安装和检查复用 `install_claude_code_hook_events`、`hook_entries_state`。两家都还没在真机上跑过（#179）。

| 层 | TRAE / TRAE CN |
|---|---|
| 配置 | `~/.trae/hooks.json` / `~/.trae-cn/hooks.json`；目录在才装；顶层没有 `version` 时补 `1`，用户写的版本号不动 |
| 钩子 | UserPromptSubmit、PreToolUse、PostToolUse 存输入并亮灯，Stop 存输入并记完成，Notification 存进 `agent-notifications`；SessionStart 不装（CN 主会话不触发） |
| 会话 | 从 `agent-trae/`、`agent-traeCn/` 里存下的钩子输入按 `session_id` 拼：标题是第一句提问，最近提问、当前工具（`tool_name`、`tool_input.command` / 文件名）、最近回复（Stop 的 `last_assistant_message`）；每个会话只留第一次和最后一次提问、最近回复和最新一条，24 小时以上的删掉。装钩子之前的会话看不到。没有模型、权限模式、待办、上下文 token |
| 状态灯 | ✓ `agent-trae-running.flag` / `agent-traeCn-running.flag` |
| 等你 | Notification 的 `permission_prompt`、`ask_user_question`、`document_review`、`browser_interaction`；岛上审批挂起时也算 |
| 岛上审批 | ◐ 只拦 `RunCommand`，`/trae/pre-tool-use`、`/traeCn/pre-tool-use`，回 `hookSpecificOutput.permissionDecision`（`allow` / `deny` 带理由 / `ask` 交回 TRAE）。TRAE 的工具在「手动确认」模式时，岛上点允许后还要在 TRAE 里点一下 |
| 回复标记 | ✗ 个人规则文件的路径官方没写，没核实前不动用户的文件；用户自己让 TRAE 写标记的话能认出来 |
| 点会话跳过去 | ◐ 到 TRAE / TRAE CN 窗口，到不了具体会话 |
| 判断会话已退出 | ✗ 没有 SessionEnd，靠 24 小时清理和运行中超时变完成 |
| 用量环、SSH 远程、cc-connect | ✗ / — / — |

## ZCode（B53）

智谱 ZCode（桌面版和 `zcode` CLI），id `zcode`。代码在 `zcode.rs`。按 ZCode 的源码和文档写，没在真机上跑过（#179）。

没走 Claude Code 兼容层：钩子在 `~/.zcode/cli/config.json` 的 `hooks.events` 下，会话在 sqlite 里。会话库就是 opencode 第一版的表，所以直接复用 `opencode.rs` 的读取器，只换 provider；为此读取器多了几条按列是否存在才生效的规则（跳过已删除的会话和 `*_child` 子任务、`title_source = default` 的占位标题当没有标题、多认 `modelId`、缓存按库路径分开），对 opencode 没影响。钩子是 Claude Code 的分组格式，安装和检查复用 `install_claude_code_hook_events`、`hook_entries_state`。

| 层 | ZCode |
|---|---|
| 配置 | `~/.zcode/cli/config.json`；`~/.zcode` 在才装；装时把 `hooks.enabled` 设成 true（用户关掉后钩子状态显示要修复），别的字段不动；改了钩子要新开 ZCode 会话才生效 |
| 钩子 | UserPromptSubmit、PreToolUse 亮灯，Stop 记完成，PermissionRequest 存进 `agent-notifications` 并走岛上审批 |
| 会话 | `~/.zcode/cli/db/db.sqlite`（`ZCODE_SESSION_DB_PATH` 优先，只认绝对路径），只读；标题、目录、模型、最近提问和回复、当前工具、待办、上下文 token 都有 |
| 状态灯 | ✓ `agent-zcode-running.flag` |
| 等你 | PermissionRequest |
| 岛上审批 | ✓ `/zcode/permission-request`，回 Claude Code 的 `hookSpecificOutput.decision.behavior` |
| 回复标记 | `~/.zcode/AGENTS.md` |
| 点会话跳过去 | ◐ 通用的终端窗口匹配；桌面版的进程名没核实 |
| 判断会话已退出 | ✗ |
| 用量环、SSH 远程、cc-connect | ✗ / ✗（有 Linux CLI，能做）/ — |

## Kimi Code（B52）

月之暗面的 Kimi Code CLI（TypeScript 新版 `MoonshotAI/kimi-code`，命令 `kimi`），id `kimiCode`。代码在 `kimi_code.rs`（会话）和 `kimi_hooks.rs`（TOML 钩子）。按源码 2.6.x 写，没在真机上跑过（#179）。

没走 Claude Code 兼容层：钩子是 TOML 的扁平 `[[hooks]]`，会话是 `state.json` 加 `wire.jsonl`。

| 层 | Kimi Code |
|---|---|
| 配置 | `~/.kimi-code/config.toml`（`KIMI_CODE_HOME` 优先，要绝对路径）；目录在才装；末尾一段 `# BEGIN/END Fuyu Agent Status Hooks (Kimi Code)` 包住的 `[[hooks]]`，每条只写 `event`、`command`、`timeout`（多写字段 Kimi 整个配置加载失败）；用户把 `hooks` 写成顶层行内数组时报错不改；文件存在但读不出时报错不写；改完要开新会话才生效 |
| 钩子 | UserPromptSubmit 亮灯，Stop、Interrupt 记完成，StopFailure 记失败，PermissionRequest 存输入 |
| 会话 | 扫 `sessions/<工作区>/<会话>/state.json`（旧格式在 `session-meta/state.json`），`session_index.jsonl` 补充；标题、改名、最近提问、目录来自 `state.json`，已归档和子会话不列；进行中、回复、模型、当前工具看 `agents/main/wire.jsonl` |
| 状态灯 | ✓ `agent-kimiCode-running.flag` |
| 等你 | PermissionRequest（只通知） |
| 岛上审批 | ✗ PermissionRequest 不能回结果；能挡的 PreToolUse 在权限检查之前、每次工具调用都触发且只认 deny，挂它会让自动放行的调用也要在岛上点 |
| 回复标记 | `~/.kimi-code/AGENTS.md` |
| 点会话跳过去 | ◐ 通用的终端窗口匹配 |
| 判断会话已退出 | ✗ 靠运行中超时变完成 |
| 用量环 | ✓ 复用已有的 Kimi 用量（`/coding/v1/usages`，设置里填 API key），不读 CLI 的登录凭据 |
| SSH 远程、cc-connect | ✗（有 Linux CLI，能做）/ ✗（cc-connect 支持 Kimi，岛这边没加） |

不接的：旧版 Python `kimi-cli`（`~/.kimi/`，已归档，新版第一次启动会迁移）；Kimi 桌面版内嵌的运行时（它的 `config.toml` 由桌面写、会话索引在桌面自己的 sqlite 里，核实不了桌面会不会覆盖配置、内嵌运行时会不会跑外部钩子）。

## MiMo Code（B54）

小米 MiMo Code（终端 CLI，opencode 的分支），id `mimo`。代码在 `mimo.rs`。按源码写，没在真机上跑过（#179）。

照 opencode 1.x 的接法，两样都复用：会话用 `opencode.rs` 的读取器（`message` 表有 `agent_id` 列时只看主代理的消息，`title_source` 为 `fallback` 的占位标题当没有标题，对 opencode 没影响）；插件是岛的 opencode 插件复制一份，只换审批路由和通知文件名前缀。

| 层 | MiMo Code |
|---|---|
| 目录 | 和 opencode 同一套规则，名字是 `mimocode`：数据 `~/.local/share/mimocode/`（`XDG_DATA_HOME`），配置 `~/.config/mimocode/`（`XDG_CONFIG_HOME`），设了 `MIMOCODE_HOME` 就用它下面的 `data/`、`config/`；Windows、macOS 上也是这两个位置 |
| 会话 | `<数据>/mimocode.db`（`MIMOCODE_DB` 优先），opencode 1.x 的表，只读；非 latest / beta / prod 渠道的库（`mimocode-<渠道>.db`）不读 |
| 插件 | `<配置>/plugin/fuyu-island.js`；配置或数据目录在才装 |
| 状态灯 | ✗ 和 opencode 一样，三态从会话库读 |
| 等你 | 插件收到 `permission.asked` 时写 `agent-notifications/mimo-plugin-<id>.json` |
| 岛上审批 | ✓ `/mimo/permission`，回 `once` / `always` / `reject`；没有 opencode 2.x 那样的后台服务，不轮询 |
| 回复标记 | `<配置>/AGENTS.md`（MiMo 也读 `~/.claude/CLAUDE.md`，标记一样，不冲突） |
| 点会话跳过去 | ◐ 通用的终端窗口匹配 |
| 判断会话已退出、用量环、SSH 远程、cc-connect | ✗ / ✗ / ✗（有 Linux CLI，能做）/ — |
