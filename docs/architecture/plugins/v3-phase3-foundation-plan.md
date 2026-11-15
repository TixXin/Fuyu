# 插件平台第 3 版第 3 阶段「地基」：分步计划

任务 E36.3（#293），父任务 E36（#289）。第 3 阶段按方案要等第 2 阶段（E36.2）做完，但其中**不碰窗口和插槽**的部分可以先做，这份计划只管这一块。主 agent 会话「第 3 阶段地基主 agent」2026-11-15 整理，用户 2026-11-15 确认「按建议开始」（「要用户定的事」第 2–5 条按建议，第 1 条等 E36.3.1 出来再定）。经理是会话「插件平台第 3 版基线和可行性验证」，编译名额和合入由它协调；第 2 阶段由「E36.2 插槽化主 agent」负责，它的计划在 [v3-phase2-plan.md](v3-phase2-plan.md)。

做子任务的会话开工先读这份，再读 [进度](v3-progress.md)、[流程](v3-workflow.md)、[边界](v3-boundary.md)、[方案](v3-everything-plugin.md)「内置功能怎么变成插件」「从 rutis 借鉴的」。

## 范围

| 在地基里 | 不在地基里（等第 2 阶段，或第 3 阶段正式开工再拆） |
|---|---|
| 回头评估 rutis（方案要求，第 3 阶段开始前要用户定） | 计时器、翻译的界面往插槽注册（等 E36.2.3 插槽核心合入，展开页、设置分节分别等 E36.2.5、E36.2.9） |
| 服务怎么声明、怎么调：插件之间、窗口调宿主的服务 | 窗口一侧调服务的代理（`packages/plugin-base/src/client/`，归第 2 阶段，见「对第 2 阶段的要求」） |
| 宿主调 Rust 的通道（协议 2）、Rust 推事件给宿主 | 其余 20 多个功能的迁移 |
| 给 Rust 函数加标记，生成宿主入口和 TypeScript 类型 | 设置的插件页列出全部内置插件（界面，等插槽） |
| 内置插件怎么随应用带上、怎么加载和单独关掉（宿主一侧） | 托盘菜单（第 2 阶段计划把它推到「第 3 阶段和 Rust 能力的提供者一起做」：通道做好后再拆子任务） |
| 计时器、翻译的**宿主一侧**样板：服务注册、调用、关掉后不留后台 | 把 `fuyu-timers` 从 `localStorage` 搬走（对外契约，随计时器界面接入一起做） |
| 密钥不经 JS：摸底和设计 | 各领域按设计改代码（设计定了以后按领域另拆子任务） |

## 现状（摸底结果）

| 东西 | 现在 | 地基要补的 |
|---|---|---|
| 宿主 ↔ Rust（协议 1） | 只有 Rust 调宿主（`ping`、`status`、`stop`），宿主只发通知（`ready`、`log`、`fatal`）。Rust 的 `rpc.rs` 把带 `method` 的消息**一律当通知**，宿主发来的请求不会有回答 | Rust 能回答宿主的请求（按名字分发、超时、并发、`peer-gone`）；Rust 往宿主推事件 |
| 宿主 ↔ 窗口（协议 1） | 窗口只能调 `status`、`host` 和**自己那个插件**的 `plugin.call` | 窗口按名字调宿主上的服务、订阅服务的事件 |
| 插件之间 | Cordis 的 `ctx.provide` / `inject` 能用，没有类型、没有版本，没有约定写法 | 服务的类型包和声明写法：名字、版本、方法、事件 |
| Rust 能力 | 325 个 Tauri 命令只能 `invoke`；领域函数和命令函数多数是同一个函数 | 标在领域函数上的宏 → 宿主入口 + TS 类型 |
| 内置插件 | 没有：宿主只读数据目录的 `plugins.yml`，第 1 阶段只有演示插件，`kind` 由条目自己写 | 应用自带的内置插件清单，`plugins.yml` 只记开关 |
| 计时器 | 纯前端：`src/features/timer/store.ts` 存 `localStorage` 的 `fuyu-timers`，到点在岛屿窗口里响 | 宿主里的 `timers` 服务（窗口全关也能到点），关掉插件后没有定时器 |
| 翻译 | 前端 `api.ts` 直接 `invoke` 13 个命令；密钥只进不出（`save_translation_secret` / `has_translation_secret`），`translate_text` 在 Rust 里读密钥 | 宿主里的 `translator` 服务，经通道调 Rust；密钥照旧只在 Rust |
| 密钥 | Rust 里碰凭据管理器的模块：翻译、日历、邮件、Claude 用量、手机推送、本机接口令牌、Agent 审批令牌、cc-connect、第 2 版插件的密钥存储等；有没有命令把明文交给 JS 没核对过 | 逐条摸底，出设计 |
| rutis | 第 0 阶段读的是 `1dd73888`（v0.21.0 之后），一个月 23 个版本 | 第 3 阶段开始前回看 |

## 子任务

编号是 E36.3 的子任务，issue 在用户同意后建。**scope 是认领时的 `--scope`**，两个会话不碰同一个文件。所有会话都遵守根 `AGENTS.md` 和 [流程](v3-workflow.md)。

| 编号 | 内容 | scope | 依赖 | 编译 | 做完的标志 | 验证 |
|---|---|---|---|---|---|---|
| **E36.3.1** | **回看 rutis，选生成工具**。rutis 从 `1dd73888` 到现在：版本、不兼容改动、有没有别人在用、能不能当「外层」接管 Rust ↔ 宿主那一段；顺带比较生成 TS 类型的三条路：`ts-rs`（方案原定）、`specta`（还能生成窗口用的 `invoke` 封装）、照 rutis 读源码。结论按「继续自己写 / 换成 rutis」给建议 | `docs/research/rutis-revisit.md`（新），`docs/research/cordis-vs-rutis.md` 结论处加一行指向它 | 无 | 不编译（只读文档和源码，必要时在仓库外的临时目录跑小样，不进 `src-tauri/target`） | 调研按 `docs/research/README.md` 的格式写好；结论交主 agent，**主 agent 拿给用户定**（流程「第 3 阶段开始前回头评估 rutis」） | 仅文档 |
| **E36.3.2** | **服务的契约和类型包**。设计文档 `v3-services.md`：服务名带版本（`translator/v1`，和插槽一样）、方法和事件的类型怎么声明、跨进程只传 JSON（边界规则 1）、谁能调谁（插件之间同进程直接调；窗口经 WebSocket 按名字调；Rust 经通道）、替换和冲突沿用方案「服务的替换和冲突」。新包 `packages/plugin-services`（`@fuyu/plugin-services`，私有）：`defineService<Methods, Events>()` 和每个内置服务的类型声明（先放计时器、翻译两个）。宿主一侧：窗口调服务的分发（`service.call`、`service.on`，只认声明过的方法）、`ctx.services` 的受管注册 | `docs/architecture/plugins/v3-services.md`（新），`packages/plugin-services/`（新），`packages/plugin-base/src/host/services.mjs`（新）、`packages/plugin-base/src/host/main.mjs`、`packages/plugin-base/src/host/index.d.mts`、`packages/plugin-base/test/services.test.mjs`（新）；公共文件见下表 | 无（设计部分可以先写；宿主分发的代码等 E36.3.1 没推翻方向再写） | 不编译 | 宿主测试覆盖：没声明的方法回 `no-method`、提供者停用后调用回 `peer-gone` 或 `not-ready`、提供者换掉后订阅者收到新的、反复注册卸载不留监听器；类型检查过（`types.check.mts` 加用例） | `pnpm check` + `pnpm build` |
| **E36.3.3** | **宿主调 Rust 的通道（协议 2）**。Rust 的 `rpc.rs` 分出「请求」和「通知」，请求交给登记的处理函数，在工作线程里跑、带超时和并发上限，回答或回错误（`{ code, message, data }`，边界规则 1、4、6）；Rust → 宿主的事件用通知 `event`；`ready` 里报 `protocol: 2`，Rust 只认 2；宿主侧 `ctx.rust.call(方法, 参数)`、`ctx.rust.on(事件)`，都是受管的，插件停用时撤掉订阅、等着的调用立刻失败；流式结果（翻译要用）用「调用 id + 进度通知」，写进协议。先手写一张两三个方法的分发表（例如 `app.version`、一个回声），宏留给 E36.3.4 | `src-tauri/crates/plugin-base/src/rpc.rs`、`src-tauri/crates/plugin-base/src/serve.rs`（新）、`src-tauri/crates/plugin-base/src/lib.rs`、`src-tauri/crates/plugin-base/tests/`、`src-tauri/src/plugin_kernel/`（**等 E36.2.11 那边没提交的改动提交后再动**）、`packages/plugin-base/src/host/rpc.mjs`、`packages/plugin-base/src/host/rust.mjs`（新）、宿主的测试；公共文件见下表 | E36.3.1（rutis 若接管这一段，这个子任务改写或取消） | **编译中**：只动 `plugin-base` crate 和 `plugin_kernel`，增量快 | 宿主连发 100 个并发调用都拿到回答；Rust 侧处理函数 panic 只让这一个调用失败；杀掉宿主时 Rust 侧正在跑的处理函数结果被丢弃、不卡；超时写明方法名和时长；`v3-boundary.md` 改成协议 2 | `pnpm heavy -- cargo test …` + Windows 交叉 clippy + `pnpm build:exe` + `pnpm check`；再加「杀掉宿主后恢复」的测试（流程的要求） |
| **E36.3.4** | **「标记即服务」的宏和代码生成**。新的过程宏 crate `src-tauri/crates/plugin-base-macros`：`#[host_service("translator.translate")]` 标在领域的自由函数上（同步或 `async`），生成 JSON 参数解码、调用、编码和一条 `inventory` 登记；能注入 `AppHandle` 这类状态参数；重名在启动时报错并写明两边；能和 `#[tauri::command]` 叠在同一个函数上（第 0 阶段没试过，先验证）。TS 类型按 E36.3.1 选的工具生成到 `packages/plugin-services/src/generated/`，脚本 `scripts/plugins-v3/gen-rust-types.mjs`，`pnpm check` 里加一项「生成的类型是最新的」。E36.3.3 的手写分发表换成从登记表读 | `src-tauri/crates/plugin-base-macros/`（新）、`src-tauri/crates/plugin-base/src/serve.rs`、`src-tauri/crates/plugin-base/src/lib.rs`、`scripts/plugins-v3/gen-rust-types.mjs`（新）、`packages/plugin-services/src/generated/`；公共文件见下表 | E36.3.1（工具选型）、E36.3.3 | **编译重**：新的过程宏 crate（`syn`、`quote`）和新依赖，第一次全量编译 | 宏的单元测试（同步、`async`、注入参数、错误类型、重名）；`ts-rs` / `specta` 生成的声明和手写的一致；在一个真实领域函数上标过并经宿主调通；补齐后的行数记进任务（第 0 阶段估 600–900 行） | 同 E36.3.3 |
| **E36.3.5** | **计时器的宿主样板**。内置插件 `timer` 的宿主部分：提供 `timers/v1` 服务（增、删、暂停、继续、延长、列表；事件 `changed`、`due`），计时规则直接用 `src/features/timer/timers.ts` 里的纯函数（不复制）；状态写到数据目录下插件自己的文件（边界规则 7），宿主重启后接着算；到点发 `due` 给窗口。**不接界面、不碰 `fuyu-timers`**：岛上照旧用现在的计时器，样板只在 `FUYU_PLUGINS_V3=1` 时跑 | `src/features/timer/host/`（新，内置插件宿主部分的第一个，位置按 E36.3.2 / E36.3.6 定的规则）、`tests/unit/timer-host.test.mjs`（新） | E36.3.2；内置插件的加载用 E36.3.6，没做完之前用 `plugins.yml` 条目加载 | 不编译 | 测试：到点发 `due`；宿主重启后剩余时间对；插件停用后 `usage.timers` 是 0、文件句柄关掉；反复启停 200 次不涨定时器和监听器 | `pnpm check` + `pnpm build` |
| **E36.3.6** | **内置插件怎么带上、怎么加载、怎么关**（宿主一侧）。应用自带一份内置插件清单（随安装包，不在数据目录），宿主把它和数据目录的 `plugins.yml` 合起来：内置的默认开、`kind` 由清单定（不由用户写的条目定），`plugins.yml` 只记开关和配置；内置插件宿主部分的写法和打包（TS 写在 `src/features/<功能>/host/`，构建时打成宿主能直接加载的 `.mjs`，开发版直接从源码目录加载、能热重载）；Rust 拉宿主时多传内置目录。界面的开关等插槽 | `packages/plugin-base/src/host/kernel.mjs`、`packages/plugin-base/src/host/builtins.mjs`（新）、宿主的测试、`scripts/plugins-v3/build-builtins.mjs`（新）、`src-tauri/src/plugin_kernel/`（只加一个参数，**排在 E36.3.3 之后**） | E36.3.2 | **编译中**：Rust 只改一处参数 | 关掉一个内置插件后它的服务、定时器、监听器、界面文件全撤；用户写的条目不能把第三方插件冒充成 `builtin`；正式构建的产物里有内置插件，`pnpm build` 不变慢太多（记前后时间） | `pnpm check` + `pnpm build` + `pnpm heavy -- cargo test …` + `pnpm build:exe` |
| **E36.3.7** | **密钥不经 JS：摸底和设计**。列出全部碰密码、令牌、密钥的命令和存储：谁写、谁读、有没有命令把明文交给窗口（以后也就是交给宿主）；按方案「密码、令牌这类数据不回到 JS」出设计：只进不出的写入、只回「有没有」、要给用户看的（例如本机接口令牌、手机推送的配对码）改成 Rust 直接放剪贴板或系统对话框、用的地方都在 Rust；第 2 版插件的密钥存储第 6 阶段随第 2 版删，不改。每个要改的领域列成后续子任务（先不建） | `docs/architecture/plugins/v3-secrets.md`（新） | 无 | 不编译 | 表里每一行写明命令名、文件、现在的去向、要不要改、怎么改；交主 agent 审，后续子任务的拆法写进去 | 仅文档 |
| **E36.3.8** | **翻译的宿主样板**。内置插件 `translation` 的宿主部分：`translator/v1` 服务（翻译、改写，带流式），经 E36.3.4 的宏把 `translate_text` / `rewrite_text` 的领域函数接到宿主；密钥照旧只在 Rust，服务的接口里没有密钥。窗口一侧不改（照旧 `invoke`），界面接入等插槽 | `src/features/translation/host/`（新）、`src-tauri/src/translation/`（只加标记、把命令函数拆成「命令 + 领域函数」时只做搬迁，搬迁和改写分开提交）、生成的类型、对应测试 | E36.3.4、E36.3.6、E36.3.7 | **编译重**：碰 `src-tauri/src/` 主 crate | 宿主插件调 `translator.translate` 拿到结果和流式片段；关掉翻译插件后没有后台；窗口里现在的翻译照常（回归页 `translation*` 照过）；密钥不出现在任何宿主可见的返回值里（测试断言） | Rust 一套 + `pnpm check` + `pnpm build` + `pnpm test:regression translation` |
| **E36.3.9** | **第 5 阶段要的宿主一侧（加载来源和清单核对）**，来自第 5 阶段地基的 R1、R2、R4、R6（经理 2026-11-15 转来）。`plugins.yml` 条目分三种来源：内置、已安装的包、开发文件夹；按插件目录的 `package.json` 里 `fuyu.host` / `fuyu.client` 加载，用第 5 阶段的 `@fuyu/plugin-manifest` 校验；来源是市场或手动安装、清单写了 `experimental` 的拒绝加载（开发和内置放行）；加载时核对声明和实际（注册了没声明的插槽、服务），插件状态加一个字段；`protocol` 导出共享模块名单和转接文件的相对路径（`react`、`react/jsx-runtime`）。**E36.5.4 前先交 R2 这一项**（小，单独一个提交） | `packages/plugin-base/src/host/`（`kernel.mjs`、`builtins.mjs`、`gate.mjs`、`status.mjs`）、宿主的测试、`protocol.mjs` / `.d.mts`（排在 E36.2.3 之后；`client/shims` 归第 2 阶段，动之前先跟它说） | E36.3.6；`@fuyu/plugin-manifest`（第 5 阶段）；R2 只等 E36.2.3 | 不编译 | 三种来源各有测试；带 `experimental` 的市场插件状态是 `failed` 并写明原因；声明和实际不符时状态里有标记；`protocol` 的名单和 `client/shims` 一致（测试核对） | `pnpm check` + `pnpm build` |
| **E36.3.10** | **二分排查和 `fuyu-plugin` 别名**（第 5 阶段地基的 R3、R5）。浮屿拉宿主时传 `--api fuyu-plugin`；宿主加「这次运行停用这几个第三方插件」的入口（和自动停用一样只在内存里，经协议 2 由 Rust 调）；Rust 一侧记二分进度的文件（类似 `safe-mode.json`） | `packages/plugin-base/src/host/gate.mjs`、`main.mjs`、宿主的测试、`src-tauri/src/plugin_kernel/`（排在 E36.3.3、E36.3.6 之后） | E36.3.3 | **编译中** | 停用名单生效、重启宿主后不留；进度文件写读有测试；用 `fuyu-plugin` 包名 import 的插件拿到同一份内核 | Rust 一套 + `pnpm check` |

### 先后和并行

```text
第一波（不编译，3 个会话并行）：E36.3.1 rutis 回看 ─┐
                                E36.3.2 服务契约（先写设计）
                                E36.3.7 密钥摸底
            └─ 用户定 rutis 结论 ─┐
第二波：E36.3.3 通道（编译 1）   E36.3.5 计时器样板（不编译）   E36.3.2 收尾（宿主分发）
第三波：E36.3.4 宏（编译 1，接 E36.3.3 的同一个会话） E36.3.6 内置插件加载（编译 1，Rust 部分排在 E36.3.3 之后）
第四波：E36.3.8 翻译样板（编译 1）
之后：E36.3.9（R2 那一项等 E36.2.3 合入就做，其余等第 5 阶段的清单包）、E36.3.10（编译 1）
```

- **编译名额**：任何时候这条线最多占 2 个，多数时候 1 个。第一波不占；第二波 1 个；第三波 2 个（E36.3.6 的 Rust 只改一个参数，可以等 E36.3.4 空档时再编）；第四波 1 个。第 2 阶段同时在编时，经理分配，排不上的往后挪，先做 TS 和设计。
- E36.3.3 和 E36.3.4 交给**同一个会话**先后做：两个都改 `plugin-base` crate 的 `serve.rs`、`lib.rs`，同一会话省一次交接和一次全量编译。
- E36.3.3、E36.3.6 都动 `src-tauri/src/plugin_kernel/`：第 2 阶段的子会话正在做 E36.2.11（#434），改 `plugin_kernel/` 的启动和安全模式部分，可能还有 `src-tauri/crates/plugin-base/src/supervisor.rs`。**E36.2.11 合入前，地基不碰 `plugin_kernel/` 和 `supervisor.rs`**，经理在它合入后通知本主 agent；之后 E36.3.3 先、E36.3.6 后。E36.3.3 在那之前可以先做宿主一侧（`rpc.mjs`、`rust.mjs`）和 crate 里不碰 `supervisor.rs` 的部分（`rpc.rs`、`serve.rs`）。
- `src-tauri/Cargo.toml`、`Cargo.lock` 现在也有别的会话（`sherpa-runtime`）没提交的改动：E36.3.4 加 crate 成员和依赖前先看 `git status`，等对方提交。

## 公共文件（要经理协调先后）

| 文件 | 地基里谁改、改什么 | 第 2 阶段那边 |
|---|---|---|
| `packages/plugin-base/src/protocol.mjs`、`protocol.d.mts` | E36.3.3：`HOST_PROTOCOL` 改成 2。E36.3.2：窗口协议加 `service.call`、`service.on` 的常量（只加，`WINDOW_PROTOCOL` 不升） | E36.2.3 可能加插槽相关常量 |
| `packages/plugin-base/src/index.d.mts`（插件看到的 `ctx` 类型） | E36.3.2 加 `ctx.services`，E36.3.3 加 `ctx.rust` | E36.2.3 改 `ctx.slots` |
| `packages/plugin-base/package.json` | E36.3.2 可能加 `./services` 导出 | E36.2.3 加 `./client/slots` 子路径 |
| `pnpm-workspace.yaml`、根 `package.json` | E36.3.2 加新包；E36.3.4 加 `gen` 脚本和 `check` 里的一项 | — |
| `src-tauri/Cargo.toml`、`Cargo.lock` | E36.3.4 加 crate 成员和依赖 | E36.2.10、E36.2.11 可能动 |
| `docs/architecture/plugins/v3-boundary.md` | E36.3.2 加「服务」一节，E36.3.3 改「Rust 和宿主之间」成协议 2 | E36.2.3 加「插槽」一节 |
| `docs/architecture/contracts.md` 第 3 版那一条 | E36.3.2（服务名单）、E36.3.3（协议 2）、E36.3.6（内置插件清单的位置） | E36.2.3（插槽名单） |
| `docs/architecture/plugins/v3-progress.md` | 只由本主 agent 收口时改 | 第 2 阶段主 agent |

**排在 E36.2.3 之后**（经理 2026-11-15 定）：E36.2.3 已登记要改 `packages/plugin-base/package.json`、`packages/plugin-base/src/client/index.d.mts`、`v3-boundary.md`（加「插槽」一节）、`contracts.md`。地基对 `package.json`、`v3-boundary.md`、`contracts.md` 的改动都等 E36.2.3 合入后再提交；在那之前只写各自的新文件（`v3-services.md`、`packages/plugin-services/`、`host/services.mjs` 等），要加的段落先写在新文件或任务的交接里。`client/index.d.mts` 地基不碰。

建议的规矩：这些文件**一次只有一个会话改，改完单独先合入**（流程「改公共定义要单独先合入」），不同节由不同的线改；改之前在本主 agent 这里登记，本主 agent 和第 2 阶段主 agent 对一下时间。

## 对第 2 阶段的要求

经理先拿去和第 2 阶段主 agent 对：

1. **窗口一侧调服务的代理**：放在 `packages/plugin-base/src/client/`（第 2 阶段的地盘）。建议 E36.2.3 合入后，由地基这边在 `client/services.mjs`（新文件）里写，只加新文件和 `client/index.mjs` 里一行导出；或者由第 2 阶段顺手做。需要第 2 阶段主 agent 同意其一。
2. **窗口协议只加不升**：地基给窗口协议加的 `service.call`、`service.on` 都是新方法，旧窗口不调就不受影响，`WINDOW_PROTOCOL` 保持 1。第 2 阶段如果要升窗口协议，先说一声，两边并成一次。
3. **插槽项的 props 是实验接口**（第 2 阶段计划已定）：计时器、翻译的界面接入时照用，地基不对它提要求。
4. **内置项的 `owner`**：第 2 阶段定为固定的 `builtin`。第 3 阶段内置功能变成插件后，`owner` 要换成内置插件的 id（`timer`、`translation`），才能「关掉一个插件就撤掉它的界面」。建议 E36.2.3 的注册接口留出 `owner` 参数（默认 `builtin`），不写死。
5. 插槽规则本身（名字、种类、上限）地基**没有要改的**。

**第 2 阶段主 agent 的答复（2026-11-15，经理转达）：全部同意，没有冲突。** ① `client/services.mjs` 由地基写，排在 E36.2.3 合入之后；E36.2.3 会改 `client/index.mjs`、`client/index.d.mts`，地基合入前先 sync，只加自己那一行导出。② E36.2.3 不动窗口协议，`WINDOW_PROTOCOL` 保持 1。③ E36.2.3 的注册接口带 `owner` 参数，默认 `builtin`。

- E36.3.9、E36.3.10 是 2026-11-15 经理转来第 5 阶段地基的要求后加的，issue 和任务到开工时再建。
- `pnpm-workspace.yaml`、`packages/tsconfig.json`、`pnpm-lock.yaml` 由第 5 阶段地基先做骨架提交；之后地基的会话要动这三个文件，先问经理，和第 5 阶段错开。
- R7（市场客户端放哪）：同意第 5 阶段的建议，做成宿主里的内置插件（服务 `market/v1`），信任根（公钥）编进 Rust、启动时交给宿主；写进 `v3-services.md` 的服务清单，最终由用户和第 5 阶段的问题一起定。

## 要开的 issue

用户 2026-11-15 同意「按建议开始」，已建：E36.3.1 #465、E36.3.2 #466、E36.3.3 #467、E36.3.4 #468、E36.3.5 #469、E36.3.6 #470、E36.3.7 #471、E36.3.8 #472。父 issue #293 下回复了这份计划。

## 要用户定的事

**用户 2026-11-15 的决定（经经理转达「都按推荐」）**：第 1 条，继续自己写通道和宏（E36.3.3、E36.3.4），不换成 rutis；TS 类型用 `ts-rs`；窗口的 `invoke` 第 3 阶段不生成类型化封装（[rutis-revisit.md](../../research/rutis-revisit.md)）。第 5 条和 E36.3.7 的问题：设置里不再显示本机接口令牌的明文，只留 Rust 复制；4 个修复子任务现在就在地基里做（E36.3.11 #476 本机接口令牌、E36.3.12 #477 日历链接、E36.3.13 #478 更新代理、E36.3.14 #479 检查脚本，见 [v3-secrets.md](v3-secrets.md)「后续子任务」）；以后的插件安装确认文案如实写「宿主插件能自己读凭据管理器」。R7：市场客户端做成宿主里的内置插件 `market/v1`，信任根编进 Rust。

| # | 事 | 建议 |
|---|---|---|
| 1 | **rutis 的结论**（流程规定第 3 阶段开始前要你定） | 先做 E36.3.1，结论出来后我拿给你；E36.3.3、E36.3.4 等你定了再派。现在的预期是「继续自己写」：第 0 阶段时它一个月 23 个版本、嵌入多 9.6 MB、发现不了卡死 |
| 2 | **宿主和 Rust 之间升协议 2** | 升。协议 1 里 Rust 把宿主的请求当通知，宿主调 Rust 会一直等到超时；这是语义变化，按边界规则 9 升版本。宿主的 JS 和 Rust 随同一个安装包发，实际上不会错配，升版本只是让错配时明确报错 |
| 3 | **内置插件的宿主部分写在哪** | `src/features/<功能>/host/`，TypeScript，构建时打成 `.mjs` 随安装包带上；开发版直接加载源码、能热重载。同一个功能的宿主和界面在一个目录里，符合方案「浮屿自己的内置插件在 `src/` 下，按 `features/` 逐个改造」。要配一条 lint：`host/` 里不能 import 浏览器的东西和 `@tauri-apps/api` |
| 4 | **计时器的数据** | 样板阶段宿主用自己的文件，不碰 `localStorage` 的 `fuyu-timers`；等计时器界面接入插槽时，再一次性迁过去（那是对外契约的变更，要迁移和兼容读取） |
| 5 | **密钥设计出来后的改法** | 设计（E36.3.7）只出文档；要不要在第 3 阶段就把各领域改掉，看设计里改动量再定 |

## 收口（本主 agent）

看每个子任务的 diff 和提交；更新 `v3-progress.md`（「当前状态」加一行地基的进度，第 3 阶段正式开工时再改阶段表）、`v3-boundary.md`、`contracts.md`、`overview.md`、`platforms.md`（预期不变，核对一次）、根 `AGENTS.md` 目录总览（新包、新 crate）、`src/AGENTS.md`（`features/<功能>/host/` 的规则，E36.3.6 定）；核对 8 个 issue 都已回复并关闭；要真机看的列进「待人工验收」，Windows 上要测的汇总给经理（预期：协议 2 的通道和计时器样板在 Windows 上各跑一次，宿主重启后计时器接着算）。
