# 家目录（FUYU_HOME）

浮屿把自己的文件都放在一个家目录里：待办（`todos.json`）、设置（`settings.json`）、剪贴板历史、插件、Agent 状态和钩子脚本、每日待办 Markdown（`todo\`）等。来由见 issue #50 和任务 D30。

WebView2 自己的数据（`%LOCALAPPDATA%\com.tixxin.fuyu\EBWebView`，localStorage 在里面）不搬；凭据仍在 Windows 凭据管理器。

## 在哪

按顺序找，用第一个给出绝对路径的：

1. 环境变量 `FUYU_HOME`；
2. 指针文件 `%APPDATA%\com.tixxin.fuyu\home.json` 里的 `{ "home": "<文件夹>" }`（D30.4 在设置里改家目录时写它；指针文件本身不放进家目录）；
3. `%USERPROFILE%\.fuyu`。

`pnpm dev:lane` 的预览岛屿不参与，始终用它自己的 `%APPDATA%\com.tixxin.fuyu.lane-<N>`，碰不到用户的数据。

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
- **每日待办 Markdown**：把旧默认目录 `Documents\FocuSD` 里的 `.md` 复制到 `<家目录>\todo`，已有同名文件的不覆盖，旧文件不删。设置里存的保存目录如果就是旧默认目录，前端改成 `<家目录>\todo`；用户自己选过的目录不动。

每一步做完记在 `home-migration.json`（`{ from, at, hooks, todos }`），只做一次。

## 兼容

- 已经发布到 npm 的 `fuyu-plugin`（0.x）固定去 `%APPDATA%\com.tixxin.fuyu\local-api.json` 读本地接口的端口和令牌，所以岛在家目录之外**还在旧位置写一份** `local-api.json`。新版 CLI 先找家目录，再找旧位置。
- 开发脚本 `scripts/tasks/install-island-plugin.mjs` 迁移过的就装进家目录的 `plugins`；发布冒烟测试 `scripts/release/smoke-test.ps1` 检查 `~\.fuyu`。
