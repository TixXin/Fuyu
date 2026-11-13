# 岛上界面

插件能在岛上放四样东西：展开后的**页面**、收起条上的**状态**、一条**岛上提示**，以及插件自己的**设置页**（见 [清单 · 设置项](manifest.md#设置项)）。

除了自定义网页，界面都由岛屿按模板绘制：插件只发数据，不发 HTML、脚本或 SVG，所以和岛上其他内容风格一致，深色、浅色和用户调的大小也自动跟上。所有文字都可以是字符串，或 `{ "zh-CN": "…", "en": "…" }`（按岛屿当前语言选）；太长的文字会被截断，格式不对的字段会被忽略。

## 页面

在清单里声明，最多 2 个：

```json
"contributes": {
  "views": [
    {
      "id": "issues",
      "title": { "zh-CN": "Issue", "en": "Issues" },
      "icon": "git-pull-request",
      "template": "list"
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `id` | 1–32 个字母、数字或 `-`，同一插件内不能重复 |
| `title` | 中英文都要有 |
| `icon` | lucide 图标名，只能用 [`manifest.schema.json`](../../plugins/schema/manifest.schema.json) 里列出的 47 个（如 `list`、`timer`、`git-pull-request`、`kanban`、`music`、`gauge`），不写时为 `puzzle` |
| `template` | `list`、`detail`、`form`、`status` 或 `webview`，见下文 |

用户怎么打开：页眉里插件页面的小图标排在岛屿自己的页面图标后面、右侧按钮（消息、翻译）前面，点它打开；Alt+数字 和左右切换都按页眉从左到右的顺序，所以插件页面排在消息和翻译之前。用户可以在 **设置 → 插件扩展 → 岛上页面** 里隐藏某个页面或调整顺序。

### 发数据

- `view.update { viewId, model }` 发整个模型，序列化后不超过 256 KB（超过返回状态 413）。
- `view.patch { viewId, items?, remove?, add? }` 只改列表里的几项：`items` 按 `id` 替换，`remove: [id]` 删除，`add: [{ item, before?, group? }]` 插入到 `before` 那一项前面，否则第 `group` 组末尾，否则列表末尾。在第一次 `view.update` 之前调用返回 409。
- 每个页面每秒最多显示 10 次更新，更快的合并成最后一次。

### 什么时候发

- 页面打开和关上时，插件收到 `view.visible { viewId, visible }`。页面不在屏幕上时岛屿不转发更新，所以一般在 `visible` 为 `true` 时准备数据并发送。
- 插件进程停止或崩溃时，它发过的模型都会清空，页面显示「插件已停止」、原因和「重新启动」按钮，不影响其他页面。插件重启后要重新发模型（收到 `view.visible` 时发就行）。
- 插件还没发模型时，页面显示「等待插件发来内容…」。模型里可以带 `loading: true` 或 `error: "…"`，显示加载中或出错。

### 用户的操作

| 用户做了什么 | 插件收到 |
|---|---|
| 点了条目、行内按钮或底部按钮 | `view.action { viewId, actionId, itemId? }` |
| 勾了列表条目的勾选框 | `view.action { viewId, actionId: "check", itemId, checked }` |
| 提交了表单 | `view.submit { viewId, values }` |
| 在远程搜索的列表里输入 | `view.search { viewId, query }` |

插件可以在用户刚用过它之后（15 秒内）用 `island.openView { viewId }` 展开岛屿并打开自己的页面，比如快捷键按下后直接把结果页亮出来。「用过」指：执行了它的命令或快捷键、点了它的提示按钮、打开了发给它的链接、在它的页面上操作了。超过 15 秒返回 403。

### list 模板

```json
{
  "items": [
    { "id": "42", "title": "Crash on start", "subtitle": "TixXin/fuyu", "note": "2h", "icon": "bug", "url": "https://github.com/TixXin/fuyu/issues/42" },
    { "id": "43", "title": "Ship 1.0", "checked": false, "actions": [{ "id": "snooze", "title": "Later", "icon": "clock" }] }
  ],
  "search": { "placeholder": "Filter" },
  "empty": "Nothing open"
}
```

模型：`{ items?, groups?: [{ title?, items }], empty?, loading?, error?, search? }`，最多 500 项，超过 8 行时页面滚动。

| 条目字段 | 说明 |
|---|---|
| `id` | 必填，1–128 个字母、数字或 `-_.:/`，同一页面内不能重复 |
| `title` | 必填，标题 |
| `subtitle` / `note` | 第二行 / 右侧的短附注 |
| `icon` | 同 `views[].icon` 的图标名 |
| `checked` | `true` / `false` 时显示勾选框。界面以插件下一次发来的模型为准 |
| `url` | 只收 `https://` 链接，点条目时用系统浏览器打开 |
| `action` | 没有 `url` 时，点条目发 `view.action { actionId: <action>, itemId }` |
| `actions` | 最多 3 个行内按钮 `[{ id, title, icon? }]` |

`search` 为 `{ placeholder?, mode? }` 时显示搜索框。`mode` 默认 `local`，岛屿按标题、第二行和附注过滤；`remote` 时岛屿把输入（停顿 250 毫秒后）以 `view.search` 发给插件，插件发回新的列表。

### detail 模板

`{ title?, markdown?, meta?: [{ label, value }], actions?, loading?, error? }`

`markdown` 只支持标题、粗体、斜体、行内代码、列表、段落和 `https://` 链接（在浏览器中打开），其他写法（包括 HTML）原样显示为文字。`meta` 最多 20 项，`actions` 最多 3 个，显示在底部。

### form 模板

`{ fields, submitTitle?, message?, error? }`

`fields[]` 为 `{ key, type, title, description?, placeholder?, value?, options?, min?, max? }`，`type` 和设置项一样（`boolean`、`string`、`number`、`select`），另外多一个 `multiline`（多行文字，最长 4000 字）。用户点提交后插件收到 `view.submit { viewId, values }`，`values` 已按字段类型整理好（数字取整并限定在 `min`–`max`）。用 `message` / `error` 告诉用户结果。

### status 模板

`{ primary, secondary?, caption?, progress?, tone?, actions? }`

`primary` 是一行大字（例如倒计时），`secondary` 是第二行，`progress` 是 0–1 的进度条，`tone` 为 `neutral`、`accent`、`warning` 或 `danger`。

## 自定义网页

模板画不出来的（图表、小工具），用 `webview` 模板显示插件自己的网页：

```json
{
  "id": "ring",
  "title": { "zh-CN": "进度", "en": "Progress" },
  "template": "webview",
  "entry": "ui/index.html",
  "frame": "none"
}
```

| 字段 | 说明 |
|---|---|
| `entry` | 必填，插件文件夹里的 `.html` 文件（相对路径，不能有 `..`）。页面只能加载 `entry` 所在文件夹及其子文件夹里的文件 |
| `frame` | `"card"`（默认）套上岛屿的卡片和标题；`"none"` 不套，页面直接画在岛上，像岛自己的页面，背景要保持透明。插件没在运行或还在启动时仍显示卡片，好让用户知道是哪个插件 |
| `height` / `width` | 只给 0.3.4 之前的岛屿用（`height` 80–480，默认 240；`width` 320–860）。现在所有页面统一用用户在「外观」里设的面板大小（0.3.5 起新装默认 800 × 360，已经保存过设置的用户保持原来的，旧默认是 560 × 490；可调范围宽 480–800、高 360–640。页面实际能用的比面板小一圈，面板 800 × 360 时约 760 × 275），页面要能在这些大小里排开，放不下时自己滚动 |

### 页面和插件之间

页面脚本调用 `acquireFuyuApi()`（每个页面只能调用一次），拿到：

| 成员 | 作用 |
|---|---|
| `postMessage(message)` | 发给插件进程，插件收到通知 `webview.message { viewId, message }`（不超过 256 KB） |
| `onMessage(listener)` | 接收插件用 `webview.postMessage { viewId, message }` 发来的消息，返回取消函数 |
| `getState()` / `setState(state)` | 岛屿运行期间为这个页面保存的一小段数据（不超过 64 KB），页面关掉再打开时能马上拿到 |
| `locale` | 岛屿当前语言，`"zh-CN"` 或 `"en"` |

页面打开时才创建，离开屏幕就关闭。`webview.postMessage` 返回 `{ shown }`，页面不在屏幕上时为 `false`，消息被丢弃；页面脚本还没运行时发的消息也会丢失。所以让页面加载后先发一条「准备好了」，插件收到再发数据。示例 [`dev.focusd.todo-ring`](../../plugins/examples/dev.focusd.todo-ring/) 就是这样做的。

### 颜色

页面里有岛屿的颜色变量：`--fuyu-text`、`--fuyu-text-muted`、`--fuyu-accent`、`--fuyu-surface`、`--fuyu-border`、`--fuyu-success`、`--fuyu-warning`、`--fuyu-danger`、`--fuyu-radius`、`--fuyu-font`。页面背景默认透明，下面是岛屿的页面底色。

- 套卡片的页面始终是深色。
- `frame: "none"` 的页面跟着岛屿底色：浅色岛屿上 `--fuyu-text` 是深色，`color-scheme` 是 `light`，所以可以用 `light-dark()` 给图表配两套颜色。主题在页面打开时定下，岛屿换了底色，下次打开页面才生效。

### 限制

- 页面是一个单独的 WebView2，不在岛屿自己的网页里：页面里**没有**岛屿的任何接口（`__TAURI__` 之类都不存在），只能和自己的插件进程通信。页面在无痕模式下运行，关掉后不留下 `localStorage` 之类的数据。
- 页面不能联网：岛屿拦截页面和其中所有框架、Worker 的每一个请求，只回答插件文件夹里的文件。离开插件来源的跳转、新窗口、下载和摄像头之类的权限请求都会被拒绝，WebRTC 不可用。
- 每个文件都带固定的 CSP：`default-src 'none'`，允许本插件的脚本（含内联脚本）、样式、图片和字体，`connect-src 'self'`（只能 `fetch` 自己的文件），禁止 `eval`、Worker、表单提交。页面可以用 `<meta>` 再加限制，不能放宽。
- 页面来源是 `https://<插件 id>.plugin.focusd.invalid`，用相对路径引用文件即可。
- 需要联网的数据由插件进程去取，再用 `webview.postMessage` 发给页面。
- 开发模式加载的插件，页面可以右键打开开发者工具（F12）。
- 插件市场会给带自定义网页的插件加上「自定义界面」标签，第一次加入自定义网页的版本要等维护者审核才上架。

## 收起条

插件可以在收起条上放一小段状态，最多 2 个，在清单里声明：

```json
"statusItems": [{ "id": "countdown", "priority": 10 }]
```

`priority` 是 -100 到 100，默认 0。每个有内容的状态项都是收起条上的一个项目：用户没排过时按优先级从高到低排在右侧，用户可以在 **外观 → 收起条上的项目** 里调顺序、换到左侧或隐藏。插件不能决定位置。

### 文字

```js
await plugin.status.update("countdown", "24:13", { tooltip: "Pomodoro", tone: "accent" });
```

`status.update { itemId, text, tooltip?, tone? }`：`text` 最多 24 个字符，空字符串表示清除；`tone` 为 `neutral`、`accent`、`warning` 或 `danger`。点击这一项会打开插件的第一个页面。插件停止后它的状态会清空，重启后要重新发。

### 几列数字和进度环

`status.update` 还可以带 `cells` 和 `ring`（能力 `statusCells`）：

- `cells`：最多 4 列 `[{ label, value, tone? }]`，`label` 最多 6 个字符，`value` 最多 8 个字符。收起条画成「上面小字标签、下面数值」的几列，代替文字，比如 `CPU 23%`、`GPU 81°`。`tone` 为 `warning` / `danger` 的列，数值变成黄色 / 红色。
- `ring`：0–1 的小进度环，按这一项的 `tone` 着色，画在文字或列的前面，比如番茄钟的剩余时间。

```js
await plugin.status.update("bar", "CPU 23% · GPU 81°", {
  cells: [{ label: "CPU", value: "23%" }, { label: "GPU", value: "81°", tone: "warning" }],
  ring: 0.23,
});
```

PowerShell：`Update-FuyuStatus 'bar' 'CPU 23%' -Cells @(@{ label = 'CPU'; value = '23%' }) -Ring 0.23`。

### 电池

`batteries`（能力 `statusBatteries`）：最多 4 个 `[{ level, tone? }]`，`level` 是 0–1 的电量。收起条画成几个并排立着的小电池，代替文字和 `cells`，不显示数字，具体数值写进 `tooltip` 和插件自己的页面。

- 没写 `tone` 的电池按位置上色：第 1 到第 4 个依次是绿、蓝、紫、粉。同一个设备尽量一直排在同一个位置。
- `tone` 为 `warning` / `danger` 的电池变成黄色 / 红色，用来表示电量低；`accent` 是浅蓝色。

```js
await plugin.status.update("battery", "80% 15%", {
  tooltip: "PC 80% / Headphones 15%",
  batteries: [{ level: 0.8 }, { level: 0.15, tone: "warning" }],
});
```

### 饼图

`pie`（能力 `statusPie`）：最多 4 块 `[{ value, tone? }]`，`value` 是不小于 0 的数，每块的大小是它占全部 `value` 之和的比例。收起条画成一个和进度环一样大的小饼，从 12 点方向顺时针排，代替文字和 `cells`，不显示数字，具体数值写进 `tooltip` 和插件自己的页面。适合「几种状态各占多少」，比如作业队列里运行、排队、收尾的个数。

- 没写 `tone` 的块按位置上色：第 1 到第 4 块依次是绿、橙、蓝、品红，对应「运行、等待、收尾、其他」，按这个顺序排最好认。`value` 为 0 的块不画，但仍占着它的位置，后面几块的颜色不变。
- `tone` 为 `warning` / `danger` 的块是黄色 / 红色，`accent` 是浅蓝色。
- 所有 `value` 都是 0 时画一个空的灰圈。
- 同时给了 `batteries` 时只画电池。`ring` 照常画在饼前面。

```js
await plugin.status.update("queue", "R12 PD3 CG1", {
  tooltip: "R 12 · PD 3 · CG 1 · 其他 0",
  pie: [{ value: 12 }, { value: 3 }, { value: 1 }, { value: 0 }],
});
```

PowerShell：`Update-FuyuStatus 'queue' 'R12 PD3 CG1' -Tooltip 'R 12 · PD 3 · CG 1' -Pie @(@{ value = 12 }, @{ value = 3 }, @{ value = 1 })`。

`text` 始终必填：读屏软件念它，不认识 `cells`、`ring`、`batteries`、`pie` 的旧版岛屿也显示它。所以不用先判断能力，照常发就行。

## 岛上提示

`island.notify { title, body?, durationMs?, actions?, icon?, layout?, controls? }` 在岛上显示一条消息（需要 `island:notify` 权限）。它和 QQ、邮件消息一样出现在收起条的消息预览里，来源显示为插件名。

```js
await plugin.notify("Build finished", {
  body: "fuyu-site · 2 min",
  actions: [{ id: "open", title: "Open" }],
});
plugin.onNotificationAction("open", () => { /* … */ });
```

- `title` 1–80 个字符，`body` 最长 200 个字符。`durationMs` 默认 5000，限制在 2000–15000。
- `actions` 最多 2 个按钮 `{ id, title }`，`id` 为 1–32 个字母、数字或 `-`，`title` 最长 16 个字符。用户点了按钮，插件收到 `notification.action { id }`。
- 每个插件每分钟最多 6 条，超过返回状态 429。
- 用户可以在插件设置页关掉这个插件的提示。关掉后调用照样成功，只是不显示，结果是 `{ muted: true }`。

样式（旧版岛屿忽略这些字段，照常显示文字，不用先判断能力）：

| 字段 | 作用 | 能力 |
|---|---|---|
| `icon: "media"` | 把插件图标换成正在播放的音乐软件的图标（读不到时仍用插件图标） | `notifyStyle` |
| `layout: "inline"` | 新消息面板里只有这一条时，不显示「新消息」标题和卡片，整个岛就是这条提示 | `notifyStyle` |
| `controls: "media"` | 在提示右侧放上一首、播放 / 暂停、下一首，由岛屿自己控制正在播放的软件；插件不需要 `media:control`，也收不到点击。只在新消息面板里显示 | `notifyControls` |

PowerShell：`Show-FuyuNotification 'Now playing' -Icon media -Layout inline -Controls media`。
