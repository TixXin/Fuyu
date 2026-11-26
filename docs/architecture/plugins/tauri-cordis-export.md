# 导出到 tauri-cordis

开源基座 [TixXin/tauri-cordis](https://github.com/TixXin/tauri-cordis) 的源码由浮屿仓库生成（E79，#1040，用户 2026-11-19 定）：浮屿是唯一的源头，tauri-cordis 里的 `src/`、`test/` 这些目录不手改，改动先进浮屿再导出。

## 命令

| 命令 | 做什么 |
|---|---|
| `pnpm cordis check [--cordis <目录>]` | 生成导出结果，和 tauri-cordis 检出（默认 `../tauri-cordis`）逐字节比对；有不同就退出码 1，列出不同、只在一边的文件 |
| `pnpm cordis write [--cordis <目录>]` | 把导出结果写进 tauri-cordis 检出；受管目录里浮屿已经没有的文件会删掉，受管目录外的不碰 |
| `pnpm cordis names` | 列出导出结果里还带着浮屿名字的行（`test/fixtures/` 除外） |
| `pnpm cordis imports` | 列出导出的文件引用了没导出的文件（浮屿专有模块、`@fuyu/*` 包）的地方 |

都加 `--verbose` 列全，`--json` 出结构化结果。

## 映射表

全部规则在 [`scripts/cordis/map.json`](../../../scripts/cordis/map.json) 一张表里，脚本只照表执行：

- `trees`：浮屿目录到 tauri-cordis 目录，以及每个包里受管的子目录（`paths`）。`package.json`、`Cargo.toml`、README、LICENSE、`bin/` 不在受管范围，归 tauri-cordis 自己维护。
- `fuyuOnly`：浮屿专有、不导出的文件或目录（前缀匹配）。导出的文件不能再引用它们，`pnpm cordis imports` 会查出来。
- `names`：包名、crate 名的替换，例如 `@fuyu/plugin-base` → `tauri-cordis`、`plugin_base` → `tauri_cordis`；跨包的相对路径（`../../plugin-manifest/`）按 `trees` 换成对方的目录名。
- `words`：包名之外的浮屿字样，按顺序替换并保留大小写：`TixXin/fuyu` → `TixXin/tauri-cordis`，`fuyu-plugin` → `tauri-cordis-plugin`，`浮屿` → `宿主应用`，其余 `fuyu` → `cordis`。所以环境变量 `FUYU_*` 导出成 `CORDIS_*`，清单键 `fuyu`、`engines.fuyu` 导出成 `cordis`，签名密钥目录是 `~/.tauri-cordis-plugin`。替换后 `pnpm cordis names` 应为 0。
- `vendor`：浮屿里 Cordis 是工作区包，按包名引用（`cordis`、`@cordisjs/*`）；tauri-cordis 把它放在 `packages/tauri-cordis/vendor/cordis/` 一起发布，导出时把这些包名换成到 vendor 的相对路径。
- `overrides`：tauri-cordis 里要换成另一份内容的文件（例如默认值），值是浮屿仓库里那份内容的路径。
- `namesAllowedIn`：允许出现浮屿名字的路径片段（测试夹具）。

`packages/create-plugin` 不导出：它的模板绑着浮屿的内置服务（`timers/v1`）和岛的插槽，tauri-cordis 的 `create-tauri-cordis-plugin` 自己维护。`@fuyu/plugin-services`（浮屿内置服务的类型）也不导出，用到它的测试拆成浮屿专有的文件（`build-services`、`cli-sdk-alias`、`services`），列在 `fuyuOnly`；读浮屿 Rust 源码的测试同样拆开（`protocol-rust`）。

## 浮屿专有的部分放在 `src/app/`

基座里只有浮屿才有的概念（岛、设置窗口）放在各包的 `src/app/`，整个目录在 `fuyuOnly` 里，不导出；tauri-cordis 里的 `src/app/` 由 `overrides` 换成 [`scripts/cordis/app/`](../../../scripts/cordis/app/) 下的中性版本（空的扩展列表、空的类型）。通用代码只经这几个文件接到浮屿那层：

| 文件 | 浮屿里是什么 | 通用代码怎么用 |
|---|---|---|
| `plugin-base/src/app/host.mjs` | `APP_HOST_EXTENSIONS`：设置窗口（`settingsOpener`）和岛（`islandControl`）两个宿主扩展，以及它们的常量 | `startHost({ extensions })` 的默认值。每个扩展 `{ name, create() }` 造出一个实例：`install(ctx)` 装上注入项，`attach(rpc)`、`attachWindows(windows)` 接 Rust 和窗口，`windowCall(method, params, window, plugin)` 认领窗口调用（返回 `{ value }`，不认领返回 `undefined`），`statusOf(plugin, state)` 往插件状态里加字段，`watch(listener)` 在这些字段变化时通知。实例挂在宿主对象上，键是 `name` |
| `plugin-base/src/app/client.mjs` | `APP_CLIENT_SERVICES`：窗口里的 `ctx.settings`、`ctx.island` | `createLoader({ appServices })` 的默认值。每项 `{ name, service, options(loaderOptions) }`，装进每个插件的上下文并加进 `inject` |
| `plugin-base/src/app/*.d.mts` | `AppContext`（`ctx.settings`、`ctx.island` 的类型）、`AppHost`、`AppPluginStatus`、`AppLoaderOptions` | 通用类型 `extends` 它们 |

| `plugin-cli/src/app/commands.mjs` | `APP_COMMANDS`：`mcp` 命令（本机 Local API 的 MCP 服务） | `cli.mjs` 把它并进命令表、选项和帮助 |
| `plugin-review/src/app/data.mjs` | `APP_DATA`：浮屿数据目录（`com.tixxin.fuyu`、`.fuyu`）的匹配规则 | 审核扫描插件是否读写宿主数据目录 |

浮屿专有、只测这一层的测试（`island-control`、`settings-*`、`app-routing`、`mcp`）也列在 `fuyuOnly`。

## 进度

E79 分几步做，每步一个提交：映射表和脚本 → 浮屿专有的部分（岛、设置窗口）从基座挪出去 → 默认值去掉浮屿名字 → 把 tauri-cordis 的 `replacedByThirdParty` 搬回浮屿 → 在 tauri-cordis 里写入导出结果、补 CI 一致性检查。已全部做完（2026-11-26）：tauri-cordis 0.3.0（TixXin/tauri-cordis#2）就是这份导出，npm 和 crates.io 都已发布；tauri-cordis 的 `.fuyu-export.json` 记着导出来源的浮屿提交，它的 CI `export` 任务在那个提交上重新导出并逐字节比对。以后改了受管目录，在浮屿提交合入后跑 `pnpm cordis write --cordis ../tauri-cordis`，更新 `.fuyu-export.json`，在 tauri-cordis 提 PR。

tauri-cordis 0.2.0 的 `replacedByThirdParty` 没有搬回来（2026-11-25 核实）：它在合并配置时就把被替换的内置服务写进 `disabledServices`，不管替换它的插件有没有真的跑起来。浮屿的做法是运行时让出（`host/services.mjs` 的 `enter`/`leave`）：第三方插件真的提供了服务，内置的才让出；插件停了、被二分或安全模式挡下、启动失败，内置的都还在；状态里的 `replacedServices`、`disabledServices` 按实际情况报。把那段搬进来试过，`replaces.test.mjs` 挂 3 个（被二分挡下、启动失败、停掉后交还）。导出后 tauri-cordis 换成浮屿的做法，0.3.0 的更新说明要写这条行为变化。
