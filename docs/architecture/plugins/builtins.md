# 内置插件

有些可选功能直接编译在岛屿里，但在「插件扩展」中的显示和管理方式与普通插件一样：可以启用和停用，启用时授予权限，有自己的设置页。区别是：不需要下载、不需要打开「允许运行第三方插件」、不能卸载、卡片上标着「内置」。给插件作者看的简介在 [编写浮屿插件](../../plugins/README.md#内置插件)。

## 怎么加一个

内置插件的清单写在 `src-tauri/src/plugin_host/builtin.rs` 中，`runtime.type` 为 `builtin`。插件目录里的第三方插件不能使用这个类型，也不能使用内置插件的 id。

只在岛屿窗口里工作的内置插件（例如收起条上的小环）只需在 `BUILTINS` 表里加一行 `("id", 清单, 默认启用)`：后端启动和停止时什么都不做；前端用 `useBuiltinPlugin(id)`（`src/features/plugins/useBuiltinPlugin.ts`）读到 `{ enabled, settings }`，插件启停或改设置时自动更新（宿主发出 `plugin-view-changed` 的 `reset` 事件），再在 `src/windows/island/useCollapsedSlots.tsx` 里填收起条槽位。

## 现有的内置插件

### 本地接口（`focusd.local-api`）

见 [本地接口](../../features/local-api.md)。

### 中心图案（`focusd.center-pattern`，默认关闭）

折叠岛没有摘要文字时，在中间显示眼睛、小鸟、光点、小猫、悬岛标志或一只 Codex Pets 宠物，摘要只有剩余待办数时排在待办数前面。悬岛标志和宠物随 Agent 会话的状态变化，岛上显示 Agent 标题时站在标题前代替 Agent 图标（状态灯已经是悬岛时，悬岛标志不再站过去）。设置「大小」调图案高度，默认 24px，和环一样高。

### Agent 用量环（`focusd.claude-usage`，默认关闭；原名 Claude 用量环）

收起条上每个打开的 Agent 一个同心双环，外环 5 小时、内环 7 天（没有周限额时画本月），悬停显示详情卡片。设置里 Claude Code（默认开）、Codex、GLM、Kimi 各一个开关。

- Codex 读本机 Codex 会话记录（`get_codex_usage`，和 Agent 页相同，不联网）。
- GLM 和 Kimi 用插件页保存的 API Key 直连官方接口（`get_plan_usage`：`open.bigmodel.cn/api/monitor/usage/quota/limit`、`api.kimi.com/coding/v1/usages`；不走代理、不跟随重定向，答复缓存 1 分钟，点击环 10 秒内只放行一次）。Key 由 `set_plan_key` 存进 Windows 凭据管理器 `com.tixxin.fuyu.plan-usage`，`has_plan_key` 只回答有没有，Key 不回到前端、日志和插件设置。Qwen（阿里云百炼）没有公开的额度查询接口，暂不支持。
- Claude Code 的数据与 Agent 页顶部的用量相同（`get_agent_usage`）：Claude Code 经本机 magpie 网关时读它的 `/v1/magpie/quotas`（只请求本机），否则读 claude-hud 写出的用量快照；都不联网、不读登录凭据。
- 设置「直接向 Anthropic 查询」（默认关）打开后，原生端（`src-tauri/src/claude_usage/`）只读 Claude Code 的 `~/.claude/.credentials.json` 里的 access token（不刷新、不改写，不进日志、前端和事件），经 http(s) 代理请求 `api.anthropic.com/api/oauth/usage`：代理依次取插件设置、`HTTPS_PROXY`、Windows 系统代理，都没有就不请求，**从不直连**；不跟随重定向；间隔 5–120 分钟（设置「刷新间隔」），失败时加倍退避，429 遵守 `Retry-After`。`get_agent_usage` 在两份数据中取较新的，并带上最近一次失败的原因。这个接口没有公开文档，可能随时失效。

### Agent 会话环（`focusd.session-ring`，默认关闭）

AI Agent 开启时，在收起条上代替蓝色会话数，样式可选分段环（默认）、像素格、状态条和信号格，按状态着色（等你确认、等你回复、运行、可能已停、完成），分段环和状态条的会话数可以用「显示会话数」开关关掉，悬停列出等你处理的会话，点击打开 Agent 页。数据就是 Agent 页的会话列表（Claude Code 和 Codex），只在岛屿窗口工作，没有原生部分。

### SSH 代理隧道（`focusd.ssh-proxy-tunnel`，默认关闭）

把这台电脑的代理借给 SSH 服务器。

- 插件页列出 `~/.ssh/config` 的 Host 和 AI Agent 页添加的电脑，每台可以单独打开并填服务器上的端口（1024–65535）。打开的主机各有一条常驻的 `ssh -N -R 127.0.0.1:<服务器端口>:127.0.0.1:<本地端口>`（隐藏窗口、只用密钥登录、`ExitOnForwardFailure`，和读会话的那条连接分开），断开后 5 秒起加倍退避重连（最长 2 分钟），关闭插件、关掉主机或退出岛屿时结束（ssh 在作业对象里，岛屿崩溃也不留下）。
- 本地端口在设置里选，默认「自动检测」：依次看 Clash Verge 的运行配置（`%APPDATA%\io.github.clash-verge-rev.clash-verge-rev\clash-verge.yaml` 的 `mixed-port`，没有时 `verge.yaml` 的 `verge_mixed_port`）、正在运行的 v2rayN 旁边的 `guiConfigs\guiNConfig.json`（`Inbound[0].LocalPort`，7.x 起是混合端口）、Windows 系统代理（开着且指向本机时），再试 7897、10808，取第一个真有程序在监听的；都没在监听时保持上次的端口。之后每 15 秒再看一次，端口变了隧道跟着重建。也可以固定选 Clash Verge（先读它的设置，读不到用 7897）、v2rayN（先读它的设置，读不到用 10808；7.0 之前的版本 HTTP 是 10809，请选自定义）或自定义。
- 插件页「运行信息」实时显示隧道转发到的本地地址、端口从哪里来、现在有没有程序在监听。
- 打开主机或改端口时先用一条短 ssh 在服务器上跑 `ss -ltn`（没有时 `netstat -ltn`）看端口是否已被占用，占用时问「仍要搭建隧道吗？」：是就照样搭（等端口空出来），否就不打开；查不了时同样询问，并写出原因；岛屿启动或重连时不弹窗，转发被拒时显示「端口被占用，等待中」并继续重试。
- 打开的主机下面有一行可复制的 `export http_proxy=… https_proxy=… HTTPS_PROXY=…`，在服务器上运行它。

### cc-connect 手机连接（`focusd.cc-connect`，默认关闭）

让手机推送经 [cc-connect](https://github.com/chenhg5/cc-connect) 的机器人发到 Telegram、Discord、飞书，没装过 cc-connect 也能从零搭好。

- 程序路径在设置里填；空着时依次找正在运行的 cc-connect、PATH、插件页下载的那份，再看 C、D 盘 `Program Files` 和 `Program Files (x86)`（以及 `%LOCALAPPDATA%\Programs`）下的 `cc-connect` 文件夹（程序在里面或下一层的版本文件夹里），不全盘搜索。找不到时插件页可以一键下载最新正式版（按发布的 `checksums.txt` 核对 SHA-256）。
- 「新建机器人」一步步引导：Telegram 粘贴 BotFather 给的 token，给机器人发一句话后点「识别」，从发过消息的人里点选自己作为 `allow_from`；Discord 粘贴 token 后给出邀请链接，用户 ID 手动填；飞书点「扫码创建」，由 cc-connect 自己的 `feishu new` 扫码建好机器人并把扫码人设为 `allow_from`。`allow_from` 必须填，不能是 `*`。建好后在 `~/.cc-connect/config.toml` 末尾追加一个 Claude Code 项目（先备份，原有内容不动）。
- 打开「由岛启动 cc-connect」后，岛在后台运行它（作业对象，随岛退出，退出后退避重启；已在别处运行的不接管），配置变了自动重启。
- 插件页每 5 秒刷新一次，给机器人发过消息的聊天会自动出现；在设置 → AI Agent → 提醒 → 手机推送里把通道选成 cc-connect，再选项目和要推送的会话。cc-connect 自己发起的会话（`claude -p`）不推，免得重复。
