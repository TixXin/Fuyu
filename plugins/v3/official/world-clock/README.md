# 世界时钟 · World Clock

`@fuyu/world-clock` · 浮屿官方插件 · Windows / macOS

同时看几个城市的当地时间、是白天还是夜晚、和你这里差几个小时。

## 装好后在哪里

- **岛的展开页**：多出「世界时钟」一页，列出你添加的城市。
- **收起条**：显示你「上岛」的那个城市的时间。
- **设置 → 插件**：世界时钟的设置。

## 怎么用

1. 展开岛，切到「世界时钟」页，从列表里选城市点「添加」；列表里没有的，直接填时区名（如 `Europe/Berlin`）。
2. 每个城市显示当地时间、白天或夜晚、比本机快或慢几个小时，跨日时标出「明天」「昨天」。
3. 点「上岛」把这个城市的时间放到收起条上；不要的城市点「移除」。

## 设置

- **在收起条显示关注城市时间**：默认开启。

## 它会用到什么

- 时间用系统自带的时区数据算，不联网。
- 城市列表只保存在本机的插件数据目录里。

---

## English

`@fuyu/world-clock` · Official Fuyu plugin · Windows / macOS

See the local time in several cities at once, whether it is day or night there, and how many hours ahead or behind they are.

### Where it shows up

- **Island page**: a new "World Clock" page listing the cities you added.
- **Collapsed bar**: the time in the city you pinned.
- **Settings → Plugins**: the plugin's settings.

### How to use it

1. Expand the island, open the "World Clock" page, pick a city and click "Add"; for a place not in the list, type a time zone name such as `Europe/Berlin`.
2. Each city shows its local time, day or night, and the hour offset from your computer, with "Tomorrow" or "Yesterday" when the date differs.
3. "Pin" puts that city's time on the collapsed bar; "Remove" deletes a city.

### Settings

- **Show pinned city on collapsed bar**: on by default.

### What it uses

- Times come from the time zone data built into your system; no network access.
- Your city list is stored only in the plugin's data folder on your computer.

---

## 给开发者 · For developers

- 插槽：`island.page/v1`、`island.collapsed/v1`、`settings.section/v1`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
