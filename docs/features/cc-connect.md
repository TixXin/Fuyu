# cc-connect：本机与远程电脑

内置插件 `focusd.cc-connect` 用 [cc-connect](https://github.com/chenhg5/cc-connect) 把 AI 代理接到飞书、Telegram、Discord 机器人上，手机推送也走它。Rust 在 `src-tauri/src/cc_connect/`，前端封装在 `src/features/cc-connect/api.ts`。

## 两个平台各有什么

| 部分 | 文件 | Windows | macOS |
|---|---|---|---|
| 本机：找程序、下载 Windows 版、岛托管运行、加项目、飞书扫码、读状态、发消息 | `local.rs`、`locate.rs`、`install.rs`、`runner.rs`、`feishu.rs` | ✓ | 不支持（`local_unsupported.rs`，G1.28 做） |
| 机器人 token 检查（`check_cc_connect_bot`） | `bots.rs` | ✓ | ✓ |
| 检测代理（`detect_cc_connect_agents`） | `agents.rs` | ✓ | ✓ |
| 远程：读状态、发消息、安装、加项目、启动重启 | `remote.rs`、`remote_install.rs`、`remote_project.rs`、`remote_run.rs`、`script.rs` | ✓ | ✓ |

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
4. 包以 base64 写进脚本的 heredoc 传上去，远端有 `sha256sum` 或 `shasum` 时再校验一次，解出程序写成 `~/.local/bin/cc-connect.part`，`chmod 755` 后改名为 `cc-connect`。

## 远程加项目（`add_cc_connect_remote_project`）

1. 先读一次：展开工作文件夹里的 `~`、确认它存在，取回 `~/.cc-connect/config.toml` 的 `cksum` 和全文。
2. 岛上检查项目名、重名、代理、平台、token 和 `allow_from`（和本机同一套规则），用远端展开后的文件夹拼项目块；远程不写本机的代理地址。
3. 再写一次：`cksum` 和第一次读到的不同就报 `ccConnect.remoteChanged`，什么都不写；否则先复制成 `config.toml.bak-fuyu-<时间>`，新内容写进 `config.toml.fuyu.tmp`，确认里面有这个项目名后改名替换。任何一步失败都用备份还原（原来没有配置文件的就删掉），报 `ccConnect.remoteWrite`。
4. 飞书在远程要扫码建机器人（B59.3），这个命令收到 `feishu` 报 `ccConnect.remoteFeishu`。

加完项目不会自动重启，前端加完一台电脑的全部项目后再调一次重启。

## 远程启动和重启（`restart_cc_connect_remote`）

找不到程序报 `ccConnect.remoteNotFound`，没有配置文件报 `ccConnect.remoteNoConfig`。先 `pkill -x cc-connect`（只杀当前用户的，等最多 10 秒，再不走就 `-9`），然后在家目录用 `setsid nohup` 和登录 shell 在后台跑 `cc-connect --config ~/.cc-connect/config.toml`，输出写到 `~/.cc-connect/fuyu.log`。3 秒后还在跑就算成功，否则报 `ccConnect.remoteStopped`，把日志最后一行放进错误详情。

用 systemd 等方式自己托管 cc-connect 的电脑，重启会和它们抢进程，这种情况下不要在岛上点重启。

## 命令和返回形状

```ts
detectCcConnectAgents(host: string | null): Promise<{ agent: CcConnectSetupAgent; label: string; path: string }[]>
installCcConnectRemote(host: string, path: string): Promise<{ exe: string; installed: boolean; version: string | null }>
addCcConnectRemoteProject(host: string, project: { project; agent; workDir; platform: "telegram" | "discord"; token; allowFrom }): Promise<void>
restartCcConnectRemote(host: string, path: string): Promise<void>
```

`host` 是 SSH 页里的主机名（和 `getCcConnectRemoteStatus` 一样），`path` 是插件设置里给这台电脑填的程序路径，空字符串表示自动找。
