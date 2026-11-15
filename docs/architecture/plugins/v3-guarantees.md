# 插件平台第 3 版：内核的保证清单

方案「从 rutis 借鉴的」里的「保证清单，每条配测试」（[方案](v3-everything-plugin.md)）。这一页列出内核（宿主进程、它和 Rust 之间的管道、它给窗口开的 WebSocket）对插件和对浮屿的每一条承诺，一条一行，每条都写明哪个测试在守着它。做成开源基座以后，这是别人敢用的依据。

- 测试文件都在 `packages/plugin-base/test/`（表里省掉这个前缀），Rust 的在 `src-tauri/crates/plugin-base/`。
- 跑法：`node --test packages/plugin-base/test/`（也在 `pnpm test` 里）；Rust 的 `cargo test --manifest-path src-tauri/Cargo.toml -p plugin-base`。
- **状态**：「守住」= 测试通过；「做不到」= 内核现在做不到，测试已经写好并标成 `todo`（跑的时候显示 ⚠，不算失败），改好之后去掉 `todo`，状态改成「守住」。
- 加承诺、改承诺时，测试和这一页在同一个提交里改。一条承诺没有测试，就不算承诺。
- 窗口一侧的加载器和插槽（第 6 步）的承诺，由做第 6 步的会话在它合入时加到「窗口」一节。

## 依赖和启动顺序

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 1 | 插件需要的服务没人提供时不启动，状态是 `waiting`，并写明在等哪个服务 | `guarantees.test.mjs` › a plugin does not start until the services it needs are provided, and says which one it waits for | 守住 |
| 2 | 加载顺序跟着依赖走，和 `plugins.yml` 里的书写顺序无关 | `guarantees.test.mjs` › the load order follows dependencies, not the order in the configuration | 守住 |
| 3 | 依赖链（A 依赖 B，B 依赖 C）按 C、B、A 的顺序起；C 停掉时 A、B 都停（先停 A），都变成 `waiting`；C 回来后按 C、B、A 再起 | `guarantees-more.test.mjs` › a dependency chain starts in order, stops above a provider that goes away, and starts again when it returns | 守住 |
| 4 | 服务的提供者停掉时，使用它的插件跟着停，回到 `waiting`；提供者回来后使用者自动重启 | `guarantees.test.mjs` › when the provider of a service goes away its users stop, and start again when it comes back | 守住 |
| 5 | 装在宿主目录之外的插件拿到的是和宿主同一份内核（`instanceof Context` 成立） | `guarantees.test.mjs` › a plugin installed outside the host's directory gets the same kernel as the host | 守住 |

## 服务冲突

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 6 | 同一个服务的第二个提供者启动失败，状态是 `failed`，错误里写明服务名；第一个提供者不受影响 | `guarantees-more.test.mjs` › a second provider of the same service fails without touching the first, and its error names the service | 守住 |
| 7 | 冲突的错误里写明**已经提供这个服务的是哪个插件**（`plugins.yml` 里的 id） | `guarantees-more.test.mjs` › the status of a conflicting provider names the plugin that already provides the service | **做不到** |

第 7 条的现象：Cordis 的错误是 `service "svc" has been registered at <P>`，`<P>` 是第一个提供者的类名或 `name` 导出，不是它在 `plugins.yml` 里的 id；两个插件的类名一样时根本分不出来。失败的那一个（谁）能从状态的 `id` 看出来，冲突的对象（和谁）看不出来。建议的改法：`src/host/status.mjs` 给失败的条目补一个 `conflictsWith`：从 `ctx.reflect.store` 里找到那个服务的 `impl`，用 `impl.ctx.fiber` 对回加载器的条目，取它的 `id`。方案「错误信息写明双方」要的就是这个。

## 清理和回滚

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 8 | 插件停用时，它的每个清理恰好执行一次；再启用后重新执行，再停用时又执行一次 | `guarantees.test.mjs` › every cleanup runs exactly once when a plugin is disabled, and again on the next start | 守住 |
| 9 | 插件在 `apply` 里同步抛错：状态是 `failed`，错误里有原因，它已经登记的副作用都撤掉 | `guarantees.test.mjs` › a plugin that throws while starting is reported as failed and what it registered is undone | 守住 |
| 10 | 插件的异步 `apply`（返回 Promise）失败：同样是 `failed`，`await` 之前登记的副作用和监听器都撤掉 | `guarantees-more.test.mjs` › a plugin whose async apply rejects is failed, and its effects and listeners are undone | 守住 |
| 11 | 插件文件不存在：状态是 `failed`，错误里有文件名，不会悄悄不加载 | `guarantees.test.mjs` › a plugin whose file is missing is reported as failed, not left silent | 守住 |
| 12 | 包在 `ctx.effect` 里的定时器、用 `ctx.on` 登记的监听器，在插件停用后不再触发 | `guarantees-more.test.mjs` › timers in an effect and event listeners never fire after the plugin is disabled | 守住 |
| 13 | 内核给插件**受管定时器**（`ctx.setTimeout`、`ctx.setInterval`），插件停用时自动清掉 | `guarantees-more.test.mjs` › the kernel gives plugins managed timers that stop with them | **做不到** |
| 14 | 宿主的 `stop` 让每个插件的清理都执行，使用者先于提供者 | `guarantees-more.test.mjs` › stopping the host runs the cleanup of every plugin, dependents first；`host-flags.test.mjs` › the host runs with code generation from strings disallowed, as the release host does | 守住 |

第 13 条的现象：`vendor/cordis` 的核心里没有定时器服务（Cordis 的定时器是单独的插件，没有拷进 `vendor/`），插件只能自己把定时器包在 `ctx.effect` 里（第 12 条证明这种写法可靠）。方案「资源监控和出错处理」要求插件用内核的受管定时器，好给每个插件计 CPU、数资源。建议的改法：`plugin-base` 加一个很小的定时器服务（`setTimeout` / `setInterval` / `sleep`，内部用 `ctx.effect`），在 `startHost` 里挂上；资源数统计做的时候一起加。

## 配置

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 15 | 改了一个插件的 `config`，只重启它自己，并用新的配置启动；别的插件不动 | `guarantees-more.test.mjs` › changing one plugin's config restarts only that plugin, with the new config | 守住 |
| 16 | 开了监听时，改 `plugins.yml` 就停用、启用插件（按配置调和） | `guarantees.test.mjs` › editing the configuration file disables and enables plugins | 守住 |

## 反复装卸不留东西

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 17 | 反复停用、启用同一个插件 1000 次，不留下定时器、监听器、副作用，JS 堆增长不到 8 MB | `guarantees.test.mjs` › loading and unloading a plugin 1000 times leaves no timers, listeners or effects behind | 守住 |
| 18 | 在单独的宿主进程里（带 `--disallow-code-generation-from-strings`）装卸 1000 次：活动的句柄和定时器（`process.getActiveResourcesInfo()`）和装卸前一样，GC 后的堆增长不到 2 MB、外部内存不到 1 MB；宿主停下后一个句柄都不剩 | `guarantees-churn.test.mjs` › in a host process, 1000 loads and unloads of a plugin leave the handles, timers and heap as they were（子进程是 `churn-child.mjs`） | 守住 |

第 18 条量出来的数（这台 Mac，Node 26.12）：先热身 50 次，之后 1000 次 GC 后的堆从 8.7 MB 到 9.2 MB，3000 次到 9.4 MB；句柄一直是 1 个（插件自己的那个定时器）。**常驻内存（RSS）会涨**：0 次 29 MB，1000 次 81 MB，2000 次 120 MB，之后 3000、4000 次都停在 121 MB。涨的是 V8 的新生代：频繁分配时它把新生代从 6 MB 撑到上限 67 MB，空闲后回落到 1 MB（`heapTotal` 从 78 MB 回到 12 MB），但 macOS 不催的话不会把这些页从 RSS 里拿走。所以这不是泄漏，有上限；测试不按 RSS 判断，按堆、外部内存和句柄判断。8 小时长跑看的是宿主的 `phys_footprint`，见 [v3-kernel-measurements.md](../../investigations/v3-kernel-measurements.md)。

## 出错处理

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 19 | 插件启动失败等内核的错误和警告，宿主经管道的 `log` 通知交给 Rust | `main.test.mjs` › the host passes on errors from the kernel, such as a plugin that failed | 守住 |
| 20 | 插件的监听器抛错，不影响同一事件的其他插件的监听器 | `guarantees-errors.test.mjs` › a listener that throws does not stop other plugins' listeners for the same event | **做不到** |
| 21 | 插件里没人接的 Promise 拒绝不会让宿主退出 | `guarantees-errors.test.mjs` › a stray promise rejection in a plugin does not take the host down | **做不到** |
| 22 | 插件定时器回调里没人接的异常不会让宿主退出 | `guarantees-errors.test.mjs` › an uncaught throw in a plugin's timer does not take the host down | **做不到** |

第 20 条的现象：Cordis 的 `emit` 用普通循环调监听器，第一个抛错的监听器之后的都不执行，错误抛给发事件的那一方（可能是另一个插件，也可能是宿主自己）。建议的改法：宿主给事件分发包一层，逐个 `try/catch`，错误按监听器所属的插件记成 `error` 日志；或者在 `vendor/cordis` 的 `emit` 里打这个补丁（记进 `vendor/README.md`）。

第 21、22 条的现象：`main.mjs` 没有 `uncaughtException` / `unhandledRejection` 的处理，Node 按默认行为以退出码 1 退出，Rust 的看管把整个宿主连同所有插件重启（约 0.3 秒，插件内存里的状态全丢）。一个插件的一处疏忽就让所有插件重启一遍。建议的改法：`main.mjs` 加这两个处理，按错误栈里的文件地址归到插件（方案「出错处理」写的就是这个），记成 `error` 日志并经 `log` 通知交给 Rust，宿主不退出；同一个插件短时间内反复出错时停用它，在状态里写明原因。归不到插件的（内核自己的错）照旧退出，让 Rust 重启。

## 宿主进程和管道

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 23 | 宿主在内核和配置里的插件都加载完后发 `ready`，带协议版本、插件状态和窗口的端口、令牌；回答 `ping` 和 `status` | `main.test.mjs` › the host says it is ready with its plugins, and answers ping and status | 守住 |
| 24 | 插件和内核打印的东西一律到标准错误，标准输出只给协议 | `main.test.mjs` › what plugins print goes to stderr, so the pipe to Rust stays clean | 守住 |
| 25 | 宿主读到标准输入关闭时停掉插件、2 秒内退出 | `main.test.mjs` › the host stops its plugins and exits when its stdin closes | 守住 |
| 26 | 宿主收到 `stop` 后回答 `true`，然后以退出码 0 退出 | `main.test.mjs` › the host exits when asked to stop | 守住 |
| 27 | 宿主在禁止从字符串生成代码（`--disallow-code-generation-from-strings`）时照常加载插件 | `host-flags.test.mjs` › the host runs with code generation from strings disallowed, as the release host does | 守住 |
| 28 | 宿主不需要 `--expose-internals` 就能加载插件（只有热重载要它） | `host-flags.test.mjs` › the host loads plugins without --expose-internals, which only hot reload needs | 守住 |
| 29 | 基座只依赖 Node、`vendor/` 里的内核、`ws` 和它自己 | `boundary.test.mjs` › the base imports nothing but Node, the vendored kernel, ws and itself | 守住 |
| 30 | 管道上的调用拿到处理函数的结果；抛出的错误带着错误码回来；方法不存在回 `-32601` | `rpc.test.mjs` › a call gets the handler's result, and a thrown error comes back with its code | 守住 |
| 31 | 对方一走，所有在等它的调用立刻以 `peer-gone` 失败，不等超时 | `rpc.test.mjs` › when the other side goes away, every call waiting on it fails at once with the reason；Rust：`rpc.rs` › a_waiting_call_fails_at_once_when_the_host_goes_away | 守住 |
| 32 | 每个调用都有超时，超时报 `timeout` | `rpc.test.mjs` › a call that gets no answer times out instead of hanging；Rust：`rpc.rs` › a_call_without_an_answer_times_out | 守住 |

## Rust 的看管

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 33 | 宿主就绪后能调用，它的标准错误转到 Rust 的日志 | `tests/supervisor.rs` › the_host_becomes_ready_answers_calls_and_its_stderr_is_passed_on | 守住 |
| 34 | 宿主退出后立刻重启 | `tests/supervisor.rs` › a_host_that_dies_is_started_again_at_once | 守住 |
| 35 | 宿主不回心跳就被换掉 | `tests/supervisor.rs` › a_host_that_stops_answering_heartbeats_is_replaced | 守住 |
| 36 | 反复失败时重启的间隔从立刻开始翻倍，到上限为止 | `tests/supervisor.rs` › a_host_that_keeps_failing_waits_longer_each_time；`supervisor.rs` › the_first_restart_is_immediate_then_the_wait_doubles_up_to_the_cap | 守住 |
| 37 | 一直不就绪的宿主过了期限就放弃这一次 | `tests/supervisor.rs` › a_host_that_is_never_ready_is_given_up_on_after_the_deadline | 守住 |
| 38 | 停止时先请宿主自己停，之后的调用都失败 | `tests/supervisor.rs` › stopping_asks_the_host_to_stop_and_calls_fail_afterwards | 守住 |

## 窗口

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 39 | 带对令牌的窗口拿到快照，调用有回答，事件按顺序到 | `sockets.test.mjs` › a window with the token gets a snapshot, its calls answered and the events in order | 守住 |
| 40 | 窗口调用里抛出的错误带着错误码回来 | `sockets.test.mjs` › a thrown error in a call comes back with its code | 守住 |
| 41 | 来源不在名单里的连接在升级成 WebSocket 之前就被拒 | `sockets.test.mjs` › an unknown origin is refused before the socket opens | 守住 |
| 42 | 令牌不对、没打招呼、协议版本不对，各用自己的关闭码关掉 | `sockets.test.mjs` › a wrong token, a missing hello and a wrong protocol are each closed with their own code | 守住 |
| 43 | 宿主换了端口和令牌重启后，窗口重新连上并拿到新的快照 | `sockets.test.mjs` › when the host restarts on a new port and token, the window reconnects and gets a fresh snapshot | 守住 |
| 44 | 窗口发现漏了事件，要一份新快照，不带着缺口往下走 | `sockets.test.mjs` › a window that misses an event asks for a snapshot instead of going on with a gap | 守住 |
| 45 | 连着宿主的窗口随时听到插件状态的变化 | `main.test.mjs` › a window connected to the host hears about plugin changes as they happen | 守住 |
