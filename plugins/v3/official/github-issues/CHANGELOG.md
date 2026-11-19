# 更新记录 · Changelog

## 1.1.0

中英文都叫 GitHub Issues；仓库在设置里按列表管理，岛上每行只留标题、编号、更新时间和评论数。

- 设置改了马上生效，去掉「保存设置」按钮。
- 仓库改成列表：添加时先核对仓库存在（可以粘贴链接），可以删除；原来文本框里的仓库自动转成列表。
- 新的列表设置：每个仓库显示几条（默认 10，多的折叠成「还有 N 条」）、排序（最近更新 / 最新创建 / 评论最多）、按标签筛选、包含 PR（默认关）。
- 每行显示：更新时间改成「3 天前」（默认开）、评论数（默认开）、作者（默认关，原来总是显示）；去掉绝对日期。
- 打开页面时立即刷新（默认开，一分钟内不重复请求）。
- 收起条可以显示未关闭的总数（默认关），点一下打开 GitHub Issues 页。
- 筛选框只在一共多于 10 条时出现；还没添加仓库时，岛上的「去设置里添加」直接打开设置（需要浮屿支持，老版本显示文字提示）。
- 命令「立即刷新」接上了，设置里的运行按钮和快捷键都能用。
- 仓库改名或换主人（GitHub 返回 301）时跟着改成新名字，不再显示加载失败。
- 新 issue 提醒只提醒编号比已见过的都大的 issue，按更新时间排序时老 issue 被更新不会误报。
- 岛的页头按钮有了中英文标题。
- 图标换成和浮屿设置一致的风格：浅底色加同色线条。
- 还没添加仓库时，浮屿的插件页会标出「待设置」，并带一个去设置的按钮（需要较新的浮屿）。
- 市场页的截图换成了新的，多了一张收起条的。
- 补了搜索关键词，在市场里搜「工单」「仓库」也能找到。

Named GitHub Issues in both languages; repositories are managed as a list in the settings, and each row on the island keeps just the title, number, last update and comment count.

- Settings take effect as you change them; the Save button is gone.
- Repositories are a list: adding one checks that it exists (links can be pasted), and you can remove them. The repositories in the old text box become the list.
- New list settings: issues per repository (10 by default, the rest fold into "N more"), order (recently updated, newest or most comments), a label filter, and including pull requests (off by default).
- Each row: the last update now reads "3d ago" (on by default), comment count (on), author (off; it used to be always shown). The full date is gone.
- Refresh when the page opens (on by default, at most once a minute).
- The collapsed bar can show the total number of open issues (off by default); clicking it opens the GitHub Issues page.
- The filter box only appears with more than 10 issues in all. With no repositories yet, "Add in settings" on the island opens the settings (when Fuyu supports it; older versions show a hint instead).
- The "Refresh now" command now works, from the Run button in the settings and from a shortcut.
- Renamed or transferred repositories (GitHub answers 301) switch to the new name instead of showing a load error.
- New-issue notifications only fire for issue numbers higher than any seen before, so an old issue getting updated no longer counts as new.
- The island header button has a title in Chinese and English.
- New icon in the same style as Fuyu's settings: a tinted tile with a line glyph in the same color.
- Until you add a repository, Fuyu's plugin page marks the plugin as "Needs setup" with a button that opens its settings (needs a newer Fuyu).
- New screenshots on the market page, with one more for the collapsed bar.
- Search keywords added, so "repo" or "bug tracker" find it in the market.

## 1.0.0

首个版本。

First release.
