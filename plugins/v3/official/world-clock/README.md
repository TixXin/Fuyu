# 世界时钟 · World Clock

`@fuyu/world-clock` · 浮屿官方插件 · Windows / macOS

同时看几个城市的当地时间、是白天还是夜晚、和你这里差几个小时。

## 装好后在哪里

- **岛的展开页**：多出「世界时钟」一页，列出你的城市和当地时间。
- **收起条**：显示关注城市（★）的时间，点一下打开世界时钟页。
- **设置 → 插件 → 世界时钟**：管理城市和全部设置。

## 怎么用

1. 打开设置里的世界时钟，在搜索框输入城市名（中文、英文、三字码都行）或时区名（如 `Europe/Berlin`），点结果添加。
2. 拖动左边的把手调整顺序；点铅笔改显示名（留空恢复原名）；点 ★ 设为关注城市；点 ✕ 删除。
3. 展开岛切到「世界时钟」页，每个城市显示当地时间，按设置标出明天 / 昨天、与本机的时差和白天 / 夜晚。

## 设置

**城市**

- 城市列表：搜索添加、删除、拖动排序、改显示名、★ 关注城市。最多 24 个。
- **在最上面显示本机时间**：默认关。

**显示**

- **时间格式**：跟随系统（默认）/ 24 小时 / 12 小时。
- **显示秒**：默认关；打开后每秒刷新。
- **日期**：只标明天 / 昨天（默认）/ 总是显示（如「11月20日 周四」）/ 不显示。
- **与本机的时差**：「快 3 小时」（默认）/「+3」/ 不显示。
- **昼夜图标**：默认开。
- **时区名和 UTC 偏移**：默认关；打开后城市名下面多出 `Asia/Tokyo · UTC+9`。

**收起条**

- **在收起条显示关注城市**：默认开。
- **收起条样式**：城市名 + 时间（默认）/ 三字码 + 时间 / 只有时间。

## 它会用到什么

- 时间用系统自带的时区数据算，不联网。
- 城市列表只保存在本机的插件数据目录里。

---

## English

`@fuyu/world-clock` · Official Fuyu plugin · Windows / macOS

See the local time in several cities at once, whether it is day or night there, and how many hours ahead or behind they are.

### Where it shows up

- **Island page**: a new "World Clock" page listing your cities and their local times.
- **Collapsed bar**: the time in your starred (★) city; click it to open the World Clock page.
- **Settings → Plugins → World Clock**: manage cities and every setting.

### How to use it

1. Open World Clock in the settings and type a city (Chinese or English name, or its code) or a time zone such as `Europe/Berlin` in the search box, then click a result to add it.
2. Drag the handle on the left to reorder; click the pencil to rename (leave it empty for the original name); click ★ to star a city; click ✕ to remove it.
3. Expand the island and open the "World Clock" page: each city shows its local time and, depending on the settings, Tomorrow / Yesterday, the offset from your computer, and day or night.

### Settings

**Cities**

- City list: search to add, remove, drag to reorder, rename, ★ the city for the collapsed bar. Up to 24.
- **Show a local time row at the top**: off by default.

**Display**

- **Time format**: system (default), 24-hour, or 12-hour.
- **Show seconds**: off by default; when on, the page updates every second.
- **Date**: only Tomorrow / Yesterday (default), always (such as "Thu, Nov 20"), or hidden.
- **Offset from local**: "3h ahead" (default), "+3", or hidden.
- **Day / night icon**: on by default.
- **Time zone name and UTC offset**: off by default; when on, `Asia/Tokyo · UTC+9` appears under the city name.

**Collapsed bar**

- **Show the ★ city on the collapsed bar**: on by default.
- **Bar style**: city + time (default), code + time, or time only.

### What it uses

- Times come from the time zone data built into your system; no network access.
- Your city list is stored only in the plugin's data folder on your computer.

---

## 给开发者 · For developers

- 插槽：`island.page/v1`、`island.collapsed/v1`、`settings.section/v1`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
