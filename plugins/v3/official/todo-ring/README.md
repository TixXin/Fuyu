# 待办进度环 · Todo Progress Ring

`@fuyu/todo-ring` · 浮屿官方插件 · Windows / macOS

用一个圆环看今天的待办完成了多少，旁边列出接下来要做的几条。

## 装好后在哪里

- **岛的展开页**：多出「待办进度环」一页，左边是完成进度，右边是接下来的几条未完成待办。
- **收起条**：一个小圆环和「完成数/总数」，点一下打开待办进度环页。
- **设置 → 插件 → 待办进度环**：全部设置。

## 怎么用

- 在岛上或别处增删、完成待办，圆环马上跟着变；过了零点自动换到新的一天。
- 全部做完后圆环变成完成色。
- 想在页面上直接勾掉待办：在设置里打开「点待办勾选完成」。打开后点一条就标为完成，下面会出现「撤销」，几秒内点它可以改回来。

## 设置

**内容**

- **统计范围**：今天（默认）/ 今天加逾期。逾期是最近 7 天没做完、今天的列表里又没有的待办（开了待办设置里的「自动将未完成任务写入下一天」时，写过来的不会重复算）。逾期的待办排在最前面、标出是哪天的，只能在待办列表里处理。
- **列出几条待办**：只显示圆环 / 3（默认）/ 5 / 8。
- **点待办勾选完成**：默认关，免得误点。

**显示**

- **全部完成后圆环变成完成色**：默认开。

**收起条**

- **在收起条显示**：默认开。今天没有待办时收起条上不显示。
- **样式**：圆环 + 3/7（默认）/ 只圆环 / 剩 4 条。

## 开销和数据来源

- 只读浮屿自己的待办列表，待办一变就更新，不轮询、不联网。
- 打开「点待办勾选完成」后，点一条会把它标为完成（撤销时改回未完成）。
- 设置保存在本机的插件数据目录里。

---

## English

`@fuyu/todo-ring` · Official Fuyu plugin · Windows / macOS

See how much of today's todo list is done at a glance, with the next few todos beside the ring.

### Where it shows up

- **Island page**: a new "Todo Progress Ring" page with today's progress on the left and the next open todos on the right.
- **Collapsed bar**: a small ring with done/total; click it to open the Todo Progress Ring page.
- **Settings → Plugins → Todo Progress Ring**: every setting.

### How to use it

- Adding, removing or finishing todos anywhere updates the ring right away; after midnight it moves on to the new day by itself.
- When everything is done the ring turns the done color.
- To tick todos off on the page itself, turn on "Click a todo to mark it done" in the settings. A click then marks the todo done and shows "Undo" for a few seconds in case it was a mistake.

### Settings

**Content**

- **Count**: today (default) or today + overdue. Overdue means unfinished todos from the last 7 days that are not on today's list (with "Carry unfinished tasks to next day" on in the todo settings, carried-over todos are not counted twice). Overdue todos come first, marked with their day, and can only be finished in the todo list.
- **Todos to list**: ring only, 3 (default), 5, or 8.
- **Click a todo to mark it done**: off by default so a stray click doesn't tick anything.

**Display**

- **Turn the ring the done color when everything is done**: on by default.

**Collapsed bar**

- **Show on the collapsed bar**: on by default. Nothing shows there on a day with no todos.
- **Style**: ring + 3/7 (default), ring only, or "4 left".

### Cost and data

- Reads only Fuyu's own todo list and updates when it changes; no polling, no network access.
- With "Click a todo to mark it done" on, a click marks the todo done (Undo marks it open again).
- Settings are kept in the plugin's data folder on this computer.

---

## 给开发者 · For developers

- 服务：`todos/v1`
- 插槽：`island.page/v1`、`island.collapsed/v1`、`settings.section/v1`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
