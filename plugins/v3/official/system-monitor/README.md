# 系统监控 · System monitor

`@fuyu/system-monitor` · 浮屿官方插件 · Windows / macOS

在岛上看电脑忙不忙：CPU、GPU、内存、网速、电池，还有最占资源的程序。

## 装好后在哪里

- **岛的展开页**：页头多出「系统监控」。
- **收起条**：CPU 和内存的占用率，可以再加 CPU 温度、GPU 温度；偏高变黄、过高变红。
- **设置 → 插件 → 系统监控**：插件的设置。

## 页面上有什么

| 一块 | 内容 | Windows | Mac |
|---|---|---|---|
| CPU | 总占用的环、最近 5 分钟的曲线、每个核心一根柱，型号和核数 | 有，另有 CPU 温度（主板提供时） | 有，没有温度 |
| GPU | 占用的环和曲线 | 各引擎（3D、复制、解码、编码）；NVIDIA 显卡另有温度、显存、功耗 | 只有占用和已用显存（Apple 芯片） |
| 内存 | 已用 / 总量、环和进度条 | 有 | 有，和活动监视器的算法一致 |
| 网速 | 下载、上传和各自的曲线 | 有 | 有 |
| 电池 | 电量、是否在充电 | 有电池时 | 有电池时 |
| 程序 | 最占 CPU 或内存的程序，同名进程合并，可以切换排序 | 有图标，按钮打开任务管理器 | 显示首字，按钮打开活动监视器 |

读不到的块（比如台式机没有电池、Mac 没有 GPU 各引擎）不显示。面板宽于 600 像素时排两栏，程序列表在右边；更窄时排一栏，程序在下面。面板越高，程序显示得越多（最多 10 个）。鼠标停在曲线上能看到最近 5 分钟的平均和最高。

Mac 的程序 CPU 占用来自系统的 `ps`，是一段时间的平均，比 Windows 任务管理器的瞬时值平滑一点。

## 设置

- **排版**：自动（默认，窄时一栏）、一栏、两栏。
- **后台记录网速和 GPU 曲线**（只在 Windows 上出现）：默认关。插件一直每 5 秒记一次 CPU（Mac 上还有网速和 GPU），打开监控页就有最近 5 分钟的曲线，关页也不清空。Windows 上网速和 GPU 要靠 PowerShell 读，勾上这项后页关着时也记录；不勾时这两条曲线从打开页面开始画。
- **在收起条显示实时指标**：默认开。下面可以分别勾选 CPU（默认开）、内存（默认开）、CPU 温度、GPU 温度（后两项只在 Windows 上出现，GPU 温度要 NVIDIA 显卡）。
- **收起条刷新间隔**：1、2（默认）、5 或 10 秒。监控页开着时固定每秒刷新。

改完点「保存设置」。

收起条读数什么时候变色：

| 读数 | 偏高（黄） | 过高（红） |
|---|---|---|
| CPU 占用 | 70% | 90% |
| 内存占用 | 80% | 92% |
| CPU 温度 | 75°C | 90°C |
| GPU 温度 | 75°C | 87°C |

## 开销

- 监控页关着、收起条也没开时，插件每 5 秒记一次 CPU 给曲线用：Windows 上不运行任何程序（勾了后台记录网速和 GPU 时除外），Mac 上运行 `vm_stat`、`netstat`、`ioreg` 各一次。
- 只在收起条看 CPU 和内存：Windows 上不运行任何程序，Mac 上每次只运行一次 `vm_stat`。
- 监控页开着时每秒读一次；程序列表 3 秒、GPU 2 秒、电池 10 秒。
- Windows 上监控页开着、收起条勾了 CPU 温度、或开了后台记录曲线时，会常驻一个 PowerShell 进程（约 60–120 MB 内存）；都不需要时 60 秒后自己退出，停用插件时立刻结束。

## 用到的系统程序

插件读这些数据要运行系统自带的程序，所以安装时会显示「会运行程序」。程序和参数都写死在插件里，不经过命令行解释器，不带你输入的内容，不联网，也不需要管理员权限。

| 平台 | 程序 | 用来做什么 | 什么时候运行 |
|---|---|---|---|
| Windows | `powershell.exe`（系统自带） | 网速、电池、程序列表和图标、CPU 温度、GPU 各引擎，以及打开任务管理器 | 需要时常驻，空闲 60 秒退出 |
| Windows | `nvidia-smi`（NVIDIA 驱动自带，找不到就不用） | GPU 名称、占用、温度、显存、功耗 | 监控页开着或收起条勾了 GPU 温度时 2 秒一次；勾了后台记录时页关着 5 秒一次 |
| Mac | `vm_stat` | 内存已用 | 每次采样（页关着时 5 秒一次） |
| Mac | `netstat -ibn` | 网速 | 监控页开着每秒，关着 5 秒一次 |
| Mac | `ps` | 程序列表 | 监控页开着 3 秒一次 |
| Mac | `pmset -g batt` | 电池 | 监控页开着 10 秒一次 |
| Mac | `ioreg` | GPU 占用和已用显存 | 监控页开着 2 秒一次，关着 5 秒一次 |
| Mac | `open -b com.apple.ActivityMonitor` | 打开活动监视器 | 点按钮时 |

读到的数据只在岛上显示，不发到任何地方；设置只保存在本机的插件数据目录里。

---

## English

`@fuyu/system-monitor` · Official Fuyu plugin · Windows / macOS

See how busy your computer is, on the island: CPU, GPU, memory, network, battery, and the programs using the most.

### Where it shows up

- **Island page**: a "System monitor" button in the island header.
- **Collapsed bar**: CPU and memory usage, optionally CPU and GPU temperature; yellow when high, red when very high.
- **Settings → Plugins → System monitor**: the plugin's settings.

### What the page shows

| Part | What | Windows | Mac |
|---|---|---|---|
| CPU | Usage ring, 5-minute chart, one bar per core, model and core count | Yes, plus CPU temperature (when the board reports it) | Yes, no temperature |
| GPU | Usage ring and chart | Engines (3D, copy, decode, encode); NVIDIA cards also show temperature, VRAM and power | Usage and used graphics memory only (Apple silicon) |
| Memory | Used / total, ring and bar | Yes | Yes, counted the same way as Activity Monitor |
| Network | Download and upload with charts | Yes | Yes |
| Battery | Charge and whether it is charging | When there is a battery | When there is a battery |
| Programs | The busiest programs by CPU or memory, processes of the same name merged | With icons; the button opens Task Manager | First letter; the button opens Activity Monitor |

Parts it can't read (no battery on a desktop, no GPU engines on a Mac) are left out. Wider than 600 pixels, the page has two columns with the programs on the right; narrower, one column with the programs underneath. A taller panel shows more programs (up to 10). Hover over a chart for the 5-minute average and peak.

On Mac, a program's CPU comes from the system's `ps` and is averaged over a short time, so it is a little smoother than Task Manager's instant figure.

### Settings

- **Layout**: auto (default, one column when narrow), one column, two columns.
- **Record network and GPU charts in the background** (Windows only): off by default. The plugin always records CPU every 5 seconds (and network and GPU on Mac), so the page opens with the last 5 minutes and closing it keeps them. On Windows network and GPU are read through PowerShell; tick this to record them while the page is closed too. Unticked, those two charts start when the page opens.
- **Show live metrics on collapsed bar**: on by default, with CPU (on), memory (on), CPU temperature and GPU temperature (the last two on Windows only; GPU temperature needs an NVIDIA card).
- **Collapsed bar refresh interval**: 1, 2 (default), 5 or 10 seconds. The page always refreshes every second.

Click "Save settings" when you're done.

When the collapsed bar changes color:

| Reading | High (yellow) | Very high (red) |
|---|---|---|
| CPU usage | 70% | 90% |
| Memory usage | 80% | 92% |
| CPU temperature | 75°C | 90°C |
| GPU temperature | 75°C | 87°C |

### Cost

- With the page closed and nothing on the collapsed bar, the plugin records CPU every 5 seconds for the charts: no programs run on Windows (unless network and GPU background recording is on); on Mac, one `vm_stat`, `netstat` and `ioreg` each time.
- CPU and memory on the collapsed bar only: no programs run on Windows; on Mac, one `vm_stat` per refresh.
- With the page open: every second; programs every 3 seconds, GPU every 2, battery every 10.
- On Windows, one PowerShell process (about 60–120 MB of memory) stays running while the page is open, CPU temperature is on the collapsed bar, or background charts are on; it exits 60 seconds after none of them needs it, and right away when the plugin is turned off.

### System programs it runs

To read these figures the plugin runs programs that come with the system, so installing it shows "runs programs". The programs and their arguments are fixed in the plugin: no shell, nothing you type, no network access, no administrator rights.

| Platform | Program | What for | When |
|---|---|---|---|
| Windows | `powershell.exe` (built in) | Network, battery, programs and their icons, CPU temperature, GPU engines, and opening Task Manager | Kept running while needed, exits after 60 idle seconds |
| Windows | `nvidia-smi` (comes with the NVIDIA driver; skipped if missing) | GPU name, usage, temperature, VRAM and power | Every 2 seconds while the page is open or GPU temperature is on the collapsed bar; every 5 seconds with the page closed when background recording is on |
| Mac | `vm_stat` | Memory used | Every refresh (every 5 seconds with the page closed) |
| Mac | `netstat -ibn` | Network speed | Every second with the page open, every 5 seconds when closed |
| Mac | `ps` | Programs | Every 3 seconds with the page open |
| Mac | `pmset -g batt` | Battery | Every 10 seconds with the page open |
| Mac | `ioreg` | GPU usage and used graphics memory | Every 2 seconds with the page open, every 5 seconds when closed |
| Mac | `open -b com.apple.ActivityMonitor` | Open Activity Monitor | When you click the button |

What it reads is shown only on the island and sent nowhere; settings stay in the plugin's data folder on your computer.

---

## 给开发者 · For developers

- 插槽：`island.page/v1`、`island.collapsed/v1`（带 `opens`，点收起项打开页面）、`settings.section/v1`
- 宿主部分在 `src/host/`（取数、调度、曲线），页面在 `src/ui/`；接口和配置在 `src/protocol.ts`，文案在 `src/text.ts`。
- 用到的 Node 接口：`child_process`、`fs`、`os`、`path`，构建时自动在清单里声明。
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
