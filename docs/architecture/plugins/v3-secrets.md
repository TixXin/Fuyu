# 插件平台第 3 版：密钥不经 JS

任务 E36.3.7（#471），父任务 E36.3（#293）。会话 v3-secrets 2026-11-15 摸底和设计，交第 3 阶段地基主 agent 审；计划见 [v3-phase3-foundation-plan.md](v3-phase3-foundation-plan.md)，方案的出处是 [v3-everything-plugin.md](v3-everything-plugin.md)「内置功能怎么变成插件」：密码、令牌这类数据只在 Rust 一侧使用，没有任何命令把明文返回给前端或宿主。

这份文档只写设计，不改代码。文中不出现任何真实的密钥值。

## 结论

- 摸了 19 类，**4 处明文会回到 JS**，其中 1 处是设计上的例外：
  1. **本机接口的访问令牌**：放在插件信息项里，`list_plugins` 等十几个返回 `PluginsSnapshot` 的命令把它原样交给设置窗口，前端点「显示」看明文、用 `navigator.clipboard` 复制。**要改。**
  2. **日历订阅链接（ICS）**：链接本身就是密钥。保存时只回主机名，但请求失败时 reqwest 的错误文字带着完整网址（`… for url (https://…)`），经 `UserError.detail` 回到窗口（`add_calendar_source`、`get_calendar_events`）。**要改。**
  3. **更新用的代理**：`get_updater_proxy` 把 `HTTPS_PROXY` 环境变量或系统代理原样返回，前端再传回 `updater_check`。代理地址里写了 `user:pass@` 时就是明文密码。**要改。**
  4. **第 3 版宿主的连接令牌**：`get_plugin_host_connection` 返回 `token`，窗口拿它连本机 WebSocket。每次启动随机生成、不落盘，用途就是让窗口证明身份。**例外，保留。**
- 另有 2 处要用户自己写进去才会有：Claude 用量插件的「代理」设置、Bark 推送的「服务器地址」里粘了带设备 Key 的完整网址。记下，暂不改（见表里第 14、4 行）。
- 其余（翻译、邮箱、GLM / Kimi、Bark 设备 Key、Claude Code 登录令牌、magpie、Agent 审批、OpenCode、cc-connect 机器人 token）已经是只进不出，不用改。
- `localStorage` 里没有密钥（和 [data-storage.md](../data-storage.md)「升级前的备份」那行 2026-11-15 的核对一致）。
- 建议拆 **4 个后续子任务**（见「后续子任务」），都很小，3 个要编译 Rust。

## 原则

1. **只进不出**：密钥经命令参数写进凭据管理器 / 钥匙串或 Rust 自己的文件，没有读回明文的命令。前端输入框里的草稿是用户正在敲的字，提交后清空，不算「回到 JS」。
2. **只回「有没有」**：要显示状态的地方用 `has_*` 返回 `bool`，或者返回不含密钥的摘要（例如日历只回主机名）。
3. **用的地方都在 Rust**：拼请求头、拼请求体、写钩子配置、经 SSH 写到远程电脑，都在 Rust 里做。
4. **要给用户看或复制的，Rust 直接做完**：复制由 Rust 写进剪贴板（带「不进剪贴板历史」的标记）；要写进别的程序配置的，由 Rust 拼好整份配置写到目标位置；只在少数「显示给用户扫一下」的一次性码上例外（飞书扫码）。
5. **错误里也不能有**：`UserError` 的 `message`、`detail`、`args` 都会到窗口。带密钥的网址发请求时，错误一律去掉网址（reqwest 的 `Error::without_url()`），会回显输入的地方用已有的 `UserError::redact`。
6. **对外契约不随便变**：要变的在同一个提交里改前后端、留兼容读取，写进 [contracts.md](../contracts.md)。
7. **密钥不跟着调用方给的地址走**（E36.3.18）：Rust 带着密钥发请求时，地址只能来自 Rust 自己的预设或用户在设置里存下的配置，不能来自这次调用的参数。宿主、插件、插件窗口给的地址一律不收：给宿主的入口不设地址参数，要靠调用方给地址的引擎（翻译的「自定义接口」）在宿主这条路上直接报错，等它的地址存进 Rust 再开放。否则谁能调这个方法，谁就能让 Rust 把密钥发到自己的服务器上。

## 这条规则管什么、不管什么

照方案「每项保护管什么、不管什么」的写法如实写：

| 管得住 | 管不住 |
|---|---|
| 插件的界面部分或宿主部分「顺手」拿到密钥：调了某个命令、订阅了某个事件、把结果写进日志或发到网上 | 恶意的宿主插件自己去读：宿主是有用户全部权限的 Node 进程，Windows 上同一用户的任何进程都能读凭据管理器；`local-api.json`、`agent-approval.json`、`~/.cc-connect/config.toml`、`~/.claude/.credentials.json` 本来就是明文文件 |
| 以后新写的命令不小心把密钥序列化出去（有检查，见「怎么守住」） | 用户自己复制到剪贴板以后的去向 |
| macOS 上：钥匙串条目的访问控制按程序算，别的程序（包括宿主用的 Node）来读会弹系统确认框 | Windows 上没有这层确认 |

所以这条规则是**减损**：同权模型下它不防恶意插件，防的是正常插件和正常代码把密钥带出去。界面和文档里不能把它说成「插件拿不到你的密钥」。

## 摸底和设计

「去向」一列写现在明文会不会到窗口（以后也就是宿主）。「契约」一列对照 [contracts.md](../contracts.md)。

| # | 东西 | 存在哪 | 谁写 / 谁读 | 命令 | 明文回 JS？ | 要不要改 → 怎么改 | 大小 | 契约变不变 |
|---|---|---|---|---|---|---|---|---|
| 1 | 翻译 API 密钥（各服务一条） | 凭据管理器 / 钥匙串 `com.tixxin.fuyu.translation`，用户名是服务 id | 写：设置窗口 → `save_translation_secret`；读：`translate_text`、`rewrite_text` 在 Rust 里拼 `Authorization: Bearer` | `save_translation_secret(secret, provider)`、`has_translation_secret → bool`、`delete_translation_secret` | 不回。自定义服务地址拒绝带 `?key=` 的网址（`translation/provider.rs`） | 不改。E36.3.8 的 `translator/v1` 服务照样不暴露读密钥的方法 | — | 不变 |
| 2 | 邮箱授权码（多账户） | 凭据管理器 / 钥匙串 `com.tixxin.fuyu.qq-mail`，用户名是邮箱 | 写：`connect_qq_mail`；读：`mail/session.rs` 登录 IMAP / SMTP | `connect_qq_mail(email, authorizationCode, host)` → `MailSnapshot`（邮箱、状态、未读、邮件列表，无授权码） | 不回。登录失败的错误先 `redact(secret)` | 不改 | — | 不变 |
| 3 | 日历：ICS 订阅链接、CalDAV 密码 | 凭据管理器 / 钥匙串 `com.tixxin.fuyu.calendar`，用户名是来源 id；`calendar-sources.json` 只存 id、种类、名称、CalDAV 地址、主机、账户 | 写：`add_calendar_source`；读：`get_calendar_events` 拉日程 | `add_calendar_source(kind, name, url, username, secret)` → `CalendarSource`（ICS 的 `url` 留空，只回 `host`）；`list_calendar_sources`；`get_calendar_events` | **会回**：`calendar/mod.rs` 的 `fetch_ics` 把 reqwest 错误 `.detail(error)`，错误文字带完整订阅链接；`add_calendar_source` 失败时的错误和 `get_calendar_events` 返回的 `CalendarSnapshot.problems[].message` 都会到窗口 | **改**：`fetch_ics` 里的 reqwest 错误先 `without_url()`；`calendar/caldav.rs` 同样处理（CalDAV 地址一般不含密码，但用户可能把账户密码写进网址）；加单元测试：拿一个假链接造连接失败，断言 `UserError` 序列化后不含链接 | 小 | 不变（只少了 `detail` 里的网址） |
| 4 | Bark 推送设备 Key | 凭据管理器 / 钥匙串 `com.tixxin.fuyu.bark` | 写：手机推送设置 → `save_bark_key`（接受整条推送网址，Rust 抠出 Key）；读：`send_bark_push` 放进 JSON 请求体 | `has_bark_key → bool`、`save_bark_key`、`delete_bark_key`、`send_bark_push(server, title, body, group)` | 不回。但「服务器地址」存在 `localStorage` 的 `fuyu-agent-push.server`，用户若把带 Key 的整条网址粘进这一栏，Key 会以明文进 `localStorage`、`settings.json` 和升级前的备份 | 暂不改，记下。以后要改：前端保存服务器地址时只留到主机和端口（自建 Bark 带路径前缀的少见，留一个「高级」开关再说） | 小 | 改时：`fuyu-agent-push.server` 读取时兼容旧值 |
| 5 | GLM / Kimi 的 API Key（Coding Plan 用量） | 凭据管理器 / 钥匙串 `com.tixxin.fuyu.plan-usage`，用户名 `glm` / `kimi` | 写：Claude 用量插件页的 `PlanKeyFields`；读：`agent_status/plan_usage.rs` 拼请求头 | `set_plan_key(provider, key) → bool`、`has_plan_key → bool`、`get_plan_usage` | 不回 | 不改 | — | 不变 |
| 6 | Claude Code 的登录令牌（用量环直查 Anthropic） | Claude Code 自己的 `~/.claude/.credentials.json`，只读 | 读：`claude_usage/source.rs` `bearer_auth` | `refresh_claude_usage`、`get_agent_usage` → `AgentUsage`（无令牌） | 不回 | 不改 | — | 不变 |
| 7 | magpie 网关令牌（`ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY`） | `~/.claude/settings.json` 的 `env` 或进程环境变量，只读 | 读：`agent_status/magpie.rs`，只发往本机地址 | `get_agent_usage` | 不回 | 不改 | — | 不变 |
| 8 | 本机接口访问令牌 | 应用数据目录 `local-api.json` 明文（给脚本读，设计如此）；开关在 `plugins.json` | 写：首次启动和「重新生成令牌」由 Rust 生成；读：`local_api/routes.rs` 验请求头；脚本读文件 | 内置插件 `focusd.local-api` 启动或执行 `reset-token` 后，`local_api_info` 生成信息项「访问令牌」（`secret: true, copy: true`），存进运行时的 `info`，随 `PluginsSnapshot.plugins[].info` 由 `list_plugins`、`set_plugin_enabled`、`run_plugin_command` 后的快照等返回 | **会回**：`PluginInfoList.tsx` 遮成圆点，点「显示」看明文，点「复制」用 `navigator.clipboard.writeText` | **改**：`InfoItem` 的 `secret: true` 项序列化时 `value` 换成空串、加 `hasValue: bool`；新命令 `copy_plugin_info(id, index)` 由 Rust 从运行时的 `info` 取值，用 `arboard` 写进剪贴板，并带上「不进剪贴板历史」的标记（Windows 的 `ExcludeClipboardContentFromMonitorProcessing`、macOS 的 `org.nspasteboard.ConcealedType`，岛屿自己的剪贴板历史已经认这两个，见 `win32/clipboard.rs`、`macos/pasteboard.rs`）；去掉「显示」按钮，旁边已经有「配置文件」路径，要看全文的用户去文件里看。第 2 版第三方插件经 `status.info` 送来的 `secret` 项走同一套。第 2 版插件系统冻结、只修 bug 和安全问题，这条按安全修复做 | 中小（Rust 一处序列化 + 一个命令；前端一个组件；回归页快照） | **变**：`PluginsSnapshot` 里 `secret` 信息项的 `value` 不再有值、多 `hasValue`；新增命令 `copy_plugin_info`。写进 contracts.md「插件」 |
| 9 | Agent 审批端点令牌（含给远程电脑的派生令牌） | 应用数据目录 `agent-approval.json` 明文（端口、令牌） | 写：Rust 生成；读：`agent_approval/http.rs` 验请求；`agent_status/claude_hooks.rs` 写进 `~/.claude/settings.json` 的 HTTP 钩子请求头，其余家的钩子配置同理；远程电脑：`remote_sessions.rs` 经 SSH 转发写 `~/.fuyu/approval-port`（权限 600），令牌是 `sha256(host + token)` 派生的 | 无命令返回令牌；`agent_approval_pending` 返回的 `ApprovalRequest` 不含令牌 | 不回。已经是「Rust 拼好完整配置写到目标位置」 | 不改 | — | 不变 |
| 10 | OpenCode 本机服务的密码 | OpenCode 自己写的信息文件，只读 | 读：`agent_approval/opencode.rs` 拼 Basic 认证 | 无 | 不回 | 不改 | — | 不变 |
| 11 | cc-connect 机器人 token | `~/.cc-connect/config.toml` 明文（cc-connect 要读，第三方格式） | 写：`add_cc_connect_project` 由 Rust 追加项目（先备份）；`check_cc_connect_bot` 只拿去问平台 | `check_cc_connect_bot(platform, token) → BotCheck`（名字、邀请链接、发过消息的人）、`add_cc_connect_project(…, token, …)`、`get_cc_connect_status → CcConnectStatus`（只有项目名和会话） | 不回。错误先 `redact(token)` | 不改 | — | 不变 |
| 12 | cc-connect 飞书扫码 | 应用数据目录 `cc-connect/feishu-qr.png`，扫码期间存在 | 写：cc-connect 子进程；读：`feishu::progress` 转成 `data:` 网址 | `get_cc_connect_feishu_setup → FeishuProgress { qr, url }` | 回，**例外**：这是给用户扫的一次性登录码，必须显示；扫完或取消就删文件 | 不改，进例外名单 | — | 不变 |
| 13 | 第 3 版宿主的窗口连接令牌 | 只在内存（宿主 `ready` 消息里），不落盘 | 写：宿主每次启动随机生成；读：窗口连 WebSocket | `get_plugin_host_connection → HostConnection { port, token, … }` | 回，**例外**：方案「宿主和窗口怎么通信」定的做法，令牌的用途就是让窗口证明身份 | 不改，进例外名单 | — | 不变 |
| 14 | 更新、歌词、Node 下载、cc-connect 用的代理 | `HTTPS_PROXY` 等环境变量或系统代理（注册表 / macOS 系统设置），只读 | 读：`system/updater.rs` 的 `get_updater_proxy`，Rust 里歌词、Node 下载、cc-connect 直接调它 | `get_updater_proxy → string \| null`；前端 `updaterController.ts` 存进变量，再作为参数传给 `updater_check(channel, proxy)` | **会回**：代理地址里写了 `user:pass@` 时是明文密码 | **改**：`updater_check` 在 Rust 里自己调 `get_updater_proxy`，不再收 `proxy` 参数（照样接受、忽略，兼容旧前端）；`get_updater_proxy` 这个命令改成返回 `bool`（有没有代理）或删掉命令只留 Rust 函数——前端现在只拿它来转交，不显示 | 小 | **变**：`updater_check` 的 `proxy` 参数不再使用；`get_updater_proxy` 返回类型变或删除。写进 contracts.md |
| 15 | 插件设置里的代理（Claude 用量插件 `proxy`、SSH 隧道的端口） | `plugins.json` 明文，用户自己填 | 写：插件设置页；读：Rust | 随 `PluginsSnapshot.plugins[].settings` 返回 | 回，但只有用户把密码写进代理地址时才有密钥 | 暂不改，记下：设置项说明里写「代理地址里别写密码，需要认证的代理用系统代理」 | — | 不变 |
| 16 | 第 2 版插件的秘密（`secrets.get/set/delete`） | 凭据管理器 / 钥匙串 `com.tixxin.fuyu.plugin.<id>`，索引 `plugin-secrets.json` | 插件进程经 JSON-RPC 读写自己的条目 | 不经 Tauri 命令 | 不回窗口（交给的是插件进程，第 2 版的设计） | 不改，第 6 阶段随第 2 版删 | — | 不变 |
| 17 | 改名迁移、开发版复制凭据 | 凭据管理器 | `win32/credentials.rs` 的 `copy_generic_credentials`，`rename_migration`、`dev_lane/seed.rs` 调 | 无 | 不回 | 不改 | — | 不变 |
| 18 | 岛屿实验台的令牌（`pnpm lab`） | 只在开发版，`local_api/lab.rs` 写给实验台页面读的文件 | Rust 生成，实验台的 Node 服务读 | 无 | 不回窗口 | 不改 | — | 不变 |
| 19 | `localStorage` | WebView 存储 | 前端 | — | 没有密钥：翻译设置只有服务、语言、自定义地址；邮箱设置只有邮箱、主机、开关；推送设置见第 4 行 | 不改 | — | 不变 |

不在范围里：剪贴板历史和截图里的内容是用户的数据，可能含密码，由 `clipboard_history/secrets.rs`、`privacy.rs` 和 `features/screenshot/redact.ts` 管，不算岛屿保管的密钥。

## 例外名单

能把「像密钥的东西」交给窗口的只有这几项，每项都要写理由；以后再加要在 PR 正文里说明：

| 命令 / 结构体 | 字段 | 理由 |
|---|---|---|
| `get_plugin_host_connection` / `HostConnection` | `token` | 每次启动随机、不落盘，窗口连宿主用 |
| `get_cc_connect_feishu_setup` / `FeishuProgress` | `qr`、`url` | 给用户扫的一次性登录码 |

## 怎么守住

1. **检查脚本**：新加 `scripts/check-secret-fields.mjs`，进 `pnpm check`。扫 `src-tauri/src/**/*.rs` 里带 `Serialize` 的结构体和枚举，字段名（`serde(rename_all)` 之前的蛇形名）按 `_` 切开后含 `token`、`secret`、`password`、`passwd`、`apikey`、`api_key`、`authorization`、`cookie`、`credential`、`private_key`、`device_key`，且类型是 `String`、`Option<String>`、`Vec<String>` 或 `serde_json::Value` 的，报错；`#[serde(skip)]`、`skip_serializing` 的不算，`bool` 不算（例如 `InfoItem.secret` 是开关）。只序列化到文件、不交给窗口的配置（`LocalApiConfig`、`ApprovalConfig` 等）和上面的例外名单登记在 `scripts/secret-fields-allowlist.json`，每条写 `{ file, type, field, reason }`。和行数白名单不同，这份可以新增，但新增要在 PR 正文写理由，评审时看。
2. **单元测试**：带密钥的网址那几处（第 3 行）各加一个测试，断言错误序列化后不含密钥；本机接口那项断言 `PluginsSnapshot` 序列化后不含令牌。
3. **第 3 版的生成器**：E36.3.4 从 Rust 函数生成宿主入口和 TypeScript 类型时，生成的类型也跑同一个检查（字段名同一张表）；E36.3.8 的验收已经写了「密钥不出现在任何宿主可见的返回值里」。
4. **仓库规则**：在 `src-tauri/AGENTS.md` 加一条「命令和事件不返回密钥明文，带密钥的网址发请求时错误去掉网址」，链到这份文档。
5. **数据表**：[data-storage.md](../data-storage.md) 里「`localStorage` 里没有密钥和令牌」那句保持成立；新加 `localStorage` key 时照这份文档核对。

## 后续子任务

先不建，主 agent 审完再建（各自要 issue）。按领域拆，互不碰同一批文件：

| 建议编号 | 标题 | scope | 编译 Rust | 验证 |
|---|---|---|---|---|
| 甲 | 本机接口令牌不回 JS：信息项的密值不出 Rust，复制由 Rust 写剪贴板 | `src-tauri/src/plugin_host/settings.rs`、`registry.rs`、`commands.rs`、`lib.rs` 的命令登记、`src/features/plugins/PluginInfoList.tsx`、`api.ts`、i18n（去掉「显示」）、相关回归页和快照、`contracts.md` | 要（主 crate） | Rust 一套 + `pnpm check` + `pnpm build` + `pnpm test:regression plugin` |
| 乙 | 日历订阅链接不进错误详情 | `src-tauri/src/calendar/`（`mod.rs`、`caldav.rs`、测试） | 要 | `cargo test` + `pnpm build:exe` |
| 丙 | 更新代理不回 JS | `src-tauri/src/system/updater.rs`、`update_channel.rs`、`src/features/updater/api.ts`、`updaterController.ts`、`contracts.md`。**注意**：工作区里 `src/features/updater/` 和 `system/update_runtime.rs` 正被别的会话改，开工前 `pnpm tasks conflicts` | 要 | Rust 一套 + `pnpm check` + `pnpm build` + `pnpm test:regression update` |
| 丁 | 守门检查：`check-secret-fields` 脚本、白名单、规则 | `scripts/check-secret-fields.mjs`、`scripts/secret-fields-allowlist.json`、`tests/scripts/` 下的测试、`package.json` 的 `check`、`src-tauri/AGENTS.md` | 不要 | `pnpm check` |

顺序：甲、乙、丙互不依赖，可以并行（同时最多两个编译）；丁最后做，或者先做、把甲乙丙要改的那几项临时登记进白名单，各子任务做完时从白名单删掉。

第 4、15 行（Bark 服务器地址、插件设置里的代理）暂不建任务，等有人反馈或做到对应的内置插件时顺手做。

## 要用户定的

1. 本机接口令牌改成 Rust 复制以后，设置里**不再能直接看到令牌明文**（只能复制，或打开 `local-api.json`）。建议这样做。
2. 甲、乙、丙三个子任务是否在第 3 阶段地基里就做（计划「要用户定的事」第 5 条）。三个都小，建议现在做，不等各领域插件化。
3. 「管不住」那一栏要不要写进以后的插件安装确认文案：同权模型下宿主插件能自己读凭据管理器。建议写，和方案「每项保护管什么、不管什么」一致。
