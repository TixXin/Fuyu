# 应用启动台 · App launcher

`@fuyu/launcher` · 浮屿官方插件 · Windows / macOS

在岛上输入几个字母就能打开电脑上的应用，常用的排在前面。

## 装好后在哪里

- **岛的展开页**：多出「应用启动台」一页，上面是搜索框，下面是最近使用的应用或搜索结果。
- **设置 → 插件 → 应用启动台**：全部设置，以及重新扫描、清空最近启动记录。

## 怎么用

1. 展开岛，切到「应用启动台」页，搜索框会自动获得焦点；搜索框为空时列出最近打开过的应用。
2. 输入应用名的一部分（不分大小写），或者首字母缩写（如 `vsc` 找 Visual Studio Code）。
3. 用 ↑ ↓ 选择，Enter 打开，Esc 清空搜索；也可以直接点。打开后岛会自动收起。
4. 打开过的应用会记下次数和时间，越常用越靠前。

插件带两个命令：「打开应用启动台」（展开岛并切到这一页）和「重新扫描应用」，可以在「设置 → 插件」的插件详情里给它们设快捷键。「打开应用启动台」和「打开应用后收起岛」需要较新的浮屿，旧版本里不出现。

刚装的应用没出现时，在设置里点「重新扫描」，或者等自动重新扫描。

## 设置

**内容**

- **搜索框为空时显示**：最近使用（默认）/ 全部应用。
- **最近使用显示几个**：4 / 8（默认）/ 12 / 16。
- **记住打开过的应用，排在前面**：默认开。关掉后不再记新的，已有的记录不删，也不参与排序。
- **最多记住**：20 / 50 / 100 / 200 个（默认）。
- **清空最近启动记录**。

**显示**

- **显示应用所在的文件夹**：默认关。名字相同的两个应用总会显示文件夹。
- **显示打开过几次**：默认关。
- **打开应用后收起岛**：默认开。

**扫描**

- **重新扫描**：马上重新找一遍。
- **自动重新扫描**：每 5 分钟（默认）/ 每 30 分钟 / 每 2 小时 / 不自动。打开启动台时，距上次扫描超过这个时间才重新找。
- **额外扫描的文件夹**：填完整路径（可以用 `~` 表示你的用户目录），里面的应用和快捷方式也会列出来，最多往下找 3 层；Windows 上还会找 `.exe`。
- **排除的应用**：搜一个应用点「排除」，它就不再出现；在下面的列表里可以恢复。

## 它会用到什么

- **读取应用列表**：Windows 上看开始菜单里的程序快捷方式（所有用户的和你自己的），macOS 上看「应用程序」文件夹（系统的、全局的和你自己的），再加上你填的额外文件夹。暂不包括 Windows 商店应用。
- **启动本机程序**：只在你选中一个应用时打开它（Windows 上交给资源管理器打开，macOS 上用 `open`）。打开的程序独立运行，浮屿退出或重启不会影响它。
- 设置和最近启动记录只保存在本机的插件数据目录里。
- 不联网。

---

## English

`@fuyu/launcher` · Official Fuyu plugin · Windows / macOS

Type a few letters on the island to open any app on your computer; the ones you use most come first.

### Where it shows up

- **Island page**: a new "App launcher" page with a search box above your recent apps or the search results.
- **Settings → Plugins → App launcher**: all settings, plus rescanning and clearing the recent history.

### How to use it

1. Expand the island and open the "App launcher" page; the search box gets focus right away. With an empty search it lists the apps you opened recently.
2. Type part of an app's name (case doesn't matter) or its initials (for example `vsc` for Visual Studio Code).
3. Use ↑ ↓ to choose, Enter to open, Esc to clear the search; or just click. The island collapses after the app opens.
4. Apps you open are remembered with how often and when, so frequent ones move to the top.

The plugin has two commands, "Open App launcher" (expands the island on this page) and "Rescan apps"; give them shortcuts in the plugin's details under Settings → Plugins. "Open App launcher" and "Collapse the island after opening an app" need a newer Fuyu and are hidden on older versions.

If a newly installed app is missing, click "Rescan now" in the settings, or wait for the automatic rescan.

### Settings

**Content**

- **With an empty search, show**: recent apps (default) / all apps.
- **Recent apps to show**: 4 / 8 (default) / 12 / 16.
- **Remember the apps I open and put them first**: on by default. When off, new launches aren't recorded and the existing history is kept but not used for ordering.
- **Remember up to**: 20 / 50 / 100 / 200 (default).
- **Clear recent history**.

**Display**

- **Show each app's folder**: off by default. Two apps with the same name always show their folders.
- **Show how many times each app was opened**: off by default.
- **Collapse the island after opening an app**: on by default.

**Scanning**

- **Rescan now**: look for apps again right away.
- **Rescan automatically**: every 5 minutes (default) / 30 minutes / 2 hours / never. When you open the launcher, it looks again only if the last scan is older than this.
- **Extra folders**: enter a full path (`~` means your home folder); apps and shortcuts in it are listed too, up to 3 levels deep. On Windows `.exe` files count as well.
- **Excluded apps**: search an app and click "Exclude" to hide it; restore it from the list below.

### What it uses

- **Reads your app list**: on Windows the program shortcuts in the Start menu (for all users and for you); on macOS the Applications folders (system, shared and your own); plus the extra folders you add. Microsoft Store apps aren't included yet.
- **Starts programs**: only the app you pick, opened through File Explorer on Windows and `open` on macOS. The app runs on its own, so quitting or restarting Fuyu doesn't close it.
- Settings and the recent history are stored only in the plugin's data folder on your computer.
- No network access.

---

## 给开发者 · For developers

- 插槽：`island.page/v1`、`settings.section/v1`
- 命令：`open`（有 `ctx.island.open` 时才注册）、`rescan`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
