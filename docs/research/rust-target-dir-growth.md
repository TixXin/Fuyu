# Rust 构建目录越来越大怎么办

> 日期：2026-11-16。问题：`src-tauri/target` 涨到 172 GB，Mac 磁盘只剩 8.7 GB；别人怎么处理 Rust 项目构建缓存越积越多，我们能不能加脚本自动删旧的。范围：Rust 官方博客与 Cargo 文档、rust-lang/cargo 的 GC 相关 issue 和 PR、cargo-sweep / cargo-clean-all / kondo / cargo-mark-sweep / cargogc 等第三方工具、users.rust-lang.org 与 r/rust 的讨论；关键词 cargo target directory size、cargo-sweep、cargo gc target、line-tables-only、embed-metadata。

## 结论

> 2026-11-16 已按下面的建议改了 `scripts/prune-build-cache.mjs` 和 `pnpm heavy`（规则见 `docs/architecture/workflow.md`「Rust 构建」）：上限按磁盘剩余空间算，没有按目录大小算，量目录大小要遍历十几万个文件，每个任务后都量太慢。

- **Cargo 自己还不会清 `target/`**。它从 1.88 起会自动清 `~/.cargo` 里的下载缓存，但构建目录的清理还在讨论：issue [#13136](https://github.com/rust-lang/cargo/issues/13136) 开着；PR [#17524](https://github.com/rust-lang/cargo/pull/17524) 要加 `cargo clean gc --max-target-age`，按整个构建目录多久没用来删，2026-11-16 查时还没合入。就算合入也帮不了我们：我们的目录天天在用，涨的是里面的旧版本。
- **别人的做法分三类**：
  1. 整个删：`cargo clean`、cargo-clean-all、kondo，按项目找 `target/` 一把删，适合一堆不常碰的项目，不适合天天编的这一个。
  2. 按时间或用量删旧文件：cargo-sweep 的 `--time`、`--maxsize`、「先打时间戳、编译、再删时间戳之前没碰过的」。它的 README 已经写明**没人维护**，作者自己也说按时间删太激进。
  3. 按「现在的构建还用不用得到」删：cargo-mark-sweep、cargogc。思路最对，但都是个人小项目（1 星、0 星），不敢直接用在共用目录上。
- **配置上能省的我们已经省了**：dev 已经是 `debug = "line-tables-only"`，依赖 `debug = false`，这是 Cargo 官方指南推荐的。nightly 的 `-Zembed-metadata=no` 只省 5–30%，而且没打算稳定，我们用的是 stable，不考虑。
- **我们涨得这么快，是因为十几个代理会话共用 `target/agents`**：每个会话的代码状态不同，`fuyu_lib` 一改就多一份编译结果（清理前 `agents/debug/deps` 里有 116 份 `fuyu_lib`），增量缓存也一份份叠上去。现有的 `pnpm prune:target` 管得到这些，但只删「3 天前」的；会话天天在编，几乎没有东西满 3 天，所以它一直报「没有可删的」。第三方依赖的旧版本（如 `window_vibrancy` 有 16 份）它也不管。
- **建议：改我们自己的 `scripts/prune-build-cache.mjs`，不引入第三方工具**：
  1. 加一个**按大小触发**的模式：`target/agents` 超过一个上限（比如 40 GB）或磁盘可用空间低于一个下限时，增量缓存和本项目自己的 crate（`fuyu`、`fuyu_lib`、`plugin_base` 等工作区成员）每个只留最新的几份，不再要求满 3 天。
  2. **最近 1 小时内动过的不删**：清理时可能正有会话在编译。这次手动删 `target/agents` 就撞上了一个刚开跑的 `cargo test`，只能删一部分、它那次编译也可能被打断；按单元删、跳过刚动过的，就不会出这种事。
  3. **在 `pnpm heavy` 每跑完一个任务后顺手清一次**，不用人记着跑；现在只有 `pnpm verify` 结束时才跑。
  4. 第三方依赖的旧版本、交叉编译目录（`x86_64-pc-windows-gnu` 等）先不自动删：它们涨得慢，误删的代价是要整个重编依赖。
  5. 等 Cargo 的 #13136 落地后再看能不能换成官方的。
- 不建议给代理关掉增量编译（`CARGO_INCREMENTAL=0`）：能少写一大块，但每次改完代码重编 `fuyu_lib` 会明显变慢，按大小清理已经能把它控制住。

## 详细

### 这次的数据（2026-11-16，Mac）

| 位置 | 清理前 | 说明 |
|---|---|---|
| `src-tauri/target/agents` | 91 GB | 代理会话共用；`debug/deps` 38 GB、`debug/incremental` 34 GB、交叉编译 Windows 8.8 GB |
| `src-tauri/target/debug` | 71 GB | 用户的 `pnpm tauri dev`；`deps` 40 GB、`incremental` 29 GB |
| `src-tauri/target/release` | 7.2 GB | `build:exe` |

删掉两个 `incremental` 和整个 `agents` 后，磁盘可用空间从 8.7 GB 回到 126 GB。

### Cargo 官方

- 下载缓存（`~/.cargo/registry`、git 检出）的自动清理：1.78 开始记录使用时间，1.88 起默认清理长期没用的（[tracking issue #12633](https://github.com/rust-lang/cargo/issues/12633)、[2023 年的介绍](https://blog.rust-lang.org/2023/12/11/cargo-cache-cleaning/)）。
- 构建目录：设计稿把它列为后一阶段（[Cargo GC 设计稿](https://hackmd.io/@rust-cargo-team/SJT-p_rL2)），issue [#13136](https://github.com/rust-lang/cargo/issues/13136) 和 PR [#17524](https://github.com/rust-lang/cargo/pull/17524) 都还开着（2026-11-16 查）。#17524 只按整个目录的最后使用时间删，不清目录里的旧版本。
- 省空间的配置：[Cargo 构建性能指南](https://doc.rust-lang.org/cargo/guide/build-performance.html)推荐 dev 用 `debug = "line-tables-only"`、依赖不带调试信息；Next.js 的 Turbopack 这样改后 dev 构建目录从 14 GB 降到 7.9 GB（[提交](https://app.semanticdiff.com/gh/vercel/next.js/commit/75c51c65410bc0d4a852b28bab42943dbf765135)）。`split-debuginfo` 只是把调试信息挪到别的文件，总量不变（[讨论](https://users.rust-lang.org/t/split-debug-info-sizes-doesnt-make-sense/104785)）。
- nightly 的 `-Zembed-metadata=no`：不在 `.rlib` 里重复存元数据，省 5–33%，增量缓存和调试信息占大头时省得最少；目前不打算稳定（[Inside Rust 博客](https://blog.rust-lang.org/inside-rust/2026/08/18/reducing-target-dir-size-on-nightly/)、[Kobzol 的文章](https://kobzol.github.io/rust/rustc/2025/06/02/reduce-cargo-target-dir-size-with-z-no-embed-metadata.html)）。

### 第三方工具

| 工具 | 怎么判断该删 | 状态（2026-11-16） | 适不适合我们 |
|---|---|---|---|
| [cargo-sweep](https://github.com/holmgr/cargo-sweep) | 按天数、按总大小、按工具链、按时间戳前后 | README 写明没人维护 | 思路可借，不装 |
| [cargo-clean-all](https://github.com/dnlmlr/cargo-clean-all) | 找出目录下所有项目，整个删 `target/` | 有维护 | 不适合天天编的项目 |
| [kondo](https://docsearch.algolia.com/mcp/docs/repo/tbillington/kondo) | 多种语言的构建目录整个删 | 有维护 | 同上 |
| [cargo-mark-sweep](https://github.com/JoshKneale/cargo-mark-sweep) | 按配置的 cargo 命令现在会用到哪些产物，删其余的 | 1 星，2026-08 后没更新 | 思路最准，太小不敢用 |
| [cargogc](https://github.com/LosEcher/cargogc) | 按构建记录而不是时间判断 | 0 星 | 同上 |

另有把多个项目指到同一个 `CARGO_TARGET_DIR` 来共享依赖的做法（[DEV 文章](https://dev.to/nixeton/cargo-target-directories-why-rust-projects-eat-10gb-each-26kd)、[thisdavej](https://thisdavej.com/freeing-up-gigabytes-reclaiming-disk-space-from-rust-cargo-builds/)），我们的 `target/agents` 已经是这样，它解决的是「每个项目一份依赖」，解决不了同一项目的旧版本越积越多。

## 来源

见上文各处链接。
