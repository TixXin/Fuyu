# 运行与通信

本文讲插件进程怎么被启动、停止，怎么和岛屿说话。用 SDK 时这些大多已经替你处理好了；用其他语言写，或者想弄清楚背后发生了什么，再细看。每个方法和通知的参数见 [API 参考](api.md)。

## 协议

- JSON-RPC 2.0，每行一条 JSON 消息，UTF-8 编码，每条不超过 1 MB。
- **stdout** 只能输出协议消息。
- **stderr** 的每一行都进插件日志（设置页里最多保留 200 行）。插件也可以发通知 `log { message }`。
- 插件同时在途的请求最多 16 个，超过返回状态 429。
- 工作目录是插件文件夹，进程不显示控制台窗口。

岛屿发给插件的是通知（没有 `id`，不用回复）。插件调用岛屿的方法是请求（带 `id`），岛屿回复结果或错误：

```text
← {"jsonrpc":"2.0","method":"initialize","params":{"apiVersion":2,"capabilities":["events","views",…],"pluginId":"dev.example.todo-sync",…}}
→ {"jsonrpc":"2.0","id":1,"method":"todos.list"}
← {"jsonrpc":"2.0","id":1,"result":{"date":"2026-11-12","todos":[…],"scheduled":[…],"activeTodoId":null}}
→ {"jsonrpc":"2.0","method":"log","params":{"message":"3 todos"}}
```

## 启动

进程启动后，岛屿立即发送 `initialize`：

| 字段 | 说明 |
|---|---|
| `apiVersion` | 清单里写的 API 版本 |
| `capabilities` | 岛屿为这个插件提供的能力，见下文 |
| `activationEvent` | 这次为什么启动，见「按需启动」；一直运行的插件是 `onStartup` |
| `appVersion` | 浮屿的版本 |
| `pluginId`、`dataDir` | 插件 id 和它的数据目录 |
| `permissions` | 插件现在能用的权限：清单的 `permissions` 加上已获准的可选权限 |
| `optionalPermissions` | 清单里的可选权限 |
| `settings` | 全部设置的当前值 |
| `experimentalApis` | 只发给申请了实验 API 的开发中插件 |

之后随时可以用 `host.info` 再取一次。一般在收到 `initialize` 后：订阅事件、读一次当前状态、发页面模型和收起条状态。

### 能力

`capabilities` 列出岛屿支持的功能。以后的岛屿会增加新能力，**按能力判断，不要按岛屿版本号判断**：

| 能力 | 有它时能用 |
|---|---|
| `events` | `events.subscribe` / `events.unsubscribe` 和 `event` 通知 |
| `notifications` | `island.notify` 和 `notification.action` 通知 |
| `storage` | `storage.*` |
| `secrets` | `secrets.*` |
| `views` | 岛上页面：`view.update` / `view.patch` 和 `view.*` 通知 |
| `webview` | 自定义网页：`webview.postMessage` 和 `webview.message` 通知 |
| `status` | 收起条状态：`status.update` |
| `statusCells` | `status.update` 的 `cells` 和 `ring` |
| `statusBatteries` | `status.update` 的 `batteries` |
| `notifyStyle` | `island.notify` 的 `icon` 和 `layout` |
| `notifyControls` | `island.notify` 的 `controls` |
| `permissions` | 可选权限和 `permissions.request` |
| `openView` | `island.openView` |

只是给已有方法多加一个可选字段的能力（`statusCells`、`statusBatteries`、`notifyStyle`、`notifyControls`），旧版岛屿会忽略不认识的字段，照常发就行，不用先判断。

## 停止与重启

- **stdin 关闭时插件必须退出。** 插件被停用、重新加载、删除，或岛屿自己退出时，岛屿先发 `shutdown`，再关闭 stdin，2 秒后结束进程。
- 进程意外退出后，岛屿依次在 1 秒、5 秒、30 秒后重启它。连续失败 3 次就停下，状态显示「已出错停止」。插件连续运行超过 60 秒，失败次数清零。
- 插件卡片上的状态：未运行、启动中、运行中、重启中、已出错停止、待命（按需启动的插件此刻没有运行）。
- 插件进程和它启动的所有程序都在同一个 Windows 作业对象里。插件被停止、出错退出，或岛屿崩溃时，这些程序一起被结束，用 `Start-Process` 启动的也不例外。
- 插件停止后，它的事件订阅、页面模型和收起条状态都会清空，下次启动后要重新设置；`storage` 和 `secrets` 不受影响。

### 资源

岛屿每 5 秒读一次插件进程树的内存和 CPU。插件卡片上只显示**插件自己**的内存：PowerShell 和 Node.js 插件会减去运行时本身的份额（空闲的 PowerShell 约 60 MB，插件脚本本身通常只有几 MB；在意内存的插件可以改用原生 exe）。

- 连续 1 分钟 CPU 超过 25%（占整台电脑的比例）时，卡片上会提醒。
- 内存超过上限时插件被结束，状态为「已出错停止」并写明原因。上限默认 512 MB，用户可以在插件设置页改成 256 MB、1 GB 或 2 GB，插件自己不能改。

## 按需启动

不写 `activationEvents` 的插件随岛屿一直运行。写了的插件等到需要时才启动，空闲时再停掉，不占内存：

```json
"activationEvents": ["onEvent:todos.changed", "onSchedule:30"]
```

| 激活事件 | 什么时候启动 |
|---|---|
| `onStartup` | 岛屿启动时，并且一直运行（等于不写这个字段）。上架时要说明为什么需要常驻 |
| `onStartupFinished` | 岛屿启动 10 秒后；之后才启用、安装或授权的插件，在那一刻立即启动 |
| `onCommand:<id>` | 用户点了这个命令的按钮、按了它的快捷键，或在右键菜单里选了它 |
| `onView:<id>` | 用户打开了这个页面 |
| `onEvent:<事件名>` | 发生了这个事件（需要事件对应的权限）。插件直接收到这次的 `event` 通知，不用先订阅 |
| `onSchedule:<分钟>` | 每隔这么多分钟启动一次，5–1440 |
| `onUri` | 打开了发给这个插件的链接，见下文的「链接」 |

- `contributes.commands` 和 `contributes.views` 会自动加上对应的 `onCommand:<id>` / `onView:<id>`。所以 `"activationEvents": []` 就是「只在用户用到命令或页面时启动」。
- 触发启动的命令、事件或页面消息，会等 `initialize` 发出之后再送达（最多等 10 秒）。
- **空闲停止**：60 秒内没有收到消息、没有发出请求、也没有打开的页面时，岛屿发 `shutdown` 让它退出，之后有激活事件再启动。插件订阅了不在 `activationEvents` 里的事件时会一直运行，免得错过事件。
- **要一直运行**：调用 `host.keepAlive { reason }`，插件卡片上显示原因；`{ reason: null }` 取消。插件重启后要重新申请。
- **改设置也会启动**：用户改了一个待命插件的设置时，岛屿启动它，`activationEvent` 为 `onSettingsChanged`，新设置在 `initialize.settings` 里。没事做的话它照常在 60 秒后停下。

## 事件

用 `events.subscribe { events: [...] }` 订阅（一次最多 16 个），岛屿用通知 `event { name, payload }` 推送，不用定时轮询。每个事件都要有对应的权限；有一个不认识或没权限，整次请求失败，一个也不订阅。

| 事件 | 权限 | `payload` | 什么时候 |
|---|---|---|---|
| `todos.changed` | `todos:read` | `{ date, reason? }` | 今天的待办、「以后」列表或正在进行的待办变了，或者换了一天。`reason` 为 `add`、`remove`、`reorder`、`update` 或 `dayChanged`。不带待办内容，要时调 `todos.list` |
| `note.changed` | `notes:read` | `{ date }` | 每日笔记变了 |
| `agentStatus.changed` | `agent-status:read` | `{ agents: [{ id, name, phase, title? }] }` | AI Agent 状态变了 |
| `clipboard.changed` | `clipboard:read` | `{}` | 剪贴板历史变了（只在剪贴板历史打开时），要时调 `clipboard.history` |
| `messages.received` | `messages:read` | 和 `messages.list` 的一项相同 | 新的 QQ 通知、QQ 邮件或微信提醒到了 |
| `media.changed` | `media:read` | 和 `media.nowPlaying` 相同 | 换歌、换播放器、播放 / 暂停（有订阅时每 2 秒检查一次），进度变化不算 |
| `shelf.changed` | `shelf:read` | `{ count }` | 文件中转的条目变了 |
| `island.expanded` / `island.collapsed` | 不需要 | `{}` | 岛屿展开 / 收起 |
| `app.locale.changed` | 不需要 | `{ locale }` | 界面语言变了，`zh-CN` 或 `en` |
| `system.locked` / `system.unlocked` | 不需要 | `{}` | 锁屏 / 解锁 |
| `system.suspended` / `system.resumed` | 不需要 | `{}` | 睡眠 / 唤醒。睡眠前留给插件的时间很短，要保存的平时就存好 |
| `system.idle` / `system.active` | 不需要 | `{ idleSeconds }` / `{}` | 5 分钟没有键盘鼠标输入（每 5 秒检查一次，有输入之前只发一次）/ 之后又有了输入 |

- 同一个事件 200 毫秒内最多发一次，带最后一次的 `payload`；`messages.received` 例外，每条消息都送到。
- 订阅只在这次进程里有效，插件重启后要重新订阅。订阅之前发生的变化不会补发，插件启动时自己读一次当前状态。
- 需要敏感权限的事件，用户撤销权限后订阅立即断开。

## 链接

岛屿为当前用户注册了 `fuyu://` 链接。网页或其他程序打开 `fuyu://plugin/<插件 id>/<路径>?<查询>` 时，Windows 把它交给岛屿（岛屿没在运行就先启动），岛屿再发给这个插件。适合接收 OAuth 登录回调之类的数据。

- 只有 `activationEvents` 里写了 `onUri` 的插件能收到，按需启动的插件会被唤醒。插件收到 `uri { uri, path, query }`：`path` 是插件 id 后面的部分（以 `/` 开头，没有时为空），`query` 是 `?` 后面、`#` 前面的部分，仍是百分号编码。整个链接最长 2048 个字符，不能有空白。
- 任何网页都能放这种链接，所以插件第一次收到链接前，岛上会像敏感权限一样询问用户（允许 / 本次 / 拒绝）。插件被关闭、没写 `onUri` 或用户拒绝时，链接被丢弃。
- 把链接里的数据当成不可信的输入：检查格式，不要直接执行；做登录回调时用 `state` 参数核对是自己发起的请求。
- 改名前的 `focusd://` 链接照样能用，已经写进 OAuth 回调地址的不用改。
- SDK：Node `plugin.onUri(({ path, query }) => …)`；PowerShell 在 `Invoke-FuyuLoop` 的处理函数表里加 `uri`；模拟宿主 `host.openUri("/auth", "code=1")`。

## 存储与秘密

| | `storage.*` | `secrets.*` |
|---|---|---|
| 适合 | 设置以外的小量数据，比如缓存、上次同步时间 | 令牌和密码 |
| 权限 | 不需要 | `secrets` |
| 存在哪 | `plugins-data/<id>/storage.json`，写入是原子的 | Windows 凭据管理器，服务名 `com.tixxin.fuyu.plugin.<id>` |
| 键 | 1–128 个字符 | 1–64 个字母、数字、`.`、`_`、`-` |
| 值 | 任意 JSON，单个不超过 64 KB，整个插件不超过 1 MB | 字符串，最长 1024 个字符，每个插件最多 32 个 |

超出上限返回状态 413。卸载插件时两者都保留，重新安装后还能读到；插件设置页的 **清除数据** 会删掉 `plugins-data/<id>/` 整个目录和这个插件的全部秘密。

更大的数据（数据库、下载的文件）写进插件的数据目录，见下文的环境变量。

## 环境变量

| 变量 | 说明 |
|---|---|
| `FUYU_PLUGIN_ID` | 插件 id |
| `FUYU_PLUGIN_DATA_DIR` | 插件私有的数据目录 `%APPDATA%\com.tixxin.fuyu\plugins-data\<id>\`，已经建好。数据存这里，不要写进插件文件夹，否则更新插件时会被覆盖 |
| `FUYU_PLUGIN_API_VERSION` | 清单里的 `apiVersion` |

## 错误码

| code | 含义 |
|---|---|
| `-32700` | 不是合法的 JSON |
| `-32600` | 不是合法的 JSON-RPC 消息（缺少 `"jsonrpc": "2.0"`、`method`，或 `id` 类型不对） |
| `-32601` | 方法不存在 |
| `-32001` | 没有对应的权限（包括订阅没有权限的事件），或用户拒绝了、30 秒内没有回答 |
| `-32000` | 岛屿返回了错误，`data.status` 是对应的 HTTP 状态码 |

`-32000` 的状态码：

| 状态码 | 含义 |
|---|---|
| 400 | 参数不对 |
| 403 | 现在不允许，例如超过 15 秒才调用 `island.openView` |
| 404 | 不存在，包括清单里没有声明的页面或状态项 |
| 409 | 对应功能被用户关掉了（例如剪贴板历史），或在 `view.update` 之前调用了 `view.patch` |
| 413 | 太大：存储、秘密或页面模型超出上限 |
| 429 | 太频繁：同时在途的请求超过 16 个，或提示超过每分钟 6 条 |
| 500 | 岛屿做不到，例如写文件或凭据管理器失败 |
| 504 | 岛屿没有及时响应 |

## 兼容规则

同一个 API 版本内只做新增：新方法、新的可选参数和结果字段、新事件、新能力。插件要忽略不认识的字段和通知。只有不兼容的改动才会升 `apiVersion`，到时旧版本的插件照样能运行。

## 第 1 版插件

`"apiVersion": 1` 的插件照常运行，只是能用的少：

- 能调用的方法只有 `host.info`、`settings.get`、`ui.setInfo`、`todos.list` / `add` / `update` / `remove`、`note.get` / `set`、`agentStatus.report` / `clear`（读以前日子的 `date` 参数要第 2 版），以及清单里申请了 `island:notify`、`secrets` 等权限时对应的方法。`events.*`、`storage.*`、`view.*`、`status.update` 返回「方法不存在」。
- `initialize.capabilities` 是空列表。
- 清单里的 `activationEvents`、`optionalPermissions`、`keybinding`、`when`、`menus`、`views`、`statusItems` 被忽略，写了也不影响加载。插件随岛屿一直运行。

升级到第 2 版：把 `apiVersion` 改成 `2`，其他照旧就能运行，再按需加上页面、事件和按需启动。

## 改名前的名字

岛屿原来叫 FocuSD Island，2026-11 改名为浮屿 / Fuyu。改名前写的插件不用改，下面这些旧名字岛屿和 SDK 都还认，至少保留到插件 API 的下一个大版本。新插件用新名字。

| 新名字 | 改名前 |
|---|---|
| 清单 `fuyu-plugin.json` | `focusd-plugin.json`（两个都有时用新的） |
| 忽略文件 `.fuyuignore` | `.focusdignore` |
| 环境变量 `FUYU_PLUGIN_*` | `FOCUSD_PLUGIN_*`，岛屿两组都设置 |
| 网页接口 `acquireFuyuApi()` | `acquireFocusdApi()`，两个名字共用一次调用机会 |
| CSS 变量 `--fuyu-*` | `--focusd-*`，两组值相同 |
| 链接 `fuyu://` | `focusd://` |
| PowerShell 函数 `*-Fuyu*`，SDK 文件 `lib/fuyu.ps1` | `*-Focusd*`（新 SDK 里是别名），`lib/focusd.ps1` |
| npm 包 `fuyu-plugin`、`create-fuyu-plugin`，PowerShell 模块 `Fuyu.Plugin` | `fly-island-plugin`、`create-fly-island-plugin`、`FlyIsland.Plugin`（不再更新） |
| 签名私钥 `~/.fuyu-plugin/signing.key`、`FUYU_PLUGIN_SIGNING_KEY` | `~/.fly-island-plugin/signing.key`（只有它时继续用它）、`FLY_ISLAND_PLUGIN_SIGNING_KEY` |

`fuyu-plugin pack` 会把 `fuyu-plugin.json` 再以 `focusd-plugin.json` 的名字放进 zip，改名前的岛屿也能安装。插件 id 和签名格式不变。
