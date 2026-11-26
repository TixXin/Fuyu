# 自选股

`@fuyu/stock` · 浮屿官方插件 · Windows / macOS

在岛上看自选股：A 股、港股、美股在收起条上轮流显示，点开看完整列表。休市时不联网，不费电。

## 装好后在哪里

- **岛的展开页**：多出「自选股」一页，每行是名称、代码、现价、涨跌额和涨跌幅；顶上写着交易中还是已休市、几点更新的。
- **收起条**：添加了自选股就显示，轮流显示每只的涨跌幅；点一下打开自选股页。不想要可以在设置里关掉，或在收起条上右键隐藏。
- **设置 → 插件 → 自选股**：添加、排序、删除自选股和全部设置。

## 怎么用

1. 首次安装自带一组示例自选股，展开岛即可直接查看行情；点击页面右上角设置按钮或顶部「去自定义」横条，即可在设置里按代码（`600519`、`00700`、`AAPL`）、名称或拼音首字母搜索并管理自选股（支持 A 股、港股、美股、指数和 ETF，最多 20 只）。
2. 用每行右边的箭头调整顺序：收起条按这个顺序轮流显示，「只显示第一只」时显示排第一的。
3. 展开岛切到「自选股」页看完整列表，想马上更新就点「刷新」。插件还带一个命令「立即刷新行情」，可以在「设置 → 插件」的插件详情里给它设快捷键。

## 设置

**自选股**：搜索添加、上移下移、删除。列表是空的时候，浮屿「设置 → 插件」里这个插件会标出「待设置」（需要较新的浮屿）。

**颜色**

- **涨跌颜色**：红涨绿跌（默认）/ 绿涨红跌。

**刷新**

- **交易时段每隔**：15 秒 / 30 秒（默认）/ 1 分钟 / 2 分钟 / 5 分钟。
- **打开页面时立即刷新**：默认开；10 秒内刚刷新过就不再请求。

**收起条**

- **在收起条上显示自选股**：默认开，有自选股才显示。
- **显示方式**：轮流显示（默认）/ 只显示第一只。
- **每只停留**：3 / 5（默认）/ 8 / 10 秒。
- **同时显示现价**：默认关。

## 开销和数据来源

- **什么时候联网**：只在自选股所在的市场开盘时按上面的间隔刷新（北京时间 A 股 9:15–11:30、13:00–15:00，港股 9:30–12:00、13:00–16:10，美股按纽约时间 9:30–16:00，自动跟夏令时）。全部休市时不联网，到下一个开盘时间再醒；启动和打开页面时各取一次，显示最近的收盘价。插件不知道各交易所的节假日，开盘半小时后行情还停在前一天的，就当今天休市，改成 30 分钟查一次。
- **断网时**：保留上次的行情，页面写「暂时取不到行情」，按 1、2、5、10 分钟重试，不弹错误。
- **数据来源**：行情和搜索来自东方财富（`push2.eastmoney.com`、`searchapi.eastmoney.com`），取不到时改用腾讯（`qt.gtimg.cn`）。都是这些网站自己网页用的公开接口，不登录、不带你的账号；每次刷新一个请求，取全部自选股。行情可能有延时，每只的行情时间在页面上悬停可以看到；仅供参考，不构成投资建议。
- 自选股和设置只保存在本机的插件数据目录里。

---

## English

`@fuyu/stock` · Official Fuyu plugin · Windows / macOS

Your stock watchlist on the island: A-share, Hong Kong and US quotes take turns on the collapsed bar, and the page lists them all. Nothing is fetched while the markets are closed.

### Where it shows up

- **Island page**: a "Stocks" page; each row shows the name, code, price, change and percentage change, with whether the market is trading and when it was last updated at the top.
- **Collapsed bar**: once you add stocks, they take turns showing their percentage change; click it to open the Stocks page. Turn it off in the settings, or hide it by right-clicking the bar.
- **Settings → Plugins → Stocks**: add, reorder and remove stocks, and every other setting.

### How to use it

1. Fresh installs start with a sample watchlist so quotes show up right away. Click the settings icon in the header or the "Customize" banner to search by code (`600519`, `00700`, `AAPL`), name or pinyin initials and manage up to 20 A-share, Hong Kong and US stocks, indexes and ETFs.
2. Use the arrows on each row to reorder: the collapsed bar goes through them in this order, and "First one only" shows the top one.
3. Expand the island and open the Stocks page for the full list; click Refresh to update right away. The plugin also has a "Refresh quotes now" command; give it a shortcut in the plugin's details under Settings → Plugins.

### Settings

**Watchlist**: search and add, move up and down, remove. While it is empty, Fuyu's Settings → Plugins marks the plugin as needing setup (newer Fuyu versions).

**Colors**

- **Up and down**: red up, green down (default) / green up, red down.

**Refresh**

- **While trading, refresh every**: 15 s / 30 s (default) / 1 min / 2 min / 5 min.
- **Refresh when the page opens**: on by default; skipped if it refreshed in the last 10 seconds.

**Collapsed bar**

- **Show the watchlist on the collapsed bar**: on by default, shown once you add stocks.
- **Show**: one after another (default) / first one only.
- **Switch every**: 3 / 5 (default) / 8 / 10 seconds.
- **Show the price too**: off by default.

### Cost and data sources

- **When it goes online**: only while a market on your watchlist is trading, at the interval above (A-shares 9:15–11:30 and 13:00–15:00 and Hong Kong 9:30–12:00 and 13:00–16:10 Beijing time; US 9:30–16:00 New York time, following daylight saving). With every market closed nothing is fetched until the next open; it fetches once at start-up and when the page opens, to show the latest close. The plugin doesn't know each exchange's holidays: if quotes are still from the previous day half an hour after the open, it treats the day as a holiday and checks every 30 minutes.
- **Offline**: it keeps the last quotes, says it can't get quotes right now, and retries after 1, 2, 5 and 10 minutes without popping up errors.
- **Data sources**: quotes and search come from Eastmoney (`push2.eastmoney.com`, `searchapi.eastmoney.com`), with Tencent (`qt.gtimg.cn`) as the fallback. These are the public endpoints the sites' own pages use: no sign-in and no account of yours. Each refresh is one request for the whole watchlist. Quotes may be delayed (hover a row on the page for its quote time) and are for reference only, not investment advice.
- Your watchlist and settings stay in the plugin's data folder on this computer.
