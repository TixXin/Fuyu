# 内存占用与性能优化

> 日期：2026-11-14。问题：浮屿这类常驻的 Tauri / WebView2 应用，内存占用和性能还能怎么降，别人是怎么做的。范围：Microsoft Learn（WebView2 性能、进程模型、内存 API、EcoQoS、工作集）、Tauri 官方文档与 docs.rs、GitHub issue（tauri-apps/tauri、tauri-apps/wry、MicrosoftEdge/WebView2Feedback、glzr-io/zebar）、同类 Tauri 应用的发布说明、Chromium 文档和几篇博客；关键词 WebView2 memory、MemoryUsageTargetLevel、TrySuspend、Tauri memory multiple windows、lightweight mode、EcoQoS、EmptyWorkingSet、backdrop-filter performance 等。相关任务：还没建，见「建议建的任务」。

本机的实测基线在 [investigations/idle-usage.md](../investigations/idle-usage.md)（2026-11-06：收起闲置时 CPU 约 10% 单核，私有内存约 330 MB，其中 Rust 主进程 16 MB，其余都在 WebView2）和 [investigations/expansion-performance.md](../investigations/expansion-performance.md)（展开掉帧在 GPU 栅格化）。本文只写外部资料和由此得出的建议，没有重新测量。

## 结论

1. **内存在 WebView2，不在 Rust。** 主进程只有 16 MB，调 Cargo 的 release 配置、换分配器对内存基本没用。要降内存只有三条路：少开 WebView、让不用的 WebView 让出内存、让每个页面自己少占。
2. **最值得先做的是给常驻隐藏的窗口用 WebView2 的内存 API。** `translation`、`clipboard` 和截图选区窗口平时都隐藏着。微软的建议是：不活跃的 WebView 设 `MemoryUsageTargetLevel = Low`，一段时间不用的调 `TrySuspend`，要用时 `Resume`。Tauri 没有封装这两个 API，但仓库已经依赖的 `webview2-com` 0.39 里有，可以经 `with_webview` 拿到 `ICoreWebView2` 自己调。能省多少没有可靠的公开数字，要自己测。
3. **有两个上游的泄漏和浮屿的用法正好对上，要先做长时间运行的测量。**
   - Tauri 的 `emit` 每发一个内容不同的事件，WebView 里就留下约 0.75 KB 收不回的内存（tauri#12724，未修）。浮屿是一直开着的，每秒 1 个事件就是每天约 65 MB。
   - 鼠标在 WebView2 表面上移动会泄漏 GDI 对象，到 10000 个上限后光标卡顿（WebView2Feedback#5536，未修）。浮屿是常驻置顶的 WebView2 表面，鼠标经常经过。
4. **「不用时销毁窗口」是同类应用降内存的常见做法，但和「快捷键秒开」冲突。** Motrix Next 的轻量模式销毁 WebView 后省约 300 MB；另一边，预热隐藏的窗口显示只要几十微秒，冷启动要约 1 秒。浮屿的剪贴板窗口靠快捷键弹出，应该保留；翻译窗口可以考虑长时间不用后销毁。
5. **CPU 方面外部资料支持的方向是把轮询换成事件。** 媒体状态有 `MediaPropertiesChanged` / `PlaybackInfoChanged` / `CurrentSessionChanged` 事件，不必每 1.5 秒读一次。
6. **不要做的事**：`--disable-gpu`（微软明确不建议）、定时 `EmptyWorkingSet`（只是把数字变好看，之后用缺页中断还回去）、在生产环境依赖 WebView2 的浏览器开关（微软说随时可能改或删）。

## 建议（按预计收益排序）

| # | 做什么 | 预计收益 | 风险 / 代价 | 依据 |
|---|---|---|---|---|
| 1 | 先把内存按进程类型分开量：浏览器进程、GPU 进程、每个渲染进程各多少；跑 8 小时以上看私有内存和 GDI 句柄数的走势 | 不直接省，但决定后面先做哪项 | 只是测量 | [性能最佳实践](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance)「Monitor memory usage」「Browser Task Manager」 |
| 2 | 隐藏的 `translation`、`clipboard`、`screenshot-<n>` 窗口：隐藏时设 `MemoryUsageTargetLevel = Low`，显示前改回 `Normal` | 未知，要测；微软说是尽力而为，可能把内存换出到磁盘 | 换出后第一次显示可能变慢，剪贴板弹出的延迟要测 | 同上「Use memory management APIs」 |
| 3 | 长时间不用的隐藏窗口改用 `TrySuspend` / `Resume`（和第 2 项二选一，不能混用） | 比第 2 项多：渲染进程暂停，脚本和定时器都停 | 暂停期间收不到事件，恢复后要补一次状态；几个窗口同源，可能共用一个渲染进程，行为要实测 | 同上；[进程模型](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model) |
| 4 | 核对发事件的频率：Rust 侧有 83 处 `emit`，找出高频的（穿透、跟随、Agent 状态、媒体），内容没变就不发；高频数据改成前端按需 `invoke` 拉取 | 避免每天几十 MB 的增长（如果确实踩中） | 要先用第 1 项的长跑确认 | [tauri#12724](https://github.com/tauri-apps/tauri/issues/12724) |
| 5 | 翻译窗口（可能还有截图选区窗口）改成按需创建，空闲一段时间后销毁；剪贴板窗口保持常驻 | 每少一个渲染进程省几十 MB（未核实，要测） | 第一次打开慢约 1 秒；窗口 label 和 `?window=` 是对外契约，不能改 | [Motrix Next v3.7.1-beta.3](https://newreleases.io/project/github/AnInsomniacy/motrix-next/release/v3.7.1-beta.3)、[dev.to 冷启动文章](https://dev.to/tinyforge/tauri-cold-launch-was-1s-heres-how-i-got-it-to-feel-instant-32lh) |
| 6 | 隐藏窗口里的定时器按可见性停掉：`src/` 里 44 个文件有 `setInterval`，只有 7 个文件看 `visibilitychange` / `document.hidden` | 降 CPU，顺带减少无效渲染 | 小；`window.hide()` 后页面是否算 hidden、定时器是否被 Chromium 自动节流，未核实，要测 | 同上 dev.to 文章「Background CPU」；[docs.rs `background_throttling`](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html) |
| 7 | 媒体状态从每 1.5 秒轮询改成订阅 GSMTC 事件；音量改成回调（`IAudioEndpointVolumeCallback`，本次搜索未核实） | idle-usage 里这两项合计约 1.1% 单核，且每次新开线程 | 事件回调的线程和 COM 套间要处理好 | [Old New Thing 2023-11-08](https://devblogs.microsoft.com/oldnewthing/20231108-00/?p=108980)、[Windows.Media.Control](https://learn.microsoft.com/en-us/uwp/api/windows.media.control) |
| 8 | 页面运行久了定期刷新隐藏的 WebView（例如翻译窗口每次隐藏超过一段时间后 reload） | 把累积的状态清回基线，也是第 4 项泄漏的兜底 | 页面内状态要能恢复 | 性能最佳实践「Periodically refresh the WebView2」 |
| 9 | 渲染：`will-change` 只在动画期间加、用完去掉；减少同时存在的 `backdrop-filter` 和模糊半径 | 降 GPU 进程内存和展开时的栅格化耗时 | 视觉变化，要对照 [design/island.md](../design/island.md) | 见「渲染」一节，来源是博客，数字只作参考 |
| 10 | 加 `[profile.release]`：`codegen-units = 1`、`lto = true`、`strip = true` | 体积和少量 CPU，对内存基本没影响 | 构建变慢；`panic = "abort"` 不建议照抄，见下 | [Tauri: App Size](https://v2.tauri.app/concept/size/) |

## 详细

### 内存在哪里

- WebView2 用的是 Edge 的多进程模型：一个进程组里有一个浏览器进程、一个或多个渲染进程，加上 GPU、音频等辅助进程。一个用户数据目录对应一组进程。渲染进程不是和某个 WebView 一一对应的，同一个用户数据目录下、同站点的多个 WebView 可能共用一个渲染进程，由 Chromium 的站点隔离决定（[进程模型](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model)）。浮屿的窗口都是同一个源，实际有几个渲染进程要用 Browser Task Manager（`OpenTaskManagerWindow`）看，不能假设「一个窗口一个进程」。
- 微软的建议是全应用共用一个 `CoreWebView2Environment`，参数保持一致（[性能最佳实践](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance)）。Tauri 默认就是这样；要注意的是自己用 `webview_page.rs` 建的 WebView（插件页面）如果用了不同的参数或数据目录，会多出一整组进程。
- Tauri 和 Electron 的内存差不多：在 Windows 上两者都是 Chromium。tauri#5889 的提交者把共享内存算进去后量到 Windows 10 上 Tauri 370–399 MB、Electron 312–318 MB（加载 postman.com、vscode.dev，2022 年的数据），维护者也承认官方基准只能当冒烟测试看（[tauri#5889](https://github.com/tauri-apps/tauri/issues/5889)，已关闭，没有结论性的修复）。浮屿 330 MB 私有内存在这个量级里是正常的，不是哪里写错了。
- 量内存时看私有内存（提交量），不要只看工作集。工作集是当前驻留在物理内存里的页，会被系统随时修剪，也包含和别的进程共享的页（[Working Set](https://learn.microsoft.com/windows/win32/memory/working-set)）。idle-usage 里私有内存 330 MB、工作集 634 MB 的差距主要就是共享页。

### WebView2 的内存 API

- `MemoryUsageTargetLevel`（`ICoreWebView2_19`，SDK 1.0.1823.32 起）：设成 `Low` 是给浏览器的提示，可能丢掉缓存或把内存换出到磁盘；页面里的脚本和网络连接照常运行。适合「隐藏了但还要收事件」的窗口。
- `TrySuspend` / `Resume`（`ICoreWebView2_3`）：暂停渲染进程，脚本停止。要求 WebView 不可见。`TrySuspend` 会自动把目标级别设成 Low，`Resume` 恢复成 Normal。文档写明两套做法二选一，暂停期间再设 `MemoryUsageTargetLevel` 会被忽略；也可以对隐藏的 WebView 定期 `Resume` 再 `TrySuspend` 让页面同步一次数据。（以上来自 [ICoreWebView2_19](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2_19)、[ICoreWebView2_3](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2_3) 的搜索摘要和性能最佳实践原文。）
- Tauri 这边：`WebviewWindowBuilder` 没有任何和内存、挂起有关的方法；`background_throttling` 在 Windows 上不支持（[docs.rs，tauri 2.12.5](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html)）。`webview2-com` 0.39.1 的 `ICoreWebView2_19` 有 `SetMemoryUsageTargetLevel`（[docs.rs](https://docs.rs/webview2-com/latest/webview2_com/Microsoft/Web/WebView2/Win32/struct.ICoreWebView2_19.html)），仓库已经依赖 0.39，调用是 `unsafe`，按规则放进 `src-tauri/src/win32/`。
- 没有找到任何人公布过这两个 API 在 Tauri 应用里的前后对比数字（未核实），所以收益要自己量。

### 浏览器开关

- Tauri（wry）默认传 `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`。自己调 `additional_browser_args` 会整个替换掉默认值，要把这三个再写一遍；而且参数不同的 WebView 必须用不同的数据目录（docs.rs，同上）。
- 微软文档里和内存有关、写明了的只有两个：`--disable-gpu` 能省内存但不建议用于排查以外的场合；`--js-flags=--scavenger_max_new_space_capacity_mb=<n>` 减少 V8 新生代的内存，代价是小回收更频繁。微软同时说明浏览器开关不保证在生产环境可用，随时可能改或删（[WebView2 browser flags](https://learn.microsoft.com/microsoft-edge/webview2/concepts/webview-features-flags)，来自搜索摘要）。
- 社区里流传的 `--renderer-process-limit` 没有在微软文档里找到，有人反映加了一组这类参数后页面出问题（未核实）。不建议用。

### 上游的两个泄漏

- **事件泄漏**（[tauri#12724](https://github.com/tauri-apps/tauri/issues/12724)，开着，标了 upstream）：从 Rust `emit` 200 万个事件后前端约 1.1 GB。2026-11-02 一位评论者的分析：增长和「执行过多少段不同的脚本」成正比，`emit` 把负载内联进脚本，每个不同的负载就是一段新脚本，强制 GC 后也不回收；负载相同时内存不涨；换成 `Channel` 也涨。约 0.75 KB 一个事件。维护者用纯 C++ 的 `ExecuteScript` 也复现了，已报给微软（[wry#1489](https://github.com/tauri-apps/wry/issues/1489)）。没有官方的绕过办法。
  - 对浮屿的含义：`invoke` 的返回值不走这条路（我的理解：Tauri 2 的命令返回走自定义协议，不是 `eval`；没有在这次调研里核实），所以高频数据用前端轮询 `invoke` 反而不泄漏，低频的状态变化才适合用 `emit`。浮屿的 Agent 状态已经是轮询；要查的是穿透、跟随、媒体这些地方的 `emit` 频率。
- **GDI 泄漏**（[WebView2Feedback#5536](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5536)，开着）：鼠标在 WebView2 表面移动 30 秒，GDI 对象从 42 涨到 2268，不动鼠标就不涨。最初是同为 Tauri 常驻小部件的 Zebar 的用户发现的，正常使用 1–2 小时后卡顿（[zebar#264](https://github.com/glzr-io/zebar/issues/264)）。微软的人在 Chromium 里找到一处 `GetDC` 没有对应的 `ReleaseDC`，但没有修复时间。有人在 Windows 10 22H2 上复现不出来。去掉 hover 样式、`pointer-events: none`、`--disable-gpu` 都没用，反复切 `SetIsVisible` 反而更糟。唯一的办法是重启进程。
  - 对浮屿的含义：先量。如果确实在涨，能做的只有监控 `msedgewebview2.exe` 的 GDI 句柄数，接近上限时在用户不注意的时候重建 WebView。

### 隐藏还是销毁

- Motrix Next（Tauri 下载器）的轻量模式在关窗口时销毁 WebView；它的一个 bug 是开机自启时没销毁，多占约 300 MB，直到用户手动开关一次窗口（[v3.7.1-beta.3 发布说明](https://newreleases.io/project/github/AnInsomniacy/motrix-next/release/v3.7.1-beta.3)，查于 2026-11-14）。
- Clash Verge Rev 也有轻量模式，但这次没搜到讲它实现方式的可靠来源（未核实）。
- 反方向的数据：一篇 macOS 上的测量，预热后隐藏的窗口 `show()` 只要 15–18 微秒，销毁后重建每次约 1 秒；代价是约 159 MB 一直占着，而且隐藏的 WebView 里定时器和动画还在跑，要按可见性停掉。作者的结论是常驻的快捷键工具应该看每次唤起的延迟，不是冷启动（[dev.to](https://dev.to/tinyforge/tauri-cold-launch-was-1s-heres-how-i-got-it-to-feel-instant-32lh)）。平台是 WebKit，数字不能直接搬到 WebView2。
- 微软的建议偏向复用：少建 WebView，能复用一个就不要销毁重建（性能最佳实践「Avoid redundant WebView2 instances」）。
- 放到浮屿上：主岛必须常驻；剪贴板窗口是快捷键和 Win+V 唤起的，延迟敏感，常驻并配合第 2 项；翻译窗口用得少一些，适合「按需创建 + 空闲销毁」或 `TrySuspend`；截图选区窗口每个显示器一个，打开截图模块后一直隐藏着，多屏时最占，值得单独量。

### CPU

- 把轮询换成事件。GSMTC 的会话管理器有 `CurrentSessionChanged` / `SessionsChanged`，会话上有 `MediaPropertiesChanged` / `PlaybackInfoChanged`；Raymond Chen 的文章说完整的实现应该订阅这些事件（[Old New Thing](https://devblogs.microsoft.com/oldnewthing/20231108-00/?p=108980)）。仓库里已经有 `media_control/events.rs`，要核对的是 1.5 秒的轮询还剩下什么用途。
- 减少宿主和页面之间的通信，能合并的消息合并发（性能最佳实践「Reduce unnecessary communication」）。
- EcoQoS：`SetProcessInformation` + `ProcessPowerThrottling` 可以把进程标成效率模式，系统会选最省电的频率、调度到能效核；微软说只用于不影响前台体验的工作（[SetProcessInformation](https://learn.microsoft.com/windows/win32/api/processthreadsapi/nf-processthreadsapi-setprocessinformation)、[Introducing EcoQoS](https://devblogs.microsoft.com/sustainable-software/introducing-ecoqos/)，来自搜索摘要）。浮屿主进程里有 12 ms 的鼠标穿透循环，整个进程标成 EcoQoS 会影响手感；可以只给后台线程（邮件、日历、微信、QQ 轮询）用 `SetThreadInformation`。收益是耗电，不是内存，优先级低。
- Chromium 在 Windows 上会判断窗口是否被完全遮挡，遮挡后按后台标签页处理：停止渲染、节流脚本（[Windows Native Window Occlusion Detection](https://chromium.googlesource.com/chromium/src/+/master/docs/windows_native_window_occlusion_tracking.md)）。这对 WebView2 里透明置顶的窗口是否生效没有找到说明（未核实）；浮屿自己的全屏检测（`system/fullscreen.rs`）可以在全屏应用盖住岛屿时主动停掉动画和轮询。

### 渲染

来源都是博客，没有 Chromium 官方文档，数字只作参考。

- 每个合成层占一块 GPU 纹理，大约是宽 × 高 × 4 字节（按设备像素算）。浮屿主窗口的舞台是 820 × 460，设备像素比 1.5 时一层约 3.4 MB；层数多了才是问题。
- `will-change` 会让元素一直占着一个层，应该只在动画期间加、结束后去掉，不要大面积常驻（[What will-change Actually Does to Your GPU Memory](https://mspk.substack.com/p/what-will-change-actually-does-to)）。
- 模糊的成本随半径和面积上升，`backdrop-filter` 的元素同时存在的数量要控制（[Motion: Web Animation Performance Tier List](https://motion.dev/blog/web-animation-performance-tier-list)）。
- 这和 expansion-performance.md 的结论一致：瓶颈在栅格化和合成，不在 JS。DevTools 的 Layers 面板能看每层的大小和内存估计，是这一项的验收工具。

### 构建配置

- 现状：`src-tauri/Cargo.toml` 没有 `[profile.release]`，用的是 Cargo 默认值（`opt-level = 3`，不开 LTO，16 个 codegen unit，不 strip）。前端已经按窗口分包（`src/main.tsx` 里每个窗口动态 `import`），不需要再做。
- Tauri 官方给的体积配置是 `codegen-units = 1`、`lto = true`、`opt-level = "s"`、`panic = "abort"`、`strip = true`（[App Size](https://v2.tauri.app/concept/size/)）。
- 对浮屿的取舍：`lto`、`codegen-units = 1`、`strip` 可以加，换来更小的 exe 和安装包，构建会慢不少。`opt-level` 保持 3（要的是 CPU，不是体积）。`panic = "abort"` 不建议：现在某个后台线程 panic 只死那一个线程，改成 abort 后任何一处 panic 整个岛屿退出。
- `removeUnusedCommands`（tauri 2.4 起）会去掉权限文件里没允许的命令，只影响体积；运行时动态加的权限它看不到，浮屿有插件相关的动态能力，开之前要核对。

### 不建议做的

- `--disable-gpu`：微软写明 GPU 渲染对性能很关键，只在排查问题时关（性能最佳实践「Enable hardware acceleration」）。
- 定时调 `EmptyWorkingSet` 或 `SetProcessWorkingSetSize(-1, -1)`：只是把页从工作集移到备用列表，任务管理器的数字变小，一碰又回来，还多了缺页中断；提交量不变（[EmptyWorkingSet](https://learn.microsoft.com/en-us/windows/win32/api/psapi/nf-psapi-emptyworkingset)、[The Wiert Corner 的整理](https://wiert.me/2021/07/07/setprocessworkingsetsize-you-hardly-if-ever-need-to-call-this-from-your-process/)）。WebView2 的 `MemoryUsageTargetLevel = Low` 是官方给的同类手段，用它。
- 用固定版本的 WebView2 Runtime：微软建议用 Evergreen，很多内存泄漏和高 CPU 问题是在新版本里修的（性能最佳实践「Use the Evergreen Runtime」）。上面两个上游泄漏修好之后，用户也只有在 Evergreen 下才会自动拿到。

## 建议建的任务

还没有建任务和 issue，等确认后再建。建议拆成：

1. 内存和 GDI 的长时间测量：按进程类型拆分，8 小时以上，记录到 `docs/investigations/`。这一项决定后面几项要不要做。
2. 隐藏窗口用 `MemoryUsageTargetLevel` / `TrySuspend`，前后对比内存和唤起延迟。
3. 核对 `emit` 的频率，高频的去重或改成拉取。
4. 翻译窗口和截图选区窗口的生命周期：按需创建、空闲销毁。
5. 隐藏窗口里的定时器按可见性停掉。
6. 媒体轮询改事件（idle-usage.md 里「还能做的」已经记了一半）。

## 来源

查询日期都是 2026-11-14。

- Microsoft Learn，Performance best practices for WebView2 apps（文档日期 2026-01-12）：https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance
- Microsoft Learn，Process model for WebView2 apps：https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model
- Microsoft Learn，ICoreWebView2_19（MemoryUsageTargetLevel）：https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2_19
- Microsoft Learn，ICoreWebView2_3（TrySuspend / Resume）：https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2_3
- Microsoft Learn，WebView2 browser flags：https://learn.microsoft.com/microsoft-edge/webview2/concepts/webview-features-flags
- Microsoft Learn，Working Set：https://learn.microsoft.com/windows/win32/memory/working-set
- Microsoft Learn，EmptyWorkingSet：https://learn.microsoft.com/en-us/windows/win32/api/psapi/nf-psapi-emptyworkingset
- Microsoft Learn，SetProcessInformation：https://learn.microsoft.com/windows/win32/api/processthreadsapi/nf-processthreadsapi-setprocessinformation
- Microsoft，Introducing EcoQoS：https://devblogs.microsoft.com/sustainable-software/introducing-ecoqos/
- Microsoft Learn，Windows.Media.Control：https://learn.microsoft.com/en-us/uwp/api/windows.media.control
- The Old New Thing，2023-11-08，获取系统媒体播放信息：https://devblogs.microsoft.com/oldnewthing/20231108-00/?p=108980
- Tauri，App Size：https://v2.tauri.app/concept/size/
- docs.rs，tauri 2.12.5 `WebviewWindowBuilder`：https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html
- docs.rs，webview2-com 0.39.1 `ICoreWebView2_19`：https://docs.rs/webview2-com/latest/webview2_com/Microsoft/Web/WebView2/Win32/struct.ICoreWebView2_19.html
- tauri-apps/tauri#5889，Tauri 和 Electron 的内存对比（已关闭）：https://github.com/tauri-apps/tauri/issues/5889
- tauri-apps/tauri#12724，emit 事件的内存泄漏（开着）：https://github.com/tauri-apps/tauri/issues/12724
- tauri-apps/wry#1489，从 Rust 执行脚本的内存泄漏（开着）：https://github.com/tauri-apps/wry/issues/1489
- MicrosoftEdge/WebView2Feedback#5536，鼠标移动泄漏 GDI 对象（开着）：https://github.com/MicrosoftEdge/WebView2Feedback/issues/5536
- glzr-io/zebar#264，同一个 GDI 泄漏在 Zebar 里的排查（2026-09-20 关闭，归为上游问题）：https://github.com/glzr-io/zebar/issues/264
- Motrix Next v3.7.1-beta.3 发布说明：https://newreleases.io/project/github/AnInsomniacy/motrix-next/release/v3.7.1-beta.3
- dev.to，Tauri 冷启动与预热隐藏窗口的测量（macOS）：https://dev.to/tinyforge/tauri-cold-launch-was-1s-heres-how-i-got-it-to-feel-instant-32lh
- Chromium，Windows Native Window Occlusion Detection：https://chromium.googlesource.com/chromium/src/+/master/docs/windows_native_window_occlusion_tracking.md
- The Wiert Corner，SetProcessWorkingSetSize 的整理：https://wiert.me/2021/07/07/setprocessworkingsetsize-you-hardly-if-ever-need-to-call-this-from-your-process/
- mspk，What will-change Actually Does to Your GPU Memory：https://mspk.substack.com/p/what-will-change-actually-does-to
- Motion，Web Animation Performance Tier List：https://motion.dev/blog/web-animation-performance-tier-list

几条只读了搜索摘要、没有打开原文的，正文里已经标了「来自搜索摘要」；标「未核实」的没有找到可靠来源。
