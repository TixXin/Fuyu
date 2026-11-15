---
name: fuyu-lead
description: >
  ALWAYS invoke BEFORE acting as a 总控 or a 组长 (lead) session in the Fuyu repo: setting up a new
  总控 session for a long-term area, opening a 组长 for a piece of work or handing a task to one, planning
  it and showing the plan, dispatching task sessions with start_session, reviewing, landing and
  archiving what they did, including dispatching a single task session for one small task. Do NOT
  dispatch a session without loading this skill first. Do NOT invoke for a change this session
  makes itself, or for doing one task yourself (fuyu-task).
  触发：开个总控、新建总控、/fuyu-lead 总控 <领域>、开个组长、主 agent、主会话、派子会话、
  并行处理、统筹、拆开并行做、再派一个、收口、归档做完的子会话、/fuyu-lead <主题>。
---

# 总控和组长：先规划、等点头、再派会话

三种角色，结构和命名的来由见 `docs/research/session-hierarchy.md`「结构」「命名」：

- **总控** `Fuyu-[总控] <领域>`：每个长期领域一个，在侧边栏顶层并置顶，由用户自己开，长期存在。只聊天、规划、派会话、检查，不写代码。`Fuyu-[总控] 全局` 另管整批合入、拦发版和跨领域协调，`Fuyu-[总控] issue 和 PR` 管分 issue 和外部 PR。
- **组长** `[任务] <主题>`：总控为一件事开的统筹会话，规划、派任务会话、收口，不写代码，做完就归档。
- **任务会话** `[<任务编号>] <一句话>`，还没建任务的写 `[#<issue 号>]`；等用户挑方案或只查不改的写 `[预览]`、`[调研]`、`[排查]` 加主题。真正改代码的是它们；它们只由组长派，挂在组长下面（用户定的）。
- 其他长期存在、要置顶的会话写 `Fuyu-[长期任务] <主题>`，例如 `Fuyu-[长期任务] 发版`。

前缀一律用方括号，置顶的会话前面再加 `Fuyu-`（用户定的）。前缀里不加空格，也不加「 - 」：侧边栏窄，标题超出的部分会被截掉。

**哪个总控管什么**（`Fuyu-[总控] issue 和 PR` 收到 issue、全局收到任务时照这张表转；还没开的总控，它的事由全局先接着）：

| 总控 | 管什么 |
|---|---|
| `Fuyu-[总控] 全局` | D 组（质量与发布）、整批合入、跨领域协调；发版由 `Fuyu-[长期任务] 发版` 做 |
| `Fuyu-[总控] issue 和 PR` | 新 issue 的分诊（回复、建任务、按这张表转给对应总控）、已做完的 issue 回复并关闭的核对，别人提的 PR（检查、回复、按 `docs/architecture/workflow.md`「外部 PR」合入）。只做分诊和对外沟通，代码交给对应总控 |
| `Fuyu-[总控] 插件系统` | E 组里平台本身：宿主、内核、插件接口、插槽化（`packages/plugin-base`、`src-tauri/src/plugin_host/`、`src/features/plugins/`） |
| `Fuyu-[总控] 插件开发` | E 组里写插件的部分：官方插件和示例、插件市场、SDK 和脚手架、插件开发文档（`plugins/`、`packages/fuyu-plugin`、`packages/create-fuyu-plugin`、`docs/plugins/`） |
| `Fuyu-[总控] AI Agent` | B 组，以及各家 AI 代理的接入 |
| `Fuyu-[总控] UI 外观` | C 组里岛的形态、外观、主题、面板和设置窗口的界面 |
| `Fuyu-[总控] 功能` | C 组里其余的功能：消息、待办、提醒、剪贴板、媒体、翻译、截图等 |
| `Fuyu-[总控] Mac 适配` | G 组 |
| `Fuyu-[总控] Win 适配` | 只在 Windows 上出现的问题和 Windows 专有的能力：平台层 `src-tauri/src/win32/`、安装包、不同 Windows 版本和显示器的兼容 |
| `Fuyu-[总控] 流程与文档` | F 组，以及 skill、规则文件和仓库文档 |
| `Fuyu-[总控] 疑问` | 用户随口问的问题：某个功能怎么用、代码在哪、为什么这样设计、某个行为对不对。只查只答，不改代码、不派会话；要改的写清楚再交给对应的总控 |

**合入**：平时只由 `Fuyu-[总控] 全局` 整批 `pnpm mq:land`。各总控、组长的任务验完、提交后发消息告诉全局（写提交号），不各自 land：几个 land PR 同时开会互相等 CI、互相冲突。紧急修复才自己 `pnpm mq:land --yes --upto <提交号>`，并告诉全局。

**找对方**：正在跑的会话，SendMessage 的 `to` 直接写它的标题（例如 `Fuyu-[总控] 插件系统`）；没在跑的写它的会话 id（`local_…`，`list_sessions` 查），app 会唤醒它。

## 0. 开一个总控（用户在新会话里输入 `/fuyu-lead 总控 <领域>`）

1. `set_session_title`（`self`）改成 `Fuyu-[总控] <领域>`。
2. 如果本会话是别的会话用 `start_session` 开的（会挂在开它的会话下面，那个会话归档时会把它一起带走），先 `detach_session`（`self`）拆到顶层。然后 `set_pinned` 把 `self` 置顶：置顶的会话不会被自动归档。不建分区、不把总控移进分区（用户定的）：移进分区会取消置顶。
3. 读 `AGENTS.md`、`docs/tasks/README.md`、`docs/architecture/workflow.md` 和 `docs/research/session-hierarchy.md`，用 `pnpm tasks` 看这个领域有哪些进行中和待做的任务，再用一两句话告诉用户：已经就位，手上有哪些事，然后等用户吩咐。这一轮不改代码、不派会话。

## 1. 总控接到一件事：交给组长

- **总控不直接派任务会话**（用户定的）：任务会话挂在总控下面，侧边栏里就分不出哪几个会话在做同一件事，置顶区也越堆越长。只有一个任务的小事也走组长。
- **先看有没有能接的组长**：这个总控已经开着主题相近的组长，就 SendMessage 把新任务交给它；没有才新开。同一领域的零散小任务攒给一个组长，不各开一个：每个组长都在侧边栏占一行，还要人收口。
- 开组长用 `start_session`：
  - `initiation: "user_asked"`，`context: "fresh"`，`use_worktree: false`（仓库规则：不开 worktree、不切分支）
  - 插件系统、插件开发两个领域的会话，组长和它派的任务会话都传 `effort: "xhigh"`，已经开着的用 `set_session_effort` 改（用户定的）；组长自己低于 xhigh 时派不出 xhigh 的会话，`start_session` 只接受不高于自己的强度
  - `name` 用 `<主题>-lead`，`title` 用 `[任务] <主题>`
  - `background` 写清起因（issue、用户的原话、已经回复过什么、已经建了哪些任务），组长看不到总控的对话
  - `prompt` 用第 2 节的简报，把主题、相关任务和 issue、已知的现状和范围填进去，再写上总控自己的标题，要求组长在计划写好、每批做完、被卡住和全部做完时 SendMessage 告诉总控（总控没在跑时按标题用 `list_sessions` 查它的 `local_…` id）
- **开完马上 `detach_session` 把组长拆到顶层**：不拆的话组长挂在总控下面，它派的任务会话就成了第三层，侧边栏只有顶层能折叠，第三层收不起来。拆完总控不再收到组长每轮结束的通知，所以要靠上一条写进简报的 SendMessage；组长不置顶，做完由总控按 id `archive_session`，它派的任务会话会一起归档。
- 开完组长跟用户说一句：组长在整理计划，计划好了会在它的会话里等用户确认。

## 2. 组长的简报（照这个写）

1. **第一轮只规划**：不改代码、不建 issue、不派会话。读 `AGENTS.md`、子目录的 `AGENTS.md`、`docs/tasks/README.md`、`docs/architecture/workflow.md`，主题相关的 skill（例如 agent 适配要先加载 `fuyu-agent-harness`）、现状文档，还有 `pnpm tasks show` / `gh issue view` 查到的相关任务和 issue。
2. **计划要写清**：
   - 先后顺序和依赖：哪些必须一个会话独占先做（例如抽公共列表），哪些可以并行；
   - 每个任务会话认领哪个任务、`--scope` 写哪些文件，怎样算做完，要跑哪些验证；按文件切分，不让两个会话改同一个文件；
   - 做不到的部分，以及要开哪些 issue；
   - 需要用户定的问题。

   计划在会话里讲给用户听，同时存一份文件，派出去的任务会话也能读到。然后用 `wrap_up` 问「按这个计划开始派会话吗？」，停下来等用户回答。
3. **用户同意后**：新任务先 `gh issue create`，再 `pnpm tasks add … --issue`，调好依赖，按阶段派任务会话（每个都用 `use_worktree: false`，插件领域的照第 1 节传 `effort`，`title` 用 `[<任务编号>] <一句话>`，`name` 用任务编号把点换成短横线，例如 `e36-3-18`）。必须串行的，等前一阶段完成后再派下一阶段。**同时最多 2 个要编译（cargo、tauri build、回归页）的任务会话**，其余的排在后面一波；全机器同时改代码的会话控制在 6 个左右（先看 ListAgents 里有多少在干活），只读代码、写文档、做调研的不算。只读的调研优先用后台子代理（Agent 工具），不进侧边栏。任务会话不各自 land，验完的提交按上面「合入」交给 `[总控] 全局` 整批合入（workflow.md「Rust 构建」里的排队规则，issue #448）。
4. **每个任务会话的简报开头写**：先加载 `fuyu-task` 并照它做。后面只写这次特有的：认领哪个任务、会话名、`--scope`、怎样算做完、跑哪些验证、提交后向谁汇报。通用的约束不再抄进简报，抄的每次都会漏几条。
   - 做预览页、设计稿这类给用户挑的 HTML 的，简报里写上：每出一份就用系统浏览器打开（Mac 上 `open <文件>`），不等几份凑齐，大改版再开一次；不用 app 自带的浏览器面板，那个只给会话自己验证用（用户定的，`fuyu-task` 里没有这条）。组长自己出的预览页也这样开；Markdown 文档仍按 `doc-preview`。
5. **收口**：任务会话的汇报不算数，要看它的 diff 和提交，再 `pnpm tasks dirty` 看它有没有留下没提交的文件；更新现状文档；PR 合入后给每个任务会话发消息，让它回复并关闭自己的 issue（`fuyu-task` 第 9 步在等这条通知），再用 `pnpm issue` 核对相关 issue 都已回复并关闭，漏的补上；然后归档做完的任务会话：任务已进 `0-archive/`、issue 已关、提交在 `origin/main` 上、`pnpm tasks dirty` 里没有它的文件，四条都满足才归档（`archive_session`）。归档不用再问用户（用户定的），能撤销，也不丢文件：任务会话不开 worktree。等用户挑方案的（预览页、设计稿）和工具说还有后台工作的先留着。组长不归档自己，归档会直接结束对话，留给开它的总控。最后向用户汇报每个任务的结果、提交、PR、归档了哪些会话，以及还剩什么。用户问进度时先跑 `pnpm progress`，再用 ListAgents 补会话状态：脚本看不到会话是不是还活着。

## 3. 用户怎么快速用

- 开一个总控：在侧边栏新建会话，第一句输入 `/fuyu-lead 总控 <领域>`，它按第 0 节就位。
- 在总控里说「处理 <主题>」或输入 `/fuyu-lead <主题>`，总控按第 1 节交给已有的组长或新开一个。
