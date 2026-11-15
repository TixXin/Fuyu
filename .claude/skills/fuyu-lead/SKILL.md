---
name: fuyu-lead
description: >
  ALWAYS invoke BEFORE acting as a lead ("主 agent") session in the Fuyu repo: opening a lead
  session for a multi-part piece of work, planning it and showing the plan, dispatching
  sub-sessions with start_session, reviewing and landing what they did, including dispatching
  just one more session when this session has already dispatched one. Do NOT dispatch a second
  session without loading this skill first. Do NOT invoke for a single change one session can
  finish, or for doing one task yourself (fuyu-task).
  触发：开个主 agent、主会话、让主 agent 派子会话、并行处理、统筹、拆开并行做、再派一个、
  /fuyu-lead <主题>。
---

# 主 agent 模式：先规划、等点头、再派子会话

用户给一个主题（例如「agent 适配」「#349」「B25–B27」），由一个**主 agent 会话**统筹：先整理计划给用户看，用户同意后再派子会话并行做，最后检查结果、收口。

## 1. 在当前会话里：开主 agent

当前会话不自己做，用 `start_session` 开一个新会话当主 agent：

- `initiation: "user_asked"`，`context: "fresh"`，`use_worktree: false`（仓库规则：不开 worktree、不切分支）
- `name` 用 `<主题>-lead`，标题写「<主题> 主 agent：规划并分派 …」
- `background` 写清起因（issue、用户的原话、已经回复过什么、已经建了哪些任务），主 agent 看不到当前对话
- `prompt` 用下面第 2 节的简报，把主题、相关任务和 issue、已知的现状和范围填进去

开完后跟用户说一句：主 agent 在整理计划，计划好了会在它的会话里等用户确认。

## 2. 主 agent 的简报（照这个写）

1. **第一轮只规划**：不改代码、不建 issue、不派会话。读 `AGENTS.md`、子目录的 `AGENTS.md`、`docs/tasks/README.md`、`docs/architecture/workflow.md`，主题相关的 skill（例如 agent 适配要先加载 `fuyu-agent-harness`）、现状文档，还有 `pnpm tasks show` / `gh issue view` 查到的相关任务和 issue。
2. **计划要写清**：
   - 先后顺序和依赖：哪些必须一个会话独占先做（例如抽公共列表），哪些可以并行；
   - 每个子会话认领哪个任务、`--scope` 写哪些文件，怎样算做完，要跑哪些验证；按文件切分，不让两个会话改同一个文件；
   - 做不到的部分，以及要开哪些 issue；
   - 需要用户定的问题。

   计划在会话里讲给用户听，同时存一份文件，派出去的子会话也能读到。然后用 `wrap_up` 问「按这个计划开始派会话吗？」，停下来等用户回答。
3. **用户同意后**：新任务先 `gh issue create`，再 `pnpm tasks add … --issue`，调好依赖，按阶段派子会话（每个都用 `use_worktree: false`）。必须串行的，等前一阶段完成后再派下一阶段。**同时最多 2 个要编译（cargo、tauri build、回归页）的子会话**，其余的排在后面一波；全机器同时改代码的会话控制在 6 个左右（先看 ListAgents 里有多少在干活），只读代码、写文档、做调研的不算。整批 `pnpm mq:land` 由主 agent 发起，子会话不各自 land（workflow.md「Rust 构建」里的排队规则，issue #448）。
4. **每个子会话的简报开头写**：先加载 `fuyu-task` 并照它做。后面只写这次特有的：认领哪个任务、会话名、`--scope`、怎样算做完、跑哪些验证、由主 agent 整批 land。通用的约束不再抄进简报，抄的每次都会漏几条。
5. **收口**：子会话的汇报不算数，主 agent 要看它的 diff 和提交，再 `pnpm tasks dirty` 看它有没有留下没提交的文件；更新现状文档；PR 合入后给每个子会话发消息，让它回复并关闭自己的 issue（`fuyu-task` 第 9 步在等这条通知），再用 `pnpm issue` 核对相关 issue 都已回复并关闭，漏的补上；最后向用户汇报每个任务的结果、提交、PR，以及还剩什么。用户问进度时先跑 `pnpm progress`，再用 ListAgents 补会话状态：脚本看不到会话是不是还活着。

## 3. 用户怎么快速用

在会话里说「开个主 agent 处理 <主题>」或输入 `/fuyu-lead <主题>`，当前会话就按第 1 节开主 agent。
