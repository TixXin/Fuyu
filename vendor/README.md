# vendor

拷进仓库的第三方代码。这里的文件不受仓库的行数上限和「不写注释」的约束，`pnpm check:size`、ESLint 都不扫这里。改这里的代码要在本文件的「本地改动」里记一行。

## cordis

插件平台第 3 版的内核（方案 [v3-everything-plugin.md](../docs/architecture/plugins/v3-everything-plugin.md) 决定 3）。拷的是 npm 上发布的构建产物（`lib/` 下的 JS 和类型声明），不是源码，所以这里不需要构建。插件不直接用这些包，经 `packages/plugin-base` 包一层（方案「核心概念」）。

| 目录 | npm 包 | 版本 | npm 的 integrity |
|---|---|---|---|
| `cordis/core` | `cordis` | 4.0.0-rc.13 | `sha512-rYsquBfrd1U8HuaDr/1TYpdnHiuy5X2oEWJbfEveIZwysfjg3vTXJWKvTPlaPtt2VeFsAJIrzHZnymONyOr3PA==` |
| `cordis/loader` | `@cordisjs/loader` | 1.0.0-rc.10 | `sha512-SdTENuAe1QoK0iORpk4KWuAX/mWvQEnu57XVdF/RMDmMCyMl4Wu3PlFpXy8/Rttzy7O18g0xg2egWJ1yLGOZGA==` |
| `cordis/hmr` | `@cordisjs/hmr` | 2.0.0-rc.0 | `sha512-DlRldaFRvAf5AcFbqaBkswXXgyzywJ739VahkbfAtAlFBIMgluxqOdV2PjMHDPcIZ/f9DTsiIe6ev25wr3ee8Q==` |
| `cordis/include` | `@cordisjs/include` | 2.0.0-rc.0 | `sha512-8R6LCm4AG+PWKZxIvBibT7kYIp4xukKTWDD1oXC1eSf5brB17s5Z1wKKXaq2L1r2VSTxtK3WJ0VB2A9Y52Kgdw==` |
| `cordis/fs` | `@cordisjs/fs` | 2.0.0-rc.0 | `sha512-Te+XWBnMbjOId3PZYCnzgV5KylTSa+MB1FP9pMYV8UEwXOd3GAX5QrDCulGcoiyrGfWC/QZK0Hn68FVR7IJ3bw==` |
| `cordis/fs-node` | `@cordisjs/fs-node` | 0.1.0 | `sha512-+RjwvBl/qe2L+fnY7PlHbETuyxI663bzTINyQ9V6nj1aCuCiGjldwyDTmVd82m628EUT99PjHGCadLHZEVPMeQ==` |

- 上游：[cordiverse/cordis](https://github.com/cordiverse/cordis)，6 个包都是从提交 `bc9fae7a92de7f74417e54eaf3decdecf71f937a`（2026-11-12，`chore: bump versions (#322)`）发布的。
- 许可证：MIT，`LICENSE` 是上游这个提交的原文（npm 包里没带，从仓库取的），每个包的目录里各放了一份。
- 它们依赖的 `cosmokit`、`yaml`、`schemastery`、`chokidar` 等照常从 npm 装，版本由 `pnpm-lock.yaml` 固定。

### 本地改动

| 文件 | 改了什么 | 为什么 |
|---|---|---|
| `cordis/loader/lib/index.js` | 求值配置表达式用的 `new Function` 从模块顶层改成第一次用到时才建（6 行） | 宿主带 `--disallow-code-generation-from-strings` 启动时，原来的写法让整个加载器 `import` 就失败。改了之后配置里不能写表达式（浮屿不用），其余照常。第 0 阶段两个系统都实测过（[报告](../docs/investigations/v3-feasibility.md)第 1 项） |
| `cordis/core/lib/index.js` | `emit` 逐个调用监听器时各自 `try/catch`：一个监听器抛错，记到它所属插件的日志里，同一事件后面的监听器照常执行，错误不抛给发事件的一方。`internal/` 开头的内核事件照旧抛出 | 通知类事件不该因为一个插件出错就让别的插件收不到（第 1 阶段的保证清单，`packages/plugin-base/test/guarantees-errors.test.mjs`）。`parallel`、`serial`、`bail`、`waterfall` 没改：它们的调用方要拿结果，出错该让调用方知道 |
| `cordis/core/package.json`、`cordis/core/bin.js` | 删掉 `bin` 和它指向的 `bin.js` | 那是 Cordis 自己的命令行入口，浮屿不用，留着会让 pnpm 装一个 `cordis` 命令 |

### 升级

从 npm 下载新版本的包（`npm pack <包>@<版本>`），核对 integrity，整个目录替换掉，再把上面的本地改动重新打一遍，更新这张表。升级前后都跑 `pnpm test`：`packages/plugin-base/test/` 里的保证清单就是用来发现 Cordis 的行为变化的。
