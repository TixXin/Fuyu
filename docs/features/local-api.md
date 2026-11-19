# 本地接口（Local API）

本地接口让脚本、AutoHotkey、Raycast、MCP 适配器等程序通过 HTTP 读写**今天的待办**和**每日笔记**、上报 AI Agent 状态，以及在岛上**弹一条消息**（2026-11-19 起，C142）。它是[插件系统](../architecture/plugins/v1-design.md)路线图的 P1。

## 开启

本地接口是一个**内置插件**（`local-api`，2026-11-16 起，E36.3.43；以前是旧版插件平台的 `focusd.local-api`）：它随岛屿一起安装，不需要下载。

1. 设置 → 本机接口，打开页面上的开关（或者在 设置 → 插件 里打开 **本机接口**，是同一个开关）。关掉时 HTTP 服务停止监听。
2. 设置 → **本机接口**（侧栏「扩展」组里单独的一页，2026-11-19 起，C141；以前是「通用」里的一个标签。侧栏里这一项一直在，不随接口开关隐藏；接口关着时页面上只有一张带开关的卡片，在这里打开和在插件页打开是一回事）。打开后页面有三组：
   - **本机接口**：
     - **地址** 旁边点「复制」。
     - **访问令牌** 不在界面上显示，点「复制」由岛直接写进剪贴板（不进系统和浮屿的剪贴板历史），粘贴到脚本里。
     - 点 **重新生成令牌** 会换一个新令牌，使用旧令牌的脚本会立即失效。
     - **配置文件** 一行显示 `local-api.json` 的位置，能在文件夹里打开。
   - **权限**：需要添加、修改或删除时，打开 **允许修改待办、笔记和 Agent 状态**，关闭时只能读取，写请求返回 403。下面列出现在开放的三样（待办和每日笔记、AI Agent 状态灯、剪贴板历史）各自能不能用：对应的功能关着时写明请求会回 503，并给一个去那一页的链接；剪贴板历史另有自己的开关，这一行只指路，不显示那个开关现在的状态。
     - **允许弹消息**（2026-11-19 起，C142）：和「允许修改」分开的一个开关，默认关；关着时 `POST /v1/notify` 回 403。下面的列表多一行「弹消息」。
   - **消息来源**：有来源弹过消息后才出现，一个来源一行开关。关掉的来源照常回 200，只是不弹出（`shown` 是 `false`）。
   - **试一下**：一段能直接复制的示例，调 `/v1/health`（打开「允许弹消息」后换成弹一条消息），令牌从配置文件里读（Windows 给 PowerShell，Mac 给 `sed` 加 `curl`）；右上角的链接打开这份文档。接口没在运行时不显示这一组。

默认关闭。地址只监听 `127.0.0.1`，优先使用端口 `39271`，被占用时自动换一个空闲端口。

> 从旧版本升级：第一次启动新版本时，旧版插件页上的开关和"允许修改"会自动搬过来（存进 `plugins-v3/plugins.yml`）；更早在"设置 → 待办"里打开过本地接口的也一样。地址、端口、令牌都不变，已有的脚本不用修改。

脚本也可以直接读取配置文件来获取端口和令牌，路径为 `%APPDATA%\com.tixxin.fuyu\local-api.json`：

```json
{ "enabled": true, "allowWrite": true, "allowNotify": false, "port": 39271, "token": "64 位十六进制" }
```

`enabled`、`allowWrite` 和 `allowNotify`（2026-11-19 起，旧文件里没有时当作 `false`）由插件的开关和设置写入，只供脚本参考；直接改这个文件不会让接口开启或关闭。

## 安全

- 只接受本机请求。
- 每个请求都必须带 `Authorization: Bearer <令牌>`，否则返回 401。
- 带 `Origin` 头的请求（来自网页）一律拒绝，返回 403。
- `Host` 必须是 `127.0.0.1:<端口>` 或 `localhost:<端口>`，用来防止 DNS 重绑定攻击。
- 请求体最大 64 KB。
- 只开放待办、每日笔记、AI Agent 状态灯和弹消息（弹消息默认关，只收纯文本，见下面「弹消息」）。剪贴板历史默认不开放，要在「设置 → 剪贴板」打开「允许本地接口读取历史」才能读（只读文字记录，打码的密钥只给打码后的样子，C38）。邮件、消息、凭据都不开放。

## 接口

所有响应都是 JSON：成功时为 `{ "ok": true, "data": ... }`，失败时为 `{ "ok": false, "error": "..." }`，并带相应的 HTTP 状态码。

| 方法 | 路径 | 请求体 | 说明 |
|---|---|---|---|
| GET | `/v1/health` | — | `{ app, version, apiVersion, allowWrite, allowNotify }` |
| GET | `/v1/todos` | — | `{ date, todos, scheduled, activeTodoId }` |
| POST | `/v1/todos` | `{ "title": "...", "date"?: "YYYY-MM-DD", "project"?: "..." }` | 添加到今天列表的顶部；`date` 晚于今天时加入"以后"列表；`project` 是项目名（2026-11-16 起，多于 20 个字截断） |
| PATCH | `/v1/todos/{id}` | `{ "title"?: "...", "completed"?: true }` | 只修改给出的字段 |
| DELETE | `/v1/todos/{id}` | — | 删除 |
| GET | `/v1/note` | — | `{ date, note }` |
| PUT | `/v1/note` | `{ "note": "..." }` 或 `{ "append": "..." }` | `note` 整体替换；`append` 追加一行 |
| GET | `/v1/clipboard?limit=20` | — | `{ items: [{ id, text, truncated, copiedAt, favorite }] }`：最近的文字记录（最多 50 条，每条最多 4000 字），打码的密钥只给打码后的样子。**默认关**，要在「设置 → 剪贴板」打开「允许本地接口读取历史」，否则 403（C38） |
| PUT | `/v1/agent-status/{source}` | `{ "phase": "running", "name"?: "Aider", "title"?: "...", "taskId"?: "...", "host"?: "dev-box", "agent"?: "claudeCode", "cwd"?: "..." }` | 上报一个 AI Agent 的状态，见下文 |
| DELETE | `/v1/agent-status/{source}` | — | 移除这个来源 |
| POST | `/v1/notify` | `{ "source": "ci", "title": "...", "body"?: "...", "name"?: "CI", "durationMs"?: 5000 }` | 在岛上弹一条消息，回 `{ shown, receivedAt }`，见下文「弹消息」。**默认关**，要在 设置 → 本机接口 打开「允许弹消息」，不需要「允许修改」 |

待办对象的格式为 `{ id, title, completed, createdAt, project? }`；`project` 是待办所属的项目（2026-11-12 起，issue #44），没有项目时不出现这个字段，接口和插件新建的待办不带项目。标题不能为空，最长 500 个字符。

状态码：`400` 参数错误，`401` 令牌错误，`403` 被拒绝（网页请求、Host 不对、未允许修改、未允许弹消息），`404` 路径或待办不存在，`405` 方法不对，`413` 请求体太大，`429` 弹消息太频繁或来源太多，`503` 这条路由要用的功能关着（见下）或岛屿暂时没有响应，`504` 岛屿没有及时响应。

### 功能关着时

一条路由转给哪个功能，那个功能的内置插件关着（设置 → 插件），就回 `503`，`error` 写明是哪个功能关了（2026-11-16 起，E36.3.43）：

| 路由 | 看哪个插件 | `error` |
|---|---|---|
| `/v1/todos`、`/v1/todos/{id}`、`/v1/note` | 待办 `todos` | `Todos are switched off in Fuyu.` |
| `/v1/agent-status/{source}` | AI Agent `agents` | `AI Agent is switched off in Fuyu.` |
| `/v1/clipboard` | 剪贴板 `clipboard` | `The clipboard is switched off in Fuyu.` |
| `/v1/notify` | 消息 `messages` | `Messages are switched off in Fuyu.` |

先查开关再查「允许修改」和「允许弹消息」，所以关着的功能上写请求也是 503。`/v1/health` 不看这些开关。数据不受影响，打开插件后照常读写。以前（E36.3.38 起）待办关着时接口照旧读写待办，文件中转、音乐关着时旧版插件接口却回 503，现在统一成一条。

## 开发模式（已删除）

旧版插件的开发模式路径 `/v1/dev/plugins…`（给旧版 `fuyu-plugin` 1.x 的 `dev` 用）随旧版插件宿主一起删除（E36.6.5，2026-11-18）。现在插件的开发联调见[命令行](../plugins/cli.md#dev)。

## 开发版专用：岛屿实验台

只在开发版（`pnpm tauri dev`）里有，正式版里是 404；不需要「允许修改」。给 `pnpm lab` 的实验台网页用，见 [island-lab.md](island-lab.md)。

| 方法 | 路径 | 请求体 | 说明 |
|---|---|---|---|
| POST | `/v1/dev/island/emit` | `{ "event": "device-alert", "payload": {...} }` | 把这个事件发给岛，载荷和真后端发的一样 |
| POST | `/v1/dev/island/action` | `{ "action": "open", "page": "agents" }` | `open`（要 `page`）、`collapse`、`tuck`、`reveal` |
| PUT / DELETE | `/v1/dev/island/notch` | `{ "width": 208, "height": 37.5 }` | 把刘海当成这个尺寸（逻辑点）；`DELETE` 取消 |

## AI Agent 状态

除了内置的 Codex 和 Claude Code，任何工具都可以通过这个接口点亮状态灯，并在折叠的岛上显示会话标题（没有品牌图标时显示机器人图标）：

- `source`：来源名，1–32 个小写字母、数字或 `-`，例如 `aider`。在设置里显示的 id 是 `local-api/<source>`。
- `phase`：`running`（蓝灯）、`waiting`（在等用户）、`failed`（黄灯）、`completed` 或 `idle`（不亮）。`running` 超过 10 分钟没有再次上报时显示为 `stale`（黄灯）。
- `name` 是显示名称，第一次上报时默认用 `source`。`title` 最长 120 个字符，`name` 最长 40 个字符。`name`、`title`、`host`、`agent`、`cwd` 省略时沿用上次的值。
- 另一台电脑上的会话：同时给出 `host`（机器名，最长 64 个字符）和 `agent`（`claudeCode` 或 `codex`）时，它会和本机会话一起列在 Agent 页上，显示机器名，点击时不找本地窗口；`cwd` 是它的目录（最长 260 个字符）。经 SSH 隧道上报的做法见 [agent-status-hooks.md](agent-status-hooks.md#sessions-on-other-computers)。
- 这些状态只保存在内存里，岛屿重启后就没有了。最多同时存在 16 个来源。

```powershell
# 在 Aider 等工具的开始 / 结束钩子里调用
Invoke-RestMethod "$api/agent-status/aider" -Method Put -Headers $headers -ContentType "application/json; charset=utf-8" `
  -Body ([Text.Encoding]::UTF8.GetBytes((@{ phase = "running"; name = "Aider"; title = "重构解析器" } | ConvertTo-Json)))
Invoke-RestMethod "$api/agent-status/aider" -Method Put -Headers $headers -ContentType "application/json" -Body '{"phase":"completed"}'
```

## 弹消息

`POST /v1/notify`（2026-11-19 起，C142）让脚本在岛上说一声：构建跑完了、下载好了、门铃响了。

- `source`：来源名，规则和上面的 Agent 状态一样（1–32 个小写字母、数字或 `-`）。在岛上的来源 id 是 `local-api/<source>`，设置 → 本机接口 →「消息来源」里按这个名字列出、按来源静音。
- `title` 必填，最长 120 个字；`body` 可省略，最长 500 个字；超了回 400，不截断。只收纯文本，不带按钮，不收图标地址（岛不去拉外面的图片）。
- `name` 是岛上显示的来源名，最长 40 个字；省略时沿用这个来源上次给的，第一次默认用 `source`。
- `durationMs` 是停留多久，1000–30000 的整数，默认 5000。
- 认不得的字段回 400，不忽略：以后加字段时，旧版本的岛会明确说不认识，而不是悄悄丢掉。
- 回 `{ "shown": true, "receivedAt": 1763540000000 }`。`shown` 是 `false` 的几种情况：这个来源在设置里被静音了；免打扰、游戏模式这类情况下岛不弹（和插件弹的消息同一套规则）。两种都回 200。
- 限频：每个来源每分钟最多 10 条，超了回 429；同时最多 16 个来源，满了以后新来源会顶掉最久没发、且最近一分钟没发过的那个，都在发就回 429。被静音的来源发的也计数。计数只在内存里，接口关掉或岛重启后清零。
- 弹出来的是岛上的临时消息，停留几秒后消失，不在消息页留记录（消息页只列 QQ、微信、邮件这类登记过的消息源，和插件的 `notify` 一样）。
- 消息（内置插件 `messages`）关着时回 503。

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"source":"ci","name":"CI","title":"构建通过","body":"main 分支 3 分 12 秒"}' \
  http://127.0.0.1:39271/v1/notify
```

```powershell
Invoke-RestMethod "$api/notify" -Method Post -Headers $headers -ContentType "application/json; charset=utf-8" `
  -Body ([Text.Encoding]::UTF8.GetBytes((@{ source = "ci"; name = "CI"; title = "构建通过" } | ConvertTo-Json)))
```

## 给 AI 工具用：MCP

`fuyu-plugin mcp`（C43）是一个 MCP 服务器，走标准输入输出，通过本地接口给 Claude Code、Cursor 这类工具三个只读工具：`clipboard_history`（最近的文字记录，可按文字筛选，需要上面那个剪贴板开关）、`todos_today`、`daily_note`。端口和令牌每次都从 `local-api.json` 读，岛屿换了端口也不用改配置。

```sh
claude mcp add fuyu -- npx -y fuyu-plugin@0.7.0 mcp
```

其他工具在 MCP 配置里写命令 `npx`、参数 `["-y", "fuyu-plugin@0.7.0", "mcp"]`。

> 它是旧版 SDK `fuyu-plugin` 0.7.0 里的旧实现，源码随旧版 SDK 从仓库删除（E36.6.6），不再维护；npm 上的 `fuyu-plugin` 2.0 起是现在插件的命令行，没有 `mcp`，所以命令里要写明 `@0.7.0`。

## 示例

PowerShell：

```powershell
$config = Get-Content "$env:APPDATA\com.tixxin.fuyu\local-api.json" | ConvertFrom-Json
$api = "http://127.0.0.1:$($config.port)/v1"
$headers = @{ Authorization = "Bearer $($config.token)" }

Invoke-RestMethod "$api/todos" -Headers $headers
Invoke-RestMethod "$api/todos" -Method Post -Headers $headers -ContentType "application/json" `
  -Body (@{ title = "写周报" } | ConvertTo-Json)
Invoke-RestMethod "$api/note" -Method Put -Headers $headers -ContentType "application/json; charset=utf-8" `
  -Body ([Text.Encoding]::UTF8.GetBytes((@{ append = "10:30 开会" } | ConvertTo-Json)))
```

curl：

```bash
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:39271/v1/todos
curl -X PATCH -H "Authorization: Bearer $TOKEN" -d '{"completed":true}' \
  http://127.0.0.1:39271/v1/todos/<id>
```

## 实现说明

AI Agent 状态由 Rust 直接处理（`src-tauri/src/agent_status/external.rs`）。待办和笔记存放在应用数据目录的 `todos.json` 中（2026-11 起；更早的版本存在主窗口的 `localStorage`，首次启动时由主窗口迁移过来）。请求的处理流程是：

1. Rust（`src-tauri/src/local_api/`）校验请求并转换成方法名，例如 `todos.add`。
2. 岛屿刚启动、主窗口还没完成迁移时，待办请求最多等 10 秒。
3. 待办在 `todos.json` 时，由 Rust 直接读写（`src-tauri/src/todos/calls.rs`，规则与 `src/features/todos/apiCommands.ts` 相同），再通知主窗口刷新界面。主窗口卡住或没有显示时也能正常读写。
4. 只有迁移失败、这次运行仍在用 `localStorage` 时，才像以前一样通过事件 `local-api-request` 交给 `main` 窗口执行（2026-11-16 起由岛上的桥接住，经窗口里的 `todos/v1` 服务交给待办，E36.3.38）；窗口 5 秒内没有回应时返回 504。

界面会实时刷新，修改也会和手动操作一样被保存。待办插件关着时这些路由回 503（见上面「功能关着时」）。

HTTP 服务是内置插件 `local-api` 的后台 `server`（`src-tauri/src/local_api/background.rs`），由插件开关表起停；「功能关着时」的规则在 `local_api/switches.rs`；设置页的命令（`get_local_api_info`、`reset_local_api_token`、`copy_local_api_token`）在 `local_api/settings.rs`，页面在 `src/features/local-api/`（`LocalApiSettings.tsx` 组装各组，`LocalApiAccess.tsx` 是权限，`LocalApiSenders.tsx` 和 `senders.ts` 是消息来源，`LocalApiExample.tsx` 和 `example.ts` 是示例），令牌只由 Rust 写进剪贴板，不回窗口。岛上接 `local-api-request` 的桥在 `src/features/island-bridge/`（不是插件，runner 的拥有者是 `builtin`）：这座桥还给旧版插件的待办调用和岛屿实验台用，所以不归本机接口，关掉本机接口不撤它。

弹消息（`local_api/notify.rs`）：Rust 校验字段、查「允许弹消息」、按来源限频并记住显示名，再经 `local-api-request`（方法 `notify`，参数 `{ source: "local-api/<source>", name, title, body, durationMs }`）交给岛；岛上的桥（`src/features/island-bridge/notice.ts`）记下这个来源、查它有没有被静音，没静音就调窗口里的 `island-notices/v1` 弹出，和插件的消息走同一个出口。静音和来源列表用的是插件消息那一套存储（`fuyu-plugin-notice-mutes`、`fuyu-plugin-notice-senders`，`src/lib/plugin-notice-mutes/`）。
