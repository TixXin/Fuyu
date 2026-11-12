# 插件 API 参考

> 由 `pnpm sdk:build` 根据 [`plugins/schema/rpc.json`](../../plugins/schema/rpc.json) 生成，不要手改。各项的说明直接取自这份协议文件，是英文；用法和例子见 [岛上界面](ui.md)、[运行与通信](runtime.md) 和 [权限与安全](permissions.md)。

插件和岛屿通过 stdin / stdout 交换 JSON-RPC 2.0 消息，每行一条。本页按插件 API 第 2 版写（清单 `"apiVersion": 2`）。还在用第 1 版的插件能调用的方法只有：`host.info`、`settings.get`、`ui.setInfo`、`todos.list`、`todos.add`、`todos.update`、`todos.remove`、`note.get`、`note.set`、`agentStatus.report`、`agentStatus.clear`，见 [运行与通信](runtime.md#第-1-版插件)。

## 能力

`initialize.capabilities` 列出岛屿为这个插件提供的能力。以后的岛屿可能增加新能力，用之前先查这个列表；旧版岛屿会忽略它不认识的可选字段。

| 能力 | 含义 |
|---|---|
| `events` | events.subscribe / events.unsubscribe and the 'event' notification. |
| `notifications` | island.notify and the 'notification.action' notification. |
| `storage` | storage.get / set / delete / keys. |
| `secrets` | secrets.get / set / delete. |
| `views` | contributes.views drawn on the island; view.update / view.patch and the view.action / view.submit / view.search / view.visible notifications. |
| `status` | contributes.statusItems on the collapsed bar; status.update. |
| `webview` | contributes.views with template 'webview' (the plugin's own HTML page); webview.postMessage and the 'webview.message' notification. |
| `permissions` | manifest optionalPermissions and permissions.request; initialize.optionalPermissions. |
| `openView` | island.openView: a plugin opens its own page right after the user used it. |
| `statusCells` | status.update draws 'cells' (label-over-value columns) and a 'ring' (0-1). Islands without it ignore both and show the text. |
| `notifyStyle` | island.notify takes 'icon' ('media': the icon of the app playing media) and 'layout' ('inline': alone in the new-messages popup, the island is the message, with no title row or card). Islands without it ignore both. |
| `notifyControls` | island.notify takes 'controls' ('media': the island draws previous, play / pause and next beside the message and runs them itself; the plugin needs no media:control). Islands without it ignore it. |
| `statusBatteries` | status.update draws 'batteries' (upright batteries, each 0-1 full). Islands without it ignore them and show the text or cells. |
| `statusPie` | status.update draws a 'pie' (up to 4 slices sized by their values). Islands without it ignore it and show the text or cells. |

## 权限一览

敏感权限在插件第一次使用时还要用户在岛上确认，拒绝时返回 `-32001`。详见 [权限与安全](permissions.md)。

| 权限 | 敏感 |
|---|---|
| `todos:read` |  |
| `todos:write` |  |
| `notes:read` |  |
| `notes:write` |  |
| `agent-status:read` |  |
| `agent-status:write` |  |
| `island:notify` |  |
| `secrets` |  |
| `clipboard:read` | 是 |
| `messages:read` | 是 |
| `media:read` | 是 |
| `media:control` |  |
| `shelf:read` | 是 |
| `shelf:write` | 是 |

## 宿主、设置与运行信息

### `host.info`

- 权限：不需要
- 参数：无
- 结果：Same as the initialize params.

### `settings.get`

- 权限：不需要
- 参数：无
- 结果：Every declared setting with its current value (defaults filled in).

### `settings.set`

- 权限：不需要
- 参数：
  - `values`：{ key: value }: settings from the manifest's contributes.settings, each of its declared type
- 结果：{ settings }: every setting afterwards. All or none: an unknown key or a wrong type is status 400 and changes nothing. The settings page shows the new values; the plugin gets no settings.changed for its own change.

### `ui.setInfo`

- 权限：不需要
- 参数：
  - `items`：[{ label: LocalizedText, value: string (max 500 chars), copy?: boolean, secret?: boolean }] (max 10; empty clears)
- 结果：{}

### `host.keepAlive`

- 权限：不需要
- 参数：
  - `reason`：string (1-100 chars) shown on the plugin page; null lets the plugin stop when idle again
- 结果：{}. Only matters for on-demand plugins (activationEvents), which otherwise stop after 60 s with nothing to do.

## 权限

### `permissions.request`

- 权限：不需要
- 参数：
  - `permissions`：[name]: 1-14 names from the manifest's optionalPermissions (or permissions)
- 结果：{ granted: [name], denied: [name] }. The island asks the user about each optional permission not answered yet (allow, allow once, deny; at most 30 s each, no answer is a denial that is asked again next time). A remembered deny is not asked again until the user revokes it in the plugin's settings. A name the manifest does not list is status 400.

## 事件订阅

### `events.subscribe`

- 权限：不需要
- 参数：
  - `events`：[string] (max 16; each needs the event's permission; all are checked before any is applied)
- 结果：{ events }: every event the plugin is subscribed to, sorted

### `events.unsubscribe`

- 权限：不需要
- 参数：
  - `events`：[string] (max 16)
- 结果：{ events }

## 岛上界面

### `view.update`

- 权限：不需要
- 参数：
  - `viewId`：one of the plugin's contributes.views
  - `model`：object for the view's template (see docs/plugins/README.md); max 256 KB as JSON, else status 413
- 结果：{}. The island shows at most 10 changes a second per view (later ones are merged) and only while the page is on screen.

### `webview.postMessage`

- 权限：不需要
- 参数：
  - `viewId`：one of the plugin's views with template webview
  - `message`：any JSON value; max 256 KB
- 结果：{ shown }: false when the page is not on screen (the message is dropped). Messages sent before the page's script runs are lost too, so wait for the page to post that it is ready.

### `view.patch`

- 权限：不需要
- 参数：
  - `viewId`：string
  - `items?`：[{ id, ... }]: replace the items with these ids in model.items and model.groups[].items
  - `remove?`：[id]: delete the items with these ids
  - `add?`：[{ item: { id, ... }, before?: id, group?: number }]: insert before the item `before`, else at the end of model.groups[group].items, else at the end of model.items; an id already in the view is status 400
- 结果：{ missing: [id] }: ids not found (an add whose `before` is missing goes at the end). At least one of items, remove and add. Status 409 before the first view.update.

### `status.update`

- 权限：不需要
- 参数：
  - `itemId`：one of the plugin's contributes.statusItems
  - `text`：string, max 24 characters; empty clears the item
  - `tooltip?`：string, max 200
  - `tone?`：neutral | accent | warning | danger
  - `cells?`：[{ label: string max 6, value: string max 8, tone?: as above }], at most 4; drawn instead of the text (capability statusCells)
  - `ring?`：number 0-1: a small progress ring in the item's tone before the text or cells (capability statusCells)
  - `batteries?`：[{ level: number 0-1, tone?: as above }], at most 4 upright batteries drawn instead of the text and cells; one without a tone takes its place's color (capability statusBatteries)
  - `pie?`：[{ value: number >= 0, tone?: as above }], at most 4 slices of a small pie, each sized by its share of the total, drawn instead of the text and cells (batteries win when both are set); one without a tone takes its place's color, all zero draws an empty circle (capability statusPie)
- 结果：{}

### `island.openView`

- 权限：不需要
- 能力：`openView`
- 参数：
  - `viewId`：one of the plugin's contributes.views
- 结果：{}. Shows the island and opens that page. Only within 15 s of the user using the plugin (a command or its shortcut, an island.notify button, a focusd:// link, an action, form or webview message on one of its pages), else status 403; a view the plugin does not declare is status 404.

### `island.notify`

- 权限：`island:notify`
- 参数：
  - `title`：string (1-80 chars)
  - `body?`：string (max 200)
  - `durationMs?`：number, clamped to 2000-15000, default 5000
  - `actions?`：[{ id: [A-Za-z0-9-]{1,32}, title: string (max 16) }] (max 2)
  - `icon?`：'plugin' (default) | 'media': the icon of the app playing media, else the plugin's (capability notifyStyle)
  - `layout?`：'card' (default) | 'inline': alone in the new-messages popup, no title row or card (capability notifyStyle)
  - `controls?`：'none' (default) | 'media': previous, play / pause and next beside the message, run by the island (capability notifyControls)
- 结果：{ muted }: true when the user turned this plugin's messages off (nothing is shown). At most 6 per minute per plugin, else -32000 with status 429.

## 插件自己的数据

### `storage.get`

- 权限：不需要
- 参数：
  - `key`：string (1-128 chars)
- 结果：{ value }: null when the key is not set

### `storage.set`

- 权限：不需要
- 参数：
  - `key`：string (1-128 chars)
  - `value`：any JSON (max 64 KB as JSON; the plugin's whole storage max 1 MB, else status 413)
- 结果：{}

### `storage.delete`

- 权限：不需要
- 参数：
  - `key`：string
- 结果：{ deleted }

### `storage.keys`

- 权限：不需要
- 参数：无
- 结果：{ keys }

### `secrets.get`

- 权限：`secrets`
- 参数：
  - `key`：letters, digits, '.', '_', '-' (1-64 chars)
- 结果：{ value }: null when not set

### `secrets.set`

- 权限：`secrets`
- 参数：
  - `key`：as above
  - `value`：string (max 1024 chars); at most 32 secrets per plugin (status 413)
- 结果：{}

### `secrets.delete`

- 权限：`secrets`
- 参数：
  - `key`：as above
- 结果：{ deleted }

## 待办与每日笔记

### `todos.list`

- 权限：`todos:read`
- 参数：
  - `date?`：YYYY-MM-DD (since 2); missing means today
- 结果：{ date, todos, scheduled, activeTodoId }. A past date reads that day's archive ({ ..., archived: true }; status 404 when nothing was archived for it); a later date gives the todos scheduled for it in 'scheduled'.

### `todos.days`

- 权限：`todos:read`
- 参数：
  - `from`：YYYY-MM-DD
  - `to`：YYYY-MM-DD
- 结果：{ days: [{ date, total, completed, hasNote, archived }] }: today and every archived day from 'from' to 'to' (inclusive), oldest first.

### `todos.add`

- 权限：`todos:write`
- 参数：
  - `title`：string
  - `date?`：YYYY-MM-DD; later than today goes to the 'later' list
- 结果：The new todo.

### `todos.update`

- 权限：`todos:write`
- 参数：
  - `id`：string
  - `title?`：string
  - `completed?`：boolean
- 结果：The changed todo.

### `todos.remove`

- 权限：`todos:write`
- 参数：
  - `id`：string
- 结果：{ id }

### `note.get`

- 权限：`notes:read`
- 参数：
  - `date?`：YYYY-MM-DD (since 2); missing means today
- 结果：{ date, note }. A past date reads that day's archived note ({ ..., archived: true }; status 404 when nothing was archived); a later date is status 400.

### `note.set`

- 权限：`notes:write`
- 参数：
  - `note | append`：string
- 结果：{ date, note }

## AI Agent 状态

### `agentStatus.report`

- 权限：`agent-status:write`
- 参数：
  - `source`：string
  - `phase`：idle | running | waiting | completed | failed
  - `name?`：string
  - `title?`：string
  - `taskId?`：string
  - `host?`：string (max 64): the machine it runs on
  - `agent?`：claudeCode | codex
  - `cwd?`：string (max 260)
- 结果：The saved status; id is '<plugin id>/<source>'.

### `agentStatus.clear`

- 权限：`agent-status:write`
- 参数：
  - `source?`：string; omitted clears every source of the plugin
- 结果：{ cleared }

## 剪贴板、消息与文件中转

### `clipboard.history`

- 权限：`clipboard:read`（敏感）
- 参数：
  - `limit?`：1-50, default 20
- 结果：{ items: [{ id, text (max 4000 chars), truncated, copiedAt, favorite }] }: text items only, newest first. Status 409 while clipboard history is off.

### `messages.list`

- 权限：`messages:read`（敏感）
- 参数：无
- 结果：{ items: [{ source: qq | wechat | qqMail, id, sender, preview, receivedAt, unread? }] }, newest first, from the sources the user switched on. WeChat entries have sender and preview null (only the tray flash is known); qqMail preview is the subject, never the body.

### `shelf.list`

- 权限：`shelf:read`（敏感）
- 参数：无
- 结果：{ items: [{ id, path, name, isDir, size, addedAt, pinned, missing, unreachable }] }: paths only, never file contents.

### `shelf.add`

- 权限：`shelf:write`（敏感）
- 参数：
  - `paths`：[string] (1-20 absolute paths of existing files or folders; others are skipped)
- 结果：Same as shelf.list, afterwards.

### `shelf.remove`

- 权限：`shelf:write`（敏感）
- 参数：
  - `ids`：[string] (1-20); only takes entries off the shelf, never deletes files
- 结果：Same as shelf.list, afterwards.

## 媒体

### `media.nowPlaying`

- 权限：`media:read`（敏感）
- 参数：无
- 结果：{ available, status, title, artist, album, sourceApp, positionMs, durationMs, canSeek, canNext, canPrevious, shuffle (true | false | null), repeat ('none' | 'track' | 'list' | 'unknown'), volume (system volume 0-1, or null) }. No cover image: see media.cover.

### `media.cover`

- 权限：`media:read`（敏感）
- 参数：无
- 结果：{ cover }: the cover of what plays as a data: URL, or null (none, or larger than 1 MB).

### `media.playPause`

- 权限：`media:control`
- 参数：无
- 结果：Same as media.nowPlaying, after the command.

### `media.next`

- 权限：`media:control`
- 参数：无
- 结果：Same as media.nowPlaying, after the command.

### `media.previous`

- 权限：`media:control`
- 参数：无
- 结果：Same as media.nowPlaying, after the command.

### `media.seek`

- 权限：`media:control`
- 参数：
  - `positionMs`：whole number from 0
- 结果：Same as media.nowPlaying, after the command. Fails when the player cannot seek (canSeek false).

### `media.setVolume`

- 权限：`media:control`
- 参数：
  - `level`：0-1
- 结果：Same as media.nowPlaying. Sets the system volume of the default output, like the island's own slider.

### `media.toggleShuffle`

- 权限：`media:control`
- 参数：无
- 结果：Same as media.nowPlaying, after the command.

### `media.cycleRepeat`

- 权限：`media:control`
- 参数：无
- 结果：Same as media.nowPlaying: none, then list, then track.

## 事件

用 `events.subscribe` 订阅，岛屿用通知 `event { name, payload }` 推送。

| 事件 | 权限 | 载荷 |
|---|---|---|
| `todos.changed` | `todos:read` | { date }; call todos.list for the todos |
| `note.changed` | `notes:read` | { date }; call note.get for the text |
| `agentStatus.changed` | `agent-status:read` | { agents: [{ id, name, phase, title? }] } |
| `island.expanded` | 不需要 | {} |
| `island.collapsed` | 不需要 | {} |
| `app.locale.changed` | 不需要 | { locale } |
| `clipboard.changed` | `clipboard:read` | {}; call clipboard.history. Only while clipboard history is on. |
| `messages.received` | `messages:read` | One entry as in messages.list: { source, id, sender, preview, receivedAt, unread? } |
| `media.changed` | `media:read` | Same as media.nowPlaying; sent when the track, player or play state changes (checked every 2 s while subscribed), not for the position. |
| `shelf.changed` | `shelf:read` | { count }: the file shelf changed (by the user or a plugin); call shelf.list for the entries. |
| `system.locked` | 不需要 | {}: the user locked the session (Win+L, or away). |
| `system.unlocked` | 不需要 | {}: the session was unlocked. |
| `system.suspended` | 不需要 | {}: the computer is going to sleep; there is little time left to save. |
| `system.resumed` | 不需要 | {}: the computer woke up. |
| `system.idle` | 不需要 | { idleSeconds }: no keyboard or mouse input for 5 minutes (checked every 5 s); sent once until input comes back. |
| `system.active` | 不需要 | {}: input again after system.idle. |

## 岛屿发给插件的通知

### `initialize`

{ apiVersion, capabilities (since 2), activationEvent (since 2: onStartup, onCommand:<id>, onView:<id>, onEvent:<name>, onSchedule:<minutes>, onStartupFinished, onUri, or onSettingsChanged when the user changed the settings of an on-demand plugin that was not running), appVersion, pluginId, dataDir, permissions (those usable now: the manifest's permissions plus the optional ones the user allowed), optionalPermissions (since 2), settings, experimentalApis (only for a development-mode plugin whose manifest lists experimentalApis: those the island has) }

### `command`

{ id, args? }: a button on the plugin page or the command's keybinding (since 2) sends { id }; an entry of the todo right-click menu (contributes.menus "todo/context", since 2) sends { id, args: { todoId } }; of the clipboard, file shelf or message right-click menu ("clipboard/context", "shelf/context", "message/context") sends { id, args: { item } }, the entry as clipboard.history, shelf.list or messages.list show it

### `settings.changed`

{ settings }

### `event`

{ name, payload }; at most one per event name every 200 ms, carrying the latest payload, except messages.received, which delivers every message (up to 50 per 200 ms). Subscriptions end when the process exits, and events that need a sensitive permission stop as soon as the user revokes it.

### `notification.action`

{ id }: the user clicked that button of an island.notify message

### `uri`

{ uri, path, query }: a focusd://plugin/<id>/<path>?<query> link was opened (only with activationEvents onUri, after the user allowed it on the island; query is still percent-encoded)

### `view.visible`

{ viewId, visible }: the page was opened or closed; send updates while it is visible

### `view.action`

{ viewId, actionId, itemId?, checked? }: the user clicked an action or an item, or a check box (checked)

### `view.submit`

{ viewId, values }: the user submitted the form

### `view.search`

{ viewId, query }: the user typed in the list's search box (only if the model asks for searchMode remote)

### `webview.message`

{ viewId, message }: the plugin's webview page called acquireFuyuApi().postMessage(message) (max 256 KB)

### `shutdown`

{}

## 插件发给岛屿的通知

### `log`

{ message }

## 错误码

| 代码 | 含义 |
|---|---|
| `-32700` | Not valid JSON. |
| `-32600` | Not a valid JSON-RPC 2.0 message. |
| `-32601` | Unknown method. |
| `-32001` | The plugin was not given the permission the method needs. |
| `-32000` | The island answered with an error; data.status is 400 bad params, 404 not found, 413 too large, 409 the feature is switched off, 429 too many requests, 500 the host could not do it (e.g. a file or the Credential Manager failed), 504 no answer in time. |
