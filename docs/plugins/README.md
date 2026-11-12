# 编写浮屿插件

插件让你把想要的东西放上岛：一个列表页面、收起条上的一小段状态、一个快捷键、一条岛上提示，或者一组音效。

> 现在的插件 API 是**第 2 版**，本文档全部按第 2 版写。新插件在清单里写 `"apiVersion": 2`。第 1 版的插件照常运行，差别集中在 [运行与通信](runtime.md#第-1-版插件)。

## 插件是什么

一个插件就是一个文件夹：一份清单 `fuyu-plugin.json`，加上岛屿要启动的程序。

- **程序**：`.ps1`（Windows 自带的 PowerShell，用户不用装任何东西）、`.exe`，或者用本机 Node.js 运行的 `.js` / `.mjs` / `.cjs`。
- **通信**：岛屿启动这个程序，双方在 stdin / stdout 上按行收发 JSON-RPC 2.0 消息。任何语言都能写，只要会读写一行 JSON。
- **界面**：插件不画界面，只发数据。页面、收起条、设置页都由岛屿按模板绘制，所以和岛上其他内容风格一致。模板画不出来的（图表、小工具），可以用插件自己的网页。
- **权限**：插件只能调用清单里申请、用户同意了的接口。剪贴板、消息这类敏感数据，第一次用时还会在岛上再问一次。

只有清单、不需要程序的插件也可以，例如音效包。

## 能做什么

| 想做的 | 用什么 | 见 |
|---|---|---|
| 岛屿展开后的一个页面：列表、详情、表单、倒计时 | `contributes.views` + `view.update` | [岛上界面](ui.md#页面) |
| 自己画的页面：图表、小工具 | `webview` 模板 | [岛上界面](ui.md#自定义网页) |
| 收起条上的一小段文字、几列数字、进度环、电池 | `contributes.statusItems` + `status.update` | [岛上界面](ui.md#收起条) |
| 在岛上弹一条提示，带按钮 | `island.notify` | [岛上界面](ui.md#岛上提示) |
| 按钮、全局快捷键、待办 / 剪贴板 / 消息的右键菜单 | `contributes.commands`、`menus` | [清单](manifest.md#命令快捷键和菜单) |
| 设置项，由岛屿画在插件的设置页上 | `contributes.settings` | [清单](manifest.md#设置项) |
| 读写待办和每日笔记，订阅它们的变化 | `todos.*`、`note.*`、事件 | [API 参考](api.md#待办与每日笔记) |
| 读剪贴板历史、新消息、正在播放的音乐，控制播放 | `clipboard.*`、`messages.*`、`media.*` | [API 参考](api.md) |
| 把自己的任务报告成 AI Agent 会话 | `agentStatus.report` | [API 参考](api.md#ai-agent-状态) |
| 保存自己的数据和令牌 | `storage.*`、`secrets.*` | [运行与通信](runtime.md#存储与秘密) |
| 接收网页回调（如 OAuth 登录） | `fuyu://plugin/<id>/…` 链接 | [运行与通信](runtime.md#链接) |
| 换掉 AI Agent 的提示音 | `contributes.sounds` | [清单](manifest.md#音效包) |

做不到的：改岛的布局和样式、替换岛屿自己的页面、读邮件正文、拿到岛屿保存的凭据（邮箱授权码、翻译密钥）。

## 读哪一篇

| 文档 | 内容 |
|---|---|
| [快速开始](quickstart.md) | 用脚手架建一个插件，开发、调试、测试、打包，大约一小时 |
| [清单](manifest.md) | `fuyu-plugin.json` 的每个字段：运行方式、什么时候启动、命令、快捷键、菜单、设置项、音效包 |
| [岛上界面](ui.md) | 页面模板、自定义网页、收起条、岛上提示 |
| [运行与通信](runtime.md) | 协议、启动和停止、按需启动、事件、链接、存储、错误码、第 1 版插件 |
| [权限与安全](permissions.md) | 每个权限能做什么、敏感权限、可选权限、插件能和不能做到的事 |
| [发布](publish.md) | 只在自己电脑上用，或者放进插件市场；签名、更新和下架 |
| [API 参考](api.md) | 全部方法、事件和通知，由协议文件生成 |
| [更新日志](changelog.md) | 每个岛屿版本给插件带来了什么 |
| [和 VS Code 的对比](vscode.md) | 和 VS Code 扩展有什么相同、有什么不同 |

## 不写代码先看看

1. 在 **设置 → 插件市场** 装一个官方插件，比如「待办摘要（示例）」。它们的源码都在 [`plugins/examples/`](../../plugins/examples/)。
2. 到 **设置 → 插件扩展** 打开它，点卡片上的 **设置**：运行信息、设置项、按钮和日志就是岛屿替插件画的设置页。
3. 想自己动手，接着看 [快速开始](quickstart.md)。也可以让 AI 编程助手按你的一句话写，见 [快速开始 · 让 AI 帮你写](quickstart.md#让-ai-帮你写)。

## SDK 和工具

| 名字 | 是什么 |
|---|---|
| `create-fuyu-plugin` | 脚手架：`npm create fuyu-plugin@latest` |
| `fuyu-plugin` | Node.js SDK、命令行工具（`dev`、`test`、`validate`、`pack`、`publish`、`keygen`、`skill`）和模拟宿主 |
| [`plugins/sdk/node/fuyu.mjs`](../../plugins/sdk/node/fuyu.mjs) | 单文件 Node.js SDK，没有依赖，可以直接复制进插件 |
| [`plugins/sdk/powershell/fuyu.ps1`](../../plugins/sdk/powershell/fuyu.ps1) | 单文件 PowerShell SDK，Windows PowerShell 5.1 能用 |
| [`plugins/schema/`](../../plugins/schema/) | 协议的机器可读描述：`manifest.schema.json`（清单）和 `rpc.json`（方法、事件、权限、错误码）。岛屿的测试对照它检查，文档和它不一致时以它为准 |

SDK、脚手架和示例插件都是 MIT 许可，拿来写插件不会给你的插件带来任何许可要求。

## 内置插件

有几个可选功能直接编译在岛屿里，在 **设置 → 插件扩展** 中和普通插件一样启用、授权和设置，卡片上标着「内置」。它们不用下载，不受「允许运行第三方插件」开关限制，也不能卸载：

- 本地接口（`focusd.local-api`）：让其他程序通过 HTTP 读写待办、上报 AI Agent 状态，`fuyu-plugin dev` 也靠它。见 [本地接口](../features/local-api.md)。
- 中心图案（`focusd.center-pattern`）：收起条中间的小图案或 Codex 宠物。
- Agent 用量环（`focusd.claude-usage`）：收起条上每个 Agent 的 5 小时 / 7 天用量环。
- Agent 会话环（`focusd.session-ring`）：收起条上按状态着色的会话环。
- SSH 代理隧道（`focusd.ssh-proxy-tunnel`）：把这台电脑的代理借给 SSH 服务器。
- cc-connect 手机连接（`focusd.cc-connect`）：经 cc-connect 把提醒推送到 Telegram、Discord、飞书。

它们怎么实现、怎么新加一个，见 [内置插件](../architecture/plugins/builtins.md)。
