# Piral：插槽能复用多少

> 日期：2026-11-15。问题：插件平台第 3 版第 2 阶段「插槽化」开工前，看微前端框架 Piral 的扩展插槽（extension slot）、pilet 加载、共享依赖、错误边界能复用多少，和第 1 阶段的 `createSlots` 逐项对比，判断 [第 2 阶段计划](../architecture/plugins/v3-phase2-plan.md)「关键设计」要不要改。范围：Piral 官方文档（docs.piral.io 的源文件，即仓库 `docs/` 下的 Markdown）、GitHub `smapiot/piral` 的源码（`main` 分支 `afae61d`，2026-11-15 浅克隆，读了 `piral-core` 的 `ExtensionSlot`、`ErrorBoundary`、`withApi`、`wrapComponent`、`modules/core`、`utils/state`、`types/extension`，`piral-base` 的加载与共享依赖，`piral-menu` 的注册）；npm 上 `piral-core` / `piral-base` 1.12.5 的包信息；本机用 esbuild 量了 `piral-core` 的体积。相关任务：E36.2.1（#424），父任务 E36.2（#292）。

## 结论

**不用 Piral 的代码，第 2 阶段「关键设计」不用改。** 借三处小思路，都在 E36.2.3 的范围里，不动设计。

- **不能直接用**：
  - `piral-core` 不是一个能单独拿来用的插槽库。它要配 Piral 自己的构建：源码里 `import … from '../app.codegen'`，这个模块是构建时按 `piral.json` 和环境变量生成代码的，普通的 Vite / esbuild 直接打包会报错，要装它的代码生成插件。
  - 它要一整套 app shell：`createInstance` 建的实例、zustand 存的全局状态、`<Piral>` 外壳和路由（react-router v5–v8）。`<ExtensionSlot>` 从 React context 里读全局状态，离开 `<Piral>` 就用不了。
  - 浮屿是多窗口，每个窗口一个注册表，还要求首帧同步就有内置项。Piral 是单页应用加一个全局 store 的模型，要每个窗口起一个实例。
- **规则对不上**：我们方案要的七条规则，Piral 的插槽只有「出错隔离」一条现成：
  - 扩展**没有 id**，按组件引用（`reference`）登记和撤销，所以没有「同 id 替换」，也没有「谁替换了谁」；
  - 没有每插件上限，没有单个 / 列表之分，没有「最多显示几个」；
  - 插槽不用声明，往任何名字注册都行，渲染时没人注册就是空的，和我们「没声明的不生效、启动就失败」正相反；
  - 顺序不是登记项的属性，是渲染处传 `order(extensions)` 函数自己排；
  - 名字不带版本，只靠约定。
- **体积**：`piral-core` 加 `piral-base`、zustand，不算 React 和路由，构建时生成的部分换成空实现，压缩后约 46 KB、gzip 约 16.7 KB。我们的 `slots.mjs` 加 `react.mjs` 一共约 4 KB（未压缩）。为了用一个不合规则的插槽，多引一个全局 store 和它的构建流程，不划算。
- **许可证不是障碍**：MIT，项目活跃。2026-11-15 查：约 1941 star，最新版 1.12.5（2026-11-05），当天还有提交。
- **React 19**：仓库自己开发和测试用 React 18，`piral-core` 没写 `peerDependencies`；更新日志里 1.8.3 修过 `piral-component` 在 React 19 下的问题。整套在 React 19 下能不能用**未核实**。
- **加载和共享依赖**：我们第 1 阶段已经有自己的做法，而且更贴合 Tauri：
  - 加载：`fuyu-plugin://` 加 `HEAD` 检查再 `import()`，由宿主按窗口下发；
  - 共享依赖：`__FUYU_SHARED__` 加改写 `react` 的引用路径。
  - Piral 那套（供给服务 feed、SystemJS、importmap、按 semver 挑共享包的版本）是给「从网上的服务拉很多团队的前端模块」用的，我们用不上。

**借的思路**（写给 E36.2.3，属于实现细节，不改「关键设计」）：

1. **出错时带上插件名并发事件**：Piral 的错误边界会打 `[<pilet>] Exception in component of type "<类型>"` 的日志，再异步发一个 `unhandled-error` 事件（带类型、错误、pilet 名），外壳可以统一处理。我们内置项出错时 `console.error`，建议日志里带上插槽名和 `owner`，`SlotItems` 的 `onError` 也照这个形状给出，第 3 阶段做插件页的出错统计时直接接上。
2. **React key 不要用下标**：Piral 用 `组件名 + 下标` 做 key，顺序一变组件就重新挂载。我们的 `owner:id:seq` 是对的，E36.2.3 拆模块时保留，内置项不加包裹层时也用同样的 key。
3. **类型化的插槽表**：Piral 用 TypeScript 的接口合并（`PiralCustomExtensionSlotMap`）让「插槽名 → 参数类型」可以由各处补充。计划里的 `defineSlot<Props, Meta>` 是同一个意思，照做即可。

不用另外通知主 agent 改设计：结论是维持现有设计。

## 详细

### Piral 的扩展插槽怎么做

| 方面 | Piral 的做法（`piral-core` 1.12.5） |
|---|---|
| 注册 | `api.registerExtension(name, component, defaults?)`，返回撤销函数；也可以 `api.unregisterExtension(name, component)`。登记项是 `{ pilet, component（包过一层的）, reference（原组件）, defaults }`，追加到全局状态 `registry.extensions[name]` 的数组末尾 |
| 撤销 | 按 `reference === component` 过滤掉。同一个组件注册两次就是两项，撤一次两项都没了 |
| 渲染 | `<ExtensionSlot name params empty emptySkipsRender order render children />`（pilet 里是 `piral.Extension`）。每项渲染成 `<Component params={{ ...defaults, ...params }} children={children} />`，key 是 `组件名 + 下标` |
| 参数 | 渲染处给的 `params` 和登记时的 `defaults` 合并后传给组件，`params` 优先。文档的「目录总览」用法里，渲染处的 `render` 从节点上读 `defaults`（例如标题、描述）自己排版 |
| 空状态 | `empty(params)`：没有登记项时渲染它。默认还会把它交给 `render` 包一层；`emptySkipsRender: true` 时直接返回。**没有 `renderEmpty` 这个名字**：任务里写的 `renderEmpty` 在源码和文档里都搜不到，对应的是 `empty` 加 `emptySkipsRender` |
| 排序 | `order(extensions) => extensions`，默认按注册先后。由渲染处决定，登记项本身没有顺序字段 |
| 包装 | `render(nodes)`：拿到全部节点自己决定怎么摆（例如包进列表、只取第一个、做成卡片）。另外外壳可以 `registerWrapper('*' 或类型, Wrapper)`，给所有扩展或某类扩展外面再包一层 |
| 插槽声明 | 不需要声明。任何名字都能注册和渲染 |
| 名字和类型 | 名字是任意字符串；类型靠 `PiralCustomExtensionSlotMap` 接口合并补充 |
| 出错隔离 | 每个登记的组件经 `withApi` 包上「外壳的包装 → `ErrorBoundary` → `Suspense`」。出错时打日志、发 `unhandled-error` 事件、渲染按错误类型注册的错误组件（默认的错误组件本身也是一个名叫 `error` 的扩展插槽）；加载中显示注册的 `LoadingIndicator` |
| 外壳自己的扩展 | 外壳可以用 `withRootExtension` 不经 pilet API 注册，`pilet` 记为空字符串 |
| 菜单之类 | `piral-menu` 等插件按 `pilet 名 + 名字` 做 id 登记，所以不同 pilet 之间不能互相替换 |

### pilet 加载、共享依赖

- **加载**（`piral-base`）：从供给服务（feed）拿 pilet 列表，按格式（v0–v3、bundle、Module Federation）用 SystemJS 或 `import()` 执行，再调 pilet 的 `setup(api)`。有几种加载策略：`blazing`、`async`、`standard`、`sync`，以及 `createDeferredStrategy` 等某个条件满足后再加载。
- **共享依赖**：
  - 外壳在 `package.json` 的 `importmap` 里声明要共享的包，也可以从别的包继承：继承 `piral-base` 得到 `tslib`，继承 `piral-core` 得到 `react`、`react-dom`、`react-router`、`react-router-dom`。
  - 也可以在 `createInstance({ shareDependencies })` 里用代码写。
  - pilet 自己也能声明 importmap，SystemJS 的注册表里按 `包名@版本` 记，按 semver 挑已加载的版本。
  - 官方文档自己也提醒「不要共享太多」。
- **离开 Piral 能不能用**：`piral-base` 不依赖界面框架（文档「Core and Base」），压缩后 gzip 约 10–14 KB，但它解决的是「从网上服务拉模块」，我们已经有更简单的本地版本。

### 和 `createSlots` 逐项对比

按方案「插槽的规则」七条，加上计划里另外要的几项：

| 规则 | 我们（`createSlots` + 计划的 E36.2.3） | Piral | 怎么办 |
|---|---|---|---|
| 数量 | 定义里写 `list` / `single`、`max` | 无，`render` 里自己截 | 维持 |
| 顺序 | 登记项带 `order`，同值按登记先后；用户的布局设置覆盖 | 渲染处传 `order` 函数 | 维持。Piral 的做法让每个渲染处各排各的，没法统一给用户调 |
| 替换 | 同 `id` 替换，记 `replaces`，撤掉时恢复原项 | 没有 id，不能替换 | 维持 |
| 每插件上限 | `perPlugin` | 无 | 维持 |
| 名字带版本 | `island.page/v1`，E36.2.3 起强制 `/vN` | 无，靠约定 | 维持 |
| 出错隔离 | 每项错误边界 + `Suspense`，出错只撤这一项 | 每项错误边界 + `Suspense`，出错显示错误组件并发事件 | 维持，借「带插件名、发事件」（结论第 1 条） |
| 没声明的插槽 | 抛 `no-slot`，插件启动失败 | 随便注册，不报错 | 维持 |
| 元数据 | 计划：插槽定义写明字段，宿主读来排版（图标、快捷键、宽度、启用判断……） | `defaults` 合进组件的 `params`，渲染处的 `render` 从节点上读 | 维持。宿主要在渲染前就读到元数据（页头圆点、快捷键、设置搜索索引），比 Piral 从节点上读更直接 |
| 组件拿到的参数 | 宿主窗口把一包 props 传给组件 | `params` + `children` + `piral`（pilet API） | 维持。我们的组件不拿插件 API，第三方插件在 `ctx` 里拿 |
| 空状态 | 计划没提 | `empty` / `emptySkipsRender` | 不加。现在要插槽化的界面都没有「空了显示别的」：刘海提醒没内容就不显示，设置分节总有内置项 |
| 渲染包装 | 计划：内置项平铺、第三方项包 `.plugin-slot` | `render(nodes)` + `registerWrapper` | 维持。我们按拥有者决定包不包，和 Piral 按类型包是同一类办法 |
| 多窗口 | 每个窗口一个注册表，模块加载时同步建 | 一个实例一个全局 store，单页应用 | 维持 |
| 首帧同步 | 内置项同步副作用 import，首帧就有 | 外壳可同步注册，但要先建好实例 | 维持 |
| 依赖 | 纯 JS，E36.2.3 起不 import Cordis | zustand、路由、构建时生成代码 | 维持 |

### 体积怎么量的

在临时目录装 `piral-core@1.12.5`（带上 `piral-base`、`zustand`），入口只导出 `createInstance`、`Piral`、`ExtensionSlot`。用本仓库的 esbuild 0.28.1 打包，参数是 `--bundle --minify --format=esm`，`react`、`react-dom`、`react-router`、`react-router-dom` 设成外部依赖。`app.codegen` 换成空实现，不然打包失败。结果是 46,401 字节，gzip 后 16,747 字节。真用的时候还要加上生成出来的代码和路由，只会更大。临时目录在本机的会话草稿区，没有进仓库。

## 来源

1. Piral 仓库：https://github.com/smapiot/piral（2026-11-15 查：MIT，约 1941 star，`main` 最新提交 `afae61d`，当天）
2. `ExtensionSlot` 源码：https://github.com/smapiot/piral/blob/main/src/framework/piral-core/src/components/ExtensionSlot.tsx
3. 插槽的属性类型（`empty`、`emptySkipsRender`、`order`、`render`、`params`）：https://github.com/smapiot/piral/blob/main/src/framework/piral-core/src/types/extension.ts
4. `registerExtension` / `unregisterExtension`：https://github.com/smapiot/piral/blob/main/src/framework/piral-core/src/modules/core.ts ，状态更新在 https://github.com/smapiot/piral/blob/main/src/framework/piral-core/src/utils/state.ts
5. 错误边界和包装：https://github.com/smapiot/piral/blob/main/src/framework/piral-core/src/components/ErrorBoundary.tsx 、https://github.com/smapiot/piral/blob/main/src/framework/piral-core/src/state/withApi.tsx
6. 扩展的用法：https://github.com/smapiot/piral/blob/main/docs/tutorials/24-extension-patterns.md
7. 共享依赖：https://github.com/smapiot/piral/blob/main/docs/tutorials/15-share-dependencies.md ，importmap：https://github.com/smapiot/piral/blob/main/docs/concepts/I08-importmap.md
8. Core 和 Base 两个包的分工：https://github.com/smapiot/piral/blob/main/docs/tutorials/22-core-and-base.md
9. pilet 的生命周期：https://github.com/smapiot/piral/blob/main/docs/concepts/I07-pilet-lifecycle.md
10. 加载策略：https://github.com/smapiot/piral/blob/main/src/framework/piral-base/src/strategies.ts
11. 更新日志（React 19 的修复在 1.8.3）：https://github.com/smapiot/piral/blob/main/CHANGELOG.md
12. npm：https://www.npmjs.com/package/piral-core 、https://www.npmjs.com/package/piral-base （1.12.5，2026-11-15 查）
13. 之前的调研里对 Piral 的一句话评价：[tauri-plugin-base-prior-art.md](tauri-plugin-base-prior-art.md)
