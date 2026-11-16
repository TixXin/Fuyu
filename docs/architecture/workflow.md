# 开发与合入流程

代理会话怎样在本地开发、攒提交、合入 `main`，以及背后的取舍和排障。必须遵守的几条在 [AGENTS.md](../../AGENTS.md)「Git 与协作」。

## 为什么不再用 lane

2026-11-10 到 11-13 用过 lane：每个代理会话一个 git worktree 加一个分支，做完一个功能就 rebase、开 PR 合入（设计和排障见 git 历史里的 `docs/architecture/lanes.md`，调研见 [agent-lanes.md](../research/agent-lanes.md)）。2026-11-13 用户决定去掉（任务 F32），原因：

- **硬盘**：每个 lane 一份代码、一份 `node_modules`，Rust 编译缓存也跟着分；Windows 上 lane 加预览缓存二十多 GB，Mac 上不到一天就写满。
- **看不到改动**：改动都在 lane 里，主工作区的 `pnpm tauri dev` 要等 PR 合入才看得到；`dev:lane` 又是一份编译、一个岛。
- **跨机器撞号**：lane 编号每台机器各自从 1 数，任务认领只认编号，两台机器把对方的任务当成自己的（#153）。
- **PR 太碎**：一个小改动一个 PR，每个都跑一遍 CI。

## 现在怎么做

1. **所有会话都在主工作区、本地 `main` 上工作。** 用户的 `pnpm tauri dev` 也在这里，改动马上就能看到。不开 worktree，不切分支（切分支会冲掉别的会话正在改的文件）。例外只有发版目录 `../Fuyu-release`：主仓库的一个 detached worktree，停在 `origin/main` 上，只用来改版本号和跑 `pnpm release`，这样本地 `main` 上没推的提交和别人没提交的文件都不挡发版、也不会混进去（2026-11-15 起，用户定）。
2. **只提交自己的文件**：`git add <具体文件>` 或 `git commit -- <文件>`，不用 `git add -A` / `git add .`，别的会话还没提交的改动不要带上。`.githooks/pre-commit` 把关：在 `main` 上不带文件名的 `git commit`（含 `-a`）会被拒绝，合并、cherry-pick、rebase 过程中的提交除外；确实要提交整个暂存区时设 `FUYU_COMMIT_WHOLE_INDEX=1`。同一个文件里还有别的会话的改动时用 `pnpm mq:commit-part` 只带自己的那几处（见下面「同一个文件里只提交自己的改动」），不手写 `GIT_INDEX_FILE`。两个会话不要同时改同一个文件：认领任务时写 `--scope`，`pnpm tasks conflicts` 能查出和别人声明的范围重叠的文件。
3. **攒着提 PR**，不是一个小改动一个 PR。下面任一条满足时 `pnpm mq:land --yes --body <文件>`，不用问用户：
   - 一个任务做完（`pnpm tasks done <编号> --commit "<提交标题>"`，和功能改动在同一个提交里）；
   - 本地没推的提交到 10 个左右（`pnpm mq:pending` 会说），不再等更多会话报验；
   - 另一台机器或协作者要用到这些改动、要发版、或者用户说「推一下」。

   顺手的小修复、文案、文档、任务认领先攒着，跟下一批一起走，但一批不攒过 10 个左右（2026-11-16 起，用户定）：本地 `main` 是一条线，一个提交在 CI 上卡住，后面的全进不去；11-16 一批就这样从 18 个提交滚到 61 个（#640 → #645 → #648）。合入的 PR 卡住超过半小时，照下面「先合入前面的提交」截一刀。
4. land 之后在后台 `pnpm mq:wait`：CI 的 `check` 通过、GitHub 合入后，它把本地 `main` 跟上 `origin/main`。PR 合入才算完成，CI 没过、冲突都不算。

### `pnpm mq:land` 做了什么

land 会推送、开 PR 并开启自动合并，所以要写 `--yes` 才执行（2026-11-14 起，用户定）：不带参数或带 `--help` / `-h` 只显示用法；带了别的参数却没写 `--yes`，或写了不认识的参数，报错并显示用法，什么都不推。`node scripts/mq/mq.mjs` 不带命令、任何命令带 `--help` 也只显示用法。

1. `git fetch origin main`；本地还没包含 `origin/main` 时，在仓库内部把它合进来（`git merge-tree` 加 `git commit-tree`），把这个合并提交推上去；工作区、索引和本地 `main` 都不动，本地 `main` 等 PR 合入后由 `mq:wait` / `mq:sync` 跟上（F34、F58）。**用 merge，不用 rebase**：rebase 要求工作区干净，而且会改写别的会话已经看到的提交。**共用工作区里不跑普通的 `git merge`**（F58）：工作区有没提交的改动时，它先 `stash create` 存一份，合并失败就 `reset --hard` 再 `stash apply`；这一步撞上别的会话占着的 `index.lock`，改动就放不回来（2026-11-16 冲掉过 49 个文件，#688）。两边的提交真的冲突时什么都不动、停下，列出冲突的文件。
2. 把 `HEAD` 推到 `land/<GitHub 用户名>/<机器名>-<分支名>`（在 `main` 上就是 `…-main`），pre-push 钩子跑 `scripts/land-check.mjs --light`：Claude 署名行、已完成任务的提交记录、只改文档或版本号时的轻量检查。工作区里没提交的文件不会被推上去，land 会提一句有几个。
3. 没有开着的 PR 就开一个，有就沿用（上一批还没合入时，新提交跟着进同一个 PR）；开启自动合并（`--merge`，提交号不变）。
4. `--wait` 时在前台等合入，否则提示后台跑 `pnpm mq:wait`。

合入用 merge commit，所以合完以后本地 `main` 一般能直接快进；land 之后又有了新提交时，`mq:wait` / `pnpm mq:sync` 在仓库内部把 `origin/main` 合进来（不改写本地提交，也不跑 `git merge`）。快进只在快进会改到的文件（rename 的两边都算）都没有没提交的改动时才用 `git merge --ff-only`，否则也走下面的做法。动索引前先等别的进程放开 `index.lock`（最多约 30 秒，等不到就什么都不动、停下）。

`mq:sync`（`mq:wait` 合入后也调它）被工作区里别的会话没提交的文件挡住时，不再整个放弃（F51）：先在仓库内部合并，对挡路的每个文件拿「它没提交的内容、本地 `main` 的版本、合并后的版本」做三方合并（`git merge-file`）。全都合得上，就让本地 `main` 前进，没挡路的文件直接检出，挡路的文件写回「合并后的版本加上它没提交的改动」，`git diff` 里仍只看得到那个会话自己的改动。有一个合不上（和 `origin/main` 改了同一处、暂存区里有它、一边新增或删除了它）就什么都不动，列出文件和原因，`pnpm tasks dirty` 看归谁。

不在 `main` 上、在自己分支上的协作者也可以用 `pnpm mq:land`，做法一样。

### 先合入前面的提交：`pnpm mq:land --yes --upto <提交号>`

一批里后面的提交还没验完（或者在另一个平台上没过），想先把前面已经做完的合入时用（F51）。

**合入的 PR 卡住超过半小时**（CI 没过、等修复），负责合入的会话不等修好：`--upto` 到卡点之前最后一个验过的提交，先把前面的合进去，卡点和它之后的提交等修复后跟下一批走（2026-11-16 起，用户定）。卡着不动，后面报验的提交会一直往同一个 PR 里堆。

1. 提交号写本地 `main` 上的一个提交，带上到它为止、`origin/main` 上还没有的全部提交，**提交号不变**。前面别的会话的提交也会一起带上：本地 `main` 上的提交按规矩都是验过的。
2. 在仓库内部把这个提交和 `origin/main` 合起来（`git merge-tree`），推到 `land/<GitHub 用户名>/<机器名>-<分支名>-upto-<短号>`，开一个自己的 PR 并开启自动合并。工作区和本地 `main` 都不动。等结果用 `pnpm mq:wait <PR 号>`。
3. 合入后这些提交就是 `origin/main` 历史的一部分，本地 `main` 合 `origin/main` 时没有重复的提交，不会冲突。

### 紧急修复：`pnpm mq:land --yes --only <提交号…> --urgent`

`--only` 把挑出的提交在 `origin/main` 上重新做一份（F36），提交号变了。本地原提交和 `origin/main` 上的副本 git 认不出是同一个，本地后来又改同一批文件时，合 `origin/main` 就 add/add 冲突；2026-11-15 这样分叉到领先 110、落后 105（#525）。所以从 F51 起 `--only` 要加 `--urgent` 才执行，只留给等不了前面提交的紧急修复；平时用 `--upto`。

叠不上时拒绝、不开 PR，列出冲突的文件和本地没带上、也改过这些文件的提交。合入后 `pnpm mq:pending` 和整批 PR 的正文不再列它（按改动内容比对）。

### 提前看 CI：`pnpm mq:try [--wait]`

大家都在 Mac 上验证，Windows 才有的问题（路径短名、计时秒数）要到 PR 的 CI 才暴露。`mq:try` 把本地 `main`（在仓库内部合上 `origin/main`）推到 `try/<GitHub 用户名>/<机器名>-<分支名>`，CI 在 `try/**` 的推送上照样跑全套检查，不开 PR，不会合入；同一台机器再推一次会取消上一轮。`--wait` 在前台等结果。一个任务做完、准备 land 一大批之前跑一次（F51）。

**改 Rust 的任务，报验前先在这里把 Windows 的 `rust` 跑过**，报验时附上这次 run 的链接（2026-11-16 起，用户定）；新加 `host_service`、Tauri 命令、窗口的尤其要做。Mac 本地的 Rust 测试和 Windows 交叉 clippy 都查不出 Windows 链接期、运行期的问题：11-16 两次 Rust 测试程序一启动就报 0xc0000139，是 `host_service` 的方法体碰了 `AppHandle`（见 [v3-services.md](plugins/v3-services.md)），都到整批 PR 的 CI 才暴露，把整批卡住。`mq:try` 推的是整个本地 `main`，失败的不一定是自己的提交，看清失败的测试属于谁再报。run 的链接用 `gh run list --branch <try 分支> --limit 1 --json url -q '.[0].url'` 拿。

### 同一个文件里只提交自己的改动：`pnpm mq:commit-part`

`package.json`、`workflow.md` 这类热点文件里常常同时有两个会话的改动，`git commit -- <文件>` 会把别人的也带上（F44）。

```
pnpm mq:commit-part --list <文件…>
pnpm mq:commit-part -m "<标题>" [-F <说明文件>]
    --take <文件>:<编号,编号…>     只带这几处
    --match <文件>:<正则>          只带新增或删除的行匹配正则的那几处
    --as <文件>=<准备好的文件>      两个人的改动挨在一起、分不开时，直接给出要提交的内容
    -- <整个文件…>                 这些文件整个带上；新增、删除直接写，改名把新旧两个路径都写上
    [--dry-run]                    只显示会提交什么
```

1. 先 `--list` 看编号。「一处」是 `git diff -U0` 的一个最小块，两个人的改动隔开一行以上就能分开。编号按这一处增删的内容算，不按行号：列出之后别人在上面加了几行，编号不变；这一处本身变了或没了，命令拒绝并重新列出。
2. 一次提交里可以混着带：几个整文件加几个文件的一部分，例如 `pnpm tasks done` 挪动的任务文件加热点文件里自己的一处。参数都写在 `--` 前面，`--` 后面的都当成文件（`--dry-run` 除外）。
3. 一条总的保险：这次提交相对 `HEAD` 增删的每一行，都必须是工作区相对 `HEAD` 增删的行里已有的。`--as` 给的内容如果是照旧版本准备的，会删掉 `HEAD` 里有、工作区里也还在的行，这时拒绝；照 `git show HEAD:<文件>` 重新准备。
4. 提交在仓库内部完成，工作区不动：私有的临时索引里搭树，`commit-tree` 生成提交，带旧值核对的 `update-ref` 推进分支。搭的过程中 `HEAD` 被别的会话推进了，就照新的 `HEAD` 重来，最多 3 次；自己那几处已经在别人的提交里了就照实说，不重复提交。
5. 提交后对涉及的路径做 `git reset -q -- <路径>`，共用索引和新的 `HEAD` 一致：整文件是干净的，只带了一部分的文件里别人的改动照旧显示成没暂存的修改。索引被别的 git 进程锁着时重试几次，还不行就打印这条命令让你稍后自己跑，提交本身已经成功。
6. `commit-tree` 不触发 git 钩子。提交说明先用 `git hook run commit-msg` 过一遍，带 Claude 署名行的照样被拒绝；`pre-commit` 只查「写没写文件名」，这个命令每次都点名了路径。

**不手写 `GIT_INDEX_FILE`**。手写的做法有两个坑：临时索引是照 `read-tree` 那一刻的 `HEAD` 搭的，之后别的会话提交了，用它直接 `git commit` 会把那个提交的改动整个冲回去，没有任何提示；提交后共用索引还停在旧内容，`git status` 显示成一处已暂存的反向改动，`git merge` 也会被它挡住。`pre-commit` 看到自定义的 `GIT_INDEX_FILE` 会打印一句提醒，不拦。

二进制文件、符号链接只能整个带。合并、cherry-pick、rebase 的过程中不能用。

### 验证

- 想在本机先验一遍：`pnpm verify`（`pnpm check`，改到 `src-tauri/` 或 `plugins/` 时加 `cargo test`；同一棵代码树通过过就不重跑）。land 本身不跑这些，由 PR 上 CI 的 `check` 把关。
- 多个会话共用一份代码：别的会话改到一半时，`pnpm check` 可能因为它的文件失败。先看失败是不是自己的文件；不是就等一会儿或问对方，不要去改别人的文件。
- 浏览器回归页 `pnpm test:regression [页面名中的词] [--update-snapshots]`：自带 Vite，用无头 Chrome / Edge 跑 `tests/regression/` 下全部回归页（给了词就只跑页面名里带它的）并汇总结果。每页检查通过后再把页面切成浅色岛，文字对比度低于 3:1 就算失败。深色、浅色两轮的 DOM 都和 `tests/regression/snapshots/` 里的快照逐行比对，不一致或没有快照就失败并打印差异；界面本该变时加 `--update-snapshots` 重写，规范化规则见 `scripts/regression/snapshots.mjs`。Mac 上找 `/Applications` 里的 Chrome、Edge 或 Chromium，都没有时设 `CHROME_PATH` 指向浏览器的可执行文件。
- 回归页逐行比对 DOM 快照（`tests/regression/snapshots/`，2026-11-15 起，E36.2.2）：改界面的提交要把 `pnpm test:regression <页面名中的词> --update-snapshots` 更新后的快照一起带上，新加的回归页也要带上它的快照；漏了 CI 的 `regression` 会失败，挡住整批 land。更新前看一眼差异，只该有自己改的那几处。
  - 快照存的是页面稳下来之后的样子，所以回归页要等自己最后一步的动画、定时消失的提示都结束了再报通过（D73）。运行器有两道保险：比对不一致时等 1 秒重抓一次，一致就算通过，并打印 `snapshot settled late`，看到这一行要去修那一页；`--update-snapshots` 写入前隔 1.5 秒复抓，两次不一样就不写，报 `DOM is still changing`，没有放行名单（D74）。等定时消失的状态用轮询：每 50 毫秒查一次，等到期望的值再检查，不写固定等待（D76）。
- 回归页运行器退出时不留进程（D73）：无头 Chrome 用调试管道连接，运行器被杀掉（包括 `kill -9`、工具超时）它自己退出；Vite 在运行器进程里跑。被 `kill -9` 时只会留下临时目录 `fly-regression-*`，下次启动时删掉一天以前的。
- Mac 上回归页在跑的那几分钟里，无头 Chrome 在系统里是 `com.google.Chrome` 的另一个实例，`open <文件>` 打开的页面有可能进了它而看不见（观察到过一次，没能复现）。碰到时等回归页跑完再 `open`；要彻底避开，设 `CHROME_PATH` 让回归页用另一个浏览器，例如 `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`。
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
- 机器名只在 `scripts/machine-name.mjs` 里算，第一次用到时记进本地 git 配置 `fuyu.machine`，以后照用，不跟着网络或改电脑名变（F47：Mac 没设固定 HostName 时，`os.hostname()` 会随网络换名字）。第一次的取值：Mac 上是 `scutil --get LocalHostName`，其他系统是 `os.hostname()`，取第一段、转小写、最多 24 个字符。看当前的值用 `git config fuyu.machine`，要换名字就改它。
- 这台机器用过的旧名字记成别名：`git config --local --add fuyu.machineAlias <旧名字>`，可以有多个。任务的 `host` 等于本机名或任一别名都算本机；`pnpm mq:wait` 不写 PR 号时，在本机名和别名的 land 分支里取最新的那个 PR。别名只在本机有用，不进仓库；换了机器名（包括重新 clone 后名字和以前不一样）就把旧名字加成别名。
- 认领后 24 小时任务文件没有新的交接或提交，就算失效（`pnpm tasks stale`），别人可以先发消息再 `--takeover` 接手。做得久的任务停下时 `pnpm tasks note` 留交接，也就续上了。
- `pnpm tasks done <编号> --commit "<提交标题>"`：本地 `main` 上有别的会话的提交，所以要明确写这次功能提交的标题（或已有的提交号）。
- 查 GitHub issue：`pnpm issue <编号…>` 打印正文、全部回复和对应的任务；不带编号是列表 `pnpm issue [--untracked] [--all|--closed] [--limit N]`，每行带对应任务和状态，`--untracked` 只列还没建任务的。都能加 `--json`。脚本在 `scripts/issues/`，走 `gh`（没有 `--help`）。

## 两台机器

Mac 和 Windows 各有一份本地 `main`，只通过 `origin/main` 看到对方：没提交的文件、本地没推的提交，另一台都看不到（F31）。

- **开工和合入**：每台机器开工前、land 前各 `pnpm mq:sync` 一次。一批合入之后，另一台同步了才看得到。
- **同一个任务不两台同时做**：要换机器，先在这台 `pnpm tasks note` 留交接并 land，合入后另一台同步了再接手（认领怎么区分机器见上一节）。
- **两边共用的代码**：在一台上改，land 前在本机做另一个平台的交叉检查（见「Rust 构建」的交叉 clippy），CI 在两个系统上各跑一遍；另一台同步后做真机验证。
- **交接不靠消息**：写进任务文件，随提交合入，另一台同步后读。

**给另一台机器的提示词**：要做的事、实测清单先写进任务文件或 issue 并合入，提示词只写三样，不重复任务里的内容：

```text
先 pnpm mq:sync，确认本地 main 已经跟上 origin/main。
加载 fuyu-task，pnpm tasks show <编号> 读全文和交接（带 issue 的再 pnpm issue <N>）。
这次要做：<一两句>。结果写回 <任务文件的备注 / issue #N 的回复>。
```

**不报错的平台差异**，在一台上正常、到另一台或 CI 上才出问题：

- 测试按 `\n` 匹配仓库文件的内容时，先把 `\r\n` 换成 `\n`：Windows CI 检出来是 CRLF（388adf2b）。
- 测试在临时仓库里提交（包括被测代码自己跑的 `rebase`、`merge`），要在临时仓库里设 `user.name`、`user.email`：Mac 的 git 能从主机名猜出身份，Windows CI 猜不出来（24d98155）。
- 会话里或 `!` 跑的命令没有终端，`gh secret set` 读不到输入，静默存成空值；要请用户在真终端里粘贴。
- 有几个测试文件带 `skip: process.platform !== "win32"`，Mac 上 `pnpm test` 全绿不代表它们跑过，要提前看用上面的 `mq:try`。
- Mac 上 Claude Code 会话里的 `grep` 是包了一层的 ugrep，复杂正则报 `exceeds complexity limits`；改用 `rg` 或 `/usr/bin/grep`。

**每台机器各有一份、不进 git 的东西**：

| 东西 | 在哪 | 说明 |
|---|---|---|
| updater 签名私钥 | `~/.tauri/fuyu/`，两台都有 | [updater.md](../features/updater.md)「签名密钥」 |
| 插件签名私钥 | 只在 Windows | [plugins/drafts/README.md](../../plugins/drafts/README.md) |
| 机器名和别名 | 本地 git 配置 `fuyu.machine`、`fuyu.machineAlias` | 上一节 |
| `gh` 登录 | 每台各 `gh auth login` 一次 | land、`pnpm issue` 都靠它 |
| Claude 的项目记忆、`~/.claude/rules`、用户目录下的 skill | `~/.claude/` | 只在本机生效；属于项目的规则写进 `AGENTS.md` 或 `.claude/skills/` |
| 预览面板的启动配置 | `.claude/launch.json`（`.gitignore` 排除） | |
| 开发版数据目录 | 每台各一份正式数据的副本 | 「开发版和正式版同时开」 |
| 重任务队列 | `~/.cache/fuyu-heavy/` | 「Rust 构建」 |

## 没提交的文件

大家共用一个工作区，没提交的改动别人都看得到，也都会被它影响：本地 `main` 合不进 `origin/main` 上改了同一个文件的提交，会话和用户的 `pnpm tauri dev` 一直停在旧代码上；别人的检查跑的是混在一起的工作区，会因为你没提交的代码失败。2026-11-15 一天里工作区一度积了 129 个没提交的文件，本地 `main` 落后 `origin/main` 55 个提交（F41，issue #490）。所以：

- **热点文件改完就提交**：`AGENTS.md`、`package.json`、`pnpm-lock.yaml`、`docs/architecture/` 下的 `platforms.md` / `contracts.md` / `data-storage.md` / `overview.md` / `workflow.md`、`src-tauri/Cargo.toml` / `Cargo.lock` / `src/lib.rs` / `capabilities/`、`src/windows/settings/searchIndex.json`、`src/i18n/types.ts`、两份行数和颜色白名单。这些几乎每个功能都会碰，挂着不提交最容易挡住本地 `main` 跟上。改完、能独立成立就单独提交（文档、登记一行命令、注册一个模块都算），不等整个功能做完；列表在 `scripts/tasks/taskDirty.mjs` 的 `HOT_FILES`。
- **停下就收拾**：做完的提交；做不完的 `pnpm tasks note` 留交接，写清哪些没提交的文件是自己的。不要让改动挂在工作区里没有主人。
- **暂存区是共用的**：只用 `git commit -- <文件>` 提交自己的文件，文件里混着别人的改动时用 `pnpm mq:commit-part`（它提交后会把共用索引对齐）；`git add` 了别人的文件、或别人暂存的文件被自己带进提交时，马上撤回（`git reset -q -- <文件>` 只动索引，不动工作区）。
- **清点**：`pnpm tasks dirty` 把没提交的文件按进行中任务的 `--scope` 归组，单独列出热点文件、不在任何人认领范围里的、超过 3 小时没动的（`--quiet-hours <N>` 改）和已经暂存的；`--json` 给脚本用。总会话合入一批之后、或者本地 `main` 跟不上时跑一次，没有主人的去找对应的会话，找不到的问用户。

## 外部 PR

别人提的 PR 不走 land：直接在那个 PR 上开启自动合并。

1. 读说明和改动。CI 会在 PR 上跑全套检查。要看界面效果时，`git fetch origin pull/<编号>/head:pr-<编号>`，在一个临时的 worktree 里 `git merge --no-ff pr-<编号>` 到最新的 `origin/main` 上验证，验完删掉那个 worktree；不要在主工作区切分支。
2. 要合的：`gh pr merge <编号> --auto --merge`，等结果用 `pnpm mq:wait <编号>`。
3. fork 来的 PR：第一次贡献的人的 CI 要维护者在 PR 页面点批准；作者没勾 "Allow edits from maintainers" 时，落后了要请作者自己更新。
4. 要补的修改在主工作区照常提交、攒批。冲突时请作者 rebase，或问用户，不要改写别人的分支。
5. 外部提交可以带 Claude 署名行，`land-check.mjs` 只查作者是本机 `user.email` 的提交。

本仓库 2026-11-10 起已脱离 `flyl1u/fly-island` 的 fork 网络：从上游 fork 出来的仓库不能再向本仓库提 PR，外部贡献者要从 `TixXin/fuyu` fork。也不从上游同步或合并提交。

回复和任务的顺序见 [docs/tasks/README.md](../tasks/README.md)「GitHub PR」。

## Rust 构建

都在主工作区的 `src-tauri/target` 下（`scripts/build-dirs.mjs`）：

| 目录 | 谁用 |
|---|---|
| `debug` | 用户的 `pnpm tauri dev`。代理不要用，否则互相等锁、互相触发重编译 |
| `release` | `pnpm build:exe`；Mac 上的 `.app` 在 `bundle/macos/Fuyu.app` |
| `agents` | 所有代理共用的 `cargo test` / clippy（`land-check.mjs` 已经设好；手动跑时设 `CARGO_TARGET_DIR=src-tauri/target/agents`）。不另开 `agents-<名字>` 之类的目录 |
| `publish` | `pnpm release` |

- `pnpm build:exe` 会把正在运行的 exe 改名挪开再写新的，不用让用户关岛屿。
- `pnpm prune:target` 删 3 天没用的增量缓存、本应用的旧产物，以及 lane 时期留下的 `lane-<N>`、`lane-build`；`verify` 跑完 `cargo test` 后会自动跑一次，`--dry-run` 只看能省多少。
- **全机器排队**（2026-11-15 起，F40）：同一台机器上同时最多跑 `FUYU_HEAVY_SLOTS` 个重任务（默认逻辑 CPU ÷ 5，10 核的 Mac 是 2 个），其余的排队，每 30 秒打印正在跑的是谁、自己排第几。`pnpm build:exe`、`pnpm verify`、`pnpm test:regression` 自动排队；别的重命令写成 `pnpm heavy [--label <名字>] -- <命令…>`，例如 `pnpm heavy -- cargo test --manifest-path src-tauri/Cargo.toml`。队列在 `~/.cache/fuyu-heavy/`，进程退出（包括被杀）后它占的位置会自动清掉。起因是 20 多个会话同时编译，负载到了 200 多（issue #448）。
- **同一个构建目录一条道**（2026-11-15 起）：cargo 给每个构建目录加锁，两个任务编同一个目录时后一个只能干等，还白占一个名额。所以 heavy 按构建目录分道：同一道同时只跑一个，排在它后面的同道任务不挡别的道。`build:exe` 是 `target:release`，`verify` 是 `target:agents`；`pnpm heavy -- cargo …` 按 `--target-dir`、`CARGO_TARGET_DIR` 和 `--release` 自动认道（例如 agents 目录的 `cargo test` 是 `target:agents`），别的命令要分道时写 `--lane <名字>`。
- **钩子**：`scripts/heavy/gate.mjs` 登记在 `.claude/settings.json`，拦下三种命令：没经过排队的 `cargo build/test/check/clippy/run` 和 `tauri build`；把 `CARGO_TARGET_DIR` 设成 `agents`、`debug`、`release` 以外的目录；`cd` 进临时目录里的仓库副本再编译（副本没有 `rust-toolchain.toml`，也用不上缓存，每份都从零编译）。别的会话没提交的改动让检查报错时，在主工作区照样跑，交接里写明哪些失败不是自己造成的。确实要绕过时，用户可以在会话环境里设 `FUYU_HEAVY_GATE=off`。
- **整批 land 一次只跑一个**：`pnpm mq:land` 在 `.git/fuyu-land.lock` 里记下自己。已经有一个整批 land 在跑时，后来的直接退出（退出码 0），提示它开始前的提交会一起带上去；`--only` 不受影响。
- **会话数**：每个主 agent 同时最多跑 2 个要编译的子会话；全机器同时改代码的会话控制在 6 个左右，超过就让后面的排队（调研、写文档、只读代码的不算；fuyu-lead skill 里也写了）。编译名额只有 2 个，写代码的会话再多也只是在排队，没提交的文件反而越积越多（F41）。
- `land-check`、`pnpm verify`、`pnpm build:exe` 以「低于正常」优先级运行，cargo 并行数默认是逻辑 CPU 的一半（`scripts/build-load.mjs`）。Mac 上还用 `taskpolicy -b` 把它们放进后台档（只用能效核、磁盘读写让路），并行数等于能效核个数，编译变慢但前台不卡。环境里已设 `CARGO_BUILD_JOBS` 时以它为准。会话手动跑 `cargo test` / `clippy` 不经过这里，Mac 上用 `taskpolicy -b cargo test …` 跑。
- Mac 上验证 Rust 改动：`cargo clippy --all-targets -- -D warnings` 和 `cargo test`，再交叉检查 Windows：`cargo clippy --all-targets --target x86_64-pc-windows-gnu -- -D warnings`。
- Rust 版本固定在 `rust-toolchain.toml`，CI 的 `ci.yml` 写同一个版本，改时一起改。

## 门禁钩子

`scripts/gate/gate.mjs` 是登记在 `.claude/settings.json` 的 PreToolUse 钩子（F42）。它照一张表（`scripts/gate/rules.mjs`），在会话第一次做某类操作前拦一次，提示先读规则文件或加载 skill，重做就放行。只对 Claude Code 生效，Codex、opencode 的会话靠根 `AGENTS.md`。

| 行 | 什么时候拦 | 要求 |
|---|---|---|
| `fuyu-agent-harness` | 写各家 AI 代理的接入点文件，或在 `src-tauri/src/agent_status/` 下新建 `.rs` | 加载过这个 skill |
| `src-rules` | 写 `src/` | 读过 `src/AGENTS.md` |
| `src-tauri-rules` | 写 `src-tauri/`（不含 `target/`、`gen/`） | 读过 `src-tauri/AGENTS.md` |
| `fuyu-release` | 跑 `pnpm release`、`release:version`、`release:prebuild`，或直接跑 `scripts/release/` 下的脚本 | 加载过这个 skill |
| `fuyu-video` | 写 `video/` | 加载过这个 skill |
| `fuyu-lead` | 一个会话第一次用 `start_session` 按用户要求派出会话 | 加载过这个 skill |
| `fuyu-task` | `pnpm task:claim`、`pnpm tasks add … --claim` | 加载过这个 skill |
| `fuyu-skill-writing` | 写 `.claude/skills/` | 加载过这个 skill |

- **拦一次**：按（会话，子代理，规则）各记一个标记文件，在系统临时目录的 `fuyu-gate/<会话>/<main 或子代理 id>/<规则 id>`。第一次碰到某条规则时查一次会话记录：已经满足就记下、放行，没满足就记下、拦这一次。之后不再查，所以上下文压缩后不会重新拦。一次操作碰到几条规则时合成一条提示。
- **「读过」**：会话记录里有 Read 工具读这份文件，或 Bash / PowerShell 里用 `cat`、`head`、`tail`、`sed -n`、`less`、`more`、`bat`、`nl`、`awk`、`Get-Content` 读它，或它作为规则文件被自动加载。不看读了多少行；`wc`、`ls`、`grep`、`git add` 不算，别的文件里提到它的路径也不算。
- **子代理**单独算：它自己的记录在 `<主会话记录去掉 .jsonl>/subagents/agent-<id>.jsonl`，主会话读过不等于它读过。
- **写入怎么认**：Edit、Write、MultiEdit、NotebookEdit 看文件路径。Bash / PowerShell 看写到哪里：重定向和 heredoc、`tee`、`sed -i`、`perl -i`、`mv`、`cp`、`rm`、`git mv`、`git rm`、`git apply` 后面跟的补丁、内联的 python / node（`python3 - <<'PY'`、`node -e`）里的写文件调用、PowerShell 的 `Set-Content`、`Out-File` 这一类。`cd` 和同一条命令里赋的变量会跟着算。跑现成的脚本文件去改、运行时拼出来的路径、`pnpm settings:index` 这类生成命令认不出来。只是在命令里提到某个文件（`--scope` 参数、`grep`、`git log -- <文件>`）不算写入。
- **skill 还没签入的行不生效**：`.claude/skills/<名字>/SKILL.md` 不在就跳过。被门禁要求的 skill 不能设成只能由用户调用，否则被拦下的会话加载不了。
- **加一行**：在 `scripts/gate/rules.mjs` 的 `RULES` 里加一项：`id`；`when` 写 `paths`（目录以 `/` 结尾，`except` 排除子目录）、`commands`（如 `"pnpm tasks add --claim"`，按实际执行的命令逐词比对，`--` 开头的是必须带的参数）加可选的 `scripts`（直接运行这个目录下的脚本）、或 `tool`（工具名，`input` 是要对上的参数）三种之一；`require` 写 `{ skill }` 或 `{ read }`；`hint` 是提示的前半句，`{target}` 换成命中的文件或命令。再在 `tests/scripts/gate.test.mjs` 加一条。要拦新的工具时，`.claude/settings.json` 里这个钩子的 `matcher` 也要加上工具名。
- **关掉**：会话环境里设 `FUYU_GATE=off`。门禁自己出错（读不到输入、写不了标记文件）时一律放行。删掉某个标记文件，那条规则对那个会话会重新查一次。
- 所有会话的每次工具调用都经过它，改 `scripts/gate/` 先跑 `node --test tests/scripts/gate.test.mjs`，改完马上提交。

## 开发版和正式版同时开

`pnpm tauri dev` 起的开发版和安装的正式版可以同时开着（F38、F39）。调试构建默认用独立身份 `com.tixxin.fuyu.lane-1`（`src-tauri/src/dev_lane.rs`），单实例锁、数据目录、WebView2 的数据目录和进程组、凭据都和正式版分开：

- 启动前只停本仓库 `src-tauri/target/debug/` 里的 `fuyu.exe`（`scripts/stop-running-island.mjs` 按可执行文件路径判断），安装的正式版和别处的岛屿不动。
- 岛默认放在中间；只有正式版在跑、并且开发版放中间会和正式版的岛撞上时，才让到屏幕左侧四分之一处（F39.6，`src-tauri/src/dev_lane/beside.rs`）。正式版在不在跑看它的单实例锁：Windows 查命名 mutex `com.tixxin.fuyu-sim`；Mac 的锁是 `/tmp/com_tixxin_fuyu_si.sock`，连上去会让正式版把岛弹出来，所以只看这个文件在不在，再加上正式数据目录的 `fuyu.lock` 是本机、心跳没过期。正式版的岛在哪：用 `fuyu.lock` 里的 pid 找它宽 820 的舞台窗口。正式版在跑但找不到窗口（例如收进了托盘）时照旧让开。开发版每 3 秒看一次，结果变了就滑到新位置。设 `FOCUSD_DEV_LANE_CENTER=1` 则始终放中间。
- 想再开一个互不相干的开发版，设 `FOCUSD_DEV_LANE=<2–999>`。
- 要用正式身份和正式数据跑调试版（调数据迁移、开机自启这类只有正式身份才做的事），设 `FUYU_DEV_SHARED_IDENTITY=1` 再 `pnpm tauri dev`。这时和 F38 之前一样：启动前停掉所有岛屿，不能和正式版同时开。两个变量 `stop-running-island.mjs`、`pnpm lab` 和 Rust 读的是同一套规则。
- `cargo test`、release 构建和通知验证（`FOCUSD_VERIFY_NOTIFICATIONS`）不受影响；`tauri build --debug` 出的调试版也是独立身份。

数据是正式数据的一份副本（F39.3）：开发版第一次启动时把正式数据目录（`FUYU_HOME` → `home.json` 指针 → `~/.fuyu`）复制到 `%APPDATA%\com.tixxin.fuyu.lane-<n>`，之后各改各的，不同步。

- 不带过来的：锁文件和数据目录指针、两个迁移状态文件（带着 `home-migration.json` 会把 Agent 钩子改指向开发版目录）、审批 / 本地接口 / 实验台的端口配置、`agent-` 开头的文件和文件夹（钩子脚本的产物、远程主机配置）、钩子脚本、SSH 隧道配置、微信的状态、缓存，以及剪贴板历史和图片、截图（用户 2026-11-15 定）。清单在 `src-tauri/src/dev_lane/data_copy.rs` 的 `carried`。
- 复制过来的 `settings.json` 里关掉了 QQ、微信、邮件提醒和手机推送，免得同一件事两个岛各提醒一次；要在开发版里调这些功能，到设置里再打开。
- 目录里原来就有数据（例如 lane 时期留下的）时，旧目录和旧的 WebView2 数据目录改名成 `….before-copy-<毫秒时间>` 留着，不删；确认不要了自己删。
- 做没做过记在开发版数据目录的 `dev-copy.json`（`{ credentials, data, from, at }`）。想重新复制一份：关掉开发版，删掉 `dev-copy.json` 再启动（现在的开发版数据会被改名留着）。

凭据是分开的（F39.2）：开发版的邮箱、日历、翻译、套餐用量、Bark 和插件凭据存在带 `lane-<n>` 的服务名下，第一次启动时从正式版复制一份，之后在开发版里删改不影响正式版；正式版后来新加的账号不会自动过来（把 `dev-copy.json` 里的 `credentials` 改成 `false` 再启动会补上没有的）。Mac 上不复制，要重新输入。

Agent 状态从正式数据目录只读地读（F39.3）：钩子脚本把状态写在自己所在的目录，也就是正式数据目录；开发版读那里的 `agent-status.json`、运行标记、通知和会话记录，所以看得到「运行中」「等你确认」，但不在那里建目录、不删文件。开发版里「清除状态」、改开机自启、搬数据目录都会拒绝。「安装/修复」可以点（B65，2026-11-16 起，用户要求）：装的是正式版的钩子，脚本写进正式数据目录，Claude Code 审批钩子用正式版 `agent-approval.json` 的端口和 token，和正式版自己点的结果一字不差，开发版关掉后钩子照样能用。开发版也不注册 `fuyu://` 链接，启动时不自动升级 `~/.claude` 里已装的回复标记规则（在设置里手动开关回复标记仍然会改那份文件）。开发版自己记的东西（见过的会话、定位日志、远程主机）在它自己的目录。

怎么认出开发版（F39.1）：收起的岛左上角、展开面板顶部中间、设置窗口顶部各有一个灰色的「DEV」，托盘提示是「Fuyu 开发版」。贴边收成细条时没有地方放字，看托盘。开发版不检查也不安装更新（装的会是正式版的安装包），开机自启的开关是禁用的。

抢同一个系统资源时谁让谁（F39.4）：开发版设置窗口顶部、「DEV」旁边有一个两档切换，默认「正式版优先」，选择存在开发版数据目录的 `dev-priority.json`。

- 开发版每 0.1 秒探测一次正式版在不在：正式版（包括已安装的 0.3.8）运行时持有单实例插件的互斥量 `com.tixxin.fuyu-sim`，能打开它就是在跑，不需要正式版配合（`src-tauri/src/coexist/`）。
- 「正式版优先」且正式版在跑时，开发版让出：五处全局快捷键（翻译、剪贴板、截图、审批、插件）都不注册，Win+V、PrintScreen、小键盘截图键不接管，QQ、微信、邮件有新消息时不弹横幅（列表照常更新）。正式版一退，开发版在零点几秒内全部拿回；正式版再开，又让出。切换旁边的文字显示当前是哪种情况。
- 「开发版优先」时反过来，正式版让（F39.5，正式版要是带这段代码的版本，0.3.8 没有）：开发版持有互斥量 `com.tixxin.fuyu.dev-first`；正式版每 0.5 秒探测一次，在就放掉五处快捷键、系统键和提醒横幅，停掉审批端口上的监听，然后持有 `com.tixxin.fuyu.release-yielded` 表示已经放手。开发版看到后重新注册快捷键，并在正式版的审批端口上用正式版的 token（只读读取正式数据目录的 `agent-approval.json`）多开一路监听，所以 Agent 的审批请求到开发版。开发版拨回、退出或崩溃时互斥量消失，正式版在 0.5 秒内拿回快捷键并重新绑定原来的审批端口（先重试 5 秒，实在绑不上才换端口）。正式版太旧不会让时，切换旁边会写明，两边照旧互相抢。
- 正式版里的监视线程只在本机 `%APPDATA%` 下有 `com.tixxin.fuyu.lane-*` 目录时才启动，没有开发版数据的机器上没有这个线程。
- 平时端口不用让：开发版的审批端口和本地接口端口固定是「首选端口 + 编号」（lane-1 是 47831、39272），不碰正式版的 47830、39271，所以谁先启动都不影响正式版的端口和 Agent 钩子里写的地址。只有上面「开发版优先」且正式版已经放手时，开发版才额外接管正式版的审批端口；本地接口不交接，一直在正式版。`pnpm lab` 用开发版自己的端口。
- 只在 Windows 上有；Mac 上没有这个切换，开发版不让出。

先开开发版、再开正式版：正式版启动那一刻开发版还没来得及放手（最多 0.1 秒）。带 F39.5 的正式版在启动后 1 秒、3 秒各重新注册一次快捷键（恢复时也一样），不用管；已安装的 0.3.8 不会重试，翻译和剪贴板的快捷键可能失效，到它的设置里把对应功能关了再开即可。

还没解决的：

- **本地接口不交接**：「开发版优先」时 39271 仍是正式版在答，外部脚本和插件连到的是正式版。
- **微信提醒发给插件的事件**：让出时横幅不弹，但 `messages.received` 仍会发给开发版里的插件。
- **插件各跑一份**：复制过来的插件在两个岛里各起一个进程。

2026-11-15 在 Windows 上实测：安装的正式版 0.3.8 开着时启动开发版，旧的 `lane-1` 数据和 WebView2 数据被改名保留，正式数据复制过来，排除的文件不在，`settings.json` 里四个提醒开关是关的；`~/.claude/settings.json` 和 `~/.codex/config.toml` 的钩子没有指向开发版目录，正式数据目录原样。Mac 上没有实测（Mac 上不改名 WebView 数据、不复制凭据）。

## 从 lane 迁过来（每台机器做一次）

1. 等每个 lane 里没合入的提交都合入（或用户决定不要），`git worktree list` 里只剩主工作区。
2. 删 lane：`git worktree remove <路径>`（Windows 上常删不掉 `node_modules`，残留的用 `cmd /c rmdir /s /q <路径>`，它不会顺着 pnpm 的联接删到 store），最后删掉空的 `<仓库>-lanes` 文件夹，`git worktree prune`，`git branch -D lane/<N>`。
3. `pnpm prune:target` 删掉 `src-tauri/target` 里的 `lane-<N>`、`lane-build`。
4. 用户级 `~/.claude/settings.json` 里删掉指向 `scripts/lanes/session-hint.mjs`、`session-end.mjs` 的 SessionStart / SessionEnd 钩子（脚本已经删了，留着会每次报错）；`.git/claude-code-merge-queue/` 里的 `lane-*.json` 可以删。

## 改写已推送的提交

已经合入 `main` 的提交不改写。唯一的例外是用户明确要求去掉已推送提交里的 Claude 署名行，做之前要用户同意：

1. 先通知其他会话。
2. 用 `git filter-branch --msg-filter` 按字节过滤（例如 Python 读 `sys.stdin.buffer`，否则 Windows 会把所有提交说明的换行改成 CRLF）。
3. 改写后核对每个提交的 tree 不变，用 `git update-ref` 切换。
4. `main` 用 `--force-with-lease=main:<原提交>` 强推一次，要设 `CLAUDE_CODE_MERGE_QUEUE_EMERGENCY_PUSH=1`。规则集不允许强推，所以先把 `main protection` 里管理员的绕过方式临时改回 `always`，推完立刻改回 `pull_request`。

## 排障

- PR 落后于 `main`：工作流 `.github/workflows/update-behind-prs.yml`（`scripts/mq/updateBehind.mjs`）按开启自动合并的先后，只更新排在最前、能合入的那个 PR；它出问题时 `pnpm mq:wait --update` 自己更新。它用仓库 secret `PR_UPDATER_TOKEN`，过期时 PR 会停在落后状态。
- `mq:wait` 报告合入了，但本地 `main` 没跟上：`mq:sync` 会列出挡路的文件和原因（没提交的改动和 `origin/main` 改了同一处这类），等那些文件提交后再 `pnpm mq:sync`。land 说「改在仓库内部合并」之后也是这种情况。
- land 说「本地的提交和 origin/main 冲突，什么都没动」：两边的提交真的有内容冲突，land 列出冲突的文件。`git status` 里没有别人没提交的已跟踪文件时，才能自己 `git merge origin/main` 解决、提交，再 land；有的话不要 `git merge`（F58），先找改那些文件的会话或全局总控。
- 一批里别人的提交让 PR 的 CI 没过（常见的是 Windows 上写的 Rust 在 `rust-macos` 上编译不过，本机查不出来）：先用 SendMessage 把失败的 job 和报错发给提交它的会话，并订阅它空闲。它空闲后那些文件仍没有改动、也没有回复时，被挡住的会话可以自己做最小的修复（只让检查通过，不改逻辑），单独提交、标题写清补的是哪个提交，再发消息告知对方；动手前先看那些文件有没有没提交的改动，有就不动。
- `tests/scripts/mq.test.mjs` 在临时仓库里真的 land 一次（合并 main、不改写本地提交、不带走没提交的文件、只开一个 PR、没提交的文件挡住合并时照样推出去、冲突时撤回并列出文件；`--only` 只带选中的提交、缺依赖时拒绝、合入后不再列出），用假的 `gh` 代替 GitHub。
