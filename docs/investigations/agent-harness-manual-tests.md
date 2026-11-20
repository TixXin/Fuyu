# Agent 适配真机实测清单

#179（协作者 ShengLin1001 提的）和 2026-11-15 这一轮 Agent 适配（B26、B27、B28、B30、B32、B33、B44，以及 B29、B34–B37、B46、B48、B49、B52–B58）里只写了代码和单元测试、没在真机上跑过的项目，合成这一份，按要在哪台机器上测分组。任务是 B47。

怎么用：
- 测过一项就勾掉，后面写日期、版本和结果；测出问题另开 issue，链接写在那一项后面。
- 新加的待测项写进这里对应的一节，不再往 #179 里贴长评论。
- 每项后面的括号是来源任务。

岛的版本：用含对应提交的 `pnpm build:exe` 产物，或者已发布的版本。开发版（`pnpm tauri dev`）读正式版的 Agent 状态，它的「安装/修复」装的是正式版的钩子（B65），钩子的结果也可以在开发版里测；审批卡片由正在听的岛接：钩子先试正式版的 `agent-approval.json`，连不上再试开发版写在同一目录的 `agent-approval.lane-<编号>.json`，所以正式版在跑时到正式版，只开开发版（或 Windows 上正式版让给开发版）时到开发版。

## 哪台机器都要测一次

### 设置页（B33）

- [ ] 开发版：设置 → AI Agent →「岛上显示」顶部没有黄色「钩子是旧版本」提醒
- [ ] 「显示哪些 Agent」列出装了的各家，每行带图标；关掉一家后 Agent 页不列它的会话，收起条的运行数也不算它，再打开恢复
- [ ] 开发版「连接」页：状态灯卡片右上没有「安装/修复」，出错时没有「清除状态」，卡片底下是开发版只读的说明
- [ ] 设置窗口拉到最窄时这句和各开关不溢出；浅色主题下看得清
- [ ] 正式版：老设置里关过 Codex 或 Claude Code 的，升级后开关仍是关
- [ ] 正式版：钩子是当前版本时，「岛上显示」和「连接」都没有「旧版本」提醒；「安装/修复」照常

### 通用（B27）

- [ ] 状态灯卡片：没装的代理（目录不存在）不显示那一行；装了的各一行
- [ ] 「钩子是旧版」提示只算本机有的代理
- [ ] 改名后的重装：装过钩子的各家都会重装

### 回复标记（B28）

- [ ] 老用户迁移：有 `~/.claude/rules/fuyu-reply-marker.md` 的机器，点「安装/修复」后旧文件被删，`~/.claude/CLAUDE.md` 末尾有一段；设置页回复标记卡片列出各家文件
- [ ] 打开开关：装了的几家文件末尾各一段（`~/.claude/CLAUDE.md`、`~/.codex/AGENTS.md`、`~/.workbuddy/CODEBUDDY.md`、`~/.gemini/GEMINI.md`、`~/.dsh/AGENTS.md`、`~/.config/opencode/AGENTS.md`），没装的那家不建目录；关掉只删这一段
- [ ] `CLAUDE.md` 和 `AGENTS.md` 软链到同一份文件时只有一段，卡片两行都写「软链，写在 …」
- [ ] 悬空软链：卡片里那一行红字报错，带链接和目标路径
- [ ] 各家新开会话，回复末尾带 ↩ / ⋯ / ✓：Agent 页最后一条消息不显示符号，↩ 按「等你」处理。Claude Code、Codex、WorkBuddy（确认它读 `~/.workbuddy/CODEBUDDY.md`，国内版和 WorkBuddy AI 是否一样）、Antigravity（App、IDE、CLI 是否都读 `~/.gemini/GEMINI.md`）、DSH（`$DSH_HOME/AGENTS.md`）、opencode（`~/.config/opencode/AGENTS.md`）

### 新版岛上的显示（#179 原清单）

- [ ] 各家会话在岛上和 Agent 页的图标、名称（`DeepSeek Harness`）、筛选、点击跳转

## Mac（这台机器上有 DSH、`agy`、Antigravity.app、WorkBuddy AI.app、Codex、Claude 桌面版）

### DeepSeek Harness

- [ ] 会话列表：开一个会话，核对标题、模型、档位、最近提问和回复；提问时显示「等你」；运行中、完成、10 分钟没动静变「可能中断」；点会话切到 DSH 窗口（#179 原清单）
- [ ] 「安装/修复」：岛在数据目录生成 `dsh-plugin/`（`package.json`、`cordis.patch.yml`、`index.js`）并删除旧 `fuyu-dsh-hooks.json`；DSH 家目录下没有自定义 `cordis.patch.yml` 时自动写入 `- insert: [{ id: fuyu-island, name: ... }]`，钩子状态直接为 current；已有自定义 `cordis.patch.yml` 时原文件保留、安装结果末尾给出要追加的 3 行 `- insert:` 片段（B72.1）
- [ ] 重启 DSH 后发一句话：状态灯亮运行中，结束后变完成（出错变失败）（B72.1）
- [ ] 开岛上审批，让 DSH 触发一次需要审批的工具调用（`approval/request`）：岛上弹出审批卡，显示工具名、命令/文件参数与原因，且有「允许」「拒绝」「到终端」三个按钮；点「允许」DSH 直接放行执行（不再弹 DSH 确认框）；点「拒绝」DSH 显示被拒绝；点「到终端」交回 DSH 原生确认框；挂起期间在 DSH 里取消本轮对话，岛上审批卡在 1 秒内自动关闭（B72.1）
- [ ] 会话卡片：显示「deepseek-flash · high」这类模型和强度；权限预设切到 auto 显示「自动」，完全访问显示「跳过确认」；写待办时显示 1/3 这类进度；跑较长命令时显示工具名（B44）

### Antigravity

- [ ] App 和 IDE 是否和 CLI 一样读 `~/.gemini/config/hooks.json`、触发 SessionStart / PreInvocation / Stop，输入字段（`cwd`、`workspacePaths`、`conversationId`）是否一样（#179 原清单）
- [ ] 「安装/修复」：`~/.gemini/config/hooks.json` 的 `fuyu` 组有 SessionStart、PreInvocation、PreToolUse（matcher `run_command`）、Stop（B27）
- [ ] `agy` 里发一句话：状态灯变运行中，Stop 后完成；会话列表照旧（B27）
- [ ] 开岛上审批，让它 `run_command`：岛上出卡片显示命令；允许、拒绝、交回终端（Antigravity 自己再问一次）都对；挂起期间显示「等你」（B27）
- [ ] 关掉岛上审批时脚本输出空 stdout，确认 Antigravity 把空输出当成不表态而不是报错（B27）
- [ ] 权限预设是 TURBO 的用户，开了岛上审批后每条 `run_command` 都先问岛，确认这是想要的（B27）
- [ ] 会话卡片：`agy` 选带强度的模型时显示模型和强度；跑命令时显示 `run_command` 和命令；上下文 token 有数；IDE / App 只看当前工具和 token（B44）

### WorkBuddy

- [x] macOS 上开着时会话正常，关掉后变「已退出」（B37、B49）。2026-11-15，WorkBuddy AI 5.8.4：`~/.workbuddy-ai` 里的会话列出来，标题、模型对；没开时已退出，开着时正常，退出约 35 秒后又变已退出
- [ ] WorkBuddy AI 发一轮对话：会话变运行中，回复完变完成（B49）
- [ ] 「安装/修复」后 `~/.workbuddy-ai/settings.json` 里有岛的钩子；彻底退出再开 WorkBuddy AI，发一句话时状态灯卡片里 WorkBuddy 亮运行中（B49）
- [ ] 打开回复标记：`~/.workbuddy-ai/CODEBUDDY.md` 末尾多一段（B49）
- [ ] 点 WorkBuddy AI 的会话：切到 WorkBuddy AI 窗口（B49）

### opencode（本机没装，装上后测）

- [ ] 同下面 Windows 一节的 1、3、4（B30）
- [ ] 同下面 Windows 一节 opencode 1.x 插件的各项，Windows 专有的那项除外（B34）

### Qoder、CodeBuddy Code、Qwen Code（B48，本机没装，装上后测）

装法：`npm i -g @qoder-ai/qodercli`、`npm i -g @tencent-ai/codebuddy-code`、`npm i -g @qwen-code/qwen-code`。每家都测：

- [ ] 「安装/修复」后状态灯卡片里出现这一家、状态是已安装；`~/.<家>/settings.json` 的 hooks 里有 UserPromptSubmit、PreToolUse、Stop、StopFailure、PermissionRequest（CodeBuddy 还有 Notification），原有设置和钩子没被动（B48）
- [ ] Qoder：只装国际版时只写 `~/.qoder`；装了 CN 版（或手动建 `~/.qoder-cn`）后再点一次，两份都写（B48）
- [ ] 开会话问一句：Agent 页列出来，标题对（Qoder 读 `-session.json` 的标题，Qwen 读自动标题，CodeBuddy 读 ai-title），目录、模型、最近提问和回复都有；进行中转圈，回复完变完成（B48）
- [ ] 跑一条要授权的命令：岛上出「等你确认」，允许 / 拒绝后 CLI 照做；CodeBuddy 的 auto 模式下自动放行的工具不亮「等你」（B48）
- [ ] 打开回复标记：三家的全局提示词文件（`AGENTS.md`、`CODEBUDDY.md`、`QWEN.md`）末尾多一段，新回复的末行是 ↩ / ⋯ / ✓（B48）
- [ ] 点会话：切到跑这个 CLI 的终端窗口（B48）
- [ ] 对一遍真机会话的字段名：Qwen 的 `tool_result` 记录、CodeBuddy 套壳记录的字段是从源码读的（只看字段名，不抄内容）（B48）

### TRAE、TRAE CN（B29、B72.3，本机没装，装上后两个版本各测一遍）

- [ ] 「安装/修复」后状态灯卡片里出现「TRAE」/「TRAE CN」、状态已安装；`~/.trae/hooks.json`（或 `~/.trae-cn/hooks.json`）里有 `"version": 1` 和 UserPromptSubmit、PreToolUse（两组，一组 matcher 覆盖命令、写改删文件与 `mcp__.*` 走审批）、PostToolUse、Stop、Notification，原有内容不动（B29、B72.3）
- [ ] TRAE 设置 → Hooks 里看得到岛的钩子吗，要不要手动启用或过安全提示；执行方式是「沙箱中运行」时 `agent-trae/` 里有没有文件（B29）
- [ ] Agent / SOLO 模式问一句：Agent 页出现会话，标题是第一句提问，目录对；跑命令时转圈并显示当前工具；回复完变完成、显示最后的回复；第二轮后最近提问更新、标题不变（B29）
- [ ] 将 TRAE 设为「自动执行」并开岛上审批，跑命令、写改文件或调 MCP 工具：岛上出审批卡片（主会话带 `agent_id` 如 `solo_agent` 时不被误判为子代理）；点允许直接执行不再弹 TRAE 确认框；点拒绝 TRAE 不执行并显示理由；点「交回」时触发 TRAE 确认框；只读工具不弹卡（B29、B72.3）
- [ ] TRAE 自己弹确认（不经过岛的工具）时，岛上显示「等你」（B29）
- [ ] 点会话切到 TRAE / TRAE CN 窗口（B29）
- [ ] 打开 TRAE 的「导入 Claude Code 钩子」，看会不会多出一条 Claude Code 会话（B29）
- [ ] 核对钩子输入的字段名：`session_id`、`cwd`、`workspace_roots`、`prompt`、`tool_name`、`tool_input.command`、`last_assistant_message`、`notification_type`（只看字段名，不抄内容）（B29）

### ZCode（B53，本机没装，装上后测）

- [ ] 「安装/修复」后状态灯卡片里出现「ZCode」、状态已安装；`~/.zcode/cli/config.json` 里 `hooks.enabled` 是 true，`hooks.events` 下有 UserPromptSubmit、PreToolUse、Stop、PermissionRequest（两组），原有内容不动；ZCode 自己的设置 → Hooks 页能看到这几条（B53）
- [ ] 新开会话问一句：Agent 页列出来，标题对（ZCode 生成标题前显示第一句提问），目录、模型、最近提问和回复都有；跑命令时转圈并显示当前工具；回复完变完成（B53）
- [ ] 子代理、工作流子任务不单独列出；在 ZCode 里删掉的会话从列表消失（B53）
- [ ] 跑一条要授权的命令：岛上出卡片，允许 / 拒绝后 ZCode 照做，「交回」回到 ZCode 里问（B53）
- [ ] 打开回复标记：`~/.zcode/AGENTS.md` 末尾多一段，新回复的末行能认出来（B53）
- [ ] 点会话：CLI 切到所在终端；桌面版记下进程名和能不能切过去（B53）
- [ ] 对一遍会话库的字段名：助手消息的模型是 `modelId` 还是 `modelID`，`part` 里工具的 `tool`、`state.status`（只看字段名，不抄内容）（B53）

### Kimi Code（B52，本机没装 CLI，装上后测）

- [ ] 装 `kimi`、登录后「安装/修复」：`~/.kimi-code/config.toml` 末尾多一段岛的 `[[hooks]]`，**`kimi` 还能正常启动**（多写字段会让整个配置加载失败），状态灯卡片里 Kimi Code 显示已安装（B52）
- [ ] 开新会话问一句：Agent 页出现会话，标题、目录、最近提问对；跑的时候是进行中、有当前工具，跑完变完成并显示最近回复和模型（B52）
- [ ] 跑一条要批准的命令：岛上显示「等你」，点进去跳到终端；在终端批准后「等你」消失（B52）
- [ ] 按 Esc 打断时变完成，出错（例如断网）时变失败（B52）
- [ ] `/rename` 改名后标题跟着变；归档的会话不再出现（B52）
- [ ] 打开回复标记：`~/.kimi-code/AGENTS.md` 末尾有岛的那段，回复末行能认出来（B52）
- [ ] 设 `KIMI_CODE_HOME` 到别处再测一遍「安装/修复」和开会话（B52）

### MiMo Code（B54，本机没装，装上后测）

- [ ] 「安装/修复」后钩子卡片里 MiMo Code 是已安装；`~/.config/mimocode/plugin/fuyu-island.js` 存在，路由是 `/mimo/permission`（B54）
- [ ] 问一句：Agent 页出现会话，标题是 MiMo 生成的（生成前是第一句提问），目录、模型、最近提问和回复对；跑命令时转圈、显示当前工具，回复完变完成（B54）
- [ ] 让它派一个子代理：会话的最近回复和状态跟主代理走，不被子代理的消息顶掉（B54）
- [ ] 跑一条要授权的命令：岛上出卡片，允许 / 拒绝后 MiMo 照做，拒绝理由显示在 MiMo 里（B54）
- [ ] 打开回复标记：`~/.config/mimocode/AGENTS.md` 末尾多一段（B54）
- [ ] 对一遍会话库的字段名：助手消息的模型字段、主代理的 `message.agent_id` 是不是 `main`（只看字段名，不抄内容）（B54）

### Grok CLI（B57，本机装了 1.0.77）

- [x] headless 跑一轮：钩子输入同时带驼峰和下划线字段、`transcript_path` 在 `~/.grok/sessions/` 下；读真实会话给出完成、标题、模型、推理强度、提问和回复（B57，2026-11-15）
- [ ] 「安装/修复」后 `~/.grok/hooks/fuyu-island.json` 的内容对，状态灯卡片里有 Grok CLI（B57）
- [ ] 交互式 TUI 里一轮：岛上亮灯 → 完成；Ctrl+C 打断后变完成（B57）
- [ ] Grok 弹授权时岛上显示「等你」，批准后回到进行中（B57）
- [ ] 打开回复标记：写进 `~/.grok/rules/fuyu-island.md`，回复末尾出现标记（B57）
- [ ] 同时装着 Claude Code 钩子时，岛上不出现「Claude Code」的审批或提问卡片；Claude Code 状态灯跟着亮属已知限制（B56）
- [ ] 让它派子代理：子代理的会话不单独列出（B57）
- [ ] 点会话切到终端（B57）

### GitHub Copilot CLI（B55，本机没装，装上后测）

- [ ] 装 `@github/copilot`，跑一轮带工具调用的对话：Agent 页出现会话，标题是 `workspace.yaml` 的 summary（确认真有这个键），运行中显示正在跑的工具，结束后显示最后一句回复（B55）
- [ ] 子代理的消息不顶掉主会话的工具和回复；`/exit` 后会话显示已结束（B55）
- [ ] 状态灯、等你、岛上允许 / 拒绝（拒绝时 Copilot 收到理由）；同一会话不再同时出现成 Claude Code（B55）
- [ ] `PermissionRequest` 钩子的输入里有没有 `tool_name` / `tool_input`（文档没写；没有时审批卡片缺工具名）（B55）

### Droid（B58、B72.2，本机没装，装上后测）

- [ ] 装 droid 跑一轮：会话出现在 Agent 页，目录对（项目路径带 `-` 的以 `session_start.cwd` 为准），模型和推理强度显示（B58）
- [ ] 注入的系统提问（`visibility: hidden`）不当成标题或最近提问（B58）
- [ ] 装完重开会话，状态灯和「等你」（permission_prompt）正常；`hooks.json` 或 `settings.json` 里用户原有的钩子还在（B58）
- [ ] 开岛上审批，跑命令或写文件工具（`Bash`/`Execute`/`Edit`/`Write`）：岛上弹出审批卡，点允许直接执行不再弹终端确认框、点拒绝带理由拦截、点交回终端回到 Droid 确认框；只读工具不弹卡（B72.2）

### Codex 和 Claude 桌面 App（B46）

- [ ] 开一个 Codex 会话（CLI 或 Codex Desktop）：Agent 页列出来，标题是 Codex 起的名字（`threads.name` / `session_index.jsonl`），模型、档位对（B46）
- [ ] 接着聊一个前几天开的 Codex 会话（rollout 在三天前的日期目录里）：Agent 页能列出来（B46）
- [ ] 归档的 Codex 会话、子代理和 guardian 线程不出现在列表里（B46）
- [ ] Codex 关着时岛不在 `~/.codex/thread_history_1.sqlite` 旁边建 `-shm` / `-wal`；Codex 开着时岛读库不卡，Codex 不报库被锁（B46）
- [ ] Claude 桌面 App 的 Code 页开一个会话：Agent 页只出现一条，标题和 App 侧栏一致；在 App 里改名后岛上的标题跟着变（B46）

## Windows

### WorkBuddy

- [ ] 「等你」钩子：钩子写在 `~/.workbuddy/settings.json`（官方文档写 `~/.codebuddy`），改完要彻底退出 WorkBuddy 才生效；请求一次授权时岛上亮「等你」（#179 原清单）
- [ ] 退出判断：5.9.3 的 `~/.workbuddy/sessions/<pid>.json` 只记宿主进程；关掉后会话变「已退出」，开着时一直正常（#179 原清单）
- [ ] 「安装/修复」：`~/.workbuddy/settings.json` 里出现 UserPromptSubmit、PreToolUse(*)、Stop、PermissionRequest（两条）；彻底退出再开（B27）
- [ ] 发一句话：状态灯卡片里 WorkBuddy 变运行中，结束后完成（B27）
- [ ] 开岛上审批，让它跑要授权的命令：岛上出卡片，允许 / 拒绝能回到 WorkBuddy；核对它认不认 `hookSpecificOutput.decision.behavior` 格式（B27）
- [ ] 不开岛上审批时，等授权仍然亮红灯（B27）
- [ ] `cmd.exe /d /s /c ""…fuyu-agent-running.cmd" workbuddy"` 这种写法 WorkBuddy 能跑（B27）
- [ ] 会话卡片：用 TodoWrite 做多步任务时显示进度；看会话 JSONL 的 `providerData.rawUsage` 有没有 token 字段，有就记下来（B44）
- [ ] WorkBuddy AI（`WorkBuddyAI.exe`、`%USERPROFILE%\.workbuddy-ai`）：会话列出来，开着、关掉时「已退出」对；「安装/修复」写进 `.workbuddy-ai\settings.json`；点会话切到它的窗口（B49）
- [ ] 用量悬停卡片（设置 → AI Agent → 用量环 → 打开 WorkBuddy）：读 `%USERPROFILE%\.workbuddy\projects` 与 `%USERPROFILE%\.workbuddy-ai\projects` 会话记录，悬停卡片显示今日 / 近 7 天 / 累计已用积分，不进百分比圆环；只开它而关掉五个圆环源时，折叠岛显示独立悬停用量图标（B25）

### Antigravity

- [ ] 上面 Mac 一节的「安装/修复」和审批各项在 Windows 上再测一次（B27）
- [ ] 用量环（设置 → AI Agent → 用量环 → 打开 Antigravity）：Antigravity 桌面版或 IDE 开着时，岛经 PEB 命令行（`--csrf_token`）与 `netstat -ano -p tcp` 发现本地 `language_server_windows_*.exe` 环回端口，显示同心双环（Gemini 5h / 7d）且悬停附带套餐名与 Claude / GPT 5h / 7d；关掉 Antigravity 后退回只读 `%USERPROFILE%\.gemini\` 登录令牌走 Cloud Code 查询（B25）

### DeepSeek Harness

- [ ] Windows 上生成的 `%USERPROFILE%\.fuyu\dsh-plugin\index.js`（反斜杠路径 JSON 转义）在 DSH Desktop / `dsh web` 启动时能经 `%USERPROFILE%\.dsh\cordis.patch.yml` 正常加载并驱动状态灯与岛上审批（允许、拒绝、交回 DSH、取消）（B72.1）
- [ ] 用量悬停卡片（设置 → AI Agent → 用量环 → 打开 DeepSeek Harness）：默认官方路由下只读活跃 DSH 数据目录的 `.credentials.yaml` 查询账户或 API 余额，悬停卡片显示 `¥xx.xx`（不进圆环）；`cordis*.yml` 配了第三方自定义网关时显示「自定义网关，未查询官方余额」而不发请求（B25）
- [ ] 数据目录（B32）。每项在那个目录里开会话、发一句话，看列表里有没有、三态对不对：
  - [ ] 系统环境变量 `DSH_HOME=D:\dsh-data`（设好后重启岛），`npx @deepseek-ai/dsh web` 开会话
  - [ ] `DSH_HOME=~\dsh-alt` 读 `%USERPROFILE%\dsh-alt`
  - [ ] `DSH_HOME` 设成空格时当成没设，仍读 `~/.dsh`
  - [ ] DSH NEXT 默认目录 `~/.dsh`
  - [ ] DSH NEXT 设置里改数据目录（写 `%APPDATA%\DSH NEXT\home\desktop-next-location.json`），不用重启岛
  - [ ] DSH NEXT 用环境变量 `DSH_DESKTOP_NEXT_HOME`（要重启岛）
  - [ ] DSH Desktop Beta（默认 `~/.dsh-beta`；改目录写 `%APPDATA%\DSH Desktop Beta\home\desktop-next-location.json`）
  - [ ] DSH Desktop 稳定版在「恢复」里改数据目录（`%APPDATA%\DSH Desktop\data-directory\state.json` 的 `activeHome`）
  - [ ] 同一会话在两处都有时只列一条，标题取较新的
  - [ ] 点会话跳到 DSH NEXT 的窗口
  - [ ] dshed（`%APPDATA%\dshed\dsh`）开的会话出现
- [ ] 镜像目录 `remote-sessions/<主机>/.dsh*/...` 写得进去，临时文件 `.jsonl.tmp` 改名成功（B26）

### opencode（B30）

- [ ] opencode 2.3 的 TUI 开会话提问：Agent 页出现，有图标、标题、模型、目录；回答中是运行中，答完变完成
- [ ] 出错的请求（例如断网）显示出错
- [ ] `opencode service stop` 或结束后台服务进程：运行中的会话变完成并标为已退出
- [ ] 桌面版 OpenCode 的会话也出现；点会话跳到 OpenCode 窗口
- [ ] 终端里的 TUI：点会话跳到那个终端窗口
- [ ] opencode 1.19.x：会话出现，三态按最后一条消息判断
- [ ] 子代理会话不单独列出
- [ ] 设了 `XDG_DATA_HOME` 或 `OPENCODE_DB` 的机器能找到库
- [ ] opencode 正在写库时岛读库不报错、不卡
- [ ] 要授权的命令（例如 `git push`）：TUI 弹授权时，岛上 2 秒内变「等你」；TUI 里允许后变回运行中
- [ ] 开「在岛上审批」：岛上弹卡片显示命令；允许后 TUI 弹框消失、命令执行；拒绝写理由，opencode 收到理由
- [ ] 卡片上点「交回终端」：卡片关掉，TUI 里仍可回答
- [ ] 在 TUI 里先回答：岛上卡片自己关掉
- [ ] 编辑文件、访问网页的授权：卡片分别显示文件路径和网址
- [ ] 结束后台服务：等你和卡片都消失，岛日志没有连接错误刷屏
- [ ] 同时开正式版和开发版岛：一边点允许，另一边卡片关掉，opencode 只收到一次回复
- [ ] 服务默认端口 28894，`service.json` 在 `%USERPROFILE%\.local\state\opencode`
- [ ] 会话卡片：plan agent 显示「计划」；跑命令时显示 `bash` 和命令；待办进度；上下文 token；2.x 和 1.x 各一次（B44）

### opencode 1.x 插件（B34）

插件已在 Mac 上用 opencode 1.19.5（隔离的 XDG 目录、假的模型和假的审批接口）跑通允许、拒绝带理由、TUI 先回；下面是要用真岛、真 TUI 再测的。

- [ ] 装了 opencode 1.19.x 的机器点「安装/修复」：opencode 配置目录下出现 `plugin/fuyu-island.js`（设了 `XDG_CONFIG_HOME` 时在那下面），里面的岛数据目录是这台机器的；没装 opencode 的机器不建目录（B34）
- [ ] 1.x TUI 跑要授权的命令：岛上 2 秒内变「等你」；TUI 里允许后变回运行中，`agent-notifications/opencode-plugin-*.json` 删掉（B34）
- [ ] 1.x 开「在岛上审批」：岛上弹卡片显示命令；允许后 TUI 弹框消失、命令执行；拒绝写理由，opencode 收到理由；「交回终端」后 TUI 仍可回答（B34）
- [ ] 1.x 在 TUI 里先回答：岛上卡片自己关掉（B34）
- [ ] 1.x 的 `opencode serve` 加网页端：同样能等你和审批（插件跑在服务进程里）（B34）
- [ ] opencode 2.x 装着这个插件不报错（2.x 也扫 `plugin/`，按源码会当成什么都不做的插件加载）；报错的话要改成只在 1.x 时安装（B34）
- [ ] Windows：插件写进 `%USERPROFILE%\.config\opencode\plugin\`，岛数据目录里的反斜杠在 JS 里转义正确（B34）

### Codex 和 Claude 桌面 App（B46）

- [ ] Claude 桌面 App 当前版本的 Code 页：`%APPDATA%\Claude\claude-code-sessions\<组织>\<账号>\local_<id>.json` 的 `cliSessionId` 在 `~/.claude/projects` 里有没有对应的 jsonl（#180 里 6–7 月的旧会话对不上；Mac 当前版本 84/84 对得上）。对得上就照 Mac 一节核对标题；对不上记下正文在哪。代码按 `%USERPROFILE%\AppData\Roaming\Claude` 找，`APPDATA` 改过位置的机器读不到（B46）
- [ ] Codex（Store 版 `OpenAI.Codex`）：同 Mac 一节 Codex 的几项（B46）

### Qoder、CodeBuddy Code、Qwen Code（B48）

- [ ] 同 Mac 一节的「安装/修复」、开会话、授权三项，走 `.cmd` / `.ps1` 脚本（B48）

### TRAE、TRAE CN（B29）

- [ ] 同 Mac 一节的「安装/修复」、问一句、跑命令三项，走 `.cmd` 脚本（B29）

### ZCode（B53）

- [ ] 同 Mac 一节的「安装/修复」、开会话、授权三项，走 `.cmd` 脚本；记下 ZCode 在 Windows 上用哪个 shell 跑 `type: "command"` 的钩子（B53）

### Kimi Code（B52）

- [ ] 同 Mac 一节的「安装/修复」、开会话、等你、打断四项，钩子经 cmd.exe 跑 `.cmd` / `.ps1`（B52）

### MiMo Code（B54）

- [ ] 数据和配置目录是不是也在 `%USERPROFILE%\.local\share\mimocode`、`%USERPROFILE%\.config\mimocode`；再过一遍 Mac 一节的「安装/修复」、问一句、授权三项（B54）

### Grok CLI（B57）

- [ ] Git Bash 下钩子脚本能跑；再过一遍 Mac 一节的「安装/修复」、交互式一轮、等你（B57）

### Copilot CLI、Droid（B55、B58）

- [ ] Copilot：钩子走 `powershell` 字段（`& '…fuyu-agent-running.cmd' copilot`），确认输入能传到 `.cmd` 和 `.ps1` 脚本（等你、审批都靠它）；再过一遍 Mac 一节的跑一轮和审批（B55）
- [ ] Droid：同 Mac 一节的跑一轮和等你（B58）

## Linux 服务器（SSH 远程，B26）

- [ ] 远端 DSH：`npx @deepseek-ai/dsh` 开会话，岛上加这台主机。会话出现在主机下面，标题、模型、最近提问对；运行中 / 完成 / 提问时「等你」
- [ ] `$DSH_HOME`：写在 `~/.bashrc` 非交互式提前 return 那一行之前时会话出现；只在交互式 shell 里 export 的不出现（预期）
- [ ] 检查点超过 256 KB 的会话也能列出来；超过 512 KB 的不列
- [ ] CentOS 7：DSH 和 Claude Code 的会话同时能拉回来，没有「Unexpected line in the reply」
- [ ] Antigravity CLI（glibc 够新的服务器，如 Ubuntu 22.04）：远程「安装/修复」后远端 `~/.gemini/config/hooks.json` 多了 `fuyu` 组、用户自己的组还在；`agy` 开会话时远端 `~/.fuyu/agent-antigravity/` 出现 `running-<id>.json`，岛上亮运行中，结束后变完成；钩子输入是多行 JSON 时 conversationId 也能读出来
- [ ] 记下 `agy` 最低要求的 glibc（`objdump -T ~/.local/bin/agy | grep -o 'GLIBC_[0-9.]*' | sort -V | tail -1`）；CentOS 7 上试 musl 包
- [ ] 回复标记（B35）：打开后远端 `~/.claude/CLAUDE.md`、`~/.codex/AGENTS.md`、有 `~/.gemini/antigravity-cli` 时的 `~/.gemini/GEMINI.md`、`~/.dsh/AGENTS.md` 末尾各有且只有一段，用户原有内容保留；关掉后删干净；旧的 `~/.claude/rules/fuyu-reply-marker.md` 被删
- [ ] 回复标记：远端 `CLAUDE.md` 是指向别处的软链时改的是目标、软链还在；两家指向同一个文件时只有一段；悬空软链不改，设置页这台主机下面报「is a link to …, which does not exist」
- [ ] 回复标记：`$CLAUDE_CONFIG_DIR`、`$CODEX_HOME`、`$DSH_HOME` 写在 `~/.bashrc` 非交互式提前 return 之前时改的是它们指的目录
- [ ] 远程「安装/修复」：远端只有旧 rules 文件时，修复后各家提示词文件补上段落、旧文件删掉；远端从没开过回复标记时什么都不写
- [ ] Antigravity CLI 远程审批（B36）：岛上打开审批，远程「安装/修复」后远端 `~/.gemini/config/hooks.json` 的 `fuyu` 组多了 `PreToolUse`（matcher `run_command`）；`agy` 跑命令时岛上出卡片、标着这台主机，命令行对；允许后命令执行、拒绝后 `agy` 显示拒绝理由、「终端」让 `agy` 自己问
- [ ] 远程审批：岛关掉或这台主机在岛上关掉（`~/.fuyu/approval-port` 不在）时 `agy` 跑命令不卡、照它自己的设置走；卡片等到超时（约 145 秒）也是交回给它
- [ ] 远程审批：岛上审批关掉时卡片不出现，`agy` 照常问自己的
- [ ] opencode 远程会话（B36）：服务器上 `opencode`（1.x 和 2.x 各一次）开会话，岛上这台主机下面出现 opencode 会话，标题、目录、最近提问、回复、模型对；运行中 / 完成 / 出错和本机一致；跑命令时显示命令
- [ ] 远端只有 `python3` 没有 `sqlite3`（Ubuntu 默认）时也能列出；两个都没有时不列、不报错；`~/.fuyu/opencode-recent.db` 在 512 KB 以内（会话很多、工具输出很大时看一下大小）
- [ ] opencode 不动时远端不重复抽取（`~/.fuyu/opencode-recent.db` 的修改时间不变）；`$XDG_DATA_HOME`、`$OPENCODE_DB` 写在 `~/.bashrc` 非交互式提前 return 之前时读的是它们指的库
