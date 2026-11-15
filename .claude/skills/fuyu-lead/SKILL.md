---
name: fuyu-lead
description: >
  This skill should be used in the Fuyu repo when the user wants a "lead" / "主 agent" session
  to own a multi-part piece of work: plan it first, show the plan, and only after the user
  approves dispatch parallel sub-sessions and review their results. Triggers: 开个主 agent、
  主会话、让主 agent 派子会话、并行处理、统筹、拆开并行做、/fuyu-lead <主题>. Not for a single small
  change that one session can finish.
---

# 主 agent 模式：先规划、等点头、再派子会话

用户给一个主题（例如「agent 适配」「#349」「B25–B27」），由一个**主 agent 会话**统筹：先整理计划给用户看，用户同意后再派子会话并行做，最后检查结果、收口。2026-11-14 在 #349（DeepSeek Harness / opencode 适配）上第一次这样用，用户认可。

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
3. **用户同意后**：新任务先 `gh issue create`，再 `pnpm tasks add … --issue`，调好依赖，按阶段派子会话（每个都用 `use_worktree: false`）。必须串行的，等前一阶段完成后再派下一阶段。
4. **每个子会话的简报都要带上这些约束**：在主工作区、本地 `main` 上工作；不 stash / reset / checkout 别人的文件；只提交自己的文件（`git commit -- <文件>`）；`pnpm task:claim <编号> --as <会话名> --scope ..`，带 issue 的任务认领后先在 issue 下回复；Rust 构建用 `src-tauri/target/agents`，不跑 `pnpm tauri dev`；长命令放后台；做完 `pnpm tasks done`，按 workflow.md 攒批 `pnpm mq:land`；PR 合入后在 issue 下回复改了什么、列出提交，再 `gh issue close`（只留「接手」那一条就停下是常见的漏项）。本机测不了的（Windows 专有的部分、真机），列进实测清单。
5. **收口**：子会话的汇报不算数，主 agent 要看它的 diff 和提交；更新现状文档；用 `pnpm issue` 核对相关 issue 都已回复并关闭，漏的补上；最后向用户汇报每个任务的结果、提交、PR，以及还剩什么。

## 3. 用户怎么快速用

在会话里说「开个主 agent 处理 <主题>」或输入 `/fuyu-lead <主题>`，当前会话就按第 1 节开主 agent。
