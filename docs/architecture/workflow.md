# 开发与合入流程

代理会话怎样在本地开发、攒提交、合入 `main`，以及背后的取舍和排障。必须遵守的几条在 [AGENTS.md](../../AGENTS.md)「Git 与协作」。

## 为什么不再用 lane

2026-11-10 到 11-13 用过 lane：每个代理会话一个 git worktree 加一个分支，做完一个功能就 rebase、开 PR 合入（设计和排障见 git 历史里的 `docs/architecture/lanes.md`，调研见 [agent-lanes.md](../research/agent-lanes.md)）。2026-11-13 用户决定去掉（任务 F32），原因：

- **硬盘**：每个 lane 一份代码、一份 `node_modules`，Rust 编译缓存也跟着分；Windows 上 lane 加预览缓存二十多 GB，Mac 上不到一天就写满。
- **看不到改动**：改动都在 lane 里，主工作区的 `pnpm tauri dev` 要等 PR 合入才看得到；`dev:lane` 又是一份编译、一个岛。
- **跨机器撞号**：lane 编号每台机器各自从 1 数，任务认领只认编号，两台机器把对方的任务当成自己的（#153）。
- **PR 太碎**：一个小改动一个 PR，每个都跑一遍 CI。

## 现在怎么做

1. **所有会话都在主工作区、本地 `main` 上工作。** 用户的 `pnpm tauri dev` 也在这里，改动马上就能看到。不开 worktree，不切分支（切分支会冲掉别的会话正在改的文件）。
2. **只提交自己的文件**：`git add <具体文件>` 或 `git commit -- <文件>`，不用 `git add -A` / `git add .`，别的会话还没提交的改动不要带上。`.githooks/pre-commit` 把关：在 `main` 上不带文件名的 `git commit`（含 `-a`）会被拒绝，合并、cherry-pick、rebase 过程中的提交除外；确实要提交整个暂存区时设 `FUYU_COMMIT_WHOLE_INDEX=1`。两个会话不要同时改同一个文件：认领任务时写 `--scope`，`pnpm tasks conflicts` 能查出和别人声明的范围重叠的文件。
3. **攒着提 PR**，不是一个小改动一个 PR。下面任一条满足时 `pnpm mq:land --body <文件>`，不用问用户：
   - 一个任务做完（`pnpm tasks done <编号> --commit "<提交标题>"`，和功能改动在同一个提交里）；
   - 本地没推的提交有 5 个以上，或最早的一个超过 6 小时（`pnpm mq:pending` 会说）；
   - 另一台机器或协作者要用到这些改动、要发版、或者用户说「推一下」。

   顺手的小修复、文案、文档、任务认领先攒着，跟下一批一起走。
4. land 之后在后台 `pnpm mq:wait`：CI 的 `check` 通过、GitHub 合入后，它把本地 `main` 跟上 `origin/main`。PR 合入才算完成，CI 没过、冲突都不算。

### `pnpm mq:land` 做了什么

1. `git fetch origin main`；本地还没包含 `origin/main` 时 `git merge --no-edit origin/main`。**用 merge，不用 rebase**：rebase 要求工作区干净，别的会话正在改的文件会挡住它，而且会改写别的会话已经看到的提交。合并被别的会话没提交的文件挡住、两边的提交本身不冲突时，land 改在仓库内部合并（`git merge-tree` 加 `git commit-tree`），把那个合并提交推上去；工作区、索引和本地 `main` 都不动，本地 `main` 等 PR 合入、那些文件提交后由 `mq:wait` / `mq:sync` 跟上（F34）。两边的提交真的冲突时撤回这次合并、停下，自己 `git merge origin/main` 解决后再 land。合进来的提交改了 `pnpm-lock.yaml` 时先 `pnpm install`。
2. 把 `HEAD` 推到 `land/<GitHub 用户名>/<机器名>-<分支名>`（在 `main` 上就是 `…-main`），pre-push 钩子跑 `scripts/land-check.mjs --light`：Claude 署名行、已完成任务的提交记录、只改文档或版本号时的轻量检查。工作区里没提交的文件不会被推上去，land 会提一句有几个。
3. 没有开着的 PR 就开一个，有就沿用（上一批还没合入时，新提交跟着进同一个 PR）；开启自动合并（`--merge`，提交号不变）。
4. `--wait` 时在前台等合入，否则提示后台跑 `pnpm mq:wait`。

合入用 merge commit，所以合完以后本地 `main` 一般能直接快进；land 之后又有了新提交时，`mq:wait` / `pnpm mq:sync` 把 `origin/main` merge 进来（不改写本地提交）。

不在 `main` 上、在自己分支上的协作者也可以用 `pnpm mq:land`，做法一样。

### 验证

- 想在本机先验一遍：`pnpm verify`（`pnpm check`，改到 `src-tauri/` 或 `plugins/` 时加 `cargo test`；同一棵代码树通过过就不重跑）。land 本身不跑这些，由 PR 上 CI 的 `check` 把关。
- 多个会话共用一份代码：别的会话改到一半时，`pnpm check` 可能因为它的文件失败。先看失败是不是自己的文件；不是就等一会儿或问对方，不要去改别人的文件。
- 需要 release 可执行文件时另外跑 `pnpm build:exe`。

`main` 只通过在 GitHub 上合入 PR 移动。`.githooks/pre-push` 拒绝直接推送 `main`；GitHub 的规则集也拒绝（管理员只能在 PR 上绕过），紧急时用 `gh pr merge --admin` 合 PR。`CLAUDE_CODE_MERGE_QUEUE_EMERGENCY_PUSH=1` 只放行本机钩子。

land 从 git 的 pre-push 钩子里跑检查，环境里带着 `GIT_DIR` 等变量。凡是在临时仓库里跑 git 的测试，开头都要去掉 `GIT_*` 变量，并确认 git 指向临时仓库（2026-11-12 一个测试因此把真实仓库改成了 `core.bare=true`）。

## PR 的标题和正文

标题用英文，默认取这一批里第一个提交的标题；一批里有几样东西时用 `--title "<英文总标题>"`。正文用中文，由会话写进 scratchpad 里的一个文件，用 `--body <文件>` 交给 land；land 在末尾加一条分隔线和「由 `pnpm mq:land` 从 `main` 开出」。PR 已经开着时，给了 `--body` 或 `--title` 就换成新的，没给就不动。

一批里有几样东西时，「改了什么」按功能分小节写，CI 没过时好找是哪一处。每段不手动折行。

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
任务 D31 · issue #12
```

没给 `--body` 时，land 自动生成中文骨架：提示、提交标题列表、按目录归类的改动范围、关联任务，英文提交说明收进折叠块（`scripts/mq/prBody.mjs`）。

## 任务认领

- `pnpm task:claim <编号> --as <会话名> --scope <目录/,文件>`：先 `git fetch origin main`，本地或 `origin/main` 上已经有人认领就拒绝；认领只在本地提交（只含任务文件），随下一批推上去。
- 认领记 `owner`（会话名）和 `host`（机器名，和 land 分支名里的一样）。会话名和机器名都对上才算「你的」，所以两台机器上同名的会话不会把对方的任务当成自己的（#153）。旧任务文件里的 `lane` 字段照样能读，但不算任何人的。
- 认领后 24 小时任务文件没有新的交接或提交，就算失效（`pnpm tasks stale`），别人可以先发消息再 `--takeover` 接手。做得久的任务停下时 `pnpm tasks note` 留交接，也就续上了。
- `pnpm tasks done <编号> --commit "<提交标题>"`：本地 `main` 上有别的会话的提交，所以要明确写这次功能提交的标题（或已有的提交号）。

## 外部 PR

别人提的 PR 不走 land：直接在那个 PR 上开启自动合并。

1. 读说明和改动。CI 会在 PR 上跑全套检查。要看界面效果时，`git fetch origin pull/<编号>/head:pr-<编号>`，在一个临时的 worktree 里 `git merge --no-ff pr-<编号>` 到最新的 `origin/main` 上验证，验完删掉那个 worktree；不要在主工作区切分支。
2. 要合的：`gh pr merge <编号> --auto --merge`，等结果用 `pnpm mq:wait <编号>`。
3. fork 来的 PR：第一次贡献的人的 CI 要维护者在 PR 页面点批准；作者没勾 "Allow edits from maintainers" 时，落后了要请作者自己更新。
4. 要补的修改在主工作区照常提交、攒批。冲突时请作者 rebase，或问用户，不要改写别人的分支。
5. 外部提交可以带 Claude 署名行，`land-check.mjs` 只查作者是本机 `user.email` 的提交。

回复和任务的顺序见 [docs/tasks/README.md](../tasks/README.md)「GitHub PR」。

## Rust 构建

都在主工作区的 `src-tauri/target` 下（`scripts/build-dirs.mjs`）：

| 目录 | 谁用 |
|---|---|
| `debug` | 用户的 `pnpm tauri dev`。代理不要用，否则互相等锁、互相触发重编译 |
| `release` | `pnpm build:exe`；Mac 上的 `.app` 在 `bundle/macos/Fuyu.app` |
| `agents` | 代理的 `cargo test` / clippy（`land-check.mjs` 已经设好；手动跑时设 `CARGO_TARGET_DIR=src-tauri/target/agents`） |
| `publish` | `pnpm release` |

- `pnpm build:exe` 会把正在运行的 exe 改名挪开再写新的，不用让用户关岛屿。
- `pnpm prune:target` 删 3 天没用的增量缓存、本应用的旧产物，以及 lane 时期留下的 `lane-<N>`、`lane-build`；`verify` 跑完 `cargo test` 后会自动跑一次，`--dry-run` 只看能省多少。
- `land-check`、`pnpm verify`、`pnpm build:exe` 以「低于正常」优先级运行，cargo 并行数默认是逻辑 CPU 的一半（`scripts/build-load.mjs`）。
- Mac 上验证 Rust 改动：`cargo clippy --all-targets -- -D warnings` 和 `cargo test`，再交叉检查 Windows：`cargo clippy --all-targets --target x86_64-pc-windows-gnu -- -D warnings`。
- Rust 版本固定在 `rust-toolchain.toml`，CI 的 `ci.yml` 写同一个版本，改时一起改。

## 从 lane 迁过来（每台机器做一次）

1. 等每个 lane 里没合入的提交都合入（或用户决定不要），`git worktree list` 里只剩主工作区。
2. 删 lane：`git worktree remove <路径>`（Windows 上常删不掉 `node_modules`，残留的用 `cmd /c rmdir /s /q <路径>`，它不会顺着 pnpm 的联接删到 store），最后删掉空的 `<仓库>-lanes` 文件夹，`git worktree prune`，`git branch -D lane/<N>`。
3. `pnpm prune:target` 删掉 `src-tauri/target` 里的 `lane-<N>`、`lane-build`。
4. 用户级 `~/.claude/settings.json` 里删掉指向 `scripts/lanes/session-hint.mjs`、`session-end.mjs` 的 SessionStart / SessionEnd 钩子（脚本已经删了，留着会每次报错）；`.git/claude-code-merge-queue/` 里的 `lane-*.json` 可以删。

## 排障

- PR 落后于 `main`：工作流 `.github/workflows/update-behind-prs.yml`（`scripts/mq/updateBehind.mjs`）按开启自动合并的先后，只更新排在最前、能合入的那个 PR；它出问题时 `pnpm mq:wait --update` 自己更新。它用仓库 secret `PR_UPDATER_TOKEN`，过期时 PR 会停在落后状态。
- `mq:wait` 报告合入了，但本地 `main` 没跟上（工作区里没提交的文件挡住了合并）：等那些文件提交后 `pnpm mq:sync`。land 说「改在仓库内部合并」之后也是这种情况。
- land 说「合 origin/main 时冲突，已撤回」：这是两边的提交真的有内容冲突。上面 git 打出的「Your local changes … would be overwritten by merge」只说明普通合并被没提交的文件挡住，land 随后改在仓库内部合并也失败了才会走到这里，所以不用等别的会话提交。`git merge-tree --write-tree --name-only HEAD origin/main` 列出冲突的文件；按提示 `git merge origin/main` 解决、提交，再 land。冲突的文件正好有别的会话没提交的改动时，才需要等它提交。
- 一批里别人的提交让 PR 的 CI 没过（常见的是 Windows 上写的 Rust 在 `rust-macos` 上编译不过，本机查不出来）：先用 SendMessage 把失败的 job 和报错发给提交它的会话，并订阅它空闲。它空闲后那些文件仍没有改动、也没有回复时，被挡住的会话可以自己做最小的修复（只让检查通过，不改逻辑），单独提交、标题写清补的是哪个提交，再发消息告知对方；动手前先看那些文件有没有没提交的改动，有就不动。
- `tests/scripts/mq.test.mjs` 在临时仓库里真的 land 一次（合并 main、不改写本地提交、不带走没提交的文件、只开一个 PR、没提交的文件挡住合并时照样推出去、冲突时撤回），用假的 `gh` 代替 GitHub。
