# 各家 AI 代理的接入现状

岛接了六家 AI 代理（harness）：Claude Code、Codex、WorkBuddy（国内版）、Antigravity、DeepSeek Harness（DSH）、opencode。这张表记每家有哪些形态、数据在哪，以及每项功能做到哪一步。改了哪家的哪一项，就在同一个提交里改这里。接入新的一家或给已有功能扩一家，按 `.claude/skills/fuyu-agent-harness/SKILL.md` 的清单走。

核对日期：2026-11-15（按 `main` 上的代码）。各家的调研和来源见 [agent-harnesses.md](../../research/agent-harnesses.md)，用户可见的行为见 [agent-status-hooks.md](../../features/agent-status-hooks.md)。标「未实测」的项都列在实测清单 #179 里。

## 形态和数据位置

| | CLI | 桌面 App | IDE 扩展 | 几种形态是不是一套数据 | 岛读哪里 |
|---|---|---|---|---|---|
| Claude Code | 有 | 有（Code 页、Cowork） | VS Code | CLI、VS Code 扩展、SDK 共用 `~/.claude`（会话里的 `entrypoint` 区分）；App 的 Code 页正文也写在 `~/.claude/projects`（`entrypoint` 是 `claude-desktop`），App 另在 `<Claude 数据目录>/claude-code-sessions/<组织>/<账号>/local_<id>.json` 存标题、模型、档位（按 `cliSessionId` 对上）；Cowork 每个会话一个独立的 `.claude`，不读 `~/.claude/settings.json` | `~/.claude/projects`、`~/.claude/sessions`；Code 页的 `local_*.json`（只取标题、模型、档位，`claude_desktop.rs`）；Cowork 不读 |
| Codex | 有 | 有 | VS Code | 共用 `~/.codex`（或 `CODEX_HOME`），形态看会话的 `originator`（`session_host.rs`）；2026-11-12 起历史迁进 sqlite，老会话的 rollout 文件已不在 | `~/.codex/state_5.sqlite` 的 `threads` 为主（只读，`codex_threads.rs`），列出的 rollout 照旧读；rollout 已不在的会话读 `thread_history_1.sqlite`；`session_index.jsonl` 的名字；库不在或表不对时退回只扫 `~/.codex/sessions` 最近两天 |
| WorkBuddy | 无 | 有（国内版） | 无 | 只有桌面版；国际版 `~/.workbuddy-ai` 是另一个产品，不读 | `~/.workbuddy/projects`、`~/.workbuddy/sessions` |
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
| 判断会话已退出 | ✓ | ✓ | ✓ Mac 按 bundle id `com.workbuddy.workbuddy-ai` 认应用在不在 | ✗ | ✗ | ◐ 只有 2.x：`service.json` 的 pid 不在了就记为已退出；1.x 只靠 10 分钟超时 |
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
