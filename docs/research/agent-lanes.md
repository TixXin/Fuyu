# 多代理并行开发：worktree / lane 方案

> 日期：2026-11-12。问题：对照外部的前沿做法和开源项目，本项目的 lane 方案（[docs/architecture/lanes.md](../architecture/lanes.md)）还有哪些要优化。范围：Claude Code 官方 hooks 文档；GitHub 上做“多个 AI 代理并行 + git worktree”的项目（worktrunk、vibe-kanban、claude-squad、ccmanager、crystal、container-use）；本项目用的 claude-code-merge-queue；Cargo 构建缓存文档和 sccache。搜索接口当天不可用，以上都是直接抓取的项目主页和官方文档。相关任务：F27、F28、F29。

## 结论

我们的方案在两点上比开源项目走得更远：**lane 复用**（开源项目都是“一个会话建一个、用完删”）和**本地合并队列**（多数只给开 PR，或 squash 后快进合并）。真正要补的是**判断会话死活**和**退出时收尾**这两块，官方 hooks 已经提供了比我们现在更好的信号。

按优先级：

1. **SessionEnd 钩子会被 1.5 秒预算掐断（P1，F27）**。官方文档说所有 SessionEnd 钩子共用 1.5 秒，单个钩子写了 `timeout` 才能放宽，最多 60 秒。我们的 `session-end.mjs` 要跑 `git status`、`merge-base`，还用 PowerShell 查 CIM 进程表找 `claude.exe`，很可能超时，等于退出时不释放。要在 `.claude/settings.json` 里给它设 `timeout`，并把找进程这一步去掉（见下一条）。
2. **用 `session_id` 代替进程号判断归属（P1，F27）**。所有钩子的输入都带 `session_id` 和 `cwd`。我们现在靠往上找 `claude.exe` 的进程号，magpie 会话找不到，只好退回“24 小时内登记过”。改成：SessionStart 记下 `session_id → lane`，SessionEnd 按 `session_id` 释放；会话是否还活着，可以读岛屿的 AI 代理状态模块已经在读的会话记录（`agent_status`），它本来就知道每个会话在不在、忙不忙。这样 24 小时窗口和“30 分钟内有改动”的兜底都能大幅收紧。
3. **magpie 会话读不到仓库的钩子（P1，F27）**。它们从临时目录启动，不加载主工作区的 `.claude/settings.json`。把 SessionStart / SessionEnd 钩子放到用户级 `~/.claude/settings.json`，脚本自己判断 `cwd` 是不是本仓库或它的 lane，不是就直接退出。
4. **接上 WorktreeRemove 钩子（P2，F28）**。官方有这个钩子：WorktreeCreate 建的 worktree 被移除时触发，非 0 退出会让移除失败。用它跑 `lane:done` 的检查：有工作的 lane 拒绝移除，干净的不删目录而是释放回池子。这样 ExitWorktree(remove) 也不会绕过 lane 池。
5. **把合并队列收回仓库（P2，F29）**。claude-code-merge-queue 只有约 131 star、5 fork（2026-11-12），我们已经打了覆盖 7 个文件的补丁，分配、归属、清理也已经全在 `scripts/lanes/`。剩下的排队锁、rebase、推送、快进主工作区代码量不大，搬进 `scripts/` 自己维护，升级时不用再重做补丁。同类工具淘汰得很快（crystal 2026 年 2 月弃用，vibe-kanban 已宣布停止维护），不宜依赖。
6. **Cargo 方面先观望（P3）**。官方的缓存回收 `-Zgc` 只管 `CARGO_HOME`，不管 target，所以 `pnpm prune:target` 还得留着；`-Z mtime-on-use` 能让按时间清理更准，`fine-grain-locking`（#4282）能让多个 lane 同时写一个 build-dir 不必整目录排队，两者都还没稳定，稳定后再接。sccache 不缓存增量编译和 `bin`/`cdylib`/`proc-macro`，我们的热点正是自己 crate 的增量编译，引入收益不大。
7. **可选：在岛屿的 Agent 页显示 lane（P3）**。`pnpm lane:list --json` 已经有数据，和会话卡片放在一起，能直接看到哪个会话占着哪个 lane、哪个 lane 有没合入的工作。

不建议照搬的：容器隔离（container-use，实验性，Windows 未提及，对桌面应用的 Win32 测试也不适用）；worktrunk 的 squash 合并和 LLM 写提交说明（我们要保留按功能单元的提交）；用完即删 worktree（会丢掉 `node_modules` 和编译缓存，正是我们复用 lane 想避免的）。

## 详细

### 对照表

| 方面 | 本项目 | 开源项目的做法 |
|---|---|---|
| 隔离单位 | 编号 lane（worktree + `lane/N`），复用 | 每个任务/会话一个 worktree，按分支名命名（worktrunk、claude-squad、ccmanager）；容器 + 分支（container-use） |
| 分配 | 先还给本会话，再复用空闲的，最后新建 | 都是新建；没有看到复用的 |
| 判断在用 | 进程号、登记时间、任务、最近改动、目录能否改名 | ccmanager 按会话输出判断忙 / 等待 / 空闲；claude-merge-queue 用 PID 存活判断锁 |
| 收尾 | `lane:done`、SessionEnd 钩子 | `wt remove`、`wt merge` 后自动清理；vibe-kanban 自动清理孤立和过期工作区 |
| 合入 | 本地 FIFO 队列：rebase、检查、推送、快进主工作区 | worktrunk：squash + rebase + 快进；多数：开 PR 在 GitHub 合 |
| 依赖和构建缓存 | 每个 lane 一份 pnpm 安装（store 硬链接）；共享 `target/agents`、`lane-build` | worktrunk `copy-ignored` 用文件系统的写时复制共享 `target/`、`node_modules/`，只支持 APFS / btrfs / XFS |
| 会话上下文 | 记忆按路径存，lane 各一份 | ccmanager 新建 worktree 时可复制 `~/.claude/projects/...` 的会话数据 |

### Claude Code hooks（官方文档）

- SessionStart 的匹配值：`startup`、`resume`、`clear`、`compact`、`fork`；输出的文字会进上下文。
- SessionEnd 的匹配值：`clear`、`resume`、`logout`、`prompt_input_exit`、`other`；不能阻止退出；所有 SessionEnd 钩子共享 1.5 秒预算，单个钩子的 `timeout` 最多放宽到 60 秒。终端被直接关掉或进程被杀时是否触发，文档里没找到，未核实。
- 所有事件的输入都有 `session_id`、`cwd`。
- WorktreeCreate：替代默认的 git 行为，命令钩子在 stdout 打印路径；非 0 退出则创建失败。WorktreeRemove：只对 WorktreeCreate 建的 worktree 触发，非 0 退出且目录还在时移除失败。

### 开源项目（数字查于 2026-11-12）

- **worktrunk**（max-sixty，约 12.5k star）：`wt switch -c`、`wt list`、`wt merge`、`wt remove`；有创建、合并前后的钩子；`wt step copy-ignored` 用写时复制共享构建缓存，限 APFS / btrfs / XFS。Windows 的 NTFS 不在列；ReFS（Dev Drive）支持块克隆，能否用于此未核实。
- **vibe-kanban**（BloopAI，约 28.7k star）：看板派任务给代理，每个工作区一个分支、终端、dev server，自动清理孤立和过期工作区；页面横幅写着正在停止维护。
- **claude-squad**（smtg-ai，约 8.8k star）：tmux + worktree，每个会话可暂停（先提交）、恢复、删除；依赖 tmux，没有 Windows 说明。
- **ccmanager**（kbwo，约 1.3k star）：每个 worktree 一个会话，识别忙 / 等待 / 空闲；创建后钩子；`.worktreeinclude` 复制被忽略的文件；可把 Claude Code 的会话数据复制进新 worktree。
- **crystal**（stravu，约 3.1k star）：2026 年 2 月弃用，由 Nimbalyst 接替。
- **container-use**（dagger，约 4.1k star）：每个代理一个容器加一个分支，MCP 服务器形式；标为实验性。
- **claude-code-merge-queue**（funador，约 131 star）：本项目在用；按 PID 存活判断锁，`prune` 删已合入的 lane（我们已打补丁关掉），页面没提 Windows。

### Cargo

- `build-dir`（`CARGO_BUILD_BUILD_DIR`）与 `target-dir` 分开：中间产物和最终产物分离，build-dir 的布局是内部实现、可能变化。我们的 `lane-build` 依赖这点，升级 Rust 后要复查。
- 不稳定特性：`-Zgc`（只回收 `CARGO_HOME`），`-Z mtime-on-use`（#7150），`build-dir-new-layout`（#15010），`fine-grain-locking`（#4282）。
- sccache：Windows 可用（scoop / winget）；不缓存增量编译和需要链接器的 crate；`CARGO_INCREMENTAL=1` 时默认报错退出。

## 来源

- https://code.claude.com/docs/en/hooks
- https://github.com/funador/claude-code-merge-queue
- https://github.com/max-sixty/worktrunk
- https://github.com/BloopAI/vibe-kanban
- https://github.com/smtg-ai/claude-squad
- https://github.com/kbwo/ccmanager
- https://github.com/stravu/crystal
- https://github.com/dagger/container-use
- https://doc.rust-lang.org/cargo/reference/build-cache.html
- https://doc.rust-lang.org/cargo/reference/unstable.html
- https://github.com/mozilla/sccache
