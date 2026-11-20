# 浮窗 / 刘海类项目怎么替 AI 代理弹审批

> 日期：2026-11-19。问题：各家 agent 的审批不再弹到岛上，别的开源项目是怎么拦审批、怎么和桌面应用通信、应用不在时怎么退回去的。范围：GitHub 上的 claude-island / Vibe Notch、CodeIsland、Ping Island、notch-so-good、ClaudeNotch、Notchi，Vibe Island 官网；Claude Code 和 Codex 的官方 hooks 文档。

## 结论

- **做法都一样**：拦 Claude Code 的 `PermissionRequest`（少数用 `PreToolUse`），用**命令钩子**同步阻塞等应用回复；通信用固定路径的 Unix socket，或者每次调用时去读应用写下的位置。应用不在、超时、回 ask 时都**不输出、exit 0**，让代理自己在终端弹审批。
- **没有一家把端口和 token 写死进 `settings.json` 的 HTTP 钩子**。浮屿之前给 Claude Code 装的就是这种钩子，端口一变（正式版发现首选端口被占、换了随机端口；开发版接手正式版端口）就全部失效，直到用户再点「安装/修复」。调研里还看到 Claude Code 的 HTTP 类 PermissionRequest 钩子在端点连不上时可能按拒绝处理（claudeissues.com 镜像的标题，未核实）。2026-11-19 改成和其他家一样走 `fuyu-agent-approval` 脚本，每次现读 `agent-approval.json`。
- **Codex 的坑**：没有托管的钩子要在 `/hooks` 里信任，信任绑在钩子的哈希上；钩子命令改过以后，在重新信任前会被**静默跳过**。浮屿每次改 Codex 钩子的写法，都要提醒用户在 Codex 里重新信任。另外开了 Auto Review 时，审批应该交给 Codex 自己处理；回 `updatedInput` / `updatedPermissions` / `interrupt` 会被按拒绝处理（fail closed）。
- **本来就不会触发的情况**：命令已经被 allow 规则覆盖、会话在 auto / bypass 模式、子代理、`-p`、`--bg`、VS Code 扩展的原生审批界面。排查「不弹」时先排除这些。
- 别家踩过的坑（CodeIsland）：几个审批并发时要排队，否则会互相覆盖、被提前默认拒绝（#57）；关掉一张卡不能连带屏蔽后面的审批（#309）；终端里先答了，岛上的卡片要收起（#216）。浮屿已经有排队和 `/claude/activity` 撤卡。

## 详细

| 项目 | 拦哪个事件 | 通信 | 应用不在时 |
|---|---|---|---|
| Vibe Notch（原 claude-island） | PermissionRequest | Python 钩子，固定 socket `/tmp/claude-island.sock`，等 300 秒 | 不输出、exit 0 |
| CodeIsland | Claude 是 PermissionRequest，Codex 写 `hooks.json` | 原生桥接 `codeisland-bridge`，socket `/tmp/codeisland-<uid>.sock` | 退回代理自己的审批 |
| Ping Island | Claude 系用托管钩子文件加桥接；Codex 另有 app-server websocket | 桥接启动器 | 退回原生界面；Antigravity 只观察，固定回 `ask` |
| notch-so-good | PermissionRequest | Python 桥接，本用户可用的 socket | 回落终端，「绝不替你批准」 |
| ClaudeNotch | PreToolUse | — | 回落原生提示 |
| Notchi | 只观察，不审批 | shell 钩子加 socket | — |
| Vibe Island | 闭源，本机装的是一个 zsh 启动器：socket 不存在就 exit 0，否则 exec 桥接程序 | `~/.vibe-island/run/vibe-island.sock` | exit 0 |

官方格式：

- Claude Code 的 PermissionRequest 输出 `hookSpecificOutput.decision.behavior` = allow / deny，deny 可带 `message`；exit 2 不算拒绝；command 钩子默认超时 600 秒。从 v2.1.314 起 `Bash` matcher 也会匹配 Monitor 工具。AskUserQuestion 和 ExitPlanMode 只回 allow 不够，要带 `updatedInput`。
- Codex 的 PermissionRequest 输出格式同 Claude；钩子默认开启（`[features] hooks=false` 关闭）；Windows 可以用 `commandWindows` 换命令。

## 来源

- Vibe Notch：https://github.com/farouqaldori/vibe-notch
- CodeIsland：https://github.com/wxtsky/CodeIsland （issue #57、#165、#181、#216、#306、#309、#340）
- Ping Island：https://github.com/erha19/ping-island
- notch-so-good：https://github.com/deepshal99/notch-so-good
- ClaudeNotch：https://rawsun007.github.io/claude-notch/
- Notchi：https://github.com/sk-ruban/notchi
- Claude Code hooks：https://code.claude.com/docs/en/hooks
- Codex hooks：https://learn.chatgpt.com/docs/hooks
