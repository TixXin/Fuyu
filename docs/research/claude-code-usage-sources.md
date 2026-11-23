# 别的项目怎么拿 Claude Code 的额度

> 日期：2026-11-23。问题：用户觉得「读 claude-hud 的快照」不好（换了状态栏之后快照 10 天没更新，岛上 Claude 的额度直接消失），想知道别的开源项目怎么拿 Claude Code 的 5 小时 / 7 天额度。范围：GitHub 上的菜单栏 / 状态栏 / 小组件项目，Claude Code 官方状态栏文档，anthropics/claude-code 的 issue（含 claudeissues.com 镜像），本机 Vibe Island 的做法。相关任务：B90（额度显示）。

## 结论

别人的做法归成四类，只有前两类拿到的是官方百分比：

| 做法 | 数据 | 代价和风险 | 谁在用 |
|---|---|---|---|
| **A. 状态栏转存**：Claude Code 每次刷新状态栏时把 `rate_limits` 从 stdin 传给 `statusLine.command`，脚本顺手存一份文件 | 官方 5 小时、7 天百分比和重置时间，每条回复都更新，不发请求、不碰 token | `statusLine` 只有一个位置，得串在用户原来的状态栏前面；只在终端里的 Claude Code 跑的时候更新；多个版本出过「`rate_limits` 不在 stdin 里」的回归；没有按模型的额度 | Vibe Island（`~/.vibe-island/bin/vibe-island-statusline` 先把 stdin 交给 bridge 存进 `cache/rl.json`，再跑用户自己的内容）、claude-hud、ohugonnot/claude-code-statusline、leeguooooo/claude-code-usage-bar |
| **B. OAuth 用量接口**：`GET https://api.anthropic.com/api/oauth/usage`，带 Claude Code 登录的 token 和 `anthropic-beta: oauth-2025-04-20` | 官方百分比，还有 `seven_day_opus` / `seven_day_sonnet` 这类按模型的额度和超额用量 | 未公开的接口，字段会变；限流很凶，多开会话或轮询太勤就长时间 429，常常没有 `Retry-After`；token 过期时自己刷新会顶掉 Claude Code 的 refresh token（单次有效） | CodexBar（首选）、frippz/headroom、diegocp01/top_bar_claude_code_usage、trthomps/claude-usage-widget、Vibe Island（`cache/anthropic-oauth-usage.json`），以及我们自己的用量环（`src-tauri/src/claude_usage/source.rs`） |
| C. claude.ai 网页接口：用浏览器里的 `sessionKey` cookie 调 claude.ai 的用量接口 | 官方百分比 | 要读浏览器 cookie 或让用户粘贴 cookie，侵入性大；有人说它和 B 不共用限流（未核实） | CodexBar 的 Web 路径 |
| D. 读本地 JSONL 估算：按 `~/.claude/projects/*.jsonl` 里的 token 数和价格表算，5 小时一块 | 只有 token 数和美元估算，没有官方百分比，上限要用户自己填或用历史最大值 | 和官方数字对不上 | ccusage、Claude-Code-Usage-Monitor、ccstat |

CodexBar 还有第五条路：在伪终端里跑 `claude` 解析 `/usage` 的输出，只当兜底，它自己的文档也说状态栏这类输出不要拿来解析。

**建议**：Claude 的额度改成 **A 为主、B 兜底**，不再依赖 claude-hud：

1. 「安装/修复」装一个浮屿自己的状态栏转发脚本：读 stdin，把 `rate_limits` 原子写进浮屿的数据目录，再把同一份 stdin 交给用户原来的 `statusLine.command`，原样输出它的结果；原来的命令记下来，「移除钩子」和卸载时还原。这样不管用户用 claude-hud、Vibe Island 还是自己写的状态栏都不受影响，跟着 Claude Code 每条回复更新。
2. 文件太旧（窗口已过重置时间，或超过一段时间没写）时，用已有的 OAuth 接口补一次：只读 token、不刷新，间隔不短于 5 分钟，429 时按 `Retry-After` 或指数退避，失败时继续显示旧数并标「可能已过时」。Agent 页开着额度时也启动这条，不只用量环。按模型的额度（Opus / Sonnet 周额度）只有这条有。
3. claude-hud 的快照降成兼容读取：没有 A、B 的数据时才用。
4. 不做 C 和 D：C 要碰浏览器 cookie，D 给不出官方百分比。

额度过期时不要让整行消失：显示一颗灰的「已过期 · n 天前」，悬停写原因和怎么修（例如「状态栏换了，点安装/修复」）。

## 详细

### A. 状态栏的 `rate_limits`（官方文档）

[官方状态栏文档](https://code.claude.com/docs/en/statusline)：

- 字段：`rate_limits.five_hour` 和 `rate_limits.seven_day`，各有 `used_percentage`（0–100）和 `resets_at`（Unix 秒）；走 Claude apps 网关时另有 `spend_limit`。没有按模型的窗口。
- 什么时候有：claude.ai Pro / Max / Ultra 订阅，会话里第一次 API 响应之后；每个窗口可能单独缺，过了 `resets_at` 就去掉。
- 什么时候跑：会话开始、每条助手消息之后、`/compact` 之后、切权限模式、到 `refreshInterval`（默认不设）、某个额度窗口到重置时间时；300ms 防抖，新触发会取消正在跑的那次。不花 token。
- 文档里没有别的官方渠道（钩子、命令行参数）能拿额度，[#38380](https://github.com/anthropics/claude-code/issues/38380) 还在要。
- 回归：[#40094](https://claudeissues.com/issue/40094-bug-rate-limits-field-missing-from-statusline-json-for-claude-max-20x-plan-oauth)、[#45133](https://claudeissues.com/issue/45133-rate-limits-seven-day-five-hour-missing-from-statusline-json-input)、[#60612](https://claudeissues.com/issue/60612-statusline-hook-payload-no-longer-includes-rate-limits-field-v2-1-138)、[#95918](https://claudeissues.com/issue/95918-rate-limits-field-never-populated-in-statusline-hook-input-json-v2-1-278) 都报过某些版本 / 套餐（含 Team）stdin 里没有 `rate_limits`；[#69791](https://claudeissues.com/issue/69791-statusline-stdin-missing-seven-day-sonnet-and-seven-day-opus-rate-limit-fields) 要按模型的字段。所以 B 必须留着兜底。
- 本机：Vibe Island 的 `rl.json` 最后写于 2026-07-24，说明它的转存也会断，它同时留着 OAuth 缓存（`anthropic-oauth-usage.json`，2026-11-04）。原因没查。

### B. OAuth 用量接口

- token：macOS 在钥匙串「Claude Code-credentials」，其他平台在 `~/.claude/.credentials.json` 的 `claudeAiOauth.accessToken`。我们的 `source.rs` 已经两处都读，过期时报错、不刷新。
- 刷新 token 的坑：[headroom](https://github.com/frippz/headroom) 故意不刷新，因为 refresh token 只能用一次，第三方刷新会让 Claude Code 掉登录；[top_bar_claude_code_usage](https://github.com/diegocp01/top_bar_claude_code_usage) 会刷新。我们保持不刷新。
- 返回：`five_hour`、`seven_day`、`seven_day_opus`、`seven_day_sonnet`、`extra_usage` 等，[claude-usage-widget](https://github.com/trthomps/claude-usage-widget) 说新版改成 `limits` 数组、旧字段兜底。本机 Vibe Island 的缓存里还有一串代号字段（`tangelo`、`iguana_necktie`…），字段会继续变。
- 限流：[#31637](https://claudeissues.com/issue/31637-bug-api-oauth-usage-endpoint-aggressively-rate-limits-making-usage-monitoring-un)、[#30930](https://claudeissues.com/issue/30930-bug-api-oauth-usage-endpoint-returns-persistent-429-for-claude-max-users-retry-a)、[#31319](https://claudeissues.com/issue/31319-statusline-usage-data-unavailable-with-multiple-concurrent-sessions-oauth-rate-l)：轮询 30–60 秒就会被长时间 429；Claude Code 自己多开会话也在调这个接口，额度是共用的。

### C、D

- [CodexBar 的 Claude 文档](https://raw.githubusercontent.com/steipete/CodexBar/main/docs/claude.md)：App 按 OAuth → CLI 伪终端 → 网页接口的顺序兜底，网页接口用 Safari / Chrome / Firefox 的 cookie 或手动粘贴的 `sessionKey`。
- [ccusage](https://www.mintlify.com/ryoppippi/ccusage/api/commands/blocks)：按 JSONL 算 5 小时块，上限是用户给的参数或历史最大值，不是官方的。

## 来源

- https://code.claude.com/docs/en/statusline
- https://github.com/anthropics/claude-code/issues/38380
- https://github.com/frippz/headroom
- https://github.com/diegocp01/top_bar_claude_code_usage
- https://github.com/trthomps/claude-usage-widget
- https://github.com/ohugonnot/claude-code-statusline
- https://github.com/leeguooooo/claude-code-usage-bar
- https://github.com/briansmith80/claude-code-status-bar
- https://raw.githubusercontent.com/steipete/CodexBar/main/docs/claude.md
- https://www.mintlify.com/ryoppippi/ccusage/api/commands/blocks
- 上面正文里列出的 claudeissues.com issue 镜像（GitHub 原帖编号相同）
- 本机：`~/.vibe-island/bin/vibe-island-statusline`、`~/.vibe-island/cache/`（2026-11-23 查看）
