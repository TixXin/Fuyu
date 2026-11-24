# 天气 · Weather

`@fuyu/weather` · 浮屿官方插件 · Windows / macOS

在岛上看现在的天气和未来几天的预报，快下雨时提醒你带伞。

## 装好后在哪里

- **岛的展开页**：多出「天气」一页，显示现在的天气、今日最高/最低温、逐小时预报和带温度范围条的未来 7 天（带周几），页头写着「更新于 14:30」；收藏多个城市时顶部可以一键切换。
- **自定义面板小组件**：支持小（1×1）、中（2×1）、大（2×2）、宽条（4×1）和收起条五种形态，展示主城市天气；点组件直接打开天气页，还没选城市时点一下直接去设置。
- **收起条**：默认不显示；在设置里打开后显示主城市的天气图标和温度，点一下打开天气页。在 Mac 刘海两翼里，「天气 + 温度」会自动收敛为「图标 + 温度」以便放进两翼。
- **设置 → 插件 → 天气**：搜索添加城市和全部设置。

## 怎么用

1. 打开「设置 → 插件 → 天气」，输入城市名（如「杭州」或 `Springfield, Illinois`）搜索，从候选列表里点选对应的城市即可添加；不用怕同名城市选错。没选城市时，天气页上有「去设置」按钮直接跳过去。
2. 最多可以保存 8 个城市；点星标可以把某个城市设为主城市（用于收起条、面板组件和天气提醒）。
3. 展开岛切到「天气」页；保存了多个城市时在顶部标签栏一键切换，想马上更新点右上角的刷新按钮。
4. 联网失败时，页头写「显示的是上次的结果」，下面写原因，内容保留上一次查到的；离线时切换 °C / °F 也会就地换算保留已有预报。

插件带一个命令「立即刷新天气」，可以在「设置 → 插件」的插件详情里给它设快捷键。

## 设置

改了马上生效，不用保存。

**城市和单位**

- **添加城市**：没有城市时不联网；还没选时，浮屿「设置 → 插件」里这个插件会标出「待设置」（需要较新的浮屿）。搜索后从「城市 · 省/州 · 国家」候选里点选并记住精确坐标，已保存列表会显示核对位置。
- **温度单位**：°C（默认）/ °F。
- **风速单位**：km/h（默认）/ m/s / mph / 级（蒲福风级）。
- **时间格式**：跟随系统（默认）/ 24 小时 / 12 小时；用在逐小时预报、日出日落、「更新于」和天气提醒里。
- **刷新间隔**：30 分钟（默认）/ 60 / 90 / 120 / 180 分钟。打开下雨或极端天气提醒时，主城市至少每 30 分钟刷新一次。

**岛上页面**

- **显示项**：体感温度（开）、降水概率（开）、湿度（关）、风速（关）、日出日落与紫外线（关）、空气质量 AQI（关）。降水概率打开时，逐小时和 7 天里概率到 30% 的也标出来；空气质量使用美标 US AQI，关闭时不请求空气质量接口。
- **逐小时显示**：6 小时（默认）/ 12 / 24 小时；多于 6 小时时左右滑动。

**收起条**

- **在收起条显示天气**：新装默认关。
- **样式**：图标 + 温度（默认）/ 天气 + 温度 / 只显示温度。

**天气提醒**

- **快下雨时在岛上提醒**：新装默认关。
- **下雨提前多久**：30 分钟内 / 1 小时内（默认）/ 2 小时内。提醒过一次后 3 小时内不再提醒；正在下雨时不提醒。
- **极端天气时在岛上提醒**：新装默认关。覆盖当前及未来 6 小时内的雷暴/冰雹、冻雨、暴雪、强降雨和 8 级以上大风，同类型 6 小时内不重复提醒。
- **静默时段不提醒**：默认关；打开任一提醒后可见，默认 22:00 到 07:00 不提醒，时间可以改。

从旧版本升级的：已有城市会自动迁入城市列表并保留原设置；新增的日出日落/紫外线、空气质量和极端天气提醒默认关。从 1.0.0 升级且填过城市的，原来收起条和下雨提醒是开是关都照旧；没填过城市的按新装处理（两项都关）。

## 开销和数据来源

- **联网**：只访问 Open-Meteo 的接口：`geocoding-api.open-meteo.com`（搜索城市候选）、`api.open-meteo.com`（查天气预报），以及在用户显式打开「空气质量（AQI）」时才访问 `air-quality-api.open-meteo.com`。发出去的只有城市搜索词和经纬度。没有城市时不发任何请求。
- 按刷新间隔只定时刷新主城市；其他收藏城市在切换查看或点刷新时按需更新。
- 设置和最近一次的天气只保存在本机的插件数据目录里。
- 下雨与极端天气提醒在岛上弹出，并记入提醒列表。

天气与空气质量数据来自 [Open-Meteo](https://open-meteo.com/)。

---

## English

`@fuyu/weather` · Official Fuyu plugin · Windows / macOS

Current weather and the next few days' forecast on the island, with a heads-up before it rains.

### Where it shows up

- **Island page**: a "Weather" page with current conditions, today's high/low, an hourly forecast and a 7-day forecast with temperature range bars and weekdays; the header says "Updated 14:30". With multiple saved cities, a compact bar at the top lets you switch between them.
- **Custom panel widget**: supports small (1×1), medium (2×1), large (2×2), wide (4×1) and collapsed-bar sizes for your primary city. Clicking it opens the Weather page (or opens Settings when no city is set yet).
- **Collapsed bar**: off by default; turn it on in settings to show your primary city's weather icon and temperature. Clicking it opens the Weather page. Inside a Mac notch wing, "Conditions + temperature" automatically compacts to icon + temperature so it fits cleanly.
- **Settings → Plugins → Weather**: city search, saved cities and every setting.

### How to use it

1. Open Settings → Plugins → Weather, search for a city (for example `London` or `Springfield, Illinois`), and pick the exact match from the candidate list so same-name cities aren't mixed up. Without a city, the Weather page has an "Open settings" button that takes you there.
2. You can save up to 8 cities; click the star on any city to make it the primary city (used for the collapsed bar, panel widget and weather alerts).
3. Expand the island and open the "Weather" page; switch cities at the top or click the refresh button in the top right to update right away.
4. When the network fails, the header says "Showing the last result" with the reason below, and the last forecast stays on the page. Switching between °C and °F converts cached temperatures locally even offline.

The plugin has a "Refresh weather now" command; give it a shortcut in the plugin's details under Settings → Plugins.

### Settings

Changes apply right away; there is no Save button.

**Cities and units**

- **Add city**: stays offline until you pick a city. Until then, Fuyu marks the plugin as "Needs setup" under Settings → Plugins (needs a newer Fuyu). Picking a search candidate saves its exact coordinates and shows a verification line (region and country).
- **Temperature**: °C (default) / °F.
- **Wind speed**: km/h (default) / m/s / mph / Beaufort.
- **Time format**: System (default) / 24-hour / 12-hour; used for the hourly forecast, sunrise/sunset, "Updated" and weather alerts.
- **Refresh every**: 30 min (default) / 60 / 90 / 120 / 180 min. With rain or severe weather alerts on, the primary city refreshes at least every 30 minutes.

**Island page**

- **What to show**: feels like (on), chance of rain (on), humidity (off), wind speed (off), sunrise/sunset and UV (off), air quality / US AQI (off). With chance of rain on, hours and days at 30% or more are marked too. Air quality is fetched only when turned on.
- **Hourly forecast**: 6 hours (default) / 12 / 24 hours; more than 6 scrolls sideways.

**Collapsed bar**

- **Show the weather on the collapsed bar**: off on new installs.
- **Style**: icon + temperature (default) / conditions + temperature / temperature only.

**Weather alerts**

- **Alert on the island before it rains**: off on new installs.
- **Rain alert lead time**: within 30 min / within 1 h (default) / within 2 h. After an alert it stays quiet for 3 hours, and it doesn't alert while it is already raining.
- **Alert on the island for severe weather**: off on new installs. Covers thunderstorms/hail, freezing rain, heavy snow, heavy rain and Force 8+ winds now or in the next 6 hours, with a 6-hour cool-down per hazard.
- **No alerts during quiet hours**: off by default; available when any alert is on, defaults to 22:00–07:00 and can be customized.

Upgrading from older versions: your saved city is migrated into the city list with existing settings kept; new options (sunrise/sunset & UV, AQI, severe weather alerts) start off. Upgrading from 1.0.0 with a city set keeps the collapsed bar and rain alerts as they were; without a city it is treated like a new install (both off).

### Cost and data source

- **Network**: only Open-Meteo endpoints — `geocoding-api.open-meteo.com` (city search), `api.open-meteo.com` (forecasts), and `air-quality-api.open-meteo.com` only when "Air quality (AQI)" is turned on. Only city queries and coordinates are sent. Nothing is requested when no city is saved.
- Scheduled refreshes run only for the primary city; other saved cities update on demand when viewed or refreshed.
- Settings and cached weather are stored only in the plugin's data folder on your computer.
- Rain and severe weather alerts show on the island and go into the notification list.

Weather and air quality data by [Open-Meteo](https://open-meteo.com/).

---

## 给开发者 · For developers

- 服务：`commands`、`messages/v1`（必需），`http`、`settings`（可选）
- 插槽：`island.page/v1`、`island.collapsed/v1`、`island.widget/v1`、`settings.section/v1`
- 命令：`refresh`
- 联网清单：`api.open-meteo.com`、`geocoding-api.open-meteo.com`、`air-quality-api.open-meteo.com`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
