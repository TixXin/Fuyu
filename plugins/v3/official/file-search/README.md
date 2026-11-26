# 文件搜索 · File search

`@fuyu/file-search` · 浮屿官方插件 · Windows / macOS

按快捷键按文件名搜索电脑上的文件：Windows 用 Everything，macOS 用 Spotlight。

## 装好后在哪里

- **快捷键 `Ctrl+Alt+F`**：展开岛并切到「文件搜索」页，搜索框直接能打字。快捷键可以在「设置 → 插件」的插件详情里改。
- **岛的展开页**：多出「文件搜索」一页，也可以从页头的按钮进来。

## 怎么用

1. 按 `Ctrl+Alt+F` 打开「文件搜索」页：输入前会直接列出桌面、下载与文档中最近修改的文件，也可以点上方 **PDF / 文档 / 图片 / 笔记 / 表格** 快捷筛选胶囊直接检索。
2. 输入文件名的一部分，结果随输入出现（默认最多 50 个，可在设置调整）；用 ↑ ↓ 选择，Enter 打开文件，Ctrl+Enter（macOS 上 ⌘+Enter）或右边文件夹按钮打开所在文件夹并选中。
3. Esc 清空搜索。点搜索框右侧的设置按钮可直达本插件设置。

## 设置

- **Spotlight 搜索范围**（仅 macOS）：用户目录（默认）/ 桌面与文档 / 全盘。
- **结果数量上限**：20 / 50（默认）/ 100。
- **输入前显示最近文件**：默认开，展示桌面、下载与文档中最近修改的文件。
- **重新打开时保留上次搜索词**：默认开。
- **打开文件后自动收起悬浮岛**：默认开。

## Windows：要装 Everything

Windows 上的搜索交给 [Everything](https://www.voidtools.com/)（voidtools 出品，免费），浮屿通过它的命令行工具 `es.exe` 来查，两样都要装：

```
winget install voidtools.Everything
winget install voidtools.Everything.Cli
```

也可以在 Everything 的下载页手动下载，把 `es.exe` 放到 Everything 的安装目录里或 `PATH` 上。

- 没装 Everything、没装 `es.exe`、Everything 没在运行时，搜索页里会分别说明，并给出安装命令、「打开下载页」和「启动 Everything」按钮。
- Everything Lite 版不能给其他程序用，要装完整版。
- 搜索语法就是 Everything 的语法，例如 `报告 ext:pdf`、`*.psd`。

## macOS：用 Spotlight

macOS 上用系统自带的 Spotlight（`mdfind -name`）按文件名搜你的用户目录，不用另外安装。Spotlight 隐私设置里排除的文件夹、系统目录搜不到。

## 它会用到什么

- **运行程序**：Windows 上运行 `es.exe` 查询、用资源管理器打开文件或文件夹、按你的要求启动 Everything；macOS 上运行 `mdfind` 查询、用 `open` 打开文件或在访达中显示。
- **网页**：只在你点「打开下载页」时用默认浏览器打开 Everything 的下载页（www.voidtools.com），插件自己不联网。
- 不保存搜索记录：上次的搜索词只留在内存里，浮屿重启就没了。

---

## English

`@fuyu/file-search` · Official Fuyu plugin · Windows / macOS

Press a shortcut and search every file on your computer by name: Everything on Windows, Spotlight on macOS.

### Where to find it

- **Shortcut `Ctrl+Alt+F`**: expands the island on the "File search" page with the search box ready for typing. Change it in the plugin's details under Settings → Plugins.
- **Island page**: a new "File search" page, also reachable from the header button.

### How to use it

1. Press `Ctrl+Alt+F` to open "File search": before typing, it shows recently modified files from Desktop, Downloads and Documents, plus one-click filter chips (**PDF / Docs / Images / Notes / Sheets**).
2. Type part of a file name; results appear as you type (up to 50 by default, configurable). Use ↑ ↓ to select, Enter to open, Ctrl+Enter (⌘+Enter on macOS) or the folder button to reveal in folder.
3. Esc clears the search. Click the settings icon beside the search box to open plugin settings.

### Settings

- **Spotlight scope** (macOS only): Home folder (default) / Desktop & Docs / Whole Mac.
- **Max results**: 20 / 50 (default) / 100.
- **Show recent files before typing**: on by default.
- **Remember the last search**: on by default.
- **Collapse the island after opening a file**: on by default.

### Windows: needs Everything

On Windows the search is done by [Everything](https://www.voidtools.com/) (free, by voidtools). Fuyu talks to it through its command-line tool `es.exe`, so install both:

```
winget install voidtools.Everything
winget install voidtools.Everything.Cli
```

You can also download them from Everything's download page and put `es.exe` in Everything's folder or on your `PATH`.

- When Everything or `es.exe` is missing, or Everything is not running, the page says which and offers the install commands, "Open download page" and "Start Everything".
- Everything Lite cannot be used by other apps; install the full version.
- The search uses Everything's syntax, such as `report ext:pdf` or `*.psd`.

### macOS: uses Spotlight

On macOS it uses the built-in Spotlight (`mdfind -name`) to search your home folder by file name; nothing to install. Folders excluded in Spotlight's privacy settings and system folders are not searched.

### What it uses

- **Runs programs**: on Windows, `es.exe` to search, File Explorer to open a file or folder, and Everything when you ask to start it; on macOS, `mdfind` to search and `open` to open a file or show it in Finder.
- **Web page**: only when you click "Open download page" does it open Everything's download page (www.voidtools.com) in your browser. The plugin itself does not go online.
- No search history is stored: the last search stays in memory only and is gone when Fuyu restarts.
