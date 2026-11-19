# 更新记录 · Changelog

## 1.1.1

- 图标换成和浮屿设置一致的风格：浅底色加同色线条。
- 市场页补上截图：岛上页面和收起条。
- 说明改成一句话；怎么读数、用到哪些系统程序写在 README 里。
- 补了搜索关键词，在市场里搜「任务管理器」「性能」「网速」也能找到。

- New icon in the same style as Fuyu's settings: a tinted tile with a line glyph in the same color.
- The market page gets screenshots: the island page and the collapsed bar.
- The description is now one sentence; how the readings are taken and which system programs run are in the README.
- Search keywords added, so "task manager", "performance" or "network speed" find it in the market.

## 1.1.0

补回第 2 版系统监控的功能，Windows 和 Mac 都能用。

- 页面不再画成一块块卡片，直接画在岛上：CPU 环、5 分钟曲线和每个核心的柱；GPU 环、曲线和各引擎（Windows）；内存环；上下行网速和曲线；电池；已运行时间。
- 最占 CPU 或内存的程序：同名进程合并，可切换排序；Windows 上有程序图标，Mac 上显示首字；一键打开任务管理器（Mac 上是活动监视器）。面板高了多显示几个，最多 10 个。
- 面板窄于 600 像素时排成一栏，程序列表在下面；设置里可以固定一栏或两栏。
- 收起条最多四项：CPU、内存、CPU 温度、GPU 温度，偏高变黄、过高变红；点收起条打开监控页（需要浮屿支持）。
- 曲线在后台一直记录 CPU（Mac 上还有网速和 GPU），关掉监控页也不清空，再打开就有最近 5 分钟。
- 新设置：排版、收起条显示 CPU 温度和 GPU 温度、后台记录网速和 GPU 曲线（这三项只在 Windows 上出现）。原来的「采样间隔」改叫「收起条刷新间隔」，监控页开着时固定每秒刷新。
- Mac 上的内存读数改为和活动监视器一致（不再把缓存算作已用）。
- 为了读到这些数据，插件会运行系统自带的程序（见 README「用到的系统程序」），安装时会显示「会运行程序」。
- 岛的页头按钮有了中英文标题。

Brings back the features of the version 2 system monitor, on Windows and Mac.

- The page is drawn on the island instead of in cards: CPU ring, 5-minute chart and per-core bars; GPU ring, chart and engines (Windows); memory ring; download and upload speed with charts; battery; uptime.
- The busiest programs by CPU or memory, with processes of the same name merged; Windows shows program icons, Mac the first letter; a button opens Task Manager (Activity Monitor on Mac). A taller panel shows more of them, up to 10.
- Below 600 pixels wide the page goes to one column with the programs underneath; the layout can be fixed in the settings.
- The collapsed bar shows up to four readings: CPU, memory, CPU temperature and GPU temperature, yellow when high and red when very high; clicking it opens the page (when Fuyu supports it).
- The charts keep recording CPU in the background (and network and GPU on Mac), and closing the page no longer clears them, so reopening it shows the last 5 minutes.
- New settings: layout, CPU and GPU temperature on the collapsed bar, and recording network and GPU charts in the background (these three on Windows only). "Sampling interval" is now "Collapsed bar refresh interval": the page always refreshes every second.
- Memory on Mac now matches Activity Monitor (cached files no longer count as used).
- To read all this the plugin runs built-in system programs (see "System programs it runs" in the README); installing it shows "runs programs".
- The island header button has a title in Chinese and English.

## 1.0.0

第 3 版的第一个版本：CPU 总占用和每核负载、内存、运行时间，收起条显示 CPU 和内存。

First version for plugin platform 3: total and per-core CPU, memory and uptime, with CPU and memory on the collapsed bar.
