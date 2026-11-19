# 第 3 版插件

> 插件平台第 3 版（[#289](https://github.com/TixXin/fuyu/issues/289)）从 2026-11-18（E54）起默认开启，设 `FUYU_PLUGINS_V3=0` 可以关掉。第 5 阶段（[#295](https://github.com/TixXin/fuyu/issues/295)）已经结束，[服务、接缝与插槽](services-and-slots.md)已转正，之后只增不改；各篇顶上仍写「实验」的，是那一页还没跟上。浮屿能从市场或 `.fuyu` 文件装第三方插件，官方市场 [`TixXin/fuyu-plugins`](https://github.com/TixXin/fuyu-plugins) 已经上架了 12 个官方插件。第 2 版已于 2026-11 下线（E36.6），它的文档只留作参考：[第 2 版的文档](../README.md)。

## 第 3 版有什么不同

- **只有一种插件：完整插件。** 插件跑在浮屿里，和浮屿同权：能读你的待办、剪贴板，能读写文件、运行程序。没有权限表，也就没有「申请权限、用户同意」这一步。
- **用 TypeScript 或 JavaScript 写。** 后台逻辑在浮屿启动的一个 Node 进程（宿主）里运行，可以用 Node 的接口；界面用 React 写，放进岛屿、设置窗口上预留的位置（插槽）。插件经 `ctx` 用浮屿提供的服务，也可以提供服务、替换内置功能。
- **清单就是 `package.json`**，浮屿的字段放在 `fuyu` 下。安装包是 `.fuyu` 文件，内容是 zip，双击打开安装确认。
- **市场从源码构建。** 作者把一个提交号交给官方市场 [`TixXin/fuyu-plugins`](https://github.com/TixXin/fuyu-plugins)，市场按这个提交的源码构建出 `.fuyu`，用户装的就是市场构建的包。每个版本都要维护者批准才上架，上架 3 天后才自动更新到用户那里。
- **和第 2 版不兼容。** 第 2 版的插件在第 3 版的浮屿里不能用，要重写，见[从第 2 版迁移](migrate-from-v2.md)。

插件和浮屿同权，所以**市场的审核是唯一真正的防线**，签名、冷静期、撤销都是辅助。每一项管得住什么、管不住什么，见[市场规则](market-rules.md#每项保护管什么不管什么)。

## 读哪一篇

| 文档 | 内容 | 状态 |
|---|---|---|
| [市场规则](market-rules.md) | 上架即同意：代码、名字、开源、作者签名、换人换密钥、所有权转移、下架和撤销、报告安全问题 | 已定 |
| [审核看什么](review.md) | 绿、黄、红三档各自的条件，维护者批准，冷静期，提交前自查 | 已定，跟着审核分析器 |
| [清单和安装包](package.md) | `package.json` 的字段、`.fuyu` 包里有什么、有哪些限制、三种装法 | 已定，实验 |
| [发布](publish.md) | 签名、提交文件、市场怎么构建和上架、手动分发 | 已写，市场还没开放 |
| [命令行](cli.md) | `fuyu-plugin` 2.0：源码怎么放、开发联调（`dev`）、构建、打包、检查、比较版本、签名 | 已定 |
| [服务、接缝与插槽参考](services-and-slots.md) | 11 个公开服务、7 个扩展接缝与 14 个界面插槽的完整参考 | 已定 |
| [从第 2 版迁移](migrate-from-v2.md) | 第 2 版的插件要改什么 | 提纲 |

还没有的：概念和教程、从类型声明生成的参考；第 2 版文档的入口换成这里由 E58（[#905](https://github.com/TixXin/fuyu/issues/905)）做。

## 现在能做什么

| 事情 | 现在 |
|---|---|
| 读规则，照格式写清单 | 能 |
| 用审核分析器看自己的两个版本落在哪一档 | 能，在浮屿仓库里跑，见[审核看什么](review.md#提交前先自查) |
| 命令行 `fuyu-plugin` 2.0（`build`、`pack`、`check`、`review`、`dev`、签名） | 能，npm 上的 `fuyu-plugin` 2.0.0，见[命令行](cli.md#怎么运行) |
| 脚手架的第 3 版模板 | 能，`npm create fuyu-plugin@latest`（npm 上的 `create-fuyu-plugin` 2.0.0） |
| 向市场提交第 3 版插件 | 能，市场 CI 已在 `fuyu-plugins` 合入（[#25](https://github.com/TixXin/fuyu-plugins/pull/25)），流程见[发布](publish.md) |
| 在浮屿里安装 `.fuyu`、开发模式 | 能：从市场装，或在设置里打开手动安装后双击 `.fuyu`（见[清单和安装包](package.md)）；`fuyu-plugin dev` 把文件夹登记进浮屿，改了自动重新构建 |

## 想了解内部设计

- 方案：[v3-everything-plugin.md](../../architecture/plugins/v3-everything-plugin.md)，为什么这样设计、用户定下的决定和细则。
- 清单和包的完整规则、错误码、摘要和签名格式：[v3-package.md](../../architecture/plugins/v3-package.md)。
- 市场索引、撤销名单、冷静期和作者密钥固定的判断规则：[v3-market.md](../../architecture/plugins/v3-market.md)。
- 审核分析器：[`packages/plugin-review`](../../../packages/plugin-review/README.md)。
