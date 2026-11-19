# GitHub Issue · GitHub issues

`@fuyu/github-issues` · 浮屿官方插件 · Windows / macOS

关注几个 GitHub 公开仓库，在岛上看它们还开着的 issue，有新 issue 时可以提醒你。

## 装好后在哪里

- **岛的展开页**：多出「GitHub Issue」一页，按仓库分组列出未关闭的 issue。
- **设置 → 插件**：GitHub Issue 的设置，仓库在这里填。

## 怎么用

1. 打开「设置 → 插件」，在「GitHub Issue」里填仓库，格式是 `owner/repo`，多个用逗号或空格隔开（最多 20 个），点「保存设置」。
2. 展开岛切到「GitHub Issue」页，在筛选框里输标题或编号可以过滤；点一条 issue 在浏览器里打开。
3. 想马上更新就点「立即刷新」。

插件还带一个命令「立即刷新」，可以在「设置 → 插件」的插件详情里给它设快捷键。

## 设置

- **仓库列表**：只支持公开仓库，不需要登录。
- **刷新间隔（分钟）**：默认 15，可设 5–120。仓库多时会自动放慢，免得用完 GitHub 每小时的请求额度；额度用完时页面会显示什么时候恢复。
- **发现新公开 Issue 时在岛上提醒**：默认关闭。

## 它会用到什么

- **联网**：只访问 `api.github.com`，不登录、不带你的账号，只读公开 issue（自动排除 pull request）。
- 在岛上弹出新 issue 提醒。
- 设置只保存在本机的插件数据目录里。

---

## English

`@fuyu/github-issues` · Official Fuyu plugin · Windows / macOS

Follow a few public GitHub repositories, browse their open issues on the island, and optionally get notified when new ones appear.

### Where it shows up

- **Island page**: a new "GitHub issues" page listing open issues grouped by repository.
- **Settings → Plugins**: the plugin's settings, where you enter the repositories.

### How to use it

1. Open Settings → Plugins, enter repositories under "GitHub issues" as `owner/repo`, separated by commas or spaces (up to 20), and click "Save settings".
2. Expand the island and open the "GitHub issues" page. Type in the filter box to filter by title or number; click an issue to open it in your browser.
3. Click "Refresh now" to update right away.

The plugin also has a "Refresh now" command; give it a shortcut in the plugin's details under Settings → Plugins.

### Settings

- **Repositories**: public repositories only; no sign-in needed.
- **Refresh interval (minutes)**: 15 by default, 5–120. With many repositories it slows down on its own to stay within GitHub's hourly request limit; if the limit runs out, the page shows when it resets.
- **Notify on the island when new public issues appear**: off by default.

### What it uses

- **Network**: only `api.github.com`, without signing in or using your account. It reads public issues only (pull requests are left out).
- Shows new-issue notifications on the island.
- Settings are stored only in the plugin's data folder on your computer.

---

## 给开发者 · For developers

- 服务：`messages/v1`
- 插槽：`island.page/v1`、`settings.section/v1`
- 命令：`refresh`
- 联网清单：`api.github.com`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
