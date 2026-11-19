# 命令行

> 命令行是 npm 上的 `fuyu-plugin`（2.0 起，[#483](https://github.com/TixXin/fuyu/issues/483)）。2026-11 下线的旧版插件用的是 1.x，已停止更新。内部设计见[命令行的设计](../architecture/plugins/v3-cli.md)。

## 怎么运行

要 Node 22.15 或更新。脚手架 `npm create fuyu-plugin@latest` 生成的项目已经把 `fuyu-plugin` 装成开发依赖，在项目里用 `npx fuyu-plugin` 运行；也可以全局装：

```bash
npm install -g fuyu-plugin
fuyu-plugin <命令> [插件文件夹] [选项]
```

插件文件夹不写就是当前文件夹。

| 命令 | 作用 |
|---|---|
| [`build [文件夹]`](#build) | 构建到 `build/package/`：带 `nodeApis`、`builtWith` 的 `package.json`，`dist/`，图标、README 等 |
| [`pack [文件夹]`](#pack) | 先构建，再打成 `build/<作用域>-<名字>-<版本>.fuyu` |
| [`check [文件夹]`](#check) | 不运行插件的静态检查：清单、试构建、审核分析器的扫描 |
| [`icon [文件夹]`](#icon) | 按官方插件的样式写出图标 `assets/icon.svg`：主色浅底的圆角方块加同色线条图标 |
| [`shots [文件夹]`](#shots) | 用示例数据把岛上页面和收起条渲染出来截图，并合成封面 |
| [`preview [文件夹]`](#preview) | 在本地画出这个插件在市场卡片和详情页里的样子，深色、浅色各一份 |
| [`review <旧> <新>`](#review) | 和市场一样比较两个版本，给出绿 / 黄 / 红三档 |
| [`keygen`](#keygen) | 生成作者签名密钥（只做一次），打印要登记给市场的公钥 |
| [`sign [文件夹]`](#sign) | 给提交号签名，输出市场提交要的内容 |
| [`sign <文件.fuyu>`](#sign) | 给包加作者签名 |
| [`dev [文件夹]`](#dev) | 构建并登记进浮屿的开发模式，改了自动重新构建 |
| `version`、`help` | 版本号、帮助；每个命令都能加 `-h` |

**退出码**：0 完成；1 有错误（`review` 是红档时也是 1）；2 参数不对。错误和告警写到标准错误，结果写到标准输出。

还没有的：`publish`（一条命令签名并开市场 PR；现在按[发布](publish.md)手动开 PR）、换密钥。

## 源码怎么放

清单（`package.json`）里写的是**构建产物**的路径，源码的位置按约定从产物路径推出来，不另写构建配置。市场构建时也不读作者仓库里的构建配置。

| 清单里写 | 源码放在 |
|---|---|
| `fuyu.host: "dist/host.js"` | `src/host.ts`（或 `.tsx`、`.mts`、`.js`、`.jsx`、`.mjs`，只能有一个） |
| `fuyu.client.island: "dist/island.js"` | `src/island.tsx` 等 |
| `fuyu.client.settings: "dist/pages/settings.js"` | `src/pages/settings.tsx` 等 |
| `fuyu.config: "dist/config.schema.json"` | `src/config.schema.json`，原样复制 |

- `host` 和 `client` 的入口必须在 `dist/` 下；`config` 不在 `dist/` 下时当作普通文件，从源码里直接带上。
- 源码里的 `dist/` 一律不进包，进包的 `dist/` 都是这次构建出来的。
- 宿主部分默认导出插件，界面部分默认导出 `apply(ctx)`。宿主部分登记界面文件时写 `new URL("./island.js", import.meta.url)`，按产物的位置算。
- 一个完整的小例子在浮屿仓库的 `packages/plugin-cli/test/fixtures/hello/`（TypeScript、JSX、样式文件各有一处）。

### 哪些文件进包

1. 构建产物：`package.json` 和 `dist/` 下的入口。
2. 顶层的 README、CHANGELOG、LICENSE（或 LICENCE）、NOTICE，包括 `README.zh-CN.md` 这类按语言分的。
3. `files` 里列的文件和文件夹；没写 `files` 时默认带 `assets/`（没有就跳过）。只认路径，不认 `*` 这类通配符；`dist`、`package.json` 写了也跳过，它们由构建生成。
4. 清单引用的图标、截图和不在 `dist/` 下的 `config`，没列在 `files` 里也会带上；文件不存在就报错。

`.DS_Store`、`Thumbs.db`、`desktop.ini` 跳过；`node_modules`、`.git` 跳过并给告警；符号链接和特殊文件报错。包里不能有的东西见[清单和安装包](package.md#包里不能有的)。

## build

```bash
fuyu-plugin build [文件夹] [--out <文件夹>] [--config <文件>] [--official]
```

| 选项 | 作用 |
|---|---|
| `--out <文件夹>` | 输出到别处，默认 `build/package/` |
| `--config <文件>` | 构建设置（JSON），见下文。市场构建时用市场自己的 |
| `--official` | 允许 `@fuyu/*` 作用域，只给官方插件用 |

用 esbuild 构建，宿主部分和界面部分分开打包：

- **宿主部分**：按 Node、ES 模块、目标 `node22` 打包，npm 依赖全部打进这一个文件。`@fuyu/plugin-base`、`fuyu-plugin` 留在外面，由浮屿提供，保证全进程只有一份内核。只有这两个名字本身留在外面：浮屿不提供它们的子路径，`@fuyu/plugin-base/protocol` 这类子路径会打进包里。宿主代码用到的 Node 内置模块被扫出来写进 `fuyu.nodeApis`（`fs/promises` 记成 `fs`，和审核分析器一样）。打进去的 CommonJS 依赖里有 `require()` 时，产物开头会用 `node:module` 造一个 `require`，`nodeApis` 里也就多一个 `module`。
- **界面部分**：按浏览器、ES 模块、目标 `es2022` 打包，`process.env.NODE_ENV` 是 `"production"`，JSX 用自动运行时。
  - **共享模块**：`react` 和 `react/jsx-runtime` 不打进去，所有插件共用浮屿提供的一份。构建时把对它们的引用（包括依赖里的引用）改写成浮屿的转接模块，默认写根路径 `/__shared/react.js`、`/__shared/react-jsx-runtime.js`。根路径在 Mac 和 Windows 上都落到插件协议的根，和插件装在哪一层无关。
  - 浮屿提供、但还没有转接模块的包（`react-dom`、`fuyu-plugin`、`@fuyu/plugin-base`，以及名单外的 `react/*`）用到就报错，不让插件自己打一份进去。它们有了转接模块后会进名单，到时不用改插件。
  - **样式**：`import "./x.css"` 的样式合并后打进 JS。插件启用时插一个 `<style data-fuyu-plugin="<插件名>">`，停用时撤掉。
  - 图片、字体、音频按 `data:` 地址打进去。
- **产物的 `package.json`**：源码清单加上 `fuyu.nodeApis` 和 `fuyu.builtWith`（这个命令行的版本），去掉只在构建时有用的字段（`scripts`、各种 `dependencies`、`overrides`、`workspaces`、`packageManager` 等，依赖已经打进 `dist/`）。构建前按源码清单、构建后按产物清单各校验一次，规则见[清单和安装包](package.md)。
- **同样的输入，同样的输出**：同一份源码、同一版命令行，放在哪个文件夹里构建都得到逐字节相同的产物。为此不出 source map、不压缩、不读你的 `tsconfig.json`。不同系统之间不保证相同，所以市场只认自己构建的包。

**声明和代码对照**：下面这些只给告警，不让构建失败，但市场审核时会看（见[审核看什么](review.md)）：

| 告警 | 什么时候 |
|---|---|
| `undeclared-domain` | 产物里出现了 `fuyu.network` 没有的域名，打进去的依赖也算 |
| `undeclared-slot` | 界面代码里 `slots.add("<名字>"` 的名字不在 `fuyu.slots` 里 |
| `undeclared-window` | 宿主代码里 `clients.add("<窗口>"` 的窗口不在 `fuyu.client` 里 |
| `node-apis` | 源码清单自己写了 `nodeApis`，和扫描结果不同（构建会覆盖它） |
| `esbuild` | esbuild 自己的告警 |

**输出文件夹**：只会清空空文件夹或以前构建出来的文件夹（里面的 `package.json` 带 `builtWith`），也不能是插件文件夹本身或它的上级。在 `.gitignore` 里加一行 `build/`。

### 构建设置（`--config`）

一个 JSON 对象，只认下面这些键，写了别的报错。平时不用写；市场构建时由市场给一份自己的（例如 `market.json`），不用作者仓库里的。

| 键 | 默认 | 说明 |
|---|---|---|
| `shared` | `react`、`react/jsx-runtime` 两项 | 共享模块名单：模块名对应插件协议根下的路径 |
| `packageDepth` | 不写 | 不写或 `false`：共享模块写根路径 `/__shared/…`。`true`：按已安装包的 3 层（`packages/@作用域/名字/`）写相对路径。非负整数：按给的层数写相对路径 |
| `hostExternal` | `["@fuyu/plugin-base", "fuyu-plugin"]`（浮屿宿主共享的模块） | 宿主部分留在外面的模块，按名字精确匹配，子路径不算 |
| `appModules` | `["react", "react-dom", "fuyu-plugin", "@fuyu/plugin-base"]` | 界面部分不许自己打进去的包 |
| `nodeTarget`、`browserTarget` | `node22`、`es2022` | esbuild 的目标 |

相对路径是「产物在包里的深度 + 层数」个 `../`：`packageDepth: true` 时 `dist/island.js` 里写成 `../../../../__shared/react.js`。层数写多了没关系，多出来的 `..` 会停在协议根上；写少了才会指错地方。根路径在两个系统的真岛上能不能加载还要实测，不行的话默认值会改回相对路径。

## pack

```bash
fuyu-plugin pack [文件夹] [--out <文件>] [--sign] [--key <文件>] [--config <文件>] [--official]
```

先 `build`，再打成 `build/<作用域>-<名字>-<版本>.fuyu`，读回来再校验一次。打印包的摘要（签名签的就是它）和整个文件的 SHA-256。同样的文件永远打出逐字节相同的包。

| 选项 | 作用 |
|---|---|
| `--out <文件>` | 包写到别处 |
| `--sign` | 同时加一条作者签名，手动安装时显示是谁签的。不改变包的摘要 |
| `--key <文件>` | 签名用的密钥，见[密钥](#密钥) |
| `--config`、`--official` | 同 `build` |

上架市场不用自己打包：市场从你交的提交号构建。`pack` 是给手动分发和自己试装用的。

## check

```bash
fuyu-plugin check [文件夹] [--market] [--strict] [--json] [--config <文件>] [--official]
```

不运行插件，把市场会拦的东西提前报出来：

1. 在临时文件夹里试构建一次：清单校验、入口、挑文件、esbuild、声明对照，失败的都算错误。
2. 对源码和产物跑审核分析器的单版本扫描。红档的（混淆、可执行程序、原生扩展）算错误；实验接口（`fuyu.experimental` 不为空）只在加 `--market` 时算错误，开发时可以用；黄档里对作者有用的（敏感调用、没声明的域名、有依赖却没有锁文件、依赖的安装脚本、新的脚本和二进制文件）算告警。只对首次上架有意义的项不报。

3. 上架信息的检查（代码以 `listing:` 开头），是用户在市场卡片和插件页上会看到的问题。只给告警，市场不会因此拒收；加 `--strict` 当错误。

| 告警 | 什么时候 |
|---|---|
| `listing:screenshots` | `fuyu.screenshots` 一张都没有。至少放一张；没有自己界面的插件截它起作用的地方 |
| `listing:description-length` | `fuyu.description` 的某个语言在市场卡片上两行放不下（卡片最多显示两行，后面的被截掉）。按宽度估：一个汉字算 1，一个拉丁字母、数字或空格算 0.46，超过 58 告警。这是照默认大小的设置窗口量的，窗口拉宽能多放几个字 |
| `listing:description-how` | 说明里写了怎么做的或怎么配置：「基于…」「API Key」「免注册」「在设置中配置…」「owner/repo」「原生接口」，英文的 based on、powered by、built with、configure … in settings。说明只说对用户有什么用，其余写进 README |
| `listing:description-mismatch` | `package.json` 顶层的 `description` 和 `fuyu.description.en` 不一样，npm 和市场上会是两种说法 |
| `listing:readme` | 没有 `README.md`，市场详情页的「说明」页签是空的 |
| `listing:name-readme` | README 的第一个一级标题里没有插件的名字（`fuyu.displayName` 的中文或英文有一个就行；`README.zh-CN.md` 这类带语言的要有那个语言的名字） |
| `listing:name-page` | 岛上页面（`island.page/v1`）的 `title` 和 `fuyu.displayName` 不一样 |

名字的检查只读源码、不运行插件：岛上页面的 `title` 写成字面量、`{ "zh-CN": …, en: … }`，或指向同一个插件里的常量和它的属性（`PAGE_TITLE`、`zhCN.title`）时读得出来；运行时算出来的标题读不出，这一条就不检查。设置分节的标题画在插件自己的组件里，读不出来，不检查，照[官方插件标准](official-quality.md)自己对一遍。

| 选项 | 作用 |
|---|---|
| `--market` | 按市场的规则查：`fuyu.experimental` 不为空就报错（清单校验和审核分析器各报一条） |
| `--strict` | 上架信息的告警当错误。官方插件按这个标准，见[官方插件标准](official-quality.md) |
| `--json` | 输出 `{ ok, errors, warnings }` |
| `--config`、`--official` | 同 `build` |

有错误时退出码是 1。提交市场前建议跑 `check --market`。

## icon

```bash
fuyu-plugin icon [文件夹] --glyph <lucide 名 | 文件.svg> --color <#rrggbb> [--out <文件>]
fuyu-plugin icon --search <词>
```

写出和官方插件同一个样式的图标：铺满的圆角方块填主色的 16%，上面一个同色的线条图标，缩到 56% 居中（规则见[官方插件标准](official-quality.md#5-图标)）。脚手架生成的项目自带一个这样的图标，换图形和颜色用这条命令。

| 选项 | 作用 |
|---|---|
| `--glyph <名字>` | [lucide](https://lucide.dev/icons) 的图标名，例如 `alarm-clock`；lucide 改过名的旧名字也认 |
| `--glyph <文件.svg>` | 自己画的图形：一个 24 格的 SVG，只用 `path`、`circle`、`rect`、`line`、`polyline`、`polygon`、`ellipse`，不写 `fill`、`stroke`、`style`（颜色由图标给）。lucide 里没有合适的图形时用 |
| `--color <#rrggbb>` | 插件的主色，`#rgb` 也认 |
| `--out <文件>` | 写到别处。默认写清单的 `fuyu.icon`（要是 `.svg`），清单没写就是 `assets/icon.svg`；已有的文件会被换掉 |
| `--search <词>` | 列出名字里带这个词的 lucide 图标，不写文件 |

主色有这几种情况时给告警，文件照写：和某个官方插件的主色相同（`icon:same-colour`）或太近（`icon:close-colour`，OKLab 距离小于 0.05）；太浅（`icon:light`）、太深（`icon:dark`）、接近灰色（`icon:grey`），这三种在深色或浅色底上看不清。

lucide 的图形数据随命令行一起带（`packages/plugin-cli/src/icon/lucide.json`，1.23.0 版，ISC 许可证见同目录的 `LUCIDE-LICENSE`），不用另装 lucide。要更新到新版 lucide，在浮屿仓库里跑 `node packages/plugin-cli/scripts/gen-lucide.mjs`。

## shots

```bash
fuyu-plugin shots [文件夹] [--out <文件夹>] [--sample <文件>] [--theme dark|light] [--locale zh-CN|en] [--color <#rrggbb>] [--no-cover] [--scale 1|2|3]
```

把插件自己的岛上页面（`island.page/v1`）和收起条（`island.collapsed/v1`）组件渲染进岛的外壳，用本机的 Chrome、Edge 或 Chromium 无界面截图，写进 `screenshots/`，再合成一张 `cover.png`。页面要的数据来自插件带的示例数据 `shots/sample.ts`，不启动浮屿、不运行宿主部分。示例数据的写法、外壳和真岛的差别、封面怎么用见[截图和封面](screenshots.md)。

| 选项 | 作用 |
|---|---|
| `--out <文件夹>` | 图写到别处，默认插件文件夹里的 `screenshots/` |
| `--sample <文件>` | 用这个示例数据文件，不用 `shots/sample.*` |
| `--theme`、`--locale` | 示例数据里没写主题、语言的图用这个，默认 `dark`、`zh-CN` |
| `--color <#rrggbb>` | 封面的主色，默认取图标里圆角方块的颜色 |
| `--no-cover` | 不合成封面 |
| `--scale <1\|2\|3>` | 每个点几个像素，默认 2（展开页是 1584 × 720） |

- 找浏览器：环境变量 `CHROME_PATH`，否则常见的安装位置。找不到就报错。
- 渲染组件要 `react` 和 `react-dom`：先在插件项目里找，没有就用命令行自己带的；两处都没有时报错，提示在项目里装。
- 告警：示例数据没应答的宿主调用（`shots:unanswered`，逐个列出方法名）；8 秒后界面还在变（`shots:unsettled`）；图标里取不到主色（`shots:cover-colour`）。
- 报错并退出 1：组件渲染失败；收起条在这份示例数据下什么也没显示；插件没有岛上部分。
- 截好的图要自己写进清单的 `fuyu.screenshots`。

## preview

```bash
fuyu-plugin preview [文件夹] [--out <文件>] [--theme dark|light] [--locale zh-CN|en] [--png] [--open]
```

上架前在本地看这个插件在插件市场里的样子：市场卡片和详情页，深色、浅色、中文、英文各一份，画在一个网页里（默认 `build/preview.html`，图标和截图都嵌在文件里，可以直接发给别人）。它只读清单、图标、`fuyu.screenshots` 列的图和 README，不构建、不运行插件。

| 选项 | 作用 |
|---|---|
| `--out <文件>` | 网页写到别处 |
| `--theme`、`--locale` | 只画这一种主题或语言，默认都画 |
| `--png` | 再把每一份存成 `preview-<主题>-<语言>.png`（和网页放一起），要本机有 Chrome、Edge 或 Chromium |
| `--open` | 写完用默认浏览器打开 |

命令顺带跑一遍 `check` 的上架信息检查（`listing:`），告警打在终端里，也列在网页顶上。清单里写了但找不到的图标、截图给告警 `preview:icon`、`preview:screenshot`。

### 和真的市场差在哪

样式是浮屿自己的：市场卡片、详情页、按钮、Markdown 用到的 CSS 规则和主题变量由 `packages/plugin-cli/scripts/gen-preview-styles.mjs` 从 `src/` 抽成 `packages/plugin-cli/src/preview/app-styles.json`，随命令行一起带。README 的渲染规则也和详情页一样：标题从三级开始；表格能渲染（表头一行、`|---|` 分隔行、数据行，支持 `:---:` 对齐）；图片和 HTML 不渲染，图片只留说明文字；只有 `http(s)` 链接能点。

照着画的是结构（HTML），和真的有这些差别：

- 卡片按默认大小的设置窗口里的宽度画（403px，两列中的一列）；窗口拉宽、拉窄时真卡片跟着变。
- 详情页真的最高 760px、里面滚动，这里整页展开。
- 只有市场才知道的不显示：包的大小、更新日期、点赞数、「会做什么」的权限清单、命令列表、更新日志和版本两个页签。
- 按钮是「安装」这一种状态，点了没反应；截图不能点开放大。
- 发布者：`@fuyu/` 下的包显示官方标记和「浮屿团队」，别的显示 `package.json` 的 `author`，没有就用仓库地址或包名里的账号名；真市场上是提交插件的 GitHub 账号。
- 字体用浏览器里的系统界面字体，Windows 上和设置窗口一致，Mac 上略有出入。

浮屿改了市场的样式后，`tests/unit/plugin-cli-preview.test.mjs` 会失败，照提示跑 `node packages/plugin-cli/scripts/gen-preview-styles.mjs` 并提交生成的文件。

## review

```bash
fuyu-plugin review <旧> <新> [--repo <文件夹>] [--path <文件夹>] [--old-built <文件夹>] [--new-built <文件夹>] [--format markdown|json] [--json <文件>] [--markdown <文件>]
```

调用市场用的同一个审核分析器，报告和市场贴进 PR 的一样，分档条件见[审核看什么](review.md)。两边各是：

- **文件夹**：先复制一份再比较，跳过 `node_modules`、`.git` 和以前构建出来的 `build/`。
- **git 提交**（提交号、标签、`HEAD~1` 这类）：从仓库里取这个提交下插件文件夹的全部文件，不切分支、不动工作区。
- **`-`**：没有旧版本（首次上架），至少黄档。

| 选项 | 作用 |
|---|---|
| `--repo <文件夹>` | 取提交的 git 仓库，默认当前文件夹 |
| `--path <文件夹>` | 插件在仓库里的位置，默认是当前文件夹在仓库里的位置 |
| `--old-built`、`--new-built` | 两个版本的构建产物，一起扫 |
| `--format markdown\|json` | 标准输出的格式，默认 Markdown |
| `--json <文件>`、`--markdown <文件>` | 另外把报告写到文件 |

例如和上一个上架的版本比：`fuyu-plugin review v1.2.0 HEAD`。红档时退出码是 1，绿档和黄档是 0。

## dev

```bash
fuyu-plugin dev [文件夹] [--data-dir <文件夹>] [--out <文件夹>] [--once] [--clean]
```

开发时用：先构建（允许实验接口），再把构建产物登记进浮屿的插件列表 `plugins.yml`（标成 `source: dev`），然后盯着 `src/` 和清单，改了自动重新构建。正在运行的浮屿读到 `plugins.yml` 的变化就加载它。脚手架生成的项目里 `npm run dev` 就是它。

- `plugins.yml` 默认在 `~/.fuyu/plugins-v3/`；浮屿的家目录不在默认位置时，用 `--data-dir` 或环境变量 `FUYU_PLUGINS_V3_DIR` 指过去。
- `--once`：构建、登记一次就退出，不盯改动。
- `--clean`：从 `plugins.yml` 里去掉这个插件的开发登记，不构建。

## 密钥

签名用 Ed25519。命令按这个顺序找私钥：

1. `--key <文件>`；
2. 环境变量 `FUYU_PLUGIN_SIGNING_KEY`，值是 PEM 原文（在 CI 里用；旧名 `FLY_ISLAND_PLUGIN_SIGNING_KEY` 也认）；
3. `~/.fuyu-plugin/signing.key`（没有它而有 `~/.fly-island-plugin/signing.key` 时用后者）。

**和旧版插件的 `fuyu-plugin` 1.x 是同一个文件、同样的格式**，以前生成过的密钥不用重新生成。Windows 上密钥文件用 DPAPI 按当前 Windows 用户加密，只有这个用户能解开；其他系统存 PEM，权限 `0600`。

备份好密钥文件。丢了只能换新密钥，而换密钥当作重新上架，已经装了的用户要重新确认（见[市场规则](market-rules.md#换密钥换人换仓库)）。私钥不要放进仓库。

### keygen

```bash
fuyu-plugin keygen [--key <文件>]
```

生成密钥，打印 `{ "keyId", "publicKey" }`，这是要登记给市场的作者公钥。密钥文件已经存在时不覆盖，只打印它的公钥。

### sign

给提交号签名，上架市场用：

```bash
fuyu-plugin sign [文件夹] [--commit <提交>] [--repository <地址>] [--key <文件>] [--out <文件>]
```

- `--commit` 默认 `HEAD`，解析成完整的 40 位提交号。读的是**这个提交里**的 `package.json`，不是工作区里的；它要能通过源码清单的校验，不许用实验接口，否则不签。
- 仓库地址取清单的 `repository`，写成 `https://github.com/<所有者>/<仓库>`（市场只收 GitHub 上的仓库），`--repository` 可以直接给。
- 签的是插件名、版本、仓库、提交号四样（`fuyu-plugin-commit/1`，见[市场规则](market-rules.md#作者签名)），签完用公钥验一遍，输出：

```json
{
  "name": "@someone/fuyu-hello",
  "version": "1.0.0",
  "repository": "https://github.com/someone/fuyu-hello",
  "commit": "<40 位提交号>",
  "authorSignature": { "keyId": "…", "signature": "…" },
  "publicKey": "…"
}
```

`--out <文件>` 另外写一份。其中 `version`、`repository`、`commit`、`authorSignature` 四项照抄进市场提交文件 `versions` 的新一行，第一次提交时 `authorKeys` 写 `keygen` 打印的公钥，见[发布](publish.md#提交文件)。

给手动分发的包加作者签名：

```bash
fuyu-plugin sign <文件.fuyu> [--key <文件>] [--out <文件>]
```

加上或替换这把密钥的作者签名，原地改写（`--out` 写到别处），签完验一遍。签名不改变包的摘要。

## 在代码里用

命令也能当函数调用，类型声明在 `packages/plugin-cli/src/index.d.mts`：

```js
import { build, pack, check, icon, reviewSources, signCommitAt, loadSigningKey } from "@fuyu/plugin-cli";

const result = await build("path/to/plugin", { outDir });
const packed = await pack("path/to/plugin", { signingKey });
const { ok, errors, warnings } = await check("path/to/plugin", { allowExperimental: false });
```

截图、图标和预览也能调：`await shots("path/to/plugin", { outDir })`、`await icon("path/to/plugin", { glyph: "rocket", color: "#e0a020" })`、`await preview("path/to/plugin", { png: true })`。

`check()` 默认不做上架信息的检查，`listing: "warn"` 或 `"error"` 打开；单独要这部分结果用 `lintListing(dir, manifest)`。

构建出错时抛 `BuildError`，它的 `issues` 是 `{ code, message, path?, file?, line?, column? }` 的列表。在浮屿仓库里它叫 `@fuyu/plugin-cli`；npm 上的 `fuyu-plugin` 包从根入口导出同样的函数（`import { build, check, pack, dev } from "fuyu-plugin"`）。

## 待补

- `publish`：一条命令完成签名、改提交文件、开市场 PR。
- `dev`：看插件的占用。
- 换密钥：用旧密钥给新密钥签证明（旧版 1.x 是 `keys rotate`）。
