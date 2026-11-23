# Windows 上窗口内容被裁掉：系统「文本大小」没算进窗口尺寸

2026-11-23 排查。0.3.13-beta.2 有用户反馈所有窗口都显示不全。结论是推断出来的，还没在出问题的电脑上确认，确认方法见「先确认」。方案 A 已按任务 D122 实现，等 Windows 真机验证。

## 现象

同一台 Windows 电脑上，五个不同的窗口都被裁：

| 窗口 | 表现 |
|---|---|
| 收起岛的右键菜单 | 右边的开关只露一半，最下面一行被裁 |
| 展开面板（计时器页） | 右上角的按钮被裁 |
| Fuyu 面板 | 左右各被裁一截（「Fuyu」只剩「uyu」） |
| 托盘卡片 | 右边第三格被裁，最下面的「退出」被裁 |
| 新手引导 | 卡片能看到，「下一步」点不了 |

用户说更新前就这样，所以不是 0.3.13-beta.2 引入的。

## 原因

WebView2 画网页用的缩放（`RasterizationScale`）默认是「显示器缩放 × 系统文本大小」。系统文本大小在 Windows 设置 → 辅助功能 → 文本大小，范围 100%–225%。

浮屿的每个窗口都是这样定尺寸的：前端量出内容的 CSS 像素，Rust 乘上 `scale_factor()` 得到物理像素，再设窗口大小。`scale_factor()` 只有显示器缩放，不含文本大小。

所以文本大小是 100% 时两边一致。调到 125% 时：

- 显示器缩放 150% 的屏上，网页按 1.875 倍画，窗口按 1.5 倍给；
- 内容比窗口大 25%，靠左上对齐的窗口裁右边和下边，内容居中的岛左右各裁一截；
- 引导的可点区域是 Rust 按「CSS 像素 × 显示器缩放」算的，和按钮实际位置对不上，点击穿过去了。

证据：

- 五个窗口的尺寸代码互不相干（`tray_menu/window.rs`、`island/screen.rs`、`onboarding_window/` 等），却同时出问题，共同点只有「CSS 像素 × `scale_factor()`」这一步。
- wry 0.57.2、tauri-runtime-wry 2.12.5 和 `src-tauri/src/` 里都没有碰 `RasterizationScale`、`ShouldDetectMonitorScaleChanges`，走的是 WebView2 的默认行为。
- 微软文档写明这个缩放是显示器 DPI 和用户文本缩放的乘积；WebView2 团队在反馈里确认是按文本大小整体放大内容，不是只放大文字。

没确认的：出问题那台电脑的文本大小到底是多少。

## 先确认

两种办法，任选一个：

1. 让反馈的用户看 设置 → 辅助功能 → 文本大小。大于 100% 就对上了；拖回 100%、点应用、重启浮屿，应该全部正常。这也是修好之前给用户的临时办法。
2. 在自己的 Windows 电脑上把文本大小调到 125%，打开已安装的 0.3.13-beta.2，看是不是同样的裁法。一分钟能复现。

如果用户的文本大小本来就是 100%，这份方案不成立，要另查：程序的高 DPI 兼容选项、多显示器不同缩放、WebView2 运行时版本。

## 方案对比

| | 做法 | 好处 | 代价 |
|---|---|---|---|
| A（推荐） | 浮屿自己把每个 WebView 的缩放固定成显示器缩放，不跟系统文本大小 | 一处改完，所有窗口（含以后新加的、插件窗口）都对；窗口定位、贴边、点击区域的现有代码一行不用动 | 调大系统文本的用户，浮屿里的字不跟着变大，要用「岛屿大小」调 |
| B | 窗口尺寸也乘上文本倍数，内容跟着系统变大 | 尊重系统的文本大小设置 | 每个窗口的尺寸、定位、屏幕边界、贴边、任务栏吸附、点击区域都要改，十几处，漏一处就是新的裁切；岛在 225% 下会比屏幕还宽 |
| C | 前端在根节点用 CSS `zoom` 反向缩回去 | 不用写 Rust | 岛已经用 `zoom` 做「岛屿大小」，再叠一层后量尺寸、拖动坐标都要再换算一遍，最近两个修复（7a8fc24e5、3c87d3b1b）就是这类问题 |

选 A。现在这些用户看到的是坏的界面，A 先让它正确；要不要跟随系统文本大小，以后可以在 A 的基础上做成一个设置（把固定值改成「显示器缩放 × 文本倍数 × 开关」），那时再按 B 的清单逐个窗口适配。

## A 的做法

### 改哪里

| 文件 | 内容 |
|---|---|
| `src-tauri/src/win32/webview_scale.rs`（新） | 平台层，`unsafe` 只在这里。`pin(controller, scale)`：把 `ICoreWebView2Controller` 转成 `ICoreWebView2Controller3`，`SetShouldDetectMonitorScaleChanges(false)`，再 `SetRasterizationScale(scale)`。转不了（WebView2 运行时太旧）就返回错误，调用方只记日志、保持现状 |
| `src-tauri/src/webview_scale.rs`（新）和 `webview_scale_unsupported.rs`（Mac 上的空实现） | `attach(webview)`：取窗口的 `scale_factor()`，`with_webview` 拿到控制器后调 `pin`。写法照 `webview_visibility.rs` |
| `src-tauri/src/lib.rs` | `on_page_load` 里加一行 `webview_scale::attach(webview)`；`on_window_event` 里遇到 `WindowEvent::ScaleFactorChanged` 时对这个窗口的 WebView 再调一次 |
| `src-tauri/AGENTS.md`、`docs/architecture/platforms.md` | 目录地图加这两个文件；写明 Windows 上不跟随系统文本大小 |

`webview2-com 0.39.1` 已经有这几个接口（`SetRasterizationScale`、`SetShouldDetectMonitorScaleChanges`），不用加依赖。

### 几个要处理的点

- **所有 WebView 都要接**，包括主岛 `main`。`webview_visibility` 跳过了 `main`，这个不能跳。`on_page_load` 对每个 WebView 都会触发，截图选区、贴图、插件窗口这些运行时创建的也覆盖到。
- **关掉自动检测后，显示器缩放变化要自己跟**。两种情况：窗口拖到另一块缩放不同的屏；用户在系统里改了显示缩放。两种都会触发 Tauri 的 `ScaleFactorChanged`，在那里用新的值再设一次。
- **时机**。`on_page_load` 在页面开始加载时就触发，早于前端第一次量尺寸；即使晚了，缩放一变 `devicePixelRatio` 和视口都会变，岛已经在监听（`useDevicePixelRatio`），会重排。
- **日志没做**。原想启动时记一行系统文本倍数，但发布版没有收 `eprintln!` 的通用日志文件，为这一行新开日志不值得；以后再有「显示不全」的反馈，直接问文本大小（注册表 `HKCU\Software\Microsoft\Accessibility` 的 `TextScaleFactor`）。

### 不改的

- 窗口尺寸、定位、点击区域的代码都不动。
- Mac 不受影响：WKWebView 不按系统文本大小缩放整页。
- 不加设置项，不改 localStorage 和命令，对外契约没有变化。

## 风险

- **在 Mac 上写、编不了 Windows 代码**。Rust 的 Windows 部分靠 CI 的 `rust` job 编译（`pnpm mq:try`），行为只能在 Windows 真机上看。
- **缩放设错的后果是整个界面大小不对**。所以失败时只记日志、不改任何东西，最差是保持现在的行为。
- **混合缩放的多显示器**。窗口跨屏时 `ScaleFactorChanged` 的时机和 WebView2 重绘的先后需要实测，可能有一帧大小不对。
- **调大了系统文本的用户会发现字变小了**（相对于现在被裁的状态其实是变正常）。发布说明里写一句，并指到「岛屿大小」。

## 验证

单元测试覆盖不到 WebView2，靠 Windows 真机。文本大小分别在 100%、125%、175% 下看：

1. 收起岛、展开面板各页、Fuyu 面板：四边完整，内容居中。
2. 右键菜单、托盘卡片：每一行都在，最下面一行完整。
3. 新手引导（设置 → 关于里重新打开）：能点「下一步」走完。
4. 剪贴板窗口和空格预览、翻译窗口、设置窗口、截图选区和贴图、一个插件窗口。
5. 浮屿开着时改文本大小：界面不变，不裁。
6. 浮屿开着时改显示缩放（125% ↔ 150%）：窗口和内容一起变，不裁。
7. 有两块缩放不同的屏时，把岛拖到另一块屏。
8. 100% 下和现在的版本对比，确认没有变化。

## 工作量和发版

- 代码约 100 行 Rust，三个新文件加 `lib.rs` 两处。半天内能写完并过 CI。
- 开一个任务和 issue，提交带 `Manual check`。
- 真机验证过后发 0.3.13-beta.3，让反馈的用户更新后确认。

## 资料

- [CoreWebView2Controller.RasterizationScale](https://learn.microsoft.com/dotnet/api/microsoft.web.webview2.core.corewebview2controller.rasterizationscale)：缩放是显示器 DPI 和文本缩放的乘积
- [ICoreWebView2Controller3](https://learn.microsoft.com/microsoft-edge/webview2/reference/win32/icorewebview2controller3)：`ShouldDetectMonitorScaleChanges` 设成 false 后由应用自己设缩放
- [WebView2Feedback #3699](https://github.com/MicrosoftEdge/WebView2Feedback/issues/3699)：WebView2 按文本大小整体放大内容
