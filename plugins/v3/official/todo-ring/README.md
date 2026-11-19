# 待办进度环 · Todo progress ring

`@fuyu/todo-ring` · 浮屿官方插件 · Windows / macOS

用一个圆环显示今天的待办完成了多少，顺带列出接下来要做的几条。

## 装好后在哪里

- **岛的展开页**：多出「待办进度环」一页，中间是今天的完成进度，下面是接下来的未完成待办。
- **收起条**：一个小圆环和「完成数/总数」。

## 怎么用

- 在列表里点一条待办就把它勾选为完成，圆环跟着变。
- 在岛上或别处增删、完成待办，圆环都会自动更新；也可以点刷新。

这个插件没有设置项。

## 它会用到什么

- 读取今天的待办列表；你在页面上勾选时，把那一条标成完成。
- 不联网。

---

## English

`@fuyu/todo-ring` · Official Fuyu plugin · Windows / macOS

A ring that shows how much of today's todo list is done, with the next few open items below it.

### Where it shows up

- **Island page**: a new "Todo progress ring" page with today's progress in the middle and the next open todos below.
- **Collapsed bar**: a small ring with done/total.

### How to use it

- Click a todo in the list to mark it done; the ring updates.
- Adding, removing or finishing todos anywhere else updates the ring too; there is also a refresh button.

This plugin has no settings.

### What it uses

- Reads today's todo list, and marks a todo done when you tick it on the page.
- No network access.

---

## 给开发者 · For developers

- 服务：`todos/v1`
- 插槽：`island.page/v1`、`island.collapsed/v1`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
