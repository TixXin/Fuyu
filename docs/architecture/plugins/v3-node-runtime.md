# 插件平台第 3 版：宿主用的 Node 和宿主脚本

E36.1 第 4b 步（#291）。方案的决定 16：安装包不带 Node，先用电脑上的，没有或不能用才下载。这一页记下载 Node 和正式版带上宿主脚本的设计、实测和接线方法。

## 下载 Node（`src-tauri/crates/plugin-base`）

| 文件 | 做什么 |
|---|---|
| `src/runtime.rs` | 写死的版本、每个平台的发布包和 SHA-256、下载地址；`node_for_host` 把「找电脑上的」和「下载」串起来 |
| `src/download.rs` | `prepare_node`：下载、核对、解压、改名到位；`installed_node`：不联网，只看有没有核对过的一份 |
| `src/unpack.rs` | Windows 的 `.zip` 用 `zip` crate；macOS 的 `.tar.xz` 用系统自带的 `/usr/bin/tar`（bsdtar，保留 `bin/node` 的可执行位和 npm 的符号链接） |

### 版本和来源

- **Node 26.13.1**（2026-11-10 发布，当前的 LTS「Lithium」）。哈希取自 `nodejs.org/dist/v26.13.1/SHASUMS256.txt`：`darwin-arm64.tar.xz`、`darwin-x64.tar.xz`、`win-x64.zip`、`win-arm64.zip`。
- 下载地址按顺序试，前一个失败（连不上、非 2xx、断开、哈希不对）才试下一个：

| 顺序 | 地址 | 2026-11-14 核实 |
|---|---|---|
| 1 | `https://nodejs.org/dist` | 官方 |
| 2 | `https://cdn.npmmirror.com/binaries/node` | `npmmirror.com/mirrors/node` 和 `registry.npmmirror.com/-/binary/node` 都跳到这里；`SHASUMS256.txt` 和官方逐字节相同 |
| 3 | `https://mirrors.cloud.tencent.com/nodejs-release` | `SHASUMS256.txt` 和官方逐字节相同 |

  另外核实过、没有放进去的：中科大 `mirrors.ustc.edu.cn/node`（可用，内容相同）、清华 `mirrors.tuna.tsinghua.edu.cn/nodejs-release`（可用）、华为云 `mirrors.huaweicloud.com/nodejs`（这次连不上）。
- 镜像只是换个地方下同一个文件，信任来自写死的 SHA-256，不来自地址。`SHASUMS256.txt.asc` 的 GPG 签名没有核对（本机没有 gpg）；哈希是从官方站点直接取的，三个来源一致。
- 发版时升 Node：改 `runtime.rs` 的 `NODE_RELEASE` 和四个哈希，跑一次下面那个手动测试。

### 放在哪、怎么保证完整

```text
<数据目录>/runtime/
├── node-v26.13.1/            ← 解压出来的整棵树（官方包里的 node-v26.13.1-<平台>/ 改名而来）
│   ├── bin/node              ← macOS 的可执行文件；Windows 是 node.exe
│   └── .fuyu-sha256          ← 核对过的发布包哈希
└── .download-<pid>-<纳秒>/   ← 下载中的临时目录，成功或失败都会删掉
```

1. 有 `node-v<版本>/` 而且 `.fuyu-sha256` 和写死的哈希一致、可执行文件在：直接用，不联网。
2. 否则新建临时目录，边下边算 SHA-256，下完对哈希、对长度（`Content-Length`），不对就删掉这个文件试下一个地址。
3. 解压到临时目录，确认 `node-v<版本>-<平台>/<可执行文件>` 存在，写 `.fuyu-sha256`，再整个目录 `rename` 到 `node-v<版本>/`（同一个文件系统内是原子的）。原来有一份没通过核对的，先挪进临时目录再删。
4. 临时目录由一个 `Drop` 守卫删除，中途出错、panic 都会清掉；上次进程被杀留下的 `.download-*` 下次开头删掉。成功后删掉其他版本的 `node-v*`（删不掉就算了，例如 Windows 上旧版正在运行）。

- 单个文件上限 200 MB；连接超时 15 秒，每次读 30 秒没有数据算断开（没有总时长上限，慢网络也能下完）。
- 进度回调 `Progress { url, downloaded, total }`：每读 64 KB 调一次，换到下一个地址时 `downloaded` 从 0 开始、`url` 变了。岛上要节流自己做。
- 失败返回 `DownloadError`：`Unsupported`（没有这个平台的包）、`Disk`（哪一步、哪个路径、系统错误）、`Sources`（每个试过的地址和原因，例如 `…/node-v26.13.1-win-x64.zip: answered HTTP 503`、`SHA-256 is …, expected …`、`ended after 1000 of 2000 bytes`）、`Unpack`。`Display` 是一行英文，带全部细节，可以直接进日志。

### 测试

`tests/download.rs` 用测试里起的本地 HTTP 服务，不联网：

| 测试 | 证明 |
|---|---|
| `a_verified_zip_lands_in_its_version_folder_and_is_not_downloaded_again` | 解压后的路径对；进度从 0 到总字节；第二次调用不发请求 |
| `a_wrong_hash_is_refused_and_nothing_is_left_behind` | 哈希不对时拒绝，错误里有地址和两个哈希，`runtime/` 下什么都不剩 |
| `a_download_that_breaks_off_is_cleaned_up_and_the_next_try_works` | 服务器发一半就断：清理干净，下一次能下完 |
| `the_mirror_is_tried_when_the_official_site_fails_and_every_failure_is_named` | 第一个地址 503 就用镜像；都失败时每个地址的原因都在 |
| `an_archive_without_the_expected_folder_is_refused` | 包里没有预期的目录就拒绝，不留东西 |
| `a_damaged_install_is_replaced_and_old_versions_and_stale_downloads_are_removed` | 没有标记的半成品被换掉；旧版本和上次留下的临时目录被删 |
| `a_tar_xz_unpacks_with_bin_node_still_executable`（只在 macOS） | `.tar.xz` 解压后 `bin/node` 还能执行 |
| `a_node_on_this_computer_wins_and_otherwise_the_download_is_used` | 电脑上有就用它、不发请求；没有才下载；都不行时错误里两边的原因都有 |
| `every_real_source_serves_the_pinned_node_and_it_runs`（`#[ignore]`，手动跑） | 三个真实地址各下一遍、核对、运行 `--version` |

手动测试的实测（2026-11-14，macOS arm64，家里的网络）：nodejs.org 10 秒、npmmirror 4 秒、腾讯 20 秒，三份都打印 `v26.13.1`（时间包括下载、解压和第一次运行 `--version`）。第 0 阶段量到的「新下载的 Node 第一次运行要 25 秒」这里没有单独量。

### 怎么接线（给 `src-tauri/src/plugin_kernel/`）

现在 `plugin_kernel/mod.rs` 直接调 `find_node`。换成：

```rust
use plugin_base::{node_for_host, official_download, ChosenNode, NodeSearch, NodeSource, MINIMUM_NODE};

let data_dir = app.path().app_data_dir()?;
let proxy = crate::system::updater::get_updater_proxy();
let chosen: Result<ChosenNode, String> = node_for_host(
    &NodeSearch::from_env(),
    MINIMUM_NODE,
    &data_dir,
    official_download(proxy),
    &mut |progress| { /* 节流后发给岛：progress.url、progress.downloaded、progress.total */ },
);
```

- **在普通线程里调**（`std::thread::spawn`，或者已经在看管宿主的那个线程里）。它是阻塞的，下载可能要几十秒；`reqwest::blocking` 不能在 tokio 的异步上下文里创建或丢弃，不要在 `async fn` 或 `tauri::async_runtime::spawn` 里直接调。
- 返回的 `ChosenNode.source` 是 `System` 或 `Downloaded`，记进日志；`path` 填进 `HostSpec.program`。
- 想先知道要不要下载（决定岛上显示「正在准备」）：`plugin_base::installed_node(&data_dir, &official_download(proxy)?)`，不联网。
- 失败的字符串里有找过的每个位置和每个下载地址的原因，直接进日志；岛上显示可重试的错误，重试就是再调一次（临时文件已经清掉了）。
- 代理沿用更新器的设置（`get_updater_proxy`），和 cc-connect 的下载一致。
- 开发版和正式版的数据目录不同（开发版身份是 `com.tixxin.fuyu.lane-1`），各下各的。

## 正式版带上宿主脚本

### 打包（`scripts/plugins-v3/bundle-host.mjs`）

```bash
node scripts/plugins-v3/bundle-host.mjs            # 输出到 src-tauri/target/plugins-v3/host/（不进 git）
node scripts/plugins-v3/bundle-host.mjs --minify --out <目录>
```

- 用 Vite 自带的 esbuild（经 `vite` 的位置解析，不新增依赖）。ESM、`platform: node`、目标 Node 22.15，每个文件开头带 `createRequire` 的 banner（`ws` 这类 CommonJS 代码要 `require` 内置模块）。`ws` 的两个可选原生加速包 `bufferutil`、`utf-8-validate` 留在外面，`ws` 找不到时自己退回纯 JS。
- **输出是一个文件夹，不是单个文件**：`main.mjs`（入口）、`index.mjs`（插件 `import "@fuyu/plugin-base"` 拿到的接口）、`include.mjs`、`hmr.mjs`（Cordis 加载器按地址加载的两个内置插件），加上 esbuild 拆出来的共享 `chunk-*.mjs`。原因：内核在运行时按地址加载这三个模块（`kernel.mjs` 的 `API`、`INCLUDE`、`HMR`），它们必须是独立的模块，又必须和宿主共用**同一份** Cordis（插件的 `Service` 要是宿主认识的那个类）。单个文件做不到这两点，`splitting` 拆出共享块就可以。第 0 阶段打成单个文件是因为那时还没有这三个运行时地址。
- 打包时把源码里的 `import.meta.resolve("@cordisjs/include")`、`import.meta.resolve("@cordisjs/hmr")`、`new URL("../index.mjs", import.meta.url)` 改写成同一文件夹里的文件（只改打包产物，不改源码）。打完检查每个产物：还有按包名解析的 `import.meta.resolve`，或者 `new URL("./…", import.meta.url)` 指向不存在的文件，就报错并说明要在脚本的 `ENTRIES` / `REWRITES` 里加。以后内核再加运行时地址，打包会直接失败，不会悄悄带上一个坏的宿主。
- 大小（2026-11-14 的代码）：6 个文件 776 KB，压缩后 351 KB，121 个源文件。比第 0 阶段量的 215 KB 大，主要是 `include.mjs` 带的 YAML 解析和新加的窗口连接。
- 测试 `tests/scripts/plugins-v3-bundle-host.test.mjs`（`pnpm test` 会跑）：打到系统临时目录（仓库外面，没有 `node_modules` 可借），用 `node --disallow-code-generation-from-strings` 跑起来，插件 `import "@fuyu/plugin-base"` 后能注册服务、另一个插件能用它，发出 `ready`、回答 `ping`、`stop` 后退出码 0；坏插件报 `log` 并标 `failed`，宿主不倒。

### 让正式构建带上它（方案，这一步没改构建流程）

查过的事实：

- `tauri-build` 在**每次** cargo 构建的 `build.rs` 里都会把 `bundle.resources` 拷到目标目录（`tauri-build-2.7.4/src/lib.rs` 的 `copy_resources`），路径不存在就报 `ResourcePathNotFound`，构建失败。也就是说，往 `tauri.conf.json` 里直接加这一项，所有人的 `cargo test`、`pnpm tauri dev`、`pnpm build:exe` 在没先跑打包脚本时都会失败。所以**不加在 `tauri.conf.json` 里**。
- `bundle.resources` 的映射写法可以写目录，会递归拷贝（`tauri-utils` 的 `ResourcePaths::from_map`，`allow_walk`）。macOS 的 `tauri.macos.conf.json` 已经有一个 `resources` 映射，`--config` 叠加时 JSON 对象按键合并，不会冲掉它。
- 发版的三条构建路径：本机 Windows `release.mjs` 的 `buildLocally`（`--config src-tauri/tauri.release.conf.json`，由 `prepare-release-config.mjs` 生成）；CI 的 `release-windows.yml`（同一个 `tauri.release.conf.json`）；CI 的 `release-macos.yml`（`--config src-tauri/tauri.bundle-macos.conf.json` 加一段内联 JSON，不用 release 叠加文件）。

建议的改法（宿主要随正式版发布时做，和 Rust 那边找资源目录的代码放在同一个提交）：

1. `prepare-release-config.mjs` 生成的叠加文件里加 `bundle.resources: { "target/plugins-v3/host": "plugins-v3/host" }`，并在写文件前调用 `bundleHost()`（或在 `release.mjs` 的 `buildLocally` 和 `release-windows.yml` 里先跑 `node scripts/plugins-v3/bundle-host.mjs`）。
2. `tauri.bundle-macos.conf.json` 加同样的 `resources` 项（它只在 Mac 打包时用，和 `MediaRemoteAdapter.framework` 一样指向 `target/` 下预先生成的东西）；`build-app-macos.mjs` 和 `release-macos.yml` 在 `pnpm tauri build` 之前跑打包脚本，照 `scripts/macos/mediaremote-adapter.mjs` 的做法。
3. Rust 找宿主脚本：正式版用 `app.path().resource_dir()?.join("plugins-v3/host/main.mjs")`；开发版（`cfg!(debug_assertions)` 或资源不存在时）退回仓库里的 `packages/plugin-base/src/host/main.mjs`。`pnpm build:exe` 不带叠加文件，产物在仓库里，也走仓库路径，所以不受影响。
4. 发版的冒烟测试（`scripts/release/smoke-test.*`）加一条：安装包里有 `plugins-v3/host/main.mjs`。

实测：用 `--config '{"bundle":{"resources":{"target/plugins-v3/host":"plugins-v3/host"}}}'` 叠加，结果见下一节。

### 叠加资源的实测

2026-11-14，macOS arm64：先跑打包脚本，再 `CARGO_TARGET_DIR=src-tauri/target/agents pnpm tauri build --debug --bundles app --config '{"build":{"beforeBuildCommand":""},"bundle":{"resources":{"target/plugins-v3/host":"plugins-v3/host"}}}'`。

- 构建通过。`Fuyu.app/Contents/Resources/` 里是 `en.lproj`、`zh-Hans.lproj`、`icon.icns` 和 `plugins-v3/host/` 的 6 个文件：macOS 原有的资源映射没有被冲掉。
- 用电脑上的 Node 跑 `.app` 里的 `plugins-v3/host/main.mjs --dir <一个装了插件的目录>`（带 `--disallow-code-generation-from-strings`）：发出 `ready`，插件 `running`，`stop` 后退出。
- 注意：`CARGO_TARGET_DIR` 的相对路径按 `src-tauri/` 解析，产物落在 `src-tauri/src-tauri/target/agents/`（进度文档的 Windows 测法里也提到了），用完删掉。
- 没有在 Windows 上做这次实测，也没有跑真正的发版构建；`pnpm build:exe` 没有跑，因为构建流程没改。
