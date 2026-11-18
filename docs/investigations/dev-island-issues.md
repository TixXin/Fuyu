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

用户补充（2026-11-15）：液态玻璃没开；Windows 上，浅色深色都会；白的是**整块面板**；正式版似乎也有。所以这不是 dev 专有的问题，和原生液态玻璃也无关。「整块面板白」比「只有新长出来的边缘白」更像下面第 2 条：面板第一次绘制没赶上。

还没有定论，有三个怀疑方向：

1. **舞台窗口在展开时变高。** `island/geometry.rs` 的 `apply_stage_geometry` 算出的舞台高度是 `max(460, 展开高度 × 展开缩放 + 上下留白)`。展开面板比 460 高时（开发版的数据是从正式数据复制过来的，展开尺寸和缩放调大过就会这样），`resize_stage` 会立刻 `set_size` 把窗口拉高。新露出来的那块 WebView 要等下一帧才有内容，这一帧可能画成白色。
2. **首次绘制很贵。** `expansion-performance.md` 测过：首次展开时 GPU 栅格化要一两百毫秒。原生窗口状态（点击激活、穿透区域）已经切到展开态，页面内容却还没画出来，中间这一下可能显示成白的。dev 下有 StrictMode 双挂载、模块不打包，首帧更慢，所以更容易看到。
3. **dev 专有的资源第一次加载。** 展开面板第一次用到的字体、图片由 Vite 现取。这个更可能造成内容晚出现，不太像整块白。

要靠录屏或 CDP 截帧确认是哪一种（见任务 D69）。还要问用户：正式版有没有这个现象、液态玻璃开没开、Windows 是浅色还是深色、白的是整块面板还是只有新长出来的边缘。

### 录帧结果（2026-11-15，D69，没有复现白帧）

做法：`src-tauri/target/release/fuyu.exe`（2026-11-15 01:49 构建）的诊断副本，用通知验收的独立标识（`FOCUSD_VERIFY_NOTIFICATIONS=1` 加 32 位运行号）隔开应用数据和 WebView2 数据，开远程调试。每次是新进程第一次展开：CDP `Page.startScreencast` 录页面合成出的每一帧，ffmpeg `ddagrab` 以 120 fps 录屏幕上真实显示的画面（桌面复制，含 DWM 合成），同时记 rAF 间隔。屏幕 3840 × 2160，缩放 125%。液态玻璃关（`classic`）。展开用 CDP 的鼠标事件点收起的岛。测完诊断副本都已退出，数据目录已删。

| 场景 | 主题 | 首次展开最大 rAF 间隔 | 屏幕上有没有白帧 |
|---|---|---:|---|
| 新数据目录（只启动过一次写设置），默认布局 | 深色 | 83.3 ms | 没有：面板从黑色长出来，内容淡入 |
| 同上 | 浅色 | 83.3 ms | 没有：面板是设计的浅灰 `#f2f2f5`，亮度平滑升到终值，没有超过终值的一帧 |
| 用过的数据目录，默认布局 | 深色 | 8.7–16.3 ms | 没有 |
| 新数据目录，布局同用户（面板高 490、展开缩放 1） | 深色 | 233.4 ms | 没有：卡住的这段时间屏幕停在收起的岛，然后直接出现画完的黑色面板，没有长出来的动画 |
| 同上，展开前先让窗口拿到焦点 | 深色 | 125.1 ms | 没有，现象同上 |

结论：

- **页面本身没有画过白色。** 深色主题下，CDP 截到的每一帧面板都是黑的；`.island` 背景是 `rgb(0, 0, 0)`，岛屿相关的 CSS 里也没有会露出白色的回退色（`IslandShell.css` 的背景是 `var(--island-fill, var(--island-background-color))`，后者在 `IslandApp.css` 定义）。所以第 1 条怀疑（主题变量没生效露出白底）可以排除。
- **屏幕上也没录到白帧。** 第 2 条（首次栅格化慢）确实存在：第一次展开会卡 83–233 毫秒，但卡的时候屏幕停在上一帧（收起的岛），不是白的；布局同用户时，卡完直接跳到画完的面板，展开动画整个被吞掉。
- **第 3 条（舞台变高）不是每次启动都有。** 舞台高度只取决于设置里的面板高度（`max(460, 展开高度 × 缩放 + 24)`），启动时 `show_ready_island` 就按它定好了，第一次展开不会再变高。
- 所以在这台机器上、用自动点击，复现不出「整块面板白一下」。和用户实际操作还差两样没能模拟：真鼠标点击（会激活窗口；用 `SendInput` 点会动用户的鼠标，已停用），以及用户自己的完整数据（插件页、待办内容等；复制用户数据做诊断被拦下，已删掉复制的那份）。

顺带发现：诊断副本第一次加载页面时，前端始终没有把窗口显示出来（`is_visible` 6 秒以上都是 `false`，页面已经挂载、岛是收起态）；刷新页面后正常显示。控制台里只有「插件宿主还没初始化」这类启动竞态的报错。是不是只在诊断副本（远程调试端口、通知验收模式）里出现还没确认，可能和第 3 节「岛有时看不见」有关，没有在 D69 里处理。

下一步要用户提供：白闪时用手机录一段慢动作视频（或 Win+Alt+R 录屏），看清白的那一下有多长、在面板长出来之前还是之后、白的范围是不是正好是展开后的面板；以及是点开的、悬停展开的，还是消息弹出来时展开的。

### 源码复核与修复落地（2026-11-18，D69）

结合 `D97.2`（折叠态休眠卸载 `<IslandPages />`）合入后的当前 `HEAD` 与底层 `wry` / `tao` WebView2 初始化路径复审，定位到三处具体根因并落地前两项修复（第三项因并行会话 `C90` 正在改 `island/glass.rs` 移交 `D56.3` 清理）：

1. **窗口隐藏期无效预热 + 首次展开 Frame 0 同步冷挂载尖峰**
   - 根因：`useIslandPreparing.ts` 在 `main` 窗口尚未完成初始交互同步与 `show_ready_island` 可见化时即跑完定时器并卸载 `<IslandPages />`，可见 HWND 从未完成展开层 GPU 瓦片预热；随后首次展开在 Frame 0 同一帧内同时发起 `.island--expanded` 外壳过渡与整棵面板组件树的同步冷挂载（实测 83–233 ms），吞掉前 120 ms `fadeDelay` 并在合成器超时或深浅过渡时闪出空白/浅色帧。
   - 修复：`useIslandPreparing.ts` 监听页面可见状态与初始窗口尺寸同步窗口期，确保可见窗口完成 GPU 瓦片预热后再休眠；`IslandShell.tsx` 在折叠态 `onPointerEnter` / `onPointerDown` 提前激活短暂预唤醒（无操作自动过期重新休眠），让点击松手或悬停展开前已完成 `<IslandPages />` 挂载；`panelAwake.ts` 与 `IslandPages.tsx` 对未预唤醒的快捷键/消息冷展开采用 `1-rAF` 外壳先行（Frame 0 先零阻塞启动纯色外壳形变，Frame 1 在 `fadeDelay` 面板透明窗口期内挂载内容）。
2. **插件子 WebView2 未设透明创建选项且导航完成前提前置顶显示**
   - 根因：`src-tauri/src/win32/webview_page.rs` 调用 `CreateCoreWebView2ControllerOptions()` 时未通过 `ICoreWebView2ControllerOptions3::SetDefaultBackgroundColor` 设 `(0, 0, 0, 0)` 全透明底色；且 `AddScriptToExecuteOnDocumentCreated` 与 `Navigate` 尚未完成首帧文档加载时，`src-tauri/src/plugin_host/webviews.rs` 已通过 `page.place(...)` 立即调用 `SetIsVisible(true)` 与 `SetWindowPos(HWND_TOP)` 将纯白 `#FFFFFF` 子控制器置顶露白。
   - 修复：创建控制器选项时通过 `ICoreWebView2ControllerOptions3` 设全透明默认背景 `(0, 0, 0, 0)`；在 `Page` 内引入 `VisibilityGate` 记录目标可见意图（`SetBounds` 仍立即生效以保证首帧视口尺寸准确），待首次 `NavigationCompleted` 后再执行 `SetIsVisible(true)` 与置顶，并收严 `webviews.rs` 异步创建与关闭的 `generation` 校验。
3. **`island/glass.rs` 遗留死代码强制擦除重绘（待 `C90` 合入后随 `D56.3` 清理）**
   - 根因：Windows `src-tauri/src/island/glass.rs` 首次同步仍调用已废弃的 `window_vibrancy::clear_acrylic` 与 `SetWindowRgn(hwnd, None, true)`（`bRedraw = true` 同步擦除重绘整个 HWND）。为避免与正在修改 `glass.rs` 的并行会话 `C90` 冲突，留待 `C90` 合入后在 `D56.3` 一并移除。

## 3. 岛有时看不见，要点托盘图标才出来

`main` 窗口在配置里是 `visible: false`。只有前端挂载后，在 `useIslandWindow.ts` 的 effect 里调用 `show_ready_island`，窗口才显示。所以只要前端没挂载，岛就看不见。dev 下有几条路会走到这里：

- **最可能：Rust 重新编译后重启。** 别的会话改了 `src-tauri/` 后，`pnpm tauri dev` 会重新编译并重启应用，窗口又从 `visible: false` 开始。这时如果有会话的前端文件写到一半，`main.tsx` 动态 import 失败，页面不挂载，岛就一直不显示。`devReload.ts`（`69a3ff80`、`a73ccaa7`）只在**下一次 Vite 更新**时重载页面；没有新的改动时，岛一直藏着。
- **托盘的「显示」不管页面挂没挂载。** `tray_visibility::reopen` → `island::show_island` 只是把窗口 `show` 出来，所以点托盘能让岛出现，这和用户描述的一样；但页面没挂载时，显示出来的是一块空白，要等下一次代码改动才恢复。
- **渲染进程崩溃。** 见第 1 节：崩的时候窗口还在，但只剩崩溃页，或者被刷新成空页。
- **用户自己的设置导致的（要确认）：** 最小化按钮在「最小化到托盘」设置下会 `hide_island`；贴边收成细条（C54.1）时几乎看不见；全屏游戏模式会自动收起（`gameMode.ts`）；开发版在正式版的岛挡着时会让到屏幕左侧四分之一处（`dev_lane/beside.rs`）。这几种不是 bug，但看起来都像「岛不见了」。

正式版不会因为代码改动而重启，也没有半写的文件，所以第一条只在 dev 下出现。第二条（显示出空白岛）正式版只有在前端启动失败时才会碰到。

### 页面已挂载、岛却被藏起来（2026-11-15，D71）

原因是 `1e1f1c4d`（2026-11-14，启动时显示岛不抢焦点）。它把 `show_ready_island` 里的 `window.show()` 换成了直接调 Win32 `ShowWindow(SW_SHOWNOACTIVATE)`，绕过了 tao。tao 自己记着一份窗口标志，它不知道窗口已经显示，记的还是「不可见」。之后有三处会出问题（tao 0.37.2，`platform_impl/windows/window_state.rs` 的 `apply_diff` 和 `window.rs` 的 `set_focus`）：

- **岛被藏起来。** 只要 tao 改一次窗口标志，`apply_diff` 发现新标志里没有 `VISIBLE`，就 `ShowWindow(SW_HIDE)`。光标穿透循环（`island/passthrough.rs`）在光标进出岛的范围时调 `set_ignore_cursor_events`，这正是一次标志改动。所以岛启动后能显示出来，但光标第一次碰到岛（或者刚启动时光标就停在岛的位置）就会消失。D69 诊断副本里 `is_visible` 一直是 `false`、D71 第一次复现时先 `true` 后 `false`，都是这样。刷新页面会再走一遍原生显示，所以「刷新后正常」，直到光标再碰到岛。点托盘走 `show_island` → `window.show()`，tao 的标志从这时起是对的，之后就不会再藏起来，和用户描述的「点托盘才出来」一致。
- **托盘「隐藏」和「最小化到托盘」失灵。** `hide_island` 调 `window.hide()`，tao 认为本来就隐藏着，标志没变化，什么都不做。
- **聚焦失灵。** tao 的 `set_focus()` 先看自己记的 `VISIBLE`，没有就直接返回，所以快捷键呼出（`focus_island_for_shortcut`）等地方的聚焦都不起作用。

改法（D71）：

- `island/focus.rs` 的 `show_island_at_startup` 改回用 tao 的 `window.show()`，tao 的状态始终是对的。为了保留 `1e1f1c4d` 的目的（不抢正在打字的窗口的焦点），显示前记下前台窗口；显示后岛成了前台，就用 `bring_to_foreground` 把前台还给它。
- `show_ready_island` 失败时在 stderr 记一行 `could not show the island at startup: …`。
- `useIslandWindow.ts`：`show_ready_island` 失败后按 0.3、1、3 秒重试，都失败就把「已显示」的标记清掉，下一次原生同步之后再试；原生同步超过 1.5 秒没返回，就不再等它，先显示岛。

没做 Rust 侧「窗口创建后多少秒还没显示就显示出来」的兜底：这次的岛是先显示、后被藏起来的，定时兜底拦不住；页面没挂载时显示出来的也只是一块透明的空窗口。

复测（release exe 的诊断副本，通知验收的独立标识加 32 位运行号，临时 `FUYU_HOME` 和 WebView2 目录，开远程调试；每次跑完核对 `~/.claude/settings.json`、`~/.claude/CLAUDE.md`、`~/.codex/config.toml`、`~/.gemini/config/hooks.json`、`~/.fuyu/settings.json` 的哈希都没变）。页面挂载后轮询 `is_visible`，6–12 秒后再经页面调两次 `toggle_maximize`，让 tao 改一次窗口标志：

| exe | 次数 | 结束时可见 | 改标志后可见 |
|---|---:|---|---|
| 改前（06:21 构建） | 3（新数据目录） | 2 次 `false`（先 `true` 后被藏），1 次 `true` | 2 次都 `false` |
| 改后（08:54 构建） | 4 次新数据目录 + 同一数据目录 2 次 | 6 次都 `true` | 6 次都 `true` |

改前那 1 次没被藏，是那几秒里光标没有进出岛的范围；改标志的那一步每次都能把岛藏起来。

没测的：启动时焦点是不是还给了原来的窗口、托盘隐藏、快捷键聚焦，这些要真鼠标和真键盘，见任务 D71 的「验收」。

D71 第一次复现时脚本把空运行号传了进去，诊断副本没拿到独立标识，用了正式标识和临时 `FUYU_HOME`，把本机 Claude Code、Codex、Antigravity 的钩子路径改到了临时目录；已改回 `C:\Users\tixxin\.fuyu`。之后的脚本先校验运行号是 32 位十六进制、启动后确认没有从正式数据目录复制数据，否则立即结束进程。

## 4. 排查中发现的其他问题（「等」）

- **崩溃页不会自己恢复**（见第 1 节），正式版也一样。
- **旧的开发版数据目录还留着：** `%LOCALAPPDATA%` 和 `%APPDATA%` 下有 `com.tixxin.fuyu.lane-5/6/7/20/36/37`、`com.tixxin.fuyu.v3spike`、`com.tixxin.fuyu.lane-1.before-copy-1794684861186`，每个都带一份 `EBWebView`。lane 已经在 F32 去掉了，`pnpm prune:target` 只清 `src-tauri/target`，不清这些目录。不算正在用的 `lane-1`，这些目录在 `%LOCALAPPDATA%` 下一共约 570 MB（`before-copy` 134 MB，`lane-7` 108 MB，`lane-6` 100 MB，`lane-37` 76 MB，`v3spike` 54 MB，`lane-20` 44 MB，`lane-5` 41 MB，`lane-36` 12 MB），`%APPDATA%` 下约 11 MB。用户 2026-11-15 定：直接删掉，不另开任务；由用户自己删（会话里的删除命令被自动模式拦下）。
- **托盘「显示」显示出空白岛**（见第 3 节）。

## 要用户提供的信息

1. 截图那次在做什么：刚启动、刚展开 / 收起、刚切页面，还是放着没动？当时是不是别的会话正在改代码？
2. 再崩时，把 `%LOCALAPPDATA%\com.tixxin.fuyu.lane-1\EBWebView\Crashpad\reports\` 里最新的 `.dmp` 的时间告诉我们，并在岛上按 F12 打开开发者工具（dev 下允许），把 Console 里崩溃前最后几行截图。
3. 正式版（安装的 0.3.8 / 0.3.9）有没有见过同样的崩溃页、首次展开白屏？
4. 白屏时：液态玻璃开没开、Windows 浅色还是深色、白的是整块面板还是只有新长出来的边缘？
5. 岛不见时：`pnpm tauri dev` 的终端里，前面是不是刚出现过 `Running ...\target\debug\fuyu.exe`（Rust 重启）？点了托盘以后，出来的岛是正常的还是一块空白？
