# 更新记录 · Changelog

## 1.3.0

补齐城市搜索候选、多城市切换、极端天气提醒、可选空气质量与日出日落/紫外线，并打磨页面、面板组件和刘海表现。

- **城市候选选择与核对**：设置里搜索城市后列出「城市 · 省/州 · 国家」候选列表，点选即记住精确坐标，避免同名城市选错；已保存城市显示位置核对行。
- **多城市收藏与切换**：最多保存 8 个城市，可在设置里用星标指定主城市（用于收起条、面板组件和提醒），在岛上天气页顶部一键切换查看。
- **极端天气提醒**：新增极端天气开关（默认关），覆盖当前及未来 6 小时内的雷暴/冰雹、冻雨、暴雪、强降雨和 8 级以上大风，共用静默时段且同类型 6 小时内不重复提醒。
- **可选日出日落 / 紫外线与空气质量（AQI）**：岛页设置新增「日出日落与紫外线」和「空气质量（AQI）」（均默认关，关闭空气质量时不请求空气质量接口）。
- **页面、小组件与刘海打磨**：主卡片补充今日最高/最低温，未来 7 天加入温度区间条，天气图标增加适配深浅主题的语义点缀色；面板小组件新增 4×1 宽条布局、支持点击打开天气页或去设置、宽/大尺寸展示更完整；刘海两翼里「天气 + 温度」自动收敛为「图标 + 温度」。
- **底层与文档**：改走受控 `ctx.http.fetch` 并加入 12 秒请求超时；离线切换 °C / °F 就地换算不丢缓存；补齐 README 的面板小组件与新设置说明。老版本配置无损迁移。

City search candidates, multi-city switching, severe weather alerts, optional AQI and sunrise/sunset/UV, plus page, widget and notch polish.

- **City candidate search and verification**: search results list "City · Region · Country" candidates and save exact coordinates so same-name cities aren't mixed up; saved cities show a verification line.
- **Multi-city list and switching**: save up to 8 cities, star a primary city for the collapsed bar, panel widget and alerts, and switch cities from the top of the Weather page.
- **Severe weather alerts**: new opt-in alert (off by default) for thunderstorms/hail, freezing rain, heavy snow, heavy rain and Force 8+ winds now or in the next 6 hours, sharing quiet hours with a 6-hour per-hazard cool-down.
- **Optional sunrise/sunset, UV and AQI**: new toggles (off by default) for sunrise, sunset & UV index and US AQI; the air-quality endpoint is not called while AQI is off.
- **Page, widget and notch polish**: today's high/low in the hero, 7-day temperature range bars, theme-aware weather icon tints; panel widget adds 4×1 wide strip layout, click-to-open page or settings, and richer medium/large layouts; notch wings compact "Conditions + temperature" to icon + temperature.
- **Reliability and docs**: uses controlled `ctx.http.fetch` with a 12-second timeout; switching °C / °F converts cached temperatures locally even offline; README updated with panel widget and new settings. Existing configs migrate cleanly.

## 1.2.0

- 天气能放进岛上的自定义面板了：小、中、大三种尺寸，大尺寸带未来几天；也会出现在「娱乐」面板模板里。需要支持面板组件的浮屿，旧版本照常只有页面和收起条。

## 1.1.0

设置补完整，岛上默认更克制。

- 新装默认不在收起条显示天气、不发下雨提醒，都能在设置里打开。从 1.0.0 升级、填过城市的，这两项照原来的；没填过城市的按新装处理。
- 收起条打开后默认「图标 + 温度」，也可以选「天气 + 温度」或只显示温度；点收起条打开天气页（需要浮屿支持）。
- 设置改了马上生效，去掉了「保存设置」按钮；按「城市和单位 / 岛上页面 / 收起条 / 下雨提醒」分组。
- 新设置：风速单位（km/h、m/s、mph、级）、时间格式（跟随系统 / 24 小时 / 12 小时）、岛页显示项（体感、降水概率默认开，湿度、风速默认关）、逐小时显示 6 / 12 / 24 小时、刷新间隔改成下拉选择。
- 下雨提醒可以选提前多久（30 分钟、1 小时、2 小时），可以设静默时段。
- 天气页：页头写「更新于 14:30」，联网失败时写「显示的是上次的结果」；刷新改成页头的小按钮；逐小时和 7 天带天气图标，7 天写周几；降水概率高的标出来。
- 没填城市时，天气页上有「去设置」按钮（需要浮屿支持）。
- 命令「立即刷新天气」接上了，可以在插件详情里设快捷键。
- 中文城市名改用中文查，英文城市名用英文查，不再因为界面语言找不到城市；错误提示跟着界面语言。
- 岛的页头有了中英文标题；说明和截图更新。
- 图标换成和浮屿设置一致的风格：浅底色加同色线条。
- 还没选城市时，浮屿的插件页会标出「待设置」，并带一个去设置的按钮（需要较新的浮屿）。
- 市场页的截图换成了新的，多了一张收起条的。
- 补了搜索关键词，在市场里搜「气温」「下雨」也能找到。

Fuller settings; quieter on the island by default.

- New installs no longer show the weather on the collapsed bar or send rain alerts; both can be turned on in the settings. Upgrading from 1.0.0 with a city set keeps both as they were; without a city it is treated like a new install.
- When the collapsed bar is on it shows an icon and the temperature by default; you can choose conditions + temperature or the temperature only. Clicking it opens the Weather page (when Fuyu supports it).
- Settings apply right away; the Save button is gone. They are grouped into City and units, Island page, Collapsed bar and Rain alerts.
- New settings: wind speed unit (km/h, m/s, mph, Beaufort), time format (system, 24-hour, 12-hour), what the page shows (feels like and chance of rain on, humidity and wind off), 6, 12 or 24 hours in the hourly forecast, and the refresh interval is now a dropdown.
- Rain alerts can come 30 minutes, 1 hour or 2 hours ahead, and can be silenced during quiet hours.
- Weather page: the header says "Updated 14:30", or "Showing the last result" when the network fails; refresh is now a small button in the header; hours and days have weather icons, days show the weekday, and a high chance of rain is marked.
- Without a city, the Weather page has an "Open settings" button (when Fuyu supports it).
- The "Refresh weather now" command now works and can get a shortcut in the plugin's details.
- City names in Chinese are looked up in Chinese and others in English, so a city is no longer missed because of the interface language; error messages follow the interface language.
- The island header has a title in Chinese and English; the description and screenshots are updated.
- New icon in the same style as Fuyu's settings: a tinted tile with a line glyph in the same color.
- Until you pick a city, Fuyu's plugin page marks the plugin as "Needs setup" with a button that opens its settings (needs a newer Fuyu).
- New screenshots on the market page, with one more for the collapsed bar.
- Search keywords added, so "temperature" or "rain" find it in the market.

## 1.0.0

首个版本。

First release.
