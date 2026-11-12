# land 改成开 PR + 自动合并：分步计划

> 任务：[F30](/docs/tasks/F/F30.md)。用户 2026-11-12 定：先用「自己的工作流把落后的 PR 依次更新」排队（下文第 5 步），并给 GitHub 自带的 merge queue 留好接口，仓库转到组织名下后再换过去（第 9 步）。

每一步做完勾选，写上提交号。每一步都能单独验证、单独合入。第 1–7 步做完之前，旧的 land（直接推 `main`）照常可用；第 8 步才收紧规则集，那之后只剩新流程。

## 为什么要改

现在的 `pnpm mq:land` 在本机 rebase、跑检查（pre-push 钩子），然后 `git push origin HEAD:main`。这一步能成功，只是因为仓库管理员在规则集 `main protection` 里可以绕过（`bypass_mode: always`），有两个后果：

- **协作者用不了**。ShengLin1001 只有 Write 权限，同样的推送会被规则集拒绝，所以 AGENTS.md 只能写两套流程。
- **管理员的提交不经过 CI**。检查只在本机跑，本机能过、CI 上过不了的问题会直接进 `main`。`b9590bd5` 就是这样：测试在 Windows runner 上缺 git 身份，`main` 红了一晚，别的 PR（#52）也因此卡住，修复见 PR #53。

改完后，所有人走同一条路：推分支、开 PR、开自动合并，CI 的 `check` 是唯一关卡。

## 顺带更正：#53 当时为什么合不进去

当时我们以为挡住 #53 的是规则集里的 `require_extra_approval_for_unattributed_changes`，这个判断是错的。按 [GitHub 文档](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)，这一项只针对 Copilot 以自己的身份开、没有归属到人的 PR，而且要求的批准数是 0 时不起作用。所以它不用动。

真正的原因是时间线：

| 时间（UTC） | 事件 |
|---|---|
| 15:32:48 | `24d98155` 的 CI 通过，PR 显示 `CLEAN` |
| 15:33:16 | 有人往 PR 分支推了 `75f7fc80`（调研文档），CI 重新开始跑 |
| 约 15:34 | `gh pr merge --merge`：新提交的 `check` 还没出结果，被规则集拒绝（`BLOCKED`） |
| 15:35:52 | 用 `--admin` 绕过合入 |
| 15:40:29 | `75f7fc80` 的 CI 通过 |

换成自动合并，这种情况会自己等 CI 跑完再合，不用绕过。

## 新流程

`pnpm mq:land`（在 lane 里，所有人一样）：

1. 检查：只能在 lane 分支上跑，工作区干净；归属记录和任务检查照旧（`land-check.mjs` 里不涉及构建的部分）。
2. `git fetch` 后 rebase 到 `origin/main`，冲突就中止，和现在一样。
3. 推到远程分支 `land/<GitHub 用户名>/lane-<N>`（`gh api user` 取用户名）。本机的 `lane/N` 只在一台机器上唯一，多台机器、多个人一起推会撞名。PR 已经存在时，rebase 改了提交号，用 `--force-with-lease` 推。
4. 没有 PR 就 `gh pr create`：只有一个提交时标题和正文取提交说明，多个时标题取第一个提交、正文列出全部提交。
5. `gh pr merge --auto --merge`。必须用 `--merge`：lane 的提交要原样成为 `main` 的祖先，`lane:done` 和被遗弃 lane 的判断都靠「提交在不在 `main` 上」，squash 和 rebase 合并都会换掉提交号。
6. 输出 PR 地址后返回，不等 CI。会话接着在后台跑 `pnpm mq:wait`：等 PR 合入（或 CI 失败、出现冲突），合入后做现在 land 成功后做的事：快进主工作区（`sync`）、提示被遗弃的 lane。

CI 失败时，PR 保持打开、自动合并保持开启。会话在同一个 lane 修好、提交，再 `pnpm mq:land`，PR 自动更新。PR 没合入前，`lane:done` 照现在的规则不释放这个 lane（提交还不在 `main` 上）。

## 分步

- [ ] **第 1 步：GitHub 设置（需要你）。** 仓库 Settings → General 打开 Allow auto-merge 和 Automatically delete head branches。规则集先不动。另外建一个 fine-grained token（只给这个仓库，Contents 和 Pull requests 读写），存成仓库 secret `PR_UPDATER_TOKEN`，第 5 步用：用 Actions 自带的 `GITHUB_TOKEN` 更新分支，不会触发新的 CI，PR 会永远卡在等 `check`。
- [x] **第 2 步：CI 准备。**（`ci: skip the build jobs for a pull request that only changes Markdown`）`ci.yml` 加上 `merge_group` 触发（现在不生效，第 9 步直接用上）。新任务 `scope` 取 PR 改动的文件（改名的连旧名一起），交给 `land-check.mjs` 的 `docsOnly()` 判断，和本地 land 的规则一致：全是 `.md`，且不含 `docs/plugins/api.md`。只改文档时 `frontend`、`regression`、`rust` 跳过，`docs` 任务在 Ubuntu 上只跑 `node scripts/tasks/tasks.mjs check`，不装依赖；`check` 照常汇总，否则 PR 会一直等。`main` 上的推送和 merge queue 始终跑全套。
- [x] **第 3 步：`mq:land` 改成开 PR。**（`feat(mq): land opens a pull request with auto-merge instead of pushing main`）`land.mjs` rebase 后推到 `land/<用户名>/<机器名>-<分支名>`（同一个账号在两台电脑上也不会撞名），没有 PR 就开，再 `gh pr merge --auto --merge`；`--wait` 在前台等。新增 `mq:wait`（`wait.mjs`）：合入后快进主工作区、推 `dev`、提示被遗弃的 lane；检查失败、冲突、被关掉时报告；落后时更新分支（第 5 步的工作流上线后关掉这一项）。`gh` 调用在 `github.mjs`，测试里换成假的。删掉了 `queueLock.mjs`。本机检查暂时照旧由 pre-push 钩子跑，第 4 步再改。
- [ ] **第 4 步：pre-push 改规则。** `checkPush.mjs`：任何人推 `main` 都拒绝（只剩 `CLAUDE_CODE_MERGE_QUEUE_EMERGENCY_PUSH=1` 能绕过），删掉 `CLAUDE_CODE_MERGE_QUEUE_LANDING`；推其他分支时不再跑完整检查，交给 CI。
- [ ] **第 5 步：把落后的 PR 依次更新（代替 merge queue）。** 新工作流 `.github/workflows/update-behind-prs.yml`：`main` 每有新提交，就在开着自动合并、落后于 `main` 的 PR 里，挑开启自动合并最早的那**一个**，用 `PR_UPDATER_TOKEN` 执行 `update-branch`。一次只更新一个，相当于先来先合，不会每合一个就让所有 PR 重跑 CI。那个 PR 合入后 `main` 又变了，工作流再挑下一个。
- [ ] **第 6 步：`dev` 同步搬到 GitHub。** 旧版本岛屿从 `dev` 读插件市场，现在由 land 之后的本地脚本 `land-sync-dev.mjs` 推。经 GitHub 合入的 PR 从来没同步过 `dev`。改成工作流：`main` 有推送时把 `dev` 推到同一提交（`dev` 没有保护，`GITHUB_TOKEN` 就够），删掉 `land-sync-dev.mjs` 和 `ON_LAND`。
- [ ] **第 7 步：认领任务和文档。** `pnpm task:claim` 现在靠 land 占位，以后变成「开 PR 并自动合并」，只改任务文件，走第 2 步的快速路径，一两分钟就合入。两个会话抢同一项时，后合入的 PR 会冲突，GitHub 不会自动合，`mq:wait` 报告冲突，会话换一项。文档：AGENTS.md「Git 与协作」只写一套流程，`docs/architecture/lanes.md` 换掉排队锁和直接推送的部分，`docs/tasks/README.md`「GitHub PR」第 4 步简化；新增给真人看的 `CONTRIBUTING.md`（分支命名、本地要跑什么、怎么开自动合并）和 `.github/pull_request_template.md`。
- [ ] **第 8 步：收紧规则集（需要你确认后做）。** 新流程跑顺几天后，`main protection` 里管理员的绕过方式从 `always` 改成 `pull_request`：不能再直接推 `main`，紧急情况仍可在 PR 上 `gh pr merge --admin`。批准数保持 0，「PR 必须基于最新的 `main`」保持开启。

## 以后换成 GitHub 的 merge queue（第 9 步）

merge queue 只能用在组织名下的仓库，`TixXin/Fuyu` 现在挂在个人账号下（`owner.type: User`）。公开仓库用免费组织就行。换的时候只改设置，`mq:land` 不用改：`gh pr merge --auto` 在开了 merge queue 的分支上就是把 PR 放进队列。

1. 转移前先核实重定向，这些地址属于对外契约（[contracts.md](/docs/architecture/contracts.md)）：
   - 更新端点 `https://github.com/TixXin/fuyu/releases/latest/download/latest.json`，以及两个镜像 `ghfast.top`、`gh-proxy.com` 转发的同一地址：镜像会不会跟着 GitHub 的重定向走，要实测；
   - 旧版岛屿读的插件索引 `https://raw.githubusercontent.com/TixXin/fly-island/...`：现在已经靠改名的重定向工作，转移后会多一跳；
   - 插件市场仓库 `TixXin/fuyu-plugins` 要不要一起转。
   可以先拿一个测试仓库转一次，用 curl 逐个验证。
2. 转移仓库；发一个新版本，把代码里的地址改成组织名下的新地址，旧版本继续靠重定向。
3. 规则集加上 merge queue 规则，关掉「PR 必须基于最新的 `main`」，删除第 5 步的工作流和 `PR_UPDATER_TOKEN`。

## 代价

- 一次 land 从几分钟变成约 7 分钟（Windows runner 跑一次 CI），但会话开了自动合并就可以去做别的事。只改文档的 PR 走快速路径。
- 同时开着好几个 PR 时，它们按开启自动合并的顺序一个个合入，后面的每次轮到时重跑一遍 CI。
- 多了一个要维护的 token（`PR_UPDATER_TOKEN`），过期后第 5 步的工作流会失败，PR 停在落后状态，要续期。

## 对不同的人

| 谁 | 怎么合入 |
|---|---|
| 你和代理会话 | `pnpm mq:land`，背后是开 PR + 自动合并 |
| Write 协作者（ShengLin1001） | 可以用 `pnpm mq:land`；不用 lane 时开分支、开 PR、点 Enable auto-merge |
| 外部贡献者 | fork 后提 PR，维护者看过后开启自动合并 |

真正强制的只有 GitHub 规则集，对所有人生效；仓库里的 AGENTS.md、`scripts/` 和 `CONTRIBUTING.md` 告诉代理和人该怎么做；`.githooks` 只在配了 `core.hooksPath` 的机器上生效，只算提醒。
