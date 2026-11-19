# 天气 · Weather

`@fuyu/weather` · 浮屿官方插件 · Windows / macOS

在岛上看所选城市的实时天气、接下来几小时和未来 7 天的预报，快下雨时提醒你带伞。

## 装好后在哪里

- **岛的展开页**：多出「天气」一页，显示当前天气、体感温度、湿度、风速、未来数小时和未来 7 天。
- **收起条**：显示天气图标和温度。
- **设置 → 插件**：天气的设置，城市在这里填。

## 怎么用

1. 打开「设置 → 插件」，在「天气」里填城市（如「杭州」或 `London, UK`），点「保存设置」。
2. 展开岛切到「天气」页就能看到；想马上更新就点「立即刷新」。
3. 找不到城市时，试着加上省、州或国家名。

插件还带一个命令「立即刷新」，可以在「设置 → 插件」的插件详情里给它设快捷键。

## 设置

- **城市**：留空时插件不联网，什么都不查。
- **温度单位**：摄氏度 °C（默认）或华氏度 °F。
- **在收起条显示天气与温度**：默认开启。
- **一小时内即将下雨时提醒**：默认开启，开启时最多 30 分钟查一次。
- **刷新间隔（分钟）**：默认 30，可设 30–180。

## 它会用到什么

- **联网**：只访问 Open-Meteo 的两个地址：`geocoding-api.open-meteo.com`（把城市名换成经纬度）和 `api.open-meteo.com`（查天气）。发出去的只有城市名和经纬度。没填城市时不发任何请求。
- 在岛上弹出下雨提醒。
- 设置和最近一次的天气只保存在本机的插件数据目录里。

天气数据来自 [Open-Meteo](https://open-meteo.com/)。

---

## English

`@fuyu/weather` · Official Fuyu plugin · Windows / macOS

Current weather, the next few hours and a 7-day forecast for a city you choose, with a heads-up on the island when rain is coming.

### Where it shows up

- **Island page**: a new "Weather" page with the current conditions, feels-like temperature, humidity, wind, the next few hours and the next 7 days.
- **Collapsed bar**: a weather icon and the temperature.
- **Settings → Plugins**: the plugin's settings, where you enter the city.

### How to use it

1. Open Settings → Plugins, enter a city under "Weather" (for example `London, UK`) and click "Save settings".
2. Expand the island and open the "Weather" page; click "Refresh now" to update right away.
3. If the city isn't found, add the state, province or country.

The plugin also has a "Refresh now" command; give it a shortcut in the plugin's details under Settings → Plugins.

### Settings

- **City**: while empty, the plugin stays offline and looks nothing up.
- **Temperature unit**: Celsius °C (default) or Fahrenheit °F.
- **Show weather and temperature on collapsed bar**: on by default.
- **Alert on the island when rain is due within 1 hour**: on by default; while on, it checks at least every 30 minutes.
- **Refresh interval (minutes)**: 30 by default, 30–180.

### What it uses

- **Network**: only Open-Meteo's two addresses, `geocoding-api.open-meteo.com` (to turn the city name into coordinates) and `api.open-meteo.com` (for the weather). Only the city name and coordinates are sent. Nothing is requested until you enter a city.
- Shows rain alerts on the island.
- Settings and the latest weather are stored only in the plugin's data folder on your computer.

Weather data by [Open-Meteo](https://open-meteo.com/).

---

## 给开发者 · For developers

- 服务：`messages/v1`
- 插槽：`island.page/v1`、`island.collapsed/v1`、`settings.section/v1`
- 命令：`refresh`
- 联网清单：`api.open-meteo.com`、`geocoding-api.open-meteo.com`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
