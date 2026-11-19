# 更新记录 · Changelog

## 1.1.1

收起条按内容定宽，市场页补截图。

- 收起条不再固定占 120 像素宽，按城市名和时间的长度自动算，只显示时间时更窄。
- 市场页补上收起条的截图，岛上页面的截图换成了新的，更清楚。
- 图标换成和浮屿设置一致的风格：浅底色加同色线条。

The collapsed bar fits its content; new screenshots for the market.

- The collapsed bar no longer takes a fixed 120 pixels; its width follows the city name and time, so it is narrower when it shows only the time.
- The market page gets a screenshot of the collapsed bar, and a new, sharper one of the island page.
- New icon in the same style as Fuyu's settings: a tinted tile with a line glyph in the same color.

## 1.1.0

设置补完整，岛上只看时间。

- 岛上的页面去掉原来的添加表单和「上岛」「移除」按钮，只显示城市名和时间；默认不显示时区名和 UTC 偏移。页面底部「添加城市」可以搜索添加，鼠标移到一行上点 ✕ 删除。
- 新设置「在岛上显示世界时钟页面」：关掉后岛上没有这一页，收起条照常显示。
- 页面自己走时：显示秒时每秒跳，否则准点跳分钟（原来最多晚 15 秒）。
- 设置里管理城市：搜索添加（内置约 100 个常用城市，中英文名、三字码都能搜，也能搜系统支持的全部时区）、删除、拖动排序、改显示名、★ 设关注城市；可以在最上面加一行本机时间。
- 新的显示设置：时间格式（跟随系统 / 24 小时 / 12 小时）、显示秒、日期（只标明天昨天 / 总是显示 / 不显示）、时差（快 3 小时 / +3 / 不显示）、昼夜图标、时区名和 UTC 偏移。
- 收起条样式三选一，默认「城市名 + 时间」，也可以选三字码 + 时间或只有时间；点收起条打开世界时钟页（需要浮屿支持）。
- 岛的页头按钮有了中英文标题。
- 原来的城市、关注城市和「在收起条显示」照旧保留，新设置取默认值。

Fuller settings; the island page just shows the time.

- The island page drops the old add form and the Pin and Remove buttons: it shows city names and times, without time zone names or UTC offsets by default. "Add city" at the bottom searches and adds a city; hover a row and click ✕ to remove it.
- New setting "Show the World clock page on the island": turn it off to hide the page while the collapsed bar keeps working.
- The page keeps time on its own: every second when seconds are shown, otherwise right on the minute (it used to lag up to 15 seconds).
- Manage cities in the settings: search to add (about 100 built-in cities by Chinese or English name or code, plus every time zone the system knows), remove, drag to reorder, rename, and ★ the city for the collapsed bar; optionally a local time row at the top.
- New display settings: time format (system, 24-hour, 12-hour), seconds, date (only Tomorrow / Yesterday, always, or hidden), offset from local (3h ahead, +3, or hidden), day / night icon, and time zone name with UTC offset.
- Three collapsed bar styles: city + time (default), code + time, or time only; clicking it opens the World clock page (when Fuyu supports it).
- The island header button has a title in Chinese and English.
- Your cities, the starred city and the collapsed bar switch carry over; the new settings start at their defaults.

## 1.0.0

首个版本。

First release.
