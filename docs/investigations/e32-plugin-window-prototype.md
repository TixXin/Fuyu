# E32 原型：插件独立窗口里的页面是否仍然隔离

> 日期：2026-11-14。任务 [E32](/docs/tasks/0-archive/E/E32.md)，issue 203。设计稿见 [plugin-windows.md](/docs/architecture/plugins/plugin-windows.md)，结论和对设计的修正写在它的第 9 节，这里记做法、原始结果和脚本要点。
>
> 环境：Windows 11 Pro for Workstations 10.0.26300，WebView2 运行时 157.0.4341.46，Tauri 2.12.5、wry 0.57.2、webview2-com 0.39.1，一块 3840×2160 的屏幕（缩放 125%）。

## 结论

**通过，E34 可以开始**，但设计稿有三处要按实测改：

1. **`WS_EX_NOACTIVATE` 挡不住小组件拿键盘焦点。** 前台窗口和小组件共用输入队列时（岛屿自己的窗口是前台，或小组件的所有者是桌面而桌面是前台），点一下小组件，它就成了前台窗口，键盘输入进了页面。合成宿主同样挡不住。原生层在窗口被激活时把激活和焦点还给原来的窗口，实测有效，E34 必须做这一步。
2. **同一插件的页面共用存储**，不是设计稿写的「各自独立」。窗口页面、同插件的另一个窗口、岛上的页面互相读得到 `localStorage`、Cookie、IndexedDB、Cache，也能用 `BroadcastChannel` 直接通信。不同插件之间读不到。
3. **透明不需要合成宿主。** 现有的窗口式宿主加 `WS_EX_NOREDIRECTIONBITMAP`（或 tao 用的 DWM 模糊区域做法）就是逐像素透明。

隔离本身没有变化：p8 第二轮的每一项在新窗口里结果相同。

## 做法

- 原型没有进主工作区。把 `src-tauri`（连同 `dist` 和编译期要读的几个文件）复制到仓库外的临时目录，在副本里加一个模块，只在设了环境变量 `FUYU_E32_ID` 时生效；用 `cargo build --release --features tauri/custom-protocol` 构建。
- 隔离：应用标识改成 `com.tixxin.fuyu.verification.e32<id>`，`FUYU_HOME` 指向临时目录。启动时跳过全部初始化（托盘、快捷键、链接注册、通知、Agent 钩子都不启动），岛屿前端的命令除两个只读的以外一律拒绝，所以不碰真实数据、注册表和正在运行的岛屿。岛屿、翻译、剪贴板三个 Tauri 窗口照常创建但不显示，Tauri 的命令通道在它们的页面里是好的（`plugin:app|version` 返回版本号），用来对照。
- 窗口：`RegisterClassW` 加 `CreateWindowExW` 建的 `WS_POPUP` 顶层窗口，不经过 Tauri 和 tao。页面用原样的 `win32::webview_page::create`，环境从岛屿的 webview 拿，资源、跳转规则、CSP 和注入脚本直接调用 `plugin_host::webviews` 里现有的函数。
- 副本里对 `webview_page.rs` 的改动只有增加：两个取控制器和 webview 的方法，一个用 `CreateCoreWebView2CompositionControllerWithOptions` 的 `create_composition`。拦截请求、拦截跳转、加固设置的代码没有动。
- 控制：原型在本机开一个端口，脚本用它新建、关闭、移动窗口，改层级，读每个窗口的状态和原生层的事件日志。页面里的检查通过 WebView2 的远程调试端口运行（`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=…`）。
- 键盘、鼠标和「显示桌面」用 `SendInput` 发真实输入，做之前征得用户同意。

## 1. p8 第二轮的检查

在两种窗口里各跑一遍：浮层（置顶、DWM 圆角、不透明底色）和小组件（`WS_EX_NOACTIVATE`）。两次结果完全相同。

| 检查 | 结果 |
|---|---|
| `__TAURI_INTERNALS__`、`__TAURI__`、`ipc`（页面和新建的空白框架里） | 都不存在。宿主对象没有。对照：岛屿页面里 `__TAURI_INTERNALS__` 存在，能调用命令 |
| `fetch` `http://ipc.localhost/…`、`http://tauri.localhost/`、`https://example.com/`（含 `no-cors`） | 都失败 |
| `fetch` 自己的文件 / `/../outside.json` / `/%2e%2e/outside.json` / `/..%2foutside.json` / `/..%5coutside.json` | 200 / 404 / 404 / 404 / 404 |
| 外部图片、WebSocket、Service Worker、`window.open` | 失败 / 失败 / 被 CSP 拒绝 / `null` |
| `RTCPeerConnection`（页面和空白框架） | `undefined` |
| `location.href` 指向外部网址、动态插入 `<meta refresh>` | 被取消，页面停在原地址 |
| iframe `src` 外部网址、`srcdoc` 里跳转、点击外部链接、表单提交 | 框架变成 `chrome-error://chromewebdata/`，来源是 `null`，里面没有内容 |
| 本机起一个 HTTP 服务器，页面用 `sendBeacon`、`fetch`、XHR、`EventSource`、图片、音视频、`<object>` / `<embed>`、`<link>` 的 dns-prefetch / preconnect / prefetch / preload / stylesheet / modulepreload / icon、CSS `url()` / `@import` / `@font-face`、`<a ping>`、`<meta refresh>`、Worker（含 blob）、`<script src>`、iframe、表单、`target=_blank` 链接、`window.open`、WebSocket、WebTransport、下载去访问它 | 服务器**没有收到任何请求**（脚本先从 Node 访问一次，确认服务器能记下请求） |
| `localStorage`、`indexedDB`、Cookie | 空 |
| 页面与宿主互发消息 | 正常。原型里没有插件进程，由原生层代答 |
| 关闭后页面目标消失；再次打开重新创建 | 正常 |

和 p8 一样没有做的：没有抓包确认 DNS 层面。

## 2. 键盘焦点和 Esc（浮层）

| 检查 | 结果 |
|---|---|
| 后台新建并要求焦点（用户没有操作过） | 窗口显示了，但**成不了前台窗口**，系统的前台锁挡住了 |
| 用鼠标点输入框 | 成为前台，输入框得到焦点，打字正常 |
| F5、F12 | 页面收到按键事件，但没有刷新，也没有打开开发者工具（`AreBrowserAcceleratorKeysEnabled` 关着） |
| Esc | 原生层在 `AcceleratorKeyPressed` 里先收到，标记已处理并隐藏窗口；页面没有收到这次按键，前台回到原来的程序 |
| 隐藏后由原生层再显示并给焦点（`SetForegroundWindow` 加 `MoveFocus`） | 成功，打字正常。这时用户刚操作过，所以前台锁放行 |

没有测：输入法、Alt+F4（默认处理会直接销毁窗口，E34 要接管 `WM_CLOSE`）、Tab 移出页面。

## 3. 不拿焦点的小组件

三种做法各测一遍。「同队列」指点击前前台是原型自己的浮层；「别的程序」指前台是另一个进程的窗口。

| 做法 | 同队列时点一下再打字 | 别的程序是前台时点一下再打字 | 鼠标点击、拖动 |
|---|---|---|---|
| 只有 `WS_EX_NOACTIVATE` | **小组件成了前台，字进了小组件的输入框** | 前台不变，字进了原来的程序 | 正常 |
| 合成宿主（没有子窗口，原生层转发鼠标）加 `WS_EX_NOACTIVATE` | **同上，字进了小组件** | 前台不变 | 正常 |
| `WS_EX_NOACTIVATE`，原生层在被激活时把激活和焦点还回去 | 前台仍是浮层，字进了浮层，小组件一个按键都没收到 | 前台不变 | 正常 |

- 原因：窗口式宿主里，鼠标落在 WebView2 的子窗口上，它属于浏览器进程，对 `WM_MOUSEACTIVATE` 自己回答「激活」，不问我们的窗口，所以原型窗口上返回 `MA_NOACTIVATE` 的处理根本没被调用。合成宿主里没有子窗口，`WM_MOUSEACTIVATE` 到了我们手里，但把鼠标按下转发给 WebView2 之后，它自己把窗口激活并取得焦点。
- 所有者是桌面（`Progman`）的小组件，在「显示桌面」之后桌面是前台，也属于同队列：只有 `WS_EX_NOACTIVATE` 的那个被点后成了前台并拿到焦点，带「还回去」的那个没有，前台仍是桌面，打的字没有进页面。
- 「还回去」的做法：窗口收到 `WM_ACTIVATE`（变为活动）时记下 `lParam` 里原来的活动窗口，收到 `WM_SETFOCUS` 时记下 `wParam` 里原来的焦点窗口，然后给自己投递一条消息；处理这条消息时，以及控制器的 `GotFocus` 事件里，调用 `SetActiveWindow(原来的活动窗口)` 和 `SetFocus(原来的焦点窗口)`。从激活到还回去之间隔一轮消息循环，这中间到达的按键理论上会进页面；测试是点击之后隔半秒再打字，没有专门测这个间隙。
- 页面里 `document.hasFocus()` 在被点之后是 `true`，哪怕键盘并不在它那里。页面本来就能自己画一个假的光标，这一点不算新的风险。
- 没有验证：前台是别的程序、而小组件仍然抢到前台的情况。原型里为它准备了「记住最近一个别的程序的前台窗口，再 `SetForegroundWindow` 还回去」的分支，但测试里这种情况没有出现，分支没有走到。

## 4. 透明和圆角

在一块洋红色的底板上放七个窗口截图比较。

| 窗口 | 结果 |
|---|---|
| 不透明底色加 DWM 圆角（`DWMWA_WINDOW_CORNER_PREFERENCE`） | 圆角和系统阴影都有 |
| 页面背景透明，窗口不做任何处理 | 透明的地方是**黑色** |
| 页面背景透明，窗口带 `WS_EX_NOREDIRECTIONBITMAP` | 逐像素透明，半透明的卡片和底板正确混色 |
| 页面背景透明，窗口用 `DwmEnableBlurBehindWindow` 加空区域（tao 给透明窗口用的做法） | 同上 |
| 上一种再加 `WS_EX_LAYERED` 和整体透明度 | 逐像素透明和整体透明度同时生效 |
| 不透明底色加圆角加整体透明度 | 正常 |
| 合成宿主（DirectComposition）加 `WS_EX_NOREDIRECTIONBITMAP` | 逐像素透明，显示正常 |

- 窗口式宿主里，页面完全透明的像素仍然接收鼠标：盖在别的窗口上时，点透明的角落，点击被上面的页面吃掉，下面的窗口收不到。
- 整个窗口点击穿透（`WS_EX_TRANSPARENT` 加 `WS_EX_LAYERED`）正常：点击到了下面的窗口，上面的页面没收到。

## 5. 拖动

| 做法 | 结果 |
|---|---|
| 页面在 `mousedown` 时发消息，原生层 `ReleaseCapture` 后给窗口投递 `WM_NCLBUTTONDOWN`（`HTCAPTION`） | 浮层和小组件都跟着鼠标走，位移和鼠标一致 |
| 页面里的 CSS `app-region: drag`，打开 `ICoreWebView2Settings9::IsNonClientRegionSupportEnabled` | 能拖 |
| CSS `app-region: drag`，不打开那个设置 | 拖不动 |

## 6. 存储

同一个隔离实例里开四个页面：窗口 a1、a2 和挂在岛屿窗口里的 a3 属于插件 A，窗口 b1 属于插件 B。在 a1 里写入后各处读取。

| | a2、a3（同插件） | b1（另一个插件） | 岛屿页面 |
|---|---|---|---|
| `localStorage`、Cookie、IndexedDB、Cache | **读得到** | 读不到 | 读不到（来源不同） |
| `sessionStorage` | 读不到 | 读不到 | — |
| `BroadcastChannel` | **收得到** | 收不到 | — |

- a1 关掉再开，数据还在；插件 A 的页面全关、只留插件 B 的页面，再开 a1，数据也还在。**所有 InPrivate 页面都关掉之后**再开，数据才清空。也就是说 InPrivate 的会话是整个应用共用的一个，按来源分隔，不落盘。
- 对插件的含义：页面里的存储不可靠（什么时候清空取决于别的插件有没有页面开着），要留的东西用 `storage` 接口。

## 7. 内存

同一实例全部 `msedgewebview2.exe` 的私有内存合计，每种状态稳定后量两次。

| 状态 | 合计 | 进程数 |
|---|---|---|
| 没有窗口 | 293.8 MB | 8 |
| 1 个窗口 | 314.5 MB | 9 |
| 4 个窗口（同一插件） | 390.5 MB | 12 |
| 8 个窗口（同一插件） | 493.5 MB | 16 |
| 4 个窗口（4 个插件） | 399.2 MB | 12 |
| 8 个窗口（8 个插件） | 498.0 MB | 16 |

每个窗口一个渲染进程，约 21 到 26 MB，同一插件的多个窗口也不共用进程。关掉后进程数回到 8；内存回到 294 到 320 MB，前后开关 25 个页面后基线高了约 26 MB，没有继续追查是缓存还是泄漏。

## 8. 「显示桌面」

七个 `WS_EX_NOACTIVATE` 的窗口，按 Win+D 后在每个窗口的固定位置取屏幕像素，并截整排的图确认。

| 层级 | 平时 | Win+D 之后 |
|---|---|---|
| 普通 | 和普通窗口一样参与前后顺序 | 看不见 |
| 放到最底（`HWND_BOTTOM`） | 在别的窗口下面 | 看不见 |
| 所有者设为桌面（`GWLP_HWNDPARENT` 指向 `Progman`） | 在别的窗口下面 | **看得见**，能点击 |
| 同上，合成宿主 | 在别的窗口下面 | 看得见，能点击 |
| 置顶 | 在最上面 | 看得见，能点击 |
| 最底，Win+D 之后临时改成置顶 | 在别的窗口下面 | 改完就看得见 |

再按一次 Win+D，窗口都恢复。所有者设为桌面的窗口在「显示桌面」时被点击会成为前台，见第 3 节。

## 没有做的

- 合成宿主只确认了能显示、透明、鼠标点击和拖动；光标样式、输入法、触摸和拖放没有接。它在焦点上没有好处，透明也不需要它，所以没有再往下做。
- 多显示器、不同缩放的显示器之间移动、用户拉伸窗口、系统休眠和显卡重置后的恢复。
- 「把前台还给别的程序」的分支（见第 3 节）。
- 字符映射表当对照窗口的那一轮没有测成：脚本用了没按缩放换算的坐标，点到了桌面上。前台是别的程序的情况以更早两轮里 WinForms 窗口的结果为准。

## 附录：脚本要点

脚本和原型代码在本机临时目录，不进仓库。复现时照此重写。

- **原型模块**：`start()` 起一个 `tiny_http` 线程，每个请求用 `run_on_main_thread` 转到主线程执行。`/create` 的参数对应窗口的各个选项：`noactivate`、`topmost`、`noredir`、`blur`、`round`、`alpha`、`clickthrough`、`bg`（底色）、`focus`、`esc`、`ncregion`、`comp`（合成宿主）、`refocus`（把焦点还回去）、`parent=island`（不建窗口，页面挂在岛屿窗口里）。`/state` 返回前台窗口、焦点窗口和每个窗口的位置、可见性、事件日志（`WM_ACTIVATE`、`WM_SETFOCUS`、`WM_MOUSEACTIVATE`、控制器的 `GotFocus` / `LostFocus` / `AcceleratorKeyPressed`、页面消息）。`/layer` 改层级和所有者。
- **示例页面**：一个输入框、一个按钮、两条拖动条（发消息的和 CSS 的），把收到的键盘、鼠标、焦点事件和消息记在 `window` 上，供远程调试读取。`?mode=` 切换不透明和透明两种背景。
- **`probe.mjs`**：先起本机 HTTP 服务器并自己访问一次，然后在页面里依次做第 1 节的检查，最后读服务器收到的请求。iframe 的实际内容要连到调试端口列出的 iframe 目标里去读：目标列表里显示的是它想去的网址，不是它实际加载的内容。
- **`storage.mjs`、`memory.mjs`**：第 6、7 节。内存用 PowerShell 按命令行里的应用标识筛出 `msedgewebview2.exe`，加总 `PrivateMemorySize64`。
- **`transp.mjs`**：建底板和七个窗口，用 `Graphics.CopyFromScreen` 截图。
- **`input*.mjs`**：页面元素的屏幕坐标 = 窗口位置 + `getBoundingClientRect()` × `devicePixelRatio`。输入用 PowerShell 里的 `SendInput`。打字之前先确认前台是预期的窗口，不是就跳过。要一个别的进程的窗口接收按键时，用 PowerShell 起一个带文本框的 WinForms 窗口，把内容写到文件里。
- 发输入和量坐标的 PowerShell 进程都要先调 `SetProcessDpiAwarenessContext(-4)`，否则拿到的是按缩放换算过的坐标。上面那次点偏就是因为列窗口的脚本漏了这一步。
- 隔离实例启动时，WebView2 会让一个隐藏的窗口成为前台，用户正在打字的窗口会失去焦点。启动前记下前台窗口，启动后让原型把前台还回去。
