# 倒数日 · Day Counter

`@fuyu/countdown` · 浮屿官方插件 · Windows / macOS

记下生日、节日、截止日和纪念日：还没到的显示「还有几天」，纪念日显示「第几天」，到日子在岛上提醒你。

## 装好后在哪里

- **岛的展开页**：多出「倒数日」一页，最上面一张大卡片是置顶（★）的那一天，下面最多 5 行别的日期。
- **收起条**：显示置顶那一项的天数，例如「12天」；点一下打开倒数日页。
- **设置 → 插件 → 倒数日**：添加、编辑、排序日期和全部设置。

## 怎么用

1. 打开设置里的倒数日，填名称、选日期，选类型（倒数 / 纪念日），生日这类每年都有的勾上「每年重复」，点「添加」。
2. 点 ★ 把某一天放到大卡片和收起条上；没有置顶时显示最近要到的那一天。
3. 点铅笔编辑：改名称、日期、类型、每年重复，也可以给卡片选一张本机图片作背景（500 KB 以内）或去掉。
4. 点 ✕ 删除。排序选「手动」时，拖动左边的把手调整岛上的顺序。

- **倒数**：显示「还有 12 天」，当天显示「今天」，过了显示「已过 3 天」。勾了每年重复的，过了就数到明年的这一天。
- **纪念日**：从那天算起显示「第 1024 天」（当天是第 1 天）。

## 设置

**日期**

- 日期列表：添加、编辑、删除、拖动排序、★ 置顶、背景图。最多 200 个，满了会提示。

**显示**

- **排序**：按日期（默认，最近的在前）/ 手动。
- **岛上显示几行**：只有卡片 / 3 / 5（默认）/ 10。
- **已经过去的日期**：显示「已过 3 天」（默认）/ 隐藏 / 变灰。
- **在岛上显示日期**：默认关。

**提醒**

- **当天提醒**：默认开。
- **提前提醒**：默认关；**提前几天**：1 天（默认）/ 3 天 / 7 天。
- 提醒在 9 点以后弹在岛上，每项每天最多一次。

**收起条**

- **在收起条显示**：默认开。
- **显示哪一项**：★ 置顶项（默认，没有置顶时是最近的一项）/ 最近的一项。
- **收起条样式**：「12天」（默认）/ 图标 + 12天 / 名称 + 12天。

## 开销和数据来源

- 不联网，不读你的其他数据；日期、背景图和设置只保存在本机的插件数据目录里。
- 后台每分钟看一次要不要提醒；背景图只在岛上显示卡片时读取。

---

## English

`@fuyu/countdown` · Official Fuyu plugin · Windows / macOS

Keep birthdays, holidays, deadlines and anniversaries in one place: upcoming dates show how many days are left, anniversaries show which day you are on, and the island reminds you when the day comes.

### Where it shows up

- **Island page**: a new "Day Counter" page with a large card for your starred (★) date and up to 5 more dates below it.
- **Collapsed bar**: the day count for the starred date, such as "12d"; click it to open the Day Counter page.
- **Settings → Plugins → Day Counter**: add, edit and order dates, and every setting.

### How to use it

1. Open Day Counter in the settings, enter a name, pick a date and a type (countdown or anniversary), tick "Repeat every year" for things like birthdays, and click "Add".
2. Click ★ to put a date on the large card and the collapsed bar; without a star the nearest upcoming date is shown.
3. Click the pencil to edit the name, date, type and yearly repeat, or to pick a picture from your computer as the card background (up to 500 KB) or remove it.
4. Click ✕ to delete. With the order set to Manual, drag the handle on the left to reorder the island page.

- **Countdown**: shows "12 days left", "Today" on the day, and "3 days ago" afterwards. With yearly repeat it moves on to next year's date instead.
- **Anniversary**: counts from that day, such as "Day 1024" (the day itself is Day 1).

### Settings

**Dates**

- Date list: add, edit, delete, drag to reorder, ★ star, background picture. Up to 200; you are told when the list is full.

**Display**

- **Order**: by date (default, nearest first) or manual.
- **Rows on the island page**: card only, 3, 5 (default) or 10.
- **Dates that have passed**: show "3 days ago" (default), hide, or dim.
- **Show the date on the island page**: off by default.

**Reminders**

- **Remind me on the day**: on by default.
- **Remind me in advance**: off by default; **days in advance**: 1 (default), 3 or 7.
- Reminders pop up on the island after 9:00, at most once a day for each date.

**Collapsed bar**

- **Show on the collapsed bar**: on by default.
- **Which date**: the ★ date (default; the nearest one when nothing is starred) or the nearest date.
- **Bar style**: "12d" (default), icon + 12d, or name + 12d.

### Cost and data

- No network access, and it doesn't read any of your other data; dates, pictures and settings are stored only in the plugin's data folder on your computer.
- In the background it checks once a minute whether a reminder is due; background pictures are read only when the island shows the card.

---

## 给开发者 · For developers

- 插槽：`island.page/v1`、`island.collapsed/v1`、`settings.section/v1`；可选服务 `messages/v1`（提醒）
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
