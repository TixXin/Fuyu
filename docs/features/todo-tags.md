# 待办的优先级和颜色

> 任务：[C72](/docs/tasks/C/C72.md)，issue #323。代码在 `src/features/todos/`（`tags.ts`、`dueReminders.ts`、`island/TodoTagMenu.tsx`）。

## 怎么用

- 岛上待办页每一行标题右边有一面小旗子（平时隐藏，光标移上去出现），点开菜单设：
  - 优先级：高、中、低，或「不设优先级」；
  - 颜色标签：红、橙、黄、绿、蓝、紫，或「不设颜色」。
- 设了的待办这个位置一直显示：颜色是一个小圆点，优先级是旗子（高 = 红色实心、中 = 黄色、低 = 灰色）。
- 「已安排」页（以后日期的待办）每一项也有同样的按钮。回看归档时只显示，不能改。
- 定时待办到了那天移进今天时，优先级和颜色跟着带过去；未完成的待办顺延到第二天也一样。

## 高优先级到期提醒

高优先级的定时待办到了那一天（包括岛没开着、过了日子才打开的），移进今天的同时在岛上提醒一次：「高优先级待办今天到期 · <标题>」，旗子图标，可以「5 分钟后再提醒」或「跳过」。用的是休息提醒（C78）的通用提醒队列（见 [break-reminders.md](break-reminders.md)「通用提醒队列」），来源是 `todo-due`，提醒 id 是 `todo-due:<日期>:<待办 id>`。同一项同一天只推一次（记在内存里，定时待办移进今天后就不在已安排里了，重开岛也不会再推）。前台全屏时照常推迟到退出全屏。

只到日期，不设时刻（2026-11-15 用户定）。

## 数据

待办（`todos`、归档里的 `todos`）和定时待办（`scheduled`）多了两个可选字段：`priority`（`high` / `medium` / `low`）、`color`（`red` / `orange` / `yellow` / `green` / `blue` / `purple`）。没设时不写字段；读到别的值当作没设。`todos.json` 的版本仍是 1，Rust 侧（`src-tauri/src/todos/model.rs`）原样读写这两个字段。导出的 Markdown 不变，不写优先级和颜色。契约见 [contracts.md](../architecture/contracts.md)「待办的优先级和颜色」。

测试：`tests/unit/todo-tags.test.mjs`（旧数据兼容、Markdown 不变、到期只推一次），回归页 `tests/regression/todo-island.tsx` 的「优先级和颜色」两帧。
