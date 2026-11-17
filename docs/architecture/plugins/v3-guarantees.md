# 插件平台第 3 版：内核的保证清单

方案「从 rutis 借鉴的」里的「保证清单，每条配测试」（[方案](v3-everything-plugin.md)）。这一页列出内核（宿主进程、它和 Rust 之间的管道、它给窗口开的 WebSocket）对插件和对浮屿的每一条承诺，一条一行，每条都写明哪个测试在守着它。做成开源基座以后，这是别人敢用的依据。

- 测试文件都在 `packages/plugin-base/test/`（表里省掉这个前缀），Rust 的在 `src-tauri/crates/plugin-base/`。
- 跑法：`node --test packages/plugin-base/test/`（也在 `pnpm test` 里）；Rust 的 `cargo test --manifest-path src-tauri/Cargo.toml -p plugin-base`。
- **状态**：「守住」= 测试通过；「做不到」= 内核现在做不到，测试已经写好并标成 `todo`（跑的时候显示 ⚠，不算失败），改好之后去掉 `todo`，状态改成「守住」。
- 加承诺、改承诺时，测试和这一页在同一个提交里改。一条承诺没有测试，就不算承诺。

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
| 7 | 冲突的错误里写明**已经提供这个服务的是哪个插件**（`plugins.yml` 里的 id） | `guarantees-more.test.mjs` › the status of a conflicting provider names the plugin that already provides the service | 守住 |

第 7 条：冲突时，失败的那个插件的错误前面加一句「这个服务已经由插件 `<id>`（`<plugins.yml` 里的 name>）提供」，按提供者 fiber 的 `provisions` 对回加载器的条目（`src/host/status.mjs`）。

## 清理和回滚

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 8 | 插件停用时，它的每个清理恰好执行一次；再启用后重新执行，再停用时又执行一次 | `guarantees.test.mjs` › every cleanup runs exactly once when a plugin is disabled, and again on the next start | 守住 |
| 9 | 插件在 `apply` 里同步抛错：状态是 `failed`，错误里有原因，它已经登记的副作用都撤掉 | `guarantees.test.mjs` › a plugin that throws while starting is reported as failed and what it registered is undone | 守住 |
| 10 | 插件的异步 `apply`（返回 Promise）失败：同样是 `failed`，`await` 之前登记的副作用和监听器都撤掉 | `guarantees-more.test.mjs` › a plugin whose async apply rejects is failed, and its effects and listeners are undone | 守住 |
| 11 | 插件文件不存在：状态是 `failed`，错误里有文件名，不会悄悄不加载 | `guarantees.test.mjs` › a plugin whose file is missing is reported as failed, not left silent | 守住 |
| 12 | 包在 `ctx.effect` 里的定时器、用 `ctx.on` 登记的监听器，在插件停用后不再触发 | `guarantees-more.test.mjs` › timers in an effect and event listeners never fire after the plugin is disabled | 守住 |
| 13 | 内核给插件**受管定时器**（`ctx.setTimeout`、`ctx.setInterval`），插件停用时自动清掉 | `guarantees-more.test.mjs` › the kernel gives plugins managed timers that stop with them | 守住 |
| 14 | 宿主的 `stop` 让每个插件的清理都执行，使用者先于提供者 | `guarantees-more.test.mjs` › stopping the host runs the cleanup of every plugin, dependents first；`host-flags.test.mjs` › the host runs with code generation from strings disallowed, as the release host does | 守住 |

第 13 条：`plugin-base` 在根上下文挂了 `ctx.setTimeout`、`ctx.setInterval`、`ctx.sleep`（`src/host/timer.mjs`），插件不用声明依赖就能用；内部用 `ctx.effect`，插件停用时清掉，停用时还在 `sleep` 的会以 `inactive` 拒绝；每个插件还活着的定时器数由宿主的 `timers()` 给出，留给第 8 步的资源统计。

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
| 20 | 插件的监听器抛错，不影响同一事件的其他插件的监听器 | `guarantees-errors.test.mjs` › a listener that throws does not stop other plugins' listeners for the same event | 守住 |
| 21 | 插件里没人接的 Promise 拒绝不会让宿主退出 | `guarantees-errors.test.mjs` › a stray promise rejection in a plugin does not take the host down | 守住 |
| 22 | 插件定时器回调里没人接的异常不会让宿主退出 | `guarantees-errors.test.mjs` › an uncaught throw in a plugin's timer does not take the host down | 守住 |
| 46 | 每个插件报出它的受管定时器、监听器、服务数，以及（近似的）CPU 和 `apply` 耗时 | `guarantees-health.test.mjs` › each plugin reports its timers, listeners, services, CPU and apply time；`main-health.test.mjs` › a window gets the host's own numbers and each plugin's usage in its snapshot | 守住 |
| 47 | 同一个插件 60 秒内出错 5 次就被停用，状态是 `auto-disabled` 并写明原因，副作用都撤掉；不写回 `plugins.yml`，配置重读也不放出来，宿主重启后照常加载 | `guarantees-health.test.mjs` › a plugin that keeps failing is switched off for this run only, without touching plugins.yml | 守住 |
| 48 | 出错分散在时间窗之外不会触发停用，错误数和最后一个错误照样记下 | `guarantees-health.test.mjs` › errors spread out beyond the window do not switch a plugin off | 守住 |
| 49 | 在宿主进程里，按调用栈归到插件的没人接的 Promise 拒绝也计入出错次数，反复出现就停用这个插件，宿主不退出 | `main-health.test.mjs` › a plugin whose stray rejections keep coming is switched off and says why | 守住 |

第 20 条：`vendor/cordis` 的 `emit` 打了补丁，逐个 `try/catch`，错误记到监听器所属插件的日志里（`internal/` 开头的内核事件照旧抛出），见 `vendor/README.md`。

第 21、22 条：`main.mjs` 接住 `uncaughtException` 和 `unhandledRejection`，按错误栈里的文件地址归到插件（`src/host/blame.mjs`），记成 `error` 日志并经 `log` 通知交给 Rust（带 `plugin` 字段），宿主不退出。归不到任何插件的错误（内核自己的）照旧退出，让 Rust 重启宿主。同一个插件短时间内反复出错时停用它，见第 47–49 条，规则写在 [v3-boundary.md](v3-boundary.md)「反复出错自动停用」。

## 安全模式和开发模式

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 50 | 安全模式 `third-party` 只留 `essential` 和 `builtin` 插件，其余的状态是 `safe-mode` 并写明是哪一档，代码一行都不执行 | `guarantees-health.test.mjs` › safe mode third-party keeps built-in plugins and holds back the rest, saying why；`main-health.test.mjs` › the host started with --safe holds back third-party plugins and says so in ready | 守住 |
| 51 | 安全模式 `minimal` 只留 `essential`；依赖被拦下的服务的插件是 `waiting` | `guarantees-health.test.mjs` › safe mode minimal keeps only essential plugins, and their users wait for what is held back | 守住 |
| 52 | 宿主进程收到不认识的 `--safe` 值时照常加载全部插件，不起不来；`startHost` 直接拒绝不认识的值 | `main-health.test.mjs` › an unknown --safe value starts every plugin instead of failing the host；`guarantees-health.test.mjs` › an unknown safe mode is refused | 守住 |
| 53 | 带 `--dev`（Node 带 `--expose-internals`）时，改了插件文件就换成新代码 | `main-health.test.mjs` › with --dev the host swaps in a plugin's new code when its file changes | 守住 |

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
| 39 | 宿主一退出就被发现，不等下一次心跳（管道一断就唤醒看管线程） | `tests/supervisor.rs` › a_host_that_dies_is_noticed_without_waiting_for_the_next_heartbeat | 守住 |

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
| 54 | 插槽项按 `order` 排序、同序保持注册顺序；`single` 插槽只留最后一项；超出 `max` 的截断，超出 `perPlugin` 的报 `too-many`；往未定义插槽注册立即报 `no-slot` | `slots.test.mjs` › items come out in order, and a list slot shows at most its maximum；`slots.test.mjs` › a single slot shows only the item added last；`slots.test.mjs` › adding to a slot that does not exist fails at once and says which；`slots.test.mjs` › one plugin cannot fill a slot past its share, and built-in items have no share | 守住 |
| 55 | 同 `id` 的插槽项显式替换已有项并记下被替换者，替换方卸载后恢复原项；每项单独包错误边界，渲染抛错只影响该项 | `slots.test.mjs` › adding an item with an existing id replaces it, records what was replaced, and brings the old one back when the replacement is removed；`slots.test.mjs` › an item that throws while rendering shows the fallback for that item alone, and the rest still render | 守住 |
| 56 | 窗口加载器在 `import()` 前先核对文件存在与 MIME，加载后注册插槽，插件卸载或升版时先撤掉旧插槽项；单个插件加载失败不影响同窗口其余插件 | `loader.test.mjs` › a plugin's window code is loaded, puts its items in slots, and they go when the plugin goes；`loader.test.mjs` › a new version is loaded from a new address, and the old one's items are gone first；`loader.test.mjs` › a missing file, a module without a plugin and a plugin that throws are each reported, and the others still load | 守住 |

## 服务、Rust 通道、来源核对与二分排查（第 3 阶段）

| # | 承诺 | 测试 | 状态 |
|---|---|---|---|
| 57 | 带版本的服务（`defineService`）在宿主与窗口调用时都校验方法与事件声明、执行超时保护；提供者下线时未完成的调用立即以 `peer-gone` 失败，事件监听随插件卸载自动清理 | `services.test.mjs` › a plugin provides a versioned service, another calls it and hears its events, and stopping the provider cleans up；`service-proxy.test.mjs` › a window calls a declared method by service name, within the declared time plus a little；`window-services.test.mjs` | 守住 |
| 58 | `ctx.rust` 只允许内置插件调用和监听，第三方插件调用立即报 `forbidden`；支持进度流式回调（`onProgress`），Rust 端断开时未决调用立即以 `peer-gone` 失败 | `rust.test.mjs` › a plugin calls Rust and gets the answer or Rust's own error code；`rust.test.mjs` › only built-in plugins may call Rust or listen to its events; third-party plugins are refused with forbidden | 守住 |
| 59 | 内置插件按 `builtins.json` 加载，`plugins.yml` 不能篡改内置插件的 `kind` 或代码路径，关掉内置插件后其服务、定时器、监听器和窗口入口全部撤掉 | `builtins.test.mjs` › built-in plugins run without an entry in plugins.yml, with the kind the app's list gives them；`builtins.test.mjs` › entries in plugins.yml cannot make a plugin built-in or swap a built-in's code；`builtins.test.mjs` › plugins.yml switches a built-in plugin off, and everything it set up goes with it | 守住 |
| 60 | 按来源（`market`、`manual`、`dev`）校验 `package.json` 清单：市场和手动安装的包拒绝 `experimental` 接口，未声明却注册的服务或窗口在状态里标出 `undeclared` | `sources.test.mjs` › a market or hand-installed package that uses experimental interfaces fails with the reason; the same code loads from a development folder；`sources.test.mjs` › services and windows a plugin did not declare show up in its status | 守住 |
| 61 | 二分排查（`host.bisect`）只在本轮运行停用指定第三方插件并标明 `bisect` 原因，不改写 `plugins.yml`，也不会停用内置或必需插件 | `bisect.test.mjs` › a bisect switches the listed plugins off for this run only, says why, and brings them back when the list changes | 守住 |
| 62 | 不依赖浮屿业务的最小示例应用可端到端跑通外壳管道、宿主进程、版本化服务、第三方插件与窗口插槽 | `minimal-app.test.mjs` › a minimal application without Fuyu business code runs end-to-end across shell, host, services and window slots | 守住 |
