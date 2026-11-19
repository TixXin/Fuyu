# 天气 · Weather

`@fuyu/weather` · 浮屿官方插件 · Windows / macOS

在岛上看现在的天气和未来几天的预报，快下雨时提醒你带伞。

## 装好后在哪里

- **岛的展开页**：多出「天气」一页，显示现在的天气、逐小时预报和未来 7 天（带周几），页头写着「更新于 14:30」。
- **收起条**：默认不显示；在设置里打开后显示天气图标和温度，点一下打开天气页。
- **设置 → 插件 → 天气**：城市和全部设置。

## 怎么用

1. 打开「设置 → 插件 → 天气」，填城市（如「杭州」或 `London, UK`），按回车或点别处就生效。没填城市时，天气页上有「去设置」按钮直接跳过去。
2. 展开岛切到「天气」页；想马上更新点右上角的刷新按钮。
3. 找不到城市时，加上省、州或国家名，例如「Springfield, Illinois」。
4. 联网失败时，页头写「显示的是上次的结果」，下面写原因，内容保留上一次查到的。

插件带一个命令「立即刷新天气」，可以在「设置 → 插件」的插件详情里给它设快捷键。

## 设置

改了马上生效，不用保存。

**城市和单位**

- **城市**：留空时插件不联网。
- **温度单位**：°C（默认）/ °F。
- **风速单位**：km/h（默认）/ m/s / mph / 级（蒲福风级）。
- **时间格式**：跟随系统（默认）/ 24 小时 / 12 小时；用在逐小时预报、「更新于」和下雨提醒里。
- **刷新间隔**：30 分钟（默认）/ 60 / 90 / 120 / 180 分钟。打开下雨提醒时至少每 30 分钟刷新一次。

**岛上页面**

- **显示项**：体感温度（开）、降水概率（开）、湿度（关）、风速（关）。降水概率打开时，逐小时和 7 天里概率到 30% 的也标出来。
- **逐小时显示**：6 小时（默认）/ 12 / 24 小时；多于 6 小时时左右滑动。

**收起条**

- **在收起条显示天气**：新装默认关。
- **样式**：图标 + 温度（默认）/ 天气 + 温度 / 只显示温度。

**下雨提醒**

- **快下雨时在岛上提醒**：新装默认关。
- **提前多久**：30 分钟内 / 1 小时内（默认）/ 2 小时内。
- **静默时段不提醒**：默认关；打开后默认 22:00 到 07:00 不提醒，时间可以改。
- 提醒过一次后 3 小时内不再提醒；正在下雨时不提醒。

从 1.0.0 升级的：填过城市的，原来收起条和下雨提醒是开是关都照旧；没填过城市的按新装处理（两项都关）。新加的设置取默认值。

## 开销和数据来源

- **联网**：只访问 Open-Meteo 的两个地址：`geocoding-api.open-meteo.com`（把城市名换成经纬度，换一次就记下来）和 `api.open-meteo.com`（查天气）。发出去的只有城市名和经纬度。没填城市时不发任何请求。
- 按刷新间隔每次查一次天气；打开岛上的天气页不会额外联网，点刷新才会。
- 设置和最近一次的天气只保存在本机的插件数据目录里。
- 下雨提醒在岛上弹出，并记入提醒列表。

天气数据来自 [Open-Meteo](https://open-meteo.com/)。

---

## English

`@fuyu/weather` · Official Fuyu plugin · Windows / macOS

Current weather and the next few days' forecast on the island, with a heads-up before it rains.

### Where it shows up

- **Island page**: a new "Weather" page with the current conditions, an hourly forecast and the next 7 days by weekday; the header says "Updated 14:30".
- **Collapsed bar**: off by default; turn it on in the settings to show a weather icon and the temperature. Clicking it opens the Weather page.
- **Settings → Plugins → Weather**: the city and every setting.

### How to use it

1. Open Settings → Plugins → Weather and enter a city (for example `London, UK`); it takes effect when you press Enter or click elsewhere. Without a city, the Weather page has an "Open settings" button that takes you there.
2. Expand the island and open the "Weather" page; click the refresh button in the top right to update right away.
3. If the city isn't found, add the state, province or country, like "Springfield, Illinois".
4. When the network fails, the header says "Showing the last result" with the reason below, and the last forecast stays on the page.

The plugin has a "Refresh weather now" command; give it a shortcut in the plugin's details under Settings → Plugins.

### Settings

Changes apply right away; there is no Save button.

**City and units**

- **City**: while empty, the plugin stays offline.
- **Temperature**: °C (default) / °F.
- **Wind speed**: km/h (default) / m/s / mph / Beaufort.
- **Time format**: System (default) / 24-hour / 12-hour; used for the hourly forecast, "Updated" and rain alerts.
- **Refresh every**: 30 min (default) / 60 / 90 / 120 / 180 min. With rain alerts on, it refreshes at least every 30 minutes.

**Island page**

- **What to show**: feels like (on), chance of rain (on), humidity (off), wind speed (off). With chance of rain on, hours and days at 30% or more are marked too.
- **Hourly forecast**: 6 hours (default) / 12 / 24 hours; more than 6 scrolls sideways.

**Collapsed bar**

- **Show the weather on the collapsed bar**: off on new installs.
- **Style**: icon + temperature (default) / conditions + temperature / temperature only.

**Rain alerts**

- **Alert on the island before it rains**: off on new installs.
- **How far ahead**: within 30 min / within 1 h (default) / within 2 h.
- **No alerts during quiet hours**: off by default; when on, no alerts from 22:00 to 07:00, and you can change the times.
- After an alert it stays quiet for 3 hours, and it doesn't alert while it is already raining.

Upgrading from 1.0.0: if you had entered a city, the collapsed bar and rain alerts stay as they were; if not, they are treated like a new install (both off). New settings start at their defaults.

### Cost and data source

- **Network**: only Open-Meteo's two addresses, `geocoding-api.open-meteo.com` (to turn the city name into coordinates, looked up once and remembered) and `api.open-meteo.com` (for the weather). Only the city name and coordinates are sent. Nothing is requested until you enter a city.
- It checks the weather once per refresh interval; opening the Weather page doesn't add requests, the refresh button does.
- Settings and the latest weather are stored only in the plugin's data folder on your computer.
- Rain alerts show on the island and go into the notification list.

Weather data by [Open-Meteo](https://open-meteo.com/).

---

## 给开发者 · For developers

- 服务：`commands`、`messages/v1`
- 插槽：`island.page/v1`、`island.collapsed/v1`、`settings.section/v1`
- 命令：`refresh`
- 联网清单：`api.open-meteo.com`、`geocoding-api.open-meteo.com`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
