# @fuyu/todo-digest

官方第 3 版待办摘要插件（Windows / macOS）。

## 功能

- 订阅 `todos/v1` 的 `changed` 事件，实时统计今日未完成待办数
- 在设置窗口插件分节（`settings.section/v1`）预览未完成待办，并提供「写入摘要」按钮
- 点击「写入摘要」时通过 `todos.note()` 读取今日笔记并通过 `todos.setNote(...)` 追加未完成待办清单，同时经 `messages/v1` 在岛上弹出通知

## 服务与插槽

- 服务：`todos/v1`、`messages/v1`
- 插槽：`settings.section/v1`
