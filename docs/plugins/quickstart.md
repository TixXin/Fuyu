# 快速开始

本文带你从零做出一个浮屿插件：建项目、在岛上看到效果、调试、测试、打包，大约一小时。

## 准备

- 浮屿 0.3.0 或更新的版本。
- Node.js 20 或更新版本。写 TypeScript / JavaScript 插件要用它运行；写 PowerShell 插件，插件本身用 Windows 自带的 PowerShell 5.1 运行，但脚手架和命令行工具仍然需要 Node.js。
- 在岛屿的 **设置 → 插件扩展** 里：
  1. 打开内置插件 **本地接口** 和它的 **允许修改**。命令行工具通过它让岛屿加载你的插件。
  2. 展开页面底部的 **开发者**，打开 **开发模式**。开发模式不保存，岛屿重启后要重新打开；加载过的文件夹会列在「最近加载过的」里，点一下就能再加载。用 `pnpm tauri dev` 跑的开发版岛屿启动时自动打开开发模式，重新加载上次没有移除的插件，以及环境变量 `FUYU_DEV_PLUGINS` 列出的文件夹（分号分隔，相对路径从仓库根目录算，例如 `FUYU_DEV_PLUGINS=plugins/drafts/dev.focusd.window-demo`）。也可以点「选择文件夹」挑插件文件夹，不用手贴路径。

## 用脚手架建插件

```sh
npm create fuyu-plugin@latest
```

依次回答：

| 问题 | 选项 |
|---|---|
| 语言 | PowerShell（用户不用装任何东西）、TypeScript、JavaScript（用户需要装 Node.js） |
| 模板 | `command`：一个在岛上弹出提示的命令；`list`：岛上的一个列表页面；`status`：收起条上的一小段状态；`blank`：空白 |
| 作者 | 你的 GitHub 用户名 |
| 名称 | 英文名和中文名 |
| 插件 id | 小写字母、数字、`.`、`-`，例如 `yourname.reading-list`；不能包含 `fuyu` 或 `focusd`（留给官方插件） |

也可以一条命令直接生成：

```sh
npm create fuyu-plugin@latest my-plugin -- --language typescript --template list --author yourname --id yourname.reading-list --name "Reading list" --name-zh 阅读清单 --yes
```

生成的文件夹（以 TypeScript 列表页面为例）：

```text
yourname.reading-list/
├── fuyu-plugin.json              # 清单：名称、权限、页面、命令
├── src/main.mts                  # 插件代码，编译到 dist/main.mjs
├── lib/fuyu.mjs                  # SDK（一个没有依赖的文件），lib/*.d.mts 是它的类型
├── test/plugin.test.mjs          # 用模拟宿主跑的测试
├── .fuyuignore                   # 打包时排除的文件
├── .github/workflows/plugin.yml  # 推送时检查，推送版本标签时发布
├── .claude/skills/fuyu-plugin/   # 给 AI 编程助手的说明，AGENTS.md 同理
├── package.json / tsconfig.json
└── README.md / LICENSE
```

插件运行时只需要 `lib/` 里的 SDK，不依赖 `node_modules`。

## 开发：改代码，两秒内看到效果

```sh
cd yourname.reading-list
npm install
npm run watch          # 只有 TypeScript 需要：另开一个终端，持续编译到 dist/
npx fuyu-plugin dev    # 把这个文件夹以开发模式加载进岛屿
```

`dev` 会：

- 先检查清单（和 `validate` 一样），再通过本地接口让岛屿加载这个文件夹。不用复制到插件目录，也不用打开「允许运行第三方插件」；
- 监视文件夹，文件变化 300 毫秒后让岛屿重启插件（`.fuyuignore` 排除的文件和 `node_modules` 不算）；
- 在终端实时打印插件日志和状态变化；
- 按 Ctrl+C 退出时，把插件从岛屿移除。

列表模板的插件：展开岛屿，点页眉里插件的小图标就能看到页面。改 `src/main.mts` 并保存，页面会随插件重启刷新。

## 调试

开发中的插件卡片标着「开发中」，自动获得清单里申请的全部权限（敏感权限第一次使用时仍会在岛上询问）。在 **设置 → 插件扩展** 里：

- 插件卡片上的 **日志**：插件写到 stderr 的每一行、发来的 `log` 通知，以及启动失败的原因（例如找不到 Node.js）。
- **调用记录**：插件最近 200 次调用了哪个方法、结果如何。
- **开发者** 一栏：手动加载一个文件夹（不用命令行）；点一个开发中的插件，看最近 200 行原始 JSON-RPC 收发记录（→ 岛屿发给插件，← 插件发给岛屿）；手动给它发一个事件（例如 `todos.changed`），不管它有没有订阅。
- 带 [自定义网页](ui.md#自定义网页) 的插件，在页面上右键可以打开开发者工具（F12）。

## 测试：不用启动岛屿

```sh
npx fuyu-plugin test
```

有 `test/*.test.mjs` 时用 `node --test` 运行它们；没有时做一次冒烟测试：启动插件、运行每个命令、打开每个页面，检查插件没有退出、没有调用不存在的方法、没有越权。

测试里用模拟宿主 `fuyu-plugin/test` 启动插件。它和岛屿一样启动进程、发送 `initialize`，在内存里实现全部宿主方法，也和岛屿一样检查权限、页面模型大小、收起条文字长度、提示频率等规则：

```js
import assert from "node:assert/strict";
import test from "node:test";
import { startMockHost } from "fuyu-plugin/test";

test("the list shows the saved items", async () => {
  const host = startMockHost(".", { storage: { items: [{ id: "1", title: "Read", done: false }] } });
  try {
    host.viewVisible("main");                       // 用户打开页面
    const model = await host.waitForView("main");   // 等插件发来 view.update
    assert.equal(model.items[0].title, "Read");
    host.viewAction("main", "check", { itemId: "1", checked: true });
    await host.waitFor((state) => state.storage.get("items")?.[0].done);
  } finally {
    await host.stop();
  }
});
```

常用选项和方法（完整类型见 `fuyu-plugin/test` 的 `index.d.mts`）：

| 用途 | 写法 |
|---|---|
| 只授予部分权限 / 模拟用户拒绝 | `startMockHost(dir, { permissions: [...], deny: ["clipboard:read"] })` |
| 初始数据 | `todos`、`note`、`archives`、`storage`、`secrets`、`clipboard`、`messages`、`media`、`cover`、`shelf`、`settings` |
| 模拟用户操作 | `command(id)`、`viewVisible(viewId)`、`viewAction(viewId, actionId, { itemId, checked })`、`viewSubmit`、`viewSearch`、`notificationAction(id)`、`changeSettings(values)`、`openUri(path, query)` |
| 发事件 | `publish("todos.changed", { date })`（只发给已订阅的插件，和岛屿一样） |
| 检查结果 | `requests`、`logs`、`views`、`statuses`、`notifications`、`storage`、`subscriptions`、`keepAlive`、`openedViews` |
| 等待 | `waitFor(state => …)`、`waitForRequest(method)`、`waitForView(viewId, model => …)`、`waitForLog(text)` |

## 打包

```sh
npx fuyu-plugin validate      # 检查清单和文件夹
npx fuyu-plugin pack          # 写出 .package/<id>-<version>.zip
```

`validate` 检查：清单符合 [`manifest.schema.json`](../../plugins/schema/manifest.schema.json)；入口文件存在、在插件文件夹内、没有被 `.fuyuignore` 排除；激活事件和菜单指向的命令、页面都存在；没有 `experimentalApis`；包不超过 20 MB。它还会扫描代码里用到的方法名和事件名，提示「申请了但似乎没用到」和「用到了但没申请」的权限。

`pack` 生成的 zip 和插件市场里的完全一样：文件按名称排序、时间戳固定、文本文件统一为 LF，同样的文件每次得到同样的哈希。

想给别人用：把 zip 发给他，让他解压到插件目录下以插件 id 命名的文件夹里；或者放进插件市场，见 [发布](publish.md)。

## 不用工具，手动装一个插件

不装 Node.js 也能试：

1. 把示例 [`plugins/examples/dev.focusd.todo-digest`](../../plugins/examples/dev.focusd.todo-digest/) 复制到 `%APPDATA%\com.tixxin.fuyu\plugins\dev.focusd.todo-digest\`。插件目录也可以在 **设置 → 插件扩展 → 插件目录 → 打开** 里找到。文件夹名必须等于插件 id。
2. 在 **设置 → 插件扩展** 打开 **允许运行第三方插件**，点 **重新加载**，再打开插件卡片上的 **启用**。
3. 状态显示「运行中」后，点 **写入摘要**，每日笔记里会追加一段未完成待办的摘要。

改了插件文件后点 **重新加载**，岛屿会用新文件重启插件。

## 让 AI 帮你写

脚手架建的插件自带一份给 AI 编程助手看的说明：`.claude/skills/fuyu-plugin/`（Claude Code 的 skill，自动加载）和 `AGENTS.md`（Codex 等助手读它）。里面讲了从测试到打包的流程、清单字段、API、权限和容易踩的坑，打包时不会放进 zip。所以在插件文件夹里打开 Claude Code 或 Codex，直接说要什么就行，例如：

> 加一个页面，列出我在 GitHub 上 star 过的仓库，点一下在浏览器里打开；每小时刷新一次。

它会改清单和代码、写测试，跑 `npx fuyu-plugin test` 和 `validate` 确认没问题；岛屿开着开发模式时还能用 `npx fuyu-plugin dev` 加载进去给你看。发布（推标签、向插件市场提 PR）之前它会先问你。

不是用脚手架建的插件，在插件文件夹里运行一次 `npx fuyu-plugin skill` 装上同样的文件。更新 `fuyu-plugin` 后再运行一次就能拿到新版说明；你改过的文件会保留，加 `--force` 才覆盖。

## 其他写法

### PowerShell

脚手架复制的 `lib/fuyu.ps1` 是 PowerShell 模块 `Fuyu.Plugin` 的单文件版本，适用于 Windows 自带的 PowerShell 5.1：

```powershell
. "$PSScriptRoot\lib\fuyu.ps1"

Invoke-FuyuLoop @{
    initialize = { Register-FuyuEvent 'todos.changed' }
    command    = { param($params) if ($params.id -eq 'sync-now') { Show-FuyuNotification 'Synced' } }
    event      = { param($params) Write-FuyuLog "event $($params.name)" }
}
```

常用函数：`Invoke-FuyuMethod`（调用任意方法）、`Invoke-FuyuLoop`（按通知名分派处理函数，`-OnIdle` 在没有消息时运行）、`Register-FuyuEvent`、`Show-FuyuNotification`、`Update-FuyuView` / `Update-FuyuViewItems`、`Open-FuyuView`、`Update-FuyuStatus` / `Clear-FuyuStatus`、`Get-/Set-/Remove-FuyuStorage`、`Get-/Set-/Remove-FuyuSecret`、`Request-FuyuPermission`、`Set-FuyuSetting`、`Set-FuyuKeepAlive`、`Write-FuyuLog`、`New-FuyuText`（中英文两份文字）。要按自己的节奏处理消息，用 `Receive-FuyuNotification <毫秒>`：超时返回 `$null`，可以借机做定时任务。

几个要注意的地方：

- 脚本文件保持 ASCII，中文用 `ConvertFrom-FuyuEscape` 加 `\u` 转义写。
- 函数返回数组时，PowerShell 会把只有一个元素的数组展开成单个对象，取 `.Count` 前用 `@(...)` 包起来。
- stdin 关闭时 SDK 会让插件自动退出。

`Fuyu.Plugin` 模块还没有发布到 PowerShell Gallery，要整个模块时从 [`packages/powershell/Fuyu.Plugin`](../../packages/powershell/Fuyu.Plugin) 导入。

### Node.js，不用脚手架

复制 [`plugins/sdk/node/fuyu.mjs`](../../plugins/sdk/node/fuyu.mjs)（以及同目录的 `.d.mts` 类型）到插件里：

```js
import { createPlugin } from "./lib/fuyu.mjs";

const plugin = createPlugin();
plugin.onReady(async () => {
  const { todos } = await plugin.todos.list();
  plugin.log(`${todos.length} todos`);
});
plugin.onCommand("sync-now", async () => {
  await plugin.todos.add("Synced from my plugin");
});
```

### 其他语言

只要在 stdin / stdout 上按 [运行与通信](runtime.md) 和 [API 参考](api.md) 收发 JSON-RPC 即可。岛屿按扩展名启动 `.exe`、`.ps1`、`.js` / `.mjs` / `.cjs`，Rust、Go、C# 之类编译成 `.exe` 就行。
