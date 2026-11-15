# 插件平台第 3 版：命令行 `fuyu-plugin` 2.0

> 状态：实验。实现在 `packages/plugin-cli`（开发期的私有名字 `@fuyu/plugin-cli`，命令名 `fuyu-plugin`，正式发 npm 时再改名），任务 E36.5.4（#483）。清单和 `.fuyu` 包的格式见 [v3-package.md](v3-package.md)，作者签名和市场见 [v3-market.md](v3-market.md)，审核分档见 `packages/plugin-review/README.md`。第 2 版的 `fuyu-plugin`（`packages/fuyu-plugin`）冻结，不受影响。

还没发包时在仓库里这样跑：

```bash
node packages/plugin-cli/bin/fuyu-plugin.mjs <命令> [插件文件夹] [选项]
```

| 命令 | 作用 |
|---|---|
| `build [文件夹]` | 构建到 `build/package/`：带 `nodeApis`、`builtWith` 的 `package.json`，`dist/`，图标、README 等 |
| `pack [文件夹]` | 先构建，再打成 `build/<作用域>-<名字>-<版本>.fuyu`；`--sign` 同时加作者签名 |
| `check [文件夹]` | 不运行插件的静态检查：清单、试构建、审核分析器的单版本扫描 |
| `review <旧> <新>` | 和市场一样比较两个版本，每一边是文件夹或 git 提交，首次上架旧的一边写 `-` |
| `keygen` | 生成签名密钥（只做一次），打印给市场登记的公钥 |
| `sign [文件夹]` | 给提交号签名（`fuyu-plugin-commit/1`），输出市场提交要的 JSON |
| `sign <文件.fuyu>` | 给包加作者签名 |

退出码：0 完成；1 有错误（`review` 是红档）；2 参数不对。`publish`、`dev` 还没做。

## 源码怎么写

清单（`package.json`）里写的是**产物**的路径，源码按约定从产物路径推出来，不另写配置（市场构建时也不读作者仓库里的构建配置）：

| 清单 | 源码 |
|---|---|
| `fuyu.host: "dist/host.js"` | `src/host.ts`（或 `.tsx`、`.mts`、`.js`、`.jsx`、`.mjs`，只能有一个） |
| `fuyu.client.island: "dist/island.js"` | `src/island.tsx` 等 |
| `fuyu.client.settings: "dist/pages/settings.js"` | `src/pages/settings.tsx` 等 |
| `fuyu.config: "dist/config.schema.json"` | 原样复制 `src/config.schema.json` |

- `host`、`client.*` 必须在 `dist/` 下；`config` 不在 `dist/` 下时当作普通文件从源码里带上。
- 源码里的 `dist/` 一律不进包，进包的 `dist/` 都是这次构建出来的。
- 宿主部分默认导出插件（Cordis 的写法，例如 `export default class extends Service`），界面部分默认导出 `apply(ctx)`，和 [v3-boundary.md](v3-boundary.md)「插件的界面文件」一致。宿主部分登记界面文件时写 `new URL("./island.js", import.meta.url)`，按产物的位置算。
- 示例：`packages/plugin-cli/test/fixtures/hello/`（`plugin-base/examples/hello` 按新结构重写，TypeScript、JSX、样式文件各有一处）。

### 哪些文件进包

1. 构建产物：`package.json` 和 `dist/` 下的入口。
2. 顶层的 README、CHANGELOG、LICENSE（LICENCE）、NOTICE（含 `README.zh-CN.md` 这类）。
3. `files` 里列的文件和文件夹；没写 `files` 时默认带 `assets/`（不存在就跳过）。只认路径，不认 `*` 这类通配符；`dist`、`package.json` 写了也跳过（由构建生成）。
4. 清单引用的 `fuyu.icon`、`fuyu.screenshots[].path`、`fuyu.config`（不在 `dist/` 下时），没列在 `files` 里也会带上，不存在就报错。

文件夹里的 `.DS_Store`、`Thumbs.db`、`desktop.ini` 跳过；`node_modules`、`.git` 跳过并告警；符号链接和特殊文件报错。

## `build`

用 esbuild（锁在 `0.28.1`，和仓库里 Vite 用的同一版）：

**宿主部分**：Node、ESM、目标 `node22`，npm 依赖都打进去。留作外部的只有宿主共享的模块，名单读 `@fuyu/plugin-base/protocol` 的 `HOST_SHARED_MODULES`（现在是 `@fuyu/plugin-base`、`fuyu-plugin`），由宿主的解析钩子指到内核那一份。按名字精确匹配（esbuild 的 onResolve 插件，不用 `external`：`external` 写了包名，子路径也会一起留在外面）：宿主只共享不带子路径的包，`@fuyu/plugin-base/protocol` 这类子路径照常打进包里，否则运行时找不到模块。内置插件的构建（`scripts/plugins-v3/build-builtins.mjs`）用的是同一份名单和同一种匹配。Node 内置模块留作外部；从 esbuild 的 metafile 里取出宿主产物引用的内置模块（去掉 `node:`，只留第一段，`fs/promises` 记成 `fs`，和审核分析器一样），排好序写进 `fuyu.nodeApis`。打进去的 CommonJS 依赖里有 `require()` 时，产物开头加两行用 `node:module` 的 `createRequire` 造一个 `require`，`nodeApis` 里随之多一个 `module`。

**界面部分**：浏览器、ESM、目标 `es2022`，`process.env.NODE_ENV` 定成 `"production"`，JSX 用自动运行时。

- **共享模块**：名单从 `@fuyu/plugin-base/protocol` 的 `SHARED_MODULES` 读（现在是 `react`、`react/jsx-runtime`，对应协议根下的 `__shared/react.js`、`__shared/react-jsx-runtime.js`），可以用参数换掉。名单里的模块改写成浮屿的转接模块，依赖里的引用也一样改写，保证一个窗口只有一份 React。
  - **默认写根路径**：`import … from "/__shared/react.js"`。它在 Mac 的 `fuyu-plugin://localhost/…` 和 Windows 的 `http://fuyu-plugin.localhost/…` 上都按 URL 规则落到协议根，和插件装在哪一层、内置插件的地址前面有没有前缀都无关。
  - 为什么默认不用相对路径：包根在协议根下面几层随来源不同（E36.3.9 定的布局，见 [v3-sources.md](v3-sources.md)）：市场和手动安装的包在 `packages/@作用域/名字/`，3 层，没有作用域时 2 层；内置插件在 `builtin/<id>/`，开发文件夹在数据目录外面时在 `dev/<id>/`。根路径和这些都无关。
  - **相对路径留作参数**：`packageDepth: true` 按已安装包的 3 层写（导出的常量 `INSTALLED_PACKAGE_DEPTH`），也可以直接写层数。写法是「产物在包里的深度 + 层数」个 `../`，`dist/island.js` 写成 `../../../../__shared/react.js`。按 URL 规则，多出来的 `..` 停在协议根上，所以 3 层对 `packages/名字/` 这种 2 层的包也对；层数算少了才会落到 `…/packages/__shared/react.js` 这类错的地址。
  - 根路径在两个系统上的真机验证由第 3 阶段地基在 E36.3.9 里做，测出问题再把默认值切回相对路径。
- **浮屿提供、但还没有转接模块的**（`react-dom`、`fuyu-plugin`、`@fuyu/plugin-base` 和不在名单里的 `react/*`）报错，不让插件自己打一份进去。
- **样式**：`import "./x.css"` 的样式由 esbuild 合并（含 `@import`），整段打进 JS。入口外面包一层：插件启用时用 `ctx.effect` 插一个 `<style data-fuyu-plugin="<插件名>">`，停用时撤掉。内核以后有了受管的样式方法就改用它。
- 图片、字体、音频按 `data:` 地址打进去。

**产物的 `package.json`**：源码清单加上 `fuyu.nodeApis` 和 `fuyu.builtWith`（这个命令行的版本），去掉只在构建时有用的字段（`scripts`、各种 `dependencies`、`overrides`、`workspaces`、`packageManager` 等，依赖已经打进 `dist/`）。构建前按 `stage: "source"` 校验源码清单，构建后按 `stage: "built"` 再校验一次。

**确定性**：同一份源码、同一版命令行和 esbuild，放在哪个文件夹里构建都得到逐字节相同的产物和 `.fuyu`（测试里在两个不同路径下各打一次比较）。为此：不出 source map、不压缩、不读作者的 `tsconfig.json`（esbuild 的 `tsconfigRaw` 固定为空）、注释里的路径都相对插件文件夹、`package.json` 按固定格式写、包由 `@fuyu/plugin-manifest` 按固定顺序和时间戳打。不同系统之间没有保证（见方案「谁来构建」），所以市场只认自己构建的包。

**声明和代码对照**（只告警，不让构建失败）：

| 告警 | 什么时候 |
|---|---|
| `undeclared-domain` | 产物里出现了 `fuyu.network` 没有的域名（用审核分析器的扫描，打进去的依赖也算） |
| `undeclared-slot` | 界面代码里 `slots.add("<名字>"` 的字面量不在 `fuyu.slots` 里 |
| `undeclared-window` | 宿主代码里 `clients.add("<窗口>"` 的字面量不在 `fuyu.client` 里 |
| `node-apis` | 源码清单自己写了 `nodeApis`，和扫描结果不同（构建会覆盖它） |
| `esbuild` | esbuild 自己的告警 |

**输出文件夹**：默认 `build/package/`，`--out` 改。只会清空空文件夹或以前构建出来的文件夹（里面的 `package.json` 带 `builtWith`），也不能是插件文件夹本身或它的上级。作者的 `.gitignore` 加一行 `build/`。

### 构建设置（`--config <文件>`）

JSON 对象，只认下面这些键，别的报错。市场构建时由市场给，不用作者仓库里的。

| 键 | 默认 | 说明 |
|---|---|---|
| `shared` | `@fuyu/plugin-base/protocol` 的 `SHARED_MODULES` | 共享模块名单：模块名对应协议根下的路径 |
| `packageDepth` | 不写 | 不写或 `false` 时共享模块写根路径 `/__shared/…`；`true` 按已安装包的 3 层写相对路径；非负整数按给的层数（包根在协议根下面几层）写相对路径 |
| `hostExternal` | `@fuyu/plugin-base/protocol` 的 `HOST_SHARED_MODULES` | 宿主部分留作外部的模块，按名字精确匹配，子路径不算 |
| `appModules` | `["react", "react-dom", "fuyu-plugin", "@fuyu/plugin-base"]` | 界面部分不许自己打进去的包 |
| `nodeTarget`、`browserTarget` | `node22`、`es2022` | esbuild 的目标 |

`--official` 允许 `@fuyu/*` 作用域（只给官方插件）。

## `pack`

先 `build`，再用 `@fuyu/plugin-manifest` 的 `packDirectory` 打包，读回来再校验一次，写到 `build/<作用域>-<名字>-<版本>.fuyu`（`--out <文件>` 改）。打印包的摘要（签名签的就是它）和整个文件的 SHA-256。`--sign` 用作者密钥加一条 `author` 签名（不改变摘要），给手动安装时显示「谁签的」用。

## `check`

不运行插件，把市场会拦的东西提前报出来：

1. 构建到临时文件夹：清单校验（`stage: "source"`）、入口、文件挑选、esbuild、声明对照，失败的都算错误。
2. 对源码和产物跑审核分析器（和首次上架一样的单版本扫描），红档的（混淆、可执行程序、原生扩展、实验接口）算错误；黄档里对作者有用的（敏感调用、没声明的域名、有依赖却没有锁文件、依赖的安装脚本、新的脚本和二进制文件）算告警。首次上架才有意义的项（「首次上架」、逐个列出锁文件里的包、全部的 Node 模块和清单字段都算「新增」）不报。

`--market` 按市场的规则查（不许 `fuyu.experimental`）；`--json` 输出 `{ ok, errors, warnings }`。有错误时退出码 1。

## `review <旧> <新>`

调 `@fuyu/plugin-review`，报告和市场 CI 贴的一样。每一边可以是：

- 文件夹：先复制一份再比较，跳过 `node_modules`、`.git` 和以前构建出来的 `build/`。
- git 提交（提交号、标签、`HEAD~1` 这类）：在 `--repo`（默认当前文件夹）里取这个提交下插件文件夹的全部文件，用 `git ls-tree` 和 `git cat-file`，不切分支、不动工作区。插件在仓库里的位置默认是 `--repo` 在仓库里的位置，`--path` 改。
- `-`：没有旧版本（首次上架），至少黄档。

`--old-built`、`--new-built` 给出构建产物一起扫；`--format markdown|json`（默认 Markdown），`--json <文件>`、`--markdown <文件>` 另外写文件。红档退出码 1。

## 密钥和签名

**密钥从哪来**，按顺序：`--key <文件>`；环境变量 `FUYU_PLUGIN_SIGNING_KEY`（PEM 原文，CI 里用；旧名 `FLY_ISLAND_PLUGIN_SIGNING_KEY` 也认）；`~/.fuyu-plugin/signing.key`（没有它而有 `~/.fly-island-plugin/signing.key` 时用后者）。和第 2 版完全一样：同一个文件、同样的格式（Ed25519 的 PKCS#8 PEM；Windows 上用 DPAPI 按当前用户加密后存 base64，其他系统存 PEM、权限 `0600`），第 2 版作者已有的密钥不用重新生成。文件里直接是 PEM 时在 Windows 上也认。

**`keygen`**：生成密钥并打印 `{ keyId, publicKey }`，填进市场提交文件的作者公钥。密钥文件已经存在时不覆盖，打印它的公钥。

**`sign [文件夹]`**：

- 取 `--commit`（默认 `HEAD`）解析成完整的提交号，读**这个提交里**的 `package.json`（不是工作区里的），按 `stage: "source"`、不许实验接口校验，有错就不签。
- `repository` 换成 `https://github.com/<所有者>/<仓库>`（市场只收 GitHub 仓库；`--repository` 可以直接给）。
- 签 `fuyu-plugin-commit/1\n<插件名>\n<版本>\n<仓库>\n<提交号>`（`@fuyu/plugin-market` 的 `signCommit`），签完用公钥验一遍，输出：

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

市场提交文件的具体写法由 E36.5.5 定，`authorSignature` 原样放进索引。`--out <文件>` 另外写一份。

**`sign <文件.fuyu>`**：给已经打好的包加或替换作者签名，原地改写（`--out` 写到别处），签完验一遍。

## 在代码里用

```js
import { build, pack, check, reviewSources, signCommitAt, loadSigningKey } from "@fuyu/plugin-cli";

const result = await build("path/to/plugin", { outDir });
const packed = await pack("path/to/plugin", { signingKey });
const { ok, errors, warnings } = await check("path/to/plugin", { allowExperimental: false });
```

构建出错时抛 `BuildError`，`issues` 是 `{ code, message, path?, file?, line?, column? }` 的列表。类型声明在 `src/index.d.mts`。

## 还没做的

- `publish`、`dev`（开发模式从文件夹加载、改了自动重载）、换密钥（第 2 版的 `keys rotate`，第 3 版用 `@fuyu/plugin-market` 的 `endorseKey`）。
- `react-dom`、`fuyu-plugin` 有了转接模块后进 `SHARED_MODULES`，build 不用改。
- 内核有了受管的样式方法后，样式改用它插入。
