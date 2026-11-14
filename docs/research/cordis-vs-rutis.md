# 插件内核用 Cordis 还是 rutis

> 日期：2026-11-14。问题：插件平台第 3 版（[v3-everything-plugin.md](../architecture/plugins/v3-everything-plugin.md)）的内核，是按原定的用 Cordis（拷进仓库），还是改用 rutis，各自的优缺点。范围：`cordiverse/cordis` 的仓库数据、npm 发布历史和下载量、之前读过的源码结论（[技术可行性](plugin-host-feasibility.md)、[桌面框架调研](desktop-frameworks-web.md)）；`arcships/rutis` 的 README、设计理念、Rust 宿主指南、Cordis 互操作指南、质量状态、常驻内存测量、应用集成和插件安装的设计文档（main 分支，2026-11-14）。**两边都只读了文档和源码，没有运行过**；rutis 有些设计标着「定稿，未实现」。上一份调研：[有没有人已经做了这个基座](tauri-plugin-base-prior-art.md)。

## 结论

- **两者不是同一层的东西**。Cordis 是「一个进程里的插件框架」：JS 写的，插件之间直接拿到对方的对象。rutis 是「跨进程、跨语言的插件运行时」：Rust 写的内核，把 Cordis 的生命周期模型带到多个语言和多个进程。
- **建议：维持决定 3，用 Cordis**，理由按分量排：
  1. **窗口里也需要一个内核**。界面插槽跑在 WebView 里，Cordis 能在浏览器里跑（Koishi 的控制台就是），宿主和窗口可以用同一套模型；rutis 没有给浏览器用的 SDK，用它的话窗口里还得另找一套，变成两套模型。
  2. **内置功能之间调用很密**。Cordis 里同一个进程的插件直接拿对象、同步调用；rutis 里跨边界的服务是代理、全部异步，一次约 30 微秒。「万物皆插件」要把二十多个内置功能拆成互相调用的插件，同进程的模型省事得多。
  3. **成熟度**。Cordis 有四年半历史、每周约 5.9 万次下载、Koishi 和 DeepSeek Harness 在生产使用；rutis 公开不到两个月、每周约 400 次下载。
- **rutis 真正强的一块是「Rust 和 JS 插件之间」**：进程看管、跨进程协议、把 Rust 的类型标成服务、诊断，这些它是现成的，而且质量工程做得很扎实；按 Cordis 走，这块要自己写。
- **所以不是二选一做完就丢**：建议第 0 阶段花一天试一下 rutis 嵌进 Tauri；到第 3 阶段（给 Rust 能力接入口）时再决定这一段用自己写的管道，还是用 rutis 当「外层」、Cordis 当「里层」（rutis 能直接挂 Cordis 插件）。方案里已经定了插件只用我们包的 `fuyu-plugin` 接口，所以以后换底层不影响插件作者。

## 它们各是什么

| | Cordis | rutis |
|---|---|---|
| 仓库 | [cordiverse/cordis](https://github.com/cordiverse/cordis)，MIT | [arcships/rutis](https://github.com/arcships/rutis)，MIT |
| 语言 | TypeScript | Rust 内核；TypeScript、Python、Go、Swift、Kotlin 各有一个小 SDK |
| 定位（各自的说法） | 在一个进程里运行一个插件生态 | 让宿主程序连接更多的运行时、进程和设备，并理解、迭代这些连接；「给会自己迭代的软件用的插件运行时」 |
| 关系 | Koishi 的内核；DeepSeek Harness 把它拷进自己仓库用 | 生命周期模型来自 Cordis，核心语义逐条对照过；但明说「不是 Cordis 的翻译」，只在一个进程里成立的机制没有带过来 |
| 历史 | 2022-05 建；npm 上 169 个版本；3.x 稳定版最后一版是 3.18.1（2024-09）；**4.0 从 2024-11 的 alpha 到 2026-11 的 rc.13，预发布了两年** | 2026-09-22 建；v0.21.0（2026-11-06）；0.13 到 0.21 每个小版本都有迁移说明 |
| 热度 | 9888 star、638 fork；npm 每周约 59,000 次下载 | 173 star、12 fork；npm（`@arcships/rutis`）每周约 430 次下载 |
| 维护 | 主要作者一人（shigma，593 次提交） | 主要作者一人（eric8810，3252 次提交） |
| 谁在用 | Koishi（6300 star）及其插件生态、DeepSeek Harness（生产） | 没查到公开的生产用户 |

## 逐项对比

| 方面 | Cordis | rutis | 对浮屿更合适的 |
|---|---|---|---|
| **窗口（WebView）里能不能跑** | 核心包不依赖 Node，能在浏览器里跑；Koishi 控制台、DeepSeek Harness 的网页端都是它 | README 和指南里只有 Node、Bun、Python、Go、Swift、Kotlin 的 SDK，没找到浏览器用的 | **Cordis**：宿主和窗口同一套模型 |
| **同进程的插件怎么互相调用** | 直接拿到服务对象，可以同步调用，能传任何 JS 值 | 同一个 Node 运行时里的插件可以直接调；跨运行时、跨到 Rust 的是代理，全部异步，`instanceof` 不成立，值要能按它的规则转换 | **Cordis**：内置功能之间调用密 |
| **Rust 的能力怎么给插件用** | 没有这一层，要自己写：管道协议、每个领域接一个入口 | 给 Rust 类型标 `#[rutis::service]`，它就按名字对所有语言提供；提供者被换掉时使用者自动重启 | **rutis** |
| **看管宿主进程** | 没有，要自己写（方案里是改用第 2 版的那套代码） | 有：启动运行时、连接、检测停止；崩溃后不会自动重启，要宿主调 `restart`（它的命令行宿主有这个设置）；宿主被杀时运行时不留孤儿，三个系统都有测试 | **rutis**，但差距不大：浮屿已经有看管子进程的代码 |
| **诊断：谁在等什么** | 缺依赖时静悄悄地等，要自己做状态视图 | 有：`diagnostics()` 列出每个插件的状态、在等什么、谁提供了什么；`check` 不运行就能查出没人提供的服务 | **rutis** |
| **同名服务冲突** | 第二个注册直接抛错 | 同样拒绝，错误信息写明双方是谁 | 平 |
| **事件** | 五种分发方式，同进程 | 同样五种，跨语言、跨进程语义一致；跨边界的同步等待有限制，会明确报错而不是悄悄降级 | 平（浮屿不需要跨语言的事件） |
| **加载器和热重载** | 有，但只能在 Node 里跑，要用 Node 的内部接口（加 `--expose-internals`） | 有：按配置把运行中的系统调和到目标状态；文件变了重载 | 平 |
| **配置的 schema** | 有（schemastery，Koishi 用它自动生成设置界面） | 有（0.18 起的配置 schema） | 平 |
| **插件能用的语言** | JS / TS | TS、Python、Go、Swift 等；每多一种语言就多一个运行时进程 | 看需求：以后想要 Python 插件的话是 rutis 的加分项，现在用不上 |
| **现成的插件生态** | Koishi 的插件（多是聊天机器人相关，对浮屿用处不大） | 自己没有生态；能不改代码挂 Cordis 插件 | 平 |
| **插件作者写起来** | `ctx.foo` 直接用，隐式的东西多，写得短 | 取服务、传上下文都要显式写，文档自己说「更啰嗦一点」 | **Cordis** |
| **内核自己的开销** | JS 对象，没查到测量 | 每个插件约 6 KiB（它自己测的）；Rust 内核，不占 JS 堆 | 都小；Node 进程本身的内存两边一样 |
| **质量工程** | 没查到公开的质量标准文档 | 很扎实：每条保证有测试钉住，关键并发策略有 TLA+ 模型，有模糊测试、每晚一小时的长跑、三个系统上的「杀掉宿主不留孤儿」测试，还有一份逐条对照的质量状态文档 | **rutis** |
| **接口稳定性** | 4.0 还是 RC，README 写着接口不稳定；但 3.x 稳定过很久，4.0 的 rc 已经出到 13 | 每个小版本都有不兼容的改动和迁移说明；路线图还在加东西 | **Cordis** 稍好，两边都要固定版本、包一层 |
| **拷进仓库** | 容易：核心很小，依赖只有两个小包；DeepSeek Harness 就这么做 | 难一些：Rust 内核依赖 tokio 等，加上各语言的 SDK 和运行时；实际只能固定版本，不现实整份拷 | **Cordis** |
| **嵌进 Tauri** | 跑在我们自带的 Node 里，和 Tauri 无关 | Rust 内核嵌进 Tauri 的主进程（都用 tokio）；Node 运行时可以指定用我们自带的程序。**没人这么用过，没实测** | Cordis 更确定 |
| **单点风险** | 一个人主导，但有 Koishi 和 DeepSeek 两个大用户在盯 | 一个人主导，用户很少；出发点是「智能体自己写插件」，以后的方向不一定照顾桌面应用 | **Cordis** |

## 三种做法

### A. Cordis（现方案）

宿主进程里是 Cordis，每个窗口里也是 Cordis；Rust 和宿主之间的管道、宿主进程的看管自己写。

- 好处：宿主和窗口一套模型；同进程调用简单；先例最多（DeepSeek Harness 桌面版、Ondra 都是这个结构）；内核小，拷进仓库能完全掌握。
- 代价：「Rust 能力给插件用」这一段全部自己做：协议、每个领域的入口、宿主崩溃后的恢复、状态视图。这是第 1 阶段和第 3 阶段里不小的一块工作。

### B. rutis 当内核

Rust 主进程里嵌 rutis；Rust 能力写成 Rust 插件；JS 插件跑在它的 Node 运行时里，用它的 TS SDK。

- 好处：A 里要自己做的那一段都是现成的，而且有成套的测试；以后可以有 Python、Go 写的插件。
- 代价：窗口里没有对应的东西，界面插槽这一半要另外做一套（或者还是用 Cordis），两套模型要对齐；JS 插件之间如果不在同一个运行时里就是异步代理；它每个小版本都在改接口；没有先例。

### C. rutis 在外，Cordis 在里

rutis 管「Rust ↔ Node」：进程、协议、Rust 服务、诊断。Node 运行时里跑的是 Cordis 插件（rutis 能不改代码挂 Cordis 插件：同一个运行时里的 Cordis 插件按 Cordis 自己的规则直接互相拿对象，它们提供的服务自动按名字对 Rust 可见）。窗口里也是 Cordis。

- 好处：两边的长处都拿到：JS 一侧是 Cordis 的同进程模型和浏览器支持，Rust 一侧是 rutis 的现成基础设施。
- 代价：三层东西（rutis、Cordis、我们的包装），出问题要分清是哪一层；同时依赖两个都不稳定的上游；rutis 的 Cordis 桥支持到 Cordis 的哪个版本、有什么限制没核实。

## 建议怎么走

| 时间 | 做什么 |
|---|---|
| 现在 | 决定 3 不变：内核用 Cordis，拷进仓库。插件只通过我们包的 `fuyu-plugin` 接口用内核（已定），服务只按名字依赖、跨进程只传能序列化的数据。守住这两条，以后换成 B 或 C 不影响插件作者 |
| 第 0 阶段 | 多花一天做 rutis 的小样：嵌进一个最小的 Tauri 程序，Rust 里标一个服务，TS 插件调它，杀掉 Node 运行时看恢复，量内存。回答「它在 Tauri 里到底能不能用」 |
| 第 1 阶段 | 按 A 做内核。Rust 和宿主之间的管道先做最小的一版 |
| 第 3 阶段开始前 | 这时要给二十多个领域的 Rust 能力接入口，是 rutis 最能省事的地方。拿第 0 阶段的小样和这几个月 rutis 的变化（接口稳下来没有、有没有别人在用）决定：继续自己写，还是换成 C |

**不建议现在就选 B 或 C**：窗口那一半 rutis 帮不上，最密的调用在 JS 插件之间，而它最大的风险（太新、接口在变、没有先例）正好压在我们最早要做的内核上。deepseek-harness-hub 就是因为上游不停地不兼容变更而归档的。

## 未核实

- rutis 的全部能力来自它的文档，没有运行过；它没有浏览器用的 SDK 这一条，依据是 README、指南和仓库的 `node/` 目录（只有 `rutis`、`rutis-runtime`、`rutis-host` 三个包，都是给 Node 用的）。
- rutis 嵌进 Tauri 主进程能不能正常工作（两边都用 tokio，预期可以）。
- rutis 的 Cordis 桥的限制。它的指南里的例子用的是 DeepSeek Harness 发布的那份 Cordis（`@deepseek-ai/cordis` 4.0.4），对上游的 `cordis` 包是否同样支持没查。
- Cordis 4.0 什么时候出正式版；它的内核在浏览器里跑的是 3.x 有多年先例，4.x 没有公开先例（[技术可行性调研](plugin-host-feasibility.md)）。
- 两边「一个人主导」的判断只看了提交数。

## 来源

1. Cordis 仓库：https://github.com/cordiverse/cordis
2. Cordis 的 npm 发布历史和下载量：https://www.npmjs.com/package/cordis （2026-11-14 查）
3. rutis 仓库和 README：https://github.com/arcships/rutis
4. rutis 设计理念（含「和 Cordis 的根本区别」「代价」）：https://github.com/arcships/rutis/blob/main/docs/design-philosophy.en.md
5. rutis 的 Cordis 互操作：https://github.com/arcships/rutis/blob/main/docs/guide/cordis.en.md
6. rutis 嵌进 Rust 程序：https://github.com/arcships/rutis/blob/main/docs/guide/rust-host.en.md
7. rutis 质量状态：https://github.com/arcships/rutis/blob/main/docs/quality-status.en.md
8. rutis 常驻内存测量：https://github.com/arcships/rutis/blob/main/docs/performance-instance-footprint-2026-11-02.en.md
9. `@arcships/rutis` 的 npm 下载量：https://www.npmjs.com/package/@arcships/rutis （2026-11-14 查）
10. Koishi：https://github.com/koishijs/koishi
11. DeepSeek Harness 拷 Cordis 的说明：https://github.com/deepseek-ai/deepseek-harness/blob/main/vendor/README.md
