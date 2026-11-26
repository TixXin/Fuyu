# 更新记录 · Changelog

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
