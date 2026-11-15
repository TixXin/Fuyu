# 插件平台第 3 版：内置插件怎么带上、加载和关掉

任务 E36.3.6（#470），第 3 阶段地基（[计划](v3-phase3-foundation-plan.md)）。这一页定下内置插件的清单、它和数据目录的 `plugins.yml` 怎么合起来、宿主部分怎么写和打包、插件的数据目录、界面文件的地址。先读 [边界](v3-boundary.md) 和 [服务](v3-services.md)。

## 一句话

应用自带一份**内置插件清单** `builtins.json`。宿主启动时带 `--builtins <清单所在目录>`，把清单里的插件和 `plugins.yml` 合起来交给加载器：内置的默认开，代码和 `kind` 由清单定，`plugins.yml` 只能给它们记开关（`disabled`）和配置（`config`）。`kind` 只有清单能给，`plugins.yml` 里写的一律不算。

## 清单

```json
{
  "format": 1,
  "plugins": [
    { "id": "timer", "kind": "builtin", "root": "timer", "host": "host/index.mjs" }
  ]
}
```

| 字段 | 意思 |
|---|---|
| `format` | 清单的格式版本，现在是 `1` |
| `id` | 插件的 id，也是 `plugins.yml` 里给它记开关用的 id。小写字母、数字、`.`、`-`，不带 `/`（第三方插件的 `@作用域/名字` 和它撞不上） |
| `kind` | `builtin`（默认）或 `essential`。安全模式按它拦（[边界](v3-boundary.md)「安全模式」） |
| `root` | 插件的根目录，相对清单所在目录。界面文件的地址、开发版的热重载都按它算 |
| `host` | 宿主入口，相对 `root` |

- 路径只能是用 `/` 分隔、不带 `..` 的相对路径；解析成真实路径后 `root` 必须在清单目录里、`host` 必须在 `root` 里，文件要存在。不满足、`format` 不对、id 重复时宿主起不来（`fatal`）：清单随程序发布，坏了就是程序的 bug，不该悄悄少几个功能。
- 实现：`packages/plugin-base/src/host/builtins.mjs` 的 `readBuiltins`，测试 `packages/plugin-base/test/builtins.test.mjs`。

### 放在哪

| | 清单目录（`--builtins`） | 宿主入口 |
|---|---|---|
| 开发版 | 仓库的 `src/features/`，清单是 `src/features/builtins.json` | 源码，例如 `src/features/timer/host/index.mjs`，可以直接 import 同一个功能里的 `.ts` |
| 正式构建 | `src-tauri/target/plugins-v3/builtins/`（`pnpm build` 生成，不进 git），和宿主的 `src-tauri/target/plugins-v3/host/` 是同一套产物 | 打包后的单个 `.mjs`，路径和源码一样（`timer/host/index.mjs`），清单原样拷过去，只把 `.ts` 入口的扩展名换成 `.mjs` |

Rust 拉宿主时传 `--builtins`：开发版和 `build:exe` 是 `<仓库>/src/features`（和找宿主脚本一样按 `CARGO_MANIFEST_DIR`）。安装包里还没有宿主和内置插件：E36.3.15（#514）把 `src-tauri/target/plugins-v3/builtins/` 和宿主的 `plugins-v3/host/` 一起加进 `bundle.resources`（做法见 [v3-node-runtime.md](v3-node-runtime.md)「让正式构建带上它」），正式版的 Rust 改成从 `resource_dir()` 找。

## 和 `plugins.yml` 合起来

宿主不再直接用 Cordis 的 include 读 `plugins.yml`，而是用它的子类 `host/plugins-file.mjs`：读文件、监视、写回都照旧，只在把条目交给加载器之前合一次（`withBuiltins`）：

1. 清单里的每个插件按清单的顺序排在最前面：`{ id, name: <宿主入口的 file URL>, kind }`。
2. `plugins.yml` 里 id 和内置插件相同的条目，只取 `disabled` 和 `config` 合进去；它写的 `name`、`kind`、`inject` 等一律不用（不能换掉内置插件的代码）。
3. 其余条目原样跟在后面，但去掉 `kind`（分组里的条目也去掉），所以都是 `third-party`。分组里出现内置插件的 id 时那一条被丢掉并记一条警告（加载器里 id 全局唯一，留着会和内置的抢同一个条目）。
4. 只写了 `id` 和 `disabled` / `config`、又没有对应内置插件的条目（多半是程序更新后去掉了这个内置插件，留下的开关）忽略，记一条警告，不报错。

| 想做的事 | `plugins.yml` 里写 |
|---|---|
| 关掉内置的计时器 | `- id: timer`<br>`  disabled: true` |
| 给它配置 | `- id: timer`<br>`  config: { … }` |
| 恢复默认 | 删掉这一条 |

- 改了 `plugins.yml` 后照旧重读（`--watch`），关掉的内置插件撤掉它的全部副作用：服务、受管定时器、监听器、界面文件（测试「plugins.yml switches a built-in plugin off」逐项核对）。
- 运行时经加载器改条目（以后设置窗口的开关）时，include 照旧把差异写回文件：内置插件写回的只有 `id` 加改过的键，正好是上面这种开关条目。
- **没带 `--builtins` 时清单是空的**，所有插件都是 `third-party`：`plugins.yml` 写 `kind: builtin` 或 `essential` 从来不算数。[边界](v3-boundary.md)「插件状态」里「`kind` 来自 `plugins.yml` 条目」那一句要改成「来自内置插件清单」，那一页由第 3 阶段主 agent 收尾时改。
- 宿主的 `host.builtins()` 返回清单里的 `{ id, kind }`，给插件页列「全部内置插件」用（界面等插槽）。

## 内置插件的宿主部分怎么写

- 放在 `src/features/<功能>/host/`，入口是清单里的 `host`。可以写 `.mjs`（配 `.d.mts`）或 `.ts`；可以 import 同一个功能里的纯函数（计时器 import `../timers.ts`），不复制。不能 import 浏览器的东西和 `@tauri-apps/api`（宿主是 Node）。
- 用 `@fuyu/plugin-base`（以及以后的 `fuyu-plugin`）时由宿主提供同一份内核，打包时留在外面；别的依赖（`@fuyu/plugin-services` 等）打进去。插件不直接 import `cordis`。
- 数据写到 `ctx.dataDir`（见下），不要用 `ctx.baseUrl` 拼路径。
- 不在运行时按 `import.meta.url` 找别的文件（打包后只剩一个文件，构建会检查并报错）。

### 打包（`scripts/plugins-v3/build-builtins.mjs`）

```bash
node scripts/plugins-v3/build-builtins.mjs          # 输出到 src-tauri/target/plugins-v3/builtins/
node scripts/plugins-v3/build-builtins.mjs --minify --out <目录> --source <清单目录>
```

- 用 Vite 自带的 esbuild（和 `bundle-host.mjs` 同一个），每个内置插件的宿主入口连同它 import 的 `.ts` 打成一个 `.mjs`：ESM、`platform: node`、目标 Node 22.15、带 `createRequire` 的 banner，`@fuyu/plugin-base`、`fuyu-plugin` 留在外面。为什么要打包：`engines` 是 `>=22.15`，Node 22.15–22.17 不会自己去掉类型，加载不了 `.ts`。
- 先写到旁边的临时目录，再换掉旧的输出目录（几个会话同时 `pnpm build` 时不会读到写了一半的目录）。
- 接进了 `pnpm build`（`tsc && vite build && node scripts/plugins-v3/build-builtins.mjs`）。计时器一个插件约 11 KB、0.15 秒。
- 测试 `tests/scripts/plugins-v3-build-builtins.test.mjs`：产物里没有 `.ts` 的 import；用 `--no-experimental-strip-types`（相当于不会去类型的 Node）跑宿主，带打包产物时计时器 `running`，带源码时 `failed` 并写明是 `.ts`。

## 开发版的热重载

- 宿主带 `--dev` 时，Cordis 的 hmr 照旧监视数据目录（`plugins-v3/`），但**不再监视 `data/`**（插件的数据文件写一次就让它空跑一次比对，见 E36.3.5 的约定）。
- 另外监视清单里每个内置插件的 `root`（开发版就是 `src/features/<功能>/`），改了就交给 hmr 换代码：改 `timers.ts` 计时器插件跟着重载，宿主不重启。
- 测试 `packages/plugin-base/test/builtins-dev.test.mjs`：改内置插件 import 的文件后它重载；改 `data/` 下的文件不重载。

## 插件的数据目录（`ctx.dataDir`）

- 每个插件的 `ctx.dataDir` 是 `plugins-v3/data/<插件 id>/` 的绝对路径（宿主 `startHost` 的 `dataDir` 可以换掉 `plugins-v3/data/` 这个根）。和 `ctx.services` 一样是内核挂在根上下文的访问器，按读它的那个插件算，插件里再建的子插件拿到的也是这个插件的目录。
- 宿主不建目录，插件写之前自己 `mkdir`（计时器的 `writeTimers` 已经这样做）。
- id 要能当目录名：一段（字母、数字、`.`、`-`、`_`、`@`，不以 `.` 开头或结尾）或 `@作用域/名字` 两段；`../x`、`a/b`、三段的都拒绝（读 `ctx.dataDir` 时抛错）。第三方插件的数据目录因此是 `data/@作用域/名字/`，和 [插件包](../../plugins/v3/package.md)「name 也是数据目录的名字」一致。
- 计时器改用它：数据文件还是 `plugins-v3/data/timer/timers.json`，位置没变，不用迁移。
- 宿主停了、插件被关了，数据目录留着；卸载插件时删不删由第 5 阶段的安装流程定。

## 界面文件的地址

窗口按 `fuyu-plugin://localhost/<路径>`（Windows 上是 `http://fuyu-plugin.localhost/<路径>`）加载插件的界面文件，`<路径>` 是宿主登记的 `ClientEntry.path`。地址空间这样分：

| 路径 | 对应 | 状态 |
|---|---|---|
| `__shared/react.js`、`__shared/react-jsx-runtime.js` | 程序自带的转接模块（`protocol` 的 `SHARED_MODULES`） | 已有 |
| `builtin/<id>/<相对 root 的路径>` | 内置插件 `<id>` 的 `root` 下的文件 | **宿主已按这个登记**（`ctx.clients.add` 收到 `root` 里的文件时）；Rust 一侧的映射（读同一份清单，按 id 找 `root`，解析后不出 `root`）等插槽接入内置插件的界面时做 |
| 其余 | 数据目录 `plugins-v3/` 下的文件（第三方插件、开发文件夹的插件；已安装包的位置由 E36.3.9 定） | 已有 |

- `builtin/` 不会和数据目录里的东西撞：数据目录里没有叫 `builtin` 的东西，以后安装包也不放在那个名字下。
- 包根在地址里的层数：内置插件是 `builtin/<id>/`，2 层。共享模块已改用根路径 `/__shared/react.js`（E36.5.4），层数不再影响它。
- 开发版的内置插件界面是 TSX 源码，浏览器不能直接加载：到时由 Vite 提供（或开发版也先打包），这一点等插槽接入时定。
- 现在 `fuyu-plugin://localhost/` 会把 `plugins-v3/` 下的任何文件给窗口，包括 `data/` 和 `plugins.yml`。同权模型下宿主插件本来就能读这些，所以不算新的口子，但窗口用不着它们，建议 Rust 那边不提供 `data/`（第 2 阶段 / Rust 的事，记在任务里）。

## 还要别处跟着改的

| 文件 | 改什么 | 谁 |
|---|---|---|
| `v3-boundary.md`「插件状态」 | `kind` 来自内置插件清单，不是 `plugins.yml` | 第 3 阶段主 agent（E36.2.3 合入后） |
| `contracts.md` 第 3 版那一条 | 内置插件清单的位置和格式、`plugins.yml` 里内置插件只记 `disabled` / `config`、`data/<id>/` | 同上 |
| `data-storage.md` | `plugins-v3/data/<插件 id>/` | 同上（C80 在改它） |
| `src/AGENTS.md` | `features/<功能>/host/` 的规则（上面「宿主部分怎么写」）；`src/features/builtins.json` | 同上 |
| lint | `host/` 里不能 import 浏览器的东西和 `@tauri-apps/api`（计划第 3 条） | 没做，另开任务 |
