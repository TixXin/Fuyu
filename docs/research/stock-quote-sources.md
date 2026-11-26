# 免费股票行情数据源

> 日期：2026-11-26。问题：股票插件（#866）用哪个免费行情接口，能不能同时覆盖 A 股、港股、美股，频率限制和稳定性如何，刷新多快才不费电。范围：本机 curl 实测东方财富、腾讯、新浪、Yahoo Finance、Stooq 的公开网页接口；GitHub 代码搜索 `push2.eastmoney.com/api/qt/ulist`、`qt.gtimg.cn/q=` 看谁在用；要密钥的 Finnhub、Alpha Vantage 只看了文档里的额度。相关任务：E61。

## 结论

- **主源用东方财富**：行情 `push2.eastmoney.com/api/qt/ulist.np/get` 一次请求批量取多只，A 股、港股、美股、指数、ETF 都有，返回 UTF-8 JSON，不要 Referer、不要密钥；搜索 `searchapi.eastmoney.com/api/suggest/get` 能按代码、中文名、拼音找到股票并直接给出行情要用的 `QuoteID`（如 `1.600519`、`116.00700`、`105.AAPL`），添加自选股就靠它。
- **备用源用腾讯** `qt.gtimg.cn/q=`：同样三地都有、不用 Referer；返回 GBK，但插件只取数字字段（价格、涨跌、时间），名字用添加时存下的，所以不用解码 GBK。东方财富失败时整批切到腾讯。
- **不用**：新浪（没有 Referer 直接 403，宿主的 `http.fetch` 能不能带 Referer 没保证）；Yahoo（`v7/quote` 已要 crumb 返回 401，`v8/chart` 一次只能查一只）；Stooq（接口已下线）；Finnhub、Alpha Vantage（要用户注册密钥，Alpha Vantage 免费额度每天 25 次，不够刷新）。
- **风险**：两家都是网页自用的非公开接口，没有服务条款承诺，字段可能改。插件做成两源可切换、失败显示「暂时取不到行情」并保留上次价格，不弹错。
- **耗电**：一次请求 1 KB 左右，30 秒一次的网络和解析开销可以忽略；真正要省的是休市空转和收起条一直动画。做法：
  - 只在自选股所在市场开盘时按设定间隔刷新（默认 30 秒，可选 15 秒到 5 分钟），全部休市就停表，到最近一个开盘时间再醒来；
  - 节假日查不到日历，用「开盘时段里连续取到的行情时间戳停在前一天以前」判定今天休市，退到 30 分钟一次；
  - 断网或接口出错按 1、2、5、10 分钟退避，恢复后回到正常间隔；
  - 收起条「轮播」是每隔几秒换一只（淡入淡出一次），不做持续横向滚动的跑马灯，避免一直重绘；系统要求减少动画时直接切换。

## 详细

### 实测（2026-11-26 北京时间 09:45 左右，A 股、港股开盘中，美股已收盘）

| 数据源 | 地址 | A 股 | 港股 | 美股 | 指数 | 格式 | 限制 |
|---|---|---|---|---|---|---|---|
| 东方财富 | `push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=…&fields=…` | 有 | 有 | 有（需交易所编号 105/106/107） | 有（上证 `1.000001`、恒生科技 `124.HSTECH`、纳指 `100.NDX`） | UTF-8 JSON | 不要 Referer；连续 30 次请求全部 200 |
| 腾讯 | `qt.gtimg.cn/q=sh600519,hk00700,usAAPL` | 有 | 有 | 有 | 有（`sh000001`、`hkHSI`） | GBK，`~` 分隔文本 | 不要 Referer；连续 30 次全部 200 |
| 新浪 | `hq.sinajs.cn/list=sh600519,rt_hk00700,gb_aapl` | 有 | 有 | 有 | 有 | GBK，逗号分隔 | 不带 `Referer: https://finance.sina.com.cn` 返回 403 |
| Yahoo | `query1.finance.yahoo.com/v8/finance/chart/AAPL` | 用 `.SS/.SZ` 后缀 | `0700.HK` | 有 | 有 | JSON | `v7/finance/quote` 返回 401 Unauthorized；chart 一次一只 |
| Stooq | `stooq.com/q/l/?s=aapl.us&e=csv` | 无 | 无 | 有 | 有 | CSV | 返回「页面不存在」 |

东方财富字段（`fltt=2` 时是小数）：`f2` 现价、`f3` 涨跌幅 %、`f4` 涨跌额、`f12` 代码、`f13` 市场编号、`f14` 名称、`f18` 昨收、`f124` 行情时间（Unix 秒）。停牌时价格字段是 `"-"`，要按「没有价格」处理。

腾讯字段（`~` 分隔，下标从 0 起）：`3` 现价、`4` 昨收、`30` 时间（A 股 `yyyyMMddHHmmss`，港股 `yyyy/MM/dd HH:mm:ss`，美股 `yyyy-MM-dd HH:mm:ss`）、`31` 涨跌额、`32` 涨跌幅 %。

市场代码换算（东方财富 → 腾讯）：`1.xxxxxx` → `shxxxxxx`；`0.xxxxxx` → `szxxxxxx`（北交所 `0.8xxxxx/0.4xxxxx/0.92xxxx` → `bjxxxxxx`）；`116.xxxxx` → `hkxxxxx`；`105/106/107.XXX` → `usXXX`。指数类（`100.`、`124.` 等）腾讯代码不同，备用源不覆盖，标记为取不到。

### 延时

A 股盘中行情时间戳和本机时间差几秒，是实时快照。港股本次实测的时间戳也只差几秒，但港交所对免费网页行情一般要求延时 15 分钟，各家是否实时**未核实**；美股同理**未核实**。插件里每只显示行情时间，不标「实时」。

### 谁在用

- [akfamily/akshare](https://github.com/akfamily/akshare)（2026-11-26 查：约 2.3 万 star，当天还有推送）大量用 `push2.eastmoney.com` 的接口。
- [LeekHub/leek-fund](https://github.com/LeekHub/leek-fund)（VS Code「韭菜盒子」，约 3.9k star）用腾讯 `qt.gtimg.cn` 和新浪接口。
- 这两个接口被广泛使用多年，但都不是官方开放平台，按「可能随时变」对待。

### 刷新频率与耗电

- 单次行情请求约 0.5–1 KB（10 只左右），解析在宿主侧，CPU 时间可以忽略；主要成本是网络唤醒，所以休市停表比把间隔从 30 秒拉到 60 秒更省。
- A 股一天交易 4 小时、港股 5.5 小时、美股 6.5 小时（北京时间夜里）；只看 A 股的用户，30 秒间隔一天约 480 次请求，其余 20 小时零请求。
- 开盘时段（按交易所本地时区判断，含夏令时）：A 股 09:15–11:30、13:00–15:00；港股 09:30–12:00、13:00–16:10；美股 09:30–16:00（不含盘前盘后）。周末不刷新。

## 来源

- 东方财富行情、搜索接口：本机 curl 实测，见上表（2026-11-26）。
- 腾讯行情接口：本机 curl 实测；[leek-fund 的 tencentStock.ts](https://github.com/LeekHub/leek-fund/blob/master/src/shared/tencentStock.ts)。
- 新浪 Referer 限制：本机 curl 实测（不带 Referer 返回 Forbidden）。
- Yahoo `v7/quote` 401：本机 curl 实测，返回的说明链接 <https://bit.ly/yahoo-finance-api-feedback>。
- Alpha Vantage 免费额度：<https://www.alphavantage.co/support/#api-key>（每天 25 次，未在本次复查页面，**未核实**最新值）；Finnhub：<https://finnhub.io/pricing>（**未核实**）。
