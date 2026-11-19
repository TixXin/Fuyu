# 从外部打开 Claude 桌面版的指定 Code 会话

> 日期：2026-11-19。问题：在岛的 Agent 页点一条 Claude 桌面版 Code 页的会话（或在岛上回话），能不能让 Claude 桌面版直接切到那一条，而不只是把窗口调到前台（A20，#1016）。范围：联网查 Anthropic 的文档、`anthropics/claude-code` 的 issue 和几个开源工具；读本机 `~/Library/Application Support/Claude/claude-code-sessions` 和 `~/.fuyu/agent-sessions` 的记录核对 id；在 Mac 上用 `open <链接>` 实测（Claude 桌面版 5.11492.5，macOS 27.2）。相关任务：A17（WorkBuddy）、A18（Cursor）、A19（Windows 实测）。

## 结论

- **能做到**。Claude 桌面版注册了 `claude://` 协议，`claude://claude.ai/epitaxy/local_<id>` 打开那条 Code 会话。这是 Claude 自己给会话生成的链接（Code 页会话的 `get_session` 返回的 `link` 就是这个格式），开源工具 claude-island、session-room、fulcra-tools 也都用它。
- id 对得上，不用猜：钩子拿到的 `session_id` 就是桌面版记录里的 `cliSessionId`，同一份记录的 `sessionId` 字段（也是文件名 `local_<uuid>.json`）就是链接要的 `local_<id>`。`claude_desktop.rs` 已经把它读进 `DesktopSession.local_id`。
- Mac 上实测通过：两条不同的会话之间来回切，每次都切到链接里那一条（见下面「Mac 实测」）。
- 打算的做法（等 #1015 合入后实现）：点 `claudeCode` 会话时，如果桌面版记录里有这条会话（按 `cliSessionId` 找到 `local_id`），先发 `epitaxy` 链接，再照旧把 Claude 窗口切到前台；链接发出去就算精确跳转。`local_id` 只放行 `local_` 加字母、数字和 `-`，最长 64 个字符，不合格或找不到记录就退回现在的只切窗口。在终端里跑的 Claude Code 会话不在桌面版记录里，不受影响。
- 另一条路 `claude://code/continue?session=local_<id>` 本机也能切，但它在旧版本里被开关挡住过（日志 `code entry deep link gated off`，2.37337.1 才放开），`epitaxy` 没有这个历史，所以用 `epitaxy`。
- Windows 没实测：官方文档给出的 Windows 打开方式是 `start "" "claude://…"`，协议同样由桌面版注册；岛上点会话的整条路和 Windows 的链接都列进 A19。

## 详细

### 有哪些链接

| 链接 | 作用 | 来源 |
|---|---|---|
| `claude://claude.ai/new?q=` | 新对话 | 官方帮助文章 |
| `claude://claude.ai/chat/<对话 id>` | 打开某条聊天（不是 Code 会话） | 官方帮助文章 |
| `claude://code/new?q=&folder=` | 新建 Code 会话，`folder` 要用户确认 | 官方帮助文章 |
| `claude://claude.ai/epitaxy/local_<id>` | 打开某条 Code 会话 | 没有公开文档；Claude 自己生成的会话链接，社区工具在用 |
| `claude://code/continue?session=local_<id>` | 打开某条 Code 会话 | 没有公开文档；#90035 里 Anthropic 维护者说 2.37337.1 起放开 |
| `claude://resume?session=<cli id>` | 导入 CLI 会话 | #90035：几乎总是新建一条重复的会话，不能用 |
| `claude-cli://open?cwd=&q=` | 在终端里开新的 Claude Code | 官方文档；只能新建，和桌面版无关 |

- `epitaxy` 链接打开在主窗口，替换当前看着的会话，没有「在新窗口打开」的参数（#107007 在要这个功能）。对岛来说正合适：用户点的就是要看的那一条。
- 链接不是公开接口，版本更新可能改；claude-island 的 README 也这么提醒。所以做成「先发链接、再切窗口」：链接失效时至少还能切到窗口。
- #90035 提到放行的条件是已登录、没有被组织策略关掉链接；没登录时链接应该只把窗口调到前台，和现在一样。
- iOS 上这条链接只能打开 App 首页（#95478），和我们无关。

### 开源项目怎么做

- **claude-island**（macOS 刘海小组件）：读 `~/Library/Application Support/Claude/claude-code-sessions/` 里每条会话一个的 JSON，点一行发 `claude://claude.ai/epitaxy/<session-id>`，README 说这是「Claude 自己用的同一个链接」，并提醒会话文件是内部格式，更新可能改坏。
- **claude-session**（maxmatthews）：一个 GitHub Pages 跳转页，`#<id>` 转成 `claude://claude.ai/epitaxy/<id>`，只放行 `[A-Za-z0-9_-]{1,128}`，因为 GitHub 的 Markdown 会去掉 `claude://` 链接。
- **fulcra-tools #804**：读桌面版的会话记录，按 CLI id 或桌面 id 严格匹配，用 macOS 的 `open` 发 `claude://claude.ai/epitaxy/<桌面 id>`；名字、目录相同都不算匹配。
- **session-room**、**QuotaView #148**：同样用这条链接跳会话。
- 菜单栏类的 claude-status、claude-status-bar 只管终端里的 Claude Code，不跳桌面版的会话。

### id 怎么对上

- 桌面版每条 Code 会话一个文件：`claude-code-sessions/<组织>/<账号>/local_<uuid>.json`。字段 `sessionId` 是 `local_<uuid>`，和文件名一致；`cliSessionId` 是底下 Claude Code 的会话 id。
- 本机 338 条记录：文件名和 `sessionId` 全部一致、都是 `local_` 加 36 位 uuid；`lastAssistantCliSessionId` 和 `cliSessionId` 没有不一致的（即续接后 CLI id 没换）。
- 本机 `~/.fuyu/agent-sessions` 里 141 条钩子记录，137 条的文件名（钩子的 `session_id`）在桌面版记录的 `cliSessionId` 里找得到；剩下 4 条是 uuid v7 的格式，是别家代理的会话。
- 所以从岛上的会话 id 到链接是：`cliSessionId == session_id` 的那条记录 → `sessionId` → `claude://claude.ai/epitaxy/<sessionId>`。`claude_desktop::sessions` 已经按 `cliSessionId` 建了表，`local_id` 就是要的值。

### Mac 实测（2026-11-19，Claude 桌面版 5.11492.5，macOS 27.2）

桌面版开着、主窗口停在一条会话上，用 `open` 发链接，以记录里的 `lastFocusedAt`（桌面版把当前看着的会话记成最新）核对切到了哪一条：

1. `open "claude://claude.ai/epitaxy/local_2124f6f9-…"`：3 秒内最新聚焦的会话变成 `local_2124f6f9-…`。
2. `open "claude://code/continue?session=local_364f5b8e-…"`：变成 `local_364f5b8e-…`。
3. `open "claude://claude.ai/epitaxy/local_c53b7eb2-…"`（切回测试前看着的那条）：变成 `local_c53b7eb2-…`。

没测：桌面版没开时发链接、链接里的会话已归档或不存在、没登录。岛上点会话的整条路在实现后进 A19 的实测清单。

## 来源

- Anthropic 帮助中心「Open Claude Desktop with a link」（support.claude.com/en/articles/14729294）：`claude://claude.ai/new`、`chat/<id>`、`code/new` 等公开链接和各平台的打开命令。
- Claude Code 文档「Launch sessions from links」（code.claude.com/docs/en/deep-links）：`claude-cli://` 只开终端会话。
- `anthropics/claude-code` issue #90035（`code/continue` 的开关，2.37337.1 起放开；`resume` 会重复导入；有人报告 `epitaxy` 能切到对的会话）、#107007（`epitaxy` 在主窗口替换当前会话）、#95478（iOS 上只到首页）。
- GitHub：joannemiki57/claude-island、maxmatthews/claude-session、huan5678/session-room、ashfulcra/fulcra-tools PR #804、Duoasa/QuotaView issue #148。
- 本机 `/Applications/Claude.app/Contents/Info.plist`（`CFBundleURLSchemes` 是 `claude`）、`~/Library/Application Support/Claude/claude-code-sessions/`、`~/.fuyu/agent-sessions/`，只读。没有解包桌面版的安装包。
