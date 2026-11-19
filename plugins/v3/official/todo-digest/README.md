# 待办摘要 · Todo digest

`@fuyu/todo-digest` · 浮屿官方插件 · Windows / macOS

一键把今天还没做完的待办整理成清单，追加到今天的笔记末尾，方便收工前回顾。

## 装好后在哪里

- **设置 → 插件**：「待办摘要」分节，显示今天一共几条待办、还有几条没完成，并预览未完成的那几条。

这个插件不在岛上加页面，写入时会在岛上弹一条提示。

## 怎么用

1. 打开「设置 → 插件」，找到「待办摘要」。
2. 点「写入摘要」，未完成的待办会作为一份清单追加到今天笔记的末尾，原来的笔记内容不动。
3. 写完岛上会弹出提示，分节里显示「上次写入」的时间。

插件还带一个命令「写入摘要」，可以在「设置 → 插件」的插件详情里给它设快捷键，不打开设置也能写。

这个插件没有其他设置项。

## 它会用到什么

- 读取今天的待办列表。
- 读取并改写今天的笔记：只在末尾追加，不删改已有内容。
- 在岛上弹出提示。
- 不联网。

---

## English

`@fuyu/todo-digest` · Official Fuyu plugin · Windows / macOS

With one click, turn today's unfinished todos into a list and append it to the end of today's note, so you can review the day before you wrap up.

### Where it shows up

- **Settings → Plugins**: a "Todo digest" section showing how many todos you have today, how many are still open, and a preview of the open ones.

It adds no page to the island; the island shows a notification when it writes.

### How to use it

1. Open Settings → Plugins and find "Todo digest".
2. Click "Write digest". Your open todos are appended as a list to the end of today's note; what is already in the note stays as it is.
3. The island shows a notification, and the section shows when it last wrote.

The plugin also has a "Write digest" command; give it a shortcut in the plugin's details under Settings → Plugins to write without opening Settings.

This plugin has no other settings.

### What it uses

- Reads today's todo list.
- Reads and updates today's note, only appending to the end.
- Shows notifications on the island.
- No network access.

---

## 给开发者 · For developers

- 服务：`todos/v1`、`messages/v1`
- 插槽：`settings.section/v1`
- 命令：`write-digest`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
