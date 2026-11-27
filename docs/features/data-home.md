# 家目录（FUYU_HOME）

浮屿把自己的文件都放在一个家目录里：待办（`todos.json`）、设置（`settings.json`）、剪贴板历史、插件、Agent 状态和钩子脚本、每日待办 Markdown（`todo\`）等。来由见 issue #50 和任务 D30。

WebView2 自己的数据（`%LOCALAPPDATA%\com.tixxin.fuyu\EBWebView`，localStorage 在里面）不搬；凭据仍在 Windows 凭据管理器。

## 在哪

按顺序找，用第一个给出绝对路径的：

1. 环境变量 `FUYU_HOME`；
2. 便携模式：`fuyu.exe` 同一个文件夹里有 `fuyu-portable.txt` 时，用它旁边的 `data\`（只在 Windows 上、不是商店版时认，见下面「便携模式」）；
3. 指针文件 `%APPDATA%\com.tixxin.fuyu\home.json` 里的 `{ "home": "<文件夹>" }`（D30.4 在设置里改家目录时写它；指针文件本身不放进家目录）；
4. `%USERPROFILE%\.fuyu`。

开发版（调试构建，默认身份 `com.tixxin.fuyu.lane-1`，见 workflow.md「开发版和正式版同时开」）不参与，始终用它自己的 `%APPDATA%\com.tixxin.fuyu.lane-<N>`，里面是第一次启动时从这里复制的一份；它只读地读这里的 Agent 钩子产物（`home_dir::agent_home`），不往这里写。设了 `FUYU_DEV_SHARED_IDENTITY=1` 的调试版和正式版一样按上面的顺序找。

Rust 里取目录一律用 `home_dir::fuyu_home(app.path())`，不直接用 `app_data_dir()`。

## 升级时的迁移（D30.3）

岛启动时、窗口创建之前（`home_dir::init`）：

- 家目录和旧的数据目录 `%APPDATA%\com.tixxin.fuyu` 相同，什么也不做。
- 家目录里已经有 `home-migration.json`，说明迁移过了，什么也不做。
- 家目录里已经有浮屿的数据（`todos.json`、`settings.json` 或 `plugins`），比如指向了网盘里同步来的文件夹：直接用，不复制。
- 旧目录里没有数据（新装）：建一个空的家目录。
- 否则把旧目录整个复制到家目录：先复制到旁边的 `<家目录>.migrating`，成功后再改名，名字以 cache 结尾的文件夹不复制，指针文件不复制。**旧目录保留**，退回旧版本时它还在用旧目录里的数据，看到的是迁移那一刻的样子。复制失败的话，这次启动继续用旧目录，下次再试。

窗口起来以后（`home_dir::after_start`，后台线程），只对真正换了位置的用户做：

- **钩子**：装过 Claude Code / Codex 钩子的，重新安装一次，让配置里的命令指向家目录里的脚本。钩子脚本现在默认把状态写在**脚本所在的文件夹**（cmd 的 `%~dp0`、PowerShell 的 `$PSScriptRoot`），岛总是把脚本写在家目录里，所以不再写死 `%APPDATA%\com.tixxin.fuyu`；`FOCUSD_AGENT_STATUS_DIR` / `FOCUSD_AGENT_STATUS_PATH` 仍然可以覆盖。
- **每日待办 Markdown**：把改名前的旧默认目录（见 [改名兼容](../architecture/contracts.md#改名兼容d17)）里的 `.md` 复制到 `<家目录>\todo`，已有同名文件的不覆盖，旧文件不删。设置里存的保存目录如果就是旧默认目录，前端改成 `<家目录>\todo`；用户自己选过的目录不动。

每一步做完记在 `home-migration.json`（`{ from, at, hooks, todos, hooksHome }`），只做一次。`hooksHome` 是上次重装钩子时的家目录（2026-11-26 起）：启动时家目录的实际路径和它不一样，就再重装一次钩子，例如把整个 `~\.fuyu` 连同 `home-migration.json` 手动拷进便携版的 `data\`、U 盘换了盘符。没有这一项的旧文件按「钩子指向默认的 `~\.fuyu`」算，所以从旧版拷过来的数据也会重装；家目录就是 `~\.fuyu` 的只补记、不重装。

## 在设置里更换（D30.4）

设置 → 通用 →「数据文件夹」显示当前的家目录，可以填一个新路径后点「更换」，或「改回默认」。命令 `set_data_home`：

- 新文件夹里没有浮屿的数据就把当前家目录整个复制过去（锁文件、指针文件不复制）；已经有就直接用它的（比如网盘里同步来的）。
- 在新文件夹的 `home-migration.json` 里记下要重装钩子，写指针文件 `home.json`（改回默认时删掉它），然后提示重启岛屿。旧文件夹不删。
- 待办 Markdown 的保存目录正好是旧家目录下的 `todo` 时，跟着改成新家目录下的 `todo`。
- 由环境变量 `FUYU_HOME` 指定、或是便携版时只显示、不能改；lane 预览也不能改。

## 便携模式（免安装版，FB-34）

2026-11-26 起。把 `fuyu.exe` 放进一个自己的文件夹（U 盘、`D:\Tools\Fuyu` 之类），在旁边新建一个空的 `fuyu-portable.txt`（名字固定，内容不看），启动后家目录就是同一个文件夹里的 `data\`。做一份免安装版就是：

1. 从安装版的安装目录（默认 `%LOCALAPPDATA%\Programs\Fuyu`）或 `pnpm build:exe` 产物里拿 `fuyu.exe`，放进一个新文件夹；
2. 在同一个文件夹里新建空文件 `fuyu-portable.txt`；
3. 整个文件夹打成 zip 发出去，解压后双击 `fuyu.exe` 即用。zip 打包脚本还没做。

行为：

- 顺序排在 `FUYU_HOME` 之后、`home.json` 之前：设了 `FUYU_HOME` 仍以环境变量为准；便携模式下不读 `home.json`。
- `data\` 每次启动先试着建、写一个探测文件再删掉。写不进去（例如把便携版放进了 `Program Files`）就照常按指针文件、`~\.fuyu` 找，设置 →「数据文件夹」下面提示「有便携标记但写不进去」，挪到可写的位置重启就好。
- **第一次进入便携模式不复制别处的数据**，从空白开始：便携版常常放在 U 盘上带走，不该悄悄把本机 `~\.fuyu` 里的剪贴板历史、待办拷进去。要带上原来的数据，先在安装版里退出浮屿，把 `~\.fuyu` 里的东西复制进 `data\` 再启动（里面已有浮屿数据就直接用；带过来的 `home-migration.json` 记的家目录不是 `data\`，启动后会重装一次钩子指到新位置），或用设置备份导出再导入。
- 设置 →「数据文件夹」显示 `data\` 的路径和「便携版」说明，不能改、不能改回默认（`set_data_home` 返回 `home.portable`）；要换位置就整个搬程序文件夹。
- 便携版不自动更新（`updater_configured` 返回 `false`）：更新包是安装程序，会装到别处、用回 `~\.fuyu`。手动下载新版 `fuyu.exe` 覆盖即可。
- 家目录的锁照常生效：同一个 U 盘在两台电脑上同时开会被拦。
- 不是全部带走：WebView2 的数据（含 `localStorage`，`%LOCALAPPDATA%\com.tixxin.fuyu\EBWebView`）、凭据管理器里的密钥和开机自启的注册表值仍在本机。设置有 `settings.json` 镜像，换电脑后大部分设置能从 `data\` 读回来，API 密钥要重新填。
- 不启用的情况：开发版 lane（始终用自己的应用数据目录）、Microsoft Store 商店版（MSIX 的安装目录只读）、macOS（标记会落在 `.app` 包里，破坏签名）。
- 卸载清理（`fuyu.exe --uninstall-cleanup`）也先看自己旁边有没有标记和 `data\`：有就清理那里（按受管文件白名单，不整目录删），所以卸载安装版不会动另一个文件夹里的便携版数据。

## 两台电脑不能同时用一个家目录（D30.4）

岛起来以后在家目录里写锁文件 `fuyu.lock`（`{ computer, pid, at }`），每分钟刷新一次，退出时删掉。启动时如果锁文件来自**另一台电脑**、而且 3 分钟内刷新过，就弹出提示（中英文）并退出，不碰数据；同一台电脑的锁不拦（单实例本来就保证只有一个）。另一台电脑没正常退出（关机、崩溃）留下的锁，3 分钟后自动失效。设置里更换到一个正被别的电脑用着的文件夹时，同样拒绝。

## 兼容

- 已经发布到 npm 的 `fuyu-plugin`（0.x）固定去 `%APPDATA%\com.tixxin.fuyu\local-api.json` 读本地接口的端口和令牌，所以岛在家目录之外**还在旧位置写一份** `local-api.json`。新版 CLI 先找家目录，再找旧位置。
- 发布冒烟测试 `scripts/release/smoke-test.ps1` 检查 `~\.fuyu`。
