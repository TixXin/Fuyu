# @fuyu/system-monitor

系统监控（System monitor）— 浮屿第 3 版官方插件，支持 Windows 与 macOS。

- 使用 Node 原生 `node:os`（构建自动声明 `fuyu.nodeApis` 含 `os`）跨平台采样 CPU 总体与每核负载差值、内存已用/总计百分比及系统运行时间，无需外部依赖。
- 提供岛展开监控页（`island.page/v1`）、收起条紧凑指标（`island.collapsed/v1`）与采样间隔/收起条开关设置（`settings.section/v1`）；未打开监控页且未启用收起条显示时自动停止后台定时采样。
