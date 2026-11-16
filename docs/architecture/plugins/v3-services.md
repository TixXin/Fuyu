# 插件平台第 3 版：服务的契约

任务 E36.3.2（#466），第 3 阶段地基（[计划](v3-phase3-foundation-plan.md)）。这一页定下「服务」怎么命名、怎么声明、谁能调谁、出错时调用方看到什么。计时器样板（E36.3.5）、内置插件加载（E36.3.6）、宿主调 Rust（E36.3.3）、宏生成的类型（E36.3.4）都建在它上面。先读 [方案](v3-everything-plugin.md)「核心概念」「服务的替换和冲突」「接口分层和版本」和 [边界](v3-boundary.md)。

## 一句话

服务是**一个带版本的名字 + 一张方法表 + 一张事件表**，用 `defineService`（`@fuyu/plugin-base/services`）声明；浮屿自己的服务声明放在中立的类型包 `@fuyu/plugin-services` 里。提供者用 `ctx.services.provide(定义, 实现)` 注册（底下就是 Cordis 的 `ctx.provide`），使用者在同一个宿主里用 `ctx.services.get(定义)` 调，窗口经 WebSocket 用 `service.call` / `service.on` 按名字调。过边界的只有 JSON。

## 和 Cordis 的关系

| Cordis 的东西 | 在服务里怎么用 |
|---|---|
| `ctx.provide(name, value)` | `ctx.services.provide` 内部就调它，名字是完整的带版本名（`timers/v1`）。所以「一个名字只能有一个提供者」、冲突时失败的插件的错误写明谁占了（保证清单第 6、7 条）、`usage.services` 计数，全部照旧，不另起一套 |
| `inject` | 使用者照旧在插件里写 `export const inject = ["timers/v1"]`。依赖没就绪不启动，状态 `waiting`、`waitingFor: ["timers/v1"]`；提供者停掉或被换掉时使用者跟着停、再起（保证清单第 1、3、4 条） |
| `ctx.<名字>` / `ctx.get(名字)` | **不用**。名字里有 `/`，写成 `ctx["timers/v1"]` 又没类型；拿到的是提供者的原始对象，绕过了「只认声明过的方法」和调用的超时、`peer-gone`。插件一律用 `ctx.services.get(定义)` |
| `Service` 类、`ctx.plugin` 等 | 不变。插件仍然可以用裸的 `ctx.provide` 提供**进程内**的东西（可以带函数、类实例），但那不算本页的「服务」：窗口调不到、没有类型包、不承诺版本 |

为什么不直接用 Cordis 的服务：它没有版本、没有方法清单（窗口来调时宿主不知道哪些方法能调）、提供者对象上的任何属性都能被拿到；而且 Cordis 4 还是 RC，按方案插件不直接用它。

## 名字和版本

- 写法和插槽一样：`<名字>/v<主版本>`，名字是小写字母、数字、`-`，可以用 `.` 分段：`timers/v1`、`translator/v1`、`agent.sessions/v1`。正则 `SERVICE_NAME` 只有一份，在 `@fuyu/plugin-manifest/names`（以后 `fuyu-plugin check` 也用它核对清单的 `provides`），`@fuyu/plugin-base/protocol`、`@fuyu/plugin-base/services` 和 `@fuyu/plugin-services` 都转出同一个对象（E36.3.17）。
- **同一个主版本只加不改**：可以加方法、加事件、给参数加可选字段、给结果加字段；不能删、改名、改已有字段的类型或意思。要做不兼容的修改就出 `/v2`，`/v1` 保留一段时间（按「接口分层和版本」的稳定接口规则）。
- `/v1` 和 `/v2` 在内核看来是**两个服务**。一个插件可以同时提供两个版本（`v1` 包一层转到 `v2`）；使用者依赖哪个版本就 `inject` 哪个。
- 方法名、事件名是小驼峰（`MEMBER_NAME`），不能用 `on`、`then`、`catch`、`finally`、`constructor`、`toJSON`、`toString`、`valueOf`（`RESERVED_MEMBERS`）：`on` 留给订阅事件，`then` 会让客户端对象被当成 Promise。
- 内置服务的名字不带 `fuyu.` 前缀（`timers/v1`）；第三方插件提供的服务建议用自己插件的 id 开头（`weather.forecast/v1`），免得撞名。撞名的后果见「替换和冲突」。

## 怎么声明

```ts
// packages/plugin-services/src/services/timers.d.mts（类型）
export type Timer = { id: string; kind: "countdown" | "stopwatch"; durationMs: number; elapsedMs: number; runningSince: number | null; alerted: boolean };
export type TimersMethods = {
  list(): { timers: Timer[]; at: number };
  start(params: { kind: "countdown"; durationMs: number } | { kind: "stopwatch" }): { timer: Timer };
  // …
};
export type TimersEvents = { changed: { timers: Timer[]; at: number }; due: { timer: Timer; at: number } };
export const timersV1: ServiceDefinition<TimersMethods, TimersEvents, {}>;

// packages/plugin-services/src/services/timers.mjs（运行时）
export const timersV1 = defineService("timers/v1", {
  methods: { list: true, start: true, pause: true, resume: true, extend: true, remove: true, dismissRinging: true },
  events: { changed: true, due: true },
});
```

- `defineService<Methods, Events, Progress>(name, spec)` 返回一个冻结的**定义**：`{ name, base, version, methods, events }`。`spec` 里逐个列出方法和事件的名字（值是 `true` 或选项），**类型检查要求列全**：漏了一个方法就编译不过。宿主靠这张表判断「这个方法声明过没有」，所以名字必须在运行时也有。
- 方法的选项：`timeoutMs`（默认 30 秒，见「错误」）、`progress: true`（会分几次推中间结果，见「流式」）。
- **每个方法最多一个参数**，是 JSON 对象（或没有参数）；返回值是 JSON（或 `Promise`）。这样同一个调用在进程内、经 WebSocket、经 Rust 的 JSON-RPC 三条路上形状一样，和 JSON-RPC 的命名参数一一对应。
- **类型上就挡住不是 JSON 的东西**：参数、返回值、事件数据、流式片段必须能赋给 `Json`。函数、`Date`、`Map`、类实例、值是 `undefined` 的字段都编译不过。可选字段可以（序列化时丢掉）。数据类型要写成 `type` 而不是 `interface`（`interface` 没有隐式的索引签名，赋不给 `Json`，报错会写明 `Index signature … is missing`）。
- 服务自己的错误码写在类型旁边（`TimersErrorCode = "limit" | "not-found" | "bad-duration"`），提供者抛出带 `code` 的错误，调用方按码判断。
- 类型包是中立的：提供者和使用者都只依赖 `@fuyu/plugin-services`，不互相 import（方案「核心概念」的「服务」一行）。内置服务的声明都放这里；第三方插件的服务声明放在提供者自己发的类型包里，写法一样。
- E36.3.4 从 Rust 生成的类型放 `packages/plugin-services/src/generated/`，服务的声明可以直接引用那里的类型（例如翻译引擎的名单）。

这些类型和 `defineService` 本身都在 `@fuyu/plugin-base/services`（`src/services.mjs` / `.d.mts`，不含浮屿的业务，也不引 Cordis，窗口代码可以用；基座、窗口的代理和 `ctx.services` 都用它）。宿主把这个子路径共享给插件（在 `HOST_SHARED_MODULES` 里），所有插件拿到的是宿主那一份。`@fuyu/plugin-services` 原样转出，原来从它 import 的代码照常能用：

| 类型 | 是什么 |
|---|---|
| `ServiceImpl<typeof timersV1>` | 提供者要写的实现：每个方法 `(params, caller) => 结果 \| Promise<结果>`；`caller` 是 `{ plugin?, window?, progress(片段) }` |
| `ServiceClient<typeof timersV1>` | 使用者拿到的客户端：每个方法 `(params, options?) => Promise<结果>`，**不管在哪调都是 Promise**；`on(事件, 监听器)` 返回撤销函数。`options` 是 `{ timeoutMs?, onProgress? }`，只有声明了 `progress` 的方法才能传 `onProgress` |
| `ServiceProvider<typeof timersV1>` | `provide` 返回的句柄：`emit(事件, 数据)`、`dispose()` |
| `ServiceErrorShape` | `{ code, message, data? }`，边界规则 1 |

## 插件里怎么用（宿主一侧）

```js
import { timersV1 } from "@fuyu/plugin-services";

export const name = "timer";
export function apply(ctx) {
  const provider = ctx.services.provide(timersV1, {
    list: () => ({ timers, at: Date.now() }),
    start: (params, caller) => { /* 校验 params，失败时 throw Object.assign(new Error(…), { code: "bad-duration" }) */ },
    // …
  });
  ctx.setTimeout(() => provider.emit("due", { timer, at: Date.now() }), ms);
}
```

```js
export const name = "timer-tray";
export const inject = ["timers/v1"];
export async function apply(ctx) {
  const timers = ctx.services.get(timersV1);
  timers.on("due", ({ timer }) => { /* … */ });
  await timers.start({ kind: "countdown", durationMs: 60_000 });
}
```

| 接口 | 做什么 | 受管 |
|---|---|---|
| `ctx.services.provide(定义, 实现)` | 校验定义；检查实现里每个声明的方法都是函数（缺了启动失败，错误写明缺哪个）；`ctx.provide(定义.name, …)`；登记到宿主的服务表 | 是：插件停用时撤掉登记、撤掉 Cordis 的 provide，这个提供者上**还没回答的调用全部以 `peer-gone` 失败** |
| `provider.emit(事件, 数据)` | 发给进程内的订阅者，有窗口订阅时再发给窗口。没声明的事件抛 `no-event`；提供者已经停用时返回 `false`、什么也不做（不抛：停用后迟到的回调不该算成插件的错） | — |
| `ctx.services.get(定义)` | 返回 `ServiceClient`。**按名字晚绑定**：每次调用时才去找当前的提供者，所以提供者换了以后拿着旧客户端的人调到的是新的 | — |
| `client.<方法>(params, options)` | 找当前提供者（没有回 `not-ready`），按声明的超时调，提供者停用时回 `peer-gone` | 否：调用方停用不取消已经发出的调用，结果照常回来；用 `ctx.effect` 守住回来以后要做的事 |
| `client.on(事件, 监听器)` | 订阅。监听器挂在**调用方**的 ctx 上（Cordis 的 `ctx.on`），所以计入调用方的 `usage.listeners`，抛错只记在调用方名下、不影响别的订阅者（保证清单第 20 条） | 是：调用方停用时自动撤掉。订阅按服务名，不按提供者，提供者换了照样收到新提供者发的事件 |

- 进程内调用**不复制参数和结果**（同一个线程，复制是白花的时间），所以提供者不能改调用方传进来的对象、调用方也不能改拿到的结果。类型已经保证它们是 JSON，换到窗口那条路上行为一致。
- 进程内调用和窗口来的调用走**同一套**超时和错误，代码从宿主挪到窗口（或反过来）时不用改错误处理。
- 参数的校验是提供者的事：类型只管编译期，窗口和别的插件可能传任何东西进来（方案「边界」：命令要按调用方可能有问题来写）。

`ctx.services` 和 `ctx.setTimeout` 一样是内核挂在根上下文的访问器（`ctx.reflect.accessor`），插件**不用 `inject: ["services"]`** 就能用；它按读它的那个 ctx 绑定调用方，所以注册和订阅都落在调用方插件名下。除了 `provide`、`get` 还有 `list()`（当前在提供的服务，和快照的 `services` 同一格式）。宿主自己（`main.mjs`）用 `startHost` 返回的 `host.serviceHub` 做窗口分发，`host.services()`、`host.watchServices()` 给快照和增量。

`ctx.services` 的类型是 `Context` 上的增补（`packages/plugin-base/src/index.d.mts`，`ServicesApi`）：`provide(定义, 实现)` 按定义检查实现的类型，`get(定义)` 返回带类型的 `ServiceClient`。

## 窗口怎么调

窗口协议（v3-boundary.md「宿主和窗口之间」）加两个调用，**只加不升**，`WINDOW_PROTOCOL` 仍是 1（第 2 阶段主 agent 2026-11-15 已同意）：

| 方向 | 消息 | 说明 |
|---|---|---|
| 窗口 → 宿主 | `{ type: "call", id, method: "service.call", params: { service, method, params } }` | 调一个服务的方法。回答是方法的返回值（`undefined` 回成 `null`）或错误 |
| 窗口 → 宿主 | `{ type: "call", id, method: "service.on", params: { service, event } }` | 声明「这个窗口要这个事件」，回答 `true`。服务名不合法回 `bad-params`；当前有提供者但没声明这个事件回 `no-event`；**当前没有提供者也回 `true`**（订阅按名字，提供者来了照样收到） |
| 窗口 → 宿主 | `{ type: "call", id, method: "service.off", params: { service, event } }` | 撤销 |
| 宿主 → 窗口 | `{ type: "event", seq, name: "service", data: { service, event, data } }` | 服务的事件 |
| 宿主 → 窗口 | 快照里加 `services`，增量事件 `services` | 当前在提供的服务：`[{ name, plugin, methods, events }]`（`methods`、`events` 是名字列表）。窗口据此知道一个服务在不在、能调什么，不用一次次试 |

- **只认声明过的方法**：`service.call` 查的是当前提供者注册时给的定义里的 `methods`，没有就回 `no-method`，不去碰实现对象上的其他属性（例如 `constructor`、内部的 `_state`）。
- **事件仍然广播**：窗口协议里所有窗口共用一个 `seq`，按窗口挑着发会让序号出缺口、窗口以为丢了事件去要快照。所以服务事件和别的事件一样发给所有窗口，由窗口里的代理分给本地的监听器。`service.on` 的作用是**有人要才发**：一个事件没有任何已连接的窗口要，宿主就不往 WebSocket 发（进程内的订阅者照常收到）。宿主按窗口的 label 记，发的时候顺手去掉已经不在连接里的 label，不需要连接断开的回调；窗口重连后由代理把它的订阅重新发一遍。
- 窗口的身份只有 label，**任何窗口都能调任何服务**：同权模型下没有按窗口的权限，这和方案一致。真正要收紧的是 Rust 命令的 capability，不在这里。
- 窗口一侧的代理是 `@fuyu/plugin-base/client` 的 `createServiceProxy(call)`（`ServiceClient` 的同一套类型），用法见 v3-boundary.md「服务」。

### 窗口里的服务表（E36.3.27）

功能的界面部分之间互相调，用窗口里的服务表：`@fuyu/plugin-base/client/window-services` 的 `createWindowServices()`，浮屿的窗口里是 `src/features/plugin-kernel/services.ts` 的 `windowServices`（每个窗口一份）。

- 和宿主同一套 `defineService` 定义、同一套错误码：`provide(定义, 实现, { owner: 插件 id })` 返回 `{ emit, dispose }`，`get(定义)` 返回和 `ctx.services.get` 一样的客户端（方法回 promise，`on(事件, 监听器)` 回取消函数）。
- **先找本窗口，再找宿主**：本窗口有提供者就直接调；没有时经 `attach` 接上的宿主代理（`runtime.ts` 连上宿主后接）走 WebSocket；都没有回 `not-ready`。所以 `FUYU_PLUGINS_V3` 没开、宿主没起时，同一个窗口里的服务照常能用。同一个名字本窗口和宿主都有时，用本窗口的。
- **跟着开关走**：`windowServices` 订阅了内置插件的开关表，拥有者被关掉时它提供的服务对调用方等于不存在（`not-ready`），正在等的调用回 `peer-gone`；打开后照常。提供者卸下（`dispose`）也一样。
- 超时、流式进度（`onProgress`）、提供者抛出带 `code` 的错误原样传给调用方，和宿主一致；错误是 `HostCallError`（`code`、`message`、`data`）。
- 事件：本窗口的提供者 `emit` 直接分给本窗口的监听器；接上宿主后，同名事件也从宿主转过来。
- 测试 `packages/plugin-base/test/window-services.test.mjs`。

### 流式

声明了 `progress: true` 的方法（`translator/v1` 的 `rewrite`）可以分几次推中间结果：

- 提供者在实现里调 `caller.progress(片段)`，片段是 JSON；
- 进程内的调用方用 `options.onProgress` 收；
- 窗口这条路：宿主给调用它的**那一个连接**发 `{ type: "progress", id, data }`（`id` 是那次调用的 id），窗口的代理转给 `onProgress`。这是窗口协议里新的消息类型（只加，旧窗口不调这类方法就收不到）。它不进 `seq`、只发给一个连接，所以要改 `host/sockets.mjs` 给 `onCall` 多传一个「回给这个连接」的函数。**这一段随第一个用它的子任务（E36.3.8 翻译样板）实现**，这一轮的宿主分发对窗口来的 `progress` 先丢掉（`caller.progress` 照常可调）。
- 经 Rust 的流式由 E36.3.3 定（计划里写的是「调用 id + 进度通知」），形状和这里一致：一个 id、多条片段、最后一个结果。

### Rust 那条路

- **宿主调 Rust**：不是服务，是 E36.3.3 的 `ctx.rust.call(方法, 参数)`，**只有内置插件能用**，别的插件回 `forbidden`（E36.3.18，见 [v3-boundary.md](v3-boundary.md)「宿主发给 Rust 的请求」）。内置插件把它包成服务（`translator/v1` 的实现里调 `ctx.rust.call("translator.translate", …)`），第三方插件和窗口用的是服务。
- **Rust 一侧怎么提供方法**（E36.3.4）：在领域的自由函数上标 `#[plugin_base::host_service("translator.translate")]`，同步或 `async` 都行，可以和 `#[tauri::command]` 叠在同一个函数上（原函数原样保留，Tauri 那边照旧）。例子是 `src-tauri/src/platform_support.rs` 的 `get_platform_support`（`app.platformSupport`）和 `src-tauri/src/plugin_kernel/methods.rs`。

  ```rust
  #[derive(Serialize)]
  #[cfg_attr(test, derive(ts_rs::TS))]
  pub struct Translated { text: String, engine: Engine }

  #[tauri::command]
  #[plugin_base::host_service("translator.translate", timeout_ms = 60000, inject(app))]
  pub async fn translate_text(app: AppHandle, text: String, engine: Option<Engine>) -> Result<Translated, UserError> { … }
  ```

  | 写法 | 宏做的事 |
  |---|---|
  | 普通参数 | 从调用的 JSON 对象里按 camelCase 名字取（`right_side` → `rightSide`），`Option` 的可以不传，多出的字段不管；类型不对回 `bad-params`，`message` 写明方法和字段，`data` 是 `{ method, field }`。参数必须是自己拥有的类型（`String` 而不是 `&str`） |
  | `inject(app)` 列出的参数 | 不从 JSON 取，从 `Serve::manage` 放进去的状态里取一份克隆。浮屿放了 `AppHandle`；没放的类型回 `failed` 并写明缺哪个类型 |
  | `call: &Call` 参数 | 这次调用本身：`call.progress(片段)` 推流式片段，`call.cancelled()` 看宿主是否已经不等了 |
  | 返回 `T` | `T` 编码成 JSON 回答；不能编码回 `bad-result`。不写返回值回 `null` |
  | 返回 `Result<T, E>` | `E` 要实现 `plugin_base::ServiceFailure`：`String`、`&str` 回 `failed`，`ServeError` 和自己实现了它的错误类型保留自己的码和 `data`（例如翻译的 `no-secret`）。`Result` 要写全两个类型参数，别名认不出来 |
  | `async fn` | 在工作线程上用应用给的运行时跑完（`Serve::block_on_with`，浮屿给的是 Tauri 的 `block_on`，没给时用 `pollster`）。超时、取消、panic 和同步的一样 |
  | `timeout_ms = …` | 这个方法的超时，默认 30 秒 |

- **登记和重名**：每个标记生成一条 `inventory` 登记，`Serve::registered()` 读出全部；两个函数用了同一个方法名时它返回错误，写明两边的函数路径和文件行号，`plugin_kernel` 启动时就报出来，插件内核不启动。浮屿自己的方法表就是 `Serve::registered()` 加上 `AppHandle`（`plugin_kernel/methods.rs`）。
- **生成的类型**：被标记函数的参数和返回值的类型在测试构建里派生 `ts_rs::TS`（`#[cfg_attr(test, derive(ts_rs::TS))]`，正式版不编译 `ts-rs`）。Rust 单元测试 `plugin_kernel::tests::the_generated_typescript_for_rust_methods_is_up_to_date` 把它们和方法表生成出来，和 `packages/plugin-services/src/generated/rust.d.mts`、`rust.mjs` 比对，不一致就失败；`pnpm gen:rust-types` 重写这两个文件。`rust.d.mts` 里是每个类型的声明和 `RustMethods`（`{ "<方法>": { params, result } }`），`rust.mjs` 是方法名清单 `RUST_METHODS`，都从 `@fuyu/plugin-services` 导出。`pnpm check` 里的 `check:rust-types` 不编译，只核对源码里标记的方法名和清单一致、生成的文本字段没有像密钥的名字（规则同 `check:secrets`，[v3-secrets.md](v3-secrets.md)）。
- **Rust 调服务**（例如以后托盘菜单要调 `timers/v1`）：Rust 发给宿主的请求里留一个方法名 `service.call`，参数和窗口的一样（`{ service, method, params }`），错误码一样。要不要做、什么时候做由 E36.3.3 或托盘菜单的子任务定；同步等待不能成环（边界规则 5），所以宿主在处理 Rust 的 `service.call` 时，提供者不能再同步等 Rust 的回答。

## 错误

全部是 `{ code, message, data? }`（边界规则 1），`message` 写明服务名和方法名：

| `code` | 什么时候 | 调用方怎么办 |
|---|---|---|
| `bad-params` | 服务名不合法，或 `service.call` 的参数不是 `{ service, method, params }` | 是调用方的 bug |
| `not-ready` | 现在没有这个服务的提供者：从没有过、还在启动、被停用、反复出错被自动停用、被安全模式拦下，都是这个。`data` 是 `{ service }` | 进程内的使用者应该 `inject` 它，那样根本不会启动；窗口看快照里的 `services` 等它出现，或给用户显示「这个功能没开」 |
| `no-method` | 当前提供者的定义里没有这个方法（窗口按名字调错了，或者对方提供的是更早的同一主版本、还没加这个方法） | 是调用方的 bug，或要求更新提供者 |
| `no-event` | 订阅或发出了定义里没有的事件 | 同上 |
| `peer-gone` | 调用发出后、回答之前，提供者被停用、换掉或宿主在停止 | 和边界规则 3 一样，立刻失败不等超时。可以等新的提供者出现后重试 |
| `timeout` | 超过方法的 `timeoutMs`（默认 30 秒；调用方可以用 `options.timeoutMs` 改短，不能改长）。`message` 写明服务、方法和等了多久 | 边界规则 4 |
| `bad-result` | 提供者返回了不能变成 JSON 的东西（只在窗口那条路上查，进程内靠类型） | 是提供者的 bug |
| 服务自己的码 | 提供者抛的错误带了字符串的 `code`（如 `limit`），原样传出，`data` 只有是 JSON 时才带 | 按服务的类型文件里列的码处理 |
| `failed` | 提供者抛的错误没有 `code` | 看 `message` |

提供者抛错**不算**插件出错，不计入「60 秒 5 次自动停用」：参数不对、没配密钥这类是正常的业务错误。提供者自己的 bug 让宿主进程层面出了没人接的异常时，照旧按调用栈记到它名下。

## 替换和冲突

沿用方案「服务的替换和冲突」，这里只写到服务这一层落在哪：

- **同一个名字只有一个提供者**：第二个提供者启动失败，状态 `failed`，错误写明「这个服务已经由插件 `<id>` 提供」（Cordis 的冲突 + `status.mjs` 的解释，保证清单第 6、7 条，不用新写）。
- **启用时就挑**：插件清单的 `provides`、`replaces` 在启用时检查，两个插件提供同一个服务时让用户选一个、停用另一个的这项服务。这是 E36.3.6（内置插件清单）和插件页的事；本页只要求清单里的 `provides` 写**完整的带版本名**（`translator/v1`），和这里的名字一一对应。
- **换掉提供者的时候**：旧提供者停用 → 它上面没回答的调用 `peer-gone`、`inject` 它的插件停下来回到 `waiting`、快照的 `services` 少一项；新提供者起来 → `inject` 它的插件重启、`services` 多一项。窗口的订阅和进程内拿着客户端的人不用重新订阅，后面的事件来自新的提供者。
- 内置的提供者和第三方的地位一样：换掉内置翻译就是停用内置的 `translation` 插件、启用另一个提供 `translator/v1` 的插件。

## 状态视图：在等哪个服务

- 插件状态里的 `waitingFor` 已经是 Cordis 的 `inject` 名，用了带版本的名字以后直接是 `["timers/v1"]`，不用改 `status.mjs`。
- 插件页显示等待的原因时，把 `waitingFor` 里的每个名字和快照的 `services`、内置插件清单（E36.3.6）的 `provides` 对一下，分成三种说法：「没有插件提供 `timers/v1`」「`timer` 插件提供它，但它已停用 / 出错 / 在安全模式里」「`timer` 插件正在启动」。
- 内置插件启动后一段时间（先定 10 秒）还在等，岛上报一条（方案的要求，界面等插槽，归内置插件那一轮）。
- `usage.services` 仍是这个插件提供的服务数。

## 内置服务（这一轮先声明两个）

| 服务 | 方法 | 事件 | 说明 |
|---|---|---|---|
| `reminders/v1` | `push({ id, source, icon, title, detail?, snoozable? })` → `{ shown }` | 无 | 只在主窗口的服务表里（窗口服务，2026-11-15 起，E36.3.28）：计时器插件在 `src/features/timer/plugin/services.ts` 提供（拥有者 `timer`，`main.tsx` 的 glob 收集，只在没有 `?window=` 的岛窗口登记），把提醒放进岛上的提醒队列；`icon` 只收 `stand`、`eye`、`water`、`stretch`、`coffee`、`bell`、`flag`。待办的到期提醒调它，计时器关掉时拿到 `not-ready`，提醒不显示 |
| `timers/v1` | `list`、`start`、`pause`、`resume`、`extend`、`remove`、`dismissRinging` | `changed`（全部计时器和宿主当前时间）、`due`（到点的那个） | 计时规则用 `src/features/timer/timers.ts` 的纯函数（E36.3.5）。`Timer` 的形状和 `timers.ts` 一致；类型包不能 import `src/`，E36.3.5 加一条类型测试核对两边相同。超过 12 个回 `limit`，找不到 id 回 `not-found` |
| `translator/v1` | `translate`（60 秒）、`rewrite`（120 秒，流式，片段 `{ piece }`）、`engines` | 无 | **接口里没有密钥**：没有存、取密钥的方法，`engines` 只回每个引擎 `hasSecret` 的布尔值；保存密钥照旧走窗口的 `invoke("save_translation_secret")`（只进不出），翻译时 Rust 自己读（E36.3.7、E36.3.8）。`engine` 可选，只收 `{ engine, model }`，多给的字段回 `bad-params`；不传时现在用 DeepSeek（设置里选的引擎存在窗口里，宿主还读不到）。**自定义接口暂不开放**（E36.3.18）：它的地址只存在窗口的设置里，经服务传地址就等于让调用方决定 Rust 把密钥发到哪里（[v3-secrets.md](v3-secrets.md) 原则 7），所以 Rust 给宿主的入口没有地址参数，`engine: "custom"` 回 `bad-params`（`data.reason` 是 `translation.customUnavailable`），等自定义地址存进 Rust 后再开放。没配密钥回 `no-secret`。**窗口里也提供**（2026-11-15 起，E36.3.29）：`src/features/translation/plugin/services.ts` 往每个窗口的服务表里放一份（拥有者 `translation`），用户设置里选的引擎、模型和自定义地址照常生效，宿主没开也能用；翻译插件关掉时调用方拿到 `not-ready`。剪贴板的 AI 改写调的是这一份 |

## 代码在哪

包已接进 pnpm workspace（`pnpm-workspace.yaml`、根 `package.json` 的 `dependencies`、`packages/tsconfig.json`），测试按包名 `@fuyu/plugin-services` import；`plugin-base` 只有测试 import 它，源码不依赖。

| 东西 | 位置 | 状态 |
|---|---|---|
| `defineService`、`isServiceDefinition`、方法名规则和声明时的类型检查（`MethodTable` 等） | `packages/plugin-base/src/services.mjs` / `.d.mts`（子路径 `@fuyu/plugin-base/services`，宿主共享）；`packages/plugin-services/src/define.mjs` / `.d.mts` 只转出 | E36.3.17，已做 |
| 用服务的类型（`ServiceClient`、`ServiceImpl`、`ServiceProvider`、`Json` 等）、`ctx.services` 的类型 | `packages/plugin-base/src/services.d.mts`、`src/index.d.mts` | 已做 |
| `SERVICE_CALLS`、`SERVICE_TIMEOUT_MS` | `packages/plugin-base/src/protocol.mjs` / `.d.mts`，宿主、窗口的代理和 `services.mjs` 都引这一份 | 已做 |
| `SERVICE_NAME` | `packages/plugin-manifest/src/names.mjs`（子路径 `@fuyu/plugin-manifest/names`，不碰 Node 模块，窗口也能用），`protocol` 转出 | E36.3.17，已做 |
| 内置服务的声明 | `packages/plugin-services/src/services/<名字>.mjs` / `.d.mts` | 这一轮：`timers`、`translator`；`reminders`（E36.3.28，窗口服务） |
| 测试 | `packages/plugin-services/test/define.test.mjs`（经转出测 `defineService`，已在 `pnpm test` 的范围里）、`types.check.mts`（在 `pnpm check:packages-types` 里）；`packages/plugin-base/test/services.test.mjs` 核对转出的是同一个函数、正则只有一个 | 这一轮 |
| 宿主的服务表和窗口分发 | `packages/plugin-base/src/host/services.mjs`；`kernel.mjs` 装上访问器、`main.mjs` 的 `onCall`、快照和增量接上；测试 `packages/plugin-base/test/services.test.mjs` | 第二步，已做（Rust 来的 `service.call` 留给 E36.3.3，窗口来的 `progress` 留给 E36.3.8） |
| 窗口的代理 | `packages/plugin-base/src/client/services.mjs`，测试 `test/service-proxy.test.mjs` 和 `services.test.mjs` 里经真 WebSocket 的那条 | 已做 |
| 窗口里的服务表 | `packages/plugin-base/src/client/window-services.mjs`（子路径 `@fuyu/plugin-base/client/window-services`），浮屿的接线在 `src/features/plugin-kernel/services.ts`、`runtime.ts`；测试 `test/window-services.test.mjs` | E36.3.27，已做 |
| Rust 生成的类型 | `packages/plugin-services/src/generated/`（`rust.d.mts`、`rust.mjs`），生成脚本 `scripts/plugins-v3/gen-rust-types.mjs`，宏在 `src-tauri/crates/plugin-base-macros` | E36.3.4，已做 |

`plugin-base` 的源码**不 import `@fuyu/plugin-services`**（依赖是反过来的，`plugin-services` 依赖 `plugin-base`）：`plugin-base` 是要单独开源的基座，不能依赖浮屿的服务名单。它按形状认定义（`{ name, methods, events }`，和 `isServiceDefinition` 同一套检查）。

## 还没做的

- 窗口来的流式 `progress`（`{ type: "progress", id, data }`，改 `host/sockets.mjs`）：随 E36.3.8。
- Rust 调服务（Rust 发 `service.call`）：随 E36.3.3 之后要用它的子任务（托盘菜单）。
