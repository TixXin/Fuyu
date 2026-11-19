# 插件平台第 3 版：跨进程的边界规则和协议

方案「从 rutis 借鉴的」里的「跨进程的边界规则」（[方案](v3-everything-plugin.md)）。第 3 版有三个进程边界：Rust 和宿主、宿主和各窗口、窗口和 Rust。这一页是它们共同遵守的规则，以及 Rust 和宿主、宿主和窗口之间的协议。

## 规则

| # | 规则 | 为什么 |
|---|---|---|
| 1 | **过边界的只能是能序列化成 JSON 的值**。函数、类实例、React 元素、`Error` 对象都不过边界；错误转成 `{ code, message, data }` | 两边是不同的进程，没有共享的堆 |
| 2 | **每条消息都能单独看懂**：带上下文需要的全部信息，不依赖「对方应该记得」 | 任何一边都可能重启，重启后对方的记忆就没了 |
| 3 | **对方一走，等它的调用立刻带着原因失败**，错误码 `peer-gone`，不等超时 | 等超时会把一次崩溃变成一串几秒的卡顿；第 0 阶段的 rutis 小样就是这样做的 |
| 4 | **每个调用都有超时**，超时报 `timeout` 并写明方法名和等了多久 | 卡死的对方不会自己说话 |
| 5 | **同步等待不能跨进程成环**：A 等 B 的回答时，B 不能反过来同步等 A | 两边都在等，就是死锁；Rust 的心跳会把宿主当成卡死重启 |
| 6 | **做不到的事明确报错，不悄悄降级**：方法不存在（`-32601`）、参数不对、对方没就绪，都要返回错误 | 静默失败是第 0 阶段最难查的问题（插件不加载也不报错） |
| 7 | **状态不能只放在宿主的内存里**：宿主随时可能被重启，需要留下来的东西写到 Rust 一侧或文件里 | 宿主崩溃或卡死后会被换掉，内存里的东西全丢 |
| 8 | **宿主的标准输出只给协议用**：插件和内核打印的东西一律到标准错误 | 一行不是 JSON 的输出就会让对方读错 |
| 9 | **协议有版本号**：宿主在 `ready` 里报 `protocol`，不兼容的改动升版本，两边都认识的才继续 | 宿主和 Rust 以后会分开更新（决定 16 之后 Node 是用户电脑上的） |

## Rust 和宿主之间（协议 2）

标准输入输出上的 JSON-RPC 2.0，一行一条消息（UTF-8，`\n` 结尾）。Rust 写宿主的标准输入、读它的标准输出；宿主的标准错误由 Rust 逐行转发到日志。实现：Rust 一侧在 `src-tauri/crates/plugin-base`（`rpc.rs`、`serve.rs`、`registry.rs`、`supervisor.rs`），宿主一侧在 `packages/plugin-base/src/host`（`rpc.mjs`、`rust.mjs`、`main.mjs`）。

协议 2（2026-11-15 起，E36.3.3）在协议 1 上加了：宿主调 Rust 的方法、Rust 推事件给宿主、流式片段和取消。Rust 只认 2：`ready` 里的 `protocol` 不是 2 或没写，这次启动算失败，原因写明双方的版本（「the plugin host speaks protocol X, but Fuyu only speaks protocol 2」），照常按退避重启。

### 宿主发给 Rust 的通知

| 方法 | 参数 | 什么时候 |
|---|---|---|
| `ready` | `{ protocol, pid, node, plugins, safe, windows: { port, token } }`，`protocol` 是 `2`，`plugins` 是每个插件的状态，`safe` 是安全模式（`null`、`third-party` 或 `minimal`），`windows` 是给窗口连的本机 WebSocket（见下一节） | 内核和配置里的插件都加载完（成功或失败都算） |
| `log` | `{ at, type, name, text }`，只有 `error` 和 `warn` | 内核记了错误或警告，例如插件启动失败 |
| `fatal` | `{ message }` | 内核本身起不来；发完宿主以退出码 1 退出 |
| `clients` | `{ paths, roots }`：`paths` 是去重后的界面文件路径（和窗口拿到的 `clients` 列表里的 `path` 相同）；`roots` 是 `[{ prefix, dir }]`，`paths` 里用到的每个 `dev/<id>` 前缀对应的开发文件夹（宿主解析好的绝对路径，2026-11-19 起，E63.9） | `ready` 之前一次，之后界面登记每变一次就发一次，每次整份换掉。Rust 的 `fuyu-plugin` 协议按它决定窗口能读哪些文件（见下面的「窗口能读的文件」）。宿主重启、退出时 Rust 清空。2026-11-15 起，E36.3.22 |
| `cancel` | `{ id }` | 宿主不再等它发出的第 `id` 个调用（插件停用、宿主这边超时）。还没开始的不跑；正在跑的处理函数用 `call.cancelled()` 能看到，结果丢掉、不回答 |

### Rust 发给宿主的请求

| 方法 | 参数 | 回答 |
|---|---|---|
| `ping` | 任意 | `{ at, echo }`。Rust 每秒发一次，2 秒没回答就当宿主卡死 |
| `status` | 无 | 每个插件的状态，格式见下面「插件状态」 |
| `stop` | 无 | `true`，然后停掉所有插件（每个清理都执行）再退出 |
| `bisect` | `{ off: [插件 id…] }` | `{ off, unknown }`：整份换掉二分排查的停用名单（见下面「二分排查」），`unknown` 是名单里现在没有对应插件的 id。名单里有不是第三方的插件时报 `not-third-party`（`data` 是 `{ refused: [{ id, kind }] }`，`kind` 是 `essential`、`builtin` 或 `internal`），什么都不改；`off` 不是非空字符串的数组时报 `bad-params`；宿主还没加载完插件时报 `not-ready`。2026-11-15 起，E36.3.10 |

宿主回答的错误码：JSON-RPC 自己的是数字（`-32601` 没有这个方法，`-32000` 其余），宿主自己抛的 `RpcError` 原样带字符串码（上面的 `not-third-party` 这些）。

### Rust 发给宿主的通知

| 方法 | 参数 | 说明 |
|---|---|---|
| `event` | `{ name, data }` | Rust 推给宿主的事件（`Supervisor::emit`）。插件用 `ctx.rust.on(名字, 监听器)` 收；监听器记在宿主的 Rust 桥（`rust.mjs` 的 `RustBridge`）自己的表里，只交给经 `ctx.rust.on` 登记的监听器，不发到公共事件总线，`ctx.on("rust:…")` 收不到。登记是插件 ctx 上的一个 `ctx.effect`，插件停用时自动撤掉；监听器的耗时、出错和个数照常算进这个插件的 `cpuMs`、`errors`、`listeners`。宿主没在跑时 `emit` 返回 `peer-gone` |
| `progress` | `{ id, data }` | 宿主发出的第 `id` 个调用的流式片段（见下面「流式」） |

现在 Rust 推的事件（Rust 侧经 `plugin_kernel::emit_to_host`，宿主没就绪时直接丢掉）：

| 事件名 | `data` | 谁收 |
|---|---|---|
| `media.changed` | `{ kind: "track" \| "playback", at, sessionId }`，和窗口事件 `media-session-changed` 同一份 | 内置插件 `music`：合并、去重后读一次 `media.nowPlaying`，经 `media/v1` 的 `changed` 转给插件（E72） |

### 宿主发给 Rust 的请求

宿主里的插件用 `ctx.rust.call(方法, 参数, { timeoutMs?, onProgress? })`（`Context` 上的 `rust`，类型 `RustApi`）。方法名是点分的小驼峰（`app.version`），参数是一个 JSON 值，没有就是 `null`。

**只有内置插件能用 `ctx.rust`**（2026-11-15 起，E36.3.18）：`call` 和 `on` 先沿插件的上下文找到它在宿主里的加载项，看宿主加载它时记下的来源（`sources.mjs` 的 `SOURCE`，插件自己报的不算），是 `builtin` 才放行。市场、手动安装、开发文件夹的插件，`plugins.yml` 里直接写文件的插件，以及不属于任何加载项的代码，一律回 `forbidden`（`data` 是 `{ plugin, source }`），它们经内置插件提供的服务用 Rust 的能力。Rust 的事件也只交给 `ctx.rust.on` 的监听器（见上表 `event`），第三方插件用 `ctx.on("rust:…")` 听不到：以后 Rust 推的系统事件（媒体、通知、热键）要经服务、按权限给第三方。同一个进程里没有真正的隔离，这是减损，不是沙箱（见 [v3-secrets.md](v3-secrets.md)）。

Rust 的方法是标了 `#[plugin_base::host_service("<方法>")]` 的领域函数，`Serve::registered()` 读出全部（宏的写法见 [v3-services.md](v3-services.md)「Rust 那条路」，E36.3.4）。现在有：

| 方法 | 参数 | 回答 |
|---|---|---|
| `app.version` | 无 | `{ version, platform }` |
| `app.echo` | `{ value }` | `{ echo: value }` |
| `app.platformSupport` | 无 | `{ os, unsupported, devBuild }`，和 Tauri 命令 `get_platform_support` 同一个函数 |

上表只列宿主自带的 `app.*`，全部方法以 `@fuyu/plugin-services` 的 `RUST_METHODS` 为准；方法和它们参数、回答的 TypeScript 类型由 Rust 生成在同一个包的 `RustMethods`。

Rust 怎么跑：
- 每个请求交给登记的处理函数，在工作线程里跑（默认 4 个线程，排队的最多 256 个，加上正在跑的一共 260 个，再多立刻回 `busy`）。宿主的读线程不跑处理函数，所以心跳不受影响。
- 每个方法有自己的超时（默认 30 秒），从 Rust 收到请求算起，排队的时间也算。超时回 `timeout`，`data` 是 `{ method, timeoutMs }`；之后处理函数的结果丢掉。
- 处理函数 panic 只让这一个调用失败，回 `panic`，`message` 写明方法名和 panic 的内容；工作线程照常接下一个。
- 宿主退出或卡死被换掉时：这一代宿主的调用全部标成取消，排队的不再跑，正在跑的结果丢掉；工作线程跑完手上的就退出，不卡 supervisor。
- 写宿主的标准输入在单独的写线程里排队，宿主卡死、管道写满时只卡这个线程，不拿着锁卡住心跳。
- 边界规则 5：处理函数里不能同步等宿主，在工作线程里调 `Rpc::call` 直接返回 `WouldWait` 错误。

错误一律是 `{ code, message, data? }`，`code` 是字符串，和 [v3-services.md](v3-services.md)「错误」一致（内置插件把 Rust 的方法包成服务时原样传出）：

| `code` | 什么时候 |
|---|---|
| `no-method` | Rust 没有登记这个方法 |
| `bad-params` | 参数不对：不是 JSON 对象，或某个字段的类型不对（`data` 是 `{ method, field }`） |
| `bad-result` | 处理函数的返回值编不成 JSON |
| `timeout` | Rust 一侧超时（见上）；宿主一侧也有超时（默认 120 秒，`timeoutMs` 只能改短），`message` 是「<方法> got no answer in <毫秒> ms」 |
| `busy` | 正在跑和排队的已经满了（见上） |
| `panic` | 处理函数 panic |
| `failed` | 处理函数要的状态 Rust 没给（例如没有 `AppHandle`），或工作线程起不来 |
| `peer-gone` | 宿主一侧：Rust 那头的管道断了，或宿主不是 Rust 拉起的（没有通道） |
| `inactive` | 宿主一侧：发起调用的插件停用了，调用立刻失败，同时给 Rust 发 `cancel` |
| `forbidden` | 宿主一侧：调用的插件不是内置插件（见上），不发给 Rust；`ctx.rust.on` 同样抛这个码 |
| 处理函数自己的码 | 如翻译的 `no-secret`，原样传出 |

### 流式

会分几次给结果的方法，处理函数调 `call.progress(片段)`，Rust 发通知 `progress { id, data }`，最后照常回答。宿主把片段交给 `onProgress`。调用已经取消或回答后不再发 `progress`。形状和 [v3-services.md](v3-services.md)「流式」一致：一个 id、多条片段、最后一个结果。

### 插件状态

`status` 的回答、`ready` 的 `plugins`、给窗口的快照和 `plugins` 事件里，每个插件都是同一个格式（协议 1 里加的字段都是可选的，旧的读法不受影响）：

```
{ id, name, state, kind, source, waitingFor?, error?, reason?, blocked?, undeclared?, unreachableClients?, lastError?, usage }
```

| 字段 | 意思 |
|---|---|
| `state` | `running`、`waiting`（`waitingFor` 列出在等的服务）、`failed`（`error` 是原因）、`disabled`（`plugins.yml` 里关了）、`auto-disabled`（反复出错被宿主停了，`reason` 写明）、`safe-mode`（被安全模式拦下，`reason` 写明）、`bisect`（二分排查这一步把它停了，`blocked` 是 `{ by: "bisect" }`，`reason` 写明）、`loading`、`stopped`、`unloading` 之一 |
| `kind` | `essential`、`builtin`、`third-party`。只由内置插件清单给（2026-11-15 起，E36.3.6，见 [v3-builtins.md](v3-builtins.md)）：清单里的插件取清单写的值，其余插件一律是 `third-party`，`plugins.yml` 条目里写的 `kind` 不算数 |
| `source` | 插件从哪来（2026-11-15 起，E36.3.9）：`builtin`（内置插件清单）、`market`、`manual`（已安装的包）、`dev`（开发文件夹）、`file`（直接写模块的条目），见 [v3-sources.md](v3-sources.md) |
| `blocked` | 清单没通过、包没装这类原因拒绝加载时才有：`{ by, errors }`，`state` 是 `failed`（E36.3.9，见 [v3-sources.md](v3-sources.md)「拒绝加载」） |
| `undeclared` | 插件实际做了、清单里没写的事，键名就是该补的清单字段（`provides`、`client`、`slots`）；都对得上时没有这个字段，只标记不拦（E36.3.9，见 [v3-sources.md](v3-sources.md)「声明和实际」） |
| `unreachableClients` | 清单里写了、但文件不在任何窗口能读的文件夹里的界面（窗口名的数组，例如装好的包被链接到了数据目录外）。这些界面不会登记、窗口也加载不到，设置的插件页显示原因；都能读时没有这个字段（2026-11-19 起，E63.9） |
| `lastError` | `{ at, text }`，这个插件最近一次出错（只在出过错时有） |
| `usage` | `{ cpuMs, calls, applyMs, timers, listeners, services, clients, errors }`，见下 |

`usage` 的每一项：

| 项 | 怎么来的 | 准不准 |
|---|---|---|
| `cpuMs`、`calls` | 经内核登记的回调（`ctx.on` 的监听器、`ctx.setTimeout` / `ctx.setInterval` 的回调、`apply`）每次执行的同步部分计时，累加；嵌套时（一个插件的监听器里发事件、触发另一个插件的监听器）只算各自的那段 | **近似**：用的是墙上时间，不是线程 CPU 时间；`await` 之后的部分、插件自己建的定时器（`setTimeout` 而不是 `ctx.setTimeout`）、`ctx.effect` 里的代码都不算；死循环量不出来（宿主会被 Rust 的心跳判定卡死重启） |
| `applyMs` | 最近一次 `apply` 的耗时；异步的 `apply` 算到它返回的 Promise 落定。还没跑过是 `null` | 准 |
| `timers` | 还活着的受管定时器数 | 准 |
| `listeners` | 它登记的事件监听器数，含 `ctx.rust.on` 的（不含内核的 `internal/` 事件） | 准 |
| `services` | 它提供的服务数 | 准，只数条目本身的 fiber，插件里再用 `ctx.plugin` 建的子插件提供的服务不算 |
| `clients` | 它登记的界面文件数 | 准 |
| `errors` | 这次宿主运行以来记到它名下的错误数：监听器、受管定时器、`apply` 里抛出的，以及按调用栈归到它的未捕获异常和没人接的 Promise 拒绝 | 归不到插件的不算 |

### 反复出错自动停用

同一个插件 **60 秒内出错 5 次**（`src/host/gate.mjs` 的 `FAULT_LIMIT`），宿主就停用它：撤掉它的全部副作用，状态变成 `auto-disabled`，`reason` 写明次数和最后一个错误。

- **只在这次运行里有效**：不写回 `plugins.yml`（用的是加载器条目上的内存里的拦截，不是条目的 `disabled`），配置文件被改了重读也不会把它放出来；宿主重启（包括 Rust 因崩溃重启它）后照常加载。
- 依赖它提供的服务的插件跟着回到 `waiting`。
- 这是稳定性功能，不是安全措施：恶意插件可以不报错。

### 安全模式

宿主带 `--safe <档>` 启动时，按 `kind` 拦下插件，被拦下的状态是 `safe-mode`、`reason` 写明是哪一档：

| 档 | 留下 |
|---|---|
| `third-party` | `essential` 和 `builtin` |
| `minimal` | 只有 `essential` |

Rust 每次拉起宿主（包括自动重启）都重新决定带不带 `--safe`、带哪一档（2026-11-15 起，E36.2.11），依次看：

| 入口 | 档 | 什么时候退出 |
|---|---|---|
| 环境变量 `FUYU_PLUGINS_V3_SAFE`（开发版，值是上面两档之一） | 变量的值 | 去掉变量后重启浮屿。插件页不给「退出安全模式」按钮 |
| 连续 4 次启动失败 | `minimal` | 同下 |
| 插件内核启动时按着 Shift | `third-party` | 只管这一次运行；或点插件页的「退出安全模式」 |
| 连续 2 次启动失败 | `third-party` | 宿主在安全模式下连续跑满 60 秒，计数清零，下一次启动照常；或点「退出安全模式」（清零并按正常模式重启宿主） |

- **启动失败**：宿主一次启动没能连续跑满 60 秒（退出、心跳卡死、60 秒内没发 `ready` 都算）。不算的：浮屿退出时停掉宿主、浮屿进程自己被杀或崩溃（开发时 `tauri dev` 重编会直接杀进程，插件也不在 Rust 进程里跑）、要求的重启（例如插件页的「退出安全模式」）、找 Node 和下载 Node 的时间（那时还没拉起宿主）；心跳超时时墙上时间比单调时钟多走了 5 秒以上（电脑睡过），也不算。
- **计数**存在数据目录的 `plugins-v3/safe-mode.json`（`{ failures, updatedAt }`，`updatedAt` 是 Unix 毫秒），下次开岛接着用；跑满 60 秒写回 0。按 Shift 不写文件。
- 环境变量的值不认识时当作没设，宿主照常加载全部插件。
- 窗口用 Tauri 命令 `get_plugin_host_connection` 的 `safeMode`（`{ mode, cause, failures }`，`cause` 是 `variable`、`shift` 或 `failures`；不在安全模式时是 `null`）知道是怎么进入的，`exit_plugin_safe_mode` 退出（返回 `false` 表示是环境变量打开的，没有退出）。

### 二分排查

帮用户找出是哪个第三方插件造成的问题：每一步停掉一部分第三方插件，看问题还在不在（2026-11-15 起，E36.3.10 做地基；挑哪一半、界面和 Tauri 命令是 E36.5.9）。

- **名单在 Rust 一侧**：数据目录的 `plugins-v3/bisect.json`（`src-tauri/src/plugin_kernel/bisect.rs`），格式 `{ version, startedAt, updatedAt, step, suspects, off }`：`version` 现在是 `1`，两个时间是 Unix 毫秒，`step` 是走到第几步，`suspects` 是还有嫌疑的第三方插件，`off` 是这一步停掉的。文件坏了、`version` 不认识或有空 id，当作没在排查。
- **宿主不记**（边界规则 7）：Rust 每次拉起宿主（包括崩溃后重启）都按文件把 `off` 作为启动参数带上（每个 id 一个 `--bisect=<id>`），名单里的插件从一开始就不加载；宿主就绪后 Rust 再用 `bisect` 请求发一次，补上启动期间文件变了的情况。不写回 `plugins.yml`。
- **换一步**：Rust 先发 `bisect`，宿主收下了才写文件；宿主拒绝（`not-third-party`）时文件不动；宿主没在跑时只写文件，下次启动生效。宿主收到新名单后，新进名单的插件停下（撤掉全部副作用，依赖它的服务的插件回到 `waiting`），离开名单的重新启动。名单清空、文件删掉，排查就结束了。
- **只停第三方插件**：`kind` 是 `third-party` 的才停（内置插件清单之外的都是，见上面「插件状态」）。`bisect` 请求里有内置插件就整个拒绝；启动参数里带了内置插件的 id 不报错，也不生效。
- **和别的拦法叠在一起**时，状态按这个顺序取第一个：`plugins.yml` 的 `disabled` > 清单没通过（`failed`）> `auto-disabled` > `safe-mode` > `bisect`。插件离开二分排查的名单不会放出被别的原因拦下的插件。安全模式两档都停掉全部第三方插件，所以安全模式下名单照收、看不出效果，退出安全模式后按名单生效。

### 开发模式

宿主带 `--dev` 启动时（Node 还要带 `--expose-internals`），在插件目录上挂 Cordis 的热重载：改了插件的源码就换成新代码，同时监听 `plugins.yml`（等于 `--watch`）。正式版两样都不带。

### 宿主的生命周期

| 情况 | 怎么处理 |
|---|---|
| 启动 | Rust 找到 Node（决定 16），带 `--disallow-code-generation-from-strings` 拉起宿主（宿主自己的参数里有安全模式的 `--safe` 和二分排查的 `--bisect=<id>`，每次拉起都重新决定），放进作业对象（Windows）或自己的进程组（macOS）。等 `ready` 最多 60 秒（新下载的 Node 第一次运行可能要几十秒，第 0 阶段实测） |
| 心跳 | 就绪后每秒一次 `ping`，2 秒没回答就当卡死 |
| 退出或卡死 | 杀掉整个进程组，按退避重启：第一次立刻，之后 0.25、0.5、1 秒……最长 30 秒；连续正常运行满 60 秒后重新从「立刻」算 |
| 浮屿退出 | Rust 发 `stop`，最多等 2 秒再杀。宿主读到标准输入关闭时也会自己停掉插件退出，作业对象 / 进程组兜底宿主卡死的情况 |

## 宿主和窗口之间（协议 1）

宿主在 `127.0.0.1` 上开一个系统分配端口的 WebSocket，只给浮屿自己的窗口连。实现：宿主一侧 `packages/plugin-base/src/host/sockets.mjs`，窗口一侧 `packages/plugin-base/src/client/connection.mjs`，常量在 `src/protocol.mjs`。

### 谁能连

| 关卡 | 做法 |
|---|---|
| 地址 | 只监听回环地址 |
| 令牌 | 宿主每次启动用 `crypto.randomBytes(32)` 生成，只经它和 Rust 之间的私有管道（`ready` 通知）交出去，不写文件、不进命令行参数和环境变量、不进日志。窗口用 Tauri 命令 `get_plugin_host_connection` 向 Rust 要（宿主就绪前返回空，窗口过一会儿再要） |
| 来源 | 握手时核对 `Origin` 头，不在名单里的直接回 HTTP 403，不升级成 WebSocket。名单由 Rust 用 `--origin` 传给宿主：`tauri://localhost`（macOS）、`http://tauri.localhost`、`https://tauri.localhost`（Windows），开发版再加 `devUrl` 的来源（`http://localhost:1420`）。不传时宿主用前三个 |
| 打招呼 | 连上后 2 秒内要发 `hello`，带令牌和协议版本；令牌用定长比较 |

关闭码：`4401` 令牌不对、`4403` 来源不对（实际在握手时就被 403 拒了）、`4408` 没打招呼或第一条不是 `hello`、`4426` 协议版本不对（窗口收到后不再重连）、`4000` 宿主在停止。

### 消息

全部是 JSON 文本帧，单条最大 16 MB；二进制帧会被关掉连接。

| 方向 | 消息 | 说明 |
|---|---|---|
| 窗口 → 宿主 | `{ type: "hello", token, protocol, window }` | 第一条。`window` 是窗口的 label |
| 宿主 → 窗口 | `{ type: "welcome", protocol, seq, snapshot }` | 回答 `hello`。`snapshot` 是当前的全部状态（现在是 `{ plugins, clients, services, host }`，`services` 是当前在提供的服务 `{ name, plugin, methods, events }[]`，`host` 是 `{ pid, node, startedAt, safe, dev, rssBytes, heapUsedBytes, cpuMs }`，宿主进程自己的内存和累计 CPU），`seq` 是最后一个事件的序号 |
| 宿主 → 窗口 | `{ type: "event", seq, name, data }` | 增量。`seq` 每个事件加 1，所有窗口共用一个序列。现在有 `plugins`（插件状态变了，带完整的列表）、`clients`（插件登记的界面文件变了，带完整的列表：`{ id, plugin, window, path, version }`）、`plugin`（插件的宿主部分推给它窗口部分的消息：`{ plugin, topic, data }`）、`services`（在提供的服务变了，带完整的列表）和 `service`（服务的事件：`{ service, event, data }`，见下面「服务」）；`settings.open`（`{ plugin }`，宿主代码调了 `ctx.settings.open()`，岛窗口接，E60.12）和 `island.request`（`{ id, action: "open" \| "collapse", plugin, page? }`，要岛打开或收起这个插件的页面，只有岛窗口接，做完用 `island.result` 回答，E60.16；2026-11-19 起（E76）还有 `{ id, action: "notify", plugin, notice }`，把宿主里 `messages/v1` 的通知交给岛显示，回答 `true` / `false`，即插件拿到的 `shown`） |
| 窗口 → 宿主 | `{ type: "snapshot" }` | 窗口发现序号跳了（中间丢了事件），要一份新的快照，不带着缺口往下走 |
| 宿主 → 窗口 | `{ type: "snapshot", seq, snapshot }` | 回答上一条 |
| 窗口 → 宿主 | `{ type: "call", id, method, params }` | 调用。现在有 `status`，和 `plugin.call`（`params` 是 `{ plugin, method, params }`，转给那个插件用 `ctx.clients.handle` 登记的方法，回答它的返回值；没登记的回 `no-method`），以及服务的 `service.call`、`service.on`、`service.off`（见下面「服务」）。2026-11-19 起（E60.16）还有 `island.open`（`{ plugin, page? }`）和 `island.collapse`（`{ plugin }`）：岛以外的窗口里的插件代码调 `ctx.island` 时经它们转给岛窗口，宿主发 `island.request` 后等岛回答，10 秒没回答回 `timeout`，岛窗口没连上回 `not-ready`；`island.result`（`{ id, value }` 或 `{ id, error: { code, message } }`）只有岛窗口能调，回答 `island.request`；`island.noticeAction`（`{ pluginId, action }`，E76）也只有岛窗口能调，用户点了宿主转来的通知上的按钮时发，宿主的 `messages/v1` 提供方据此发 `action` 事件 |
| 宿主 → 窗口 | `{ type: "result", id, result }` 或 `{ type: "result", id, error: { code, message, data? } }` | 回答调用 |

### 断开和重连

- 连接断了（宿主重启、崩溃、被换掉），窗口里等着的调用立刻以 `peer-gone` 失败。
- 窗口每次重连前都重新向 Rust 要端口和令牌：宿主重启后两样都会变。重连的间隔是 0、0.1、0.25、0.5、1、2 秒，之后一直 2 秒；连上并拿到快照后重新从 0 算。
- 重连后拿到的是一份新的快照（`welcome`），窗口用它替换手里的全部状态，不和旧的合并。
- 交 `welcome` 的快照时连接已经算打开（`connection.state` 是 `open`），`onSnapshot` 里可以直接发调用，补订阅服务事件的 `resubscribe` 就在这里调；`onState("open")` 在 `onSnapshot` 返回之后才通知（E80 之前这时发的调用会被当成没连上而拒绝）。

### 插件的界面文件

插件的宿主部分用 `ctx.clients.add(<窗口名>, <文件的 URL>)` 登记它在某个窗口里的界面代码（插件停用时自动撤掉）。宿主把文件换成插件目录下的相对路径，路径解析成真实路径后不在插件目录里的拒绝（插件启动失败），版本是文件的大小加修改时间。窗口按 `fuyu-plugin://localhost/<路径>?v=<版本>` 加载：先用 `HEAD` 确认文件在、类型是 JavaScript，再 `import()`；版本变了就换地址重新加载，旧的先撤掉。插件的界面代码默认导出一个插件（函数，或带 `apply` 的对象），用 `ctx.slots.add(<插槽名>, { id, order, component, ...元数据 })` 往插槽里放组件（插槽和规则见下面「插槽」），插件停用时这些也自动撤掉。插件的两部分之间：宿主部分用 `ctx.clients.handle(<方法>, fn)` 登记给自己窗口调的方法、`ctx.clients.publish(<主题>, data)` 推消息；窗口部分用 `ctx.host.call(<方法>, params)` 调、`ctx.host.on(<主题>, fn)` 收。窗口部分只能调到、收到它自己那个插件的（按 `plugins.yml` 里的 id 对应），这些登记都跟着插件撤掉。示例在 `packages/plugin-base/examples/hello/`。插件代码里对 `react`、`react/jsx-runtime` 的引用要改写成 `../__shared/react.js` 这样的相对路径（第 0 阶段两个系统都验证过），由程序自带的转接模块提供同一份 React。

**窗口能读的文件**（2026-11-15 起，E36.3.22）：`fuyu-plugin://localhost/` 是白名单，不是整个数据目录。窗口只能读到：程序自带的 `__shared/` 转接模块；`packages/` 下已安装的包；宿主经 `clients` 通知登记过的界面文件所在的顶层目录（例如演示插件登记 `hello/island.js`，整个 `hello/` 都能读），登记的是数据目录根上的单个文件时只放行那一个。`data/`（每个插件的 `ctx.dataDir`）、`plugins.yml` 和它的备份、`safe-mode.json`、`bisect.json`，以及没登记的路径一律 404，就算宿主登记了也不给；`dev/<id>/<相对路径>` 从宿主经 `roots` 报来的开发文件夹取（2026-11-19 起，E63.9），规则和数据目录一样：只放行登记过的界面文件所在的那一层（登记 `dev/clock/dist/island.js` 就放行开发文件夹里整个 `dist/`，`package.json`、`src/`、`node_modules/` 不给），路径不能带 `..`、`\`、`:`、空段，按符号链接解析后必须仍在开发文件夹里，落进数据目录的也拒绝；没报 `roots` 的前缀一律 404。`builtin/` 的映射不做，也是 404（内置插件的界面打包在程序里，见 [v3-builtins.md](v3-builtins.md)「界面文件的地址」）。路径按符号链接解析后再查一遍，链到 `data/` 或数据目录外面都拒绝。插件的界面部分要读自己的数据，用 `ctx.host.call` 让自己的宿主部分读，不直接读文件。回应头照旧是 `Access-Control-Allow-Origin: *`（评估见 [E36.3.22](../../tasks/0-archive/E/E36.3.22.md) 的备注）。

### 服务

宿主里的插件用 `ctx.services.provide(定义, 实现)` 提供带版本的服务（`timers/v1`），别的插件用 `ctx.services.get(定义)` 调，窗口经这条 WebSocket 按名字调。名字、声明、错误码和替换的规则在 [v3-services.md](v3-services.md)，这里只列窗口协议里的部分。2026-11-15 起（E36.3.2），只加不改，`WINDOW_PROTOCOL` 仍是 1；三个方法名在 `@fuyu/plugin-base/protocol` 的 `SERVICE_CALLS`，名字的规则是 `SERVICE_NAME`（正则只有一份，在 `@fuyu/plugin-manifest/names`，`protocol` 转出），默认超时 `SERVICE_TIMEOUT_MS`（30 秒）。声明服务用 `@fuyu/plugin-base/services` 的 `defineService`（不引 Cordis，窗口代码也能用；E36.3.17）。

| 调用 | `params` | 回答 |
|---|---|---|
| `service.call` | `{ service, method, params }` | 方法的返回值（`undefined` 回成 `null`）。只认当前提供者的定义里声明过的方法，别的回 `no-method`；没有提供者回 `not-ready`；超时回 `timeout`（按方法声明的，默认 30 秒）；调用中提供者停了回 `peer-gone`；返回值不是 JSON 回 `bad-result`；提供者抛的错误带字符串 `code` 时原样传出，否则是 `failed` |
| `service.on` | `{ service, event }` | `true`。这个窗口要这个事件；当前提供者没声明这个事件回 `no-event`，还没有提供者时照样记下 |
| `service.off` | `{ service, event }` | `true` |

- **事件照旧广播**：所有窗口共用一个 `seq`，按窗口挑着发会让序号出缺口，所以 `service` 事件和别的事件一样发给每个窗口。`service.on` 决定的是「有没有人要」：一个事件没有任何**已连接**的窗口要，宿主就不往 WebSocket 发。宿主按窗口的 label 记，不跟着连接走：窗口重连后要把它的订阅重新发一遍。
- **任何窗口都能调任何服务**：同权模型下没有按窗口的权限。
- **窗口一侧**：`@fuyu/plugin-base/client` 的 `createServiceProxy(call)`。`get(定义)` 返回和宿主里一样形状的客户端（方法都返回 Promise，`on(事件, 监听器)` 返回撤销函数，同一个事件只发一次 `service.on`，最后一个监听器撤掉时发 `service.off`）；窗口把 `service` 事件交给 `deliver`，把快照和增量里的 `services` 交给 `update`，每次拿到新快照后调 `resubscribe`。客户端的超时是方法声明的超时加 1 秒，让宿主的 `timeout` 先到。
- **流式还没到窗口**：声明了 `progress` 的方法，窗口带 `onProgress` 调会直接以 `unsupported` 失败。只发给调用它的那一个连接的 `{ type: "progress", id, data }` 消息随 E36.3.8 加（v3-services.md「流式」）。

### 插槽

（2026-11-15 起，E36.2.3）岛和设置窗口里能放界面的位置。内置功能和第三方插件走同一套规则。

- **名单和规则**是纯数据，在 `@fuyu/plugin-base/protocol` 的 `SLOTS`（第 5 阶段 `fuyu-plugin build` / `check` 离线检查用）。注册表在 `@fuyu/plugin-base/client/slots`（`createSlots`），不 import Cordis，窗口首屏不用加载内核。
- **每个窗口一个注册表**，模块加载时同步建好（`src/features/plugin-kernel/slots.ts` 的 `windowSlots("island")`、`windowSlots("settings")`）。内置功能在 `src/features/<领域>/plugin/` 里注册：岛的界面在 `island.tsx`、不画界面的接线在 `runners.tsx`，设置窗口的在 `settings.tsx`；窗口用 `import.meta.glob(..., { eager: true })` 把它们一次收进来（岛是 `src/windows/island/slots/pluginFiles.ts`，经 `slots/builtins.ts` 在外壳样式之后载入），首帧就有，加一个功能不用改集中的列表；顺序全靠各项的 `order`。功能那边用 `defineSlot` 拿自己要的那几个字段的类型，不 import 窗口；页面的元数据另放在 `plugin/page.ts`，单元测试不加载组件也能读到；宿主启用并连上之后，加载器只往这个已有的注册表里加第三方项。宿主没启用时代码路径不变，只多一次同步建表。
- **岛这边的类型**：`defineSlot<Props, Meta>(<插槽名>)` 给一个插槽绑上组件 props 和元数据的类型，元数据的类型在 `slots.ts`（`IslandPageMeta` 等）；渲染用 `SlotView`，要项的列表用 `useSlotEntries`。

| 插槽 | 位置 | 种类 | 每插件上限 | 最多显示 | 元数据 |
|---|---|---|---|---|---|
| `island.page/v1` | 展开页 | list | 2 | 不限，页头圆点另有上限 | `title`（插件页面的标题，见 `docs/plugins/services-and-slots.md`「插件的岛页面」）、`icon`、`shortcutOrder`（Alt+数字的顺序）、`headerDot`（在页头出圆点；插件的页面默认出，写 `false` 不出）、`enabled(features)`、`fallback(features)`（这页关掉时回退到哪页）、`fold`（`{ into, when(features), label(t) }`：条件成立时这页不单独出现，作为 `into` 那页里的一个子视图，组件多拿一个 `embedded: true`；现在只有截图历史折进剪贴板） |
| `island.header/v1` | 页头右侧的按钮 | list | 1 | 不限 | `enabled(features)` |
| `island.collapsed/v1` | 收起条 | list | 2 | 不限，用户的「收起条布局」照旧覆盖 | `group`（`gauges`：相邻的合进一个量表框，侧栏也显示）、`width`（收起条要加的宽度）、`hideable`（用户在布局里藏起来后整项撤掉，也不算宽度）、`shown(context)`（现在出不出现，不写就一直出现） |
| `island.collapsed-center/v1` | 收起条的中心图案 | single | 1 | 1 | `width`、`shown(context)` |
| `island.alert/v1` | 刘海提醒 | list | 1 | 窗口只显示排在最前、`active(sources)` 为真的一项 | `active(sources)`、`trailing`（右半边的组件） |
| `island.notice/v1` | 岛上的提示（录屏、计时响铃、截图卡片、复制卡片、提醒、语音输入、第一次提示这类，占收起条的位置，带一排操作按钮） | list | 1 | 窗口只显示排在最前、`active(sources)` 为真的一项 | `active(sources)`、`actions`（操作按钮的组件，和 `component` 拿同一包 props） |
| `island.line/v1` | 收起条主行和它右边的尾巴（会议、Agent 会话、歌词、待办、翻译速览、截图识字、消息预览的前后几块） | list | 2 | 显示哪一项看 `line` / `trail` / `summary` 贡献 | 无 |
| `island.side/v1` | 侧边岛的行 | list | 2 | 显示哪几行、多高看 `side` 贡献 | 无 |
| `island.overlay/v1` | 舞台上不归岛体管的浮层（消息横幅） | list | 1 | 不限 | 无 |
| `island.runner/v1` | 岛上不画界面的组件：挂着就运行（接线 hook：提醒的计时、翻译的快捷键、开发版的实验台动作这类），卸下就停 | list | 1 | 不限 | 无 |
| `island.dev/v1` | 第 1 阶段的开发插槽 | list | 1 | 3 | 无 |
| `settings.category/v1` | 设置窗口的分类 | list | 2 | 不限 | `group`（侧栏分组）、`icon`、`tabs`（子页）、`available(...)`（平台是否支持）、`feature`（所属功能开关）、`aliases`（合并进来的旧分类名） |
| `settings.section/v1` | 设置页里的分节 | list，按 `category` 分组 | 每个分类 4 | 不限 | `category` |
| `settings.runner/v1` | 设置窗口里不画界面的组件：挂着就运行（接线 hook、给窗口报快捷键这类），卸下就停 | list | 1 | 不限 | 无 |

| 规则 | 做法 |
|---|---|
| 名字 | `<窗口>.<位置>/v<N>`：第一段是窗口名，一个窗口只认自己的插槽；不带版本的定义报 `bad-name`。名字只加不改，规则做不兼容的修改时出 `/v2` |
| 没声明的不生效 | 往没有的插槽（包括别的窗口的）注册报 `no-slot`：插件启动失败，窗口照常 |
| 顺序 | `order` 从小到大，相同的按注册先后 |
| 数量 | `list` 显示前 `max` 个（没写就是不限）；`single` 只显示排在最后的一个 |
| 分组 | `groupBy` 的插槽（`settings.section/v1` 按 `category`）每项必须带这个字段，否则报 `bad-item`；每组分别排序、计数，窗口按组取 |
| 每插件上限 | 只管第三方项：同一个插件在一个插槽里（分组的插槽是在一组里）最多 `perPlugin` 项，超了报 `too-many`。内置项不计 |
| 替换 | 注册一个已有的 `id` 会盖住原来那项，`replaces` 按从下到上列出被盖住的拥有者；撤掉哪一项都只撤它自己，露出下面那项。没写 `order` 时沿用被替换项的位置。同一个拥有者再注册同一个 `id` 是换掉自己那项 |
| 拥有者 | `owner` 默认 `builtin`；经宿主加载的插件按 `plugins.yml` 的 id，而且一律算第三方（`external`），项里自己写的 `owner`、`external`、`seq`、`replaces` 都不算数。第 3 阶段内置功能变成插件后改传插件的 id，关掉插件就撤掉它的界面 |
| 元数据 | 项里除了 `id`、`order`、`component`，其余字段原样带给窗口，窗口据此排版（名单见上表） |
| 渲染 | 内置项平铺，不加包裹层（`>` 选择器、`:first-child`、`gap` 都不受影响）；第三方项包 `.plugin-slot` 拿主题变量（见下一节）；每项一个错误边界加一个 `Suspense` |
| 出错隔离 | 一项渲染出错只撤这一项，其他照常（内置项以前会让整个岛白屏）；`console.error` 和 `onError` 带插槽名、`id`、`owner`、是不是第三方 |

**组件拿到的 props 在第 2 阶段是实验接口**：窗口把现有组件要的那包 props 整体传进去，只给内置项用，第三方插件在第 5 阶段之前不承诺；`island.dev/v1` 不传 props。

### 岛的贡献表

（2026-11-16 起，E36.3.51）功能怎么影响岛的形状：功能在自己的 `island.runner/v1` 项里跑 hook，用 `useIslandContributions(<拥有者>, <id>, <列表>)` 往贡献表里写一张清单，外壳（`src/windows/island/`）只读汇总后的结果（`useIslandContributed()`），不 import 功能。表和汇总在 `src/features/plugin-kernel/islandContributions.ts`，React 的接口在 `useIslandContributions.ts`。**第 5 阶段之前这些形状还会改**，现在只给内置功能用，不对第三方承诺。

- **拥有者**是内置插件的 id（`features/<领域>/plugin/owner.ts`）。插件关掉后它写的不再计入汇总；表里原样留着，`builtins-off` 回归页拿它查「关掉的插件还在写」。外壳自己的状态用 `shell`。
- **同一张清单再写一遍不通知**（按 JSON 比较），runner 每次渲染都可以写。
- **功能的状态**放在功能自己的 store（`createRunnerStore`，`runnerStore.ts`）：runner `useProvide`，自己的插槽项 `use()`。外壳不订阅这些 store。
- **点了之后做什么**用 action：功能 `useIslandAction(<id>, <函数>)` 登记，外壳和别的项 `runIslandAction(<id>, <参数>)` 调用。
- **`settled`**：外壳第一次渲染完才置上，页面回退之类要等功能交齐的判断看它。

| `kind` | 字段 | 外壳拿它做什么 |
|---|---|---|
| `line` | `item`（`island.line/v1` 项的 id）、`priority`（`LINE_PRIORITY`，大的先）、`measure`（量宽用的文字）、`extra`（额外宽度）、`page`、`lead`（悬停时领头切到 `page`）、`handle`（侧边把手点了去 `page`）、`action`（点它调的 action）、`label`（读屏文字）、`center`（中心图案嵌在这一行）、`shareable`（上面的行可以和它轮流）、`drop`（速览，盖住别的行，点了调 `action`）、`always`（收起条不显示文字时也显示）、`bare`（不套外壳的文字容器）、`reserve`（占着宽度先不显示） | 收起条主行取 `priority` 最高的一条；收起宽度、点击和悬停的去向跟着它 |
| `trail` | `item` | 主行右边的尾巴（会议的加入按钮），没有提示和预览时显示 |
| `summary` | `item`、`grow`（可选，`{ width, height }`：要多加的宽度和要长到的收起高度，未缩放的 px） | 消息预览那一行由哪个 `island.line/v1` 项来画，外壳只管过渡的外层；`grow` 只在普通收起条上生效（刘海、侧边岛、贴边、展开时不管），宽度加在收起宽度上、不超过上限，高度随 `set_island_interaction` 的 `collapsedHeight` 交给原生算点击区域 |
| `preview` | `item`、`key`、`label`、`hot`（侧边岛标热哪一行）、`action`（点它）、`open`（点侧边气泡） | 收起条上的消息预览，盖在主行上 |
| `alert` / `notice` | `item`（`island.alert/v1` / `island.notice/v1` 项的 id）、`measure` | 提醒和提示：按插槽的 `order` 取第一个有贡献的项 |
| `reveal` | `reveal`（`always` / `allowed`）、`pauseIdle`、`pauseHover` | 贴边时探出来、暂停闲置收起和悬停展开 |
| `hold` | `reason`（只给诊断看） | 贴边收起时保持露出 |
| `side` | `item`（`island.side/v1` 项的 id）、`height` | 侧边岛的行：按插槽 `order` 排，按 `height` 算放得下几行 |
| `status` | `state`、`label` | 状态灯 |
| `popup` | `page`、`height`、`saving`、`open`、`label`、`icon`（`music` / `bell`）、`iconUrl` | 弹出态和展开高度；`label` 有值时刘海下的标题带写它（配 `iconUrl` 的图或 `icon` 的线条图标），没有就写页面自己的标题（E66.12） |
| `style` | `vars`、`className`、`tint` | 合进舞台的 CSS 变量、class 和玻璃取色 |
| `busy` | 无 | 收起条被占着，第一次提示让路 |
| `hint` | `key` | 一个开关量，外壳和别的插槽项的 `shown` / `enabled` 读它（`agents.busy`、`update.reminder`、`shelf.count`、`timer.chip` 这类） |
| `page` | `page`、`enabled` | 这一页现在开不开（消息按 QQ、微信开关） |
| `badge` | `target`（现在只有 `settings`）、`label`、`action` | 外壳自己的按钮上挂圆点、换读屏文字，点了调 `action`（更新提示挂在设置按钮上） |

外壳只能 import `plugin-kernel` 和第 2 版插件系统（`plugins`、`plugin-views`）这几个功能目录，`tests/unit/feature-boundaries.test.mjs` 检查；第 2 版那两个随第 6 阶段删掉时从检查的名单里去掉。

### 插槽的主题变量

插件的组件放进插槽后，颜色、字体、圆角用插槽给的 CSS 变量，不写死颜色，也不用岛内部的变量名（`--text-1` 这些以后会改）。第三方的每一项外面包一层 `<div class="plugin-slot" data-slot="<插槽名>">`（`display: contents`，不占布局；内置项不包，2026-11-15 起，E36.2.3），在这一层按当前的岛主题（深色、浅色）给出下面这些变量。名单在 `@fuyu/plugin-base/protocol` 的 `SLOT_THEME`，岛这边的取值在 `src/features/plugin-kernel/PluginSlot.css`，单元测试 `tests/unit/plugin-slot-theme.test.mjs` 核对两边一致、示例插件只用这些。

| 变量 | 用途 | 现在对应岛的 |
|---|---|---|
| `--fuyu-plugin-text` | 正文 | `--text-1` |
| `--fuyu-plugin-text-secondary` | 次要文字 | `--text-2` |
| `--fuyu-plugin-text-muted` | 更淡的说明、计数 | `--text-3` |
| `--fuyu-plugin-surface` | 卡片、行的底色 | `--color-white-a06` |
| `--fuyu-plugin-surface-hover` | 悬停时的底色 | `--color-white-a10` |
| `--fuyu-plugin-border` | 分隔线、边框 | `--color-white-a12` |
| `--fuyu-plugin-accent` | 强调色、链接、按钮 | `--color-accent` |
| `--fuyu-plugin-on-accent` | 强调色上的文字 | `--color-on-accent` |
| `--fuyu-plugin-font` | 界面字体 | `--font-ui` |
| `--fuyu-plugin-radius` | 圆角 | `--radius-md` |

这组名字是给第三方的接口：只加不改，去掉或改名要升 `protocol`。岛这边换配色时只改右边的对应。为什么要有：第 1 阶段 Windows 的真岛验收发现示例插件用了岛上没定义的变量，一直落到白色的兜底值，浅色岛上几乎看不见（2026-11-15）。回归页 `tests/regression/plugin-slot.html` 在深色、浅色岛上各量一次示例那一行的对比度。

## 改这一页

协议的改动和代码在同一个提交里改这一页。不兼容的改动升 `protocol`。
