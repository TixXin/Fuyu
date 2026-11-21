# Mac 上的内存占用

2026-11-20，macOS 27.2，MacBook Air（Apple Silicon）。外部资料见 [research/macos-webview-memory.md](../research/macos-webview-memory.md)。

## 测法

- 数字都是 `phys_footprint`（`footprint <pid…>`），即活动监视器「内存」列。浮屿的总占用是主进程 `fuyu`、它的 WebKit 辅助进程（WebContent、GPU、Networking，父进程是 launchd，按启动时间对上）、插件宿主 `node` 和媒体适配器 `perl` 加起来。
- 拆分用 `footprint <pid>` 的分类、`vmmap <pid>` 看大块区域、`heap <pid>` 看对象个数。
- 正式版是 `/Applications/Fuyu.app`（0.3.12-beta.1），默认设置加本机数据，启动后几分钟采样；开发版是 `pnpm tauri dev`。

## 修之前

| 进程 | 正式版，开机 36 秒 | 正式版，5 分钟 | 开发版，22 分钟 |
|---|---|---|---|
| `fuyu` 主进程 | **458 MB** | 292 MB | 212 MB（峰值 293） |
| 岛的 WebContent | 124 MB | 122 MB | **693 MB**（峰值 1.28 GB） |
| 第二个 WebContent（剪贴板窗口预热） | 41 MB | 41 MB | 98 MB |
| WebKit GPU | 75 MB | 72 MB | — |
| 插件宿主 `node` | 49 MB | 45 MB | 66 MB |
| 合计 | 约 760 MB | 约 590 MB | — |

### 主进程：图标的 TIFF

`footprint` 里主进程有 215 MB 记在 Foundation，`vmmap` 显示是三块各 70.5 MB 的区域；另有 157 MB 的「Malloc Large (empty)」，是 4 → 8 → 16 → 32 → 64 MB 翻倍增长过、又释放了但没还给系统的缓冲区。

来源是 `macos/icon.rs`：取应用图标（Agent 会话的宿主程序、正在放歌的播放器、拖文件时的图）用 `NSWorkspace.iconForFile(…).TIFFRepresentation()`。图标的 `NSImage` 带 16 到 1024@2x 的全部尺寸，转 TIFF 把每张都画出来。用一个小 Swift 程序实测，计算器、Claude、音乐、Chrome、浮屿自己的图标都是 **70 MB 一份**。之后再转 PNG、解码、缩成 64×64，就是那串翻倍的缓冲区。每个不同的程序一份，在后台线程上做、没有 autorelease pool，TIFF 一直挂着不放。

### 主进程：后台线程没有 autorelease pool

`heap` 看到开发版跑了 23 分钟后有 7,702 个 `NSRunningApplication`，配套 8,500 个 `NSURL`、7,689 个 `LSASN`、7,723 个 `NSLock`，另有 99 页「@autoreleasepool content」（约 5 万个待释放对象）。正式版 1 分 45 秒 687 个、5 分钟 1,683 个，每秒涨五六个，一直涨。

来源是程序坞角标的轮询（`macos/dock_badges.rs`）：每一拍对每个消息来源调 `apps::path_for_bundle_id`，里面的 `runningApplicationsWithBundleIdentifier` 每次新建 `NSRunningApplication`；`apps.rs` 的其他函数（前台程序、按 pid 查路径和名字）也被媒体、Agent 窗口跳转、截图等后台线程调用。objc2 的 `Retained` 不能保证对象不进 pool，这些线程长期运行，系统给的兜底 pool 不排空。

### 媒体适配器的 perl 留成孤儿

`media_control/adapter_macos.rs` 起的 `perl mediaremote-adapter.pl stream` 在岛退出时没有结束：正式版正常退出后它的父进程变成 launchd 继续跑；开发版每重启一次留下一个（实测有跑了 27 分钟的）。它只在有媒体变化往管道写的时候才会因 SIGPIPE 退出。每个约 5.5 MB。

### WebContent

- 正式版岛的页面约 120 MB，剪贴板窗口为了 Win+V / 快捷键秒开在启动后预热（`clipboard_history/background.rs`），常驻约 41 MB。GPU 进程 70 来 MB，资料里说这个量正常。
- 开发版的 693 MB / 峰值 1.28 GB 主要是 Vite HMR：每次热更新以新 URL 导入模块，旧的模块记录不回收，多个会话一起改代码时涨得很快。刚启动的开发版页面是 185 MB。

## 改了什么

1. `macos/icon.rs`：用 `CGImageForProposedRect:context:hints:` 按 64 px 只取一张图，转成 PNG（不再生成全尺寸 TIFF），不是 64×64 时才缩放；拖拽用的图取 64 px、标成 32 pt，和原来显示的大小一样。整个过程包在 `autoreleasepool` 里。`Cargo.toml` 给 `objc2-app-kit` 加了 `NSGraphicsContext`、`objc2-core-graphics` 两个 feature（都已在依赖树里，不加新 crate）。
2. `macos/apps.rs` 的每个函数、`macos/pasteboard.rs` 的三个读取（剪贴板每 400 ms 轮询一次）、`macos/dock_badges.rs` 的每一拍都包上 `objc2::rc::autoreleasepool`。
3. `media_control/adapter_macos.rs`：perl 经 `/bin/sh` 启动，sh 把 perl 放到后台、关掉自己的 stdout、在 stdin 上 `read`。stdin 是岛的管道，岛不管怎么退出（正常退出、崩溃、被开发版重启杀掉），管道一断 sh 就杀掉 perl。停掉适配器时先关 stdin 再等 sh 退出，不再直接 kill（直接 kill sh 会留下 perl）。用一个被 SIGKILL 的父进程实测过 perl 跟着结束。

4. 剪贴板窗口不再默认预热（用户定）：设置 → 剪贴板新开关「启动时预先准备剪贴板窗口」，Mac 默认关、Windows 默认开（保持原来接管 Win+V 的速度），存在 `clipboard-history.json` 设置的 `prewarmWindow`，没有这个字段时按平台取默认值。关着时第一次按快捷键才建窗口，收起后 10 分钟没再打开就销毁；开着时和原来一样启动 2 秒后建好、一直留着。设置里切换立即生效：打开就马上建，关掉就从现在起按 10 分钟释放。开发版实测启动后少了剪贴板那个 WebContent 进程（41–62 MB）。

## 修之后（开发版，刚启动、新代码）

| 进程 | 修前（开发版） | 修后（开发版） |
|---|---|---|
| `fuyu` 主进程 | 212 MB，7,702 个 `NSRunningApplication` 且还在涨 | **78–86 MB**，21 个不涨，Foundation 区域约 1 MB |
| 媒体适配器 | 每次重启留一个孤儿 perl | sh（1.5 MB）+ perl，随岛结束 |

## 正式版实测（2026-11-20 晚，`pnpm build:exe`，代码到 `bc1f169f1`）

新包收着不动，每 30 秒读一次，读 6 分钟（MB）：

| 进程 | 旧版 0.3.12-beta.1，早上 | 新包，13 秒 | 新包，1–6 分钟 |
|---|---|---|---|
| `fuyu` 主进程 | 458（36 秒）→ 292（5 分钟） | 112 | **91–94**，不涨 |
| 岛的 WebContent | 122–124 | 130 | 127–132 |
| 剪贴板窗口的 WebContent | 41 | 没有 | 没有 |
| WebKit GPU | 72–75 | 68 | 66–70（偶尔掉到 17–20） |
| WebKit Networking | 8 | 7 | 7 |
| 插件宿主 `node` | 45–49 | 68 | 52–56 |
| sh + perl | 5.7（perl） | 7 | 7 |
| **合计** | **约 760 → 590** | 约 390 | **约 355–360** |

- 主进程 6 分钟后 `NSRunningApplication` 不在 `heap` 的列表里（修前 5 分钟 1,683 个），Foundation 类不再出现在前几项；最大的是 IOAccelerator 59 MB（原生玻璃和面板的图层）、Malloc Small 22 MB。
- 模拟内存紧张后岛的 WebContent 降到 59 MB。
- 新包正常退出后 perl 跟着结束；同一时段旧版退出后又留下了一个 perl 孤儿（已手动结束）。

### 页面进程有时会一下涨到几百 MB

同一晚另外两次启动，新包 4 分钟内岛的 WebContent 涨到 630–670 MB，旧版不到 2 分钟涨到 470 MB，都是一次跳一百多 MB；模拟内存紧张后新包那次立刻降到 107 MB。那段时间 `sample` 看到页面在收着时一直在排版、重绘（CSS 动画计时器、`fetch` 调后端、`MessagePort` 消息）。上面 6 分钟那次没有出现。所以这是 WebKit 不急着回收的垃圾、旧版就有，触发条件没查清（猜测和当时岛上有没有动画、鼠标有没有经过岛预热面板有关），要找就得在出现时用 Web 检查器看堆和计时器。

## 第三轮：主进程的图形内存和插件宿主（2026-11-20 夜）

### 文字识别的模型一直留在主进程

正式包主进程 `IOAccelerator` 55–59 MB，`vmmap` 是一块 128 MB 的私有 Metal 堆里 55 MB 脏页；同一进程有两个 `ANEServicesThread`，`heap` 里几千个 `Espresso::*`（Core ML 的推理引擎）对象和 26 个 `VNRecognizedTextObservation`。来源是剪贴板历史给新复制的图片做文字识别（`clipboard_history/service.rs` → `macos/ocr.rs`，用 Vision 的 `VNRecognizeTextRequest`）：当时剪贴板里正好是一张图，岛一启动就记进历史、识别了一遍。截图存进历史时也会识别（`screenshot/history_text.rs`）。

用一个小 Swift 程序单独试：识别三次、每次都包在 `autoreleasepool` 里，进程仍从 4 MB 涨到 133 MB 并一直留着。Vision 没有公开的释放接口，模型缓存跟进程走。

改法：Mac 上的 `ocr::recognize` / `recognize_words` 改成起一个子进程，就是浮屿自己的可执行文件加 `--fuyu-ocr text|words <宽> <高>`，从 stdin 读 RGBA、往 stdout 写 JSON，识别完就退出（`macos/ocr_worker.rs`；`lib.rs` 的 `run()` 在最前面认这个参数，早于单实例插件）。调用方不变。

| | 修前 | 修后 |
|---|---|---|
| 主进程，启动 50 秒 | 110 MB（IOAccelerator 55 MB） | **55 MB**（IOAccelerator 25 MB） |
| 一次识别耗时 | 冷启动约 0.5 秒，之后约 0.37 秒 | 每次约 0.35 秒（含起进程） |

修后那次启动剪贴板里的图已在历史里、没有触发识别，所以 55 MB 是「没识别过」的数；子进程单独用一张中英文混排的图试过，`text`、`words` 两种结果都对，输入长度不对时返回空。在岛里实际复制一张新图、看子进程起落还没做。

### 插件宿主 node：多出来的主要是量法问题

本地 `pnpm build:exe` 打出的 `Fuyu.app` 没带 `Resources/plugins-v3`（打包好的宿主和内置插件），node 跑的是仓库里的源码目录。计时器插件的宿主代码 `timer/host/dataFile.mjs` 直接 import `../timers.ts`，Node 因此加载自带的 TypeScript 剥离器 amaro（堆快照里 3.6 MB 源码加 3 MB WebAssembly 缓冲区）。发布用的 `/Applications/Fuyu.app` 带着 esbuild 打好的内置插件，不加载它，之前量到 45–49 MB。所以上一节表里新包 node 的 52–56 MB 不能和旧版比，要量 node 得用 `pnpm tauri build` 的包。剩下和早先 35 MB 的差距，内置插件从 22 个变成 26 个是一部分，没再细查。

### 收起时图形进程留着整窗的图层

岛收着时 WebKit 的 GPU 进程有 49 MB 记在「Owned physical footprint (unmapped) (graphics)」，贴边收起时只有 2 MB，展开时也是 49 MB。胶囊本身只有一小条，这个量相当于整个透明窗口（820×460 点，2 倍屏）好几份位图。

在开发版里往岛的 CSS 末尾临时追加规则（热更新生效，测完删掉），每步轮询 GPU 进程到稳定：关掉毛玻璃、`filter`、`transform` 都不变；关掉全部 `animation` 降到 2 MB；再按组件缩小范围，是中间图案的水母（`JellyfishMark`）的空闲动画。它是 SVG 内部的 `transform` 循环（10 秒一轮的起伏、5.8 秒一次眨眼），元素没有自己的合成层，每一帧都重画它所在的整窗大图层，WebKit 就一直留着那块大图层的位图；没有动画时过几秒就丢掉了。

改法：一直循环的纯图形元素自己成层，`will-change: opacity`（motion.md 只许常驻 `opacity` 这一种，`transform` 实测效果一样）。加在水母、其他中间图案的 `svg`、像素宠物和会话格子正在闪的格子上；带数字的侧边圆环（`island-side-ring--attention`）怕文字发虚没加；液态玻璃的流动动画（`IslandGlassFlow`）本身就是整块的，没动。只给外层 `.center-pattern` 加没用。

开发版实测：收起时 GPU 进程 49 MB → **2 MB**（偶尔回到 49 MB 一两秒又放掉），展开仍是 49 MB，展开再收起回到 2 MB。正式包没重测。

## 第二轮：展开收起会不会泄漏（2026-11-20 下午）

用开发版和岛屿实验台（`/v1/dev/island/action`）反复展开、收起，读岛页面进程的 `phys_footprint`：

| 操作 | 页面进程 |
|---|---|
| 刚启动、收起 | 216 MB |
| 贴边收起 → 展开 Fuyu 页 → 收起 | 329 MB |
| 再展开收起 4 次 | 390 MB |
| 待办页、音乐页各 5 次 | 663 MB |
| 收着放 30 秒 | 679 MB |
| 过了几分钟没动 | 271 MB |
| `notifyutil -p org.WebKit.lowMemory`（模拟内存紧张）后 8 秒 | **173 MB** |

- 每次展开收起涨 10–25 MB，和是哪一页无关，但不是泄漏：空闲一会儿 JavaScriptCore 自己做了完整回收，模拟内存紧张后再降一截。开发版用的是 React 的开发构建（每个元素多记调试信息）、加上 HMR，垃圾多、回收懒，所以活动监视器里开发版看着特别大。
- 正式版要量的话需要点它的岛；这次用户没有授权操作正式版，正式版的展开收起没有量。
- `org.WebKit.lowMemory` 是系统范围的通知，Safari 等所有 WebKit 进程都会跟着丢缓存，只能用来测，不能放进产品里。
- 主进程里还有一项记作 Foundation 的内存，从启动 1 分钟的 25 MB 涨到 16 分钟的 42 MB，之后 45 秒没再变；`vmmap` 只看得到 1 MB 的区域，没查出是谁，要用 `MallocStackLogging=1` 启动开发版再看分配栈。

## 还能做的

- ~~开发版定期整页刷新~~：试过，不做。做法是热更新攒够 20 次、岛收着且 5 秒没人碰时整页刷新，实测确实刷新了（实验台诊断里窗口连接编号 1 → 2 → 3），但内存没有因此变少：刷新本身让页面进程从 154 MB 冲到 289 MB；模拟内存紧张后，一个刚启动、热更新过二十来次的页面能降到 134 MB，而前面反复展开收起、热更新很多次的页面也能降到 173 MB。HMR 真正留住的只有二三十 MB，看到的五六百 MB 几乎全是没回收的垃圾，系统内存紧张时会自己放掉。代码没提交。
- **岛页面的 JS 堆**：正式版 120 MB 里有多少是我们的数据（消息、剪贴板列表、data URL 图片），要用 Safari 的 Web 检查器连正式构建做一次堆快照；资料里提到 `backdrop-filter` 和常驻的 `will-change` 会占屏幕大小的合成层，可以顺带核对液态玻璃和动画。
- 插件宿主 `node`：见第三轮，本地包偏高是没带打包好的内置插件；要比就用 `pnpm tauri build` 的包。
- Windows 的文字识别（WinRT `OcrEngine`）是不是也把模型留在进程里，没量。
