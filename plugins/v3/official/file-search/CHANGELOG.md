# 更新记录 · Changelog

## 1.1.0

- 未输入搜索词时默认展示桌面、下载与文档中最近修改的文件（支持直接回车打开或定位到文件夹），并提供 PDF / 文档 / 图片 / 笔记 / 表格一键快捷筛选胶囊。
- 新增设置页与页内快捷设置入口，支持配置结果数量上限（20 / 50 / 100）、macOS Spotlight 搜索范围、是否显示最近文件、是否保留上次搜索词以及打开后自动收起。
- 重新设计岛页 UI：按文件类型分色显示徽章、高亮匹配关键字、缩短主目录路径，并在底部提供快捷键提示栏。

- Shows recently modified files from Desktop, Downloads and Documents before typing (ready for Enter to open or reveal), plus one-click quick filter chips (PDF, Docs, Images, Notes, Sheets).
- Added a Settings section and a quick settings button next to the search box for max results (20 / 50 / 100), macOS Spotlight scope, recent files toggle, query memory, and auto-collapse.
- Redesigned the island UI with color-coded file-type badges, highlighted query matches, shortened `~` paths, and a keyboard shortcut footer.

## 1.0.0

第一版。

- 快捷键 `Ctrl+Alt+F` 展开岛到「文件搜索」页，输入即搜，回车打开文件，Ctrl+Enter（macOS 上 ⌘+Enter）或文件夹按钮打开所在文件夹。
- Windows 上通过 Everything 的命令行工具 `es.exe` 搜索；没装 Everything、没装 `es.exe`、Everything 没在运行时分别提示，给出 winget 命令、下载页和「启动 Everything」按钮。
- macOS 上用 Spotlight（`mdfind -name`）搜索用户目录。
- 再次打开时保留上次的搜索词。

First release.

- `Ctrl+Alt+F` expands the island on the "File search" page; results appear as you type, Enter opens a file, and Ctrl+Enter (⌘+Enter on macOS) or the folder button opens the folder that holds it.
- On Windows it searches through Everything's command-line tool `es.exe`; when Everything or `es.exe` is missing, or Everything is not running, it says which and offers the winget commands, the download page and a "Start Everything" button.
- On macOS it searches your home folder with Spotlight (`mdfind -name`).
- Reopening the page keeps your last search.
