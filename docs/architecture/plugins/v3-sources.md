# 插件平台第 3 版：插件从哪来、怎么按清单加载

任务 E36.3.9（#496），第 5 阶段地基要宿主做的 R1、R4、R6（[第 5 阶段计划](v3-phase5-foundation-plan.md)「要基座做的」）。建在 [内置插件](v3-builtins.md)（E36.3.6）上。清单格式和校验规则见 [v3-package.md](v3-package.md)。

## 四种条目

`plugins.yml` 里每个条目按 `source` 分来源，宿主读插件目录的 `package.json`，按 `fuyu.host` 加载宿主部分、按 `fuyu.client` 登记各窗口的界面，用 `@fuyu/plugin-manifest` 的 `validateManifest` 校验：

| 来源 | `plugins.yml` 里写 | 插件目录 | 校验选项 | `kind` |
|---|---|---|---|---|
| 内置 | 不用写；只能记 `disabled` / `config`（见 [v3-builtins.md](v3-builtins.md)） | 内置插件清单的 `root` | `{ official: true }`（清单没写 `host`、`root` 里有 `package.json` 时）| 清单给的 `builtin` / `essential` |
| 市场安装 | `- id: "@作用域/名字"`<br>`  source: market` | `plugins-v3/packages/@作用域/名字/` | `{ allowExperimental: false, appVersion }` | `third-party` |
| 手动安装 | 同上，`source: manual` | 同上 | 同上 | `third-party` |
| 开发文件夹 | `- id: <随便起>`<br>`  source: dev`<br>`  path: <文件夹>` | `path`（绝对路径，或相对 `plugins.yml` 所在目录） | `{ allowExperimental: true }` | `third-party` |
| 直接写模块（第 1 阶段起的写法，测试和临时调试用） | `- id: x`<br>`  name: ./x.mjs` | 无 | 不校验，没有清单 | `third-party` |

- 已安装的包，`id` 就是包名（`package.json` 的 `name`），不一样时拒绝加载。数据目录是 `plugins-v3/data/@作用域/名字/`（[v3-builtins.md](v3-builtins.md)「插件的数据目录」）。
- 写了 `source` 的条目，`name` 由宿主按 `fuyu.host` 填，`plugins.yml` 里写的 `name` 不用；只有界面、没有 `fuyu.host` 的插件，宿主用一个空的宿主部分（`host/client-only.mjs`）占位，让它和别的插件一样有「运行 / 关掉」的状态。
- 写回：设置窗口经加载器改开关和配置时，include 只把改了的键写回文件，`source`、`path` 原样保留。
- 校验用的 `@fuyu/plugin-manifest` 是 `plugin-base` 的依赖（静态 import），打包宿主时一起打进去：`bundle-host.mjs` 的产物拷到仓库外也能校验（`tests/scripts/plugins-v3-bundle-host.test.mjs`）。`plugin-base` 的边界测试只多放行了这一个包。
- `appVersion`：`startHost({ appVersion })`，命令行 `--app-version <版本>`。Rust 现在还没传（E36.3.10 改宿主参数时一起加）；没传时 `engines.fuyu` 只核对写法，不核对版本。

## 拒绝加载

清单校验不过、包没装、包名对不上、`fuyu.host` / `fuyu.client` 指向的文件不在插件目录里、`source` 不认识时，这一条**不加载**，状态是：

```json
{ "id": "@ann/lab", "state": "failed", "source": "market",
  "reason": "its package.json does not pass the check: plugins that use experimental interfaces only load in development mode or as built-in plugins",
  "blocked": { "by": "manifest", "errors": [{ "path": "fuyu.experimental", "code": "experimental", "message": "…" }] } }
```

- `errors` 是 `validateManifest` 原样的问题列表（`path`、`code`、`message`），插件页可以逐条显示。
- 市场和手动安装的插件写了 `experimental` 就是这样（R4）；同一份代码作为开发文件夹或内置插件加载照常。
- 改了 `plugins.yml`（或重新安装后宿主重读它）会重新读清单，修好了就照常加载。
- 内置插件的 `package.json` 校验不过不是「这一条失败」，而是宿主起不来：内置插件随程序发布，坏了是程序的 bug（和清单坏了一样）。

## 声明和实际（R6）

插件状态多一个字段 `undeclared`，列出插件**实际做了、清单里没写**的事，键名就是该补的清单字段：

| 键 | 什么时候出现 | 怎么核对 |
|---|---|---|
| `provides` | 用 `ctx.services.provide` 提供了 `fuyu.provides`、`fuyu.replaces` 里都没有的服务 | 宿主按当前提供的服务实时算，插件停了就没了 |
| `client` | 用 `ctx.clients.add` 给 `fuyu.client` 里没有的窗口登记了界面 | 同上 |
| `slots` | 往 `fuyu.slots` 里没有的插槽放了东西 | **宿主现在看不到**：插槽在窗口里，要窗口的加载器（第 2 阶段，`client/`）把「谁往哪个插槽放了东西」报给宿主，宿主再合进这个字段。先留着这个键 |

- 都对得上时没有这个字段；没有清单的插件（直接写模块的、清单里写了 `host` 的内置插件，比如计时器）不核对。
- 只做标记，不拦：插件页据此标「和声明不符」（方案「声明和实际要对得上」）。

另有 `source` 字段：`builtin`、`market`、`manual`、`dev`，直接写模块的是 `file`。

## 安装目录和界面地址

| 东西 | 位置 | 窗口里的地址（`fuyu-plugin://localhost/` 下） | 包根的层数 |
|---|---|---|---|
| 已安装的包 | `plugins-v3/packages/@作用域/名字/` | `packages/@作用域/名字/<相对包根的路径>` | **3** |
| 开发文件夹 | 任意位置 | 在数据目录 `plugins-v3/` 里时按相对路径；在外面时 `dev/<id>/<相对路径>` | 外面时 2 层起（`id` 是 `@作用域/名字` 时 3 层） |
| 内置插件 | 内置插件清单的 `root` | `builtin/<id>/<相对路径>` | 2 |

- 窗口能读什么由 Rust 的 `fuyu-plugin` 协议按白名单定（2026-11-15 起，E36.3.22，规则见 [v3-boundary.md](v3-boundary.md)「窗口能读的文件」）：已安装的包（`packages/`）不用登记；数据目录里的开发文件夹和直接写模块的插件，要宿主登记过界面文件，它所在的顶层目录才放行；`data/`、`plugins.yml*`、状态文件一律 404。`dev/` 和 `builtin/` 两个前缀宿主已经按这个登记，Rust 一侧的映射还没做，现在是 404；做的时候也走同一份白名单（宿主经协议 2 的 `clients` 通知已经把路径告诉 Rust，映射还要知道每个 id 对应的目录），等插槽接入时一起做。
- E36.5.4 的 `fuyu-plugin build` 原来按「包根最多 2 层」算 `../../__shared/react.js`，已安装的包是 3 层，所以它已改成根路径 `/__shared/react.js`，和层数无关；根路径在 Mac 的 `fuyu-plugin://localhost/` 和 Windows 的 `http://fuyu-plugin.localhost/` 上能不能 import **必须真机验**（E36.3.9 的待人工验收）：它是第 5 阶段 `fuyu-plugin build` 默认值的前提，不通就得改回相对路径（已安装的包 `packageDepth` 是 3）。

## 还没做的

- 开发文件夹的热重载：宿主的 `--dev` 只监视数据目录和内置插件；开发文件夹的监视归 E36.5.10（`fuyu-plugin dev`）。
- 内置插件带 `fuyu.client` 的打包：`build-builtins.mjs` 现在遇到会报错，等插槽接入内置插件的界面时做。
- 插槽的核对（见上）。
