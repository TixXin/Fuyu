# 社区怎么做 iOS 风格的毛玻璃，岛上怎么做得更好

> 日期：2026-11-15。问题：主题商店能不能加一套 iOS 毛玻璃主题，底板可以加颜色或流动彩色，主题的设置里有参数能调风格；参考社区里 iOS 风格的产品（用户点名 Winstep Nexus），做得比现在的液态玻璃好。范围：WebSearch（Winstep Nexus、Windhawk、Rainmeter、DWMBlurGlass / OpenGlass、Windows 和 Mac 上的灵动岛类应用、Liquid Glass Web 库、Apple WWDC25 和评测）；本仓库 `src/features/appearance/glassSettings.ts`、`src/features/theme-market/`、`src-tauri/src/plugin_host/market_themes.rs`。相关任务：C97（依赖 C87）。技术可行性的前一份调研：[liquid-glass.md](liquid-glass.md)。预览页：[ios-glass-preview.html](../investigations/ios-glass-preview.html)。

## 结论

1. **社区做 iOS / 液态玻璃有三条路**：用系统材质（窗口和控件一样大时才行）、取样壁纸（Windows 11 的 Mica 就是这么做的）、自己用 WebGL 画（要先有一张「背后」的纹理）。我们的岛只占 820×460 透明舞台里的一小块，第一条用不了（[liquid-glass.md](liquid-glass.md) 结论 1、2）；第三条缺「背后」，单独成立不了。
2. **能比现在做得更好，关键是壁纸取样毛玻璃**：岛拿不到桌面，但拿得到壁纸。在岛自己的元素里画岛正后方那一块壁纸，再用 CSS `blur` + `saturate`、着色和噪点处理。尺寸和形状就是岛本身，不存在「材质铺满舞台」的问题；不抓屏、不要权限，岛也不会从截图里消失；岛不动时这一层静止。局限是：岛背后被窗口挡住时，玻璃里仍是壁纸。Mica 也是这样，系统标题栏一直这么用。前一份调研只把 Mica 当成原生 API 看过，没考虑在网页里自己做这一层。
3. **iOS 的样子拆开是几层**：底层是模糊加提饱和；明、暗两种单色玻璃，加两种着色方式（颜色染进玻璃，或给前景着色）；边缘的镜面高光随运动变化；iOS 26 还有 lensing 折射。预览页做了前三层，折射没调通（见「未解决」）。
4. **和 C87 是叠加，不是替代**：C87 第 2 波的流动彩色、高光、形变，是「底板颜色」和高光那几层；壁纸毛玻璃是垫在最下面的一层。做成独立设置「玻璃背后：无 / 壁纸」，和 `glassStyle` 正交。
5. **主题商店不需要新机制**：市场主题就是一组 `THEME_SETTING_KEYS` 字段的值（`theme-market/model.ts`），`GLASS_SETTING_KEYS` 已经在里面（`99dc77ec`）。「iOS 毛玻璃」主题装上后，用户可以继续在 设置 → 外观 → 液态玻璃 里调。上架只是在 `TixXin/fuyu-plugins` 的 `themes.json` 里加一条，主题不签名。要新增的字段见「主题里可调的参数」。

## 详细

### 社区产品

| 产品 | 平台 | 怎么做的 | 对我们的意义 |
|---|---|---|---|
| Winstep Nexus | Windows dock | 玻璃模糊来自系统：Vista / 7 自带，Win8 / 10 要装第三方 AeroGlass；能用其他 dock 的皮肤。没找到官方的 iOS 主题，社区皮肤未核实 | 系统材质路线，窗口就是 dock 本身 |
| Windhawk Taskbar / Start Menu Styler | Windows 11 | 社区主题「OS26 Liquid Glass」「LiquidGlass」「FrostyGlass」等，改的是系统 XAML 控件的样式，用系统 Acrylic。微软 2026-08 表示暂不改 Windows 11 的透明效果，让用户用 Windhawk 这类工具 | 同上；也说明「iOS 风格」的需求很普遍 |
| Rainmeter + FrostedGlass / TranslucentRM | Windows 桌面皮肤 | 插件给皮肤窗口加 DWM Acrylic；论坛反馈 TranslucentRM 比旧的 FrostedGlass 好用；圆角要设 `Border=none` | 同上 |
| Dockable（Steam） | Windows 11 dock | 三档：半透明、实时 Acrylic 模糊、Liquid Glass（磨砂 + 边缘折射 + 移动的柔和高光） | 档位设计可以参考 |
| DWMBlurGlass / OpenGlass | Windows | 给系统标题栏换材质；Mica 配方是「模糊壁纸 + 饱和度 + 着色」，MicaAlt 换一个偏灰的混合色；模糊半径、亮度都可调 | 壁纸取样路线的参考配方 |
| Venu | Windows 灵动刘海 | Frosted Glass / Blurred / Fluent Acrylic 主题，颜色按壁纸适配；是否开源未核实 | 同类产品已经按壁纸取色 |
| rajsriv/dynamic-island-for-windows | Windows（PyQt6，MIT） | 有 Liquid Glass 岛样式，自动检测壁纸主色 | 同上 |
| liquidGL、ybouane/liquidglass、liquid-glass-js | Web | WebGL 着色器：先把背后的 DOM 栅格化成纹理，再做折射、模糊、色散和光照 | 壁纸本来就是静态纹理，以后做折射可以走这条 |
| eIsland | Windows（Tauri） | 岛本体不做玻璃，只给 Agent 输入球用 WGSL 着色器（[liquid-glass.md](liquid-glass.md) §7） | — |
| Atoll、Boring.Notch、NotchNook、Alcove | Mac 刘海 | 搜到的资料里没有它们做 Liquid Glass 的说明，未核实 | — |

### Apple 的 Liquid Glass 有哪几层

- 官方说法：实时渲染，随运动产生镜面高光（Apple Newsroom）。
- WWDC25「Meet Liquid Glass」：有明、暗两种单色玻璃，以及两种着色方式（深色着色给前景加颜色，浅色着色把颜色染进玻璃）；着色只留给主要操作，否则没有层次。
- 第三方开发者的解读：lensing 是核心，它弯曲、汇聚光线，传统的 blur 是把光散开；玻璃上不要再叠玻璃。
- iOS 26 的图标高光用陀螺仪驱动；开「减少动态效果」时，视差、高光移动和形变会减弱或去掉（MacStories）。
- iOS 27 评测提到：扩散和折射更有效，边缘变暗，镜面高光更亮（MacStories）。

岛上对应：模糊 + 提饱和 = 壁纸毛玻璃；单色玻璃 = 深浅岛的底色；两种着色 = 「底板颜色」的主题色 / 自定义 / 流动彩色；镜面高光跟鼠标（桌面没有陀螺仪）；折射见「未解决」。

### 预览页

[ios-glass-preview.html](../investigations/ios-glass-preview.html)：用 Edge / Chrome 打开，按钮或 `?wall=` 换成自己的壁纸。五个预设：iOS 26 透明、iOS 26 着色、毛玻璃 + 流动彩色、iOS 18 毛玻璃、Win11 Mica。可以拖动岛、展开收起、切深浅、换底板颜色，模糊、饱和度、底色浓度、色彩浓度、噪点、流动速度都能调；「后面有窗口挡着」演示局限。2026-11-15 在本机 Edge 上用当前的 Bing 壁纸看过，深浅、展开收起、拖动、被挡住时都正常。「iOS 26 透明」这一档在浅色壁纸上字明显看不清。

### 主题里可调的参数

已有字段（C87 第 2 波）直接沿用：`glassIntensity`（底色浓度）、`glassStyle`、`glassColorSource` / `glassColor1-3`（底板颜色）、`glassColorStrength`、`glassFlowSpeed`、`glassBlobScale`、`glassRim`、`glassSpecular`、`glassSheen`、`glassMorph`、`glassContrastGuard`。

要新增的（草案，字段名在实现时定；旧数据没有这些字段时按默认值读，外观不变）：

| 设置项 | 取值 | 默认 | 预览页里对应 |
|---|---|---|---|
| 玻璃背后 `glassBackdrop` | 无 / 壁纸 | 无 | 是否画壁纸这一层 |
| 模糊 `glassBlur` | 0–60 px | 24 | 模糊 |
| 饱和度 `glassSaturation` | 100–250% | 180% | 饱和度 |
| 噪点 `glassNoise` | 0–12% | 3% | 噪点 |
| 边缘折射 `glassRefraction` | 0–40 | 0 | 等调通再加 |

主题商店里放三套，都是这些字段的组合，对应预览页的预设：

| 主题 | 组合 |
|---|---|
| iOS 毛玻璃·流彩 | 壁纸，模糊 22，饱和 180%，底色 38%，流动彩色 55%，边缘高光、镜面高光开，轻弹形变 |
| iOS 着色玻璃 | 壁纸，模糊 12，饱和 180%，底色 28%，主题色着色 45% |
| Mica | 壁纸，模糊 60，饱和 130%，底色 72%，不流动、不加高光 |

### 实现要点

- **取壁纸（Windows）**：`IDesktopWallpaper` 的 `GetWallpaper(monitorId)`、`GetPosition`、`GetMonitorRECT` 能按显示器拿到壁纸和填充方式（`Win32_UI_Shell` 已在 Cargo features 里）。最简单的是读 `%APPDATA%\Microsoft\Windows\Themes\TranscodedWallpaper`，即系统当前壁纸的转码副本。本机 2026-11-15 看过：注册表 `HKCU\Control Panel\Desktop\WallPaper` 指向 Bing Wallpaper 下载的 jpg，`TranscodedWallpaper` 同一天更新过；多显示器各用不同壁纸时它代表哪块屏，未核实。换壁纸时系统广播 `WM_SETTINGCHANGE` / `SPI_SETDESKWALLPAPER`，收到后刷新。纯色背景读 `HKCU\Control Panel\Colors\Background`。
- **取壁纸（Mac）**：`NSWorkspace.shared.desktopImageURL(for:)`。刘海形态下折叠岛仍是纯黑（G1.11）。
- Rust 端用已有的 `image` crate 把壁纸缩到约 960 px 宽再交给前端（反正要模糊），只在换壁纸时重算。
- 前端：岛的屏幕坐标 = 窗口位置 + 岛元素的偏移（乘缩放比）。拖动、贴边、换屏、展开收起时更新 `background-position`，岛不动时不重绘。壁纸的填充方式（填充 / 适应 / 拉伸 / 平铺 / 居中 / 跨区）要换算成背景尺寸。
- 对比度：取样后算那一块壁纸的平均亮度，「文字保护」按它提高底色浓度，不只按主题色压。
- 退化：系统关掉「透明效果」、节能模式、取不到壁纸时，回到 C87 的 CSS 玻璃。

### 未解决

- **边缘折射**：预览页里，`feTurbulence` 生成的位移图能让 `.wall`、`.frost` 元素正常位移；但用 `feImage`（`data:` 和 `blob:` 都试过）或 `feFlood` + 模糊 + `feConvolveMatrix` 生成的岛形状位移图都不起作用，尽管单独显示时位移图是对的。另外两条已经确认：滤镜挂在没有自己内容的包装元素上，位移被跳过；和 CSS `blur()` 写在同一条 `filter` 链里，整条链失效。根因没查清，可能是 Chromium 对 CSS 滤镜里 `feDisplacementMap` 的限制，也可能是写法有误。备选：用 WebGL 着色器画这一块（liquidGL 的做法），壁纸是静态纹理，很适合。
- 没在 `pnpm build:exe` 的岛上测过帧率、GPU 和收起闲着时的占用；多显示器、幻灯片壁纸、Windows 聚焦的情况也没核实。

## 来源

- [Winstep Nexus](https://winstep.net/nexus.asp)、[Nexus v26.1 发布说明](https://winstep.net/news/nexus_dock_v26.1_released.asp)、[Nexus 主题库](https://themes.winstep.net/nexus.asp)、[Nexus v15.7 发布说明（Win8/10 的玻璃模糊要 AeroGlass）](https://www.winstep.net/news/July_27_2015_nexus_dock_v15.7_released.asp)
- [windows-11-taskbar-styling-guide](https://github.com/ramensoftware/windows-11-taskbar-styling-guide)、[Windows 11 Start Menu Styler](https://windhawk.net/mods/windows-11-start-menu-styler)、[Canaltech：Windows 液态玻璃教程](https://canaltech.com.br/software/como-deixar-windows-interface-liquid-glass)、[Windows Latest：微软说暂不做 Liquid Glass 式透明](https://windowslatest.com/2026/08/10/microsoft-reveals-why-windows-11-wont-get-liquid-glass-style-ui-even-though-windows-vista-did-it-first-with-aero/)
- [FrostedGlass（Rainmeter 插件）](https://github.com/TheAzack9/FrostedGlass)、[Rainmeter 论坛：TranslucentRM](https://forum.rainmeter.net/viewtopic.php?p=228353)、[Rainmeter 论坛：FrostedGlass 用法](https://forum.rainmeter.net/viewtopic.php?p=223506)、[ModernBar](https://github.com/nstechbytes/modernbar)
- [Dockable（Steam）](https://store.steampowered.com/app/4915150/)
- [DWMBlurGlass](https://github.com/Maplespe/DWMBlurGlass)、[OpenGlass](https://github.com/ALTaleX531/OpenGlass)、[Mica（Microsoft Learn）](https://learn.microsoft.com/windows/apps/design/style/mica)
- [Venu](https://peerlist.io/imnakul/project/venu-dynamic-notch-for-windows)、[rajsriv/dynamic-island-for-windows](https://github.amrom.workers.dev/rajsriv/dynamic-island-for-windows)、[WinIsland](https://alternativeto.net/software/winisland/about/)、[DynamicWin](https://github.com/FlorianButz/DynamicWin)
- [liquidGL](https://github.com/naughtyduk/liquidGL)、[ybouane/liquidglass](https://liquid-glass.ybouane.com/)、[liquid-glass-js](https://dashersw.github.io/liquid-glass-js)
- [Atoll](https://github.com/Atoll-Labs/Atoll)、[The Boring Notch（AlternativeTo）](https://alternativeto.net/software/the-boring-notch/)
- [WWDC25 Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/220/)、[Apple Newsroom：新设计](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)、[Create with Swift：Liquid Glass](https://www.createwithswift.com/exploring-a-new-visual-language-liquid-glass/)、[MacStories iOS 26 评测](https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/4)、[MacStories iOS 27 评测](https://www.macstories.net/stories/ios-and-ipados-27-review/2/)
