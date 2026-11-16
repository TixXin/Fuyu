# 从 Agent 会话跳到 Antigravity 的窗口

> 日期：2026-11-16。问题：Antigravity 改名成「Antigravity IDE」以后，点岛上的会话提示「没有找到对应窗口」（#646）。别的开源项目是怎么从代理会话找到并切到 Antigravity 窗口的？范围：GitHub 上的代理状态类应用（刘海、岛、菜单栏）、Antigravity 周边工具、包管理器的安装清单、Google 论坛和官方钩子文档；关键词 Antigravity IDE exe、bundle id、focus window、antigravity-ide、language_server。相关任务：A10

## 结论

- **#646 的原因已经确认**：
  - 2026-05 起 Antigravity 分成了两款产品。原来的 VS Code 分支改名叫「Antigravity IDE」，Windows 上的程序是 `Antigravity IDE.exe`；新出的代理平台叫「Antigravity 2.0」，程序还叫 `Antigravity.exe`。[1][4][5]
  - 我们在 Windows 上找窗口时，把程序文件名转小写、去掉扩展名，再和写死的 `antigravity` 比（`src-tauri/src/agent_status/focus.rs` 的 `prefer_app`、`window_focus.rs` 的 `app_name`）。`antigravity ide` 对不上，所以找不到窗口。
  - 报告人的回复也对上了：浮屿 0.3.10-beta.2，程序名 `Antigravity IDE.exe`。
  - 报告人贴了 `agent-focus.log`，共 49 次点击：
    - 48 次是 `process=unknown, prefer=antigravity | not found`。也就是说进程链从来没找到过，按 `antigravity` 找程序也落空，最后按文件夹名比窗口标题这一步也没找到。
    - 只有 1 次是 `window=antigravity | focused`。那一次很可能是 2.0 版的 `Antigravity.exe` 正好开着，切过去的是另一个程序，不是会话所在的 IDE。这一点未核实。
    - 所以只加程序名能修好主要问题，但进程链拿不到、标题匹配也失败，这两处 A10 要一起看。
- **别的项目都是认一组名字**：
  - cockpit-tools（Tauri / Rust）同时认 `Antigravity IDE.exe`、`antigravity-ide.exe`、`Antigravity.exe` 和 `Electron.exe`，再按命令行排除 `--type=` 辅助进程。[8][19]
  - antigravity-proxy 认 `antigravity.exe` 和 `antigravity ide.exe`。[20]
  - Raycast 的 VS Code 扩展把旧设置值 `Antigravity` 迁移成 `Antigravity IDE`。[18]
- **没找到哪个项目在 Windows 上按工作区挑出具体是哪个 Antigravity 窗口**：
  - CrewNotch（macOS）先用钩子的 `transcriptPath` 判断是 IDE、2.0 还是 CLI，再按 bundle ID 激活整个应用，不挑窗口。[16][17]
  - Code Island 和我们一样，沿进程树往上找。[25]
- **建议的修法**（交给 A10，按顺序做）：
  1. **认多个名字**：Antigravity 的候选程序名改成一组：`antigravity`、`antigravity ide`、`antigravity-ide`。成本最低，直接修好 #646。`electron` 太泛，只在确认是 Antigravity 安装目录时才认。
  2. **用 `transcriptPath` 定产品**：路径里的数据目录区分 IDE、2.0 和 CLI，分别是 `~/.gemini/antigravity-ide`、`~/.gemini/antigravity`、`~/.gemini/antigravity-cli`。`antigravity.rs` 已经有这三个 `DATA_DIRS`，可以按它决定先找哪组程序名，免得 IDE 和 2.0 都开着时切错。[15]
  3. **用工作区挑窗口**：我们已经从 `workspacePaths` 取了 `cwd`，有好几个窗口时用文件夹名去匹配窗口标题。用户改过 `window.title` 时会失效，失效就退回到这个程序随便一个窗口。
  4. **命令行兜底（可选）**：用 `antigravity-ide --reuse-window <文件夹>` 能准确切到那个工作区，旧版的命令是 `antigravity`。代价是要找到命令所在的位置；文件夹没在任何窗口里打开时，它会新开一个窗口，所以只适合作最后的兜底。
- **macOS 也要一起改**：
  - Mac 上 IDE 的主进程路径是 `Antigravity IDE.app/Contents/MacOS/Electron`，bundle ID 是 `com.google.antigravity-ide`；2.0 是 `com.google.antigravity`。[9][10]
  - 我们在 Mac 上取的是外层 `.app` 的名字（`app_name` 的 macOS 分支），得到的是 `antigravity ide`，同样对不上。
- **顺带要改的文档**：`docs/features/agent-status-hooks.md` 说 `agent-focus.log` 在 `%APPDATA%\com.tixxin.fuyu`。0.3.7 以后默认在 `%USERPROFILE%\.fuyu`（`home_dir.rs` 的 `DEFAULT_DIR`）。#646 的第一次回复就是照旧位置写的，报告人没找到这个文件。

## 详细

### Antigravity 的程序和目录

| | Antigravity IDE（原来的 VS Code 分支） | Antigravity 2.0 / 改名前的旧版 |
|---|---|---|
| Windows 程序 | `Antigravity IDE.exe`，装在 `%LOCALAPPDATA%\Programs\Antigravity IDE\` [4][5][6] | `Antigravity.exe`，装在 `%LOCALAPPDATA%\Programs\antigravity\` [7][8] |
| Windows 命令行 | `bin\antigravity-ide.cmd` [4] | `antigravity` |
| 用户数据 | `%APPDATA%\Antigravity IDE`（从 `%APPDATA%\Antigravity` 搬过来）[6] | `%APPDATA%\Antigravity` |
| macOS | `Antigravity IDE.app`，`com.google.antigravity-ide`，命令行 `antigravity-ide` / `agy-ide` [9] | `Antigravity.app`，`com.google.antigravity` [10] |
| Linux | `antigravity-ide` [11] | `antigravity` 或 `Antigravity.AppImage` [7] |
| 钩子数据目录 | `~/.gemini/antigravity-ide` [15] | `~/.gemini/antigravity` |
| URL scheme | `antigravity-ide`（只有第三方资料，未核实）[8] | `antigravity`（同上） |

- 旧版 IDE 自动更新时会被升成 2.0，论坛上有人因此丢了设置，后来手动装回 IDE。[3][6]
- **代理进程**：
  - 代理跑在 `language_server*.exe` 里（2.0 叫 `language_server.exe`，旧版叫 `language_server_windows_x64.exe`），它还会派生 `node.exe`。[12]
  - 从主进程往下展开后代能找到它。[13]
  - 钩子进程是不是 language_server 的后代、进程链会不会断在中间某层，未核实。
- **钩子数据**：每个事件带 `workspacePaths` 和 `transcriptPath`，没有 `cwd`。[15]
- **IDE 的钩子可能不执行**：有一份未核实的报告说 IDE 2.1.1 不执行 PreToolUse 钩子。[14] #646 的报告人能在岛上看到会话，说明至少会话状态的钩子是通的。

### 别的项目

| 项目 | 平台 | 怎么认 Antigravity | 怎么挑窗口 | 处理改名了吗 |
|---|---|---|---|---|
| CrewNotch [16][17] | macOS | `transcriptPath` 里有 `/antigravity-ide/`、`/antigravity-cli/` 就是对应的前端；按 bundle ID 列表激活，IDE 优先，2.0 兜底 | 不挑，只激活整个应用 | 是 |
| Raycast VS Code 最近项目扩展 [18] | Win / macOS | Windows 上找 `Antigravity IDE.exe`，macOS 上找 `com.google.antigravity-ide` | 打开最近的项目 | 是，迁移了旧设置值 |
| cockpit-tools [8][11][19] | Win / macOS / Linux | 程序名列表加旧名，排除 renderer、gpu 等辅助进程；Linux 上还认 `electron --app=...Antigravity IDE...` | 不涉及（它是启动器） | 是 |
| antigravity-proxy [12][20] | Windows | 认 `antigravity.exe`、`antigravity ide.exe` | 不涉及 | 是。记了一个坑：按空格截断命令行，会把 `Antigravity IDE.exe` 截成 `Antigravity` |
| CodeIsland [21] | macOS | 来源别名：`antigravity-ide`、`agy` 归到 `google-antigravity` | 没找到聚焦窗口的代码 | 只做了别名 |
| hey-claude [22] | macOS | `antigravity://` 深链，配 `com.google.antigravity` | 用深链 | 否：改名后这个 bundle ID 指向的已经是 2.0，不是 IDE |
| Ping Island [23]、Vibe Island [24] | macOS | 只接入了 Antigravity CLI | 没找到 | — |
| Code Island [25] | macOS | 沿进程树往上找 GUI 应用 | 进程树 | 不涉及 |

## 来源

查询日期都是 2026-11-16。

1. https://agentpedia.codes/blog/google-antigravity-2-0-launch
2. https://blog.pragmaticengineer.com/the-pulse-antigravity-2-0-takes-ide-out-of-its-new-ide/
3. https://discuss.ai.google.dev/t/whats-with-antigravity-2-0/145451
4. https://github.com/ScoopInstaller/Extras/blob/master/bucket/antigravity-ide.json
5. https://github.com/fleetdm/fleet/blob/main/ee/maintained-apps/inputs/winget/antigravity-ide.json
6. https://discuss.ai.google.dev/t/fix-for-antigravity-2-0-hijacking-the-ide-and-how-to-restore-your-lost-settings-extensions-for-windows-user/146158
7. https://github.com/edison7009/EchoBird/blob/main/tools/antigravitydesktop/paths.json
8. https://github.com/jlcodes99/cockpit-tools/blob/main/src-tauri/src/modules/process_launch_candidates.rs
9. https://github.com/Homebrew/homebrew-cask/blob/main/Casks/a/antigravity-ide.rb
10. https://github.com/Homebrew/homebrew-cask/blob/main/Casks/a/antigravity.rb
11. https://github.com/jlcodes99/cockpit-tools/blob/main/src-tauri/src/modules/process_path_resolution.rs
12. https://github.com/yuaotian/antigravity-proxy/blob/main/docs/antigravity-2.0-issue-85.md
13. https://github.com/lbjlaq/Antigravity-Manager/blob/main/src-tauri/src/modules/process.rs
14. https://discuss.ai.google.dev/t/do-antigravity-ide-2-0-actually-execute-plugin-hooks-pretooluse-posttooluse-or-is-that-cli-only-right-now/176814
15. https://antigravity.google/docs/hooks.md
16. https://github.com/karabogadev/crewnotch/blob/main/CrewNotch/Resources/crewnotch-hook.py
17. https://github.com/karabogadev/crewnotch/blob/main/CrewNotch/Services/Window/SessionFocuser.swift
18. https://github.com/raycast/extensions/blob/main/extensions/visual-studio-code-recent-projects/src/utils/editor.ts
19. https://github.com/jlcodes99/cockpit-tools/blob/main/src-tauri/src/modules/process_detection_matching.rs
20. https://github.com/yuaotian/antigravity-proxy/blob/main/src/hooks/ProcessName.hpp
21. https://github.com/wxtsky/CodeIsland/blob/main/Sources/CodeIslandCore/SessionSnapshot.swift
22. https://github.com/littlemelon77/hey-claude/blob/main/Sources/HeyClaudeKit/Config/LaunchTarget.swift
23. https://github.com/erha19/ping-island/blob/main/PingIsland/Models/ClientProfile.swift
24. https://vibeisland.app/antigravity/
25. https://rifqiakrm.github.io/code-island/
