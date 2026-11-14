# Mac 上的插件自定义网页（G1.15 研究）

插件的 `webview` 模板在 Windows 上是一块独立的 WebView2 页面，叠在岛屿上；Mac 上现在只显示一行「暂不支持」（G1.16）。这份文档回答两件事：在 Mac 上做出来要改什么、花多大力气，以及值不值得现在做。结论在最后。

2026-11-14，会话「Issue处理优先级」，读的是当时 `main` 上的代码。

## 现在谁在用

| 插件 | 页面 | Mac 上能用的部分 |
|---|---|---|
| 系统监控（官方） | 监控页，约 1000 行 HTML/CSS/JS | 无：数据来自 Windows 专用接口，清单已标只支持 Windows |
| 待办进度环（官方） | 一个环，约 300 行 | 收起条上的状态项 |
| 天气（官方，待上架） | 预报页，约 700 行 | 收起条上的状态项、降雨提醒 |
| 两个第三方插件 | 都没用 | 全部 |

也就是说，做出来以后 Mac 上直接多出来的，是待办进度环和天气两个页面。

## Windows 上是怎么做的

代码分两层：

- `plugin_host/webviews.rs`：和平台无关的部分。每个插件一个来源 `https://<插件 id>.plugin.focusd.invalid`，文件只从插件文件夹里读（`resource_path`、`serve`，单个文件有大小上限），固定的 CSP，只许在自己的来源里导航（`may_navigate`），页面 API 脚本 `INIT_SCRIPT`（`acquireFuyuApi()`：`locale`、`postMessage`、`onMessage`、`getState`、`setState`，主题变量 `--fuyu-*`），页面消息的解析和转给插件进程，页面状态的保存。这些都是纯函数或普通 Rust，可以直接复用。
- `win32/webview_page.rs`：WebView2 本身。通过 `PageHost` 接口（`resource`、`may_navigate`、`message`、`escape`、`focused`）回到上一层。做的事：建控制器并挂到岛屿窗口上，拦截请求提供文件，禁掉新窗口、下载、权限申请、宿主对象、开发者工具（开发模式除外），收发消息，按 Esc 收起岛屿，记录焦点，摆位置，设背景色。
- `webviews.rs` 里还有一小段 Windows 专用的：`place_or_create`、`start_page` 用 Tauri 的 `with_webview` 拿到 WebView2 环境和岛屿的控制器。

## Mac 上怎么做：自己建 WKWebView

不能用 Tauri 的子 webview：它和岛屿共用 Tauri 的 IPC，插件页面就能调岛屿的命令。所以和 Windows 一样，在岛屿窗口里自己加一块 WKWebView，不经过 Tauri。`objc2-web-kit` 0.3.2 已经在依赖树里（Tauri 自己在用），需要的类型都有对应的 feature。

| Windows（WebView2） | Mac（WKWebView） | 说明 |
|---|---|---|
| 拦截 `https://<id>.plugin.focusd.invalid` 的请求 | `WKURLSchemeHandler` 处理自定义 scheme，例如 `fuyu-plugin://<id>/` | WKWebView 不让拦截 `https`，所以 Mac 上的来源不同。CSP 用的是 `'self'`，`INIT_SCRIPT` 不依赖来源，插件页面不受影响；`origin()` 和 `may_navigate` 要按平台给出来源 |
| `NavigationStarting` 里拒绝 | `WKNavigationDelegate` 的 `decidePolicyForNavigationAction` | 同一个 `may_navigate` |
| `NewWindowRequested` 拒绝 | `WKUIDelegate` 的 `createWebViewWithConfiguration` 返回 nil | |
| `PermissionRequested` 拒绝 | `WKUIDelegate` 的媒体权限回调拒绝；不加 `NSCameraUsageDescription` 这类声明，系统本来也不会给 | |
| `DownloadStarting` 取消 | `WKNavigationDelegate` 里遇到下载就取消 | |
| `chrome.webview.postMessage` | `window.webkit.messageHandlers.fuyu.postMessage`，`WKScriptMessageHandler` 接收 | `INIT_SCRIPT` 里的 `channel` 要加一层适配：两边都包成同一个 `postMessage` / `addEventListener("message")` |
| `PostWebMessageAsJson` | `evaluateJavaScript` 调页面里的分发函数 | 要把 JSON 安全地放进脚本：用 `JSON.stringify` 过的字符串，不拼接 |
| `AddScriptToExecuteOnDocumentCreated` | `WKUserScript`，`atDocumentStart`，只在主框架 | |
| 默认数据目录 | `WKWebsiteDataStore.nonPersistentDataStore()` | 页面状态本来就由宿主保存，不需要持久的存储 |
| 开发者工具只在开发模式开 | `isInspectable`（macOS 13.3 起），只在开发模式设为 true | 浮屿最低支持 macOS 15，不用判断版本 |
| 透明背景 | `setValue(false, forKey: "drawsBackground")` | 私有的 KVC，wry 在 `macos-private-api` 下也是这么做的，浮屿已经开了这个特性 |
| `SetBounds` 摆位置 | `setFrame`，加到岛屿 `contentView` 上、Tauri 那块 WKWebView 的上面 | AppKit 的坐标原点在左下角，前端给的是左上角，要翻转；缩放用 `backingScaleFactor` |
| Esc 收起、焦点记录 | 子类化 WKWebView 覆盖 `keyDown`，或在页面里监听后经消息通道告诉宿主 | 岛屿面板已经能成为 key window（`island_panel::make_island_key`），页面里的输入框能打字 |
| 主题字体 `Segoe UI` | 换成 `-apple-system` | `theme_css` 按平台给字体 |

### 要写的代码

| 文件 | 内容 | 估计行数 |
|---|---|---|
| `macos/webview_page.rs`（新） | 用 `define_class!` 定义三个 Objective-C 类：scheme handler、navigation/UI delegate、script message handler；建 WKWebView、摆位置、收发消息、释放；和 Windows 一样通过 `PageHost` 回调 | 350–450 |
| `plugin_host/webviews.rs` | 把 `place_or_create`、`start_page` 这段 Windows 专用的挪到按平台分开的文件里，Mac 那份在主线程上找岛屿的 NSWindow 再建页面；`origin()`、`theme_css` 按平台；`INIT_SCRIPT` 的消息通道适配 | 改约 150，先做一个纯搬迁的提交 |
| `Cargo.toml` | `objc2-web-kit` 加进 Mac 的依赖并开需要的 feature | 几行 |
| 测试 | 可测的只有纯函数：来源、路径、消息解析、脚本里的通道适配。建页面、拦截、导航、透明、焦点都要在真机上看 | |

合计约 500–600 行，其中一半是 Objective-C 委托的样板。按 `src-tauri/AGENTS.md`，`unsafe` 只能在 `macos/` 里。

### 风险

- **只能在真机上验收。** 页面能不能显示、透明对不对、和岛屿的展开收起动画是否同步、拖动和缩放时位置跟不跟得上、输入框能不能打字、Esc 和点外面收起岛屿，都要人在 Mac 上看。Windows 版当年也是这样（`docs/investigations/p8-webview-validation.md`）。
- **岛屿的动画。** Windows 上页面是子窗口，跟着岛屿一起移动；Mac 上加在 `contentView` 里，窗口移动时自然跟着，但岛屿展开收起是前端改窗口大小，页面要靠前端每帧报告的位置去追（现在的 `WebviewTemplate` 已经这样做，900 毫秒内每帧报一次）。效果要看过才知道。
- **私有 API。** `drawsBackground` 是私有的，Apple 改了会变成白底。只影响外观，浮屿不上 App Store，风险可以接受。
- **第三种来源。** 页面的来源在 Windows 上是 `https://…invalid`，Mac 上是 `fuyu-plugin://…`。插件页面一般不写死来源，但如果有插件用 `location.origin` 拼地址，两边会不一样。在插件文档里写明「不要依赖来源」。

## 更好的路：直接用 wry，两个系统一套代码

wry 是 Tauri 底下那层跨平台的 WebView 库：Windows 上是 WebView2，Mac 上是 WKWebView，Linux 上是 WebKitGTK。浮屿的依赖树里已经有它（0.57.2，跟着 Tauri）。直接用 wry 建页面，**不经过 Tauri**，页面里就没有 Tauri 的 IPC 脚本和调用密钥；只有我们自己给的 `with_ipc_handler` 能收到页面发来的消息（`window.ipc.postMessage`）。

需要的东西 wry 都有：`with_custom_protocol`（从插件文件夹提供文件）、`with_navigation_handler`（只许在自己的来源里导航）、`with_new_window_req_handler`（拒绝新窗口）、`with_download_started_handler`（拒绝下载）、`with_initialization_script`、`with_transparent`、`with_devtools`、`with_incognito`、`build_as_child`（叠在岛屿窗口里）、`set_bounds`、`evaluate_script`。

好处：
- Mac 不用写约 400 行的 WKWebView 和 Objective-C 委托样板，Windows 上的 `win32/webview_page.rs`（330 行）也可以换成同一份代码，以后 Linux 也能直接用。
- `unsafe` 和平台差异都由 wry 处理，`plugin_host` 里只剩一份页面代码。

要先确认的（重跑一遍 P8 的安全检查，Windows 和 Mac 各一次）：
- WebView2 的权限申请（摄像头、麦克风、定位）wry 默认怎么处理；Windows 版现在是在原生层一律拒绝。
- wry 的导航回调只管主框架；iframe 和子资源靠 CSP 的 `default-src 'none'` 挡住，要实测外传手段都挡得住。
- Windows 上 wry 默认建自己的 WebView2 环境，和岛屿不共用会多占内存，要看能不能共用，或者多出来多少。
- wry 的版本跟着 Tauri 走，Tauri 升级时这部分要一起回归。

如果这些都没问题，**以后做 G1.15 就走这条路，同时把 Windows 版也换过来**，比单独给 Mac 写一份 WKWebView 划算。

## 换个办法：用模板替掉网页

待办进度环和天气用网页，是因为模板画不出环和预报。另一个办法是给模板加这两样（比如状态模板的环形进度、详情模板的多日预报行），插件改用模板，两个系统都能用，不用维护第二套网页实现。按 E30，新的模板能力要先进实验通道。代价是每多一种图形就要加一种模板能力，而自定义网页能一次覆盖所有情况。

## 结论

- **能做，没有技术上的拦路虎**：需要的 WebKit 接口都有，安全边界可以做到和 Windows 一样，平台无关的逻辑可以直接复用。
- **工作量**：约 500–600 行代码，加一轮真机验收。
- **现在的收益小**：做出来后 Mac 上直接多出来的只有待办进度环和天气两个页面，第三方插件都没用。
- **建议**：先不做，等以下任何一条出现再开工：
  - 有第三方插件要用自定义网页；
  - Mac 用户明显增多；
  - 官方要出新的网页插件。

  在那之前，Mac 上照现在这样显示「暂不支持」，收起条照常（G1.16）。如果要让待办进度环在 Mac 上有页面，先考虑给状态模板加一个环形进度，比做 WKWebView 便宜得多。
- 决定开工时，先按「直接用 wry」那一节做安全检查；通过就用 wry 写一份两个系统共用的实现，不通过再回到自己写 WKWebView。无论哪种，都先做一个纯搬迁的提交，把 `webviews.rs` 里 Windows 专用的那段挪出去。
