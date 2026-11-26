# 更新记录 · Changelog

## 1.2.0

- 重做宽岛布局为「左图右表」分时看板（对标 Apple Stocks 与桌面迷你看盘，适配窄屏自动堆叠）：左侧展示选中股票的大号现价、实时分时折线渐变面积图、昨收虚线基准线与今开/最高/最低/昨收指标，右侧展示高密度自选列表与行内微型走势线，点击任意一只实时切换左侧分时。
- 示例模式提示收进右侧紧凑顶栏小胶囊，不再占用整行高度，一屏可直接看全 5 只以上自选股。
- 分时数据双源接入腾讯（`web.ifzq.gtimg.cn`）与东方财富（`push2.eastmoney.com`），覆盖 A 股、港股、美股与指数。

- Redesigned the wide island layout into a Master-Detail intraday dashboard (with automatic narrow-width stacking): a focused left card with hero price, real intraday area sparkline, dashed previous-close baseline, and Open/High/Low/Prev metrics, paired with a dense right watchlist featuring inline mini sparklines; click any stock to inspect its intraday curve.
- Compacted the sample watchlist hint into an inline header pill so 5+ stocks fit cleanly in one viewport.
- Added dual-source intraday trends from Tencent (`web.ifzq.gtimg.cn`) and Eastmoney (`push2.eastmoney.com`) across A-share, HK, US stocks, and indexes.

## 1.1.0

- 首次安装自带一组示例自选股（上证指数、贵州茅台、腾讯控股、苹果、英伟达），装完即可看行情；列表为空时也支持一键载入示例。
- 岛页顶部增加快捷设置入口，示例模式下顶部展示「去自定义」横条，一键直达设置修改自选股。
- 重新设计岛页 UI：增加涨跌计数摘要、市场标签（SH / SZ / HK / US）、左侧涨跌指示条与更清晰的涨跌幅徽章，超长列表支持滚动。

- Fresh installs start with a sample watchlist (SSE Composite, Moutai, Tencent, Apple, NVIDIA); empty state also offers one-click sample restore.
- Added a quick settings button in the island header plus a "Customize" sample bar that jumps straight to settings.
- Redesigned the island UI with an up/down tally, market tags (SH / SZ / HK / US), left trend accent bars, sharper percentage pills, and scrollable overflow.

## 1.0.0

第一版。

- 设置里按代码、名称或拼音首字母搜索添加自选股，支持 A 股、港股、美股、指数和 ETF，最多 20 只；可以调整顺序、删除。
- 岛上「自选股」页列出每只的现价、涨跌额和涨跌幅，标出交易中 / 已休市和更新时间；悬停看行情时间。
- 收起条显示自选股（默认开，有自选股才出现）：轮流显示（每只停留 3 / 5 / 8 / 10 秒）或只显示第一只，可以同时显示现价；点一下打开自选股页。
- 涨跌颜色可选红涨绿跌（默认）或绿涨红跌。
- 只在自选股所在市场的交易时段刷新（默认 30 秒一次，可选 15 秒到 5 分钟），全部休市时不联网，到下一个开盘时间再醒；节假日按行情时间判断休市后改成 30 分钟查一次；断网时按 1、2、5、10 分钟退避，并保留上次的行情。
- 行情来自东方财富，取不到时改用腾讯。

---

## 1.0.0 (English)

First release.

- Search by code, name or pinyin initials in the settings to add stocks: A-shares, Hong Kong and US stocks, indexes and ETFs, up to 20. Reorder or remove them.
- The Stocks page on the island lists each one's price, change and percentage change, with whether the market is trading or closed and when it was last updated; hover for the quote time.
- The collapsed bar shows the watchlist (on by default, only once something is added): one after another (3 / 5 / 8 / 10 seconds each) or just the first, optionally with the price. Click it to open the Stocks page.
- Up and down colors: red up, green down (default) or green up, red down.
- Quotes refresh only while a market on the watchlist is trading (every 30 seconds by default, 15 seconds to 5 minutes). With every market closed nothing is fetched until the next open; on what looks like a holiday it checks every 30 minutes; offline it backs off to 1, 2, 5 and 10 minutes and keeps the last quotes.
- Quotes come from Eastmoney, with Tencent as the fallback.
