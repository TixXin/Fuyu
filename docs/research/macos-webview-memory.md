# macOS 上 Tauri / WKWebView 应用的内存

> 日期：2026-11-20。问题：Mac 上浮屿内存占用高，外面有哪些已知原因和做法。范围：objc2 文档与 issue、Apple 开发者论坛、WebKit Bugzilla、Tauri / Vite 的 GitHub issue 和讨论、几篇 Tauri 菜单栏应用的实测文章。我们自己的实测和改动见 [investigations/macos-memory.md](../investigations/macos-memory.md)。

## 结论

- **后台线程调 AppKit / Foundation 要自己套 autorelease pool。** objc2 的 `Retained` 只是「有时」能让对象不进 pool（要内联、要开优化），debug 构建基本进 pool。macOS 给每个线程一个兜底 pool，但长期运行的线程（轮询线程、tokio 的 `spawn_blocking` 线程会被复用）里它几乎不排空，Apple DTS 叫它「abandoned memory」。做法：每一轮轮询、每个调 Cocoa 的阻塞闭包外面包 `objc2::rc::autoreleasepool(|_| …)`。
- **取应用图标别用 `TIFFRepresentation`。** `iconForFile` 给的 `NSImage` 带 16–1024@2x 全部尺寸，转 TIFF 会把每张都画出来，一份约 70 MB。用 `CGImageForProposedRect:context:hints:` 传目标尺寸，只取最接近的一张，再按需缩放。
- **每个 WKWebView 基本是一个独立的 WebContent 进程**（到 WebKit 内部上限之后才共享），`WKProcessPool` 从 macOS 12 起不再起作用，没法强制共享。隐藏的窗口占着它的进程不放；不常用的窗口关掉就销毁，热窗口才常驻隐藏。
- **WebKit 自己会在内存压力下释放缓存**（每 30 秒查一次自己的 footprint，后台页面会 `releaseMemory`），但不会把 JS 里攒着的对象放掉。
- **前端上大的开销**：`backdrop-filter` 一般会在根上多出一张屏幕大小的合成层；`will-change` / `translateZ(0)` 每个元素一层，只在动画期间加；大的 base64 data URL 同时占 JS 字符串和解码后的位图，能缩就在 Rust 侧先缩。
- **Vite 开发服务器的 HMR 会让页面内存一直涨**：每次热更新以新 URL 重新导入模块，浏览器不回收旧的模块记录。维护者说要等规范改动才能修。开发版的数字不能当基线；长时间开着的开发版隔一段时间整页刷新。
- **量法**：Activity Monitor 的「内存」列就是 `phys_footprint`（脏页，含压缩和换出），不是 RSS。浮屿的占用要把主进程、WebContent、GPU、Networking 几个 WebKit 辅助进程和插件宿主 `node` 加起来，用 `footprint <pid…>`，而且要量正式构建。

## 详细

### autorelease pool

- objc2 文档：`Retained::retain_autoreleased` 「can sometimes avoid putting the object into the autorelease pool」，是尽力而为。
- Apple 论坛（Quinn）：每个线程现在都有兜底 pool，对象不算严格意义的泄漏，但长寿线程上等于永远不释放；用 Instruments 的 Allocations「generation」分析找。`OBJC_DEBUG_MISSING_POOLS=YES` 能报出没有 pool 的 autorelease，不过现在大多是噪音。
- Apple 文档：长期运行的线程应定期排空 pool。

### 小图标

- noodlesoft 的文章和 Cocoa Drawing Guide：`CGImageForProposedRect` 按给的矩形挑最合适的表示，不画其他尺寸；拿到的不一定正好是要的大小，要检查再缩。
- 也可以遍历 `representations`，挑不小于目标的最小一张画进固定大小的 `NSBitmapImageRep`。
- QuickLook 缩略图不适合取应用图标（DTS 建议用 NSWorkspace；`QLThumbnailGenerator` 在 macOS 26 上有缓存问题）。

### WKWebView 进程

- `WKProcessPool` 已弃用，多个 pool 不再有效果。
- 一篇 Tauri v2 菜单栏应用的实测：隐藏状态 4 个 WebKit 进程合计约 159 MB，同样功能的 SwiftUI 版约 63 MB。销毁窗口能省下进程，代价是每次打开都要冷启动。
- 隐藏页面的定时器照跑，要按可见性停。
- WebKit 的内存压力处理：WebContent 进程定期检查 footprint 并分档释放；macOS 上可能先挂起进程、来不及跑处理函数；不可见又不放声音的页面在压力大时可能被杀掉。
- Tauri #5889：macOS 上 WebKit 的内存比 Electron 高，部分是共享页算法的差别。GPU 进程和 WebContent 的记账方式不同，GPU 进程七十来 MB 属于正常。

### 前端

- WebKit Bugzilla 271340 / 273611：`backdrop-filter` 强制合成，常在根上多一张屏幕大小的层。
- WebKit Bugzilla 240865 / 218422：`will-change`、无限动画让层和 GPU 一直占着。
- base64 图片：JS 堆里是编码后的字符串，WebCore 里还有解码的位图；可以改 `Blob` + `URL.createObjectURL`（用完 revoke）或 Tauri 的 asset 协议（未核实具体省多少）。
- Vite 讨论 14438、vite-plugin-react #116：HMR 的模块记录不回收。

### 量法

- `footprint(1)` 手册：`phys_footprint` 包含脏页、压缩 / 换出的页、不可清除的 purgeable、IOKit 映射和页表；`vmmap` 的 DIRTY 不含压缩页，所以两者对不上。
- WWDC22「Profile and optimize your game's memory」讲 footprint 的组成。
- WebKit 文档「Memory Inspection」。

## 来源

- https://docs.rs/objc2/latest/objc2/rc/struct.Retained.html
- https://docs.rs/objc2/latest/objc2/rc/fn.autoreleasepool.html
- https://developer.apple.com/forums/thread/747563
- https://developer.apple.com/forums/thread/716261
- https://developer.apple.com/documentation/foundation/nsautoreleasepool
- https://developer.apple.com/documentation/appkit/nsworkspace/icon(forfile:)
- https://www.noodlesoft.com/blog/?p=316
- https://developer.apple.com/library/content/documentation/Cocoa/Conceptual/CocoaDrawingGuide/Images/Images.html
- https://developer.apple.com/forums/thread/805177
- https://developer.apple.com/documentation/webkit/wkprocesspool
- https://dev.to/hiyoyok/building-a-menubar-app-with-tauri-v2-what-nobody-tells-you-9a2
- https://dev.to/tinyforge/tauri-cold-launch-was-1s-heres-how-i-got-it-to-feel-instant-32lh
- https://bugs.webkit.org/show_bug.cgi?id=167491
- https://bugs.webkit.org/show_bug.cgi?id=256332
- https://bugs.webkit.org/show_bug.cgi?id=274396
- https://bugs.webkit.org/show_bug.cgi?id=269302
- https://bugs.webkit.org/show_bug.cgi?id=271340
- https://bugs.webkit.org/show_bug.cgi?id=273611
- https://bugs.webkit.org/show_bug.cgi?id=240865
- https://bugs.webkit.org/show_bug.cgi?id=218422
- https://github.com/tauri-apps/tauri/issues/5889
- https://github.com/tauri-apps/tauri/issues/4026
- https://github.com/vitejs/vite/discussions/14438
- https://github.com/vitejs/vite-plugin-react/issues/116
- https://keith.github.io/xcode-man-pages/footprint.1.html
- https://developer.apple.com/videos/play/wwdc2022/10106/
- https://docs.webkit.org/Infrastructure/MemoryInspection.html
