# GitHub Issues

`@fuyu/github-issues` · 浮屿官方插件 · Windows / macOS

在岛上看你关注的 GitHub 仓库还有哪些没关的 issue，按仓库分好组；有新 issue 时可以在岛上提醒你。

## 装好后在哪里

- **岛的展开页**：多出「GitHub Issues」一页，按仓库分组列出未关闭的 issue，每行是标题、编号和「3 天前」这样的更新时间。
- **收起条**：默认不显示；在设置里打开后显示所有仓库未关闭的总数，点一下打开 GitHub Issues 页。
- **设置 → 插件 → GitHub Issues**：添加、删除仓库和全部设置。

## 怎么用

1. 打开设置里的 GitHub Issues，在「仓库」里填 `owner/repo`（例如 `TixXin/fuyu`），也可以直接粘贴仓库的链接，点「添加」。添加时会先确认仓库存在；最多 20 个。
2. 展开岛切到「GitHub Issues」页。每个仓库先显示 10 条，多的点「还有 N 条」展开；一共多于 10 条时页面顶上会出现筛选框，按标题或编号筛选。点一条 issue 在浏览器里打开。
3. 想马上更新就点「刷新」。插件还带一个命令「立即刷新」，可以在「设置 → 插件」的插件详情里给它设快捷键。

仓库改了名或换了主人时，插件会跟着 GitHub 的跳转改成新名字，不用重新添加。

## 设置

**仓库**

- 仓库列表：添加（先核对仓库存在）、删除。只支持公开仓库，不需要登录。列表是空的时候，浮屿「设置 → 插件」里这个插件会标出「待设置」（需要较新的浮屿）。

**列表**

- **每个仓库显示几条**：5 / 10（默认）/ 20 / 30，多的折叠起来。
- **排序**：最近更新（默认）/ 最新创建 / 评论最多。
- **只看带这些标签的**：用逗号分隔，要同时带上所有标签；默认留空，不筛选。
- **包含 PR**：默认关。

**每行显示**

- **更新时间（3 天前）**：默认开。
- **评论数**：默认开。
- **作者**：默认关。

**刷新**

- **刷新间隔**：5 / 10 / 15（默认）/ 30 / 60 / 120 分钟。仓库多时会自动放慢，免得用完 GitHub 每小时的请求额度；额度用完时页面会显示什么时候恢复。
- **打开页面时立即刷新**：默认开；一分钟内刚刷新过就不再请求。
- **有新 issue 时在岛上提醒**：默认关。

**收起条**

- **显示未关闭的总数**：默认关。

从 1.0.0 升级时，原来文本框里的仓库会自动变成列表，刷新间隔和提醒照旧，新设置取上面的默认值。

## 开销和数据来源

- **联网**：只访问 `api.github.com`，不登录、不带你的账号，只读公开仓库。每个仓库每次刷新一个请求，添加仓库时多一个核对请求。不登录时 GitHub 每小时最多给 60 个请求，与同一网络下的其他程序共用。
- 设置只保存在本机的插件数据目录里。

---

## English

`@fuyu/github-issues` · Official Fuyu plugin · Windows / macOS

See the open issues of the GitHub repositories you follow, grouped by repository, right on the island, with an optional heads-up when a new one appears.

### Where it shows up

- **Island page**: a "GitHub Issues" page listing open issues by repository; each row shows the title, number and when it was last updated ("3d ago").
- **Collapsed bar**: hidden by default. Turn it on in the settings to show the total number of open issues; click it to open the GitHub Issues page.
- **Settings → Plugins → GitHub Issues**: add and remove repositories, and every other setting.

### How to use it

1. Open GitHub Issues in the settings, type `owner/repo` (for example `TixXin/fuyu`) under Repositories, or paste the repository's link, and click Add. The plugin checks that the repository exists first; you can follow up to 20.
2. Expand the island and open the GitHub Issues page. Each repository shows 10 issues first; click "N more" to see the rest. With more than 10 issues in all, a filter box appears at the top to filter by title or number. Click an issue to open it in your browser.
3. Click Refresh to update right away. The plugin also has a "Refresh now" command; give it a shortcut in the plugin's details under Settings → Plugins.

When a repository is renamed or moves to a new owner, the plugin follows GitHub's redirect and switches to the new name, so there is nothing to re-add.

### Settings

**Repositories**

- The list: add (checked against GitHub first) and remove. Public repositories only; no sign-in needed. While the list is empty, Fuyu marks the plugin as "Needs setup" under Settings → Plugins (needs a newer Fuyu).

**List**

- **Issues per repository**: 5 / 10 (default) / 20 / 30; the rest fold away.
- **Order**: Recently updated (default) / Newest / Most comments.
- **Only with labels**: comma-separated, an issue needs all of them; empty by default (no filter).
- **Include pull requests**: off by default.

**Each row**

- **Last updated (3d ago)**: on by default.
- **Comment count**: on by default.
- **Author**: off by default.

**Refresh**

- **Refresh every**: 5 / 10 / 15 (default) / 30 / 60 / 120 minutes. With many repositories it slows down on its own to stay within GitHub's hourly request limit; if the limit runs out, the page shows when it resets.
- **Refresh when the page opens**: on by default; skipped if it refreshed less than a minute ago.
- **Notify on the island about new issues**: off by default.

**Collapsed bar**

- **Show the number of open issues**: off by default.

Upgrading from 1.0.0 turns the repositories in the old text box into the list and keeps the refresh interval and notification setting; the new settings start at the defaults above.

### Cost and data sources

- **Network**: only `api.github.com`, without signing in or using your account, and public repositories only. One request per repository per refresh, plus one check when you add a repository. Without signing in GitHub allows 60 requests an hour, shared with other programs on the same network.
- Settings are stored only in the plugin's data folder on your computer.

---

## 给开发者 · For developers

- 服务：`messages/v1`、`commands`（必需）、`settings`（可选）
- 插槽：`island.page/v1`、`island.collapsed/v1`、`settings.section/v1`
- 命令：`refresh`
- 联网清单：`api.github.com`
- 写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
