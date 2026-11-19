# 浮屿插件

> 插件从 2026-11-18（E54）起默认开启，设环境变量 `FUYU_PLUGINS_V3=0` 可以关掉。[服务、接缝与插槽](services-and-slots.md)、清单和包的格式已经转正，之后只增不改。浮屿能从市场或 `.fuyu` 文件装第三方插件，官方市场 [`TixXin/fuyu-plugins`](https://github.com/TixXin/fuyu-plugins) 已经上架了 12 个官方插件。2026-11 之前的旧版插件（清单是 `fuyu-plugin.json` 的那一套）已经下线，旧插件要重写，见[从旧版插件迁移](migrate-from-v2.md)。

## 插件是什么样的

- **只有一种插件：完整插件。** 插件跑在浮屿里，和浮屿同权：能读你的待办、剪贴板，能读写文件、运行程序。没有权限表，也就没有「申请权限、用户同意」这一步。
- **用 TypeScript 或 JavaScript 写。** 后台逻辑在浮屿启动的一个 Node 进程（宿主）里运行，可以用 Node 的接口；界面用 React 写，放进岛屿、设置窗口上预留的位置（插槽）。插件经 `ctx` 用浮屿提供的服务，也可以提供服务、替换内置功能。
- **清单就是 `package.json`**，浮屿的字段放在 `fuyu` 下。安装包是 `.fuyu` 文件，内容是 zip，双击打开安装确认。
- **市场从源码构建。** 作者把一个提交号交给官方市场 [`TixXin/fuyu-plugins`](https://github.com/TixXin/fuyu-plugins)，市场按这个提交的源码构建出 `.fuyu`，用户装的就是市场构建的包。每个版本都要维护者批准才上架，上架 3 天后才自动更新到用户那里。

插件和浮屿同权，所以**市场的审核是唯一真正的防线**，签名、冷静期、撤销都是辅助。每一项管得住什么、管不住什么，见[市场规则](market-rules.md#每项保护管什么不管什么)。

## 开始写

```bash
npm create fuyu-plugin@latest
```

脚手架（npm 上的 `create-fuyu-plugin`）生成一个 TypeScript 项目，命令行 `fuyu-plugin`（npm 上的 `fuyu-plugin`）负责开发联调、构建、打包、检查和签名。开发时在插件文件夹里跑 `fuyu-plugin dev`，它把插件登记进正在运行的浮屿，改了自动重新构建，见[命令行](cli.md)。

## 读哪一篇

| 文档 | 内容 |
|---|---|
| [清单和安装包](package.md) | `package.json` 的字段、`.fuyu` 包里有什么、有哪些限制、三种装法 |
| [命令行](cli.md) | `fuyu-plugin`：源码怎么放、开发联调（`dev`）、构建、打包、检查、比较版本、签名 |
| [服务、接缝与插槽参考](services-and-slots.md) | 公开服务、扩展接缝与界面插槽的完整参考 |
| [发布](publish.md) | 签名、提交文件、市场怎么构建和上架、手动分发 |
| [市场规则](market-rules.md) | 上架即同意：代码、名字、开源、作者签名、换人换密钥、所有权转移、下架和撤销、报告安全问题 |
| [审核看什么](review.md) | 绿、黄、红三档各自的条件，维护者批准，冷静期，提交前自查 |
| [从旧版插件迁移](migrate-from-v2.md) | 2026-11 下线的旧版插件要改什么 |
| [官方插件标准](official-quality.md) | 官方插件上架前要做到的：设置齐全、岛上默认克制、中英文和两个平台、名字统一 |
| [SDK 更新日志](changelog.md) | npm 包 `fuyu-plugin`、`create-fuyu-plugin` 每个版本的变化 |

还没有的：从零做一个插件的教程、从类型声明生成的参考。

## 想了解内部设计

- [方案：万物皆插件](../architecture/plugins/v3-everything-plugin.md)：为什么这样设计、用户定下的决定和细则。
- [包格式](../architecture/plugins/v3-package.md)：清单和包的完整规则、错误码、摘要和签名格式。
- [市场](../architecture/plugins/v3-market.md)：市场索引、撤销名单、冷静期和作者密钥固定的判断规则。
- 审核分析器：[`packages/plugin-review`](../../packages/plugin-review/README.md)。
- 编译在浮屿里、能单独开关的内置插件：[builtins.md](../architecture/plugins/builtins.md)。
