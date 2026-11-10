# Fuyu for VS Code

[中文](#中文)

[Fuyu](https://github.com/TixXin/fuyu) is a floating island for Windows that shows your Claude Code and Codex sessions. Clicking a session brings its window to the front. When the session runs in a terminal inside VS Code (or Cursor, Windsurf, VSCodium), the island cannot pick the terminal by itself; with this extension installed it also shows the terminal panel and switches to that session's terminal.

The extension does nothing on its own. It only handles links of the form `vscode://tixxin.fuyu/focus?pids=…&title=…` that the island opens: it picks the terminal whose shell is one of the session's processes, or else the only terminal named like the session, and shows it. Nothing is sent anywhere.

Requires a Fuyu release from after the rename (the island looks for this extension, `tixxin.fuyu`, first; older islands only know the previous extension, `tixxin.focusd-island`). The island checks whether the extension is installed in that editor before opening a link, so you never get a prompt to install it.

## 中文

[Fuyu](https://github.com/TixXin/fuyu) 是 Windows 上的悬浮岛，会列出正在运行的 Claude Code 和 Codex 会话，点一下就把会话所在的窗口调到前面。会话跑在 VS Code（以及 Cursor、Windsurf、VSCodium）的终端里时，岛屿自己没法选中具体的终端；装上这个扩展后，它还会打开终端面板并切到这个会话的终端。

扩展本身不做任何事，只处理岛屿打开的 `vscode://tixxin.fuyu/focus?pids=…&title=…` 链接：找出 shell 进程属于这个会话的终端，找不到时用名字和会话标题一样的唯一终端，然后显示它。不向任何地方发送数据。

需要改名之后发布的浮屿（岛屿先找这个扩展 `tixxin.fuyu`；改名前的版本只认旧扩展 `tixxin.focusd-island`）。岛屿打开链接前会先确认这个编辑器装了扩展，所以不会弹出安装提示。
