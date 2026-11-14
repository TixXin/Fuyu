# 清单 fuyu-plugin.json

每个插件文件夹里都有一份清单。它告诉岛屿：插件叫什么、要启动哪个程序、什么时候启动、要哪些权限，以及在岛上放哪些东西。机器可读的完整定义是 [`plugins/schema/manifest.schema.json`](../../plugins/schema/manifest.schema.json)，`npx fuyu-plugin validate` 按它检查。

## 文件夹

```text
<插件 id>/              # 文件夹名必须等于插件 id
├── fuyu-plugin.json    # 清单
├── main.ps1            # runtime.command 指向的程序
└── ...                 # 其他文件随意
```

手动安装的插件放在岛屿的插件目录：默认是 `~/.fuyu/plugins/<插件 id>/`（Windows 上是 `%USERPROFILE%\.fuyu\plugins\<插件 id>\`），数据目录被 `FUYU_HOME` 或 `home.json` 改过时在别处，最稳妥的是在 **设置 → 插件扩展 → 插件目录 → 打开** 里找。插件的数据不要写在这里，更新插件时会被覆盖；写进岛屿准备好的数据目录，见 [运行与通信](runtime.md#环境变量)。

## 例子

```json
{
  "id": "dev.example.todo-sync",
  "name": { "zh-CN": "待办同步", "en": "Todo Sync" },
  "description": { "zh-CN": "把待办同步到……", "en": "Syncs todos to…" },
  "version": "1.0.0",
  "apiVersion": 2,
  "minAppVersion": "0.3.0",
  "author": "example",
  "homepage": "https://github.com/example/todo-sync",
  "runtime": { "type": "process", "command": "main.ps1" },
  "activationEvents": ["onEvent:todos.changed"],
  "permissions": ["todos:read"],
  "optionalPermissions": ["clipboard:read"],
  "contributes": {
    "commands": [
      { "id": "sync-now", "title": { "zh-CN": "立即同步", "en": "Sync now" }, "keybinding": "Ctrl+Alt+S" },
      { "id": "push-todo", "title": { "zh-CN": "推送这条", "en": "Push this one" } }
    ],
    "menus": { "todo/context": [{ "command": "push-todo" }] },
    "views": [{ "id": "main", "title": { "zh-CN": "同步", "en": "Sync" }, "icon": "list-checks", "template": "list" }],
    "statusItems": [{ "id": "state" }],
    "settings": [
      { "key": "interval", "type": "number", "title": { "zh-CN": "间隔（分钟）", "en": "Every (minutes)" }, "min": 1, "max": 60, "default": 5 }
    ]
  }
}
```

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 3–64 个字符，只能用小写字母、数字、`.`、`-`，必须和文件夹名相同。建议用反向域名，例如 `dev.yourname.xxx`。含 `fuyu` 或 `focusd` 的 id 留给官方插件 |
| `name` | ✅ | `{ "zh-CN": "…", "en": "…" }`，中英文都要有 |
| `description` | | 中英文说明，显示在插件市场和插件卡片上 |
| `version` | ✅ | 1–32 个字符。上架的插件用 semver，例如 `1.2.0`、`1.3.0-beta.1` |
| `apiVersion` | ✅ | 写 `2`。`1` 只为旧插件保留，见 [第 1 版插件](runtime.md#第-1-版插件) |
| `minAppVersion` | | 需要的最低浮屿版本，不够时插件显示为「无法加载」。用到某个版本才有的功能时写上，见 [更新日志](changelog.md) |
| `author`、`homepage` | | 主页只显示 `https://` 链接 |
| `runtime` | ✅ | 怎么运行，见下文的「运行方式」 |
| `platforms` | | 插件能在哪些系统上运行：`windows`、`macos`。不写时 `.exe` 插件只算 Windows，其他两个系统都算。不支持当前系统的插件在设置和市场里标出来，不会启动；市场按发布时清单里的 `platforms` 显示，已上架的版本可以在 fuyu-plugins 的提交文件里补上。Mac 上 `.ps1` 插件要装 PowerShell 7（`pwsh`，比如 `brew install powershell`），`.js` 插件要装 Node.js；浮屿在 PATH、`/opt/homebrew/bin`、`/usr/local/bin`、登录 shell 的 PATH 和 nvm 等版本管理器的目录里找 |
| `activationEvents` | | 什么时候启动插件进程，最多 20 个。不写时随岛屿一直运行。见 [按需启动](runtime.md#按需启动) |
| `permissions` | | 启用插件时要用户同意的权限，见 [权限与安全](permissions.md) |
| `optionalPermissions` | | 用到时才申请的权限，见 [可选权限](permissions.md#可选权限) |
| `contributes` | | 插件往岛上放的东西，见下文 |
| `experimentalApis` | | 申请还在设计中的 API，见下文的「实验 API」 |

所有给用户看的文字都可以写成字符串，或 `{ "zh-CN": "…", "en": "…" }`，岛屿按当前语言选。`name`、命令和设置的标题必须两种语言都写。

## 运行方式

```json
"runtime": { "type": "process", "command": "main.ps1", "args": [] }
```

`command` 是插件文件夹里的相对路径，岛屿按扩展名启动它：

| 扩展名 | 启动方式 | 用户要装什么 |
|---|---|---|
| `.ps1` | `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <文件>` | 什么都不用装 |
| `.exe` | 直接运行 | 什么都不用装 |
| `.js` / `.mjs` / `.cjs` | `node <文件>` | Node.js |

**给普通用户用的插件，优先选 `.ps1` 或 `.exe`。** 插件市场和插件卡片会按扩展名标出「无需另外安装」或「需要 Node.js」。岛屿在 PATH 和 `%ProgramFiles%\nodejs` 里找 `node.exe`，找不到时提示用户并给出下载链接；用户在岛屿运行期间装好 Node.js，不用重启岛屿。

不支持 `.cmd` / `.bat`：停止 `cmd.exe` 时，它启动的程序会继续运行。

`{ "type": "none" }` 表示只有清单、不运行程序，例如下文的音效包和强度名称。

## 往岛上放什么：contributes

| 字段 | 最多 | 是什么 | 见 |
|---|---|---|---|
| `commands` | 8 个 | 插件设置页上的按钮，可以带全局快捷键 | 下文 |
| `menus` | 每个菜单 4 项 | 把命令放进待办、剪贴板、文件中转、消息的右键菜单 | 下文 |
| `settings` | 20 项 | 设置项，由岛屿画在插件的设置页上 | 下文 |
| `views` | 2 个 | 岛屿展开后的页面 | [岛上界面](ui.md#页面) |
| `statusItems` | 2 个 | 收起条上的一小段状态 | [岛上界面](ui.md#收起条) |
| `sounds` | | AI Agent 提示音 | 下文 |
| `agentEffortLabels` | | 改写 Agent 页上推理强度的显示 | 下文 |

### 命令、快捷键和菜单

```json
"commands": [
  { "id": "start", "title": { "zh-CN": "开始番茄钟", "en": "Start pomodoro" },
    "keybinding": "Ctrl+Alt+P", "when": "island.expanded && island.page == todo" }
]
```

- `id` 只能用字母、数字和 `-`。每个命令都会显示为插件设置页「操作」一栏里的一个按钮，点了插件收到通知 `command { id }`。
- `keybinding`：全局快捷键，一个或多个修饰键（`Ctrl`、`Alt`、`Shift`、`Win`）加一个键：字母、数字、`F1`–`F24`、`Esc`、`Tab`、`Enter`、`Space`、方向键、`Home` / `End`、`PageUp` / `PageDown`、`Insert` / `Delete`、`Backspace`。大小写和空格不限，岛屿规范成 `Ctrl+Alt+P` 这样的写法；写不出合法组合时清单无效。
- 清单里的快捷键只是默认值。用户可以在 **设置 → 快捷键 → 插件快捷键** 里改成别的组合、关掉，或者给没写 `keybinding` 的命令设一个。
- 启用并授权了的插件才注册快捷键。[按需启动](runtime.md#按需启动) 的插件待命时也注册着，按下时启动它。组合键已经被别的程序、岛屿或另一个插件占用时注册失败，插件卡片上会提示，先注册的一方不受影响。
- `when`：快捷键在什么情况下生效，最长 200 个字符，由岛屿求值，不运行插件代码。可用的名称：`island.expanded`（岛屿是否展开）、`todos.hasActive`（有没有正在进行的待办）、`island.page`（当前页面：`todo`、`music`、`clipboard`、`shelf`、`qq`、`agents`、`translation`）。用 `==` / `!=` 比较（值可以加引号），用 `&&`、`||`、`!` 和括号组合，`&&` 比 `||` 优先。不认识的名称当作假，语法写错的 `when` 永远不生效，不写表示总是生效。

```json
"menus": {
  "todo/context": [{ "command": "push-todo" }],
  "clipboard/context": [{ "command": "translate-this" }]
}
```

| 菜单 | 出现在 | 插件收到 |
|---|---|---|
| `todo/context` | 待办条目的右键菜单 | `command { id, args: { todoId } }`，要内容时用 `todos.list` 查 |
| `clipboard/context` | 剪贴板历史里的文字条目 | `command { id, args: { item } }`，`item` 和 `clipboard.history` 的一项相同 |
| `shelf/context` | 文件中转的条目 | `item` 和 `shelf.list` 的一项相同 |
| `message/context` | QQ 通知和邮件 | `item` 和 `messages.list` 的一项相同 |

- 每个菜单最多 4 项，每项都必须是本插件 `commands` 里的命令，不能重复。菜单里显示命令标题和插件名。
- 剪贴板、文件中转和消息的条目是用户亲手选的，所以插件拿到这一条不需要 `clipboard:read`、`shelf:read` 或 `messages:read`；要读别的条目仍然需要权限。图片剪贴板条目和微信提醒没有这个菜单。

### 设置项

插件不能自带设置界面。插件卡片上的 **设置** 打开插件自己的设置页，由岛屿绘制，分四块：运行信息（插件用 `ui.setInfo` 提供）、设置项（这里声明的）、操作（`commands` 的按钮）和日志。

```json
"settings": [
  { "key": "allowWrite", "type": "boolean", "title": { "zh-CN": "允许修改", "en": "Allow changes" }, "default": false },
  { "key": "interval", "type": "number", "title": { "zh-CN": "间隔（分钟）", "en": "Every (minutes)" }, "min": 1, "max": 60, "default": 5 },
  { "key": "name", "type": "string", "title": { "zh-CN": "名称", "en": "Name" },
    "description": { "zh-CN": "显示在……", "en": "Shown in…" } },
  { "key": "mode", "type": "select", "title": { "zh-CN": "模式", "en": "Mode" },
    "options": [{ "value": "fast", "title": { "zh-CN": "快", "en": "Fast" } }, { "value": "slow", "title": { "zh-CN": "慢", "en": "Slow" } }] }
]
```

| 字段 | 说明 |
|---|---|
| `key` | 1–32 个字符，只能用字母、数字、`-`、`_`，同一个插件里不能重复 |
| `type` | `boolean`（开关）、`number`（整数，范围由 `min` / `max` 限定）、`string`（文本，最长 1000 个字符）、`select`（下拉，选项来自 `options`） |
| `title` / `description` | 中英文都要有；`description` 可以省略 |
| `default` | 默认值，必须符合 `type`。省略时：开关为 `false`，数字为 `min` 或 0，文本为空，下拉为第一项 |

- 插件拿到的设置总是完整的：默认值已经填好，过期或不合法的值换成了默认值。`initialize.settings` 和 `settings.get` 给出当前值，用户改了以后插件收到 `settings.changed { settings }`。
- 插件自己也能改：`settings.set { values }`，只能改这里声明过的键，适合登录后把账号写进设置。
- 设置值由岛屿保存，卸载插件时一并删除。令牌和密码不要放在设置里，用 [`secrets`](runtime.md#存储与秘密)。

### 音效包

`sounds` 让插件成为一个音效包。装好并打开后，它出现在 **设置 → 声音** 的「使用的音效」里，关掉或卸载就消失：

```json
{
  "runtime": { "type": "none" },
  "contributes": {
    "sounds": {
      "license": "CC0-1.0",
      "files": { "complete": "sounds/complete.wav", "approval": "sounds/approval.wav" }
    }
  }
}
```

- 可以换的声音：`start`、`complete`、`error`、`approval`、`question`、`ack`、`compact`、`idle`、`quotaLow`、`quotaReset`。没写的用内置音效，岛屿不认识的会被忽略。
- 文件必须在插件文件夹里，格式 `.wav`、`.mp3`、`.ogg`、`.m4a`、`.flac`，每个最大 4 MB。
- `license` 必填。插件市场只收允许再分发的许可（CC0、MIT 等），MIT 的包要附上许可证原文。别人软件里的音效不要上架。市场分类写 `sounds`。

### Agent 页的强度名称

`agentEffortLabels` 改写 Agent 页会话行里推理强度的显示，只改显示，会话本身的强度不变：

```json
{
  "runtime": { "type": "none" },
  "contributes": {
    "agentEffortLabels": { "claudeCode": { "medium": "xhigh", "high": "max" } }
  }
}
```

- 可以写 `claudeCode`、`codex`，每个最多 8 项。左边是 Agent 报告的强度（不分大小写），右边是要显示的文字，两边都是 1–16 个字符。显示时首字母大写。
- 不需要进程和权限。插件开着时生效，关掉立刻恢复。几个插件改写同一个强度时，按插件 id 排序取第一个。

## 实验 API

还在设计中的 API 先作为实验 API 提供，在清单里写 `"experimentalApis": ["<名称>"]` 申请（最多 10 个）。只有以开发模式加载的插件能用：装在插件目录里的这类插件岛屿拒绝加载，`validate` 和插件市场也拒收。`initialize.experimentalApis` 告诉插件岛屿实际提供了哪些。

目前岛屿没有实验 API，这个通道是为以后准备的。
