# 去掉旧名 FocuSD 和 fly-island：清点和计划

> 起因：用户 2026-11-16 在 `Fuyu-[总控] issue 和 PR` 里说「为什么项目还有 focus 这个名字！把 focus 和 fly-island 都去掉！」。组长 `[任务] 去掉旧名 FocuSD 和 fly-island` 清点、出计划，等用户点头后再派会话。改名本身的记录在 [rename-plan.md](../architecture/history/rename-plan.md)（D17）。

## 结论先说

- 单独的 `focus` 是「聚焦窗口」这个动词（`island/focus.rs`、`focus_island_for_shortcut`、`agent-focus.log`、`set_focus` 等），不是旧名，不动。清点时确认过，没有旧名藏在 `focus` 里。
- 旧名一共出现在 **542 个文件、1813 处**（`git grep -i -E 'focusd|fly-island|fly_island|flyisland|FLY_ISLAND'`，不含锁文件）。其中：
  - **D 历史文档 230 个文件、422 处**：不改。
  - **C 旧插件系统第 2 版 133 个文件、844 处**：等 E36.3 / E36.6 自然消失。
  - 剩下约 180 个文件里，**能直接改的 A 类约 90 个文件**，**要保留的兼容代码 B 类约 25 个文件**，**要逐条判断的 E 类约 10 处**。
- 所以「全部去掉」做不到一步到位：B 类删了老用户会丢数据，C 类在第 2 版下线时整块删掉最省事。能马上做的是 A 类，分 4 个任务会话。

## A 类：当前代码、文案、文档、测试样例里的旧名（直接改）

### A1 Rust 内部名字、测试样例、内部协议标记（约 35 个文件）

| 什么 | 在哪 | 怎么改 |
|---|---|---|
| 消息窗口的类名和标题 `FocuSD…` | `agent_status/approval_hotkeys.rs`、`clipboard_history/listener.rs`、`translation/hotkey.rs`、`wechat_reminders/source.rs`、`win32/session_notifications.rs`、`win32/message_window.rs`（测试） | 改成 `Fuyu…`；开工时确认没有别的进程按类名找这些窗口 |
| `FocuSD activation test` | `messenger_activation.rs` | 改名 |
| 发给远端的脚本里的内部标记 | `agent_status/remote_fetch.rs`（`FOCUSD_READY`、`FOCUSD_KNOWN`）、`agent_status/remote_setup.rs`（`FOCUSD_ISLAND_END_OF_TEXT`、`.focusd-tmp`）、`ssh_tunnel/tunnel.rs`（`FOCUSD_NO_PORT_TOOL`） | 每次连接都由本程序现发，两端同时换，改成 `FUYU_*` |
| cc-connect 配置的备份和临时文件后缀 `.bak-focusd-`、`.focusd.tmp` | `cc_connect/config_file.rs` | 改成 `fuyu`；已有的旧备份不动 |
| 名字带旧名、值已经是新名的常量和函数 | `codex_hooks.rs` 的 `FOCUSD_AGENT_HOOK_BLOCK_*`、`claude_hooks.rs` 的 `value_contains_focusd_hook_signature` | 改成 `ISLAND_HOOK_BLOCK_*`、`value_contains_island_hook_signature`；`LEGACY_*` 和 `remove_legacy_codex_focusd_hooks` 这种明说是旧名兼容的留着 |
| 测试里的临时目录名 `focusd-*`、样例路径和文本 `fly-island` | `calendar/sources.rs`、`cc_connect/*`、`fs_write.rs`、`lyrics/*`、`agent_status/{remote_hosts,remote_sessions,remote_fetch,remote_setup,wezterm}.rs`、`clipboard_history/secrets.rs`、`phone_push/mod.rs`、`win32/{process_env,registry}.rs`、`file_shelf/`、`local_api/`、`mail/`、`pets/`、`qq_notifications/`、`ssh_tunnel/` 的 `tests.rs` | 换成 `fuyu-*` / `fuyu`；测「旧名照样认」的断言（`agent_status/tests.rs`、`reply_marker_tests.rs`、`rename_migration/tests.rs`、`agent_approval/tests.rs` 里的旧签名、旧标记）留着 |

不碰：`plugin_host/`、`plugin_kernel/`（C 类）、`todos/`（E36.3.38 正在改）、B 类列出的兼容常量。

### A2 两处漏改的文件格式（行为改动，带兼容）

| 什么 | 现状 | 怎么改 |
|---|---|---|
| 剪贴板导出文件 | `clipboard_history/transfer.rs` 还在**写** `fly-island-clipboard-<时间>.json`、`"app": "fly-island-clipboard"`，导入只认这个名字。改名计划里写了要改成 `fuyu-clipboard-*`，漏了 | 写新名字；导入新旧都认；`contracts.md` 记一笔 |
| 音效包清单 | `agent-status/sounds/packManifest.ts` 只认 `focusd-sound-pack.json`，设置里的说明文字也让用户写这个名字 | 先找 `fuyu-sound-pack.json`，没有再找旧名；文案（`i18n/sections/settings/sounds.ts`）只提新名；`contracts.md` 记一笔 |

### A3 开发工具的环境变量和脚本（约 15 个文件）

| 什么 | 在哪 | 怎么改 |
|---|---|---|
| `FOCUSD_DEV_LANE`、`FOCUSD_DEV_LANE_CENTER` | `src-tauri/src/dev_lane.rs`、`scripts/stop-running-island.mjs`、`scripts/plugins-v3/install-demo.mjs`、`src-tauri/AGENTS.md` | 改成 `FUYU_DEV_LANE*`，旧名照样读一段时间（用户的终端里可能设着） |
| `FOCUSD_VERIFY_NOTIFICATIONS` 等三个 | `notification_diagnostics.rs`、`scripts/verify-first-run-notifications.ps1` | 两边一起改成 `FUYU_*`，临时目录 `FocuSD-notification-verification` 一起改 |
| `FOCUSD_SESSION_NAME` | `scripts/tasks/tasks.mjs` | 认 `FUYU_SESSION_NAME`，旧名照样读 |
| 早就不存在的旧产物名 | `scripts/stop-running-island.mjs` 的 `focusd-island.exe`、`fly-island.exe`；`scripts/prune-build-cache.mjs` 的 `focusd_island*` | 删掉（`target` 里的旧产物 2026-11-10 后早过了 3 天的清理期） |
| 任务看板插件的说明文字「fly-island 仓库」 | `scripts/tasks/island-plugin/fuyu-plugin.json`、`main.ps1` | 只改文字，id `dev.focusd.dev-tasks` 不动（改 id 等于换一个插件，见 C 类） |
| 对应的脚本测试 | `tests/scripts/{stop-running-island,prune-build-cache,task-board-plugin}.test.mjs` | 跟着改 |

### A4 当前文档（约 30 个文件，只改文档）

- `docs/features/*`（agent-status-hooks、updater、timer、data-home 等 13 份）、`docs/architecture/` 下的当前文档（agent/、collapsed-bar-items、data-storage、overview、platforms、workflow）、`docs/design/collapsed-bar.md`：讲当前行为的地方换成新名字；说明旧名兼容的句子并到 contracts.md 的新节里，原处只留链接。
- `contracts.md`：把散在各节的「改名前是 …」收拢成一节「改名兼容（D17）」，就是下面 B 类那张表，写上每条在哪、什么时候能删。
- `AGENTS.md` 第 17、122、125 行和 `src/AGENTS.md`、`src-tauri/AGENTS.md` 里的旧名：项目概览那句「改名前叫 FocuSD Island，仓库名 fly-island」和对外契约里的「改名前是 …」改成一句链接到 contracts.md 的新节（改规则文件要先加载 `fuyu-skill-writing`）。`src/AGENTS.md` 和 `src-tauri/AGENTS.md` 里的 `focusd.cc-connect` 这类内置插件 id 等 E36.3 迁完再改。
- README 末尾「2026 年 11 月由 fly-island 改名为浮屿」和 9 份翻译：**等用户定**（见下面问题 3）。
- 不改：`docs/investigations/` 里的排查记录（写的是当时的事），进行中任务文件里的旧 id（随任务归档）。

### A5 前端测试样例（等 E36.3.51、E36.3.37 合入后再做）

- `tests/regression/` 里 25 个文件、5 份快照：样例路径 `E:\Projects\fly-island`、样例 id。E36.3.51 的认领范围是整个 `tests/regression/`，现在动会撞。
- `tests/unit/` 里 agent-session、agent-session-list、appearance-theme、session-ring 等的样例：其中 agent 相关的等 E36.3.37（Agent 状态迁成内置插件）合入后一起改。
- 测「旧数据照样能读」的（`renamed-keys`、`todo-migration`、`settings-backup` 里的旧 key、旧 app 名）留着。

## B 类：读旧数据、旧标识、旧协议的兼容代码（建议保留）

都是为了从改名前的版本（≤ 0.3.5-beta.4）直接升级上来的用户，删了他们会丢数据、hook 失效或链接打不开。

| 兼容什么 | 在哪 | 删了会怎样 |
|---|---|---|
| 旧数据目录 `com.focusd.island`、旧安装项、旧 exe、旧凭据 | `src-tauri/src/rename_migration/`（已经是一个模块） | 老用户升级后数据、凭据全空 |
| localStorage `focusd-island-*` → `fuyu-*` | `src/lib/renamedKeys.ts`（已经是一个文件） | 同上 |
| 开机自启旧值 `FocuSD Island` | `system/startup.rs` | 旧值留在注册表，开机启动两次或指向不存在的 exe |
| Agent hook 旧签名 `focusd-agent-`、旧标记块、旧请求头 `x-focusd-remote` | `agent_status/{mod,claude_hooks,codex_hooks}.rs`、`agent_approval/http.rs` | 用户机器上的旧 hook 不再被识别成「需要修复」，旧块永远留在配置里 |
| 回复标记旧文件 `rules/focusd-island-reply-marker.md` | `agent_status/reply_marker.rs` | 旧规则文件不再被清掉，提示词里出现两份标记说明 |
| SSH 远端旧目录 `~/.focusd-island/` | `agent_status/{remote_setup,remote_fetch}.rs` | 没修复 hook 的远端主机的通知读不到 |
| VS Code 旧扩展 `tixxin.focusd-island` | `agent_status/editor_terminal.rs` | 只装了旧扩展的用户点会话跳不到终端 |
| 链接协议 `focusd://` | 已删除（E36.6.5，2026-11-18：`fuyu://` 一起删了，第 3 版待接手见 E56，#893） | 第三方插件注册过的 OAuth 回调失效（也属 C 类，随 E36.6 一起定） |
| 旧设置备份和主题文件 `"app": "fly-island"` | `system/settings_backup.rs`、`src/lib/settings-backup/backup.ts`、`src/lib/theme/theme.ts` | 改名前导出的备份导不回来 |
| 待办迁移命令的旧 key 名 | `todos/migration.rs`、`src/features/todos/{api,normalize,storage}.ts` | `migrate_todos` 的参数就是这几个名字；E36.3.38 正在改待办，等它合入后再看能不能顺手收进新的服务里 |
| 待办旧默认目录 `Documents\FocuSD` | `home_dir/migration.rs`、`system/todo_export.rs` | 老用户的 Markdown 待办迁不进家目录 |
| 旧版 QQ 诊断通知的标题 `FocuSD QQ 通知诊断` / `FocuSD QQ notification diagnostic` | `qq_notifications/listener.rs`、`examples/probes/qq_notification.rs` | 这里是认出诊断通知好过滤掉，不是显示；发出的通知（`repair-qq-notification-registration.ps1`）早就叫 Fuyu。删了旧版留下的诊断通知会被当成 QQ 消息（D81.1 原计划放在 A 类，改错后在 a39da7fa 恢复） |
| 开发版找旧快捷方式 | `scripts/build-exe.mjs` | 只在开发机上用，影响很小，也可以现在删 |
| 插件审核器认旧数据目录 | `packages/plugin-review/src/scan.mjs` | 检查插件有没有偷读本应用数据时漏掉旧目录；建议一直留 |

- **能不能收拢**：代码已经大体收拢了（Rust 的 `rename_migration/`、前端的 `renamedKeys.ts`）；剩下散在 agent_status、设置备份、待办里的，都紧挨着各自的新逻辑，硬搬到一个模块反而让那些模块依赖迁移模块。建议不搬代码，而是 A4 在 `contracts.md` 加「改名兼容（D17）」一节，把上表连同删除时间点写进去，每处常量统一以 `LEGACY_` / `OLD_` 开头，到时间按表一次删干净。
- **什么时候能删**：等用户定（问题 1）。

## C 类：旧插件系统第 2 版里的（建议随 E36.3 / E36.6 一起去掉）

133 个文件、844 处，占了总数的一半：

- `plugins/examples/dev.focusd.*`（7 个示例插件、31 个文件、451 处）、`plugins/packages/*.zip`（已签名发布）、`plugins/market/`、`plugins/drafts/`、`plugins/index.json`（签名的市场索引，地址还是 `TixXin/fly-island`，给旧版岛屿读）。
- `src-tauri/src/plugin_host/`：内置插件 id `focusd.*`、`FOCUSD_PLUGIN_*` 环境变量、旧清单名、`--focusd-*` CSS 变量、`acquireFocusdApi`、页面来源 `*.plugin.focusd.invalid`、签名域串 `focusd-plugin-package/1`。
- 前端里内置插件的 id 常量 `focusd.cc-connect`、`focusd.ssh-proxy-tunnel`、`focusd.center-pattern`、`focusd.claude-usage`、`focusd.session-ring`：E36.3.39–E36.3.45 把它们迁成第 3 版内置插件时自然换掉，第 3 版用不带前缀的 id（计时器已经是 `timer`）；`plugin_kernel/v2_builtins.rs` 里从 `focusd.*` 迁设置的映射要留到 E36.6。
- `packages/fuyu-plugin`、`packages/create-fuyu-plugin`、`packages/powershell`、`plugins/sdk`、`plugins/schema`、`scripts/plugins/` 的旧名兼容（`focusd-plugin.json`、`.focusdignore`、`*-Focusd*` 别名、`lib/focusd.ps1`）；`docs/plugins/`、`docs/architecture/plugins/{v1-design,v2-platform,author-signing,builtins}.md`；对应的 `tests/scripts/*-plugin.test.mjs`。
- 理由：改名计划定过「旧名字至少保留到插件 API 下一个大版本」，第 3 版就是这个大版本；示例插件改 id 或改 `lib/` 要升版本、用作者密钥重新签名，而 E36.6 本来就要用新接口把 7 个官方插件整体重写、删掉整个第 2 版。现在单独改是白干一遍，还会撞正在跑的 E36.3 任务。
- **要和插件两个总控对一下的一件**：`packages/plugin-cli`（第 3 版新写的 `fuyu-plugin` 2.0）里还带着 `FLY_ISLAND_PLUGIN_SIGNING_KEY` 和 `~/.fly-island-plugin/` 的旧私钥位置。这是新代码，不必背旧包袱：把两台机器上的私钥挪到新位置后就能删（见 E 类）。
- 还要请插件开发总控在 E36.6 的验收里加一条「仓库里没有 `focusd` 插件 id 和旧名兼容」，避免下线后漏掉。

## D 类：历史文档（不改）

230 个文件、422 处：`docs/tasks/0-archive/`（183 个文件）、`docs/releases/`（34 份发布说明）、`docs/architecture/history/`（含 rename-plan 本身）、`docs/research/`（7 份）、`docs/reviews/`、`docs/investigations/`。它们写的是当时的事，按改名计划不改。

## E 类：本机路径、仓库名、已发布的东西（逐条判断）

| 什么 | 现状 | 建议 |
|---|---|---|
| GitHub 仓库 `TixXin/fly-island`、`TixXin/focusd-plugins` | 已改名，旧版岛屿靠 GitHub 重定向拿更新和市场 | 代码里不用改；**这两个名字永远不能再建仓库**，否则老用户收不到更新 |
| `flyl1u/fly-island` | 上游原仓库，`workflow.md`、`contracts.md` 里提到 | 别人的仓库名，留着 |
| 邮箱 IMAP ID `"name" "fly-island"` | `mail/client_id.rs`，每次连邮箱发给邮件服务器 | 改成 `fuyu`；163 / 126 只要求发 ID 命令，不看名字。放进 A1，提交说明写清 |
| 远程审批令牌的盐 `focusd-remote:` | `agent_approval/config.rs`，远端 hook 装好时存的是加盐后的值 | 改了已装的远端 hook 全部失效、要重装；不值得，等哪天 hook 本来就要升级时一起换 |
| hook 脚本里的环境变量 `FOCUSD_AGENT_STATUS_DIR/PATH` 和互斥量 `FocuSD.AgentStatus` | 编译进程序的 `agent_status/hooks/*`，新旧 hook 同时在跑时靠互斥量互斥 | 同上：改脚本内容会让已装的 hook 显示要修复，等下次 hook 升级一起改 |
| 插件签名私钥旧位置 `~/.fly-island-plugin/`、`FLY_ISLAND_PLUGIN_SIGNING_KEY` | `packages/fuyu-plugin`、`packages/plugin-cli`、`scripts/plugins/plugin-signing.mjs` | 用户在两台机器上把私钥挪到新位置后，第 3 版的 `plugin-cli` 可以删旧位置；第 2 版的随 E36.6 |
| 发版签名配置旧位置 `~/.tauri/fly-island`、`FOCUSD_SIGNING_CONFIG` | `scripts/signing-dir.mjs` | 同上：确认两台机器都已经在新位置，就删旧位置 |
| `FOCUSD_PLUGIN_AUTHOR_KEY`、`FOCUSD_DPAPI_INPUT` | `scripts/plugins/` | 第 2 版市场的签名脚本，随 E36.6 |
| 已发布的 npm 旧包 `fly-island-plugin`、VS Code 旧扩展 | 改名时已标弃用（由用户做） | 不用管 |
| 本机文件夹 | Mac 上是 `~/Desktop/projects/Fuyu`；lane 文件夹 2026-11-13 已去掉 | Windows 那台的主工作区如果还叫 `fly-island`，要不要改名由用户定（问题 4），改了要同步用户自己的快捷方式和终端 |

## 任务和顺序

建议在 D 组（质量与发布，改名 D17 在这一组）建一个父任务和 5 个子任务，各开一个 issue；已建 D81（#668）和 D81.1–D81.5（#669–#673）。

| 任务 | 内容 | `--scope` | 能不能马上开 | 验证 |
|---|---|---|---|---|
| D81 | 父任务：去掉旧名（A 类全部，B / C / E 的去向写在任务里） | — | — | — |
| D81.1 | A1 Rust 内部名字、测试样例、内部协议标记，加 E 类的 IMAP ID | 上面 A1 表里的文件，`src-tauri/src/mail/client_id.rs`、`src-tauri/examples/probes/qq_notification.rs` | 马上；开工前 `pnpm tasks conflicts` 看 D48（截图、剪贴板弹窗、翻译）有没有碰同一个文件，`agent_status/` 要确认 E36.3.37 还没认领 | `cargo test`、`pnpm build:exe`，`pnpm mq:try` 拿 Windows CI |
| D81.2 | A2 剪贴板导出文件名、音效包清单名 | `src-tauri/src/clipboard_history/transfer.rs`、`src/features/agent-status/sounds/`、`src/i18n/sections/settings/sounds.ts`、`tests/unit/agent-sounds.test.mjs`、`docs/architecture/contracts.md` | 马上，和 D81.1 并行（文件不重叠） | `cargo test`、`pnpm build:exe`、`pnpm check`、`pnpm build`，设置窗口的回归页 |
| D81.3 | A3 开发工具的环境变量和脚本 | `src-tauri/src/dev_lane.rs`、`src-tauri/src/dev_lane/`、`src-tauri/src/notification_diagnostics.rs`、`scripts/{stop-running-island,prune-build-cache,verify-first-run-notifications}.*`、`scripts/plugins-v3/install-demo.mjs`、`scripts/tasks/`、对应的 `tests/scripts/` | 等 D81.1 或 D81.2 有一个做完（同时最多 2 个要编译的会话） | `cargo test`、`pnpm build:exe`、`pnpm check`、`pnpm build` |
| D81.4 | A4 当前文档、`contracts.md` 新节、三份 AGENTS.md | 上面 A4 列的文档 | 马上，只写文档不算编译名额；`contracts.md` 等 D81.2 提交后再动，免得同时改 | 无需构建，Markdown 能读；改 AGENTS.md 先加载 `fuyu-skill-writing` |
| D81.5 | A5 前端测试样例 | `tests/regression/`、`tests/unit/` 里的样例 | 等 E36.3.51、E36.3.37 合入 | `pnpm check`、`pnpm test:regression --update-snapshots`（快照只该变样例文字） |

- 第一波派 D81.1、D81.2（要编译）加 D81.4（文档）；D81.1 / D81.2 做完一个再派 D81.3；D81.5 挂依赖等 E36.3。
- 每个提交只做改名，不顺手改别的；提交号报给 `Fuyu-[总控] 全局` 整批合入，组长不自己 land。
- C 类不建任务，SendMessage 给 `Fuyu-[总控] 插件系统` 和 `Fuyu-[总控] 插件开发`，请他们在 E36.3.39–45、E36.6 的说明里加上「去掉 `focusd` 旧名」这一条。
- 做完后清点一遍，剩下的旧名只该出现在 B、C、D、E 表列出的地方。

## 要你定的

1. **B 类兼容代码要不要定删除时间点？** 建议：保留到 2027-05（改名后半年）或 0.5.0 之后，哪个晚按哪个；到时发版说明写「从 0.3.5 及更早的版本升级，请先升到 0.4.x」。也可以不定，一直留。
2. **C 类（第 2 版插件里的旧名）是等 E36.6 一起删，还是现在就改？** 建议等：现在改要重新签名 7 个示例插件、撞正在跑的 E36.3 任务，而 E36.6 本来就要整体重写它们。
3. **README 末尾「2026 年 11 月由 fly-island 改名为浮屿」这句留不留？** 留着能让搜旧名字的人找到这里；删了就彻底看不到旧名。建议留在中文和英文 README，翻译版跟着。
4. **Windows 那台机器的主工作区文件夹如果还叫 `fly-island`，要改名吗？** 只影响本机，改名要先停掉那台机器上的会话和 `pnpm tauri dev`。
5. **Windows 那台的插件签名私钥和发版签名配置在新位置吗？** Mac 上查过：发版签名已经在 `~/.tauri/fuyu`，没有旧的 `~/.fly-island-plugin/`。Windows 那台如果也都在新位置（`~/.fuyu-plugin/`、`~/.tauri/fuyu`），代码里的旧位置就能删（第 3 版的放进 D81.3，第 2 版的随 E36.6）。

## 用户的决定（2026-11-16）

- 说「按计划开始」，上面的建议照做：B 类保留，删除时间先记为 2027-05 或 0.5.0 之后（哪个晚按哪个）；C 类等 E36.6；README 末尾的改名说明留着。
- 问题 4（Windows 主工作区文件夹）和问题 5（Windows 上的签名私钥位置）还没答复，不影响 D81.1–D81.5；在答复前 D81.3 不删签名私钥的旧位置。
