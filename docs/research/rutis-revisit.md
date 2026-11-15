# 第 3 阶段前回看 rutis，选生成 TypeScript 类型的工具

> 日期：2026-11-15。问题：插件平台第 3 版第 3 阶段开工前（方案决定 13、流程「第 3 阶段开始前回头评估 rutis」），rutis 从第 0 阶段读的提交 `1dd73888` 到现在有什么变化，要不要让它当「外层」接管 Rust ↔ 宿主那一段；顺带在 `ts-rs`、`specta` / `tauri-specta`、照 rutis 读源码三条路里选生成 TypeScript 类型的工具。范围：`arcships/rutis` 的 GitHub release、tag、CHANGELOG、`1dd73888...main` 的提交、`main`（`3d244c10`，2026-11-15）的源码和指南；crates.io 的版本、下载量和反向依赖；npm 下载量；GitHub 代码搜索（`rutis` in `Cargo.toml`、`@arcships/rutis` in `package.json`）；`Aleph-Alpha/ts-rs`、`specta-rs/specta`、`specta-rs/tauri-specta` 的仓库、release 和 crates.io 数据；本仓库 `src-tauri/Cargo.toml`。**没有编译**，全部是读文档、源码和公开数据。相关任务：E36.3.1（#465），影响 E36.3.3、E36.3.4。上一份：[cordis-vs-rutis.md](cordis-vs-rutis.md)、[第 0 阶段小样](../investigations/v3-feasibility.md#8-rutis-小样)。

## 结论

- **建议继续自己写（E36.3.3 + E36.3.4），不换成 rutis。** 一句话理由：rutis 的 Node 运行时**写死了 DeepSeek 发布的那份 Cordis（`@deepseek-ai/cordis` 4.0.4）**，还会拒绝插件自带别的 Cordis 副本，而我们拷的是上游 `cordis` 4.0.0-rc.13；让它当外层就得换掉自己的宿主和 Cordis 来源，换来的只是 600–900 行自己能掌握的代码，且它仍是每个小版本都不兼容的 0.x。
- **生成 TypeScript 类型选 `ts-rs`。** 一句话理由：它是稳定版（12.0.1，下载量 2300 多万，每 6–9 个月一个大版本），我们的宏本来就自己掌握参数列表，只缺「Rust 类型 → TS 声明」这一步，`ts-rs` 正好只做这一步；`specta` 2 从 2023-07 起当了两年多 RC（28 个），说好的稳定版还没出。
- **rutis 和第 0 阶段比几乎没变**：`1dd73888` 是 2026-11-14 的提交，到今天只多了 46 个提交，都是文档、一致性测试和两处小修复，**没有发新版本**（最新仍是 v0.21.0，2026-11-06）；他们正在为 0.22 改文档，0.22 还没发。所以这次回看的分量在于把整段历史和新查到的事实放在一起看，而不是新变化。
- 第 0 阶段的三条顾虑**都还在**：`#[rutis::service]` 仍然只能标 `impl` 块；本机管道仍然没有心跳（卡死发现不了，心跳只用在远程的 `wss://` 连接）；嵌入多 9.6 MB 没有重测，依赖没变，预期不变（未核实）。
- **要用户定的**：① 继续自己写，还是换成 rutis（建议自己写）；② 生成工具用 `ts-rs` 还是 `specta`（建议 `ts-rs`）；③ 窗口的 300 多个 `invoke` 要不要顺手用 `tauri-specta` 生成类型化封装（建议**不在第 3 阶段做**：功能插件化以后窗口改经宿主按名字调服务，`invoke` 会越来越少；真要做是另一个任务）。

## 详细

### rutis：发版和不兼容改动

| 版本 | 日期 | 标了不兼容（Breaking） |
|---|---|---|
| 0.21.0 | 2026-11-06 | 是 |
| 0.20.1 | 2026-11-03 | |
| 0.20.0 | 2026-11-02 | 是 |
| 0.19.3 | 2026-10-31 | 是（补丁版也改了包名） |
| 0.19.2、0.19.1 | 2026-10-30 | |
| 0.19.0 | 2026-10-29 | 是 |
| 0.18.0 | 2026-10-28 | 是 |
| 0.7.0–0.17.2 | 2026-10-06 – 10-27 | 0.17.0 起每个小版本都配迁移说明 |

- 2026-09-22 建仓到 2026-11-06，共 29 个 tag / release；最近 6 个里有 5 个标了不兼容，**连补丁版 0.19.3 都改了名字**（`loader` / `sessions` → `rutis/loader` / `rutis/sessions`）。
- `1dd73888`（2026-11-14 08:15 UTC）之后到 `3d244c10`（2026-11-15）共 46 个提交：质量现状文档「按 0.22 重写」、远程和多语言规格的修订、六批一致性测试、`fix(bridge)` 校验收到的引用、`fix(runtimes)` `filter` 返回 thenable 时让分发失败。没有新版本。
- **接口没有稳下来**：节奏和第 0 阶段看到的一样（一个月二十多个版本），0.22 在准备中。它的质量工程（一致性测试、TLA+ 模型、每晚长跑）照旧很扎实，这一点不变。

### rutis：有没有别人在用（2026-11-15 查）

| 渠道 | 数字 |
|---|---|
| GitHub | 173 star、12 fork（和 11-14 一样） |
| crates.io `rutis` | 累计 4122 次下载（全部在最近 90 天）；`rutis-macros` 2235、`rutis-host` 753 |
| crates.io 反向依赖 | 10 个：8 个是 rutis 自己的 crate，另外 2 个是 `yoagent-rutis`（0.13.0）和 `yobuild`（0.3.2，累计 75 次下载） |
| npm `@arcships/rutis` | 上周 392 次、近 30 天 5146 次；`@arcships/rutis-runtime` 上周 1004 次 |
| GitHub 代码搜索 | `Cargo.toml` / `package.json` 里引用它的只有 `arcships/rutis`、`arcships/dim`（同一组织，596 star）、`eric8810/rutis`（作者的副本）和 `yologdev/yoagent` |

- **第一次查到外部使用方**：`yologdev/yoagent`（Rust 的 Agent 循环库，375 star）在 `integrations/yoagent-rutis/` 里做了一个 rutis 适配；`yologdev/yobuild`（1 star）依赖它。这是集成层，不是像浮屿这样把 rutis 放进桌面应用的生产用法。
- 仍然**没查到公开的生产用户**，更没有 Tauri 应用在用。

### rutis：第 0 阶段的三条顾虑

| 顾虑 | 现在（`3d244c10`） |
|---|---|
| `#[rutis::service]` 能不能标自由函数 | **不能**。宏只解析 `ItemImpl` / `ImplItemFn`（`crates/rutis-macros/src/lib.rs`，1283 行）；指南写的仍是「给服务的 `impl` 块加标记」，别人的类型要包一层自己的类型再标。浮屿 300 多个命令都是自由函数，要用就得给每个领域写一个包装类型 |
| 卡死检测 | **本机仍然没有**。源码和指南里的心跳只出现在远程运行时（`listen:wss://…`，「heartbeat timeout」）和 Kotlin 的远程连接；本机子进程走管道，没有心跳。我们第 1 阶段的心跳加超时比它多管了卡死 |
| 二进制体积 | 第 0 阶段量的是多 9.6 MB。核心 crate 仍依赖 `tokio`、`tokio-util` 等，依赖没变；**没重测**（未核实） |

### rutis 当「外层」：能不能、值不值

它的 Cordis 指南给了两种互通：① Cordis 插件当 rutis 的「行」跑在它的 Node 运行时里；② 在 Rust 程序里挂 Cordis 插件（`rutis-bridge` 的 `cordis` 特性，构建时从类型声明生成 Rust 类型）。对浮屿来说是 ①：rutis 管 Rust ↔ Node，Node 里跑 Cordis 插件。

**新发现的硬约束**：`@arcships/rutis-runtime` 的 `runner.mjs` 从插件的位置解析并直接 `import('@deepseek-ai/cordis')`，`package.json` 固定 `"@deepseek-ai/cordis": "4.0.4"`；插件自己带了另一份 Cordis 时直接报错「uses its own copy of @deepseek-ai/cordis … install a single copy」。我们 `vendor/cordis` 拷的是上游 `cordis` 4.0.0-rc.13（2026-11-12 的提交）。第 0 阶段「它能挂 Cordis 插件」的说法对上游 `cordis` 不成立，至少要改成用 DeepSeek 那一份。

| | 自己写（E36.3.3 + E36.3.4） | rutis 当外层 |
|---|---|---|
| 代码量 | 第 0 阶段小样 305 行跑通，补齐估 600–900 行（估计） | 自己的代码少；但要写每个领域的包装类型、把宿主改成 rutis 的运行时、适配它的配置 `rutis.json` |
| 宿主进程 | 保留第 1 阶段的宿主、看管、安全模式、协议 1 → 2、窗口 WebSocket | 宿主变成 `rutis-runtime` 的 runner，第 1 阶段的宿主入口和看管要拆掉或改造，E36.2.11 刚改的安全模式也要重来 |
| Cordis 来源 | 上游 `cordis`，拷进仓库、能完全掌握 | 只能用 `@deepseek-ai/cordis` 4.0.4；窗口里也要换成同一份，否则两边版本不一 |
| 标在哪 | 领域的自由函数，能和 `#[tauri::command]` 叠（待 E36.3.4 验证） | 只能标 `impl` 块 |
| 卡死 | 心跳加超时，已有 | 本机发现不了 |
| 体积 | 几百行，体积可忽略 | 约多 9.6 MB（第 0 阶段量的） |
| 升级 | 自己定节奏 | 0.x 每个小版本都有不兼容改动，要跟着迁移；还不能只在 Rust 一侧升，npm 的运行时协议版本必须和 crate 一致 |
| 能白拿的 | 无 | 诊断（谁在等什么）、`check`、提供者换掉时使用者自动重启、成套的一致性测试 |

**判断**：外层能白拿的东西（诊断、自动重启依赖方）在我们 Cordis 里本来就有一部分（Cordis 自己的依赖注入会在服务换掉时重启插件），剩下的是锦上添花；而代价落在已经做完、刚改过的第 1、2 阶段的宿主上，外加锁死在一个第三方分支的 Cordis 和一个每周改接口的 0.x 上。第 0 阶段估的 600–900 行风险可控：协议和超时、`peer-gone` 的规则在协议 1 里已经有了，E36.3.3 是把方向反过来，E36.3.4 的宏在小样里已经跑通。

**借鉴的照旧**：通道一断等待中的调用立刻带原因失败；调用失败的错误写明哪个插件、哪个方法；它「异步函数执行到一半被取消」这个没写进文档的行为，我们在 E36.3.3 里明确规定（宿主被杀时 Rust 侧正在跑的处理函数跑完、结果丢弃，计划里已写）。

### 生成 TypeScript 类型：三条路

| | `ts-rs` | `specta`（+ `tauri-specta`） | 照 rutis 读源码 |
|---|---|---|---|
| 版本（2026-11-15） | 12.0.1，稳定版 | `specta` 2.0.0-rc.28（2026-11-05）；`tauri-specta` 2.0.0-rc.29（2026-11-13）；最后的稳定版是 1.x，只配 Tauri 1 | rutis 自己的 `rutis-types` |
| 稳定性 | 大版本约 6–9 个月一个（10.0 2024-09、11.0 2025-06、12.0 2026-01） | **2.0 的 RC 从 2023-07 出到现在 28 个**；rc.25（2026-05）说「下个月中发稳定版」，到 11 月还没发；rc.25 引入的内部标签枚举回归到 rc.27 才修。RC 之间要用 `=` 固定版本 | 跟着 rutis 的 0.x 变 |
| 热度 | crates.io 累计 2336 万次、近 90 天 1084 万；GitHub 1954 star | `specta` 累计 453 万、近 90 天 250 万；655 star；`tauri-specta` 817 star | 只有 rutis 自己用 |
| 做什么 | 只做「Rust 类型 → TS 声明」（`#[derive(TS)]`），认 serde 的属性 | 类型 → TS，**还能导出函数签名**（`#[specta::specta]` 标在函数上）；`tauri-specta` 据此给 `#[tauri::command]` 生成类型化的 `invoke` 封装和事件类型，只支持 Tauri 2 + specta 2 | 构建时用 `syn` 读源码文本推类型，自己实现了一遍 serde 的属性，3758 行 |
| 接进我们的宏 | 宏为每个服务函数生成一个参数结构体并 `#[derive(Deserialize, TS)]`，生成脚本从登记表拼出方法签名；第 0 阶段小样就是这样做的 | 宏可以直接拿 specta 的函数签名，不用自己生成参数结构体，省一点 | 不现实 |
| 窗口 `invoke` 的封装 | 不管 | 能，但要把 `generate_handler!` 换成它的 builder，300 多个命令的参数和返回类型全都要派生 `specta::Type` | 不管 |

- 本仓库现在**哪个都没用**：`src-tauri/Cargo.toml` 和 `src-tauri/crates/*/Cargo.toml` 里没有 `ts-rs`、`specta`、`tauri-specta`，`serde` / `serde_json` 是 1.x。
- **选 `ts-rs` 的理由**：生成的只是第 3 阶段要给宿主的那部分服务（计时器、翻译起步），参数列表我们的宏本来就掌握；`ts-rs` 稳定、用的人最多、只干这一件事，出了问题容易换。`specta` 能省的是「宏里生成参数结构体」的几十行，换来的是跟一个两年没定稿的 RC。
- **`tauri-specta` 的价值在另一件事上**（给现有 `invoke` 生成类型）：那要碰全部命令和 `api.ts`，属于独立的大改动，而且第 3 版的方向是窗口经宿主调服务，`invoke` 会逐步变少，现在不值得。将来真要做，再单独评估；到时 `specta` 2 若已稳定，可以连同服务的类型一起换（两者都是给类型加一个派生，换起来是机械活）。

## 未核实

- rutis 嵌入后的体积增量这次没重测，沿用第 0 阶段的 9.6 MB。
- rutis 的 Node 运行时能否改成用上游 `cordis` 包：源码里路径和报错都写死了 `@deepseek-ai/cordis`，没找到配置项，也没问作者。
- `@deepseek-ai/cordis` 4.0.4 和上游 4.0.0-rc.13 差多少没比。
- `ts-rs` 的派生宏和 `#[tauri::command]`、我们的 `#[host_service]` 叠在同一个函数的参数类型上有没有冲突：预期没有（派生在类型上，属性在函数上），E36.3.4 实测。
- 下载量会被 CI 和镜像放大，只能看量级。

## 来源

1. rutis 仓库：https://github.com/arcships/rutis （2026-11-15 查，`main` = `3d244c10`）
2. rutis 的 release 列表：https://github.com/arcships/rutis/releases
3. rutis CHANGELOG：https://github.com/arcships/rutis/blob/main/CHANGELOG.md
4. `1dd73888...main` 的提交：https://github.com/arcships/rutis/compare/1dd73888...main
5. rutis 的服务宏：https://github.com/arcships/rutis/blob/main/crates/rutis-macros/src/lib.rs
6. rutis 嵌进 Rust 程序（「给 `impl` 块加标记」、包装别人的类型）：https://github.com/arcships/rutis/blob/main/docs/guide/rust-host.en.md
7. rutis 的 Cordis 互通：https://github.com/arcships/rutis/blob/main/docs/guide/cordis.en.md
8. rutis Node 运行时写死 `@deepseek-ai/cordis`：https://github.com/arcships/rutis/blob/main/node/rutis-runtime/src/runner.mjs 、https://github.com/arcships/rutis/blob/main/node/rutis-runtime/package.json
9. rutis 质量现状（心跳只在远程连接）：https://github.com/arcships/rutis/blob/main/docs/quality-status.en.md
10. crates.io `rutis` 及反向依赖：https://crates.io/crates/rutis/reverse_dependencies （2026-11-15 查）
11. npm 下载量：https://www.npmjs.com/package/@arcships/rutis 、https://www.npmjs.com/package/@arcships/rutis-runtime （2026-11-15 查，统计到 11-14）
12. yoagent 的 rutis 适配：https://github.com/yologdev/yoagent/tree/main/integrations/yoagent-rutis
13. ts-rs：https://github.com/Aleph-Alpha/ts-rs 、https://crates.io/crates/ts-rs （2026-11-15 查）
14. specta：https://github.com/specta-rs/specta 、https://crates.io/crates/specta ；rc.25 的发布说明：https://github.com/specta-rs/specta/releases/tag/v2.0.0-rc.25
15. tauri-specta（版本对照表：Tauri 2 只配 specta 2）：https://github.com/specta-rs/tauri-specta 、https://crates.io/crates/tauri-specta
