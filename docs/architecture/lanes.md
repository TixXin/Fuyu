# lane 与合并队列

代理会话怎样开 lane、在 lane 里工作、合入 `main`，以及背后的设计和排障。必须遵守的几条在 [AGENTS.md](../../AGENTS.md)「Git 与协作」；本机的 `lanes` skill 按这份文档的顺序带着做。

工具是 [claude-code-merge-queue](https://github.com/funador/claude-code-merge-queue)，配置在 `claude-code-merge-queue.config.mjs`，Windows 上的问题由 `patches/claude-code-merge-queue@0.7.1.patch` 修复；lane 的分配和归属在 `scripts/lanes/`。

## 开 lane、进入 lane

- 会话在仓库目录里启动时：`claude -w <任务名>`，或在会话里调用 EnterWorktree（WorktreeCreate 钩子）。
- 钩子用不了时（例如会话不是从仓库目录启动的，magpie 会话就是这样）：在主工作区运行 `pnpm lane:open --as <会话名>`，最后一行是 lane 的路径，**紧接着 EnterWorktree(path=<lane 路径>) 进入它**。会话名用 ListAgents 里自己的名字。
- 接手别人的 lane（交接）：`pnpm lane:take <N> --as <会话名>`，再 EnterWorktree(path) 进入。对方还在用时会拒绝，确认对方不用了再加 `--force`。
- 不用了：`pnpm lane:release <N>`。lane 本身留着，下一个会话会复用。
- **不要手动 `git worktree add`**：那样不留归属记录，别的会话会把它当成空闲的 lane；`pnpm verify` 和 land 也会拒绝没有归属记录的 lane。

会话的当前目录必须在 lane 里，不要留在主工作区用绝对路径改 lane：那样状态栏显示 `main`，“有进程的当前目录在里面”这条在用判断失效，`cd` 失败时命令还会落进别人的 lane。

## 分配和归属

钩子和 `lane:open` 走同一套分配（`scripts/lanes/lanePool.mjs`）：

1. 会话自己的空闲 lane（当前所在的，或登记在它名下的）；
2. 没人用的 lane，编号从小到大；
3. 都没有才新建。

分到的 lane 重置到主工作区的 `HEAD`，保留 `node_modules` 和编译缓存，再跑一次 `pnpm install`。所以 lane 数量大致等于同时开的会话数。

`pnpm lane:list` 列出每个 lane 是谁的、为什么算在用。以下任一情况都算有人在用，不会分给别的会话：

- 登记的会话（`claude.exe`）还在运行；找不到它的进程时（命令经 magpie 跑），24 小时内登记过。`lane:open`、`lane:take`、`task:claim` 和每次 land 都会登记。
- 有「进行中」（没过期）或「待用户确认」的任务写着这个 lane。lane 编号会被复用，所以 lane 已登记给另一个会话时，写着它的旧认领算过期。
- 2 小时内有改动。
- 有进程的当前目录在里面（Windows 上这时文件夹改不了名）。

有未提交、未跟踪的文件，或有不在 `main` 上的提交的 lane，谁也分不到，也不会被重置。

归属记录有两份，都在 `.git/claude-code-merge-queue/`：

- `lane-owners.json`：合并队列自己读的，只写进程号已知的登记；
- `lane-sessions.json`：所有登记，带会话名和最近一次登记时间。

进程号未知的登记不能写进 `lane-owners.json`：合并队列会把空进程号当成“会话已退出”，2026-11-12 两次因此误删了还在用的 lane 21。

## 开发、验证、合入

1. 在 lane 里开发、提交。验证用 `pnpm verify`，它和 land 跑的检查相同：`pnpm check`，改到 `src-tauri/` 或 `plugins/` 时加 `cargo test`，只改 Markdown 时只跑文档检查。通过的代码树会被记住，land 时同一棵树不再重跑。
2. 一个功能单元完成并提交后，在 lane 里 `pnpm mq:land`，不用问用户。它排队、rebase 到 `origin/main`、跑 `scripts/land-check.mjs`、推送 `origin/main`，再把主工作区快进到新的 `main`，最后把 `dev` 推到同一提交（旧版本岛屿从 `dev` 读插件市场）。
3. land 失败不算完成：
   - rebase 冲突：它会自动中止。`git fetch origin main && git rebase origin/main` 解决冲突后重新 land。
   - 检查失败：修好再 land。计时类测试在机器负载高时偶尔失败，单独重跑通过就重新 land。
   - 输出里已经有 `landed`，只是快进主工作区失败：不要重复 land，在主工作区运行 `pnpm mq:sync`。
   - `dev` 同步看 `.git/land-sync-dev.log`，`exit=0` 才算成功；没成功时，确认是快进后 `git push --no-verify origin <提交号>:refs/heads/dev`。
4. 需要 release 可执行文件时，land 之后另外跑 `pnpm build:exe`（见「Rust 构建」）。

`main` 只通过 land 或在 GitHub 上合入 PR 移动。`.githooks/pre-push`（`core.hooksPath` 指向 `.githooks`）会拒绝直接推送 `main`，紧急情况才设 `CLAUDE_CODE_MERGE_QUEUE_EMERGENCY_PUSH=1`。主工作区留给用户（例如 `pnpm tauri dev`），保持干净、停在 `main` 上。

land 从 git 的 pre-push 钩子里跑检查，环境里带着 `GIT_DIR` 等变量。凡是在临时仓库里跑 git 的测试，开头都要去掉 `GIT_*` 变量，并确认 git 指向临时仓库：2026-11-12 一个测试因此把真实仓库改成了 `core.bare=true`，还往 `main` 上留下了作者 `t <t@t>` 的提交 `852a7aab`。

## 外部 PR

别人提的 PR（协作者的 PR 由仓库管理员来合时也一样）不走 land：land 推送前会 rebase，PR 的提交号随之改变，GitHub 认不出 PR 已合并（#10 就是这样，只能手动关闭）。

1. 在 lane 里 `git fetch origin pull/<编号>/head:pr-<编号>`，`git merge --no-ff pr-<编号>` 合到最新的 `origin/main` 上，按 AGENTS.md「验证」一节的范围跑 `pnpm check`、`cargo test`、clippy 和 `pnpm test:regression`。这一步只用来检查，合并提交不推送。
2. 检查通过后 `gh pr merge <编号> --merge` 由 GitHub 合并（保留提交号，PR 自动关闭），再在主工作区 `pnpm mq:sync`。`gh pr merge` 不经过本地 pre-push 钩子，所以第 1 步不能省；GitHub 上的 CI 会再跑一遍。
3. 要补的修改另开 lane，照常 land。PR 落后 `main` 太多、GitHub 报冲突时，请作者 rebase，或问用户怎么处理，不要改写别人的分支。
4. 外部提交可以带 Claude 署名行，`land-check.mjs` 只查作者是本机 `user.email` 的提交。

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
- land 不再自动删除 lane（补丁里的 `prune-lanes.js`）：按进程判断会误删经 magpie 跑命令的会话还在用的 lane。空闲的 lane 留着复用。
- 别人留下、没有会话在用的 lane（land 或会话开始时输出里带 `⚠`，`pnpm mq:reconcile` 会列出）：问用户怎么处理，不要删。
- 真要删 lane 时：Windows 上 `git worktree remove` 常常删不掉 `node_modules`，会留下只剩 `node_modules` 的文件夹，分配时会把它当成已占用的编号。删完确认文件夹已经不在，残留的用 `cmd /c rmdir /s /q <路径>` 删除，它不会顺着 pnpm 的目录联接删到 store。
- 补丁修了这些：Windows 上找不到 `pwd` 导致各 lane 的队列锁互不相通、调用 `pnpm` 时没开 shell、清理 lane 时路径对不上、没有 `lsof`、删不掉 `node_modules`，以及 WorktreeCreate 钩子改为调用 `scripts/lanes/lanePool.mjs`。升级这个包时要重新做补丁，并确认两个 lane 同时 land 会排队；`tests/scripts/lanes.test.mjs` 会发现钩子没有接上 `scripts/lanes`。
