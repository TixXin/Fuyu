# 更新日志

每个浮屿版本给插件带来了什么，最新的在最前。插件要用某一版才有的东西时，按 `initialize.capabilities` 判断宿主有没有这项能力，或者在清单里写 `minAppVersion`；只给已有方法加的可选字段，旧版岛屿会忽略，不用判断。

npm 包 `fuyu-plugin` 和 `create-fuyu-plugin` 的版本单独标在括号里。

## 下一版

- **收起条上的饼图**：`status.update` 多了 `pie`（最多 4 块 `{ value, tone? }`，按占比画成小饼），能力 `statusPie`。SDK：Node `StatusOptions.pie`、PowerShell `Update-FuyuStatus -Pie`，模拟宿主会校验。见 [岛上界面 · 饼图](ui.md#饼图)。

## 0.3.6

- **安装链接**：`fuyu://market/install/<插件 id>` 打开插件市场并把这个插件置顶，官网插件页的「在浮屿中安装」按钮用的就是它，作者也可以放进 README。链接不会直接安装，用户照常确认。见 [发布 · 安装链接](publish.md#安装链接)。

## 0.3.5

- **改名为浮屿 / Fuyu**（npm 包 0.5.0）：清单 `fuyu-plugin.json`、忽略文件 `.fuyuignore`、环境变量 `FUYU_PLUGIN_*`、网页接口 `acquireFuyuApi()`、CSS 变量 `--fuyu-*`、链接 `fuyu://`。旧名字照样认。npm 包改名为 `fuyu-plugin`、`create-fuyu-plugin`，PowerShell 模块改名为 `Fuyu.Plugin`，函数改名为 `*-Fuyu*`（旧的 `*-Focusd*` 是别名）。插件市场换到 [`TixXin/fuyu-plugins`](https://github.com/TixXin/fuyu-plugins)。见 [改名前的名字](runtime.md#改名前的名字)。
- **收起条上的电池**：`status.update` 多了 `batteries`（最多 4 个 `{ level, tone? }`），能力 `statusBatteries`。见 [岛上界面 · 电池](ui.md#电池)。
- **页面大小统一**：岛上所有页面，包括插件的自定义网页，都用用户在「外观」里设的面板大小。`webview` 页面的 `height` / `width` 不再改变岛的大小。
- **让 AI 帮你写插件**（npm 包 0.6.0）：`fuyu-plugin skill` 把给 AI 编程助手看的说明装进插件文件夹，脚手架建的新插件自带。见 [快速开始 · 让 AI 帮你写](quickstart.md#让-ai-帮你写)。

## 0.3.4

- **提示的样式**：`island.notify` 多了 `icon: "media"`（正在播放的音乐软件的图标）和 `layout: "inline"`（新消息面板里只有这一条时不带标题和卡片），能力 `notifyStyle`。
- **提示上的播放按钮**：`island.notify` 多了 `controls: "media"`，由岛屿在提示旁放上一首、播放 / 暂停、下一首，插件不需要 `media:control`，能力 `notifyControls`。见 [岛上提示](ui.md#岛上提示)。
- **自定义网页不带卡片**：`webview` 页面可以写 `frame: "none"`，直接画在岛上；这样的页面的颜色变量跟着岛屿的深浅底色。

## 0.3.3

- **收起条上的多个状态项**：每个有文字的状态项都是收起条上的一个项目，用户在 **外观 → 收起条上的项目** 里排顺序、放左右、隐藏。以前只显示优先级最高的一个。
- npm 包 0.4.0：修好了 PowerShell SDK 在 Windows PowerShell 5.1 上 `Receive-*Notification` 超时不生效的问题（靠超时做定时任务的插件会停住），用旧脚手架建的 PowerShell 插件请换上新的 `lib/` 文件；`validate` 不再把 `optionalPermissions` 里的权限报成「没申请」；清单校验认识 `sounds` 和 `agentEffortLabels`。

## 0.3.2

- **收起条上的列和小环**：`status.update` 多了 `cells`（最多 4 列 `{ label, value, tone? }`）和 `ring`（0–1 的小进度环），能力 `statusCells`。见 [岛上界面 · 几列数字和进度环](ui.md#几列数字和进度环)。
- **更多右键菜单**：`contributes.menus` 新增 `clipboard/context`、`shelf/context`、`message/context`，插件收到 `command { id, args: { item } }`。用户亲手选的这一条不需要读取权限。
- **修改自己的设置**：`settings.set { values }`，比如登录后把账号写进设置。
- **媒体控制**：`media.nowPlaying` 多了 `canSeek`、`canNext`、`canPrevious`、`shuffle`、`repeat`、`volume`；新方法 `media.cover`、`media.seek`、`media.setVolume`、`media.toggleShuffle`、`media.cycleRepeat`。
- **文件中转和系统事件**：事件 `shelf.changed`；不需要权限的 `system.locked` / `unlocked`、`system.suspended` / `resumed`、`system.idle` / `active`，可以写进 `activationEvents`，比如 `onEvent:system.resumed`。
- **Agent 页的强度名称**：`contributes.agentEffortLabels`，只有清单的插件就能用。见 [清单](manifest.md#agent-页的强度名称)。
- **按需启动的两处修正**：岛屿启动后才启用的 `onStartupFinished` 插件立即启动，不再等下次重启；用户改了待命插件的设置时启动它（`activationEvent` 为 `onSettingsChanged`）。
- npm 包 0.3.0 带上这些接口的 SDK 和模拟宿主支持。

## 0.3.1

- **读以前的待办和笔记**：`todos.list` 和 `note.get` 接受 `{ date }`，过去的日子读归档；新方法 `todos.days { from, to }`，适合周报和完成率统计。
- **打开自己的页面**：`island.openView { viewId }`，用户刚用过插件的 15 秒内展开岛屿并打开插件的页面，能力 `openView`。
- **可选权限**：清单 `optionalPermissions` 和 `permissions.request`，用到时再询问，能力 `permissions`。见 [可选权限](permissions.md#可选权限)。
- **调用记录**：插件设置页列出最近 200 次请求的方法名和结果。
- **链接**：激活事件 `onUri` 和通知 `uri`，网页打开 `fuyu://plugin/<id>/…` 时发给插件，适合登录回调。见 [链接](runtime.md#链接)。
- **页面与快捷键**：`view.patch` 可以删除（`remove`）和插入（`add`）条目；用户可以在 **设置 → 快捷键 → 插件快捷键** 里改插件命令的快捷键。
- **作者签名**（npm 包 0.2.0）：`keygen`、`pack --sign`、`sign`、`keys rotate`。签了名的插件才会自动更新。见 [作者签名](publish.md#作者签名)。

## 0.3.0：插件 API 第 2 版

第 2 版插件在清单里写 `"apiVersion": 2`。第 1 版的插件行为不变。

- **岛上界面**：`contributes.views`（`list`、`detail`、`form`、`status` 模板）和 `contributes.statusItems`；`view.update`、`view.patch`、`status.update` 和 `view.*` 通知。
- **自定义网页**：`webview` 模板显示插件自己的网页，在单独的 WebView2 里运行，不能联网；`webview.postMessage` 和 `webview.message`。新示例 `dev.focusd.todo-ring`。
- **事件与提示**：`events.subscribe` / `unsubscribe` 和 `event` 通知；`island.notify` 和 `notification.action`。
- **快捷键与菜单**：命令的 `keybinding` / `when`，待办右键菜单 `todo/context`。
- **数据**：`storage.*`、`secrets.*`；敏感权限 `clipboard:read`、`messages:read`、`media:read`、`shelf:read`、`shelf:write`（第一次使用时在岛上确认），以及 `media:control`、`agent-status:read`、`island:notify`、`secrets`。
- **按需启动**：`activationEvents`、`initialize.activationEvent`、`host.keepAlive`；空闲 60 秒停止；插件进程树随插件结束；内存上限。
- **开发者工具**：npm 包 `fly-island-plugin`（SDK、命令行、模拟宿主）和脚手架 `create-fly-island-plugin`（0.5.0 起改名为 `fuyu-plugin`、`create-fuyu-plugin`）；岛屿的开发模式；`experimentalApis`。
- **插件市场**：作者把插件包发在自己仓库的 Release，向市场仓库提 PR 上架；发布者信任、下架名单、后台检查更新和可选的自动更新。
