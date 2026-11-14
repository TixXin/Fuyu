# 权限与安全

插件只能调用清单里申请、用户同意了的岛屿接口。本文列出每个权限能做什么、用户在什么时候被询问，以及权限管不到的地方。

## 权限表

| 权限 | 能调用的方法 | 能订阅的事件 |
|---|---|---|
| `todos:read` | `todos.list`、`todos.days` | `todos.changed` |
| `todos:write` | `todos.add`、`todos.update`、`todos.remove` | |
| `notes:read` | `note.get` | `note.changed` |
| `notes:write` | `note.set` | |
| `agent-status:read` | | `agentStatus.changed` |
| `agent-status:write` | `agentStatus.report`、`agentStatus.clear` | |
| `island:notify` | `island.notify` | |
| `secrets` | `secrets.get`、`secrets.set`、`secrets.delete` | |
| `clipboard:read`（敏感） | `clipboard.history` | `clipboard.changed` |
| `messages:read`（敏感） | `messages.list` | `messages.received` |
| `media:read`（敏感） | `media.nowPlaying`、`media.cover` | `media.changed` |
| `media:control` | `media.playPause`、`media.next`、`media.previous`、`media.seek`、`media.setVolume`、`media.toggleShuffle`、`media.cycleRepeat` | |
| `shelf:read`（敏感） | `shelf.list` | `shelf.changed` |
| `shelf:write`（敏感） | `shelf.add`、`shelf.remove` | |
| `windows`（实验） | `window.*`、`screens.list` | 通知 `window.*`、`screens.changed` |

`windows` 是实验接口：清单里同时写 `"experimentalApis": ["windows"]`，插件只能在开发模式下加载，暂时只有 Windows 有。用户在设置 → 插件扩展 → 这个插件 → 窗口里可以不允许置顶、不允许点击穿透，或者隐藏它的全部窗口。设计和护栏见 [插件的独立窗口](../architecture/plugins/plugin-windows.md)。

不需要权限的：`host.*`、`settings.*`、`ui.setInfo`、`events.subscribe` / `unsubscribe`、`storage.*`、`permissions.request`、`view.*`、`webview.postMessage`、`status.update`、`island.openView`，以及事件 `island.expanded`、`island.collapsed`、`app.locale.changed`、`system.*`。

QQ 邮箱授权码、翻译服务密钥这类岛屿保存的凭据，任何权限都拿不到。

## 用户什么时候被询问

**启用时。** 用户启用插件时，一次授予清单 `permissions` 里的全部权限。插件卡片和插件市场会列出它们。

**升级时。** 新版本要求更多权限时，插件先暂停，等用户重新授权。这样的更新也不会自动安装。

**敏感权限第一次使用时。** 标着「敏感」的权限，启用时照常授予，但插件**第一次实际使用**（调用方法或订阅事件）时，岛上还会弹出一行确认：「<插件名> 想读取剪贴板历史 [允许] [本次] [拒绝]」。

- 插件的这次请求会一直等到用户回答，最多 30 秒。所以插件的请求超时要设得比 30 秒长（Node.js SDK 不限时，PowerShell SDK 等 40 秒）。
- **允许** / **拒绝**：记下来，以后不再询问。拒绝时插件收到 `-32001`。
- **本次**：这次允许，插件进程重启后会再问。
- 30 秒没有回答：这次按拒绝处理（`-32001`），不记下来，下次使用再问。
- 岛屿贴边收起时，确认会先把岛屿露出来。全屏游戏等让岛屿隐藏的时候用户可能看不到，插件会在 30 秒后收到 `-32001`。
- 用户可以在插件设置页的「需要询问的权限」里看到这些回答，随时撤销。撤销后下次使用会再问，需要这个权限的事件订阅立即断开。

## 可选权限

只在某个功能里才用到的权限，写进清单的 `optionalPermissions`，不要写进 `permissions`。启用插件时不要求用户同意它们，市场和插件卡片把它们标成「可选，用到时询问」。用户更容易装一个一开始不要剪贴板的插件。

```json
"permissions": ["todos:read"],
"optionalPermissions": ["clipboard:read"]
```

- 用之前调用 `permissions.request { permissions: ["clipboard:read"] }`。岛上用和敏感权限一样的确认询问用户，返回 `{ granted, denied }`；一次可以申请多个，逐个询问。
- 没有获准就调用需要它的方法或订阅事件，返回 `-32001`，错误信息提示先调用 `permissions.request`。
- 回答的记法和敏感权限相同。记下的拒绝不会再弹出询问，`permissions.request` 直接把它放进 `denied`，直到用户在设置页撤销这个回答。
- `initialize.permissions` 是插件现在能用的权限（`permissions` 加上已获准的可选权限）。
- SDK：Node `plugin.permissions.request("clipboard:read")`、`plugin.permissions.has(name)`；PowerShell `Request-FuyuPermission 'clipboard:read'`。模拟宿主的 `deny` 选项决定可选权限的回答。

## 调用记录

插件设置页的「调用记录」列出插件最近 200 次请求了哪个方法、结果如何（成功、没有权限、没有这个方法、出错和状态码），最新的在最上面，同一方法连续得到同样的结果合成一行并计数。只记方法名，不记参数和返回内容，岛屿重启后清空。用户可以用它看插件实际在做什么，插件不需要配合。

## 权限管不到的地方

权限只限制插件能调用哪些**岛屿接口**。插件程序本身以当前用户的身份运行：它可以读写文件、联网，也能直接读 Windows 凭据管理器里当前用户的条目（包括岛屿保存的邮箱授权码和翻译密钥）。岛屿的接口不会把这些交给插件，但拦不住插件进程自己去读。

所以：

- 第三方插件默认不运行，用户要在 **设置 → 插件扩展** 打开「允许运行第三方插件」。
- 插件市场要求源码公开，维护者人工审核后才上架；申请新权限、第一次加入自定义网页、换了运行时的版本也要再审。
- 第一次安装某个发布者的插件时，用户要先点「信任并安装」。
- 设置页写明了这一点，提醒用户只装信任的发布者的插件。

用 AppContainer 或受限令牌隔离插件进程，会让 Node.js 和 PowerShell 插件无法正常运行，目前不做。

同样的原因，[自定义网页](ui.md#自定义网页) 的联网和 WebRTC 屏蔽是为了减少意外，不是安全边界：页面里的数据都来自它自己的插件进程，而插件进程本来就能联网。

## 写插件时

- 只申请用得到的权限。`npx fuyu-plugin validate` 会提示「申请了但似乎没用到」的权限。
- 不是每次都用到的敏感权限，放进 `optionalPermissions`，在用户点了相关功能时再申请。
- 被拒绝时给出说明，让功能降级，不要反复申请。
- 令牌放进 `secrets`，不要放进设置或 `storage`。
