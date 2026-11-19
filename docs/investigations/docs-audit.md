# 文档体检（2026-11-19）

用户让查「项目文档有哪些落后、要更新、调整或删除」。三个只读子代理分区对照代码核对，加一遍链接检查；抽查了 3 条（`undocumented_unsafe_blocks` 不在 Cargo.toml、`packages/fuyu-plugin` 已删、`win32/plugin_window/` 没被 `mod.rs` 声明），都属实。用户定了五批都做。每条做之前再对照代码核一次，这里记的是 11-19 的状态。

## 第 1 批：规则文件

| 文件 | 问题 | 怎么改 |
|---|---|---|
| AGENTS.md 第 9 行 | 写「插件平台第 3 版正在进行」，第 2 版 SDK、脚手架、`plugins/examples/dev.focusd.*`「等 E36.6.6 删」 | E36.6.6 已在 11-18 做完（fcf96486、2bd266c8），这些都已删除；改成现状，只剩 `plugin_kernel/v2_migration.rs` |
| AGENTS.md 目录总览 | `plugins/` 写成「示例、待签名的官方插件…」 | 现在只有 `v3/official/` 和冻结的第 2 版索引（overview.md 是对的） |
| AGENTS.md 常用命令 | `pnpm check` 的说明漏了 `check:secrets`、`check:rust-types`；表里没有 `check:rust-types`、`gen:rust-types`、`verify` | 对照 package.json 补上 |
| AGENTS.md 对外契约 | 窗口 label 只列 4 个 | 和上面的窗口表、`tauri.conf.json` 对齐 |
| src-tauri/AGENTS.md 目标结构 | 少 `timer/`、`sync/`、`voice_input/`、`wallpaper/`、`im_sources/`、`toast_notifications/`、`theme_market.rs`、`uninstall_cleanup.rs`、`tray_visibility.rs`、`messages_plugin.rs`、`emit_diagnostics.rs`、`user_error_codes.json`；`phone_push`、`device_use` 现在是目录 | 更新目录地图 |
| src-tauri/AGENTS.md | `macos/`「第 0 步只有空实现」 | 现在 42 个文件，都是真实现 |
| src-tauri/AGENTS.md 第 149 行 | `undocumented_unsafe_blocks` 为 deny | Cargo.toml 只有 `unwrap_used`、`expect_used`；删掉这一项 |
| src/AGENTS.md 目标结构 | 漏 `windows/drag-grid/`、`windows/tray-menu/`、`features/timer/`、`voice-input/`、`sync/` | 更新 |
| src/AGENTS.md 新增命令清单第 1 步 | 写「在 `generate_handler!` 中注册」 | 现在是各模块的 `tauri_commands!`，由 `lib.rs` 的 `collect_commands!` 汇总 |

## 第 2 批：架构现状文档

| 文件 | 问题 | 怎么改 |
|---|---|---|
| architecture/overview.md | 开头指向 v1-design、v2-platform；运行时图漏窗口（`clipboard-preview`、`tray-menu`、`pin-<n>`、`plugin-window-<n>`）和模块（`plugin_kernel`、`timer`、`sync`、`voice_input`、`recording`、`wallpaper`、`im_sources`、`toast_notifications`、`tray_menu`、`onboarding_window`） | 更新 |
| architecture/data-storage.md 第 49 行、contracts.md 第 166 行 | 凭据负责模块写 `agent_status/plan_usage.rs`、`plugin_host` | 现在是 `claude_usage/mod.rs`、`claude_usage/plan.rs` |
| contracts.md 第 228、281 行 | 把 `v2_builtins.rs` 的 `MIGRATIONS` 当现行 | 改成 `v2_migration.rs` 的 `V2_BUILTIN_IDS`，或标已删除 |
| contracts.md 第 285、291 行 | 第 2 版 `plugin-notification` 事件、`run_plugin_notification_action` 命令写成「接口不变」 | 代码里已没人发、没这个命令；标成已删除 |
| contracts.md | 链接 `../plugins/v3/services-and-slots.md` 断了 | 改成 `../plugins/services-and-slots.md` |
| architecture/platforms.md 第 53 行 | 跨设备同步两端都「开发中」 | C91–C95 已全部完成（含 WebDAV、加密、剪贴板收藏）；更新状态 |
| platforms.md 第 48 行 | 单实例写「lane 预览标识不同」 | 改成开发版独立身份 `com.tixxin.fuyu.lane-1`（`dev_lane.rs`） |
| platforms.md 日历 | Mac 写「未开始」，但它是通用代码，calendar.md 11-19 刚更新 | 复核 |
| architecture/macos-port-plan.md 第 111–112 行、G1.8 | 迁移表有 `plugin_host` 两行；G1.8 写插件网页视图、PowerShell 插件 | 改成第 3 版 `plugin_kernel` 加 `win32/job.rs`、`macos/job.rs` |
| macos-port-plan.md G1.5、迁移表 `phone_push` | 写 `pnpm dev:lane`（不存在）；phone_push 写「空闲 None」，和 platforms.md 第 61 行「已支持」矛盾 | 更新 |
| design/README.md | 「更新：2026-11-06」；消息区写「QQ、微信、邮箱三项」，现在 10 个来源；索引缺 clipboard.md | 更新 |

## 第 3 批：插件文档

| 文件 | 问题 | 怎么改 |
|---|---|---|
| architecture/plugins/builtins.md | 全文是第 2 版内置插件（`BUILTINS`、`useBuiltinPlugin`），代码已删；docs/plugins/README.md 第 43 行还把它当现行 | 移到 history；README 改指 v3-builtins.md |
| market-ops.md | 把第 2 版 `index.json`、stars、trustedPublishers、6 小时刷新写成现行；没提 `index.v3.json` | 只留冻结的第 2 版文件、旧密钥、紧急撤销；其余移 history，现行流程指向 v3-market.md、v3-market-ci.md |
| v3-cli.md | 状态行「实验」「`dev` 没做」「第 2 版冻结」；和 docs/plugins/cli.md 大半重复 | 合并，只留设计取舍，或整篇移 history |
| plugin-windows.md、author-signing.md、macos-webview.md、v1-design.md、v2-platform.md | 第 2 版的设计，代码已删或已定不做 | 移到 history；plugin-windows.md 开头指向第 3 版实现（`plugin_kernel/plugin_windows.rs`、`plugin-windows/v1`） |
| v3-phase2-plan、v3-phase3-foundation-plan、v3-phase3-plan、v3-phase4-plan、v3-phase5-foundation-plan、v3-phase6-plan | 这些阶段都已完成 | 移到 history，入链一起改（v3-progress、packages/plugin-review/README.md 等） |
| v3-market.md、v3-package.md、v3-everything-plugin.md | 状态行还是「实验期」或停在 11-14 | 更新状态行 |
| v3-boundary.md 第 306 行 | 说外壳还能 import `plugins`、`plugin-views` | 改文档（测试那半见下面「代码问题」） |
| v3-builtins.md 第 78 行 | 写 `v2_builtins.rs` | 改 `v2_migration.rs`；链接 `plugins/v3/package.md` 改 `../../plugins/package.md` |
| v3-secrets.md | 第 8 行和「甲」描述第 2 版现状 | 移 history，或补一句现状 |
| v3-workflow.md 第 64 行 | 冻结规则已不适用 | 删掉这段；E36 结项后整篇移 history |
| docs/plugins/package.md | 示例用假服务名（`notify`、`http`、`weather`），还说「服务名还在定」 | 换成真实服务名（`packages/plugin-services/src/services/`） |
| docs/plugins/services-and-slots.md | `market/v1` 少 `details`；标题用内部包名 | 补上；写明作者导入 `fuyu-plugin/services`、`fuyu-plugin/protocol` |
| docs/plugins/cli.md 第 100 行 | `hostExternal` 默认值不对 | 对照 `shared.mjs` 的 `HOST_SHARED_MODULES` |
| packages/create-plugin/README.md | 说生成的插件只能从开发目录加载 | `EXPERIMENTAL = []`，删掉这句 |
| packages/plugin-review/README.md | 分档规则指向要归档的 phase5 计划 | 改指 docs/plugins/review.md |
| packages/plugin-base/README.md | 命令清单少 `dev`；「共 62 条」和 v3-guarantees.md 的 63 行对不上 | 小改 |
| 断链 | v2-platform.md → `vscode.md`；plugin-windows.md → `webview_page.rs`、`reveal.rs` | 用 `82c16e4027`、`fcf96486^` 的永久链接，或删掉链接 |

## 第 4 批：归档、清理、断链

已经做完的计划，移到 `docs/architecture/history/`：screenshot-plan、collapsed-bar-items、settings-feature-switches-plan、skills-batch1-plan（F46 实测还开着的话注一句）、cross-device-sync-plan、migration-map；design/agent-page-plan.md（先确认 design/agent.md 已同步）。

删除：releases/draft-p6-todos-json.md、reviews/pr-22-23-local.md（`reviews/` 空了就删目录，docs/README.md 同步）、investigations/session-hierarchy-preview.html（没人引用）。本地的 `docs/tasks-inbox.local/` 不进仓库，请用户自己看。

开头标「已完成」或「历史」，不删：investigations 的 old-names-cleanup、island-shell-contributions、p8-webview-validation、clipboard-winv-lag、tray-menu-plan、macos-island-docking、dev-island-issues、dev-renderer-crash、lyrics-vs-messages、test-audit；startup-races 第 79–91 行注明 v2 已下线；research 的 agent-lanes、release-pipeline、settings-window-redesign、fuyu-performance-audit（指向 v2）。

挪目录：research/fuyu-performance-audit.md、fuyu-performance-audit-v2.md、screenshot-memory-leak.md 是查自己的应用，移到 investigations/。

合并：research/clipboard-managers.md 和 clipboard-apps.md；desktop-frameworks 三份。合并或在附属文件开头写「附录」。

功能文档里写错的：
- features/voice-input.md：路径改到 `src/features/voice-input/`
- features/onboarding.md 第 57 行：改到 `src/windows/island/first-hints/`
- features/data-home.md 第 52 行：`scripts/tasks/install-island-plugin.mjs` 不存在
- features/updater.md 第 70、174 行：`plugin_host/market.rs` 已删，lane 已去掉
- features/local-api.md 第 3 行：现在是第 3 版内置插件 `local-api`
- features/collapsed-message-animation.md：是改动记录，时长已过时；并进 design/collapsed-bar.md 或 design/motion.md
- releases/README.md：「当前是正式版 0.3.6」改成泛指，删 lane

断链（`docs/releases/` 和已归档任务不算）：15 处真断，43 处指向已挪进 `0-archive/` 的任务。真断的除上面已列的，还有 research/agent-lanes.md → `../architecture/lanes.md`、research/lyrics-sources.md 的「开始,时长,0」、fly-island-issue-76.md → `session_notifications.rs`、fuyu-performance-audit*.md → 已删的插件文件和 `useScreenshotFrame.ts`、docs/tasks/README.md → `x.md`（示例，换成代码格式）。检查脚本：对 `git ls-files "*.md"` 里每个 `](…)`，以 `/` 开头的按仓库根解析，其余按文件所在目录解析。

防止以后再坏：任务归档（`pnpm tasks done` 移文件到 `0-archive/`）时，顺手把仓库里指向旧路径的链接改过去；或者 `pnpm check` 里加一个断链检查。二选一，做之前问用户。

## 第 5 批：补缺

- features/ 新增：clipboard.md、音乐和歌词（`music` 插件、`media/v1`、`lyrics/v1`、InfLink 一键安装）、sync.md（设置 → 同步）、一篇「系统提示」（`device-events`、`system-levels`、`device-use`）；`theme-market`、`claude-usage`、`recording` 视情况补。
- README.md 第 06 项只写 Claude Code 和 Codex，`agent-status-hooks.md` 列了 17 家；「岛上有什么」没提截图、录屏、语音输入、计时器、休息提醒。先改中文和英文，再同步各语言版。
- docs/readme/ 各语言版页头「译自 2026-11-15 的中文版」更新日期；README.en.md 补日期说明。

## 代码问题（不在这五批里，另开任务）

- `src-tauri/src/win32/plugin_window/`（desktop.rs、mod.rs、paint.rs）还在 git 里，`win32/mod.rs` 没声明，是死代码。
- `tests/unit/feature-boundaries.test.mjs:34` 的 `SHELL_READS` 还有已删的 `plugins`、`plugin-views`。
- `src-tauri/src/emit_diagnostics.rs:66` 还有没人发的 `plugin-notification`。
