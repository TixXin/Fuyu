# Claude Code 任务看板（Web）项目

> 日期：2026-11-15。问题：有哪些给 Claude Code 用的任务看板 / Web 看板项目。范围：网页搜索 "Claude Code kanban board web UI github"、"Claude Code task board web dashboard open source multiple agents"；`gh search repos "claude code kanban"`、`"claude code task board"`（按 star 排序）；star 数、最后推送时间、许可证用 `gh api repos/<仓库>` 查，均为 2026-11-15 的数据。相关任务：无。

## 结论

这类项目分两种：

- **派活型**：看板上的卡片就是任务，拖到某一列或点开始，就起一个 Claude Code（或 Codex 等）去做，常配 git worktree、每任务一个分支 / PR、做完进「待审」。代表：Vibe Kanban、Multica、Agent Teams、AutoMaker、kanbots、amux。
- **观察型**：不派活，只把正在跑的 Claude Code 会话或它的 Task 列表按状态排成看板，实时刷新。代表：claude-task-viewer、agent-viewer、claude-code-ui、kanban-code。

想直接用，派活型先看 **Vibe Kanban**（2.9 万 star，Apache-2.0，持续更新）；只想看会话状态，看 **claude-task-viewer** 或 **agent-viewer**（tmux）。下面的功能描述来自各仓库简介和搜索结果摘要，没有逐个装来试，属于「未核实」的程度。

## 详细

### 派活型（看板驱动 agent）

| 项目 | Star | 最后推送 | 许可证 | 说明 |
|---|---|---|---|---|
| [multica-ai/multica](https://github.com/multica-ai/multica) | 56154 | 2026-11-15 | 未声明标准许可 | 人和 AI agent 一起协作的任务平台，可自托管；支持 Claude Code、Codex、OpenCode 等，可接多台机器当运行端 |
| [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban) | 28694 | 2026-11-12 | Apache-2.0 | 最知名的一个。Rust 后端 + Web 看板，任务交给 Claude Code / Codex 等，每任务独立 worktree，看 diff、审核、合并 |
| [AutoMaker-Org/automaker](https://github.com/AutoMaker-Org/automaker) | 3225 | 2026-05-22 | 未声明标准许可 | 看板式的 AI 开发编排工具（仓库无简介，未核实细节） |
| [777genius/agent-teams-ai](https://github.com/777genius/agent-teams-ai) | 2490 | 2026-11-15 | AGPL-3.0 | 多个 agent 组成团队，自己领任务、互发消息、互相审代码，人看看板下指令；支持很多家模型 |
| [leodavinci1/kanbots](https://github.com/leodavinci1/kanbots) | 623 | 2026-05-25 | MIT | 本地看板，每张卡是一个 Claude Code 或 Codex agent；React + Vite，带 Electron 壳 |
| [mixpeek/amux](https://github.com/mixpeek/amux) | 562 | 2026-11-15 | MIT + Commons Clause | 并行跑 Claude Code / Codex / Gemini CLI，共享任务板（领任务原子化，重复领返回 409）、定时、用量限额恢复；Web 看板 + iOS/Mac 应用 |
| [rookedsysc/kanvibe](https://github.com/rookedsysc/kanvibe) | 151 | 2026-11-15 | AGPL-3.0 | 键盘优先的桌面看板，内嵌终端、git worktree、用 hook 跟踪任务状态 |
| [cruzyjapan/Claude-Code-Kanban-Automator](https://github.com/cruzyjapan/Claude-Code-Kanban-Automator) | 52 | 2025-12-22 | MIT | 看板 + Claude Code 自动执行、反馈循环 |
| [0xc00010ff/proq](https://github.com/0xc00010ff/proq) | 16 | 2026-05-24 | 无 | 给 Claude 用的任务板 |
| [borgius/kanban-lite](https://github.com/borgius/kanban-lite) | 10 | 2026-05-31 | MIT | 任务存成 Markdown，带 Web UI、CLI、MCP |
| [nerkoman/agent-kanban](https://github.com/nerkoman/agent-kanban) | 4 | 2026-09-25 | MIT | SQLite + FastAPI；拖到 Approved 后 agent 经 MCP 领走并自己推进状态 |
| [fpperri/kanban](https://github.com/fpperri/kanban) | 1 | 2026-11-14 | MIT | 一个目录的 `*.card.md` 就是看板，带 Claude Code 插件和本地 Web 编辑器 |
| [xinayida/kanban-board](https://github.com/xinayida/kanban-board) | 0 | 2026-08-13 | 无 | 四列看板 + MCP 工具 + 调度器，每任务一个分支和 PR |

另有 PyPI 上的 [kanbai](https://pypi.org/project/kanbai/)：看板存 Markdown，带本地 Web UI，完成的任务进待审；未查到仓库数据。

### 观察型（看会话 / 任务状态）

| 项目 | Star | 最后推送 | 许可证 | 说明 |
|---|---|---|---|---|
| [L1AD/claude-task-viewer](https://github.com/L1AD/claude-task-viewer) | 769 | 2026-02-14 | MIT | Web 看板，实时显示 Claude Code 的 Task 列表 |
| [KyleAMathews/claude-code-ui](https://github.com/KyleAMathews/claude-code-ui) | 416 | 2026-01-09 | 无 | 按状态排会话，AI 摘要，跟踪 PR / CI，实时更新 |
| [hallucinogen/agent-viewer](https://github.com/hallucinogen/agent-viewer) | 403 | 2026-05-28 | 无 | 管理 tmux 里多个 Claude Code agent 的 Web 看板 |
| [langwatch/kanban-code](https://github.com/langwatch/kanban-code) | 340 | 2026-11-13 | Apache-2.0 | 原生 macOS / Windows 应用，每张卡是一个 Claude Code 会话（不是 Web） |
| [NikiforovAll/claude-code-kanban](https://github.com/NikiforovAll/claude-code-kanban) | 82 | 2026-11-15 | MIT | 起初是 Pending / In Progress / Completed 三列的任务看板（[作者博文](https://nikiforovall.blog/ai/productivity/2026/02/07/claude-code-kanban.html)），现在简介写成「Agent 开发环境与编排器」 |

还有 PyPI 上的 [claude-kanban](https://pypi.org/project/claude-kanban/)（多台服务器的 Claude Code 会话实时看板），以及只查到产品页的 [ClauBoard](https://www.producthunt.com/p/clauboard)，都未核实。

### GitHub 上的小项目

`gh search repos` 还有一批几颗星的个人项目（如 alexadark/claude-code-kanban、ottocoster/claude-code-kanban-board，都是 Claude Code 内的看板 mod；mamdouht/claude-code-task-board 等），多数是练手或刚开始，不单独列。

## 来源

- 上表各仓库链接（数据来自 GitHub API，2026-11-15）
- 搜索结果汇总：[awesome.ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fleodavinci1%2Fkanbots)、[sourcepulse agent-viewer](https://www.sourcepulse.org/projects/24936696)、[sourcepulse kanban-code](https://www.sourcepulse.org/projects/33020568)、[sourcepulse claude-code-ui](https://www.sourcepulse.org/projects/22580959)、[amux 看板说明](https://amux.io/features/web-dashboard/)、[aiproductivity.ai](https://aiproductivity.ai/news/open-source-ai-agent-task-board/)
