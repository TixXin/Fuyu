# 各家 AI 代理的接入现状

岛接了五家 AI 代理（harness）：Claude Code、Codex、WorkBuddy（国内版）、Antigravity、DeepSeek Harness（DSH）。这张表记每家有哪些形态、数据在哪，以及每项功能做到哪一步。改了哪家的哪一项，就在同一个提交里改这里。接入新的一家或给已有功能扩一家，按 `.claude/skills/fuyu-agent-harness/SKILL.md` 的清单走。

核对日期：2026-11-14（按 `main` 上的代码）。各家的调研和来源见 [agent-harnesses.md](../../research/agent-harnesses.md)，用户可见的行为见 [agent-status-hooks.md](../../features/agent-status-hooks.md)。

## 形态和数据位置

| | CLI | 桌面 App | IDE 扩展 | 几种形态是不是一套数据 | 岛读哪里 |
|---|---|---|---|---|---|
| Claude Code | 有 | 有（Code 页、Cowork） | VS Code | CLI、VS Code 扩展、SDK 共用 `~/.claude`（会话里的 `entrypoint` 区分）；App 的 Code 页另存在 `%APPDATA%\Claude\claude-code-sessions`，Cowork 每个会话一个独立的 `.claude`，不读 `~/.claude/settings.json` | `~/.claude/projects`、`~/.claude/sessions`；App 的两种都没读（#180） |
| Codex | 有 | 有 | VS Code | 共用 `~/.codex`（或 `CODEX_HOME`），形态看会话的 `originator`（`session_host.rs`）；2026-11-12 起历史迁进 sqlite，老会话的 rollout 文件已不在（#180） | `~/.codex/sessions` 的 rollout、`session_index.jsonl`；不读 sqlite |
| WorkBuddy | 无 | 有（国内版） | 无 | 只有桌面版；国际版 `~/.workbuddy-ai` 是另一个产品，不读 | `~/.workbuddy/projects`、`~/.workbuddy/sessions` |
| Antigravity | 有（`agy`） | 有 | 有（IDE） | 三种共用钩子配置 `~/.gemini/config/hooks.json`；数据目录分开（`antigravity`、`antigravity-ide`、`antigravity-cli`），岛只看它们在不在；只有 CLI 实测过（#179） | 钩子存下的输入 `agent-antigravity/` |
| DSH | 无（Node 程序，能跑在服务器上） | 有（官方版、anywhere-labs、DSH Desktop 等） | 无 | 三处存储按会话 id 合并，新的为准；分不出会话属于哪个桌面版 | `~/.dsh`、`~/.dsh-beta`、`%APPDATA%\dsh-desktop\harness` 的投影检查点 |

远程（SSH）只考虑有 CLI、能在 Linux 服务器上跑的形态：Claude Code、Codex、Antigravity CLI（要 glibc ≥ 2.28，未核实）、DSH。WorkBuddy 没有服务器版，不做远程。

## 功能矩阵

✓ 已做，◐ 部分，✗ 没做，— 不适用。括号里是跟进的 issue。

| 功能 | Claude Code | Codex | WorkBuddy | Antigravity | DSH |
|---|---|---|---|---|---|
| 会话列表、标题、品牌图标 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 设置里单独显示 / 隐藏 | ✓ | ✓ | ✗ | ✗ | ✗ |
| 「安装/修复」装钩子 | ✓ | ✓ | ◐ 只装 `PermissionRequest`（#175） | ◐ 开始和结束（#175） | ✗ 要用户挂桥接插件（#175） |
| 状态灯卡片的一行、钩子是否装好 | ✓ | ✓ | ✗（#175） | ✗（#175） | ✗（#175） |
| 改名后自动重装钩子 | ✓ | ✓ | ✗ 只装了这家时不会触发（#175） | ✗ 同左 | — |
| 运行中 / 完成亮灯 | ✓ | ✓ | ◐ 只靠会话数 | ◐ 只靠会话数 | ◐ 只靠会话数 |
| 「等你」 | ✓ | ✓ | ✓ 钩子没实测（#179） | ✗ 钩子没有这类事件 | ◐ 只认打开的提问 |
| 在岛上审批 | ✓ | ✓ | ✗（#175） | ✗（#175） | ✗ 只能拒绝（#175） |
| 在岛上回答提问 | ✓ | ✗ | ✗ | ✗ | ✗ |
| 权限模式、待办、当前工具 | ✓ | ✓ | ◐ 只有当前工具 | ✗ | ✗ |
| 判断会话已退出 | ✓ | ✓ | ✓ | ✗ | ✗ |
| 点会话跳过去 | ✓ 终端 / 编辑器标签 | ✓ 终端 / 编辑器 / App | ◐ 只到 App 窗口 | ◐ 只到窗口 | ◐ 只到窗口 |
| 回复标记 | ✓ | ✗（#176） | ✗（#176） | ✗（#176） | ✗（#176） |
| 用量环 | ✓ | ✓ | ✗（#170） | ✗（#170） | ✗（#170） |
| SSH 远程会话 | ✓ 含远程钩子 | ◐ 只读会话 | — | ✗（#171） | ✗（#171） |
| cc-connect | ✓ | ✓ | ✗ 未调研 | ✗ 未调研 | ✗ 未调研 |
| 手机推送的详情、接管命令 | ✓ / ✓ | ✗ / ✓ | ✗ | ✗ | ✗ |
| 只读桌面 App 的会话 | ✗（#180） | ✓ 共用存储 | ✓ | ◐ 没实测（#179） | ✓ |

## 为什么后来的三家缺得多

Claude Code 和 Codex 是最早接的，很多地方曾把「代理」写死成这两家，后来的三家只接进了会话列表。B31（#358）起，这些地方都改成按一份代理列表走，缺的功能不再是「写死漏了」，而是这一家在列表里还没声明那项能力：

- **Rust**：`src-tauri/src/agent_status/harness.rs` 的 `HARNESSES`。每家在自己的模块里声明一个 `HARNESS`（`codex.rs`、`claude_code.rs`、`workbuddy.rs`、`antigravity.rs`；DSH 的暂时写在 `harness.rs` 里），字段是这家有的能力：`hooks`（怎么装、怎么判断装没装）、`status_light`（状态灯的标记文件，快照 `agent-status.json` 里有这一家的键）、`sessions`（不走 JSONL 扫描的会话读取，本机和远程镜像两条路都会调，`ScanRoots::local_app_dir` 为空表示在读镜像）、`remote`（SSH 远程要拉的会话文件，同时决定 `mirror_path` 白名单和 `external.rs` 收的 `agent` 字段）。安装/修复、改名后的重装、钩子状态、快照、清除状态都遍历这份列表。
- **前端**：`src/features/agent-status/agents.ts` 的 `AGENTS` 表写每家的名称和能力，`SessionProvider`、`AgentProvider`（有状态灯的）、`RemoteProvider` 从表里推出来；图标在 `AgentProviderIcon.tsx`。
- **仍按家写的**：审批的 `Agent` 枚举（`agent_approval/decision.rs`，加一家要加一个枚举值、`path` 的一个分支和 `AGENTS` 一项）、Claude Code 和 Codex 的 JSONL 会话扫描（`session_scan.rs`）、`hooks/` 里的钩子脚本、cc-connect 的配置（`cc_connect/config_file.rs`）、推送接管命令（`push/pushText.ts`）。

接一家新代理：写它自己的模块并声明 `HARNESS`，在 `HARNESSES` 里加一行，前端 `AGENTS` 加一行、`AgentProviderIcon.tsx` 加图标。之后给它补哪项能力，就在它的 `HARNESS` 里填哪个字段，不用改中心文件。

