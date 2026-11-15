# Agent 适配真机实测清单

#179（协作者 ShengLin1001 提的）和 2026-11-15 这一轮 Agent 适配（B26、B27、B28、B30、B32、B33、B44）里只写了代码和单元测试、没在真机上跑过的项目，合成这一份，按要在哪台机器上测分组。任务是 B47。

怎么用：
- 测过一项就勾掉，后面写日期、版本和结果；测出问题另开 issue，链接写在那一项后面。
- 新加的待测项写进这里对应的一节，不再往 #179 里贴长评论。
- 每项后面的括号是来源任务。

岛的版本：用含对应提交的 `pnpm build:exe` 产物，或者已发布的版本。开发版（`pnpm tauri dev`）只读正式版的 Agent 状态、不装钩子，钩子相关的项要用正式版测。

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
- [ ] 「安装/修复」：岛写 `~/.fuyu/fuyu-dsh-hooks.json`，安装结果末尾给出要加进 `profiles/<名字>/cordis.patch.yml` 的几行（B27）
- [ ] 核对那几行（`- id: fuyu-hooks / name: "@deepseek-ai/dsh-hooks-claude-code" / config.configPath`）是不是 DSH patch 层正确的写法；桥接包是 DSH 自带还是要在 profile 目录装（B27）
- [ ] 加上后重启 DSH 再点「安装/修复」：提示消失，钩子状态变 current；发一句话，状态灯亮运行中 / 完成（B27）
- [ ] 开岛上审批，DSH 跑 shell 工具：岛上只有「交回终端 / 拒绝」，拒绝后 DSH 显示被拦下；核对 DSH 的 shell 工具名，matcher 现在是 `^(shell|exec|bash|run_command|run_code)$`（B27）
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

- [ ] macOS 上开着时会话正常，关掉后变「已退出」（B37，做完后测）

### opencode（本机没装，装上后测）

- [ ] 同下面 Windows 一节的 1、3、4（B30）

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

### Antigravity

- [ ] 上面 Mac 一节的「安装/修复」和审批各项在 Windows 上再测一次（B27）

### DeepSeek Harness

- [ ] Windows 上桥接用什么 shell 跑 command 字符串（cmd 还是 PowerShell）；命令是 `cmd.exe /d /s /c ""…" dsh"` / `powershell.exe -NoProfile … -File "…" dsh completed`（B27）
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
