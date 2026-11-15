# Agent 页优化计划（2026-11-15，主 agent 起草，用户确认按推荐方案做）

用户原话：「优化岛屿面板的 agent 页面，列表变动动效，子 agent UI 适配，排版，用户交互逻辑，icon 等」。现行设计见 [agent.md](agent.md)，这份是改动计划；做完后把定下来的写回 agent.md，这份移到 `docs/architecture/history/`。

## 现状（读代码和截图得到的）

| 问题 | 原因 |
|---|---|
| 用量两行字小、偏灰、挤，「可能已过时」每行重复一次 | `AgentUsageBar.tsx` 每家一行，过时文字跟在每行后面；`agent-usage--stale` 整行变淡 |
| 右侧模型、权限、宿主图标、Agent 图标、时间挤在标题行，时间被截成「<1m」溢出 | `AgentSessionsPanel.tsx` 列表视图的标题行塞了 6 样东西，只有标题会缩 |
| 「你：Linked sessions now…」 | Claude 桌面版往会话里写的 `user` 记录（`turnOrigin: "host_synthetic"`，`entrypoint: "claude-desktop"`），`title.rs` 的 `user_prompt_in_record` 只滤掉了 `<command-*>`、`<local-command`、`Caveat:`、`<task-notification>`。注意：子会话收到的第一条简报也是 `host_synthetic`，不能整条按这个字段丢掉，要按内容认（Linked sessions now、`<side-sessions-event>`、`<ci-monitor-event>`、`<system-reminder>` 这类） |
| 日历样的图标 | `SessionHostLabel` 的宿主图标；Claude 桌面版的 exe 取不到图标时退回 lucide `AppWindow`，看着像日历。宿主图标和 Agent 图标并排，含义不清 |
| 状态点含义不清 | 圆点没有 `title` / 悬停说明，颜色规则只写在 `sessionLight.ts` |
| 第三行工具调用 | `SessionBody` 里工具名和参数同色同字号，`Bash cd /Users/...` 很长，看不出是「正在调用」 |
| 列表变动没有动效 | 只有归档有动画（`useArchiveMotion.ts`）；新会话出现、重排、状态变化都是瞬间跳变 |
| 子 Agent 只有数字 | Rust 只数正在跑的 Task 调用（`claude_subagent_calls`），前端显示「2 个子 Agent」；Claude Code 的子 Agent 记录在 `<会话>/subagents/agent-*.jsonl`，没读。Claude 桌面版的子会话（像这组会话）是独立会话，会话记录里没找到父会话的 id |
| 交互 | 点行 = 跳窗口，悬停 = 归档；没有右键菜单、键盘上下选择，`components/list/RowMenu.tsx` 已有现成的行菜单没用上 |
| 结构 | `AgentSessionsPanel.tsx` 281 行，列表行的约 120 行写在 `map` 里，几个任务都要改它，必须先拆 |

## 任务和顺序

编号待用户同意后建（先 `gh issue create`，再 `pnpm tasks add --issue`），下表用暂定编号。同一阶段的会话改的文件不重叠。

| 阶段 | 任务 | 内容 | `--scope`（只改这些） | 依赖 |
|---|---|---|---|---|
| 1 | **B38** 抽出会话行组件 | 纯搬迁（`refactor(agent-status):`）：列表视图的一行拆到 `AgentSessionRow.tsx`，对应样式拆到 `AgentSessionRow.css`，行为、class 名不变 | `src/features/agent-status/AgentSessionsPanel.tsx`、`AgentSessionsPanel.css`、`AgentSessionRow.tsx`（新）、`AgentSessionRow.css`（新） | — |
| 1 | **B39** 不把宿主注入的文本当成「你：」 | Rust：`user_prompt_in_record` 认出桌面版注入的块（只跳过注入的文本块，同一条记录里用户自己的文字照样取），标题回退也不取它；带脱敏样本的单元测试 | `src-tauri/src/agent_status/title.rs`、`src-tauri/src/agent_status/title_tests.rs`（新） | — |
| 2 | **B40** 列表变动动效 | 新 hook `useListMotion.ts`（FLIP）：重排时行平移过去、新行淡入展开、离开的行收起（不是归档的那种），状态点换色过渡，状态变成「等你」时圆点脉冲一次；和归档动画不打架；减少动画时全部关掉。新回归页 `agent-list-motion` 测重排后位置和减少动画 | `useListMotion.ts`（新）、`AgentListMotion.css`（新）、`AgentSessionsPanel.tsx`、`useArchiveMotion.ts`、`tests/regression/agent-list-motion.*`（新）、`scripts/run-regression.mjs` | B38 |
| 2 | **B41** 排版与图标 | 用量行、会话行右侧、状态点说明、工具行样式、宿主图标（见下面「要你定的」1、2、4），浅色岛对比度 | `AgentSessionRow.tsx`、`AgentSessionRow.css`、`SessionBody.tsx`、`SessionHostLabel.tsx`、`AgentUsageBar.tsx`、`AgentUsageBar.css`、`usage.ts`、`src/i18n/sections/agent.ts`、`tests/regression/agent-sessions.tsx`、`docs/design/agent.md` | B38 |
| 3 | **B42** 子 Agent 显示 | Rust 读 `subagents/agent-*.jsonl`，给会话带上子 Agent 列表（描述、状态、当前工具、开始时间）；前端按「要你定的」3 显示；顺带调研桌面版子会话能不能拿到父会话，拿不到就开 issue 记下来 | `src-tauri/src/agent_status/subagents.rs`（新，含测试）、`session_scan.rs`、`sessions.rs` 里调用的那一处、`api.ts`、`sessionList.ts`、`AgentSessionsPanel.tsx`、`AgentSubagents.tsx` / `.css`（新）、`src/i18n/sections/agent.ts`、`tests/regression/agent-sessions.tsx` | B39、B40、B41 |
| 4 | **B43** 行的交互 | 右键或 `⋯` 打开 `RowMenu`：跳到窗口、打开文件夹、复制路径 / 会话 id、归档、按目录隐藏（写进现有「隐藏会话」规则）；键盘 ↑↓ 选行、Enter 跳转、Delete 归档；悬停卡片显示完整标题、最近提问、路径 | `AgentSessionRow.tsx`、`AgentSessionRowMenu.tsx`（新）、`AgentSessionsPanel.tsx`、`src/i18n/sections/agent.ts`、`tests/regression/agent-sessions.tsx`、`docs/design/agent.md` | B42 |

阶段 1 两个并行，阶段 2 两个并行，阶段 3、4 各一个（都要改 `AgentSessionsPanel.tsx`、`agent.ts`、回归页）。B40 的设计说明由主 agent 收口时写进 `agent.md`（阶段 2 只让 B41 改它）。

**和别的会话撞文件**：G1.3 / G1.7 / G1.9（Mac 适配，认领已超过 24 小时没动静）的 scope 里有 `api.ts`、`sessions.rs`、`tests.rs`、`appearance/types.ts`、`i18n/sections/settings/agent.ts`。B39 改 `title.rs` 和新测试文件，避开了它们；B42 要改 `api.ts`、`sessions.rs`，开工前 `pnpm tasks conflicts`，给 G1.3 的会话发一条消息说明再动。这个计划不新增设置项，不碰 `appearance/types.ts` 和设置页。

## 每个会话怎样算做完

- 前端：`pnpm check` + `pnpm build` + `pnpm test:regression`（含浅色岛对比度）；新 `animation` 带 `prefers-reduced-motion`。
- Rust（B39、B42）：再加 `cargo test --manifest-path src-tauri/Cargo.toml` + `pnpm build:exe`，构建目录用 `src-tauri/target/agents`。
- 截图：每个会话在回归页里截深色、浅色、窄宽（400 弹出提醒宽）三张，放进任务文件或 PR 正文。
- `pnpm tasks done <编号> --commit "<标题>"` 和功能提交放一起；按 workflow.md 攒批 `pnpm mq:land`。

本机（Mac）测不了、要列进实测清单的：Windows 上的宿主图标、跳转窗口；真机 `pnpm tauri dev` 里看动效流畅度（回归页只能测位置和类名）。

## 用户的决定（2026-11-15）

六项都按推荐方案：1 选 A（合成一个胶囊），2 选 A（宿主做 Agent 图标的角标，取不到不显示），3 选 A（点开展开、默认收起；桌面版子会话归父会话先由 B42 调研），4 选 A（表格对齐、过时改时钟图标），5 选克制，6 三样都做。下面保留当时的选项供参考。

## 当时的选项

1. **会话行右侧太挤，怎么放？**
   - A（推荐）：模型、推理强度、权限合成一个小胶囊（`Opus 5.5 · M · 自动`），放不下时先省掉推理强度再省掉权限；时间固定一列不再被挤掉。
   - B：模型和权限挪到第二行行首，标题行只留标题、图标、时间。
   - C：平时不显示模型和权限，悬停这一行时才出现。
2. **两个图标（宿主 App 和 Agent）怎么摆？**
   - A（推荐）：Agent 图标为主，宿主做成它右下角的小角标；取不到宿主图标时不显示角标（不再退回像日历的方框）。
   - B：都保留，宿主图标改成设置里默认关。
   - C：去掉宿主图标，宿主名放到悬停卡片里。
3. **子 Agent 怎么显示？**
   - A（推荐）：父行状态处的「2 个子 Agent」变成可点的小按钮，点开在父行下面缩进列出子 Agent（每个一行：描述、当前工具、用时），默认收起；子 Agent 跑完自动从列表消失。
   - B：父行下面一直缩进显示正在跑的子 Agent，最多 3 行，多的写「还有 n 个」。占高度，「显示几条会话」会不准。
   - C：只在悬停卡片里列出子 Agent，列表本身不变。
   - 另外：Claude 桌面版开的子会话（像这次主 agent 派出去的）要不要归到父会话下面？需要先查能不能拿到父子关系，B42 顺带调研，拿不到开 issue。
4. **用量行**
   - A（推荐）：每家一行保留，列对齐成表格（5 小时 / 7 天 / 模型三列），字号和对比度提到和会话第二行一样；过时不再每行写字，改成一个时钟小图标，悬停说明。
   - B：合成一行，Claude 和 Codex 并排，各只显示最紧的那个窗口和重置时间，悬停看全部。
5. **动效力度**：克制（推荐：重排平移 200ms、新行淡入、状态点换色过渡，变成「等你」时脉冲一次）还是明显（新行从顶部滑入并高亮闪一下、每次状态变化都脉冲）？
6. **交互（B43）要不要做全**：右键菜单 + 键盘 + 悬停卡片三样都做，还是先只做右键菜单？
