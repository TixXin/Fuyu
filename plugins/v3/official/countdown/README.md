# 倒数日 · Countdown

`@fuyu/countdown` · 浮屿官方插件 · Windows / macOS

记下重要的日子：还没到的显示「还有几天」，已经过去的纪念日显示「已过几天」。

## 装好后在哪里

- **岛的展开页**：多出「倒数日」一页，最上面一张大卡片显示置顶或最近的那一天，下面是全部日期。
- **收起条**：显示置顶或最近一项的剩余天数。
- **设置 → 插件**：倒数日的设置。

## 怎么用

1. 展开岛，切到「倒数日」页，填事件名称、选日期，点「添加」。
2. 点「置顶」把某一天固定在大卡片和收起条上；不置顶时显示最近要到的那一天。
3. 点「设背景图」给卡片换一张本机图片（500 KB 以内），「去背景」恢复默认。
4. 不要的日期点「删除」。

## 设置

- **在收起条显示天数**：默认开启。

## 它会用到什么

- 日期和背景图只保存在本机的插件数据目录里。
- 不联网，不读取你的其他数据。

---

## English

`@fuyu/countdown` · Official Fuyu plugin · Windows / macOS

Keep track of dates that matter: upcoming ones show how many days are left, past anniversaries show how many days have gone by.

### Where it shows up

- **Island page**: a new "Countdown" page with a large card for the pinned or nearest date, and all your dates below it.
- **Collapsed bar**: the days left until the pinned or nearest date.
- **Settings → Plugins**: the plugin's settings.

### How to use it

1. Expand the island, open the "Countdown" page, enter a name, pick a date and click "Add".
2. "Pin" keeps a date on the large card and the collapsed bar; without a pin the nearest upcoming date is shown.
3. "Background" sets a picture from your computer (up to 500 KB) on the card; "Clear bg" removes it.
4. "Delete" removes a date.

### Settings

- **Show remaining days on collapsed bar**: on by default.

### What it uses

- Dates and background pictures are stored only in the plugin's data folder on your computer.
- No network access, and it doesn't read any of your other data.

---

## 给开发者 · For developers

- 插槽：`island.page/v1`、`island.collapsed/v1`、`settings.section/v1`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
