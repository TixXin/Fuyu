# Agent 岛上交互：音效与实测记录

方案见 [agent-island-interaction.md](island-interaction.md)。任务和进度在 [B6](../../tasks/0-archive/B/B6.md) 和它的子任务里（`pnpm tasks show B6`），这里只留音效的选型和实测得出的结论；实测结论变了，同步修改方案文档里受影响的部分。

## 音效

- 内置音效必须是原创的。参考软件的录音只用来提炼风格参数（时长、音高范围、音色类别、响度、起音快慢），不复制它的旋律、音高序列或具体音色。
- 生成方式：用代码合成（几个正弦或三角波叠加加包络），每个事件出 2～3 个候选，导出 `.wav` 给用户试听后选定。
- 参考录音放在本机 `E:\Projects\design-refs\vibe-island-sounds`，**不进仓库**。
- 2026-11-06 用户选定 H「拇指琴」作为内置音效（合成脚本参数见候选文件夹）。
- 参考软件的音效（录音、引导音）和 Apple 系统音效都不进仓库、不上插件市场；用户有那款软件的授权，录音只作为本机导入的音效包自己使用。市场上的音效包只收 CC0、MIT 等允许再分发的许可，MIT 要附原许可证文本。

## 实测记录

### 2026-11-06 · Claude Code 2.1.318 · Windows 11

**做法**：在仓库外的临时目录放了一个 Node 测试服务器（`127.0.0.1:47811`）。它每次请求都重读一个模式文件，可以挂起 N 秒、允许、拒绝、返回空 `{}`、自动回答，并记录连接何时被对方关闭。测试项目的 `.claude/settings.local.json` 配了两个 HTTP 钩子：`PermissionRequest` 带 `Authorization` 头，`PreToolUse` 只匹配 `AskUserQuestion`。用户在这个项目里以**默认（手动）模式**让 Claude 运行 `cmd //c echo ...` 或提问。测试目录用完即删，不进仓库。

| 测试 | 结果 |
|---|---|
| auto 模式 | auto 模式自己批准的命令**不触发** `PermissionRequest`，钩子收不到请求。在岛上审批只对手动审批的会话有用 |
| 挂起 30 秒后返回 `{}` | 等待期间终端**不显示**审批框，只有一行运行中的提示；钩子返回空决定后审批框才出现，用户在终端照常选择 |
| 返回 `allow` | 立即执行，不出审批框，终端写着 "Allowed by PermissionRequest hook" |
| 返回 `deny` 加 `message` | 不执行，终端写着 "Denied by PermissionRequest hook"，`message` 传给了模型 |
| 挂起时按 Esc | 立即中断。服务器在 4.6 秒时看到连接被关闭，可以据此撤掉卡片 |
| `headers` | `Authorization` 头原样送达，可以用来做令牌鉴权 |
| `AskUserQuestion`，`PreToolUse` 挂起后返回 `{}` | 等待期间终端不显示选项。返回后**又触发一次** `PermissionRequest`（同样挂起 30 秒），两者都返回后终端选项才出现，前后约 60 秒 |
| `PreToolUse` 返回 `allow` 加 `updatedInput.answers`（第一个选项） | 立即生效，终端不出选项，之后也不再触发 `PermissionRequest`，模型收到的就是这个答案 |
| `answers` 填不在选项里的文字 | 原样接受，模型收到了这段文字 |
| 服务器没运行（端口上没有程序） | 审批框立即出现，没有卡顿，终端也没有报错 |
| 延迟 | 服务器从收到请求到回复都在 20 毫秒以内，Agent 那边感觉不到差别 |

**对第 2、3 期的影响**：

- 钩子等待时终端没法操作，所以岛上必须有「到终端处理」（立即返回空决定），并且要有等待上限，到时返回空决定交还终端。会话的终端在前台时，直接返回空决定，不弹卡片。
- 不存在「终端先答了」的情况；需要处理的是用户按 Esc 或 Agent 退出：连接一断就撤掉卡片。
- `AskUserQuestion` 会先后经过 `PreToolUse` 和 `PermissionRequest`。端点收到工具名为 `AskUserQuestion` 的 `PermissionRequest` 时，如果岛上没有在处理这个提问（例如第 3 期的开关没开，或用户点了「到终端处理」），要立即返回空决定，不能再挂一次。
- 自由文本回答可以做，提问卡片上一直显示输入框。
- 岛屿没运行时不影响 Agent，不需要额外兜底。

### 2026-11-17 · Codex CLI 0.169.0 · macOS

**做法**：在仓库外的临时目录设独立 `CODEX_HOME`，写入浮屿 `codex_hooks.rs` 生成的 `[[hooks.*]]` 配置与四份 `/bin/sh` 钩子脚本（`fuyu-agent-approval.sh` 等），在 `127.0.0.1` 上分别挂模拟的 OpenAI Responses 流式端点与岛屿审批端点（`/codex/permission-request`），在真实伪终端（PTY）里运行 `codex`（`workspace-write` + `approval_policy = "on-request"`），触发需要提权审批的 `exec_command`（`sandbox_permissions: "require_escalated"`）与无需提权的普通命令。测试目录用完即删，不进仓库。

| 测试 | 结果 |
|---|---|
| 钩子输入字段 | 底层工具虽为 `exec_command`（`cmd`、`justification`），`PermissionRequest` 钩子收到的 JSON 已归一化为 `tool_name: "Bash"`、`tool_input: { command, description }`，带 `session_id`、`turn_id`、`transcript_path`、`cwd`、`model`、`permission_mode`（无 `permission_suggestions`），与岛屿现有解析和预览字段完全一致 |
| 沙箱内自动放行的命令 | 不需要人工审批的命令直接执行，**不触发** `PermissionRequest`，也不写 `agent-notifications` |
| 新装钩子未信任 | 未信任时启动即弹 `Hooks need review`（`Review hooks` / `Trust all and continue` / `Continue without trusting`）；跳过信任则钩子不运行，信任后哈希写入 `config.toml` 的 `[hooks.state."..."]` |
| 挂起 3 秒后返回 `{}` | 等待期间终端**不显示**审批框，底栏只显示 `Working (... • esc to interrupt)` 与 `Running hooks ◦ 1`；端点返回 `{}`（脚本过滤为空输出、退出码 0）后约 29 毫秒终端弹出 `Would you like to run the following command?`，按 `y` 照常执行 |
| 返回 `allow` | **生效**：不出终端审批框，命令立即执行，终端记录 `• Ran ...` 与输出，退出码与 stdout 正常传回模型 |
| 返回 `deny` 加 `message` | **生效**：不出终端审批框，命令不执行，终端显示 `• Blocked by hook` / `└ Denied in Fuyu`，拒绝原因（`Rejected("Denied in Fuyu")`）传回模型 |
| 挂起时按 Esc | 立即中断本轮（终端显示 `■ Conversation interrupted`），钩子子进程树同步结束，本机 HTTP 端点在按 Esc 后约 2 毫秒读到连接关闭（EOF），岛上可据此立即撤卡 |
| 服务器没运行（端口无监听程序） | `fuyu-agent-approval.sh` 连未监听端口立即退出 0，约 92 毫秒内终端照常弹出审批框，无报错无卡顿 |

**结论**：

- Codex 0.169.0 的 `PermissionRequest` 在挂起等待期间仍然挡住终端审批框（与 Claude Code 2.1.319 起同时显示审批框不同），不存在「终端先点了但连接不断」的情况，不需要额外装类似 `/claude/activity` 的消卡钩子。
- 浮屿当前的 `hookSpecificOutput.decision`（`allow` / `deny` + `message` / 空 `{}` 交回终端）和连接断开撤卡逻辑对 Codex 全部原样生效，无需改代码。
