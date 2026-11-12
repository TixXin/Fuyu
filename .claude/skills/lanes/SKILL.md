---
name: lanes
description: >
  This skill should be used in the Fuyu repo (the main checkout and its lanes under the
  sibling `<repo>-lanes` folder) whenever work starts, a lane is opened, entered,
  taken over or released, work is verified or landed, main moves, a lane preview is needed,
  or a land / lane problem comes up — including 开 lane, 进 lane, 接手 lane, 释放 lane, 推送,
  推 main, 合入 main, land, mq:land, mq:wait, verify, 发插件, git push, 预览, dev:lane, lane:list,
  合 PR, land 失败, rebase 冲突. main only moves through PRs that GitHub merges after CI; no
  need to ask the user before landing.
---

# lane 与合入

完整说明在 `docs/architecture/lanes.md`，下面只排顺序。做到哪一步就读那一节。

## 开工

1. 当前目录在主工作区时，先开 lane：
   - 会话从仓库目录启动：调用 EnterWorktree（WorktreeCreate 钩子分配 lane）。
   - 否则（magpie 会话等）：在主工作区 `pnpm lane:open --as <ListAgents 里自己的名字>`，取输出最后一行的路径，调用 EnterWorktree(path=<路径>)。
   - 接手别人的 lane：`pnpm lane:take <N> --as <名字>`（对方还在用会拒绝；确认后才加 `--force`），再 EnterWorktree(path)。
2. 进去后确认 `git status --short` 干净、分支是 `lane/N`。不要手动 `git worktree add`，不要在主工作区改文件。
3. 认领任务：`pnpm task:claim <编号> --as <名字> --scope ...`（会顺带登记 lane；它开一个只改文档的认领 PR，等合入约 1 分钟）。

新机器第一次用：在主工作区 `git config core.hooksPath .githooks`，再 `pnpm lane:install-hooks`（往用户级 settings 加 SessionStart / SessionEnd 钩子；`--check` 只检查）。

## 合入

1. 提交（不带 Claude 署名行）。修补自己没 land 的提交用 `--amend` / `--fixup`。
2. 想在本机先验一遍用 `pnpm verify`，放后台。land 不在本机跑 `pnpm check` / `cargo test`，由 PR 上 CI 的 `check` 把关。
3. `pnpm mq:land`：rebase 到 `origin/main`，推 `land/<用户名>/<机器名>-<分支名>`，开 PR 并开启自动合并。它返回只代表 PR 开好了。
4. 接着后台 `pnpm mq:wait`，等 CI 通过、GitHub 合入后它快进主工作区；PR 合入才算完成。也可以 `pnpm mq:land --wait` 一起等。
5. 失败时按 lanes.md「开发、验证、合入」第 3 条处理：冲突就 `git fetch origin main && git rebase origin/main` 后重新 land；CI 失败就修了再 land；`mq:wait` 已报合入但快进失败，只在主工作区 `pnpm mq:sync`，不重复 land。PR 一直落后时可以 `pnpm mq:wait --update`。
6. 改到应用代码时，按 AGENTS.md「验证」另外跑 `pnpm build:exe`（合入后，只在 Windows 上）。
7. 收工或用户说要退出会话时：在 lane 里 `pnpm lane:done`。它释放干净、已合入的 lane；列出没提交或没合入的东西时先处理（提交并 land，或问用户要不要），再跑一次。释放后 ExitWorktree(action="keep")；不要删 lane。

发插件：改 `plugins/` 后同样走上面的合入；插件市场的索引和发布步骤见 `docs/architecture/plugins/market-ops.md`。

## 其他

- 预览：lanes.md「预览」（`pnpm dev:lane` / `:center` / `:fresh`），不要在 lane 里跑 `pnpm tauri dev`。
- 别人提的 PR：lanes.md「外部 PR」，不走 land，直接 `gh pr merge <编号> --auto --merge`，再 `pnpm mq:wait <编号>`。
- 紧急推 main 只在用户明确要求时，用 `CLAUDE_CODE_MERGE_QUEUE_EMERGENCY_PUSH=1`。
- 谁在用哪个 lane：`pnpm lane:list`。别人的 lane 不删不重置，拿不准就 SendMessage 问，再告诉用户。
- 在临时仓库里跑 git 的测试，开头去掉 `GIT_*` 环境变量。
