# 文档索引

按文档的性质分目录。同一个领域在不同目录里用同一个名字，例如功能说明 `features/file-shelf.md` 和界面约定 `design/file-shelf.md`。

| 目录 | 放什么 | 不放什么 |
|---|---|---|
| [features/](features/) | 功能说明：怎么用、怎么接入、怎么配置（面向用户和维护者） | 设计取舍、排查过程 |
| [architecture/](architecture/) | 整体架构和对外契约：[overview](architecture/overview.md)、[contracts](architecture/contracts.md)、[data-storage](architecture/data-storage.md)、[migration-map](architecture/migration-map.md)；开发流程：[workflow](architecture/workflow.md)（多会话在本地 main 上开发、攒批开 PR 合入）；跨平台：[platforms](architecture/platforms.md)（各功能在 Windows / macOS 上的支持）、[macos-port-plan](architecture/macos-port-plan.md)（macOS 适配计划） | 单个功能的说明 |
| [architecture/agent/](architecture/agent/) | AI Agent 状态、岛上交互、会话标题的方案 | |
| [architecture/plugins/](architecture/plugins/) | 插件平台的内部设计：[v1-design](architecture/plugins/v1-design.md)（第 1 版，P1–P4）、[v2-platform](architecture/plugins/v2-platform.md)（现行，P5 起）、[author-signing](architecture/plugins/author-signing.md)、[macos-webview](architecture/plugins/macos-webview.md)（Mac 上的插件自定义网页，研究）、[v3-everything-plugin](architecture/plugins/v3-everything-plugin.md)（万物皆插件，方案）；维护：[builtins](architecture/plugins/builtins.md)（内置插件）、[market-ops](architecture/plugins/market-ops.md)（官方插件、下架名单、索引签名）、[sdk-release](architecture/plugins/sdk-release.md)（发布 npm 包） | 给插件作者看的文档（在 `plugins/`） |
| [architecture/history/](architecture/history/) | 已经做完的大计划，留作记录 | |
| [design/](design/) | 已确认的界面约定，按区域分文件（全局方向见 [design/README.md](design/README.md)） | 还没定的方案 |
| [plugins/](plugins/) | 给插件作者的对外文档（也显示在官网 fuyu.ing/docs/）：概览、快速开始、清单、岛上界面、运行与通信、权限、发布、API 参考、更新日志 | 岛屿内部实现 |
| [investigations/](investigations/) | 对**我们自己的应用**做的排查、技术验证、实测和验收 | 外部资料 |
| [research/](research/) | 对**外部**的调研：联网搜索、GitHub 项目、竞品和参考软件，规则见 [research/README.md](research/README.md) | 我们自己应用的实测 |
| [reviews/](reviews/) | PR 评审记录 | |
| [releases/](releases/) | 每个版本的发布说明 `vX.Y.Z.md`（release 脚本按这个名字读）；还没发的草稿用 `draft-` 开头 | |
| [tasks/](tasks/) | 任务，规则见 [tasks/README.md](tasks/README.md) | |
| [assets/](assets/) | 演示视频和图片；`readme/` 是仓库首页 README 用的动图和截图，怎么重出见 [video/README.md](../video/README.md#readme-里的动图和截图)；同一目录里的 `island-*.svg`（页首会展开的小岛、页尾收回去的小岛）、`download-*.svg`（下载按钮）和 `mac-guide-*.svg`（按钮下面的「Mac 安装教程」小字）由 `pnpm readme:assets`（`scripts/readme/assets.mjs`）生成，改文案、尺寸或动画改脚本再重新生成，不直接改 SVG；小岛旁的 `https://fuyu.ing` 是 Kaushan Script（SIL OFL 1.1，声明在 `THIRD_PARTY_NOTICES.md`）转成的路径，存在 `scripts/readme/address-outline.json`，字体文件不在仓库里 | |

目录之外还有一份 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)：第三方来源和按许可要求保留的声明，用到新的第三方代码或资源时在这里加一节。

新文档先按上表找目录；哪个都不合适时，先问用户，再在这张表里加一行。
