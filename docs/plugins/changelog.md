# SDK 更新日志

npm 包 `fuyu-plugin`（SDK、命令行工具、测试宿主）和 `create-fuyu-plugin`（脚手架）每个版本给插件作者带来了什么，最新的在最前。两个包的版本号始终相同。发布步骤见 [发布插件 SDK](../architecture/plugins/sdk-release.md)。

2026-11 之前的旧版插件用的是这两个包的 0.x，停在 0.7.0，不再更新；它的更新日志随旧版文档删掉了，旧插件改写见 [从旧版插件迁移](migrate-from-v2.md)。

## 下一版

- 新接口 `ctx.settings.open()`：打开设置窗口，落到本插件详情弹窗的「设置」标签，窗口代码和宿主代码都能调，宿主代码要在 `inject` 里写 `settings`。见 [服务、接缝与插槽参考](services-and-slots.md)「四、打开自己的设置」。
- npm 包页的 README 和 `homepage` 链到 [插件文档](README.md)（之前指向已经挪走的 `docs/plugins/v3/`）。

## 2.0.0

- 面向现在的插件发布。不用克隆浮屿仓库，`npm create fuyu-plugin@latest` 就能建一个带 TypeScript、React 和 ESLint 生命周期规则的项目。
- 按子路径导入：`fuyu-plugin`（`Context`、`Service`、`defineService` 和命令行的编程接口）、`fuyu-plugin/services`（内置服务的定义和类型，宿主和窗口代码都能用）、`fuyu-plugin/protocol`（插槽、主题变量和协议常量）、`fuyu-plugin/host`（`startHost`，在 Node 里做集成测试）。
- 命令行：`npx fuyu-plugin dev / check / pack / sign`，本地联调、按市场规则自查、打包和签名，见 [命令行](cli.md)。
