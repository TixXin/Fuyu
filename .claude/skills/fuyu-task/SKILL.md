---
name: fuyu-task
description: >
  ALWAYS invoke BEFORE working on a Fuyu task or GitHub issue: claiming a task in docs/tasks or
  adding one to work on (pnpm task:claim, pnpm tasks add --claim), fixing or answering an issue,
  being dispatched by a lead session to do a task id, or taking over a task another session
  started, including a small fix that has a task or an issue. Do NOT claim a task or start on
  an issue without loading this skill first. Do NOT invoke for planning and dispatching
  sub-sessions (fuyu-lead), publishing a version (fuyu-release), or a small change the user
  asks for on the spot that has no task and no issue.
  触发：做一下 F43、认领任务、接着做、接手这个任务、处理 issue、修一下 #506、看看这个 issue、
  这个 issue 关了吗、主 agent 派来做某个编号、只是个小修。
---

# 做一个任务：从认领到关 issue

做完的标准，缺一样都不算：提交在 `origin/main` 上（PR 已合入）；任务文件在 `docs/tasks/0-archive/` 并记了提交；issue 有完成回复并已关闭；本机没测到的进了实测清单。最常丢的是合入之后的回复和关闭，所以提交完、land 完都还没结束。

规则本体在 `docs/tasks/README.md`（字段、状态、issue 和 PR 的回复格式、实测清单）和 `docs/architecture/workflow.md`（提交、land、排队、排障）。这里只排顺序和坑，细节去那两份查。

## 顺序

1. **看任务，先查重**：`pnpm tasks show <编号>` 读全文和「交接」，带 issue 的再 `pnpm issue <N>` 读全部回复。
   - 还没有任务的事，先在 `pnpm issue` 和 `pnpm tasks` 的列表里找同一件事，免得两个会话各做一遍。
   - 确实没有才新建，先 issue 后任务：自己发现的照 README「自己新建的任务」，别人提的 issue 照 README「GitHub issue」（先核实、先回复，再 `pnpm tasks add <编号> --title .. --issue <N> --claim --as <会话名> --scope ..`）。
2. **认领，`--scope` 写全**：`pnpm task:claim <编号> --as <会话名> --scope "<目录/>,<文件>"`。会话名用简报给的，没有就用 ListAgents 里自己的名字。命令自己会做一个只含任务文件的提交，不用再提交它。
   - 目录以 `/` 结尾；文档、测试、顺带要改的文件都写上。漏写的文件在 `pnpm tasks dirty` 里没人认领，别的会话也查不出和你撞。
   - 中途多改了文件，直接改任务文件头部的 `scope`：再跑一次认领只会说「已经是你的」，不更新范围。
   - 命令打出「注意：X 也在改 …」时看撞的是什么：热点文件人人都要加一行，不用商量，照第 5 步的做法改；别的文件先找那个会话商量再动。
   - 接手别人的任务：读完「交接」，给原会话发一条消息说明（不等回复），认领时加 `--takeover`。
3. **动手前在 issue 下回复**：谁接手、核实的结果、打算怎么改，附任务文档链接。`gh issue comment <N> --repo TixXin/fuyu --body-file <文件>`，语言、署名和最后一行照 README「GitHub issue」。先回复再动手是用户定的。
4. **查冲突，读规则**：`git status --short -- <scope 里的路径>`，再 `pnpm tasks conflicts`。
   - 认领前就有改动的文件是别的会话的，`pnpm tasks dirty` 看归谁，先问再动。
   - `tasks conflicts` 列的是整个本地 `main` 和 `origin/main` 的冲突，只看落在自己 `--scope` 里的；它只比已提交的内容，所以 land 前再跑一次。
   - 改 `src/` 先读 `src/AGENTS.md`，改 `src-tauri/` 先读 `src-tauri/AGENTS.md`：子目录的规则文件不会自动加载。任务或简报点名的 skill、文档也在这一步读。
5. **改**：在主工作区、本地 `main` 上，不开 worktree、不切分支，不 `git stash` / `git reset` / `git checkout -- <文件>`，工作区里有别的会话没提交的改动，这些命令会把它们冲掉。
   - 只提交自己的文件：新文件先 `git add <文件>`，再 `git commit -m "<标题>" -- <文件…>`。
   - 同一个文件里有别人的改动：`pnpm mq:commit-part --list <文件>` 列出每一处，再 `pnpm mq:commit-part -m "<标题>" --take <文件>:<编号,…>` 只带自己的，先加 `--dry-run` 看一眼。不手写 `GIT_INDEX_FILE`，照旧 `HEAD` 搭的提交会把别人刚提交的改动冲回去。
   - 热点文件（`package.json`、`workflow.md` 这类，列表在 workflow.md「没提交的文件」）：改之前 `git status --short -- <文件>` 看有没有别人没提交的改动，改完马上单独提交，混着别人的改动就用上一条。挂着不提交会让本地 `main` 跟不上 `origin/main`。
6. **按改动范围验证**：跑哪些看根 `AGENTS.md`「验证」的表，小修和纯搬迁也照表跑。
   - `cargo`、`tauri build` 写成 `pnpm heavy -- <命令>`，用共用的 `src-tauri/target/agents`，不跑 `pnpm tauri dev`（workflow.md「Rust 构建」）；没排队的会被钩子拦下。
   - 构建、`cargo test` 这类长命令放后台跑，前台的工具结束前读不到别的会话发来的消息。
   - `pnpm check` 是一串 `&&`，一步失败后面的都不跑。失败的是别人没提交的文件时不去改它，记下文件和哪一步，再把后面的步骤单独跑完（顺序看 `package.json` 的 `check`，例如 `pnpm run check:colors`、`pnpm test`），汇报里写明哪些失败不是自己造成的。
   - 本机测不了的（另一个平台、真机、要用户的账号）当场记：`pnpm tasks note <编号> "实测清单（为什么本机测不了）：1) … 2) …"`，随第 7 步的提交带上（README「实测清单」）。
7. **标完成，进同一个提交**：对着任务文件的「验收」逐条核对过，先定好提交标题，`pnpm tasks done <编号> --commit "<标题>"`，再用一字不差的标题提交；差一个字，land 的检查就过不了。
   - 任务文件是挪进 `0-archive/` 的，新旧两个路径都要带：`git add docs/tasks/0-archive/<分组>/<编号>.md`，然后 `git commit -m "<标题>" -- <功能文件…> docs/tasks/<分组>/<编号>.md docs/tasks/0-archive/<分组>/<编号>.md`。
   - 这个提交还要带热点文件里自己的一处时：`pnpm mq:commit-part -m "<标题>" --take <文件>:<编号> -- docs/tasks/<分组>/<编号>.md docs/tasks/0-archive/<分组>/<编号>.md`，不用先 `git add`。
   - 功能已经分几次提交过的（接线、热点文件都要求改完马上提交）：`tasks done` 跟最后一个提交，`--commit "<标题 1>" --commit "<标题 2>"` 把每个都记上。
   - 功能提交之后才能做的（贴真实输出、补验证）：新开一个小提交，标题写清补的是哪个提交。`HEAD` 不是自己那个提交时不 amend，那会改到别的会话的提交。
   - 多行的记录（真实输出、回放数字）在 `tasks done` 之后直接改归档任务文件的 `## 备注`，再 `pnpm check:tasks`；`tasks note` 只写得了一行交接。
8. **land**（被主 agent 派来的跳过，见最后一节）：PR 正文照 workflow.md「PR 的标题和正文」写进文件，`pnpm mq:land --yes --body <文件>`，然后后台 `pnpm mq:wait`。
   - PR 合入才算数；CI 没过、冲突都要回来处理（workflow.md「排障」）。
   - 手上只有认领、文档这类零碎提交时先攒着，`pnpm mq:pending` 会说到没到该提的时候。
9. **合入后回复并关 issue**：`gh issue comment <N> --repo TixXin/fuyu --body-file <文件>` 写原因、改了什么、怎么拿到、验证结果和实测清单，引用任务文档（这时在 `docs/tasks/0-archive/<分组>/<编号>.md`），列出提交（短提交号加标题）；再 `gh issue close <N> --repo TixXin/fuyu`。
   - 不在提交说明里写 `Closes #N`，它会在完成回复之前把 issue 关掉。
   - 关完跑 `pnpm progress`，「任务已完成、issue 还开着」里不该再有你的编号。
10. **实测清单**：第 6 步记下的那几条照 README「实测清单」发出去：PR 正文的「注意」、issue 的完成回复；要用户或另一台机器来测的另建任务，不然合入后没人记得测。

## 停下或做不完

- 停下（等人、换会话、上下文快满）：能独立成立的改动先提交，再 `pnpm tasks note <编号> "<做到哪、下一步、哪些没提交的文件是自己的>"`。接手的会话读不到你的对话，只读得到任务文件。
- 做不完、不打算继续：`pnpm tasks release <编号> --as <会话名> --reason "<原因>"`，放回待做并留下交接。
- 决定不做：`pnpm tasks drop <编号> --reason "<原因>"`，在 issue 下回复原因后 `gh issue close <N> --repo TixXin/fuyu --reason "not planned"`。

## 被主 agent 派来时不一样的地方

- 任务编号、`--scope`、怎样算做完、跑哪些验证听简报的；简报没写的照上面做。
- 不自己 `pnpm mq:land`：整批由主 agent 发起，各自 land 会把别人没验完的提交一起推上去。
- 第 7 步提交后向主 agent 汇报，第一句写提交号，再写验证结果、实测清单、不是自己造成的检查失败和还没提交的文件，然后停下。这时任务已归档而 issue 还开着，`pnpm progress` 把它列成「还没合入」是对的。
- 第 9 步等主 agent 通知已合入再做。回复和关闭仍是你的事，主 agent 只在收口时补漏。
