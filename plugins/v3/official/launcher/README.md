# 应用启动台 · App Launcher

`@fuyu/launcher` · 浮屿官方插件 · Windows / macOS

在岛上搜索本机装的应用，回车就打开。常用的应用排在最前面。

## 装好后在哪里

- **岛的展开页**：多出「应用启动台」一页，上面是搜索框，下面是应用列表。
- **设置 → 插件**：应用启动台的设置分节，可以重新扫描应用、清空最近启动记录。

## 怎么用

1. 展开岛，切到「应用启动台」页，搜索框会自动获得焦点。
2. 输入应用名的一部分（不分大小写），或者首字母缩写（如 `vsc` 找 Visual Studio Code）。
3. 用 ↑ ↓ 选择，Enter 启动，Esc 清空搜索；也可以直接点。
4. 打开过的应用会记下次数和时间，越常用越靠前。

刚装的应用没出现时，在设置分节点「重新扫描本机应用」，或者用插件的「重新扫描应用」命令（可以在「设置 → 插件」的插件详情里给它设快捷键）。

## 设置

- **重新扫描本机应用**
- **清空最近启动记录**

## 它会用到什么

- **读取应用列表**：Windows 上看开始菜单里的程序快捷方式（所有用户的和你自己的），macOS 上看「应用程序」文件夹（系统的、全局的和你自己的）。
- **启动本机程序**：只在你选中一个应用时打开它（Windows 上交给资源管理器打开，macOS 上用 `open`）。打开的程序独立运行，浮屿退出或重启不会影响它。
- 最近启动记录只保存在本机的插件数据目录里。
- 不联网。

---

## English

`@fuyu/launcher` · Official Fuyu plugin · Windows / macOS

Search the apps installed on your computer from the island and press Enter to open one. The apps you use most come first.

### Where it shows up

- **Island page**: a new "App Launcher" page with a search box and the app list.
- **Settings → Plugins**: a section where you can rescan apps and clear the recent history.

### How to use it

1. Expand the island and open the "App Launcher" page; the search box gets focus right away.
2. Type part of an app's name (case doesn't matter) or its initials (for example `vsc` for Visual Studio Code).
3. Use ↑ ↓ to choose, Enter to launch, Esc to clear the search; or just click.
4. Apps you open are remembered with how often and when, so frequent ones move to the top.

If a newly installed app is missing, click "Rescan applications" in the settings section, or use the plugin's "Rescan applications" command (give it a shortcut in the plugin's details under Settings → Plugins).

### Settings

- **Rescan applications**
- **Clear recent history**

### What it uses

- **Reads your app list**: on Windows the program shortcuts in the Start menu (for all users and for you); on macOS the Applications folders (system, shared and your own).
- **Starts programs**: only the app you pick, opened through File Explorer on Windows and `open` on macOS. The app runs on its own, so quitting or restarting Fuyu doesn't close it.
- The recent history is stored only in the plugin's data folder on your computer.
- No network access.

---

## 给开发者 · For developers

- 插槽：`island.page/v1`、`settings.section/v1`
- 命令：`rescan`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
