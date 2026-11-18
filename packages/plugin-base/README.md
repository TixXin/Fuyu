# `@fuyu/plugin-base`（公开名：`tauri-cordis`）— Tauri + Node「万物皆插件」基座

`@fuyu/plugin-base`（配合 Rust 侧 `src-tauri/crates/plugin-base` 与 `plugin-base-macros`，公开发布名定为 **`tauri-cordis`**，MIT 许可证）是浮屿插件平台第 3 版的独立基座。它不包含任何浮屿业务代码（由 `test/boundary.test.mjs` 强制检查），任何 Tauri 或桌面 WebView 应用都可以用它搭建「内置功能与第三方扩展同权、能力皆服务、界面皆插槽」的插件架构。

---

## 一、架构与三条通信通道

```text
┌─────────────────────────────┐      stdio JSON-RPC       ┌─────────────────────────────────┐
│  原生外壳（Rust / Tauri）    │ <-----------------------> │  Node 宿主进程（无界面）         │
│  - Supervisor 看管宿主       │                           │  - Cordis 根上下文与加载器       │
│  - #[host_service] 领域入口  │                           │  - 版本化服务表 ctx.services     │
│  - 自定义协议白名单静态服务  │                           │  - 受管定时器/资源统计/故障隔离  │
└─────────────────────────────┘                           └─────────────────────────────────┘
               ^                                                           ^
               │ invoke（仅窗口自身系统操作）                               │ 本机 WebSocket（127.0.0.1 + 随机令牌 + Origin 校验）
               v                                                           v
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│  各界面窗口（WebView 客户端）                                                              │
│  - 插槽注册表（createSlots / SlotItems，每项独立错误边界）                                 │
│  - 窗口服务表（createWindowServices，先查本窗口提供者，再经 WebSocket 调宿主服务）         │
│  - 客户端加载器（createLoader，加载前校验文件与 MIME，共用同一份 React 转接模块）          │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

- **不经过 WebView `emit` / `Channel`**：宿主与窗口直接通过带随机令牌的 `127.0.0.1` WebSocket 通信，带握手、序号（`seq`）和断线重连快照恢复。
- **所有副作用受管可撤销**：服务提供（`ctx.services.provide`）、事件监听（`ctx.on`）、受管定时器（`ctx.setTimeout` / `ctx.setInterval`）、窗口注册（`ctx.clients.add`）和插槽项（`ctx.slots.add`）均绑定在插件 fiber 上，插件停用或重载时自动撤销。

---

## 二、包与子路径一览

### 1. TypeScript 包 `@fuyu/plugin-base`

| 导入路径 | 运行位置 | 用途 |
|---|---|---|
| `@fuyu/plugin-base` | 宿主 / 窗口插件 | 插件入口：`Context`、`Service`，以及挂载在 `ctx` 上的 `services`、`rust`、`clients`、`slots`、`host`、受管定时器类型声明 |
| `@fuyu/plugin-base/services` | 宿主 / 窗口 / 共享定义 | `defineService(name, { methods, events })`：定义带版本号与超时/进度契约的服务 |
| `@fuyu/plugin-base/host` | Node 宿主进程 | `startHost`、`openWindowSocket`、`RustBridge`、`readBuiltins`、`readManifest`、`pluginStatus`、`shareModules` |
| `@fuyu/plugin-base/client` | 窗口 WebView | `connectHost`、`createSlots`、`createLoader`、`createBridge`、`createServiceProxy`、`createWindowServices` |
| `@fuyu/plugin-base/client/slots` | 窗口 WebView | 插槽注册表核心（`createSlots`、`SlotError`、`BUILTIN`） |
| `@fuyu/plugin-base/client/window-services` | 窗口 WebView | 窗口内服务提供与宿主透明回退（`createWindowServices`） |
| `@fuyu/plugin-base/client/react` | 窗口 WebView | React 渲染组件 `SlotItems`（内置每项 `ErrorBoundary` 与 `Suspense`） |
| `@fuyu/plugin-base/protocol` | 全端通用 | 协议号、WebSocket 关闭码、共享模块表 `SHARED_MODULES` / `HOST_SHARED_MODULES`、主题变量表 |

### 2. Rust Crate 与配套工具包

| 包 / Crate | 位置 | 用途 |
|---|---|---|
| `plugin-base`（Rust crate） | `src-tauri/crates/plugin-base` | 查找或下载 Node、启动并看管宿主进程（心跳、退避重启、进程组/Job Object）、stdio JSON-RPC 管道、自定义协议白名单文件服务、服务注册表 |
| `plugin-base-macros`（Rust 宏） | `src-tauri/crates/plugin-base-macros` | `#[host_service]` 属性宏，把 Rust 自由函数登记为宿主可调用的 JSON-RPC 方法并配合 `ts-rs` 生成 TS 类型 |
| `@fuyu/plugin-manifest` | `packages/plugin-manifest` | `package.json` 清单校验、确定性 `.fuyu`（zip）打包解包、Ed25519 作者签名与市场签名校验 |
| `@fuyu/plugin-market` | `packages/plugin-market` | 市场索引 `index.v3.json` 与撤销名单 `revoked.v3.json` 的验签、序号单调性、过期、冷静期选版 |
| `@fuyu/plugin-review` | `packages/plugin-review` | 逐版源码与产物差异分析器（绿/黄/红三档分级） |
| `@fuyu/plugin-cli` | `packages/plugin-cli` | `build`、`pack`、`check`、`review`、`keygen`、`sign` 命令行工具 |

---

## 三、宿主应用可配置项（脱离浮屿业务）

基座把应用专有标识都做成了参数，别的应用接入时无需改动基座源码：

- **清单键名与作用域**：`@fuyu/plugin-manifest` 的 `validateManifest(pkg, { appKey, officialScope, categories, appVersion })` 支持自定义 `package.json` 下的应用字段名（默认 `"fuyu"`）、官方作用域（默认 `"fuyu"`）与分类列表。
- **插槽表**：`createSlots(rules)` 接收任意应用自定义的插槽规则表（`kind: "list" | "single"`、`max`、`perPlugin`、`groupBy`、`meta`）。
- **内置插件目录**：`startHost({ dir, builtins })` 从应用传入的 `builtins/builtins.json` 读取内置插件列表与 `kind`（`essential` / `builtin`）。
- **模块共享别名**：`startHost({ apiNames: ["my-app-plugin"] })` 将宿主应用自己的 SDK 包名映射到同一份内核实例。

---

## 四、最小示例应用（不带浮屿业务）

`examples/minimal-app/` 是一个完整的四层最小示例应用，不引用任何浮屿业务代码：

- `services.mjs`：用 `defineService("notes/v1", ...)` 定义带 `list`、`add` 方法和 `added` 事件的服务。
- `builtins/notes/host.mjs`：内置插件 `notes`，通过 `ctx.rust.call("storage.read" | "storage.write")` 调用外壳存储，并向宿主提供 `notes/v1` 服务。
- `plugins/word-count/`：按标准 `package.json` 清单组织的扩展插件 `@demo/word-count`，声明依赖 `notes/v1` 和插槽 `main.panel/v1`；宿主部分统计字数并在笔记新增时通知窗口，窗口部分往 `main.panel/v1` 插槽注册面板组件。
- `run.mjs`：启动真实 Node 宿主子进程，对接外壳 JSON-RPC 管道，连接 `"main"` 窗口客户端，加载插件窗口模块、挂载插槽、通过窗口服务调用 `notes/v1`、验证事件推送，最后在 `plugins.yml` 中停用插件并核对插槽与资源清零。

直接运行示例：

```bash
node packages/plugin-base/examples/minimal-app/run.mjs
```

运行自动化测试：

```bash
node --test packages/plugin-base/test/minimal-app.test.mjs
```

---

## 五、每条保证的说明

基座对插件和宿主应用的全部承诺逐条登记在 [docs/architecture/plugins/v3-guarantees.md](../../docs/architecture/plugins/v3-guarantees.md) 中，每条承诺都由自动化测试守住（共 62 条，分布在 `packages/plugin-base/test/*.test.mjs` 与 `src-tauri/crates/plugin-base/tests/`）：

1. **依赖与启动顺序（#1–#5）**
   - 插件声明在 `inject` 里的服务未就绪时不启动，状态为 `waiting` 并指明等待的服务名；
   - 启动顺序完全由依赖图决定，与 `plugins.yml` 书写顺序无关；
   - 提供者停用时，依赖它的插件按拓扑逆序先停并回到 `waiting`，提供者恢复后自动重启；
   - 安装在宿主目录外的插件通过模块钩子拿到与宿主同一份内核实例（`instanceof Context` 恒成立）。
2. **服务冲突与版本化调用（#6–#7、#57）**
   - 同一服务的第二个提供者启动失败（`failed`），报错同时指明服务名与已提供该服务的插件 `id`，原提供者不受影响；
   - `defineService` 定义的服务在宿主与窗口调用时均校验方法/事件声明与超时；提供者下线时未完成调用立即以 `peer-gone` 失败，不傻等超时。
3. **清理、回滚与受管定时器（#8–#14）**
   - 插件停用时每个清理函数恰好执行一次；同步抛错、异步 `apply` 拒绝或文件缺失时，已登记的副作用与监听器全部回滚撤掉；
   - `ctx.setTimeout`、`ctx.setInterval`、`ctx.sleep` 随插件停用自动清理，停用后绝不再触发回调。
4. **按配置调和（#15–#16）**
   - 修改单个插件的 `config` 只重启该插件；修改 `plugins.yml` 实时停用或启用对应条目。
5. **反复装卸不泄漏（#17–#18）**
   - 同一插件在宿主进程（开启 `--disallow-code-generation-from-strings`）中反复加载卸载 1000 次后，活动句柄、定时器数回到初始值，GC 后堆增长受严格上限约束。
6. **出错隔离与自动停用（#19–#22、#46–#49）**
   - 单个插件的监听器抛错、定时器未捕获异常、未处理的 Promise 拒绝按调用栈归因到该插件，不影响其他插件且不让宿主退出；
   - 内核统计每个插件的近似 CPU、`apply` 耗时、定时器数、监听器数、服务数与窗口文件数；
   - 同一插件在 60 秒时间窗内出错达 5 次即在本轮运行自动停用（`auto-disabled`），撤掉全部副作用且不改写 `plugins.yml`。
7. **安全模式、热重载、来源校验与二分排查（#50–#53、#59–#61）**
   - 安全模式 `third-party` 只跑 `essential` 与 `builtin` 插件，`minimal` 只跑 `essential` 插件，被拦下的插件一行代码都不执行；
   - 内置插件名单由 `builtins.json` 决定，`plugins.yml` 不能篡改内置插件身份或代码路径；
   - 市场与手动安装的插件若有 `experimental` 声明则拒绝加载，实际注册了未声明的服务或窗口时在状态中标记 `undeclared`；
   - `host.bisect` 支持在内存中按名单停用一组第三方插件做二分排查，不落盘改写 `plugins.yml`。
8. **宿主管道、Rust 桥与看管恢复（#23–#39、#58）**
   - 插件打印到 `stdout` 的内容全部重定向到 `stderr`，保证 stdio JSON-RPC 管道干净；
   - `ctx.rust` 仅对内置插件开放，第三方插件调用立即报 `forbidden`；
   - 对端进程退出时，所有等待中的调用立即以 `peer-gone` 失败；
   - Rust `Supervisor` 通过心跳与管道断开检测宿主异常，崩溃后立即重启、连续失败按指数退避，主程序退出时宿主必随之退出。
9. **窗口连接、插槽与加载器（#39–#45、#54–#56、#62）**
   - WebSocket 连接在升级前校验 `Origin`，握手阶段校验随机令牌、协议版本与 `hello` 超时；
   - 宿主重启换端口与令牌后，窗口自动重连并拉取最新快照；发现事件序号缺口时主动请求快照；
   - 插槽严格执行 `order`、`max`、`perPlugin`、同 `id` 显式替换与卸载恢复，每个插槽项独立包错误边界；
   - 窗口加载器在 `import()` 前先检查文件存在与 MIME，给出可读的错误定位。
