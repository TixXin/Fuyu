# 从外部打开 WorkBuddy 的指定会话

> 日期：2026-11-19。问题：在岛的 Agent 页点一条 WorkBuddy 会话，能不能让 WorkBuddy 直接打开那一条，而不只是切到窗口（#963）。范围：读本机 `/Applications/WorkBuddy AI.app`（5.11.4）的 `Info.plist` 和 `app.asar` 里主进程、界面的代码，本机 `~/.workbuddy-ai` 的数据，在 Mac 上实测；顺带读了 Cursor 3.30.14、Antigravity 2.33.0 的安装包。相关任务：A17（做）、A18（Cursor 能、Antigravity 不能）、A19（Windows 实测）。

## 结论

- **能做到**。WorkBuddy 注册了自己的链接协议，`<协议>://chat/<会话 id>` 打开那条会话：WorkBuddy AI 是 `workbuddy-ai://`，国内版默认是 `workbuddy://`。会话 id 就是我们读的 `~/.workbuddy*/projects/<目录>/<id>.jsonl` 的文件名，不用换算。
- Mac 上实测通过：三条会话之间来回切都切对；窗口关掉以后发链接，窗口重新出来并停在那一条；应用没开时发链接，先启动再打开那一条。
- A17 的做法：点 WorkBuddy 会话时，按会话文件在 `~/.workbuddy` 还是 `~/.workbuddy-ai` 选协议，发 `chat/<id>` 链接，再照 A16 的办法把窗口切到前台；链接发出去就算精确跳转，不再提示「请手动选会话」。找不到会话文件或链接打不开时退回 A16。
- Windows 没实测：协议由 WorkBuddy 启动时自己注册（Electron 的 `setAsDefaultProtocolClient`），链接会再启动一次 `WorkBuddy.exe`，由它的单实例逻辑（`second-instance`）把链接交给已经开着的那个。实测清单在 A19。
- Cursor 也能（A18）：`cursor://anysphere.cursor-deeplink/agent?id=<会话 id>` 打开 Agents 窗口并选中那一条，id 就是我们读的 composer id，Mac 实测通过。Antigravity 2.33.0 不能：链接只认新建草稿、导入、登录回跳和插件页，到不了某条对话，照旧只到窗口。

## 详细

### 协议怎么注册

- Mac 的 `Info.plist`：`CFBundleURLTypes` 里只有 `workbuddy-ai`（名字是「WorkBuddy AI Deep Links」）。
- 主进程启动时对每个协议调 `app.setAsDefaultProtocolClient`。协议列表的来源（`main/workbuddy-paths2.js`）：环境变量 `WORKBUDDY_DEEPLINK_SCHEMES` / `WORKBUDDY_DEEPLINK_SCHEME`，否则读产品配置的 `deepLinkSchemes`，再没有就是默认的 `workbuddy`；多开的实例在协议名后加实例后缀；`buddy-app` 总是加上。所以国内版是 `workbuddy` + `buddy-app`，WorkBuddy AI 是 `workbuddy-ai` + `buddy-app`。`buddy-app` 两个版本都注册，装了两个时不知道交给谁，不用它。
- 国内版的协议名按代码推断，没装国内版，未实测。

### 链接怎么走

- Mac 上链接进 `open-url`，Windows 上进 `second-instance` 的命令行参数（`getOpenUrlFromCommandLine`），两条都交给主进程的 `DeepLinkRouter.handleUrl`。应用刚启动、窗口还没建好时先存着，窗口建好再处理（日志里是 `[DeepLink] stored until WindowManager ready`）。
- 认不出的链接（不是 OAuth、MCP 授权、登录交接、微信聊天记录这几类）都发给界面。界面的 `parseDeepLink`（`renderer/assets/deeplink-*.js`）按主机名找页面：`chat` 对应聊天页，路径不为空时跳到 `/task/<路径>`；还认 `home`、`calendar`、`projects`、`experts`、`settings`、`automation` 等。
- 界面的路由里有 `task/:taskId`（旧的会话页）和 `conversation/:conversationId`（新的会话引擎）。链接走的是 `task/:taskId`，本机实测打开的就是对应会话。
- 日志在 `~/.workbuddy-ai/logs/main.log`，带 `[DeepLink]` 前缀，排查时看这里。

### 会话 id 怎么对上

- 本地数据库 `~/.workbuddy-ai/workbuddy.db` 的 `sessions` 表主键 `id`，和 `projects/<目录>/<id>.jsonl` 的文件名、记录里的 `sessionId` 是同一个值。本机三条会话都对得上。
- 我们列会话时用的就是这个 `sessionId`，所以链接直接拼：`workbuddy-ai://chat/<sessionId>`。拼之前只放行字母、数字和 `-`，别的字符一律不发。

### Mac 实测（2026-11-19，WorkBuddy AI 5.11.4，macOS 27.2）

用 `open <链接>` 发链接（浮屿在 Mac 上经 `tauri-plugin-opener` 打开链接，走的也是 LaunchServices），截图核对：

1. 应用没开：`open workbuddy-ai://home` 启动应用，日志先 `stored until WindowManager ready`，窗口好了再处理。
2. 当前在「打招呼开场」，发 `chat/ac1de220-…`：切到「讨论项目下一步计划」。
3. 发 `chat/ccc765a5-…`：切到「询问模型身份与功能」（另一个工作目录的会话）。
4. 菜单「窗口 → 关闭窗口」后发 `chat/6c260007-…`：窗口重新出来，停在「打招呼开场」。

在岛上点会话的整条路没在这台机器上点过，列在 A19 第 7 条。

### 其他图形界面代理（A18，#967）

**Cursor 3.30.14：能打开指定会话。**

- 链接：`cursor://anysphere.cursor-deeplink/agent?id=<会话 id>`。内置扩展 `cursor-deeplink`（`extensions/cursor-deeplink/dist/main.js`）收到 `/agent` 和 `/background-agent` 后调 `cursor.openOrFocusGlassWindow`，打开或聚焦 Agents 窗口，再经 `glass.handleDeeplink` 把整个链接交给 Agents 窗口（`out/vs/workbench/workbench.glass.main.js`）的 `handleCursorDeeplink`：`/agent` 取查询参数 `id`，`/background-agent` 取 `bcId`，都交给 `glass.openCloudAgentById`。
- 那个命令先按 id 查本地的 Agent（`agentRepositoryService.getAgentHeader`），id 不是云端 Agent 的格式就直接用本地的结果，查到就选中，查不到弹「We can't find this agent」。所以本地会话也能用这条链接打开。
- 会话 id 对得上：本地 Agent 的 id 就是 composer id，也就是我们读的 `~/.cursor/projects/<工作区>/agent-transcripts/<id>/` 的目录名（`cursor.rs` 的会话 id），不用换算。编辑器里聊的会话也会出现在 Agents 窗口的列表里。
- Cursor 没开时，扩展先开窗口，链接排在队列里，Agents 窗口加载好再处理（`glass.handleDeeplink` 的等待队列）。
- 打开的是 Agents 窗口，不是编辑器窗口；编辑器的 `cursor://` 路由（`/createchat`、`/prompt` 等）没有按 id 打开已有对话的。
- Mac 实测（2026-11-19，macOS 27.2，Cursor 3.30.14 开着）：`open "cursor://anysphere.cursor-deeplink/agent?id=c728c934-…"` 后 Agents 窗口选中「Next steps from IDE session」，再发 `id=6055181d-…` 切到「General chat」，两条都对。

A18 的做法：Cursor 的会话找不到终端进程（编辑器、Agents 窗口里的会话）时，点会话发这条链接，链接发出去就算精确跳转，不再去找编辑器窗口（不然编辑器窗口会盖住刚选中会话的 Agents 窗口），也不再提示装编辑器扩展。找得到终端进程的（在终端里跑的）照旧走终端。会话 id 只允许字母、数字和 `-`，最长 128 个字符，不合格就退回只到窗口。

**Antigravity 2.33.0：不能，照旧只到窗口。**

- 主进程（`app.asar` 的 `dist/main.js`）的 `handleDeepLink` 把窗口拿到前台，把链接经 `deep-link` 消息交给界面；窗口还在加载时先存着，界面用 `deep-link:get-stored` 取。
- 界面不在安装包里，是本机 language server（`Resources/bin/language_server`，资源是压缩的）在 `127.0.0.1` 上提供的页面。开着应用把 `main.js` 取下来读了：用到 `window.deepLink.onDeepLink` 的只有四处，认的链接是 `antigravity://open?prompt=&project=`（或空主机名，打开首页并预填一个新草稿）、`antigravity://teleport/ai_studio?blob_id=&signature=`（导入 AI Studio 项目）、`antigravity://oauth-success`（登录后刷新插件）和 `antigravity://customizations/marketplaces/<市场>/plugins|skills/<id>`（插件、技能页）。
- 对话页是应用内路由 `/c/$cascadeId`，没有链接通到它。试发 `antigravity://c/<对话 id>`：窗口拿到前台，停在首页，没打开那条对话。
- 本机没装 Antigravity IDE（VS Code 那一支），没查；它的会话也是只到窗口。

## 来源

- 本机 `/Applications/WorkBuddy AI.app`（5.11.4）：`Contents/Info.plist`；`Contents/Resources/app.asar` 里的 `main/index.js`（`DeepLinkRouter`、`registerProtocolSchemes`、`handleSecondInstance`）、`main/workbuddy-paths2.js`（协议列表）、`renderer/assets/deeplink-*.js`（`parseDeepLink`）、`renderer/assets/route-config-*.js`（`task/:taskId`）。asar 用自己写的小脚本按 asar 头读出文件，放在本机临时目录，不进仓库。
- 本机 `~/.workbuddy-ai/workbuddy.db`（只读查询 `sessions` 表）、`~/.workbuddy-ai/projects/`、`~/.workbuddy-ai/logs/main.log`。
- 本机 `/Applications/Cursor.app`（3.30.14）的 `Contents/Resources/app/extensions/cursor-deeplink/dist/main.js`、`out/vs/workbench/workbench.glass.main.js`（`handleCursorDeeplink`、`openAgent`、`glass.openCloudAgentById`），本机 `~/.cursor/projects/*/agent-transcripts/`。
- 本机 `/Applications/Antigravity.app`（2.33.0）的 `Contents/Info.plist`、`Contents/Resources/app.asar` 的 `dist/main.js`；开着应用从本机 language server 取下的界面 `main.js`（`deepLinkListener`、`pluginDeepLink`、`teleport/ai_studio` 的处理和路由表）。取下的文件放在本机临时目录，不进仓库。
