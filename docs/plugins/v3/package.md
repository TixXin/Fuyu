# 清单和安装包

> 第 3 版，实验：第 5 阶段转正前字段还可能微调，转正后只增不改。这一页写给插件作者，完整的规则、错误码、摘要和签名格式见 [v3-package.md](../../architecture/plugins/v3-package.md)，校验代码在 `packages/plugin-manifest`。

## 清单

清单就是插件的 `package.json`，浮屿的字段放在 `fuyu` 下。不认第 2 版的 `fuyu-plugin.json`。

```json
{
  "name": "@someone/fuyu-weather",
  "version": "1.2.0",
  "type": "module",
  "description": "Weather on the island",
  "author": { "name": "someone", "url": "https://example.com" },
  "license": "MIT",
  "homepage": "https://example.com/weather",
  "repository": "github:someone/fuyu-weather",
  "bugs": "https://github.com/someone/fuyu-weather/issues",
  "keywords": ["weather", "forecast"],
  "engines": { "fuyu": ">=0.4.0" },
  "fuyu": {
    "manifest": 1,
    "displayName": { "zh-CN": "天气", "en": "Weather" },
    "description": { "zh-CN": "岛上看天气和降雨提醒", "en": "Weather and rain alerts on the island" },
    "icon": "assets/icon.png",
    "categories": ["information"],
    "screenshots": [
      { "path": "assets/forecast.png", "caption": { "zh-CN": "预报页", "en": "Forecast page" } }
    ],
    "platforms": ["windows", "macos"],
    "host": "dist/host.js",
    "client": { "island": "dist/island.js", "settings": "dist/settings.js" },
    "inject": { "required": ["notify", "http"], "optional": ["calendar"] },
    "provides": ["weather"],
    "slots": ["island.page/v1", "settings.section/v1"],
    "commands": [
      { "id": "weather.refresh", "title": { "zh-CN": "刷新天气", "en": "Refresh weather" }, "keybinding": "Ctrl+Alt+W" }
    ],
    "network": ["api.open-meteo.com"],
    "config": "dist/config.schema.json"
  }
}
```

服务名、插槽名还在第 3、4 阶段定，上面用到的只是示意。

### npm 的标准字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | `@<源码仓库的所有者>/<名字>`，规则见[市场规则](market-rules.md#名字)。它是插件的唯一标识，也是安装目录和数据目录的名字 |
| `version` | 是 | semver，例如 `1.2.0`、`1.2.0-beta.1`，不带 `v`。带预发布标记的是预发布版 |
| `type` | 是 | 固定 `"module"`：入口都是 ES 模块，默认导出插件 |
| `license` | 是 | SPDX 标识；`UNLICENSED` 不收 |
| `repository` | 是 | 源码仓库。认 `owner/repo`、`github:owner/repo`、`https://github.com/owner/repo`、`git+https://…`、`{ "url": "…" }` 这些写法。上架市场的要在 GitHub 上 |
| `engines.fuyu` | 是 | 兼容的浮屿版本范围，npm 的写法（`>=0.4.0`、`^0.4.0`、`0.4.x`……）。不满足的浮屿不装它；旧版浮屿会拿到它能用的最新版本 |
| `description`、`author`、`homepage`、`bugs`、`funding`、`keywords` | 否 | 市场详情页：作者、主页、报告问题、赞助作者的链接；`keywords` 用于搜索 |
| `files` | 否 | 哪些文件进包；`package.json`、README、CHANGELOG、LICENSE 总会带上 |

`scripts`、`dependencies`、`exports` 这些 npm 认识的字段照常写；npm 也不认识的顶层字段给告警。

### `fuyu` 下的字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `manifest` | 是 | 清单格式的版本，现在是 `1` |
| `displayName`、`description` | 是 | 名字和一句话介绍，按语言写，要有 `zh-CN` 和 `en` |
| `icon` | 是 | 包内的 `.png` 或 `.svg`。方形，至少 256 像素，深色和浅色的岛上都要看得清 |
| `categories` | 是 | 市场分类，至少一个，从 `productivity`、`todos`、`developer`、`media`、`messages`、`information`、`utilities` 里选 |
| `screenshots` | 否 | 详情页的截图，最多 6 张，`{ path, caption? }`，图片是 `.png`、`.jpg`、`.jpeg` 或 `.webp`，说明按语言写 |
| `preview` | 否 | `true` 表示还不稳定，市场上标「预览」 |
| `platforms` | 否 | 能用的系统：`windows`、`macos`、`linux`。不写就是都能用 |
| `host` | 否 | 宿主部分的入口（`.js` / `.mjs`），跑在 Node 里，可以用 Node 的接口。只加界面的插件可以没有 |
| `client` | 否 | 各窗口的界面入口，键是窗口名；每个窗口只加载自己的那份 |
| `inject` | 否 | 用到哪些服务：`required` 缺了插件就不启动，`optional` 有就用。市场和安装确认据此显示这个插件会用到浮屿的什么（剪贴板、待办、媒体……） |
| `requires` | 否 | 依赖的其他插件和版本范围，`{ "@作用域/名字": "^1.0.0" }`，安装时一起装上 |
| `provides`、`replaces` | 否 | 提供哪些服务、替换哪些内置服务。启用时用来检查冲突；市场和安装确认会写明「这个插件会替换内置的翻译」这类话 |
| `slots` | 否 | 往哪些插槽放界面 |
| `commands` | 否 | 命令和默认快捷键，`{ id, title, keybinding? }`，`id` 不能重复，`title` 按语言写。不运行插件也能列出来、检查快捷键冲突 |
| `network` | 否 | 要连的域名：小写，可以用 `*.` 开头和 `localhost`，不写协议和端口。审核时看，安装确认里显示；界面的 CSP 和内核提供的 `ctx.http` 只放行这些域名 |
| `config` | 否 | 设置项的 schema（`.json`，含默认值），设置窗口据此自动生成表单 |
| `experimental` | 否 | 用到的实验接口，逐个按名字写。写了的只能在开发模式加载，市场不收 |
| `nodeApis` | 自动 | 宿主部分用到的 Node 内置模块（`fs`、`child_process`、`net`、`http`……），构建时扫出来写入。市场和安装确认据此显示「会读写文件」「会运行程序」「会联网」。作者不能自己填：源码的清单里写了会给告警，构建时被覆盖 |
| `builtWith` | 自动 | 构建时写入的 SDK 版本 |

- 路径（`icon`、`host`、`client` 的值、`config`、截图）都是包内的相对路径：用 `/`，不以 `/` 或盘符开头，不含 `\`、`.`、`..` 和空段。
- `fuyu` 下面和嵌套对象里不认识的字段给告警，不报错：以后加字段只会是新增的可选字段。

**`network` 不是沙箱。** 宿主部分能直接用 Node 的网络接口，Node 的权限开关管的是整个进程、分不到单个插件，所以浮屿技术上拦不住插件连没写的域名。它的作用是让「把数据发到一个陌生的服务器」必须先在审核里露面。

### 声明要和代码对得上

`inject`、`provides`、`replaces`、`slots`、`commands`、`network`、`nodeApis` 在三处核对：

1. `fuyu-plugin build` 打包时对照代码。
2. 市场审核时（见[审核看什么](review.md)）。
3. 浮屿加载插件时：内核发现插件实际做了没声明的事（注册了没写的插槽、服务），就在插件页标「和声明不符」。

### 不在清单里的

| 东西 | 在哪 |
|---|---|
| 发布者、作者的签名公钥 | 市场的提交文件：要由市场核实，不能由包自己说了算 |
| 作者签名、哪个版本被审过、下载地址和哈希 | 市场索引，由市场 CI 生成 |
| 权限 | 没有：插件和浮屿同权 |
| 什么时候启动 | 不用声明 |
| 按系统带的可执行程序 | 暂不支持 |

## `.fuyu` 安装包

文件名是 `<作用域>-<名字>-<版本>.fuyu`（例如 `someone-fuyu-weather-1.2.0.fuyu`），内容是 zip。市场构建出来的、作者自己用 `fuyu-plugin pack` 打出来的都是这个格式。里面是：

```text
package.json          清单（构建时写入 nodeApis 和 builtWith）
dist/host.js          宿主部分：单个文件，跑在 Node 里，npm 依赖都打进去
dist/island.js        各窗口的界面部分
dist/settings.js
dist/config.schema.json
assets/               图标、截图、插件自己的图片和音效
README.md             市场详情页的说明（可以另有 README.zh-CN.md）
CHANGELOG.md          市场详情页的版本历史
LICENSE
fuyu-signature.json   签名，可选，见下文
```

- **不带 `node_modules`。** 依赖在构建时打进 `dist/`，浮屿不在用户电脑上跑 `npm install`。
- **界面部分不打进 React。** 所有插件共用浮屿提供的一份：`fuyu-plugin build` 把对 `react`、`react/jsx-runtime` 的引用改写成浮屿提供的转接模块。共享模块的完整名单等命令行做完后补进[命令行](cli.md)。样式由打包器打进 JS。
- **同样的文件永远打出逐字节相同的包**：文件按路径排序，时间戳固定，文本文件统一成 `\n` 换行。所以同一份源码在不同电脑上打出的包摘要相同。

### 包里不能有的

打包和安装时都会检查，有一条不满足就拒绝：

| 不能有的 | 说明 |
|---|---|
| `node_modules` | 任何一级目录叫这个名字都不行 |
| Node 原生扩展 | `.node` 文件 |
| 可执行程序和编译过的代码 | 按扩展名认 `.exe .dll .sys .scr .com .msi .so .dylib .bin .elf .app .appimage .deb .rpm .pkg .dmg .wasm .jar`；按文件头认 Windows、Linux、macOS 的可执行文件（PE、ELF、Mach-O）、WebAssembly、Java 的 class 和 jar |
| 符号链接、设备文件这类非普通文件 | |
| 不规矩的路径 | 绝对路径、盘符、`\`、`.`、`..`、空段、控制字符 |
| 重名的文件 | 只差大小写或 Unicode 写法的两个路径算重名，免得在不区分大小写的系统上互相覆盖 |
| 顶层没有 `package.json` | 或者它不是 JSON |
| 太大 | 包超过 20 MB；解压后超过 100 MB 或超过 5000 个文件 |
| 不支持的 zip | 加密的条目、zip64、分卷，除 stored 和 deflate 以外的压缩方式 |

### 签名

包里可以带一个签名文件 `fuyu-signature.json`，有两种签名：

- **市场签名**：市场构建出包后签。
- **作者签名**：手动分发的包可以由作者签。安装时浮屿显示是谁签的，并记下这把密钥；没有签名的照实写「没有签名」。

签名签的是包的摘要（按每个文件的路径和内容算），所以加签不改变包的内容。上架市场时作者签的是**提交号**，不是包，见[市场规则](market-rules.md#作者签名)。第 2 版的作者签名密钥可以直接用来签。签名用的命令等命令行做完后补进[命令行](cli.md)。

## 三种装法

| 装法 | 作者要做什么 | 用户那边 |
|---|---|---|
| **从市场装** | 不用打包：打标签，把提交号交给市场，市场从源码构建出 `.fuyu`（见[发布](publish.md)） | 默认的方式。每个版本审过才上架，有冷静期和自动更新，撤销名单生效 |
| **手动装一个 `.fuyu` 文件** | `fuyu-plugin pack` 打出 `.fuyu`，自己发给别人 | 默认关，要在设置里打开一次；关着时双击 `.fuyu` 只说明怎么打开，不安装。见下文 |
| **从文件夹加载** | 不用打包 | 开发模式，单独的开关；可以用实验接口 |

手动安装是整套保护里最弱的一环：审核、市场构建、冷静期都管不到它，只剩安装时那一次确认。所以：

- 安装确认写明「这个插件没有经过浮屿市场的审核」，样式和从市场安装的不一样；照样列出它会用到什么（`nodeApis`、要连的域名、替换哪些内置功能）。
- 插件页上一直带「未经审核」的标记，不会自动更新。
- 撤销名单对它同样生效（按名字和版本）。

适合内部工具、还没上架或不想上架的插件。浮屿里的安装界面还在做，上面是已经定下的行为。
