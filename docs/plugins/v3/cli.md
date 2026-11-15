# 命令行

> 第 3 版，实验。第 3 版的命令行是 `fuyu-plugin` 2.0（[#483](https://github.com/TixXin/fuyu/issues/483)），命令和参数在第 5 阶段转正前还可能改。第 2 版的插件继续用 `fuyu-plugin` 1.x，见[第 2 版的文档](../README.md)。内部设计见 [v3-cli.md](../../architecture/plugins/v3-cli.md)。

## 怎么运行

2.0 还没发到 npm。现在在浮屿仓库（[`TixXin/fuyu`](https://github.com/TixXin/fuyu)）里跑，要 Node 22.15 或更新，先在仓库根目录 `pnpm install` 装好依赖：

```bash
node packages/plugin-cli/bin/fuyu-plugin.mjs <命令> [插件文件夹] [选项]
```

插件文件夹不写就是当前文件夹。下文把这一串简写成 `fuyu-plugin`。发到 npm 后的包名和安装方式到时补上。

| 命令 | 作用 |
|---|---|
| [`build [文件夹]`](#build) | 构建到 `build/package/`：带 `nodeApis`、`builtWith` 的 `package.json`，`dist/`，图标、README 等 |
| [`pack [文件夹]`](#pack) | 先构建，再打成 `build/<作用域>-<名字>-<版本>.fuyu` |
| [`check [文件夹]`](#check) | 不运行插件的静态检查：清单、试构建、审核分析器的扫描 |
| [`review <旧> <新>`](#review) | 和市场一样比较两个版本，给出绿 / 黄 / 红三档 |
| [`keygen`](#keygen) | 生成作者签名密钥（只做一次），打印要登记给市场的公钥 |
| [`sign [文件夹]`](#sign) | 给提交号签名，输出市场提交要的内容 |
| [`sign <文件.fuyu>`](#sign) | 给包加作者签名 |
| `version`、`help` | 版本号、帮助；每个命令都能加 `-h` |

**退出码**：0 完成；1 有错误（`review` 是红档时也是 1）；2 参数不对。错误和告警写到标准错误，结果写到标准输出。

还没有的：`publish`（一条命令签名并开市场 PR；现在按[发布](publish.md)手动开 PR）、`dev`（开发模式从文件夹加载、改了自动重载）、换密钥。

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
fuyu-plugin check [文件夹] [--market] [--json] [--config <文件>] [--official]
```

不运行插件，把市场会拦的东西提前报出来：

1. 在临时文件夹里试构建一次：清单校验、入口、挑文件、esbuild、声明对照，失败的都算错误。
2. 对源码和产物跑审核分析器的单版本扫描。红档的（混淆、可执行程序、原生扩展）算错误；实验接口（`fuyu.experimental` 不为空）只在加 `--market` 时算错误，开发时可以用；黄档里对作者有用的（敏感调用、没声明的域名、有依赖却没有锁文件、依赖的安装脚本、新的脚本和二进制文件）算告警。只对首次上架有意义的项不报。

| 选项 | 作用 |
|---|---|
| `--market` | 按市场的规则查：`fuyu.experimental` 不为空就报错（清单校验和审核分析器各报一条） |
| `--json` | 输出 `{ ok, errors, warnings }` |
| `--config`、`--official` | 同 `build` |

有错误时退出码是 1。提交市场前建议跑 `check --market`。

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

## 密钥

签名用 Ed25519。命令按这个顺序找私钥：

1. `--key <文件>`；
2. 环境变量 `FUYU_PLUGIN_SIGNING_KEY`，值是 PEM 原文（在 CI 里用；旧名 `FLY_ISLAND_PLUGIN_SIGNING_KEY` 也认）；
3. `~/.fuyu-plugin/signing.key`（没有它而有 `~/.fly-island-plugin/signing.key` 时用后者）。

**和第 2 版是同一个文件、同样的格式**，第 2 版作者已有的密钥不用重新生成。Windows 上密钥文件用 DPAPI 按当前 Windows 用户加密，只有这个用户能解开；其他系统存 PEM，权限 `0600`。

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
import { build, pack, check, reviewSources, signCommitAt, loadSigningKey } from "@fuyu/plugin-cli";

const result = await build("path/to/plugin", { outDir });
const packed = await pack("path/to/plugin", { signingKey });
const { ok, errors, warnings } = await check("path/to/plugin", { allowExperimental: false });
```

构建出错时抛 `BuildError`，它的 `issues` 是 `{ code, message, path?, file?, line?, column? }` 的列表。`@fuyu/plugin-cli` 是开发期的名字，发到 npm 时会改。

## 待补

- 发到 npm 后的包名、安装方式。
- `publish`：一条命令完成签名、改提交文件、开市场 PR。
- `dev`：接上正在运行的浮屿，从文件夹加载、改了自动重载、看占用。
- 换密钥：用旧密钥给新密钥签证明（第 2 版是 `keys rotate`）。
