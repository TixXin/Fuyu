# SDK 更新日志

npm 包 `fuyu-plugin`（SDK、命令行工具、测试宿主）和 `create-fuyu-plugin`（脚手架）每个版本给插件作者带来了什么，最新的在最前。两个包的版本号始终相同。发布步骤见 [发布插件 SDK](../architecture/plugins/sdk-release.md)。

2026-11 之前的旧版插件用的是这两个包的 0.x，停在 0.7.0，不再更新；它的更新日志随旧版文档删掉了，旧插件改写见 [从旧版插件迁移](migrate-from-v2.md)。

## 2.1.0

- `create-fuyu-plugin` 建的新项目带一份 `AGENTS.md`：给 AI 编程代理的规则（各部分在哪运行、名字去哪查、声明要和代码对得上、停用时要撤干净、做完要报告插件读写了什么）。配套的教程见 [从零做一个插件](first-plugin.md)。
- 新接口 `ctx.island.open(page?)` 和 `ctx.island.collapse()`：打开本插件的岛页面（岛在托盘或贴边时先唤出），在本插件的页面上时收起岛。`open` 窗口代码和宿主代码都能调，宿主代码要在 `inject` 里写 `island`；`collapse` 只给窗口代码。见 [服务、接缝与插槽参考](services-and-slots.md)「五、打开自己的岛页面、收起岛」。
- 新接口 `ctx.settings.open()`：打开设置窗口，落到本插件详情弹窗的「设置」标签，窗口代码和宿主代码都能调，宿主代码要在 `inject` 里写 `settings`。见 [服务、接缝与插槽参考](services-and-slots.md)「四、打开自己的设置」。
- npm 包页的 README 和 `homepage` 链到 [插件文档](README.md)（之前指向已经挪走的 `docs/plugins/v3/`）。
- 新命令 `fuyu-plugin icon --glyph <lucide 名> --color <#rrggbb>`：按官方插件的样式写出 `assets/icon.svg`，主色和官方插件撞色时提醒；`create-fuyu-plugin` 建的新项目自带一个这样的图标。见 [命令行](cli.md#icon)。
- 新命令 `fuyu-plugin shots`：用插件带的示例数据 `shots/sample.ts` 把岛上页面和收起条渲染出来截图，并合成一张封面，要本机有 Chrome、Edge 或 Chromium。见 [截图和封面](screenshots.md)。
- 新命令 `fuyu-plugin preview`：在本地画出插件在市场卡片和详情页里的样子，深色、浅色、中英文各一份。见 [命令行](cli.md#preview)。
- `fuyu-plugin check` 多了上架信息的告警（代码以 `listing:` 开头）：没有截图、说明在市场卡片上两行放不下、说明里写了实现方式、顶层 `description` 和英文说明不一样、没有 README、README 标题或岛页标题里的名字和清单不一样。只是告警，市场不会因此拒收；`--strict` 把它们当错误。
- 市场详情页现在能渲染 README 里的表格。
- `fuyu-plugin` 的依赖多了 `react` 和 `react-dom`（`shots` 渲染组件用，插件项目自己装了就用项目里的）；包里带上了 lucide 图标数据的许可证 `LICENSE-lucide`（ISC）。

## 2.0.0

- 面向现在的插件发布。不用克隆浮屿仓库，`npm create fuyu-plugin@latest` 就能建一个带 TypeScript、React 和 ESLint 生命周期规则的项目。
- 按子路径导入：`fuyu-plugin`（`Context`、`Service`、`defineService` 和命令行的编程接口）、`fuyu-plugin/services`（内置服务的定义和类型，宿主和窗口代码都能用）、`fuyu-plugin/protocol`（插槽、主题变量和协议常量）、`fuyu-plugin/host`（`startHost`，在 Node 里做集成测试）。
- 命令行：`npx fuyu-plugin dev / check / pack / sign`，本地联调、按市场规则自查、打包和签名，见 [命令行](cli.md)。
