# 待办摘要 · To-do digest

`@fuyu/todo-digest` · 浮屿官方插件 · Windows / macOS

一键或定时把还没做完的待办写进今天的笔记，收工前顺手做个记录。

## 装好后在哪里

- **设置 → 插件 → 待办摘要**：今天的待办统计、「写入摘要」按钮、将要写入的内容预览和全部设置。

这个插件不在岛上加页面和收起条；写完会在岛上弹一条提示（可以关）。

## 怎么用

1. 打开设置里的待办摘要，看一眼预览，点「写入摘要」。
2. 摘要写在今天笔记的末尾，例如：

   ```text
   [22:00] 待办摘要：未完成 2 条
   - [工作] 回复邮件
   - 买牛奶
   ```

3. 同一天再写一次，会替换今天上一份摘要，不会越叠越多。
4. 想每天自动记一笔，打开「每天定时写入」并选好时间。

插件带一个命令「写入待办摘要」，在插件详情里可以运行它或设快捷键，不打开设置也能写。

## 设置

**写入内容**

- **写入范围**：只写未完成（默认）/ 未完成 + 已完成数 / 全部（已完成的也列出来）。
- **条目格式**：列表 `- 待办`（默认）/ 复选框 `- [ ] 待办`，已完成的是 `- [x] 待办`。
- **全部完成时也写一句**：默认开，写「今日待办已全部完成」；关掉时没有未完成的待办就不写。
- **同一天再次写入时替换上一份**：默认开。笔记里的上一份被你改过时，新的写在后面，你改的内容不动。关掉时每次都追加一份。

**自动写入**

- **每天定时写入**：默认关，时间默认 22:00。到点时浮屿没开着，当天晚些时候启动后补写；第二天不补。

**提示**

- **写完在岛上弹出提示**：默认开。

## 开销和数据来源

- 读今天的待办列表，读写今天的笔记：只在末尾追加或替换自己上一次写的那一份，不动别的内容。
- 不联网。设置和「上一次写了什么」保存在本机的插件数据目录里。
- 后台每 30 秒看一次要不要定时写入、是不是过了零点。

---

## English

`@fuyu/todo-digest` · Official Fuyu plugin · Windows / macOS

Writes your unfinished to-dos into today's note in one click or at a set time, a quick wrap-up before you stop for the day.

### Where it shows up

- **Settings → Plugins → To-do digest**: today's to-do count, the "Write digest" button, a preview of what will be written, and every setting.

It adds no page or collapsed bar item to the island; after writing it shows a notification on the island (which you can turn off).

### How to use it

1. Open To-do digest in the settings, check the preview and click "Write digest".
2. The digest goes at the end of today's note, for example:

   ```text
   [22:00] To-do digest: 2 open
   - [Work] Reply to email
   - Buy milk
   ```

3. Writing again on the same day replaces today's earlier digest instead of adding another.
4. To note it every day without clicking, turn on "Write the digest every day at" and pick a time.

The plugin has a "Write to-do digest" command; run it or give it a shortcut in the plugin's details to write without opening Settings.

### Settings

**Content**

- **What to write**: open only (default), open + done count, or all (done to-dos listed too).
- **Item style**: list `- to-do` (default) or checkbox `- [ ] to-do`, with `- [x] to-do` for done ones.
- **Write a line when everything is done**: on by default, writing "All to-dos done for today"; when off, nothing is written if nothing is open.
- **Replace today's earlier digest instead of adding another**: on by default. If you edited the earlier digest in the note, the new one goes below it and your edits stay. When off, every write adds a new copy.

**Write automatically**

- **Write the digest every day at**: off by default, 22:00. If Fuyu is not running at that time, it writes when it starts later the same day, but not the next day.

**Notification**

- **Show a notification on the island after writing**: on by default.

### Cost and data

- Reads today's to-do list and reads and updates today's note: it only appends to the end or replaces the copy it wrote last, nothing else.
- No network access. Settings and the last digest it wrote are kept in the plugin's data folder on this computer.
- Checks every 30 seconds whether it's time to write and whether the day has changed.

---

## 给开发者 · For developers

- 服务：`todos/v1`（必需）、`messages/v1`（可选）
- 插槽：`settings.section/v1`
- 命令：`write-digest`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
