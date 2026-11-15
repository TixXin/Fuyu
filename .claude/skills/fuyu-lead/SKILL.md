---
name: fuyu-lead
description: >
  ALWAYS invoke BEFORE acting as a 总控 or a 组长 (lead) session in the Fuyu repo: setting up a new
  总控 session for a long-term area, opening a 组长 for a multi-part piece of work, planning it and
  showing the plan, dispatching task sessions with start_session, reviewing, landing and archiving
  what they did, including dispatching just one more session when this session has already
  dispatched one. Do NOT dispatch a second session without loading this skill first. Do NOT invoke
  for a single change one session can finish, or for doing one task yourself (fuyu-task).
  触发：开个总控、新建总控、/fuyu-lead 总控 <领域>、开个组长、主 agent、主会话、派子会话、
  并行处理、统筹、拆开并行做、再派一个、收口、归档做完的子会话、/fuyu-lead <主题>。
---

# 总控和组长：先规划、等点头、再派会话

三种角色，结构和命名的来由见 `docs/research/session-hierarchy.md`「结构」「命名」：

- **总控** `[总控] <领域>`：每个长期领域一个，在侧边栏顶层并置顶，由用户自己开，长期存在。只聊天、规划、派会话、检查，不写代码。`[总控] 全局` 另管分 issue、整批合入、拦发版和跨领域协调。
- **组长** `<组长> <主题>`：总控为一件大事开的统筹会话，规划、派任务会话、收口，不写代码，做完就归档。
- **任务会话** `(<任务编号>) <一句话>`，还没建任务的写 `(#<issue 号>)`；等用户挑方案或只查不改的写 `「预览」`、`「调研」`、`「排查」`、`「长期任务」` 加主题。真正改代码的是它们。

前缀里不加空格，也不加「 - 」：侧边栏窄，标题超出的部分会被截掉。

**哪个总控管哪些任务**（按 `pnpm tasks` 的分组；`[总控] 全局` 收到 issue 或任务时照这张表转，没有对应总控的领域由全局先接着）：

| 任务组 | 总控 |
|---|---|
| B Agent 页体验 | `[总控] Agent 页` |
| C 竞品都有、我们还缺的 | 按功能分：消息、待办、提醒等归 `[总控] 消息与小功能`，岛的形态和外观归 `[总控] 岛与外观`，剪贴板、音乐、歌词归 `[总控] 剪贴板与媒体` |
| D 质量与发布 | `[总控] 全局`（发版由「长期任务」发版 会话做） |
| E 插件平台 | `[总控] 插件平台` |
| F 多会话协作 | `[总控] 流程与文档` |
| G macOS 适配 | `[总控] Mac 适配` |

**合入**：平时只由 `[总控] 全局` 整批 `pnpm mq:land`。各总控、组长的任务验完、提交后发消息告诉全局（写提交号），不各自 land：几个 land PR 同时开会互相等 CI、互相冲突。紧急修复才自己 `pnpm mq:land --yes --upto <提交号>`，并告诉全局。

**找对方**：正在跑的会话，SendMessage 的 `to` 直接写它的标题（例如 `[总控] 插件平台`）；没在跑的写它的会话 id（`local_…`，`list_sessions` 查），app 会唤醒它。

## 0. 开一个总控（用户在新会话里输入 `/fuyu-lead 总控 <领域>`）

1. `set_session_title`（`self`）改成 `[总控] <领域>`。
2. `set_pinned` 把 `self` 置顶：置顶的会话不会被自动归档。不建分区、不把总控移进分区（用户定的）：移进分区会取消置顶。
3. 读 `AGENTS.md`、`docs/tasks/README.md`、`docs/architecture/workflow.md` 和 `docs/research/session-hierarchy.md`，用 `pnpm tasks` 看这个领域有哪些进行中和待做的任务，再用一两句话告诉用户：已经就位，手上有哪些事，然后等用户吩咐。这一轮不改代码、不派会话。

## 1. 总控接到一件事：直接派，还是开组长

- **一两个任务会话能做完的，总控直接派**：照第 2 节的第 3～5 步做（认领、派会话、收口），派出的会话挂在总控下面，只有两层。
- **要分几批、派三个以上会话的，才开组长**。每多一个组长，侧边栏就多一层收不起来的会话，所以小事不开。开组长用 `start_session`：
  - `initiation: "user_asked"`，`context: "fresh"`，`use_worktree: false`（仓库规则：不开 worktree、不切分支）
  - `name` 用 `<主题>-lead`，`title` 用 `<组长> <主题>`
  - `background` 写清起因（issue、用户的原话、已经回复过什么、已经建了哪些任务），组长看不到总控的对话
  - `prompt` 用第 2 节的简报，把主题、相关任务和 issue、已知的现状和范围填进去
- 开完组长跟用户说一句：组长在整理计划，计划好了会在它的会话里等用户确认。

## 2. 组长的简报（照这个写；总控直接派时从第 3 步做起）

1. **第一轮只规划**：不改代码、不建 issue、不派会话。读 `AGENTS.md`、子目录的 `AGENTS.md`、`docs/tasks/README.md`、`docs/architecture/workflow.md`，主题相关的 skill（例如 agent 适配要先加载 `fuyu-agent-harness`）、现状文档，还有 `pnpm tasks show` / `gh issue view` 查到的相关任务和 issue。
2. **计划要写清**：
   - 先后顺序和依赖：哪些必须一个会话独占先做（例如抽公共列表），哪些可以并行；
   - 每个任务会话认领哪个任务、`--scope` 写哪些文件，怎样算做完，要跑哪些验证；按文件切分，不让两个会话改同一个文件；
   - 做不到的部分，以及要开哪些 issue；
   - 需要用户定的问题。

   计划在会话里讲给用户听，同时存一份文件，派出去的任务会话也能读到。然后用 `wrap_up` 问「按这个计划开始派会话吗？」，停下来等用户回答。
3. **用户同意后**：新任务先 `gh issue create`，再 `pnpm tasks add … --issue`，调好依赖，按阶段派任务会话（每个都用 `use_worktree: false`，`title` 用 `(<任务编号>) <一句话>`，`name` 用任务编号把点换成短横线，例如 `e36-3-18`）。必须串行的，等前一阶段完成后再派下一阶段。**同时最多 2 个要编译（cargo、tauri build、回归页）的任务会话**，其余的排在后面一波；全机器同时改代码的会话控制在 6 个左右（先看 ListAgents 里有多少在干活），只读代码、写文档、做调研的不算。只读的调研优先用后台子代理（Agent 工具），不进侧边栏。任务会话不各自 land，验完的提交按上面「合入」交给 `[总控] 全局` 整批合入（workflow.md「Rust 构建」里的排队规则，issue #448）。
4. **每个任务会话的简报开头写**：先加载 `fuyu-task` 并照它做。后面只写这次特有的：认领哪个任务、会话名、`--scope`、怎样算做完、跑哪些验证、提交后向谁汇报。通用的约束不再抄进简报，抄的每次都会漏几条。
5. **收口**：任务会话的汇报不算数，要看它的 diff 和提交，再 `pnpm tasks dirty` 看它有没有留下没提交的文件；更新现状文档；PR 合入后给每个任务会话发消息，让它回复并关闭自己的 issue（`fuyu-task` 第 9 步在等这条通知），再用 `pnpm issue` 核对相关 issue 都已回复并关闭，漏的补上；然后归档做完的任务会话：任务已进 `0-archive/`、issue 已关、提交在 `origin/main` 上、`pnpm tasks dirty` 里没有它的文件，四条都满足才归档（`archive_session`）。归档不用再问用户（用户定的），能撤销，也不丢文件：任务会话不开 worktree。等用户挑方案的（预览页、设计稿）和工具说还有后台工作的先留着。组长不归档自己，归档会直接结束对话，留给开它的总控。最后向用户汇报每个任务的结果、提交、PR、归档了哪些会话，以及还剩什么。用户问进度时先跑 `pnpm progress`，再用 ListAgents 补会话状态：脚本看不到会话是不是还活着。

## 3. 用户怎么快速用

- 开一个总控：在侧边栏新建会话，第一句输入 `/fuyu-lead 总控 <领域>`，它按第 0 节就位。
- 在总控里说「处理 <主题>」或输入 `/fuyu-lead <主题>`，总控按第 1 节决定直接派还是开组长。
