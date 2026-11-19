# 系统监控 · System monitor

`@fuyu/system-monitor` · 浮屿官方插件 · Windows / macOS

在岛上看电脑的 CPU 和内存占用：总体的、每个核心的，还有开机多久了。

## 装好后在哪里

- **岛的展开页**：多出「系统监控」一页，显示处理器总占用、每核负载、内存占用、已运行时间、主机名和架构。
- **收起条**：显示 CPU 和内存的占用率。
- **设置 → 插件**：系统监控的设置。

## 怎么用

展开岛切到「系统监控」页就能看到，数字按采样间隔自动更新，也可以点「刷新」。

没打开监控页、收起条上也没开显示时，插件会自动停止采样，不在后台空转。

## 设置

- **采样间隔**：1、2（默认）、5 或 10 秒。
- **在收起条显示实时指标**：默认开启。
- **收起条显示 CPU 占用率**、**收起条显示内存占用率**：默认都开启。

改完点「保存设置」。

## 它会用到什么

- 读取本机的 CPU、内存、运行时间、主机名和架构信息，只在岛上显示，不发到任何地方。
- 设置只保存在本机的插件数据目录里。
- 不联网。

---

## English

`@fuyu/system-monitor` · Official Fuyu plugin · Windows / macOS

Watch your computer's CPU and memory use on the island: overall, per core, and how long the system has been up.

### Where it shows up

- **Island page**: a new "System monitor" page with total CPU, per-core load, memory use, uptime, host name and architecture.
- **Collapsed bar**: CPU and memory usage.
- **Settings → Plugins**: the plugin's settings.

### How to use it

Expand the island and open the "System monitor" page. The numbers update at the sampling interval; "Refresh" updates them right away.

When the page isn't open and nothing is shown on the collapsed bar, the plugin stops sampling instead of running in the background.

### Settings

- **Sampling interval**: 1, 2 (default), 5 or 10 seconds.
- **Show live metrics on collapsed bar**: on by default.
- **Show CPU usage on collapsed bar**, **Show memory usage on collapsed bar**: both on by default.

Click "Save settings" when you're done.

### What it uses

- Reads your computer's CPU, memory, uptime, host name and architecture, and shows them only on the island; nothing is sent anywhere.
- Settings are stored only in the plugin's data folder on your computer.
- No network access.

---

## 给开发者 · For developers

- 插槽：`island.page/v1`、`island.collapsed/v1`、`settings.section/v1`
- 用 Node 自带的 `node:os` 采样，构建时自动在清单里声明。
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
