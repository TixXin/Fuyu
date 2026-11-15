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

## Rust 和宿主之间（协议 1）

标准输入输出上的 JSON-RPC 2.0，一行一条消息（UTF-8，`\n` 结尾）。Rust 写宿主的标准输入、读它的标准输出；宿主的标准错误由 Rust 逐行转发到日志。实现：Rust 一侧在 `src-tauri/crates/plugin-base`（`rpc.rs`、`supervisor.rs`），宿主一侧在 `packages/plugin-base/src/host`（`rpc.mjs`、`main.mjs`）。

### 宿主发给 Rust 的通知

| 方法 | 参数 | 什么时候 |
|---|---|---|
| `ready` | `{ protocol, pid, node, plugins, windows: { port, token } }`，`plugins` 是每个插件的状态，`windows` 是给窗口连的本机 WebSocket（见下一节） | 内核和配置里的插件都加载完（成功或失败都算） |
| `log` | `{ at, type, name, text }`，只有 `error` 和 `warn` | 内核记了错误或警告，例如插件启动失败 |
| `fatal` | `{ message }` | 内核本身起不来；发完宿主以退出码 1 退出 |

### Rust 发给宿主的请求

| 方法 | 参数 | 回答 |
|---|---|---|
| `ping` | 任意 | `{ at, echo }`。Rust 每秒发一次，2 秒没回答就当宿主卡死 |
| `status` | 无 | 每个插件的状态：`{ id, name, state, waitingFor?, error? }`，`state` 是 `running`、`waiting`、`failed`、`disabled`、`loading`、`stopped`、`unloading` 之一 |
| `stop` | 无 | `true`，然后停掉所有插件（每个清理都执行）再退出 |

### 宿主的生命周期

| 情况 | 怎么处理 |
|---|---|
| 启动 | Rust 找到 Node（决定 16），带 `--disallow-code-generation-from-strings` 拉起宿主，放进作业对象（Windows）或自己的进程组（macOS）。等 `ready` 最多 60 秒（新下载的 Node 第一次运行可能要几十秒，第 0 阶段实测） |
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
| 宿主 → 窗口 | `{ type: "welcome", protocol, seq, snapshot }` | 回答 `hello`。`snapshot` 是当前的全部状态（现在是 `{ plugins, clients }`），`seq` 是最后一个事件的序号 |
| 宿主 → 窗口 | `{ type: "event", seq, name, data }` | 增量。`seq` 每个事件加 1，所有窗口共用一个序列。现在有 `plugins`（插件状态变了，带完整的列表）、`clients`（插件登记的界面文件变了，带完整的列表：`{ id, plugin, window, path, version }`）和 `plugin`（插件的宿主部分推给它窗口部分的消息：`{ plugin, topic, data }`） |
| 窗口 → 宿主 | `{ type: "snapshot" }` | 窗口发现序号跳了（中间丢了事件），要一份新的快照，不带着缺口往下走 |
| 宿主 → 窗口 | `{ type: "snapshot", seq, snapshot }` | 回答上一条 |
| 窗口 → 宿主 | `{ type: "call", id, method, params }` | 调用。现在有 `status`，和 `plugin.call`（`params` 是 `{ plugin, method, params }`，转给那个插件用 `ctx.clients.handle` 登记的方法，回答它的返回值；没登记的回 `no-method`） |
| 宿主 → 窗口 | `{ type: "result", id, result }` 或 `{ type: "result", id, error: { code, message, data? } }` | 回答调用 |

### 断开和重连

- 连接断了（宿主重启、崩溃、被换掉），窗口里等着的调用立刻以 `peer-gone` 失败。
- 窗口每次重连前都重新向 Rust 要端口和令牌：宿主重启后两样都会变。重连的间隔是 0、0.1、0.25、0.5、1、2 秒，之后一直 2 秒；连上并拿到快照后重新从 0 算。
- 重连后拿到的是一份新的快照（`welcome`），窗口用它替换手里的全部状态，不和旧的合并。

### 插件的界面文件

插件的宿主部分用 `ctx.clients.add(<窗口名>, <文件的 URL>)` 登记它在某个窗口里的界面代码（插件停用时自动撤掉）。宿主把文件换成插件目录下的相对路径，路径解析成真实路径后不在插件目录里的拒绝（插件启动失败），版本是文件的大小加修改时间。窗口按 `fuyu-plugin://localhost/<路径>?v=<版本>` 加载：先用 `HEAD` 确认文件在、类型是 JavaScript，再 `import()`；版本变了就换地址重新加载，旧的先撤掉。插件的界面代码默认导出一个插件（函数，或带 `apply` 的对象），用 `ctx.slots.add(<插槽名>, { id, order, component })` 往插槽里放组件，插件停用时这些也自动撤掉。插件的两部分之间：宿主部分用 `ctx.clients.handle(<方法>, fn)` 登记给自己窗口调的方法、`ctx.clients.publish(<主题>, data)` 推消息；窗口部分用 `ctx.host.call(<方法>, params)` 调、`ctx.host.on(<主题>, fn)` 收。窗口部分只能调到、收到它自己那个插件的（按 `plugins.yml` 里的 id 对应），这些登记都跟着插件撤掉。示例在 `packages/plugin-base/examples/hello/`。插件代码里对 `react`、`react/jsx-runtime` 的引用要改写成 `../__shared/react.js` 这样的相对路径（第 0 阶段两个系统都验证过），由程序自带的转接模块提供同一份 React。

## 改这一页

协议的改动和代码在同一个提交里改这一页。不兼容的改动升 `protocol`。
