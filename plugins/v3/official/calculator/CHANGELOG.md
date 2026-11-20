# 更新记录 · Changelog

## 1.1.0

- 计算页加了小键盘，光标在哪就插到哪；回车后结果留在输入框里接着算，`ans` 是上一个结果，↑ ↓ 翻历史，Esc 清空。设置里可以关掉小键盘。
- 计算页能直接换算：「5 km to mi」「100 美元换成人民币」「3 斤是多少公斤」「37℃ to ℉」。
- 百分号按计算器的习惯算：`100+10%` 是 110，`100-10%` 是 90。
- 各分类的输入框都能填算式，旁边显示算出的值；填错了框会变红。
- 换算结果旁边多了一个按钮，点它把这一行设为起点接着换算。
- 新增角度、压强、能量、功率四类单位。
- 日期页新增「年龄」：周岁、虚岁、农历生日、生肖、星座、已出生天数和离下次生日还有几天；日期框旁边加了「今天」。
- 左边的分类排成两列，一屏放下不用滚动；选中的分类改成浅底加强调色文字；滚动条改细，只在鼠标移上去时出现。
- 分类之间可以用方向键切换，切换后光标直接落在第一个输入框。

- The calc page has a keypad that types at the caret. Enter keeps the result in the box to go on with, `ans` is the last result, ↑ ↓ go through the history and Esc clears. The keypad can be turned off in settings.
- The calc page converts directly: "5 km to mi", "100 usd to cny", "3 jin in kg", "37℃ to ℉".
- Percent works like a desk calculator: `100+10%` is 110 and `100-10%` is 90.
- Every number field takes an expression and shows what it works out to; a field that can't be worked out turns red.
- Each conversion row has a button that makes that row the new starting value.
- New angle, pressure, energy and power categories.
- The date page has an Age mode: full years, East Asian age, lunar birthday, zodiac animal, star sign, days lived and days to the next birthday. Date fields have a Today button.
- The categories sit in two columns that fit without scrolling; the selected one has a light background and accent text; scrollbars are thin and only show on hover.
- Arrow keys move between categories, and the first field gets the focus after a switch.

## 1.0.0

第一版。

- 岛上新增「全能计算器」页面，左边选分类、右边算：算式、汇率、长度、面积、体积、重量、温度、速度、时间、数据大小、日期、进制、大写数字、个税、房贷、亲戚称呼、BMI。
- 汇率来自 open.er-api.com，默认每 6 小时最多取一次，离线时用上次取到的。
- 上次打开的分类、选的单位和填过的数都会记住。
- 设置里可以选显示哪些分类、打开时显示哪一类、有效数字、汇率更新间隔和五险一金估算比例。

First release.

- A new Calculator page on the island: pick a category on the left and work it out on the right — expressions, exchange rates, length, area, volume, weight, temperature, speed, time, data size, dates, number bases, Chinese numerals, income tax, mortgages, kinship terms and BMI.
- Exchange rates come from open.er-api.com, fetched at most every 6 hours by default; offline, the last rates are used.
- The last category, the units you picked and the numbers you typed are remembered.
- Settings choose which categories show, which one opens first, significant digits, how often rates update and the insurance estimate rate.
