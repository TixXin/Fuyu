# 改名为浮屿 / Fuyu：分步计划

> 任务：[D17](/docs/tasks/D/D17.md)。定名和查重见 [project-rename.md](../research/project-rename.md)。用户 2026-11-10 决定：上游留下的 `fly-island` / `FocuSD` 名字和内部标识全部改掉，旧数据要迁移。

每一步做完勾选，写上提交号。搬迁和行为改动按 [AGENTS.md](../../AGENTS.md)「重构约定」分开提交。

## 新名字一览

| 东西 | 旧 | 新 |
|---|---|---|
| 显示名 | FocuSD Island、fly-island、Fly Island | 中文界面「浮屿」，英文界面「Fuyu」 |
| `productName`（安装目录、开始菜单、卸载项的名字） | `fly-island` | `Fuyu` |
| 可执行文件 | `focusd-island.exe` | `fuyu.exe` |
| Cargo 包 / 库 | `focusd-island` / `focusd_island_lib` | `fuyu` / `fuyu_lib` |
| 根 `package.json` 的 `name` | `focusd-island` | `fuyu` |
| 应用标识（数据目录、WebView2 存储） | `com.focusd.island` | `com.tixxin.fuyu` |
| lane 预览的标识 | `com.focusd.island.lane-<N>` | `com.tixxin.fuyu.lane-<N>` |
| 凭据服务名 | `com.focusd.island.*`（qq-mail、translation、calendar、bark、plan-usage、`plugin.<id>`） | `com.tixxin.fuyu.*` |
| 开机自启注册表值 | `FocuSD Island` | `Fuyu` |
| localStorage key | `focusd-island-*` | `fuyu-*` |
| 链接协议 | `focusd://` | `fuyu://`，`focusd://` 继续注册（见「保留不改」） |
| Agent hook 脚本和标记 | `focusd-agent-*.{cmd,ps1}`、`# BEGIN/END FocuSD Agent Status Hooks`、`X-FocuSD-Hook`、`X-FocuSD-Remote` | `fuyu-agent-*`、`# BEGIN/END Fuyu Agent Status Hooks`、`X-Fuyu-Hook`、`X-Fuyu-Remote` |
| 回复状态标记 | `rules/focusd-island-reply-marker.md`、`<!-- focusd-island: reply marker v3 -->` | `rules/fuyu-reply-marker.md`、`<!-- fuyu: reply marker v4 -->` |
| SSH 远程主机上的目录 | `~/.focusd-island/` | `~/.fuyu/` |
| 设置备份和主题文件 | `fly-island-settings-*.json`、`fly-island-theme-*.json`、`"app": "fly-island"` | `fuyu-settings-*`、`fuyu-theme-*`、`"app": "fuyu"` |
| 剪贴板导出文件 | `fly-island-clipboard-*.json` | `fuyu-clipboard-*.json` |
| VS Code 扩展 | `tixxin.focusd-island` | `tixxin.fuyu` |
| npm 包 | `fly-island-plugin`、`create-fly-island-plugin` | `fuyu-plugin`、`create-fuyu-plugin` |
| PowerShell 模块、单文件 SDK | `FlyIsland.Plugin`、`lib/focusd.ps1` | `Fuyu.Plugin`、`lib/fuyu.ps1` |
| 插件清单、忽略文件 | `focusd-plugin.json`、`.focusdignore` | `fuyu-plugin.json`、`.fuyuignore` |
| 插件进程的环境变量 | `FOCUSD_PLUGIN_*` | `FUYU_PLUGIN_*` |
| 插件页面的 JS 接口和 CSS 变量 | `acquireFocusdApi()`、`--focusd-*` | `acquireFuyuApi()`、`--fuyu-*` |
| PowerShell SDK 函数 | `Invoke-FocusdMethod` 等 `*-Focusd*` | `Invoke-FuyuMethod` 等 `*-Fuyu*` |
| GitHub 仓库 | `TixXin/fly-island`、`TixXin/focusd-plugins` | `TixXin/fuyu`、`TixXin/fuyu-plugins` |
| User-Agent | `FocuSD-Island/<版本>` | `Fuyu/<版本>` |

## 保留不改

这些改了会让已经存在的东西失效，换来的只是名字好看，所以不改：

- **插件签名的域串** `focusd-plugin-package/1`、`focusd-plugin-key/1`：已经签过的包和换过的密钥都依赖它们，用户看不到。
- **插件 id**：内置插件 `focusd.*` 和市场上的 `dev.focusd.*`。id 是插件的身份，`plugins.json`、插件数据目录、凭据、收藏、点赞、`focusd-island-plugin-pages` 里都存着它。新写的插件不再用 `focusd` 前缀，示例和文档改成 `dev.fuyu.*` 的写法。
- **旧名字的兼容**：插件清单、忽略文件、环境变量、JS 接口、CSS 变量、PowerShell 函数、`focusd://` 链接，新旧名字都认，旧名字至少保留到插件 API 下一个大版本。第三方插件和它们注册过的 OAuth 回调地址不用跟着改。
- **`TixXin/fly-island` 这个名字不能再被占用**：仓库改名后，旧版本靠 GitHub 的重定向找到更新；要是以后又建一个叫 `fly-island` 的仓库，重定向就断了。

## 迁移要解决的三件事

### 1. 旧版本更新到新版本时，装到了另一个文件夹

Tauri 的 NSIS 安装包用 `productName` 决定安装目录（`%LOCALAPPDATA%\<productName>`）、卸载项（`HKCU\...\Uninstall\<productName>`）和开始菜单快捷方式，也只按同一个 `productName` 找上次的安装位置。所以旧版通过应用内更新运行新安装包时，新版装进 `%LOCALAPPDATA%\Fuyu`，旧版原封不动留在 `%LOCALAPPDATA%\fly-island`，控制面板里出现两项。

新版第一次启动时处理（只处理当前用户）：

- 找到旧的卸载项 `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\fly-island`，确认旧版没在运行，静默运行它的卸载程序（`/S`，静默时不勾「删除应用数据」）。卸载失败不影响新版运行，记日志，设置窗口的关于页提示用户手动卸载。
- 开机自启：旧值 `FocuSD Island` 存在时删掉，并按原来的开关写新值 `Fuyu`。
- 桌面上指向 `focusd-island.exe` 的快捷方式改指 `fuyu.exe`（`pnpm build:exe` 改的是开发机的快捷方式，这里改的是用户的）。

### 2. 数据在旧的应用标识目录里

标识从 `com.focusd.island` 换成 `com.tixxin.fuyu` 后，新版会从空的 `%APPDATA%\com.tixxin.fuyu` 和 `%LOCALAPPDATA%\com.tixxin.fuyu` 开始，localStorage 也在后者的 `EBWebView` 里。

新版在 `run()` 最开头、`tauri::Builder` 建窗口之前处理：新目录不存在而旧目录存在时，把两个旧目录复制过去（`EBWebView` 下的各种 `Cache` 不复制），复制完写一个标记文件，旧目录不删，留给降级和出问题时找回。复制中途失败就删掉半成品，这次照旧从空目录启动，下次再试。lane 预览和通知验证模式用自己的标识，不迁移。

然后：

- **localStorage key**：前端最早执行的模块里，把每个 `focusd-island-*` 复制成对应的 `fuyu-*`（新 key 已存在时不覆盖），旧 key 不删。各 `storage.ts` 只读新 key。设置备份文件里的旧 key 名在导入时照样换成新的。
- **凭据**：新服务名下没有、旧服务名下有的，复制过去，旧的不删。插件的 `com.focusd.island.plugin.<id>` 也一样。
- **应用数据目录里的文件**：文件名本来就不带旧名字，随目录一起复制即可。`todos.json` 迁移时用的 `focusd-island-*` key 名是读旧数据用的，不改。

### 3. 用户机器上别的程序里留着旧名字

- **Agent hook**：用户的 `~/.claude/settings.json` 和 Codex 配置里有旧的 `focusd-agent-*` 命令和旧标记块。新版装 hook 时先删掉带旧签名的项和旧标记块，再写新的；判断「装没装」时新旧签名都认。旧的 hook 脚本还指向 `%APPDATA%\com.focusd.island\agent-status.json`，所以 hook 状态写在新目录后必须重装一遍：迁移完成后自动重装用户已经装过的那几种。
- **回复状态标记**：发现旧的规则文件时删掉并写新的（已有 v1 → v3 的升级逻辑，照着加一档）。
- **SSH 远程主机**：下次连接时在远端写新目录，旧的 `~/.focusd-island/` 里的通知文件照样读，读完的旧目录交给已有的过期清理。
- **链接协议**：新旧两个协议都注册到 `fuyu.exe`。
- **VS Code 扩展**：新 ID 的扩展发布后，岛屿先找新 ID，找不到再找旧 ID；旧扩展在市场上标记为弃用，说明里指向新扩展。

## 步骤

每一步都要能单独验证并合入。第 3 步到第 5 步必须在同一个版本里发布，中间不发版。

- [x] **第 1 步：显示名。** README（中英文）、界面文案（`src/i18n`）、窗口标题、托盘提示、Rust 里给用户看的报错和提示、User-Agent 改成浮屿 / Fuyu。不碰任何标识、文件名和 `productName`。验证：`pnpm check`、`pnpm build`、`pnpm test:regression`、`cargo test`。
  - 中文界面叫「浮屿」，英文界面叫「Fuyu」；岛上收起条和标题栏的品牌字两种语言都用「Fuyu」（像素字体只有拉丁字母）。
  - 留到后面的：回复状态标记写进用户规则文件的说明文字（第 4 步，和标记版本一起升级）、本地接口 `/v1/` 返回的 `"app": "FocuSD Island"`（第 3 步，属于接口格式）、开机自启和链接协议在注册表里的名字（第 3、4 步）、插件开发包和示例插件里的名字（第 2 步）。
- [x] **第 2 步：插件开发工具和插件协议的新名字。** 包目录改名（`packages/fuyu-plugin`、`packages/create-fuyu-plugin`、`packages/powershell/Fuyu.Plugin`），先做纯搬迁的提交，再做改名的提交。宿主同时认新旧清单名、忽略文件、环境变量、JS 接口和 CSS 变量；PowerShell SDK 加新函数名，旧名字做别名；示例插件改用新名字（id 不变）。npm 新包由用户发布，旧包标记弃用。
  - 做法：`pack` 把 `fuyu-plugin.json` 也以 `focusd-plugin.json` 的名字放进 zip，改名前的岛屿也能装新 SDK 打的包。签名私钥只有旧位置 `~/.fly-island-plugin/` 有时继续用它，`FLY_ISLAND_PLUGIN_SIGNING_KEY` 也认；`fuyu-plugin dev` 先找 `com.tixxin.fuyu` 再找 `com.focusd.island` 下的 `local-api.json`，第 3 步换标识后不用再改。页面来源 `*.plugin.focusd.invalid` 不改（插件页面的存储按来源分）。npm 包升到 0.5.0。
  - 留下的：**示例插件没有改用新名字**。`plugins/examples/` 的源码和已经签名发布的 `plugins/packages/*.zip` 要一致，改清单名或 `lib/` 就要升版本、用官方作者密钥重新打包签名，旧版本岛屿也从这里读市场；等第 5 步市场搬到 `TixXin/fuyu-plugins` 时，在那边随示例的下一个版本一起改。任务看板插件（`scripts/tasks/island-plugin`）同样留着旧名字，旧名字都还认。**npm 发布和旧包弃用**要用户做：推 `sdk-v0.5.0` 标签发新包（新包名第一次发布要先在 npm 上配好 Trusted Publisher 或用 token），然后 `npm deprecate fly-island-plugin "改名为 fuyu-plugin"`、`npm deprecate create-fly-island-plugin "改名为 create-fuyu-plugin"`；PowerShell Gallery 的 `Fuyu.Plugin` 同样等用户。
- [ ] **第 3 步：数据迁移。** 上面「迁移要解决的三件事」的 1、2 两件，连同新的 `identifier`、`productName`、可执行文件名、注册表值、凭据服务名、localStorage key 一起改，写进 [contracts.md](contracts.md) 的变更记录和 [data-storage.md](data-storage.md)。迁移逻辑要有单元测试（在临时目录里造旧目录、半成品、已迁移三种情况）。
- [ ] **第 4 步：hook、回复标记、SSH 远程目录、链接协议。** 第三件事。验证要实际装一次 Claude Code 和 Codex 的 hook，确认旧块被替换、状态能更新。
- [ ] **第 5 步：仓库和地址。** 需要用户本人在 GitHub 上操作或确认：`TixXin/fly-island` → `TixXin/fuyu`，`TixXin/focusd-plugins` → `TixXin/fuyu-plugins`。之后把更新地址、市场地址（index、themes、stars、discussions）、README 链接、发布脚本、`land-sync-dev.mjs` 改成新地址；本地 `origin` 改成新地址。先实测旧地址经 GitHub 重定向和 `ghfast.top`、`gh-proxy.com` 两个代理还能拿到 `latest.json` 和市场索引，拿不到就在旧仓库名下留一份（例如保留一个只放 `latest.json` 的发布）。
- [ ] **第 6 步：发布和实机验收（需要用户）。** 在装了旧版本的电脑上走一遍应用内更新（和 [D5](/docs/tasks/D/D5.md) 一起做）：更新后只剩一个安装项，开机自启、设置、待办、剪贴板历史、邮箱和翻译的凭据、已装的插件、Agent hook 都还在且能用，`focusd://` 和 `fuyu://` 链接都能打开。
- [ ] **第 7 步：收尾。** `AGENTS.md`、`src/AGENTS.md`、`src-tauri/AGENTS.md`、[overview.md](overview.md)、[contracts.md](contracts.md)、`build-exe.mjs` 找快捷方式的规则、lane 文件夹名（`../fly-island-lanes`，改的话同步合并队列配置和钩子）里的旧名字；历史文档（发布说明、做完的任务、调研）不改。

## 风险

- **静默卸载旧版**是整件事里最容易出问题的地方：卸载程序的行为由旧版本的安装包决定，不同旧版本可能不一样。实机验收至少测最老的和最新的两个旧版本。
- **复制 WebView2 目录**要在任何 WebView 创建之前完成，而且旧版本必须已经退出（文件被占用会复制失败）。应用内更新的流程是旧版退出后才运行安装包，手动安装时可能两个版本同时在跑：新版发现旧版在运行时，先请它退出（单实例互斥量不同，不能靠单实例插件）。
- **已经发出去的旧版本**只会请求旧地址。GitHub 的仓库重定向不是永久承诺，所以第 5 步之后的几个版本里，发布时要确认旧地址仍然能拿到更新。
