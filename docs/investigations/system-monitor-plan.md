# 系统监控补回第 2 版的功能：计划

组长：`[任务] 系统监控补回第 2 版功能`（总控 `Fuyu-[总控] 插件开发`）。2026-11-19 起草，等用户点头后派会话。

## 起因和范围

用户装了官方插件「系统监控」（`plugins/v3/official/system-monitor`，`@fuyu/system-monitor` 1.0.0），觉得比第 2 版差很多。用户 2026-11-19 定：**全补，Mac 尽力**。

- 第 3 版现在：只用 `node:os`，有处理器总占用、每核负载、内存、运行时间、主机名，页面是一块块卡片；收起条只有文字「CPU 86% · 内存 60%」。
- 第 2 版（`git show 59ac01a0^:plugins/examples/dev.focusd.system-monitor/`，只支持 Windows，常驻一个 PowerShell 取数）多出：CPU 环和 5 分钟曲线、CPU 温度；GPU 占用、温度、显存、功耗和各引擎；内存环；上下行网速和曲线；电池；最占 CPU 或内存的程序（同名合并、可切排序、打开任务管理器）；一栏或两栏排版；后台记录曲线；收起条四项读数偏高变黄变红；页面不画卡片。

预览页（第 2 版和计划的第 3 版并排）：[system-monitor-preview.html](system-monitor-preview.html)。

## 每项功能在两个平台上怎么做

全部在插件的宿主部分（Node）取数，页面只画。没有需要管理员 / root 的，不联网。

| 功能 | Windows | Mac | 结论 |
|---|---|---|---|
| CPU 总占用、每核、型号 | `node:os`（现有） | `node:os`（现有） | 两边都有 |
| CPU 环 + 5 分钟曲线 | 宿主环形缓冲，页开着每秒一点，最多 300 点 | 同 | 两边都有 |
| 内存环 | `node:os` 的总量和可用 | `vm_stat` 算「已用 = 应用 + 联动 + 压缩」（和活动监视器一致）；`os.freemem()` 在 Mac 上把缓存算作已用，读数偏高，顺手修 | 两边都有 |
| 上下行网速 + 曲线 | PowerShell 助手里 .NET `NetworkInterface.GetIPStatistics()`（第 2 版的做法），两次相减 | `netstat -ib`，按网卡取 `<Link#>` 行的 Ibytes/Obytes 求和，去掉 `lo0` | 两边都有 |
| 电池 | 助手里 `Win32_Battery`，10 秒一次 | `pmset -g batt`，10 秒一次 | 两边都有；台式机没有电池就不显示这一行 |
| 最占资源的程序 | 助手里 `Win32_Process` 一次查完，同名合并，两次 CPU 时间相减；图标用 `System.Drawing` 取（第 2 版做法），只取列表里显示的 | `ps -Axo pid=,pcpu=,rss=,comm=`，按程序名合并，`pcpu` 除以核数换成占整机的比例；没有图标，显示首字 | 两边都有；Mac 的 `pcpu` 是内核给的衰减平均，比任务管理器的瞬时值平滑一点，文档写明 |
| 打开任务管理器 / 活动监视器 | `taskmgr.exe` | `open -b com.apple.ActivityMonitor` | 两边都有，按钮文字按平台 |
| CPU 温度 | 助手里 ACPI 温度区 `Win32_PerfFormattedData_Counters_ThermalZoneInformation`，取最热的；很多台式机没有，显示 - | **不做**：要 root（`powermetrics`）或私有 SMC 接口 | 只 Windows；Mac 上设置里不出这一项 |
| GPU 占用和各引擎 | 助手里 Windows 自带的 GPU 引擎计数器（任何显卡，第 2 版 `gpu-engines.ps1` 的做法），2 秒一次 | Apple 芯片：`ioreg -r -d 1 -w 0 -c IOAccelerator` 的 `PerformanceStatistics` 里 `Device Utilization %` 和 `In use system memory`；Intel Mac 上有就用，没有就隐藏 GPU 区 | Windows 全做；Mac 只有占用（和 Apple 芯片的已用显存），没有各引擎 |
| GPU 温度、显存、功耗 | `nvidia-smi --query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total,power.draw --format=csv,noheader,nounits`，2 秒一次；不是 NVIDIA 显卡就只有上一行 | **不做**：要 root | 只 Windows 的 NVIDIA |
| 一栏 / 两栏 | 页面用 `ResizeObserver` 量自己的宽度，不到 600 像素一栏、程序列表在下面；设置里可固定 | 同 | 两边都有（平台已支持，见「平台能力」第 1 条） |
| 后台记录曲线 | 勾了以后页面关着每 5 秒记一次 CPU、GPU、网速，打开页时带着最近几分钟 | 同 | 两边都有，默认不勾 |
| 收起条读数和阈值变色 | CPU（70/90）、内存（80/92）、CPU 温度（75/90）、GPU 温度（75/87），偏高变黄、过高变红，阈值沿用第 2 版 | CPU、内存；两项温度不出 | 两边都有 |
| 不画卡片 | 去掉 `styles.css` 里 `--fuyu-plugin-surface` / `--fuyu-plugin-border` 的卡片，直接画在岛上（插件系统总控确认过不用改平台） | 同 | 两边都有 |

### Windows 的 PowerShell 助手

第 2 版每秒起一次 PowerShell 不现实（一次 0.3–1 秒），所以 Windows 上和第 2 版一样常驻一个 `powershell.exe -NoProfile -NonInteractive -Command -`：宿主从标准输入发一行请求（`net`、`battery`、`procs`、`thermal`、`gpu`），它回一行 JSON。

- 只在需要时启动：监控页开着、收起条勾了温度、或勾了后台记录曲线；都不需要时 60 秒后退出，和第 2 版一样省内存（常驻约 60–120 MB，README 写明）。CPU、内存、收起条的 CPU 和内存读数不靠它，只勾这两项时不起 PowerShell。
- 脚本文本放在宿主代码的一个字符串常量里（`src/host/win/helperScript.ts`），能直接审核；不放单独的 `.ps1` 文件，构建只打 JS。
- 插件停用、宿主退出时结束子进程（`ctx` 的销毁回调）；子进程崩了下一次请求重启，连续失败就停用对应读数并在页上显示「读不到」。

### 用到的系统程序（写进 PR 和审核说明）

都用 `child_process.execFile` / `spawn`，参数写死，不经过 shell，不拼用户输入，不联网，不需要管理员：

| 平台 | 程序 | 用途 | 频率 |
|---|---|---|---|
| Windows | `powershell.exe`（系统自带） | 常驻助手：网速、电池、进程列表和图标、ACPI 温度、GPU 引擎计数器 | 需要时常驻，空闲 60 秒退出 |
| Windows | `nvidia-smi`（NVIDIA 驱动自带，`PATH` 里找不到就不用） | GPU 温度、显存、功耗 | 页开着或收起条勾 GPU 温度时 2 秒一次 |
| Windows | `taskmgr.exe` | 点按钮打开任务管理器 | 用户点时 |
| Mac | `vm_stat`、`netstat -ib`、`ps`、`pmset -g batt`、`ioreg` | 内存、网速、进程、电池、GPU 占用 | 页开着每 1–3 秒，电池 10 秒，收起条只用 `vm_stat` |
| Mac | `open -b com.apple.ActivityMonitor` | 点按钮打开活动监视器 | 用户点时 |

清单的 `fuyu.nodeApis` 会多出 `child_process`，市场和安装确认会显示「会运行程序」；README 和插件描述写清。官方插件 `launcher` 已经用 `child_process`，有先例。

## 平台能力（插件系统总控 2026-11-19 已答复）

1. **页面尺寸：现在就能做。** 外层 `.plugin-slot` 是 `display: contents`，插件根元素直接在 `.island__content`（纵向 flex 面板里的 `flex: 1; min-height: 0`）下面。根元素 `height: 100%` 就是内容区高度，`ResizeObserver` 量到的是缩放前的 CSS 像素，按它排版。外层不滚动，超出要插件自己裁掉。插件不能自己定面板高度。
2. **警告色和深浅岛：平台会加。** `.plugin-slot` 上加 `--fuyu-plugin-warning`、`--fuyu-plugin-danger`，外层按深浅岛设 `color-scheme`。插件先写 `var(--fuyu-plugin-warning, #ffd166)`、`var(--fuyu-plugin-danger, #ff7a7a)`，图表颜色用 `light-dark()`；平台合入前一直取深色那一边。
3. **点收起项打开页面：平台会加。** `island.collapsed/v1` 加元数据 `opens: "<自己插件的 island.page/v1 id>"`，宿主让整项可点、可键盘操作。插件现在就写 `opens: "@fuyu/system-monitor"`，平台合入前会被忽略或告警一次。props 里的 `onOpenPage` 是内部上下文，**不用**。
4. 2、3 是 E60.9（#949），由 `[任务] 插件和插件市场页面重设计` 做，排在 E60.8 前面；收起条宽度（E60.8）、设置分节（E60.6）也在它那里。本组不等它们，E64.2 按上面的接口带回退值写，平台合入后自然生效。

## 任务和会话

父任务 **E64**「系统监控补回第 2 版的功能」，一个 issue。两个任务会话，按文件切开；都用 `effort: xhigh`、`use_worktree: false`，都不编译 Rust、不跑回归页（同时编译的名额不占）。

### E64.1 宿主取数（先派）

- 会话名 `e64-1`，标题 `[E64.1] 系统监控宿主补齐取数`。
- `--scope plugins/v3/official/system-monitor/src/host.ts,plugins/v3/official/system-monitor/src/host/,plugins/v3/official/system-monitor/src/protocol.ts,plugins/v3/official/system-monitor/src/types.ts,plugins/v3/official/system-monitor/test/,tests/unit/official-plugins-v3.test.mjs`
- 做什么：
  1. **第一个提交只定接口**：把 `types.ts` 拆成 `protocol.ts`（数据结构、方法、事件、配置和默认值）和 `text.ts`（界面文案，交给 E64.2），定好新的 `MonitorSample`（GPU、网速、电池、程序、温度可为空并带「这个平台不支持 / 读不到」的区分）、`history` 的格式和新配置项（`layout`、`barCpuTemperature`、`barGpuTemperature`、`backgroundHistory`，旧的 `config.json` 照读）。提交后马上 SendMessage 告诉组长，组长据此派 E64.2。
  2. 宿主拆成 `src/host/`：采样调度（谁在看、按什么频率读什么）、历史曲线、Windows 助手、Mac 读数、各命令输出的解析函数（纯函数，单独可测）、打开任务管理器 / 活动监视器的方法。
  3. 测试：解析函数用记录下来的真实输出做样例（Windows 的样例可以照第 2 版脚本和微软文档写，Mac 的在本机录）；调度用假的 `execFile` / 助手测「页关着不起进程」「只勾 CPU 和内存不起 PowerShell」「60 秒后助手退出」「后台记录每 5 秒一点」。官方插件套件 `tests/unit/official-plugins-v3.test.mjs` 里系统监控那段跟着改（`nodeApis` 多 `child_process`）。
- 怎样算做完：Mac 上在本机跑插件（`pnpm --dir plugins/v3/official/system-monitor dev` 或套件里的宿主）能读到网速、电池、程序、GPU 占用；`typecheck`、`lint`、`check`（`fuyu-plugin check --official --market`）、`build` 过；`pnpm test` 过。Windows 部分只能按样例测，真机验证见 E64.3。

### E64.2 页面、收起条和设置（E64.1 第一个提交之后派）

- 会话名 `e64-2`，标题 `[E64.2] 系统监控页面和收起条重做`。
- `--scope plugins/v3/official/system-monitor/src/island.tsx,plugins/v3/official/system-monitor/src/settings.tsx,plugins/v3/official/system-monitor/src/ui/,plugins/v3/official/system-monitor/src/text.ts,plugins/v3/official/system-monitor/src/styles.css,plugins/v3/official/system-monitor/src/useSystemMonitor.ts,plugins/v3/official/system-monitor/package.json,plugins/v3/official/system-monitor/README.md,plugins/v3/official/system-monitor/CHANGELOG.md`
- 做什么：照预览页的第 3 版做页面（不画卡片，环、曲线、核心柱、GPU 引擎、内存、网速、电池、程序列表和排序、打开任务管理器按钮，一栏两栏，按高度决定显示几个程序）；收起条四项读数和阈值变色；设置加排版、两项温度（Mac 上不出）、后台记录曲线；颜色走平台变量并带回退值、图表用 `light-dark()`，收起项注册时写 `opens`（见「平台能力」）。页面组件放 `src/ui/`，每个文件不超过 400 行。
- 同时补上 E60.7 对系统监控要的字段：`island.page/v1` 的中英文 `title`，设置分节按 E60.6 定下的做法挂（E60.6 没定就保持 `pluginsV3`）。
- 收尾：`version` 升到 `1.1.0`，写 `CHANGELOG.md`，README 改成新功能、数据来源、开销、用到的系统程序，`package.json` 的中英文描述跟着改。
- 怎样算做完：`typecheck`、`lint`、`check`、`build`、`pnpm test` 过；在 Mac 开发版装本地构建的插件，截图深色岛和浅色岛、窄面板和宽面板各一张放进任务文件；等用户在真岛上看。

### E64.3 Windows 真岛验收（人工，不派会话）

PowerShell 助手、`nvidia-smi`、GPU 计数器、程序图标在 Mac 上验不了。代码合入后，由 Windows 那台机器上的会话或用户本人在 Windows 开发版上装 1.1.0 看一遍：各项有读数、页面关掉 60 秒后 PowerShell 进程退出、收起条温度变色。发现问题回到 E64.1 修。记在任务文件「待人工验收」。

### 先后

```
E64.1 第 1 个提交（接口）──► 派 E64.2
E64.1 其余提交 ─┐
E64.2 ──────────┴─► 组长检查 diff ─► 报 Fuyu-[总控] 全局 合入 ─► 告诉插件开发总控版本号和提交号上架 ─► E64.3 Windows 验收
```

E64.2 要用 E60.5 的 `title` 字段：E60.5 在做（改的是 `packages/plugin-base`，不是插件目录），E64.2 动手时它若还没在本地提交，`title` 先按文档写上，类型报错就等它。

## 和 E60.7 怎么避开

E60.7（#938）要给所有官方插件补标题、设置入口并升版本，会改系统监控的 `island.tsx`、`settings.tsx`、`package.json`，正好是 E64.2 的文件。做法：**系统监控那份由 E64.2 一起做，E60.7 跳过系统监控**。用户同意后组长发消息给 `[任务] 插件和插件市场页面重设计` 说明，并在 E60.7 的任务文件「备注」里记一笔（只加备注，不改它的范围字段）。

## 按默认定下的

用户 2026-11-19 说「开始派」，下面三条按计划的默认走，用户要改随时说：

1. Mac 上不做 CPU 温度、GPU 温度和功耗（要 root）。
2. 收起条保持第 3 版现在的默认（显示 CPU 和内存），已装的用户不变。
3. Windows 真岛验收记成 E64.3（待人工验收），由用户在 Windows 开发版上看，或那台机器上的会话代看。
