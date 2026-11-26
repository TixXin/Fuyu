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
- `vendor`：浮屿里 Cordis 是工作区包，按包名引用（`cordis`、`@cordisjs/*`）；tauri-cordis 把它放在 `packages/tauri-cordis/vendor/cordis/` 一起发布，导出时把这些包名换成到 vendor 的相对路径。
- `overrides`：tauri-cordis 里要换成另一份内容的文件（例如默认值），值是浮屿仓库里那份内容的路径。
- `namesAllowedIn`：允许出现浮屿名字的路径片段（测试夹具）。

## 浮屿专有的部分放在 `src/app/`

基座里只有浮屿才有的概念（岛、设置窗口）放在各包的 `src/app/`，整个目录在 `fuyuOnly` 里，不导出；tauri-cordis 里的 `src/app/` 由 `overrides` 换成 [`scripts/cordis/app/`](../../../scripts/cordis/app/) 下的中性版本（空的扩展列表、空的类型）。通用代码只经这几个文件接到浮屿那层：

| 文件 | 浮屿里是什么 | 通用代码怎么用 |
|---|---|---|
| `plugin-base/src/app/host.mjs` | `APP_HOST_EXTENSIONS`：设置窗口（`settingsOpener`）和岛（`islandControl`）两个宿主扩展，以及它们的常量 | `startHost({ extensions })` 的默认值。每个扩展 `{ name, create() }` 造出一个实例：`install(ctx)` 装上注入项，`attach(rpc)`、`attachWindows(windows)` 接 Rust 和窗口，`windowCall(method, params, window, plugin)` 认领窗口调用（返回 `{ value }`，不认领返回 `undefined`），`statusOf(plugin, state)` 往插件状态里加字段，`watch(listener)` 在这些字段变化时通知。实例挂在宿主对象上，键是 `name` |
| `plugin-base/src/app/client.mjs` | `APP_CLIENT_SERVICES`：窗口里的 `ctx.settings`、`ctx.island` | `createLoader({ appServices })` 的默认值。每项 `{ name, service, options(loaderOptions) }`，装进每个插件的上下文并加进 `inject` |
| `plugin-base/src/app/*.d.mts` | `AppContext`（`ctx.settings`、`ctx.island` 的类型）、`AppHost`、`AppPluginStatus`、`AppLoaderOptions` | 通用类型 `extends` 它们 |

浮屿专有、只测这一层的测试（`island-control`、`settings-*`、`app-routing`）也列在 `fuyuOnly`。

## 进度

E79 分几步做，每步一个提交：映射表和脚本 → 浮屿专有的部分（岛、设置窗口）从基座挪出去 → 默认值去掉浮屿名字 → 把 tauri-cordis 的 `replacedByThirdParty` 搬回浮屿 → 在 tauri-cordis 里写入导出结果、补 CI 一致性检查。做完之前 `pnpm cordis check` 会报差异，这是预期的。
