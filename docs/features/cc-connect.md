# cc-connect：本机与远程电脑

内置插件 `cc-connect`（2026-11-16 起是第 3 版内置插件，之前是第 2 版的 `focusd.cc-connect`，E36.3.41）用 [cc-connect](https://github.com/chenhg5/cc-connect) 把 AI 代理接到飞书、Telegram、Discord 机器人上，手机推送也走它。Rust 在 `src-tauri/src/cc_connect/`（看护岛启动的 cc-connect 是插件的后台 `runner`），前端封装在 `src/features/cc-connect/api.ts`；设置在 设置 → AI Agent → 提醒 的「cc-connect 手机连接」一节，开关在 设置 → 插件（第 3 版）。手机推送不直接调这些命令，经窗口服务 `cc-connect/v1`（`targets`、`send`，见 [v3-services.md](../architecture/plugins/v3-services.md)）。

## 两个平台各有什么

| 部分 | 文件 | Windows | macOS |
|---|---|---|---|
| 本机：找程序、下载 Windows 版、岛托管运行、加项目、飞书扫码、读状态、发消息 | `local.rs`、`locate.rs`、`install.rs`、`runner.rs`、`feishu.rs` | ✓ | 不支持（`local_unsupported.rs`，G1.28 做） |
| 机器人 token 检查（`check_cc_connect_bot`） | `bots.rs` | ✓ | ✓ |
| 检测代理（`detect_cc_connect_agents`） | `agents.rs` | ✓ | ✓ |
| 远程：读状态、发消息、安装、加项目、飞书扫码、启动重启 | `remote.rs`、`remote_install.rs`、`remote_project.rs`、`remote_feishu.rs`、`remote_run.rs`、`script.rs` | ✓ | ✓ |

远程命令都经 `agent_status::remote_fetch::run_ssh`：脚本从 ssh 的 stdin 传给远端的 `sh -s`，命令行里只有主机名。要传的文本（消息、配置块、安装包）都先 base64 编码，放进脚本里再在远端解码，不拼进 shell 语句。

## 代理

`agents.rs` 的 `AGENTS` 是 cc-connect 有适配器、岛也认识的代理，`type` 是写进 `config.toml` 的 `[projects.agent] type`：

| type | 名字 | 命令 | `mode` |
|---|---|---|---|
| `claudecode` | Claude Code | `claude` | `default` |
| `codex` | Codex | `codex` | `suggest` |
| `copilot` | GitHub Copilot CLI | `copilot` | 不写 |
| `opencode` | opencode | `opencode` | 不写 |
| `qoder` | Qoder CLI | `qodercli` | 不写 |
| `kimi` | Kimi Code | `kimi` | 不写 |
| `antigravity` | Antigravity | `agy` | 不写 |

cc-connect 另有 cursor、gemini、iflow、pi、devin 等适配器，岛不认识这些代理，没列。

- 本机：按 `PATH` 找，再加 `~/.local/bin`、`~/.bun/bin`、`~/.npm-global/bin`（Mac 再加 `/opt/homebrew/bin`、`/usr/local/bin`）；Windows 按 `PATHEXT` 试扩展名。
- 远程：在登录 shell（有 bash 用 `bash -lc`，否则 `sh -c`）里 `command -v`，`PATH` 前面加 `~/.local/bin`。远程启动 cc-connect 也用同样的登录 shell，所以检测到的代理 cc-connect 也找得到。

## 远程安装（`install_cc_connect_remote`）

1. 远端先找已有的 cc-connect（设置里的路径、正在跑的进程、登录 shell 的 `PATH`、`~/.local/bin/cc-connect`），找到就直接返回 `installed: false`。
2. 用 `uname -sm` 定包：Linux 或 Darwin，amd64 或 arm64，其他的报 `ccConnect.remoteSystem`。
3. 岛在本机从 GitHub 下最新版的 `cc-connect-<版本>-<系统>-<架构>.tar.gz`，按 `checksums.txt` 校验 sha256，再核对包里只有一个名字以 `cc-connect` 开头的程序。
4. 包以 base64 写进脚本传上去，每 1000 行一个 heredoc 追加到同一个文件再一起解码：bash 读一个大 heredoc 的耗时随长度平方增长，20 多 MB 的包放进一个 heredoc，在 CentOS 7 上要两个小时，分段后约一分钟。远端有 `sha256sum` 或 `shasum` 时再校验一次，解出程序写成 `~/.local/bin/cc-connect.part`，`chmod 755` 后改名为 `cc-connect`。

## 远程加项目（`add_cc_connect_remote_project`）

1. 先读一次：展开工作文件夹里的 `~`、确认它存在，取回 `~/.cc-connect/config.toml` 的 `cksum` 和全文。
2. 岛上检查项目名、重名、代理、平台、token 和 `allow_from`（和本机同一套规则），用远端展开后的文件夹拼项目块；远程不写本机的代理地址。
3. 再写一次：`cksum` 和第一次读到的不同就报 `ccConnect.remoteChanged`，什么都不写；否则先复制成 `config.toml.bak-fuyu-<时间>`，新内容写进 `config.toml.fuyu.tmp`，确认里面有这个项目名后改名替换。任何一步失败都用备份还原（原来没有配置文件的就删掉），报 `ccConnect.remoteWrite`。
4. 飞书在远程要扫码建机器人，见下一节；这个命令收到 `feishu` 报 `ccConnect.remoteFeishu`。

加完项目不会自动重启，前端加完一台电脑的全部项目后再调一次重启。

## 远程飞书扫码（`start_cc_connect_remote_feishu_setup`）

飞书机器人在远程也靠扫码建：`startCcConnectRemoteFeishuSetup(host, path, { project, agent, workDir })` 开始，前端每秒左右调 `getCcConnectRemoteFeishuSetup()`，返回形状和本机的 `CcConnectFeishuSetup` 一样；`cancelCcConnectRemoteFeishuSetup()` 取消。同一时间只有一个远程扫码，再开报 `ccConnect.feishuRunning`；上一次的结果（成功或失败）一直留着，直到取消或开始下一次。

1. 先照「远程加项目」读一次配置，检查项目名、重名、代理和工作文件夹，拼一个只有 `type = "feishu"`、不带 token 的项目块。这些检查不过的，开始命令直接报错。
2. 后台线程开一条长 SSH 会话（`run_ssh` 要等远端脚本结束才返回）：照「远程加项目」第 3 步核对校验和、备份、写入，然后在 `~/.cc-connect/fuyu-feishu-<时间>-<序号>/` 下跑 `cc-connect feishu new --config ~/.cc-connect/config.toml --project <名字> --qr-image <目录>/qr.png --set-allow-from-empty`，输出写进同一目录的 `out.log`，进程号写进 `pid`，等它结束。退出码是 0、输出里有 `✅` 就算成功；否则在远端用备份还原配置（原来没有配置的删掉）。最后删掉这个目录。
3. 等待期间每 1.5 秒另开一次短的 `run_ssh`：还没拿到二维码时取回 `qr.png`（base64，不超过 1 MB，PNG 头尾完整才收），每次都取回 `out.log` 的最后 16 KB，去掉空行和终端画的二维码后按行解析 `URL:`、`allow_from:`。
4. 成功后用「远程启动和重启」的脚本重启远程的 cc-connect，`done` 为 `true`；重启失败时 `error` 是重启的错误（`ccConnect.remoteStopped` 等），机器人和项目已经建好，前端可以让用户再点重启。失败时 `done` 为 `false`，`error` 是 `ccConnect.feishuUnfinished`（详情是 cc-connect 最后一行 `Error…`）、`ccConnect.remoteChanged`、`ccConnect.remoteWrite`、`ccConnect.remoteNotFound` 或 `ccConnect.remoteFailed`。
5. 取消：结束远端的 `cc-connect feishu new`，长会话随即还原配置并删目录；最多等 5 秒，目录还在（长会话已经断了）就由取消这一步自己还原，`out.log` 里已经有 `✅` 的不还原。长会话因 SSH 断开而失败时也跑这一步。

岛退出时不结束远端的扫码：远端脚本结束时自己还原或保留配置。

远端脚本开头都先 `case $- in *H*) set +H ;; esac`：有的服务器上 `sh -s` 开着历史展开，`*[!0-9]*` 这类写法会报 `event not found`，取消时 `kill` 那一行就不执行了。

## 远程的代理

远程电脑上不了外网时，cc-connect 连不上飞书和 Telegram。`feishu new` 和重启前都导出 `http_proxy`、`https_proxy`（大小写各一份）和 `no_proxy=localhost,127.0.0.1,::1`，代理地址按顺序取：

1. SSH 代理隧道插件给这台电脑开着隧道时，用 `http://127.0.0.1:<远程端口>`（`ssh_tunnel::remote_proxy`）。
2. 否则用那台电脑登录 shell 里的 `HTTPS_PROXY` / `https_proxy`。

地址里只要有字母、数字和 `:/._@%-` 以外的字符就不用。引导「推送到手机」的安装一步给每台远程电脑一个隧道开关。

## 远程启动和重启（`restart_cc_connect_remote`）

找不到程序报 `ccConnect.remoteNotFound`，没有配置文件报 `ccConnect.remoteNoConfig`。先 `pkill -x cc-connect`（只杀当前用户的）。被杀的进程里有父进程不是 1 的（screen 里的循环、systemd 用户服务这类守护在管它），就等它们拉起新的 cc-connect，15 秒内出现新进程算成功，不自己再起一个；没有守护或 15 秒还没出现时，等旧进程最多 10 秒，再不走就 `-9`，然后在家目录用 `setsid nohup` 和登录 shell 在后台跑 `cc-connect --config ~/.cc-connect/config.toml`，输出写到 `~/.cc-connect/fuyu.log`。3 秒后还在跑就算成功，否则报 `ccConnect.remoteStopped`，把日志最后一行放进错误详情。


## 命令和返回形状

```ts
detectCcConnectAgents(host: string | null): Promise<{ agent: CcConnectSetupAgent; label: string; path: string }[]>
installCcConnectRemote(host: string, path: string): Promise<{ exe: string; installed: boolean; version: string | null }>
addCcConnectRemoteProject(host: string, project: { project; agent; workDir; platform: "telegram" | "discord"; token; allowFrom }): Promise<void>
restartCcConnectRemote(host: string, path: string): Promise<void>
```

`host` 是 SSH 页里的主机名（和 `getCcConnectRemoteStatus` 一样），`path` 是 cc-connect 一节里给这台电脑填的程序路径，空字符串表示自动找。
