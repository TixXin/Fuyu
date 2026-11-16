# 上游 fly-island 的插件系统和第 3 版的区别

> 日期：2026-11-16。问题：上游仓库 flyl1u/fly-island 也做了插件系统，它和我们正在做的插件平台第 3 版（万物皆插件）有什么区别。范围：上游 `main` 分支的 [docs/architecture/plugins.md](https://github.com/flyl1u/fly-island/blob/main/docs/architecture/plugins.md)、[docs/plugins/api.md](https://github.com/flyl1u/fly-island/blob/main/docs/plugins/api.md)、`plugins/` 目录、`src-tauri/src/plugin_host/` 的提交记录（`gh api`）；本仓库的 [v3-everything-plugin.md](../architecture/plugins/v3-everything-plugin.md)。相关任务：E36。

## 结论

- **两者不是一类东西。** 上游做的是「数据源插件」：插件是一个独立的 `.exe`，只能往岛上已有的三个位置送数据：额度环、Agent 会话列表、消息通知。岛怎么画、有哪些功能，插件改不了。第 3 版是「万物皆插件」：岛上的每个内置功能本身就是插件，插件能提供或替换服务、往界面插槽里加东西，和浮屿同权。
- **上游的做法接近我们的第 1 版，比第 2 版还窄。** 我们第 2 版已经能在岛上显示插件页面、有事件、命令、快捷键、激活事件和签名市场；上游现在只有三个扩展点，插件不能调用宿主。
- **上游刚起步。** 插件平台 2026-11-15 才合入，2026-11-16 又在发布里「暂时隐藏插件」（提交标题，未核实原因）。现在只有 8 个插件，都在它自己的仓库里：7 个额度 / 会话插件（豆包、Gemini、Grok、Hermes、Kimi、ZCode 和示例），1 个企业微信 / 钉钉 / 飞书提醒。
- **对我们有用的地方不多，可以参考它支持了哪些家。** 豆包、Kimi、ZCode、企业 IM 这几家的接法，等第 3 版出来后可以作为第三方插件的题目，或者给 AI Agent 总控做用量环（B25）时参考，不需要照搬它的平台设计。仓库 2026-11-10 起已脱离上游的 fork 网络，不同步代码（见 [workflow.md](../architecture/workflow.md)「外部 PR」）。

## 详细

| | 上游 fly-island 插件 API v1 | 浮屿插件平台第 3 版 |
|---|---|---|
| 目标 | 让第三方补额度、会话、通知的数据来源 | 内置功能和第三方插件用同一套接口，什么都能改（决定 1） |
| 插件是什么 | 独立的 Windows `.exe`（示例和官方插件用 Rust 写，配一个 Rust SDK） | JS / TS 模块，跑在浮屿启动的一个 Node 宿主进程里，内核用 Cordis（决定 3、4） |
| 和岛怎么通信 | stdin / stdout 按行 JSON-RPC。宿主发 `initialize`、`action`、`shutdown`，插件发 `publish` 推一份完整快照，**插件不能调用宿主** | 插件通过 `ctx.<服务>` 用能力，服务可以被别的插件替换；界面通过各窗口里的客户端和插槽 |
| 能扩展什么 | 只有三项：`quota`（最多 32 条）、`sessions`（200 条）、`notifications`（100 条），外加设置项和动作按钮 | 服务、插槽（岛的展开页、设置分节等）、事件、命令；内置的待办、音乐、Agent 状态等都要改成插件 |
| 界面 | 插件不画界面，由岛用已有组件显示 | 插件可以往界面插槽里放自己的组件 |
| 权限 | 清单里声明权限（`network`、`sessions` 等），文档写明只是声明、不算沙箱 | 不设权限表，插件和浮屿同权（决定 2），安全靠市场审查 |
| 运行和出错 | 每个插件一个进程，Job Object 管进程树；挂了按 1–32 秒退避重启，最多 6 次；改设置就重启插件 | 所有插件在一个 Node 宿主里，副作用都能撤销，可以随时开关和热重载；有资源监控 |
| 秘密 | `secret` 类型设置存 Windows 凭据管理器，启动时连同其他设置一起发给插件 | 有专门的秘密服务（[v3-secrets.md](../architecture/plugins/v3-secrets.md)） |
| 分发和信任 | 索引和 zip 放在上游 GitHub Release，只校验 SHA-256，**没有签名**，信任根是维护者和 HTTPS | 官方市场 `TixXin/fuyu-plugins`：每个版本都审、市场 CI 从源码构建、作者签提交号、更新冷静期 3 天，包的后缀是 `.fuyu`（决定 7–10、14） |
| 平台 | 只有 Windows（`.exe`、Job Object、`CREATE_NO_WINDOW`） | Windows 和 macOS |
| 和旧版本的关系 | 第一版 | 不兼容我们第 2 版（决定 5） |

## 来源

- 上游仓库信息和文件列表：`gh api repos/flyl1u/fly-island`、`gh api repos/flyl1u/fly-island/git/trees/HEAD?recursive=1`，2026-11-16。
- [上游插件宿主说明](https://github.com/flyl1u/fly-island/blob/main/docs/architecture/plugins.md)、[上游插件 API v1](https://github.com/flyl1u/fly-island/blob/main/docs/plugins/api.md)，2026-11-16 读取。
- 上游 `src-tauri/src/plugin_host` 的提交记录：`feat(plugins): 插件平台核心与 API v1 支持`（2026-11-15）到 `feat(发布): 暂时隐藏插件与邮箱验证码`（2026-11-16）。
- 第 3 版：[v3-everything-plugin.md](../architecture/plugins/v3-everything-plugin.md)「已经定下的」；第 2 版：[v2-platform.md](../architecture/plugins/v2-platform.md)。
