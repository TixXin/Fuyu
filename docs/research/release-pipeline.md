# 发布流程的优化

> 日期：2026-11-12。问题：发一个版本（以 v0.3.7-beta.2 为例）每一步花多久，哪里能更快、更稳，外面的项目怎么做。范围：Tauri 官方文档（体积、更新插件、GitHub 流水线），Rust 官方博客和论坛关于 Windows 编译、链接器的讨论，corrode.dev 的编译提速汇总，Microsoft 的 Dev Drive 说明，git-cliff、GitHub Artifact Attestations、Velopack 的文档，以及几篇发布清单和首启冒烟测试的文章。关键词：rust compile time windows linker、tauri release profile、tauri-action、tauri updater dynamic server rollout、Dev Drive cargo、sccache windows、cargo --timings、artifact attestations、velopack delta。相关任务：暂无（见文末「建议的任务」）。

## 结论

我们的发布已经比多数开源 Tauri 项目完整：草稿上传、核对 SHA-256 后才公开，两个通道读回核对，自动在 issue 下留言，本机快捷方式同步，回滚步骤写在 `docs/features/updater.md`。外部资料里值得做的，集中在**省时间**和**发布前多验一步**两件事上：

1. **最划算：发布构建换到共享的构建目录。** 现在 `pnpm release` 在 lane 自己的 `src-tauri/target` 里编译，新 lane 第一次发布基本是冷编译。改成主工作区下固定的 `target/publish`（和 `build-dirs.mjs` 的做法一致），每次都是增量编译，lane 里也不再各留一份 2 GB 多的 release 目录（`pnpm prune:target` 只清主工作区的 `target`，管不到 lane 自己的）。beta.1 的 4 分 18 秒和 beta.2 的 2 分 30 秒不能直接比：两次之间还合入了 F22（`b5fd654f`，crate-type 只留 `rlib`），省掉的时间里有多少来自缓存、多少来自 F22 没法分开，要在新目录上实测一次冷编译和一次增量编译。
2. **改版本号那次 land 不必跑完整的 `pnpm check`**（约 1 分 40 秒）。只改了四处版本号和 `docs/releases/` 时，代码和上一次通过检查的 main 一样；`land-check.mjs` 已经会跳过 cargo test，可以再把这种情况当作只改文档处理，只跑任务检查和版本号一致性检查。
3. **公开之前加一次安装冒烟测试。** 外部经验一再提到，构建成功不等于用户第一次启动没问题（[来源](https://dev.to/qnbs/green-build-broken-first-boot-12ap)）。在 Release 还是草稿时，把 NSIS 安装包静默装到临时目录，用全新的数据目录启动一次，确认进程活着、主窗口出现，再卸载。约 20–30 秒，能挡住「装上就打不开」这类最伤用户的问题。
4. **Rust 编译本身可以再快一点，但收益有限：** Windows 上把 `CARGO_HOME`、项目和 `target` 放到 Dev Drive，并让 Defender 对它用性能模式或加排除，微软给的是整体构建快 20–30%（[来源](https://blogs.windows.com/windowsdeveloper/2023/06/01/dev-drive-performance-security-and-control-for-developers/)），Cargo 的具体数字没找到可靠来源（未核实）。换 `rust-lld` 链接器在 Windows 上只省一两秒（[论坛实测](https://users.rust-lang.org/t/rust-on-windows/134315)），不值得。先跑一次 `cargo build --release --timings` 看是哪个 crate 拖慢（[Cargo 文档](https://doc.rust-lang.org/cargo/reference/timings.html)），再决定要不要裁依赖或 `windows` crate 的 features。
5. **不建议现在做的：** 换 Velopack 拿增量更新（要换整套安装和更新机制）、按比例灰度推送（Tauri 更新插件没有内置，要自己架动态更新服务器，[来源](https://v2.tauri.app/plugin/updater/)）、把发布搬到 GitHub Actions（更干净、能出构建来源证明，但 Windows 机器更慢，签名私钥要放进仓库 Secrets，现在的本机流程已经够用）。等用户多了、或要做供应链证明时再看。
6. **Tauri 推荐的体积配置（LTO、`codegen-units = 1`、`opt-level = "s"`、`panic = "abort"`、`strip`）会让包更小，但编译明显变慢**（[来源](https://v2.tauri.app/concept/size/)），和「发得更快」相反。可以单独量一次：安装包能小多少、编译慢多少，再决定。`panic = "abort"` 要先确认代码里没有依赖捕获 panic 的地方。

## 详细

### 这次发布的实测耗时（v0.3.7-beta.2）

| 阶段 | 内容 | 耗时 |
|---|---|---|
| 准备 | 同步 lane、`pnpm release:version`、写中英文发布说明、提交 | 命令几秒；写说明约几分钟（未计时） |
| land | 排队、rebase、`pnpm check`（版本号改动不跑 cargo test）、推送 | 约 1 分 40 秒 |
| 发布前校验 | 版本号一致、说明不是草稿、工作区干净、写发布配置 | 几秒 |
| 前端构建 | `tsc` + `vite build` | 约 10–20 秒 |
| Rust 编译 | release profile | 2 分 30 秒（beta.1：4 分 18 秒） |
| 打包 | NSIS、MSI | 约 10 秒 |
| 签名和清单 | 更新签名、`latest.json`、`SHA256SUMS.txt` | 几秒 |
| 上传和公开 | 草稿上传、核对 SHA-256、公开 | 约 10 秒 |
| 收尾 | 换本机 exe 和快捷方式、刷新 beta 通道、读回两个通道、issue 留言 | 约 20 秒 |

从提交版本号到发布完成约 5 分 25 秒，其中 `pnpm release` 约 3 分 42 秒，Rust 编译占三分之二。

### 编译提速

- **构建目录**：见结论第 1 条。这是我们自己的问题，不是外部资料里的，但收益最大。
- **Dev Drive 和 Defender**：Dev Drive 是 Win11 的 ReFS 卷，新建时自动信任并让 Defender 用性能模式（扫描推迟到文件操作完成后），微软称比默认设置快最多 30%；也可以只给 `target`、lane 文件夹和 `CARGO_HOME` 加排除（[微软博客](https://blogs.windows.com/windowsdeveloper/2023/06/01/dev-drive-performance-security-and-control-for-developers/)、[corrode.dev](https://corrode.dev/blog/tips-for-faster-rust-compile-times/)）。我们 2026-11-12 已经请用户加了排除（是否生效未确认）；Dev Drive 要搬目录，收益未核实，排在后面。
- **链接器**：Rust 1.90 起 Linux 默认用 lld，链接快很多（[Rust 博客](https://blog.rust-lang.org/2025/09/01/rust-lld-on-1.90.0-stable)），但这次改动不涉及 Windows MSVC。论坛里有人在 Windows 上手动配 `rust-lld.exe`，45 秒的构建只快一两秒（[来源](https://users.rust-lang.org/t/rust-on-windows/134315)）。
- **sccache**：适合多个项目共享依赖或共享构建服务器；corrode.dev 的作者在单机上测下来几乎没用（[来源](https://corrode.dev/blog/tips-for-faster-rust-compile-times/)）。我们已经有共享的构建目录，不需要。
- **找慢的 crate**：`cargo build --release --timings` 出一份每个 crate 的耗时和并行情况；`cargo tree --duplicate` 找重复版本；cargo-machete / cargo-udeps 找没用的依赖（[corrode.dev](https://corrode.dev/blog/tips-for-faster-rust-compile-times/)）。

### 发布前的验证

- **首启冒烟测试**：用发布出去的同一个文件，在全新的数据目录里启动，做一次最小的「写入—关闭—再打开」，留日志做证据（[来源](https://dev.to/qnbs/green-build-broken-first-boot-12ap)）。对我们来说：静默安装到临时目录，带一个空的应用数据目录启动（lane 预览已经有类似的标识隔离），等主窗口出现，退出，卸载。只在 Release 还是草稿时做，失败就不公开。
- **构建来源证明**：GitHub 的 Artifact Attestations 用 `actions/attest-build-provenance` 给产物签来源，用户可以 `gh attestation verify` 核对（[GitHub 文档](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)）。只能在 GitHub Actions 里生成，本机构建用不上。

### 发布说明

- 我们有 `notes-draft.mjs` 列出提交，由人或 AI 改写成用户说明。外面常用 git-cliff（读 Conventional Commits、模板分组，[来源](https://orhun.dev/git-cliff)）或 release-please。我们的提交已经是 Conventional Commits，但用户说明需要改写，工具只能省掉「列提交」这一步，我们已经有了，不必换。
- 可以改进的是草稿本身：把每个提交的正文和关联任务、issue 一起放进草稿，写说明时不用再去翻提交。

### 推送和回滚

- Tauri 更新插件支持静态 JSON 和动态服务器；动态服务器按 `{{current_version}}`、`{{target}}`、`{{arch}}` 决定回 200（有更新）或 204（没有），也可以借此回滚、分通道。官方没有按比例灰度，要自己在服务器里实现（[来源](https://v2.tauri.app/plugin/updater/)）。我们用 `beta-channel` 这个固定的 Pre-release 放测试版清单，回滚是把清单换回上一个版本，已经够用。
- 增量更新：Velopack 默认生成文件级的 Zstandard 差分包，落后几个版本时按顺序应用，必要时退回整包（[来源](https://docs.velopack.io/packaging/deltas)）。Tauri 的更新插件文档里没有增量更新（未在官方文档里找到）。安装包只有十几 MB，不值得换。

### 在 CI 里发布

- Tauri 官方的 GitHub 流水线用 `tauri-apps/tauri-action`、`swatinem/rust-cache` 缓存，先建草稿 Release（[来源](https://tauri.app/distribute/pipelines/github/)）。`docs/features/updater.md` 已经写了在 CI 里复用我们步骤的做法。现在不迁：本机有共享构建缓存，比 CI 的 Windows 机器快；私钥不用上传到 GitHub。

### 2026-11-12 补充：构建和 lane 流程改动之后

同一天 fly-island-44 合入了几项构建和 lane 改动，逐条看对发布的影响：

- **F22，crate-type 只留 `rlib`（`b5fd654f`）**：v0.3.7-beta.2 已经包含它，那次 `pnpm release` 完整打出了 NSIS、MSI 和更新签名，安装包构建没有问题，不用再单独验证。release profile 没改。
- **`pnpm prune:target`**：只扫主工作区 `target` 下的 `debug`、`release`、`agents`、`lane-build`，每个本应用 crate 留最新 3 份。它不碰 lane 里的 `target`，所以现在每个发过版的 lane 都留着自己的 release 产物（lane 4 约 2.3 GB）。发布构建换到 `target/publish` 时，要把它加进清理脚本认识的目录。另外 `pnpm release` 会把发布的 exe 复制到主工作区的 `target/release/fuyu.exe`，清理只删 `deps/`、`build/` 里的旧单元，不影响这个 exe。
- **lane 池（F23/F24）**：空闲 lane 会被复用并重置到主工作区的 HEAD，lane 文件夹和它的 `target` 留着，所以发版有时会碰上热缓存、有时是冷编译，耗时不稳定。这正好是改用共享发布目录的理由。
- **land 的归属检查（F25）**：`land-check` 和 `pnpm verify` 拒绝没有归属记录的 lane。发版前提交版本号要 land，所以发版的 lane 必须由 EnterWorktree 或 `pnpm lane:open` 建，或先 `pnpm lane:take`。`pnpm release` 本身不调用 land-check，不受影响。可以在 `docs/features/updater.md` 的发版步骤里写一句。
- **land 不再自动删 lane**：发完版的 lane 要自己 `pnpm lane:release`，否则一直占着。
- **在临时仓库里跑 git 的测试要先去掉 `GIT_*` 环境变量**：查过，发布脚本的测试（`tests/scripts/release-*.test.mjs`）只在临时目录里写文件，不跑 git，不受影响。以后给发布流程加测试（例如冒烟测试）时照这条做。

## 建议的任务

按收益排序，都还没建任务：

1. 发布构建改用主工作区的共享目录 `target/publish`（`scripts/release/release.mjs`、`scripts/build-dirs.mjs`）。
2. 只改版本号和 `docs/releases/` 的 land 走轻量检查（`scripts/land-check.mjs`）。
3. 草稿阶段的安装冒烟测试（`scripts/release/`）。
4. 发布说明草稿带上提交正文、任务和 issue（`scripts/release/notes-draft.mjs`）。
5. 量一次 `--timings` 和 Tauri 推荐的体积配置，写进 `docs/investigations/`。

## 来源

- Tauri：[App Size](https://v2.tauri.app/concept/size/)、[Updater 插件](https://v2.tauri.app/plugin/updater/)、[GitHub 流水线](https://tauri.app/distribute/pipelines/github/)
- Rust：[Faster linking times with 1.90.0 stable on Linux using the LLD linker](https://blog.rust-lang.org/2025/09/01/rust-lld-on-1.90.0-stable)、[Rust on Windows（用户论坛）](https://users.rust-lang.org/t/rust-on-windows/134315)、[Cargo build timings](https://doc.rust-lang.org/cargo/reference/timings.html)、[corrode.dev：Tips for Faster Rust Compile Times](https://corrode.dev/blog/tips-for-faster-rust-compile-times/)
- Windows：[Dev Drive: Performance, Security and Control for Developers](https://blogs.windows.com/windowsdeveloper/2023/06/01/dev-drive-performance-security-and-control-for-developers/)
- 发布与验证：[Green build, broken first boot](https://dev.to/qnbs/green-build-broken-first-boot-12ap)、[GitHub Artifact Attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
- 发布说明与更新：[git-cliff](https://orhun.dev/git-cliff)、[Velopack 增量包](https://docs.velopack.io/packaging/deltas)
