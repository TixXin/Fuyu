# `pnpm tauri dev` 下的岛屿问题排查

日期：2026-11-15。代码基线：`ec40efdd`。只读排查，没有改代码。

用户反馈（原话）：「dev下的bug,还有dev启动后,第一次展开面板会闪一下面板 白屏,有时候岛屿会隐藏显示不见了,需要点任务栏的菜单图标才显示等」，并附了一张截图：WebView2 的崩溃页「此页存在问题」，错误代码 `STATUS_BREAKPOINT`。

## 1. 渲染进程崩溃（STATUS_BREAKPOINT）

### 崩的是哪个窗口

- 截图里崩溃页约 1025 × 575 像素，按 125% 缩放正好是 820 × 460，也就是 `main` 舞台窗口的默认尺寸（`tauri.conf.json`）。后面露出来的是设置窗口。
- 开发版的 WebView2 数据目录 `%LOCALAPPDATA%\com.tixxin.fuyu.lane-1\EBWebView\Crashpad\reports\` 里有两份转储：
  - `e6f8d687-….dmp`：2026-11-15 05:48:42
  - `dbc09061-….dmp`：2026-11-15 05:51:03（相隔约 2 分钟）
- 两份转储的 `ptype` 都是 `renderer`，页面地址是 `http://localhost:1420/`，不带 `?window=`，所以崩的是岛（`main`）。第二份转储里还能看到 `packages/plugin-base/src/client/connection.mjs`（插件平台第 3 版窗口端连宿主用的 WebSocket）。
- 正式版的数据目录 `%LOCALAPPDATA%\com.tixxin.fuyu\EBWebView\Crashpad\reports\` 里没有转储。

### 是什么崩的

- 两份转储的异常码都是 `0x80000003`（STATUS_BREAKPOINT），崩溃地址相同：`msedge.dll + 0x4da69c2`，WebView2 运行时版本 157.0.4341.46。
- Chromium 内存不足（V8 OOM）时，Windows 上报的是 `0xE0000008`。这里是 `0x80000003`，说明是 Chromium 内部的 `CHECK` / `NOTREACHED` / `IMMEDIATE_CRASH`。两次地址相同，所以每次都撞上同一处检查，不像随机的内存问题。
- 具体是哪个 `CHECK` 要拿 `msedge.dll` 的符号（微软公共符号服务器）把转储符号化才知道，这次没有做。

### 应用这边缺什么（正式版也一样）

- Rust 侧没有订阅 WebView2 的 `ProcessFailed` 事件（全仓库搜不到 `ProcessFailed`）。渲染进程一崩，窗口就一直停在崩溃页。岛是置顶窗口，崩溃页会盖在别的窗口上面，只能手动点「刷新」。
- 基础设施已经有了：`src-tauri/src/win32/webview_page.rs` 已经在用 `webview2-com`，`plugin_host` 里有 `with_webview` 的写法。

### 是不是只在 dev 下出现

- 目前只有开发版有转储。dev 下页面是 Vite 不打包的模块、开着 HMR，而且别的会话一直在改代码，页面反复热更新。正式版用的是同一个 WebView2 运行时，有没有同样的崩溃还不知道。
- 「崩了以后停在崩溃页」这个缺口正式版也有。

## 2. dev 启动后第一次展开面板白屏闪一下

还没有定论，有三个怀疑方向：

1. **舞台窗口在展开时变高。** `island/geometry.rs` 的 `apply_stage_geometry` 算出的舞台高度是 `max(460, 展开高度 × 展开缩放 + 上下留白)`。展开面板比 460 高时（开发版的数据是从正式数据复制过来的，展开尺寸和缩放调大过就会这样），`resize_stage` 会立刻 `set_size` 把窗口拉高。新露出来的那块 WebView 要等下一帧才有内容，这一帧可能画成白色。
2. **首次绘制很贵。** `expansion-performance.md` 测过：首次展开时 GPU 栅格化要一两百毫秒。原生窗口状态（点击激活、穿透区域）已经切到展开态，页面内容却还没画出来，中间这一下可能显示成白的。dev 下有 StrictMode 双挂载、模块不打包，首帧更慢，所以更容易看到。
3. **dev 专有的资源第一次加载。** 展开面板第一次用到的字体、图片由 Vite 现取。这个更可能造成内容晚出现，不太像整块白。

要靠录屏或 CDP 截帧确认是哪一种（见任务 D69）。还要问用户：正式版有没有这个现象、液态玻璃开没开、Windows 是浅色还是深色、白的是整块面板还是只有新长出来的边缘。

## 3. 岛有时看不见，要点托盘图标才出来

`main` 窗口在配置里是 `visible: false`。只有前端挂载后，在 `useIslandWindow.ts` 的 effect 里调用 `show_ready_island`，窗口才显示。所以只要前端没挂载，岛就看不见。dev 下有几条路会走到这里：

- **最可能：Rust 重新编译后重启。** 别的会话改了 `src-tauri/` 后，`pnpm tauri dev` 会重新编译并重启应用，窗口又从 `visible: false` 开始。这时如果有会话的前端文件写到一半，`main.tsx` 动态 import 失败，页面不挂载，岛就一直不显示。`devReload.ts`（`69a3ff80`、`a73ccaa7`）只在**下一次 Vite 更新**时重载页面；没有新的改动时，岛一直藏着。
- **托盘的「显示」不管页面挂没挂载。** `tray_visibility::reopen` → `island::show_island` 只是把窗口 `show` 出来，所以点托盘能让岛出现，这和用户描述的一样；但页面没挂载时，显示出来的是一块空白，要等下一次代码改动才恢复。
- **渲染进程崩溃。** 见第 1 节：崩的时候窗口还在，但只剩崩溃页，或者被刷新成空页。
- **用户自己的设置导致的（要确认）：** 最小化按钮在「最小化到托盘」设置下会 `hide_island`；贴边收成细条（C54.1）时几乎看不见；全屏游戏模式会自动收起（`gameMode.ts`）；开发版在正式版的岛挡着时会让到屏幕左侧四分之一处（`dev_lane/beside.rs`）。这几种不是 bug，但看起来都像「岛不见了」。

正式版不会因为代码改动而重启，也没有半写的文件，所以第一条只在 dev 下出现。第二条（显示出空白岛）正式版只有在前端启动失败时才会碰到。

## 4. 排查中发现的其他问题（「等」）

- **崩溃页不会自己恢复**（见第 1 节），正式版也一样。
- **旧的开发版数据目录还留着：** `%LOCALAPPDATA%` 和 `%APPDATA%` 下有 `com.tixxin.fuyu.lane-5/6/7/20/36/37`、`com.tixxin.fuyu.v3spike`、`com.tixxin.fuyu.lane-1.before-copy-1794684861186`，每个都带一份 `EBWebView`。lane 已经在 F32 去掉了，`pnpm prune:target` 只清 `src-tauri/target`，不清这些目录。不算正在用的 `lane-1`，这些目录在 `%LOCALAPPDATA%` 下一共约 570 MB（`before-copy` 134 MB，`lane-7` 108 MB，`lane-6` 100 MB，`lane-37` 76 MB，`v3spike` 54 MB，`lane-20` 44 MB，`lane-5` 41 MB，`lane-36` 12 MB），`%APPDATA%` 下约 11 MB。
- **托盘「显示」显示出空白岛**（见第 3 节）。

## 要用户提供的信息

1. 截图那次在做什么：刚启动、刚展开 / 收起、刚切页面，还是放着没动？当时是不是别的会话正在改代码？
2. 再崩时，把 `%LOCALAPPDATA%\com.tixxin.fuyu.lane-1\EBWebView\Crashpad\reports\` 里最新的 `.dmp` 的时间告诉我们，并在岛上按 F12 打开开发者工具（dev 下允许），把 Console 里崩溃前最后几行截图。
3. 正式版（安装的 0.3.8 / 0.3.9）有没有见过同样的崩溃页、首次展开白屏？
4. 白屏时：液态玻璃开没开、Windows 浅色还是深色、白的是整块面板还是只有新长出来的边缘？
5. 岛不见时：`pnpm tauri dev` 的终端里，前面是不是刚出现过 `Running ...\target\debug\fuyu.exe`（Rust 重启）？点了托盘以后，出来的岛是正常的还是一块空白？
