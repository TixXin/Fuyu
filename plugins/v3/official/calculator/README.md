# 全能计算器 · Calculator

[中文](#中文) · [English](#english)

## 中文

### 怎么用

展开岛屿，点页头的计算器按钮。左边选分类、右边算；结果点一下就复制。上次的分类、选的单位和填过的数都会记住。

| 分类 | 能算什么 |
|---|---|
| 计算 | 四则、括号、乘方 `^`、百分号、阶乘 `!`，`sqrt`、`sin`（角度）、`ln`、`log` 等函数；回车记进历史 |
| 汇率 | 30 种常用货币互换 |
| 长度、面积、体积、重量、温度、速度、时间、数据 | 公制、市制（里、亩、斤、两）、英美制，一次列出全部单位 |
| 日期 | 两个日期相隔几天、几周、几个月，工作日数；某天加减若干天、工作日或月 |
| 进制 | 2–36 进制互转，大数不丢精度 |
| 大写数字 | 人民币大写金额、中文大写 / 小写数字 |
| 个税 | 中国大陆累计预扣法：逐月个税、全年合计、年终奖单独计税和并入综合所得取低 |
| 房贷 | 商贷、公积金、组合贷，等额本息和等额本金对照 |
| 称呼 | 点「爸爸、妈妈、哥哥……」拼出关系，算出怎么称呼，也算出对方怎么叫你 |
| BMI | 中国标准或 WHO 标准，给出分档和健康体重范围 |

命令「打开计算器」可以在浮屿的快捷键设置里绑一个键。

### 设置

在浮屿设置的插件页，点「全能计算器」的齿轮。

| 设置 | 默认 |
|---|---|
| 显示哪些分类 | 全部 |
| 打开页面时显示 | 上次用的分类 |
| 有效数字 | 10 位 |
| 汇率最多每隔多久更新 | 6 小时 |
| 五险一金估算比例（个税页留空时用） | 22.5% |

### 开销和数据来源

- 只有打开汇率分类时才联网，从 [open.er-api.com](https://open.er-api.com) 取一次以美元为基准的汇率，按设置的间隔缓存在插件数据目录；取不到时用上次的，页面上写明更新时间。汇率仅供参考。
- 其他计算都在本机完成。个税按 2019 年起的综合所得税率表和每月 5000 元减除费用，房贷利率的默认值可以改，结果仅供参考。

## English

### How to use

Expand the island and click the calculator button in the header. Pick a category on the left and work it out on the right; click a result to copy it. The last category, the units you picked and the numbers you typed are remembered.

Expressions (with `^`, `%`, `!`, `sqrt`, `sin` in degrees, `ln`, `log` and more; Enter keeps one in the history), exchange rates for 30 currencies, length, area, volume, weight, temperature, speed, time and data-size conversion (metric, Chinese and imperial units), days between dates and date arithmetic, number bases 2–36, Chinese numerals and RMB amounts in words, mainland China income tax (cumulative withholding, with the cheaper way to tax an annual bonus), mortgages (equal payments vs equal principal, commercial, housing fund or both), Chinese kinship terms both ways, and BMI by the Chinese or WHO bands.

The "Open Calculator" command can be bound to a key in Fuyu's shortcut settings.

### Settings

On the plugin page in Fuyu's settings, click the gear next to Calculator.

| Setting | Default |
|---|---|
| Categories shown | All |
| Show when the page opens | The category used last |
| Significant digits | 10 |
| Update rates at most every | 6 hours |
| Insurance & housing fund estimate (when left blank on the tax page) | 22.5% |

### Cost and data sources

- It only goes online when you open the Currency category: it fetches US-dollar based rates from [open.er-api.com](https://open.er-api.com) and keeps them in the plugin's data folder for the interval you set. When it can't fetch, it uses the last rates and shows when they are from. Rates are for reference only.
- Everything else is worked out on your computer. Income tax uses the 2019 comprehensive income brackets and the ¥5,000 monthly deduction; mortgage rates have editable defaults. Results are for reference only.
