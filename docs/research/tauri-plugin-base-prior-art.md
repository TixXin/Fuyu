# 有没有人已经做了「Tauri 上的万物皆插件基座」

> 日期：2026-11-14。问题：用户打算把第 3 版插件平台的基座（[v3-everything-plugin.md](../architecture/plugins/v3-everything-plugin.md)）做成独立的 GitHub 开源项目，给别的项目也能用。GitHub 上有没有人已经做了，会不会重复造轮子。范围：GitHub 仓库搜索和代码搜索（`tauri plugin system`、`tauri extension`、`tauri sidecar node`、`cordis` 出现在 `tauri.conf.json` / `Cargo.toml` 里的仓库等）、联网搜索；读了 `arcships/rutis`、`HuakunShen/tauri-plugin-js`、`kunkunsh/kunkun`、`ntars/Ondra`、`MarecGents/deepseek-harness-hub`、`mountain-loop/yaak`、`smapiot/piral` 的 README 和部分设计文档。**都是读文档，没有运行过这些项目**；GitHub 搜索不保证搜全，star 很少或名字不相关的项目可能漏掉。

## 结论

- **没有找到一个完整做了这件事的开源项目**：把「Tauri 外壳 + 常驻的插件宿主进程 + 服务按名字替换 + 多窗口的界面插槽 + 插件包格式 + 带审核和签名的市场」合成一个可复用的基座。
- **但拼图的每一块都有人做了**，其中一块做得很深，必须先看：

| 你要做的部分 | 已有的项目 | 重叠程度 |
|---|---|---|
| 插件内核：生命周期、服务、依赖、事件、可撤销的注册 | **[arcships/rutis](https://github.com/arcships/rutis)**：Rust 写的 Cordis 式插件运行时，插件可以用 TypeScript、Python、Go、Swift 写，跑在各自的运行时进程里 | **高**。方案里「拷 Cordis + 自己写 Node 宿主 + Rust 和宿主之间的管道」这一大块，它基本都做了 |
| Tauri 里起一个 Node / Bun 进程并和它通信 | [HuakunShen/tauri-plugin-js](https://github.com/HuakunShen/tauri-plugin-js) | 中。只是进程管理加 RPC，没有插件模型；而且它用 Tauri 的事件转发，会踩到 `emit` 的泄漏 |
| 界面插槽、运行时加载界面模块、共用依赖 | [Piral](https://github.com/smapiot/piral)、Lumino（JupyterLab 的底座）、Backstage 的前端系统、Koishi 控制台 | 中。都是给浏览器里的网页应用用的，没有多窗口，也没有和 Tauri 或后台宿主接起来 |
| 同样结构的应用（不是基座） | [Ondra](https://github.com/ntars/Ondra)：Tauri 外壳 + Cordis 宿主进程，75 个插件；[Yaak](https://github.com/mountain-loop/yaak)：Tauri + Node 插件运行时；[Kunkun](https://github.com/kunkunsh/kunkun)：Tauri 上的可扩展启动器 | 低。都是应用自己用的，没有抽成别人能用的库 |
| 市场：索引、审核、签名、撤销 | 没找到通用的 | 无 |

- **建议**：这个开源项目值得做，空白在「把这些接成一个 Tauri 应用能直接用的整体」。但**内核不要自己从头做**：第 0 阶段先评估 rutis 能不能当内核。它如果合用，开源项目的范围就是「Tauri 外壳层 + 界面插槽 + 包格式和市场工具」，这部分确实没人做。

## 逐个说

### rutis：最该先看的

| | |
|---|---|
| 仓库 | [arcships/rutis](https://github.com/arcships/rutis)，MIT，Rust |
| 一句话 | 「给会自己迭代的软件用的插件运行时」；生命周期模型来自 Cordis，在一个小的 Rust 内核里实现一次，再带到别的语言、别的进程、别的机器 |
| 热度和维护 | 173 star、12 fork、31 个未关闭的 issue；建于 2026-09-22；v0.21.0（2026-11-06）；主要作者一人（3252 次提交） |
| 发布 | crates.io、npm（`@arcships/rutis`）、PyPI 都有包 |

它已经有的，对着方案看：

| 方案里要做的 | rutis |
|---|---|
| 插件 = `apply(ctx, config)`，`inject` 声明依赖，依赖就绪才启动 | 有，写法几乎一样（`definePlugin({ inject, apply })`、`ctx.provide`、`ctx.use`） |
| 所有注册可撤销，卸载时按相反顺序清理 | 有，并且「每个清理恰好执行一次」「加载失败回滚」有测试钉住 |
| 提供者被换掉时，依赖它的插件自动重启 | 有 |
| 五种事件分发方式 | 有，而且跨语言、跨进程语义一致 |
| 同名服务冲突时报错并说明是谁 | 有（`service storage is already provided by row prompts…`） |
| 缺依赖时的状态视图 | 有：`ctx.diagnostics()` 和 `rutis-host check` 列出每个插件的状态、依赖、提供的服务 |
| Node 宿主进程，能用 npm | 有：Node 和 Bun 两种运行时 |
| **Rust 的能力怎么给插件用** | **Rust 插件直接在内核进程里提供服务**，别的语言按名字调用。方案里「Rust 能力多一个入口」那一步，在它这里就是写 Rust 插件 |
| 配置即组装、热重载 | 有：`rutis-loader` 按分层的配置把运行中的系统调和到目标状态；`rutis-host dev` 文件变了就重载 |
| 直接跑现成的 Cordis 插件 | 有：Cordis 插件不改代码就能作为一行配置跑在它的 Node 运行时里 |
| 安装插件 | 有 `rutis-host add / remove / upgrade` 的设计（npm、PyPI、Go 模块） |
| 「给别人写插件的宿主」怎么搭 | 有一篇指南 [open-host](https://github.com/arcships/rutis/blob/main/docs/guide/open-host.en.md) |

它没有的：

- **任何界面的东西**：窗口、插槽、React 组件、把界面模块加载进 WebView。
- **Tauri 的集成**：没有提到 Tauri；它的「应用集成」设计讲的是手机应用把自带的插件接到 rutis，明确不在设备上加载新代码。
- **市场**：没有索引、审核、签名、撤销；它的安装设计明确把「审查安装脚本」放在范围之外。
- **插件包里的界面部分**、给市场展示用的清单字段。

风险：

- **很新，变得很快**：仓库公开不到两个月；0.13 到 0.21 每个小版本都有一份迁移说明，说明接口一直在不兼容地改。
- **一个人主导**。
- 它的出发点是「智能体自己写插件、换插件」，不是桌面应用的插件生态，以后的方向不一定和我们一致。
- 跨语言调用有开销：文档说一次同步的跨语言调用约 30 微秒（Node 一侧测的），热路径要放在同一个运行时里。

### tauri-plugin-js

[HuakunShen/tauri-plugin-js](https://github.com/HuakunShen/tauri-plugin-js)（21 star，最后更新 2026-07）：Tauri 2 的插件，起并管理 Bun / Node / Deno 进程，Rust 把标准输入输出原样转给前端，前后用作者自己的 RPC 库 kkrpc。它证明了「Tauri + JS 运行时附带进程」这条路走得通，也能把 TS 编译成独立程序免装运行时。但它只管进程和通信，没有插件模型；宿主发给窗口的消息走 Tauri 事件（`emit`），正是我们要避开的那个泄漏。作者也是 Kunkun 的作者。

### 同样结构的应用

- **[Ondra](https://github.com/ntars/Ondra)**（10 star，AGPL-3.0，2026-10 建）：桌面 AI 陪伴应用，「Tauri 外壳 + Cordis 宿主进程 + dsh 内核进程」三层，75 个 Cordis 插件；外壳和宿主之间走标准输入输出上的 JSON。这是我们选的路线 1b 的一个真实例子：Tauri 外壳加一个 Node 进程跑 Cordis 是做得出来的。它是应用，没有抽成基座；AGPL 许可也不适合直接拿代码。
- **[deepseek-harness-hub](https://github.com/MarecGents/deepseek-harness-hub)**（已归档）：用 Tauri 给 DeepSeek Harness 做桌面外壳。归档的原因值得记住：上游处在快速的不兼容变更期，「桌面壳 + 插件双轨适配成本持续走高」。**建在一个还在剧烈变化的上游上，会被拖垮**，这对「要不要用 rutis」「要不要拷 Cordis 的 RC 版」都是提醒。
- **[Yaak](https://github.com/mountain-loop/yaak)**（约 1.9 万 star，MIT）：Tauri 做的 API 客户端，插件跑在它自带的 Node 运行时里（`crates/yaak-plugins`）。成熟、有人在用，但插件接口是为 API 客户端定的，不是通用基座。
- **[Kunkun](https://github.com/kunkunsh/kunkun)**（约 1300 star）：Tauri 上的可扩展启动器，README 自己标着「早期、施工中」，最后一次推送是 2026-02。

### 界面那一半

这些是浏览器里的「可插拔网页应用」框架，能在 WebView 里用，但都不知道 Tauri、多窗口和后台宿主的存在：

- **[Piral](https://github.com/smapiot/piral)**（约 1900 star，MIT）：微前端框架。运行时从一个「供给服务」加载模块（叫 pilet），有扩展插槽和共用依赖的机制。和方案里「界面部分运行时加载、往插槽注册、共用一份 React」是同一类问题。
- **Lumino**（JupyterLab 的底座）、**Backstage 的前端系统**、**Koishi 控制台**：都有「插件 + 服务或令牌 + 扩展点」的设计，[同类插件架构调研](plugin-architectures.md)里看过它们的插槽规则。

## 对「做成开源项目」的看法

**空白是真实的**：内核有人做了（rutis、Cordis），界面插槽有人做了（Piral 等），Tauri 起 JS 进程有人做了，但没有人把它们接成「一个 Tauri 应用装上就能有插件系统」的东西，更没有带审核和签名的市场工具。这个整合本身有价值，Ondra、Yaak、Kunkun 各自重做了一遍就是证据。

**建议的范围**（避免重复造轮子）：

| 层 | 做不做 | 说明 |
|---|---|---|
| 插件内核 | **不自己做**，用现成的 | rutis 或 Cordis 二选一，第 0 阶段评估 |
| Tauri 外壳层 | 做 | 看管宿主进程、窗口和宿主之间不泄漏的通信、宿主重启后窗口重连 |
| 界面插槽 | 做 | 多窗口、带规则（数量、顺序、替换、上限）的 React 插槽；先看 Piral 能复用多少 |
| 插件包格式和构建工具 | 做 | 清单、`build`、脚手架 |
| 市场工具 | 做 | 索引、逐版审核的 CI、市场构建、签名、撤销。这块完全没有现成的，可能是最有独立价值的一块 |

**两条提醒**：

1. **先在浮屿里做出来，再抽成开源项目**。从第一天起就把基座写成独立的包（不依赖浮屿的业务），但等它在浮屿上跑过内核和两三个内置功能之后再公开发布。先发框架再找用法的项目很容易设计错；deepseek-harness-hub 的教训也说明，别人会因为你的接口变得太快而放弃。
2. **选内核是最大的一个决定**，而两个候选都不稳定：Cordis 4.0 还是 RC，rutis 每个小版本都在改接口。无论选哪个，都要包一层自己的接口再给插件用（方案里已经这样定了），并且固定版本。

## 对方案的影响

方案的决定 3 是「内核用 Cordis，拷进仓库」。这次调研不改这个决定，建议在第 0 阶段加一项对照：

| | 拷 Cordis + 自己的 Node 宿主（现方案） | 用 rutis |
|---|---|---|
| Rust 能力怎么给插件 | 每个领域多接一个管道入口 | 写成 Rust 插件，在同一个进程里提供服务 |
| 宿主进程的看管、重启、诊断 | 自己写 | 现成 |
| 跨进程的事件和服务调用 | 自己定协议 | 现成 |
| 直接用 Cordis 生态的插件 | 能 | 能（它能挂 Cordis 插件） |
| 插件作者看到的接口 | 我们包的 `fuyu-plugin` | 同样要包一层 |
| 风险 | Cordis 4.0 是 RC；要自己写的东西多 | 更新、更小众、接口变得更快；依赖一个人 |

要测的：rutis 能不能嵌进 Tauri 的 Rust 进程；它的 Node 运行时空载和加载后的内存；窗口怎么订阅它的事件（它没有界面这一层，要自己接）。

## 未核实

- GitHub 搜索可能漏掉名字不相关或 star 很少的项目，也搜不到私有的和还没公开的。
- rutis 的各项能力都来自它的 README 和设计文档，没有运行过；它有几份设计标着「定稿，未实现」（例如应用集成、插件安装）。
- Ondra、Yaak、Kunkun 的插件机制只看了 README 和目录，没有读实现。
- Piral 能不能直接用在 Tauri 的多窗口里没有试过。

## 来源

1. rutis：https://github.com/arcships/rutis （README、`docs/design-philosophy.en.md`、`docs/guide/cordis.en.md`、`docs/guide/open-host.en.md`、`docs/design-app-integration-2026-10-14.en.md`、`docs/design-plugin-install-2026-10-27.en.md`）
2. tauri-plugin-js：https://github.com/HuakunShen/tauri-plugin-js
3. Ondra：https://github.com/ntars/Ondra
4. deepseek-harness-hub（已归档）：https://github.com/MarecGents/deepseek-harness-hub
5. Yaak：https://github.com/mountain-loop/yaak
6. Kunkun：https://github.com/kunkunsh/kunkun
7. Piral：https://github.com/smapiot/piral
8. Tauri 官方讨论「怎么加载扩展」：https://github.com/tauri-apps/tauri/discussions/2685
9. Tauri 的插件（编译期的 Rust 库，不是运行时扩展）：https://v2.tauri.app/plugin/
10. Cordis：https://github.com/cordiverse/cordis
