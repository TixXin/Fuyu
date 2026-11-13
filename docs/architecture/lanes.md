# lane 与合并队列

代理会话怎样开 lane、在 lane 里工作、合入 `main`，以及背后的设计和排障。必须遵守的几条在 [AGENTS.md](../../AGENTS.md)「Git 与协作」；仓库里的 `lanes` skill（`.claude/skills/lanes/`）按这份文档的顺序带着做。

全部在仓库里：合并队列（rebase、推分支开 PR 并开启自动合并、等合入后快进主工作区、pre-push 检查）在 `scripts/mq/`，lane 的分配、归属和 Claude Code 钩子在 `scripts/lanes/`。2026-11-12 之前用的是 [claude-code-merge-queue](https://github.com/funador/claude-code-merge-queue) 加一份补丁，F29 收回了仓库；数据目录 `.git/claude-code-merge-queue/` 和环境变量 `CLAUDE_CODE_MERGE_QUEUE_EMERGENCY_PUSH` 沿用原名（`CLAUDE_CODE_MERGE_QUEUE_LANDING` 在 F30 第 4 步删掉了）。2026-11-13 起 land 不再直接推 `main`，改成开 PR、由 GitHub 在 CI 通过后合入（F30，计划见 [land-via-pr-plan.md](land-via-pr-plan.md)），本机的排队锁随之删除。

钩子：

| 钩子 | 在哪里配 | 脚本 |
|---|---|---|
| WorktreeCreate | 仓库里的 `.claude/settings.json` | `worktree-hooks.mjs create`：同 `lane:open` |
| WorktreeRemove | 仓库里的 `.claude/settings.json` | `worktree-hooks.mjs remove`：同 `lane:done`；干净的释放回池子、目录留着，有工作的退出码 1，Claude Code 就不删 |
| SessionStart | 用户级 `~/.claude/settings.json`，`pnpm lane:install-hooks` 写入 | `scripts/lanes/session-hint.mjs`：在主工作区启动时提醒先开 lane，并列出被遗弃的 lane |
| SessionEnd | 用户级 `~/.claude/settings.json`（`timeout` 30），`pnpm lane:install-hooks` 写入 | `scripts/lanes/session-end.mjs` |
| pre-push | `.githooks/pre-push`（`core.hooksPath`） | `node scripts/mq/mq.mjs check-push` |

`.claude/` 里只有 `settings.json`（上面两个 Worktree 钩子）和 `skills/`（`lanes`、`fuyu-release`）进仓库，其余（`settings.local.json`、`worktrees/`）各机器自己的。仓库里的钩子命令写成 `sh -c 'PATH="$PATH:/opt/homebrew/bin:/usr/local/bin" exec node "$CLAUDE_PROJECT_DIR/scripts/lanes/worktree-hooks.mjs" …'`：不写死路径，换文件夹、换机器都能用；mac 上的钩子不读 shell 配置，要补上 Homebrew 的 PATH 才找得到 `node`；Windows 上 Claude Code 用 Git Bash 跑钩子，同一条命令也能用（2026-11-13 实测）。会话从 lane 启动时 `$CLAUDE_PROJECT_DIR` 是 lane，脚本用 `git rev-parse --git-common-dir` 找回主工作区。

SessionStart / SessionEnd 必须放用户级：magpie 这类会话不从仓库启动，读不到仓库的 `.claude/settings.json`，也没有指向仓库的 `$CLAUDE_PROJECT_DIR`，只能写主工作区的绝对路径。新机器或主工作区挪了位置后，在主工作区跑 `pnpm lane:install-hooks`：它往 SessionStart / SessionEnd 追加这两个钩子，不动别的工具的钩子；已经有的（哪怕指向旧路径）就地改成当前路径、去掉重复；改之前把原文件备份成 `settings.json.bak-lane-hooks-<时间>`；mac 上自动加上面的 PATH 包装；可以重复运行。`--check` 只列出要改什么，不写，要改时退出码 1。`core.hooksPath` 不用手动设：`pnpm install` 的 `prepare`（`scripts/install-git-hooks.mjs`）在它还没设时设成 `.githooks`，已经设成别的值时只提示不改。

## 开 lane、进入 lane

- 会话在仓库目录里启动时：`claude -w <任务名>`，或在会话里调用 EnterWorktree（WorktreeCreate 钩子）。
- 钩子用不了时（例如会话不是从仓库目录启动的，magpie 会话就是这样）：在主工作区运行 `pnpm lane:open --as <会话名>`，最后一行是 lane 的路径，**紧接着 EnterWorktree(path=<lane 路径>) 进入它**。会话名用 ListAgents 里自己的名字。
- 接手别人的 lane（交接）：`pnpm lane:take <N> --as <会话名>`，再 EnterWorktree(path) 进入。对方还在用时会拒绝，确认对方不用了再加 `--force`。
- 退出会话前：`pnpm lane:done`（在 lane 里不用写编号）。lane 干净、提交都在 `main` 上时释放它，否则列出未提交的文件和未合入的提交、不释放，还会提醒写着这个 lane 的任务。确认不要那些改动了才加 `--force`。释放后再 ExitWorktree(action="keep")；lane 本身留着，下一个会话立刻就能复用。
- 会话退出时（两次 Ctrl+C、`/exit`、Ctrl+D），`SessionEnd` 钩子（`scripts/lanes/session-end.mjs`）自动做同样的检查：释放会话所在的 lane 和登记在这个会话 ID 名下的 lane，有工作的保留；会话所在的 lane 登记在别的会话名下时不碰（例如在 lane 里起的 `claude -p` 子会话退出时，2026-11-13 曾把父会话干净的 lane 释放掉，land 因此报“没有归属记录”）；`/clear`、`/resume` 不释放。钩子配在用户级 `~/.claude/settings.json`（`pnpm lane:install-hooks` 写入），所以 magpie 这类从别处启动的会话也会跑；脚本按自己所在位置找仓库，`timeout` 设为 30 秒（SessionEnd 默认只有 1.5 秒）。直接关掉终端或进程被杀时钩子不一定跑，所以收工前仍要 `lane:done`。
- 只想放掉登记、不做检查：`pnpm lane:release <N>`。
- **不要手动 `git worktree add`**：那样不留归属记录，别的会话会把它当成空闲的 lane；`pnpm verify` 和 land 也会拒绝没有归属记录的 lane。

会话的当前目录必须在 lane 里，不要留在主工作区用绝对路径改 lane：那样状态栏显示 `main`，“有进程的当前目录在里面”这条在用判断失效，`cd` 失败时命令还会落进别人的 lane。

一个会话用 EnterWorktree(path) 进过某个 lane 后，不能再切到另一个 lane（EnterWorktree 只允许切到 `.claude/worktrees/` 下的 worktree）。这时就在当前 lane 里 `pnpm lane:open`，它会把这个 lane 还给你；要换 lane 只能新开会话。

## 分配和归属

钩子和 `lane:open` 走同一套分配（`scripts/lanes/lanePool.mjs`）：

1. 会话自己的空闲 lane（当前所在的，或登记在它名下的）；
2. 没人用的 lane，编号从小到大；
3. 都没有才新建。

分到的 lane 重置到主工作区的 `HEAD`，保留 `node_modules` 和编译缓存，再跑一次 `pnpm install`。所以 lane 数量大致等于同时开的会话数。

`pnpm lane:list` 列出每个 lane 是谁的、为什么算在用。以下任一情况都算有人在用，不会分给别的会话：

- 登记的会话还在运行：`~/.claude/sessions/<pid>.json` 里有它的会话 ID，对应进程还在（岛屿的 AI 代理状态也这样判断）。会话身份取自 Claude Code 给命令设的环境变量 `CLAUDE_CODE_SESSION_ID`、`CLAUDE_PID`，magpie 会话也有；`--as` 不写时用会话记录里的名字。旧登记既没有会话 ID 也没有进程号时，2 小时内登记过才算在用。`lane:open`、`lane:take`、`task:claim` 和每次 land 都会登记。
- 有「进行中」（没过期）或「待用户确认」的任务写着这个 lane。lane 编号会被复用，所以 lane 已登记给另一个会话时，写着它的旧认领算过期。
- 30 分钟内有改动，而且是在最近一次释放之后。释放（`lane:done`、`lane:release`、退出时的钩子）是明确的“不用了”，释放前的改动不再算；兜底的“最近有改动”只为没登记的会话。
- 有进程的当前目录在里面（Windows 上这时文件夹改不了名）。

有未提交、未跟踪的文件，或有不在 `main` 上的提交的 lane，谁也分不到，也不会被重置。

归属记录有两份，都在 `.git/claude-code-merge-queue/`：

- `lane-owners.json`：合并队列自己读的，只写进程号已知的登记；
- `lane-sessions.json`：所有登记，带会话名、会话 ID 和最近一次登记时间；
- `lane-released.json`：每个 lane 最近一次释放的时间，再次登记时清掉。

进程号未知的登记不能写进 `lane-owners.json`：合并队列会把空进程号当成“会话已退出”，2026-11-12 两次因此误删了还在用的 lane 21。

## 开发、验证、合入

1. 在 lane 里开发、提交。想在本机先验一遍时用 `pnpm verify`：`pnpm check`，改到 `src-tauri/` 或 `plugins/` 时加 `cargo test`，只改 Markdown 时只跑文档检查；通过的代码树会被记住，同一棵树不再重跑。land 不再在本机跑这些，由 PR 上 CI 的 `check` 把关。
2. 一个功能单元完成并提交后，在 lane 里 `pnpm mq:land --body <文件>`，不用问用户。`<文件>` 是会话写在 scratchpad 里的中文 PR 正文（见下面「PR 的标题和正文」）。它 rebase 到 `origin/main`，推到远程分支 `land/<GitHub 用户名>/<机器名>-<分支名>`（pre-push 钩子跑 `scripts/land-check.mjs --light`：lane 的归属记录、Claude 署名行、已完成任务的提交记录、只改文档或版本号时的轻量检查，不跑 `pnpm check` 和 `cargo test`），没有 PR 就开一个（标题取第一个提交的英文标题，`--title` 可以换成一个总标题；正文用 `--body` 给的文件），再开启自动合并（`--merge`，提交号不变）。然后在后台跑 `pnpm mq:wait`：CI 的 `check` 通过、GitHub 合入后，它把主工作区快进到新的 `main`。PR 落后于 `main` 时由工作流 `update-behind-prs.yml` 更新（见下）；那个工作流出问题时可以 `pnpm mq:wait --update` 自己更新。`pnpm mq:land --wait` 把两步合在一起，在前台等。
3. PR 合入才算完成，`mq:wait` 报告失败就不算：
   - rebase 冲突（land 时，或 `mq:wait` 报 PR 冲突）：land 会自动中止 rebase。`git fetch origin main && git rebase origin/main` 解决冲突后重新 land。
   - 本机检查或 CI 失败：在同一个 lane 修好、提交，再 land，PR 自动更新。计时类测试在机器负载高时偶尔失败，单独重跑通过就重新 land。
   - `mq:wait` 已经报告合入，只是快进主工作区失败：不要重复 land，在主工作区运行 `pnpm mq:sync`。
4. 需要 release 可执行文件时，land 之后另外跑 `pnpm build:exe`（见「Rust 构建」）。

`main` 只通过在 GitHub 上合入 PR 移动（land 也是开 PR）。`.githooks/pre-push`（`core.hooksPath` 指向 `.githooks`）对任何人都拒绝直接推送 `main`；GitHub 的规则集也拒绝（管理员只能在 PR 上绕过，F30 第 8 步），所以紧急时用 `gh pr merge --admin` 合 PR。`CLAUDE_CODE_MERGE_QUEUE_EMERGENCY_PUSH=1` 只放行本机钩子，规则集临时改回 `always` 时才用得上。主工作区留给用户（例如 `pnpm tauri dev`），保持干净、停在 `main` 上。

land 从 git 的 pre-push 钩子里跑检查，环境里带着 `GIT_DIR` 等变量。凡是在临时仓库里跑 git 的测试，开头都要去掉 `GIT_*` 变量，并确认 git 指向临时仓库：2026-11-12 一个测试因此把真实仓库改成了 `core.bare=true`，还往 `main` 上留下了作者 `t <t@t>` 的提交 `852a7aab`。

## PR 的标题和正文

标题用英文，取第一个提交的标题，和提交历史、合并提交对得上；一个 lane 有几个提交、第一个代表不了全部时，用 `--title "<英文总标题>"` 换掉。正文用中文，由会话写进 scratchpad 里的一个文件，用 `--body <文件>` 交给 land；land 在末尾加一条分隔线和「由 `pnpm mq:land` 从 `lane/N` 开出」。PR 已经开着时（重新 land），给了 `--body` 或 `--title` 就把 PR 的正文和标题换成新的，没给就不动。

正文按下面的格式写，和 PR 模板一致。每段不手动折行：GitHub 把 PR 正文里的每个换行都显示成换行，按 72 列折的提交说明贴进去会一行长一行短。

```markdown
## 改了什么
- 用户或开发者能感知到的变化，一条一行

## 为什么
一两句：起因、bug 的现象、任务编号

## 验证
- `pnpm check` 通过（666 条）
- 实测：怎么做的、看到了什么

## 注意
契约变更、要手动做的事、没验证到的（没有就删掉这一节）

## 关联
任务 D31 · issue #12（多个提交时列出提交标题）
```

没给 `--body` 时，land 自动生成一份中文骨架：一句「land 时没有给中文说明」的提示、提交标题列表、按目录归类的改动范围、从任务文件推出的关联任务，英文提交说明去掉折行后收进折叠块。`task:claim`、放回任务这类只改任务文件的 PR 用固定的一段中文，不用另写。实现在 `scripts/mq/prBody.mjs`。

## 外部 PR

别人提的 PR（协作者的 PR 由我们来合时也一样）不走 land：land 会 rebase 再推自己的 `land/…` 分支、另开 PR，别人的 PR 就合不上了。直接在那个 PR 上开启自动合并。

1. 读说明和改动。CI 会在 PR 上跑全套检查（`check`），一般不用在本机再跑；要看界面效果或改动风险大时，在 lane 里 `git fetch origin pull/<编号>/head:pr-<编号>`，`git merge --no-ff pr-<编号>` 合到最新的 `origin/main` 上验证，这个合并不推送。
2. 要合的：`gh pr merge <编号> --auto --merge`。CI 通过后 GitHub 合入，PR 自动关闭、提交号不变；落后于 `main` 时由 `update-behind-prs.yml` 排队更新（见上一节）。等结果用 `pnpm mq:wait <编号>`，合入后它会快进主工作区。
3. fork 来的 PR 有两处不同：第一次贡献的人的 CI 要维护者在 PR 页面点批准才会跑；作者没勾 "Allow edits from maintainers" 时，工作流没法更新它的分支，落后了要请作者自己更新。
4. 要补的修改另开 lane，照常 land。GitHub 报冲突时请作者 rebase，或问用户怎么处理，不要改写别人的分支。
5. 外部提交可以带 Claude 署名行，`land-check.mjs` 只查作者是本机 `user.email` 的提交。

回复和任务的顺序见 [docs/tasks/README.md](../tasks/README.md)「GitHub PR」。

## 预览

用户想看某个 lane 的效果时，在那个 lane 里：

| 命令 | 效果 |
|---|---|
| `pnpm dev:lane` | 和用户的岛屿并排的预览岛屿，放在屏幕左侧四分之一处 |
| `pnpm dev:lane:center` | 停在顶部正中，像正式安装那样（会和用户的岛叠在一起），看新手引导这类效果用 |
| `pnpm dev:lane:fresh` | `--center --fresh`：先删这个预览自己的数据，像新装一样启动；要先关掉正在跑的预览 |

预览的 Vite 端口是 1500 + lane 编号，应用标识 `com.tixxin.fuyu.lane-<N>`：数据、WebView 存储、单实例都和用户的分开，不注册 focusd:// 链接，不能改开机自启，也不能安装 AI 代理状态 hook。`--fresh` 只删 `%APPDATA%` 和 `%LOCALAPPDATA%` 下这两个文件夹。

不要在 lane 里直接跑 `pnpm tauri dev`：它会先关掉所有正在运行的岛屿，还要占用主工作区的 1420 端口。只看界面时也可以起 lane 的 Vite，打开 `tests/regression/*.html`。

## Rust 构建

都在主工作区的 `src-tauri/target` 下（`scripts/build-dirs.mjs`）：

| 目录 | 谁用 |
|---|---|
| `debug` | 用户的 `pnpm tauri dev`。代理不要用，否则互相等锁、互相触发重编译 |
| `release` | `pnpm build:exe`，桌面快捷方式指向这里 |
| `agents` | 代理的 `cargo test` / clippy（`land-check.mjs` 已经设好；在 lane 里手动跑时设 `CARGO_TARGET_DIR=<主工作区>/src-tauri/target/agents`） |
| `lane-<N>` | lane N 预览的 exe |
| `lane-build` | 所有 lane 预览共用的编译目录（cargo 的 build-dir），依赖只在第一个预览时编一次 |

- `pnpm build:exe` 不在队列里。它会把正在运行的 exe 改名挪开再写新的，不用让用户关岛屿；多个 lane 同时构建时后来的会等（`target/release/.build-exe.lock`）。
- cargo 从不清理旧的增量缓存和旧产物，每个 lane 路径都会生成一份新的，曾涨到 360 GB。`pnpm prune:target` 删掉 3 天没用的部分和已删 lane 的预览目录，land 跑完 `cargo test` 后会自动跑一次；`--dry-run` 只看能省多少。
- 多个 lane 同时编译时不拖慢桌面（`scripts/build-load.mjs`）：`land-check`、`pnpm verify`、`pnpm build:exe` 以“低于正常”优先级运行，cargo 并行数默认是逻辑 CPU 的一半；环境里已设 `CARGO_BUILD_JOBS` 时以它为准。在 lane 里手动跑 `cargo test` / clippy 时也设 `CARGO_BUILD_JOBS`。
- Rust 版本固定在 `rust-toolchain.toml`，CI 的 `ci.yml` 写同一个版本，改时一起改。

## 清理和排障

- `../fly-island-lanes/` 里只放 lane。日志、临时工具和实验放在自己的 lane 或系统临时目录。
- land 不删除任何 lane：按进程判断曾经误删过经 magpie 跑命令的会话还在用的 lane。空闲的 lane 留着复用。
- 被遗弃的 lane（有没合入的工作，登记的会话已经不在，也没有任务写着它）：land 结束时和会话开始时输出里带 `⚠`，`pnpm mq:reconcile` 也会列出。问用户怎么处理，不要删。
- 真要删 lane 时：Windows 上 `git worktree remove` 常常删不掉 `node_modules`，会留下只剩 `node_modules` 的文件夹，分配时会把它当成已占用的编号。删完确认文件夹已经不在，残留的用 `cmd /c rmdir /s /q <路径>` 删除，它不会顺着 pnpm 的目录联接删到 store。
- land 不再在本机排队，排队在 GitHub 上：规则集要求 PR 基于最新的 `main`，工作流 `.github/workflows/update-behind-prs.yml`（`scripts/mq/updateBehind.mjs`）在 `main` 有新提交、有 PR 开启自动合并、任何一次 CI 跑完时，按开启自动合并的先后找出排在最前、能合入的 PR（跳过草稿、冲突和检查失败的），只在它落后时更新它的分支，后面的等着。更新用仓库 secret `PR_UPDATER_TOKEN`（只授权本仓库的 fine-grained token），因为用 Actions 自带的 token 推的提交不会触发 CI；它过期或被撤销时这个工作流会失败，PR 停在落后状态。`tests/scripts/mq.test.mjs` 在临时仓库里真的 land 一次（rebase、推分支、只开一个 PR、冲突时中止），用假的 `gh` 代替 GitHub；`mq:wait` 的合入、检查失败、冲突和落后也各有一条。
