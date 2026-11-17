# 启动竞态全项目排查

2026-11-16。起因：用户报「fuyu 更新后有时候邮箱界面显示『邮箱服务尚未就绪』，重启就正常」。查明是启动竞态，随后把同一模式在整个项目里扫了一遍。

## 机制

Tauri 2 先按 `tauri.conf.json` 建窗口，再跑 `src-tauri/src/lib.rs` 的 `.setup()` 闭包。webview 的 IPC 请求能在 setup 没执行完时就被处理，于是「在 setup 的某个 `init()` 里 set、在命令里 get」的全局状态会读到空。

**更新后更容易撞上**：首次启动要做 `apply_pending_restore`、改名迁移、插件重装等额外工作，setup 变长，窗口抢跑的机会变大。这解释了「有时候」和「重启就好」。

setup 里无条件执行的步骤顺序（Windows，只数无条件的，`mail::init` 是第 22 个）：

```text
1 apply_pending_restore  2 tray::build_tray  3 tray_menu::prebuild  4 builtins::init
5 coexist::init  6 clipboard_history::init  7 translation::init  8 screenshot::init
9 voice_input::init  10 timer::init  11 claude_usage::init  12 file_shelf::init
13 sync::init  14 todos::init  15 agent_approval::init  16 home_dir::after_start
17 local_api::init  18 ssh_tunnel::init  19 cc_connect::init  20 plugin_host::init
21 plugin_kernel::init  22 mail::init  23 qq_notifications::init  24 wechat_reminders::init
25 notification_diagnostics::start  26 island 窗口块  27 system::fullscreen::start
28 media_control::init  29 system_levels::init  30 agent_status::init  31 device_events::init
```

排得越靠后越危险。**前端的过滤帮不上忙**：所有 builtin runner 经 slot 注册，而 `packages/plugin-base/src/client/slots.mjs:56` 的 `off` 集合要等 `get_builtin_plugins` 返回后才填，所以首帧所有 runner 一律挂载并发命令，之后才被开关摘掉。按功能开关筛竞态清单会漏。

## 怎么扫的

机械扫 `src-tauri/src/` 里 `static X: OnceLock<..>` 且同时有 `.set(` 和 `.get()` 的点，再逐个追命令可达性；另加 `OnceLock<Mutex<Option<T>>>` 一类（外层 `get_or_init` 看着安全，内层 Option 只有 init 才填）。

两个盲点，记下来免得下次再漏：

- 同一文件里既有 `get_or_init` 又有 `get` 的会被「有 get_or_init 就跳过」的规则滤掉。
- 跨行的方法链（`SERVICE\n    .set(..)`）匹配不到 `SERVICE.set(`。QQ 和微信就是这么漏掉第一遍的，它们的 init 比邮箱还靠后。

## 修复状态（2026-11-17）

先确认了一件事，它决定修法：setup 跑在事件循环的 Ready 里（`tauri-2.12.5/src/app.rs:2688`），占着主线程；但 wry 在 Windows 上建 WebView2 时会跑嵌套消息循环，IPC 就在这时被处理。所以**同步命令也会插进 setup 中间执行，而且它跑在主线程上，不能在命令里等 init**——一等，setup 就再也走不下去。async 命令跑在 tokio 线程上，可以等。

| 项 | 修法 |
|---|---|
| mail | 命令改用 Tauri 注入的 `AppHandle`，删掉 `APP` OnceLock 和 `mail.notReady` |
| QQ、微信（Windows） | 启动时会调的命令（`get_qq_notification_state`、`set_qq_auto_clear`、`set_wechat_expose_ui`、`set_wechat_hide_taskbar_button`、`set_wechat_auto_clear`）多收一个 `AppHandle`，先 `init` 再取服务；`init` 里 `SERVICE.set` 失败（并发时别人先建好了）改成返回 Ok，不再报「已启动」 |
| file-shelf | `set_file_shelf_options` 先 `init`（本来就幂等） |
| todos | `get_todos_state`、`apply_todos_change` 也先 `service::init`，补上 PR #164 的另一半 |
| 审批开关 | `set_agent_approval_enabled` 先把想要的值存进 `WANTED`，服务在就直接设；`init` 建好服务后再读一次 `WANTED`。两边都用 SeqCst，谁先谁后都不会丢 |
| 内置插件开关（P0） | 两个 async 命令先在 `spawn_blocking` 里等 `ready`（每 50 ms 看一次，最多 10 秒），再改表、写 `plugins.yml` |
| 同步设备 id（P0） | `sync::device::init` 提前到 `lib.rs` 里 `home_dir::init` 旁边，builder 之前，目录用 `APPDATA` 加应用标识就能算出来 |

有意没修的：

- `plugin_host::host()`：`init` 不幂等；前端收到 `reset` 视图事件会重新拉，能自愈。
- `agent_approval::endpoint()` 那条 P0：触发点 `install_agent_status_hooks` 是用户在设置里点按钮才发，启动时撞不上。
- `builtins::is_enabled()` 在 init 前全返回 true：只影响内部判断，不落盘。
- macOS 的 QQ、微信、媒体：`init` 不幂等，要单独改，这次没碰。

## P0：静默丢写，而且落盘

不报错、返回成功，比红字更难发现。

| 位置 | setup 序号 | 触发 | 后果 |
|---|---|---|---|
| `plugin_kernel/builtins.rs:391,415` | 4 | 岛 `useLegacySwitches.ts:24`（`reconcile:true`，`IslandApp.tsx:71`）迁移旧开关；`messages/plugin/useSourceSwitches.ts:20` 镜像 qq/wechat 开关 | `slot.file` 还是 None → `if let Some(file)` 整段跳过，开关/配置只改内存不写 `plugins.yml`，返回 Ok，重启即丢 |
| `agent_approval/mod.rs:220` `endpoint()` | 15 | `install_agent_status_hooks`（`agent_status/mod.rs:270`→`claude_code.rs:57,71-77`），远端分支 `remote_setup.rs:60-63` | `approval_hook()` 拿到 None → 写进 `~/.claude/settings.json` 的 hooks **缺审批钩子**；`hook_endpoint_unknown():236` 同时为 false，连警告都不给，用户以为装好了 |
| `sync/clock.rs:109` | 13 | `write_settings_file`（`settings_file.rs:95`→`stamp_changes:56`）；待办、剪贴板收藏/snippets 的写入 | `device::id()` 失败就用 `FALLBACK_DEVICE="local"` 打 HLC 戳，且 `get_or_insert_with` **永久缓存**，这一进程之后所有同步戳都记在假设备名下，影响冲突裁决 |

`builtins.rs:367` 的 `is_enabled()` 在 init 前对任何 id 都返回 true（disabled 集为空），`agent_approval::switched_on`、`screenshot::is_enabled`、`file_shelf::is_enabled` 会一起误判为「开」。

## P1：启动就发、一次性、失败即终局

前端不重试，用户看到报错或功能缺失，直到重启。

| 位置 | setup 序号 | 前端触发点 | 后果 |
|---|---|---|---|
| `mail/accounts.rs:104`（**已修**） | 22 | `messages/mail/useMailAccounts.ts:59` restore 分支 | `mail.notReady`「邮箱服务尚未就绪。」 |
| `qq_notifications/mod.rs:153` `service()` | **23** | `get_qq_notification_state`（`useQQNotifications.ts:68`）、`set_qq_auto_clear`（`useQQAutoClear.ts:10`），岛和设置页都无条件发 | 「QQ 通知服务尚未就绪。」 |
| `wechat_reminders/mod.rs:261` `service()` | **24** | `set_wechat_expose_ui` + `set_wechat_hide_taskbar_button`（`useWeChatReminders.ts:69,71`）、`set_wechat_auto_clear`（`useWeChatAutoClear.ts:10`），**不看微信开关** | 「微信提醒服务尚未就绪。」；曝光 UI 和去任务栏按钮没生效 |
| `agent_approval/mod.rs:260` `service()` | 15 | `agent_approval_pending`（`useAgentApprovals.ts:75`）、`set_agent_approval_enabled`（`:87`），都不看 enabled | 「The approval endpoint is not running.」审批点按不动 |
| `file_shelf/mod.rs:204` `service()` | 12 | `set_file_shelf_options`（`useFileShelf.ts:58`，`shelfEnabled` 时）。**file-shelf 启动只发这一条**，items 从返回值拿 | 「The file shelf is not initialized.」中转站空着 |
| `plugin_host/mod.rs:152` `host()` | 20 | `list_plugin_views` ×2（`usePluginViews.ts:25`，两个调用方 `usePluginPages.ts:10` 和 `IslandCollapsedBar.tsx:97`） | 「The plugin host is not initialized.」插件页和折叠条状态缺失。`dev-island-issues.md:65` 记的「岛有时看不见、控制台只有插件宿主还没初始化」很可能就是它 |

QQ、微信、file-shelf 三处的 `init` **已经是幂等的**（`qq:133`、`wechat:231`、`file_shelf:168` 都有早返回），只差在命令里调一次。

## P2：能走到命令，但会自愈或影响很小

| 位置 | 序号 | 说明 |
|---|---|---|
| `plugin_host/mod.rs:152` `host()` | 20 | 另外约 40 个命令都经它。启动路径上的 `list_plugins` 有 30×1s 重试（`useBuiltinPlugin.ts:6`），其余要用户开设置页才发 |
| `plugin_kernel/mod.rs:28` SUPERVISOR | 21 | `get_plugin_host_connection` 已由 `29174870` 改成答「待就绪」而不是「没开」，WS 拨号退避重发，会自愈 |
| `plugin_kernel/mod.rs:30` TRACKER | 21 | `exit_plugin_safe_mode` 返回 `Ok(false)`，用户点「退出安全模式」什么也没发生 |
| `plugin_host/lifecycle.rs:55` STATE | 20 | `HOST.set`(:131) 到 `sync_processes`(:145) 之间：`run_plugin_command` 报「The plugin is not running.」；`set_plugin_setting` 已写盘但插件静默不被唤醒 |
| `plugin_host/keybindings.rs:51` STATE | 20 | 冲突列表静默为空，2 秒后线程起来会 apply，自愈 |
| `sync/engine.rs:190` `engine()` | 13 | 4 个 sync 命令报「Sync is not started.」**前端 `features/sync/api.ts` 目前没有任何 importer，是死代码**，实际撞不上 |
| `ssh_tunnel/mod.rs:57`、`cc_connect/mod.rs:39` | 18、19 | 报错还会经 `remote.rs:134` 传给 6 个 cc-connect remote 命令；但启动都不发，要进设置页或 onboarding 的 push 幕 |
| `coexist/mod.rs:203`、`timer/mod.rs:68`、`builtins.rs:402,428` | 5、10、4 | 只是事件不发（`dev-priority-changed`、`timer-shortcut-status`、`builtin-plugins-changed`），写盘和返回值都对，别的窗口不刷新 |

## 不算竞态

- `home_dir.rs:27` HOME：`home_dir::init` 在 `lib.rs:97`，**builder 和 setup 之前**，从第一个 IPC 起就安全。
- `clipboard_history/links.rs:106` `store(app)`：真正的按需 init，已修。
- `shortcut_capture.rs`、`wallpaper/mod.rs`、`win32/wallpaper.rs`、`island/glass.rs`、`cc_connect/runner.rs`、`cc_connect/feishu.rs`、`ssh_tunnel/mod.rs:42` STATE、`system/update_runtime.rs`、`agent_status/approval_hotkeys.rs`：由命令自己填或自初始化。
- 只有后台线程/热键回调读的：`translation/mod.rs:43`、`voice_input/mod.rs:22`、`screenshot/hotkeys.rs:34`、`win32/session_notifications.rs`、`todos/service.rs` 的 ANNOUNCE/PUBLISH（设在 HOST 之前，过了 `host()` 就必然有）、`local_api` 的 SERVICE/MIRROR（命令都先过 `plugin_host::host()`，序号 20 > 17）。

## macOS 专属

`qq_notifications/macos.rs:99`（序号 23）、`wechat_reminders/macos.rs:99`（24）报同样的「尚未就绪」，且 init **不幂等**（二次 set 返回 Err）；`media_control/adapter_macos.rs:224`（28）报「The MediaRemote adapter is not available.」，7 个媒体命令受影响。

## 已经修过的，和一个半修

- **mail**（本次）：`connect_qq_mail` / `set_qq_mail_enabled` 改成从 Tauri 注入的 `AppHandle` 拿句柄，删掉 `accounts.rs` 的 `APP` OnceLock 和 `mail.notReady` 文案。命令名和前端传的参数不变。
- **v3 宿主连接**（`29174870`）：setup 前答「待就绪」而不是「没开」，让窗口继续等。这是这类问题的另一种修法——不改初始化时序，只把「未就绪」和「已关闭」分开。
- **todos（PR #164）只修了一半**：`service::init` 的 HOST 用 `get_or_init` 确实幂等，但只有 `migrate_todos` 有 `service::init(&app)?`（`todos/mod.rs:19`）。`get_todos_state`（`:27`）和 `apply_todos_change`（`:33`）没有，仍会返回「The todo store is not initialized.」。现在不出事靠两点：前端一定先调 `migrate_todos`，且 `apply_todos_change` 有 2s 无限重试（`todoStore.ts:7`）。

## 为什么没有一个总开关

考虑过三种全局修法，都不划算：

- **把窗口挪到 setup 之后再建**：8 个窗口的配置要从 `tauri.conf.json` 搬进 Rust，`create: false` 的语义也得重写，改动大且拖慢首帧。
- **前端渲染前等后端就绪**：`main.tsx` 加一道门确实只要几行，但岛现在能在 setup 跑完前先画出来，加门会把首帧推迟到 setup 结束，撞冷启动验收线（`v3-progress.md` 的「不比基线慢」）。
- **统一 invoke 封装里重试**：前端**没有**统一封装层，约 50 个 `api.ts` 各自 `import { invoke }`，要全改。

所以按模块修，用仓库已有的两种办法：命令里按需 init（todos 那样，要求 init 幂等），或把「未就绪」和「已关闭」分开让前端等（v3 那样）。**不幂等、不能直接照抄的**：`plugin_host::init:131`（二次返回 Err）、`agent_approval::init:96`（会重复注册后台）、两个 macos 的 `init`。

## 没查的

- 全部结论来自静态读码，没跑构建，`#[cfg]` 分支的可达性不是编译器确认的。
- `Mutex<Option<..>>` 里的纯缓存（agent_status 各 CACHE、剪贴板 popup/preview、截图 session）按「不是 init() 填的」排除，没逐个追命令。
- 设置页非默认分类、岛内非默认页面按 slot 懒渲染推断，没逐个展开二级面板。
