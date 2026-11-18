# @fuyu/todo-ring

官方第 3 版待办进度环插件（Windows / macOS）。

## 功能

- 在岛展开页（`island.page/v1`）使用 React SVG 与 `--fuyu-plugin-*` 公开主题变量绘制今日待办完成进度圆环，并列出接下来的未完成待办（支持点击勾选完成或刷新）
- 在收起条（`island.collapsed/v1`）绘制紧凑小圆环与「完成数/总数」
- 监听 `todos/v1` 的 `changed` 事件，待办变化时自动同步更新

## 服务与插槽

- 服务：`todos/v1`
- 插槽：`island.page/v1`、`island.collapsed/v1`
