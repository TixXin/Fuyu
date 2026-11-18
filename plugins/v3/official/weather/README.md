# @fuyu/weather

天气（Weather）— 浮屿第 3 版官方插件，支持 Windows 与 macOS。

- 显式声明 `fuyu.network: ["api.open-meteo.com", "geocoding-api.open-meteo.com"]`，使用 Open-Meteo 接口查询实时天气、逐小时预报与未来 7 天预报。
- 默认不填写城市且**不发起任何网络请求**；在设置分节填写城市后启用联网刷新，支持在岛展开页（`island.page/v1`）与收起条（`island.collapsed/v1`）展示，并在即将下雨时经 `messages/v1.notify` 提醒。
