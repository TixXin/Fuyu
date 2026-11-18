# @fuyu/pomodoro

官方第 3 版番茄钟插件（Windows / macOS）。

## 功能

- 支持从今日未完成待办中选择一条开始专注，或直接开启 25 分钟番茄钟
- 在展开页（`island.page/v1`）显示倒计时、进度条、当前关联待办与今日完成轮数
- 在收起条（`island.collapsed/v1`）显示运行中的番茄钟倒计时小块
- 已完成轮数持久化保存在插件专属目录 `ctx.dataDir` 下，到点经 `messages/v1` 在岛上弹出通知

## 服务与插槽

- 服务：`timers/v1`、`todos/v1`、`messages/v1`
- 插槽：`island.page/v1`、`island.collapsed/v1`
