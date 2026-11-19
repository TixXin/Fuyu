# 番茄钟 · Pomodoro

`@fuyu/pomodoro` · 浮屿官方插件 · Windows / macOS

专注 25 分钟，可以挑一条今天的待办来做，到点在岛上提醒，并记下今天完成了几轮。

## 装好后在哪里

- **岛的展开页**：多出「番茄钟」一页，显示倒计时、进度条、正在做的待办和今天完成的轮数。
- **收起条**：番茄钟运行时显示剩余时间。

## 怎么用

1. 展开岛，切到「番茄钟」页。
2. 从「今日未完成待办」里选一条，点「开始所选待办」；或者直接点「开始 25:00」，不关联待办。
3. 25 分钟到了，岛上弹出提醒，今天完成的轮数加一。中途想停就点「停止」。

也可以不打开页面：按 **Ctrl+Alt+P** 直接开始一轮。插件带「开始番茄钟」「停止番茄钟」两个命令，快捷键可以在「设置 → 插件」的插件详情里改。

## 它会用到什么

- 读取今天的待办列表（只读，不会改动或勾选你的待办）。
- 在岛上弹出提醒。
- 完成轮数只保存在本机的插件数据目录里。
- 不联网。

---

## English

`@fuyu/pomodoro` · Official Fuyu plugin · Windows / macOS

Focus for 25 minutes, optionally on one of today's todos. The island tells you when time is up and keeps count of today's rounds.

### Where it shows up

- **Island page**: a new "Pomodoro" page with the countdown, a progress bar, the todo you are working on and today's finished rounds.
- **Collapsed bar**: the time left while a pomodoro is running.

### How to use it

1. Expand the island and open the "Pomodoro" page.
2. Pick one of "Open todos today" and click "Start on selected todo", or click "Start 25:00" to focus without a todo.
3. After 25 minutes the island shows a notification and today's count goes up by one. Click "Stop" to end early.

You can also start a round without opening the page: press **Ctrl+Alt+P**. The plugin has "Start pomodoro" and "Stop pomodoro" commands; change their shortcuts in the plugin's details under Settings → Plugins.

### What it uses

- Reads today's todo list (read only: it never changes or ticks off your todos).
- Shows notifications on the island.
- Finished rounds are stored only in the plugin's data folder on your computer.
- No network access.

---

## 给开发者 · For developers

- 服务：`timers/v1`、`todos/v1`、`messages/v1`
- 插槽：`island.page/v1`、`island.collapsed/v1`
- 命令：`start`（默认 `Ctrl+Alt+P`）、`stop`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
