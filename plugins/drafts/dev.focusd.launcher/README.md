# 启动台 / Launcher

按快捷键在岛上搜索并打开这台电脑上的应用。Windows 和 macOS 都能用，需要 Node.js。

- 默认快捷键 `Ctrl+Alt+Space`：展开岛屿并打开启动台页面。可以在 **设置 → 快捷键 → 插件快捷键** 里改。
- 在搜索框里输入名字过滤，点一下打开。
- 最近打开过的应用排在最上面，数量在插件的设置页里调，设成 0 就不显示。
- 应用列表每 5 分钟最多重新查找一次；刚装了新应用，在插件的设置页点「重新查找应用」。

## 从哪里找应用

| 系统 | 位置 |
|---|---|
| macOS | `/Applications`、`/System/Applications`、`~/Applications`，往下找 3 层 |
| Windows | 当前用户和所有用户的开始菜单（`Start Menu\Programs` 里的快捷方式） |

名字相同的只留一个，卸载程序、帮助和网站链接这类条目不列出，最多 480 个。macOS 上显示的是应用包的文件名，系统应用是英文名（「访达」显示为 Finder）。

## 权限

不申请任何岛屿权限。打开应用用的是系统自带的 `open`（macOS）和 `explorer.exe`（Windows）。最近用过的记录存在插件自己的存储里，卸载后在插件设置页点「清除数据」可以删掉。

---

Press a shortcut to search and open the apps on this computer from the island. Works on Windows and macOS; needs Node.js.

- `Ctrl+Alt+Space` by default: expands the island on the launcher page. Change it in **Settings → Shortcuts → Plugin shortcuts**.
- Type in the search box to filter, click to open. Recently opened apps come first.
- Apps are found in `/Applications`, `/System/Applications` and `~/Applications` on macOS, and in the Start menu on Windows.
- It asks for no island permissions.
