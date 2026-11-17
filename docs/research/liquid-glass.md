# 液态玻璃：能不能透出桌面，拿不到时做到什么程度

> 日期：2026-11-15。问题：外观里的「液态玻璃」只是一块半透明着色底，怎么重做——走「流动彩色」还是「iOS 26 式玻璃」，原生材质（Windows Acrylic / Mica、Mac NSVisualEffectView）能不能给岛用，当初为什么关掉，CSS / SVG / WebGL 能做到哪、常驻占用多少。范围：本仓库 git 记录（`f1365ca7` 起）和上游 flyl1u/fly-island 的 v0.2.18 / v0.2.20 发布说明；window-vibrancy 0.6–0.8 的文档；Microsoft Learn（DWM、SetWindowDisplayAffinity）；Tauri issue；GitHub / 博客上的 Liquid Glass Web 复刻；Windows 灵动岛类开源项目（eIsland 等）。关键词：window-vibrancy acrylic lag、DWMWA_SYSTEMBACKDROP_TYPE layered region、liquid glass feDisplacementMap、apply_liquid_glass、eIsland。相关任务：C87（issue #286）。预览页：[liquid-glass-preview.html](../investigations/liquid-glass-preview.html)。

## 用户决定（2026-11-15）

「按推荐来，设置里要有丰富的外观配置选项，用户可以高度自定义。」即：做方向 1 流动彩色，默认 1B 慢流动，叠上方向 2 里不依赖背后内容的镜面高光、边缘亮线和展开收起形变；原生材质不在本任务里做。下面「要用户定的点」里其余几项都做成设置项，由用户自己调，默认值按推荐。原生「真透出」的两个实验另建了任务：C89（Windows 玻璃垫底窗口，#421）、C90（Mac 岛大小的 effect view，#422）。

### 第 2 波的设置项（草案，预览页「自定义」一行可以直接试）

都放在「外观」里液态玻璃下面，随样式预设保存；`appearanceMode: "liquidGlass"` 和 `glassIntensity` 保持原样，旧数据没有新字段时按默认值读（字段名是草案，第 2 波的准备提交里定）。

| 设置项 | 取值 | 默认 | 说明 |
|---|---|---|---|
| 风格 `glassStyle` | 静态 / 慢流动 / 极光 / 着色器（实验） | 慢流动 | 对应预览页 1A–1D；选一项会把下面几项设成那一档的组合，再单独改 |
| 玻璃强度 `glassIntensity` | 25–100 | 72 | 已有，管底色不透明度 |
| 颜色来源 `glassColorSource` | 主题色 / 跟封面 / 自定义 | 主题色 | 跟封面只在放歌时生效，没在放时回到主题色；换歌时过渡 |
| 自定义颜色 `glassColors` | 3 个颜色 | 主题色派生 | 颜色来源为自定义时用 |
| 色彩浓度 `glassColorStrength` | 0–100% | 70% | 色块不透明度 |
| 流动速度 `glassFlowSpeed` | 0–200% | 100% | 0 等于静止 |
| 色块大小 `glassBlobScale` | 60–160% | 100% | |
| 折叠岛流动 `glassFlowWhen` | 一直 / 只在展开时 | 只在展开时（2026-11-16 起，省掉收起时每帧重新合成的 GPU） | 可以再加「放歌或 Agent 运行时」，第 2 波看实现成本 |
| 油膜边 `glassRim` + 边宽 | 开关，1–3px | 关，1.5px | 极光风格默认开 |
| 扫光 `glassSheen` | 开关 | 关 | 极光风格默认开 |
| 镜面高光 `glassSpecular` | 开关（跟鼠标） | 开 | 原来的 `useGlassPointer` 光斑换成它 |
| 展开收起 `glassMorph` | 平滑 / 轻弹 / 液体 | 平滑 | 「减少动态效果」时一律平滑且无时长 |
| 文字保护 `glassContrastGuard` | 开关 | 开 | 开着时按相对亮度压暗 / 提亮色块，保证文字 ≥ 3:1；关掉时设置里提示「文字可能看不清」，回归页按开着的状态测 |

不做成设置的：暂停条件（贴边、游戏免打扰、隐藏、减少动态效果时一律停）；深浅岛各自的底色和文字色（跟着主题和 C33.9 的「岛上文字颜色」走）。设置页顶部已有的岛预览要能实时显示这些项；有一个「恢复液态玻璃默认」。

## 结论

1. **当初关原生 acrylic 的原因找到了**：v0.2.2（`92dea57f`，2026-08-03）的代码注释写着——岛的窗口是一块 820×460 的透明舞台，岛本身小得多；Windows 11 的 DWM Acrylic 铺满整个 HWND，`SetWindowRgn` 裁不干净，**岛周围留下一大块模糊的矩形**。所以改成原生材质全关、只在岛元素上画 CSS。这条注释在 `d5b17c55`（去注释）时删掉了，git 说明里没写，这里补上。上游 v0.2.18 暂停液态玻璃、v0.2.20 又打开，两个发布说明都没写原因，改动只是设置里的开关，和原生材质无关。
2. **Windows 上「真透出桌面」现在做不到可靠的版本**：DWM 的系统背景材质（Acrylic / Mica / `DWMWA_SYSTEMBACKDROP_TYPE`）按整个窗口画，不认窗口区域和网页的透明像素；我们的窗口是比岛大的透明舞台、带点击穿透，这正好是它最不擅长的形状。可能的绕法（另开一个和岛一样大的「玻璃垫底窗口」跟着岛动，或把窗口改成和岛一样大）都要重做窗口几何，并且有已知的拖动 / 改尺寸卡顿（window-vibrancy 文档自己写着 Win10 1903+ / Win11 22000 上 acrylic 拖动、改尺寸时卡），展开收起的形变要和 CSS 动画逐帧对齐，风险大。Windows 10 只有未公开的 `SetWindowCompositionAttribute` 那条路（同样卡），关掉「透明效果」时什么都没有。**建议第 2 波不碰 Windows 原生材质**，只列进 Windows 实测清单，等那台机器上做一次小实验再说。
3. **Mac 上可行，但也是另一份工作**：`macOSPrivateApi` 已经开着；window-vibrancy 0.7+ 有 `apply_vibrancy`（NSVisualEffectView，10.10+）和 `apply_liquid_glass`（macOS 26+ 的系统液态玻璃）。但它们同样铺满整个窗口，要给岛用得自己在 `src-tauri/src/macos/` 里加一个只有岛那么大的 effect view、用岛的形状做遮罩，并跟着展开收起改尺寸。和 G1.11 的关系：刘海形态下折叠岛必须是**纯黑**才能和真刘海融在一起，玻璃在那种状态下必须退回纯黑，只有展开态、离开刘海（药丸 / 贴顶）时才透。建议作为 Mac 上的后续实验（单独任务），不进第 2 波。
4. **拿不到桌面时，CSS 能做的上限很清楚**：`backdrop-filter` 在透明 WebView 里只能模糊网页自己画的东西（岛后面在网页里什么都没有），所以「透过玻璃看到模糊的背景」做不出来；SVG `feDisplacementMap` 折射同理只能折射岛自己的内容，而且只在 Chromium 里能套进 `backdrop-filter`（WebView2 可以，Mac 的 WKWebView 不行）。能做的是：**会动的颜色、边缘的色散高光、跟鼠标的镜面高光、展开收起的液体形变**——这些都在岛自己的像素里，和背后是什么无关。
5. **推荐**：第 2 波做「方向 1 流动彩色」为主，档位用预览页里的 **1B「慢流动」作默认**（几团预先模糊好的色块只用 `transform` 动，合成器完成，不重绘），可选 **1C「极光 + 油膜边」**；颜色默认跟 `--color-accent`，可选「跟封面」。再从「方向 2」里拿不依赖背景的部分：**边缘高光、随鼠标的镜面高光、展开收起的液体回弹**，叠在方向 1 上。「真透出桌面」拆成两个实验任务（Windows 垫底窗口、Mac effect view），不和本任务绑在一起。WebGL 着色器（1D）效果最好但要常驻一块 canvas 和 GPU 上下文，不建议作默认。
6. **怎么停**：收起到边缘（`isTucked`）、游戏免打扰（`useGameMode`）、窗口隐藏、`prefers-reduced-motion: reduce` 时把动画的 `animation-play-state` 设为 `paused`（色块停在当前位置，不跳），WebGL 档停 `requestAnimationFrame`；折叠态默认也可以只在「有东西在放」（音乐、Agent 在跑）时动。现有空闲占用基线是收起时单核 10%（[idle-usage.md](../investigations/idle-usage.md)），新动画要在 Windows 上测一次，确认「收起、闲着」时不升。

### 要用户定的点

1. 方向：只做方向 1（流动彩色），还是也给「iOS 式」的高光 + 液体形变单做一个子风格？
2. 默认档位：1B 慢流动（推荐）还是 1C 极光 + 油膜边？1A 静态是否保留给「减少动态效果」。
3. 颜色来源：默认跟主题色，「跟封面取色」是否要（只有在放音乐时生效，切歌时 1.2 秒过渡）。
4. 折叠岛动不动：一直缓慢流动、只在展开时流动，还是只在放音乐 / Agent 运行时流动。
5. 浅色岛：流动彩色在浅色岛上是「白底上淡彩」（预览页的样子），还是浅色岛不提供流动、只给静态玻璃。
6. 「真透出桌面」的两个实验（Windows 垫底窗口、Mac 原生 effect view）要不要建任务。
7. 深色岛的颜色浓度：预览页按次要文字过 3:1 把色块压到相对亮度 ≤ 0.1，深色岛上的流动彩色因此偏沉（深蓝、深紫）。要更艳，就得给文字加一层底，或接受次要文字更亮——选哪个。

### 预览页里看到的（Mac 上 Chrome，2026-11-15）

- **对比度**：色块按 HSL 明度压不够（青色、琥珀色在同样明度下亮得多），要按**相对亮度**压：深色岛 ≤ 0.1、浅色岛 ≥ 0.62。这样 5 个主题色和 3 张封面在 1A–1C 下主文字 ≥ 10:1、次要文字 ≥ 4.6:1（深色）/ ≥ 3:1（浅色）；1D 着色器的次要文字约 2.8:1，还要再压。实现时取色函数要用同样的规则。
- **方向 2 拿不到桌面时**（预览页「拿不到桌面」开关）：后面的窗口清楚地透过一层着色，没有模糊也没有折射，就是 issue 里说的「半透明着色底」；底色不透明度低了文字直接压在桌面内容上。所以方向 2 在应用里成立的前提是原生材质。
- **开销**：1A–1C 在页面里稳在显示器刷新率；2B / 2C 在展开收起途中帧率明显下降（位移图要重算，预览页在形变时先关掉折射、结束后再打开）。页面帧率不等于 GPU 占用，Windows 上要用任务管理器的 GPU 列实测。

## 详细

### 1. 历史：原生 acrylic 是怎么开又关的

| 提交 | 日期 | 内容 |
|---|---|---|
| `f1365ca7` 液态毛玻璃初代 | 2026-08-02 | `lib.rs` 加 `apply_glass_material`：`window_vibrancy::apply_acrylic(window, tint+alpha)`，并用 `CreateRoundRectRgn` + `SetWindowRgn` 把窗口裁成岛的圆角矩形，展开收起时在后台线程每 12 ms 插值一次区域（180 ms）；读注册表 `EnableTransparency`，关着时退回 CSS。返回值 `active` / `css-fallback` / `disabled`。 |
| `48699bd1` 液态玻璃基本完善 | 2026-08-02 | README：「Windows 10 1809+ / 11 优先用 Acrylic 背景采样，不支持或关透明效果时降级为 CSS 玻璃」。 |
| `92dea57f` release v0.2.2 | 2026-08-03 | 删掉区域动画和 acrylic，一开始就 `clear_acrylic` + 清区域，只返回 `css-fallback`；同时在 CSS 里加 `backdrop-filter`。注释写明原因：Acrylic 铺满整个 HWND，`SetWindowRgn` 裁不可靠，岛周围留下一大块模糊矩形；DPI 变化时也不再重设。 |
| `d5b17c55` | 之后 | 去掉 Rust 代码里的注释，上面的原因随之消失。 |
| 上游 `daeb3968` v0.2.18 / `b52b13e6` v0.2.20 | 2026-11-05 / 11-06 | 设置里暂停、再打开液态玻璃选项，发布说明只写「暂时关闭 / 重新启用」，没写原因；只改前端开关（[D4](../tasks/0-archive/D/D4.md) 不移植）。 |

结论：问题不在材质本身，在「**材质按窗口画，而我们的窗口比岛大得多**」。区域裁剪同时还会裁掉窗口里岛以外的东西（弹出卡片、贴边的反向圆弧、Alt 改尺寸的提示线），并要和 CSS 的展开动画同步，这也是初代用后台线程每 12 ms 改区域的原因——两边的节奏对不齐就会看到模糊块和岛错位。

### 2. Windows 原生材质

| 方式 | 系统 | 用在我们的岛上 |
|---|---|---|
| `apply_acrylic`（window-vibrancy，内部是未公开的 `SetWindowCompositionAttribute` / `ACCENT_ENABLE_ACRYLICBLURBEHIND`） | Win10 1809+、Win11 | 铺满整个窗口；文档注明 Win10 1903+ 和 Win11 22000 上**拖动、改尺寸时卡**，原因是未公开 API，要微软修。我们的窗口在贴边收起、跟随换屏、拖动时都会移动。 |
| `apply_blur` | Win7、Win10 1809+ | 只有模糊没有噪点 / 着色；Win11 22621 上同样拖动卡。 |
| `apply_mica` / `DWMWA_SYSTEMBACKDROP_TYPE = DWMSBT_MAINWINDOW` | Win11 | Mica 取的是**桌面壁纸**的颜色，不是窗口后面的内容，看不到「透出后面的窗口」；按窗口画，要求非客户区存在，透明无边框窗口上能不能显示未核实，要实测。 |
| `DWMSBT_TRANSIENTWINDOW`（系统 Desktop Acrylic） | Win11 22H2+ | 公开 API，是正经的 Acrylic；同样按整个窗口画，需要窗口激活才实时（未激活时退成纯色，flutter_acrylic 的说明里提到「非实时 acrylic」）。岛点击不抢焦点（设计里定过），所以大多数时候岛是**未激活**窗口，这一点很可能直接让它退成纯色——要实测。 |
| 自己抓屏（Windows.Graphics.Capture 抓岛下面那一块屏幕，岛自己用 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` 排除，Win10 2004+） | Win10 2004+ | 技术上能拿到「岛后面真实的画面」再在网页里模糊。代价：常驻抓屏（GPU 拷贝 + 传进 WebView），黄框 / 隐私观感，岛自己从所有截图和录屏里消失（用户截图时看不到岛，这和我们自己的截图模块冲突），游戏时更要停。**不建议**。 |

已知的形状问题：

- 窗口区域（`SetWindowRgn`）和分层窗口（`WS_EX_LAYERED`）都不保证能裁住 DWM 背景材质；我们自己 v0.2.2 已经撞上过。
- Win11 的 `DWMWA_WINDOW_CORNER_PREFERENCE` 只有系统小圆角（约 8 px），岛是 16–40 px 方圆角 + 顶边反向圆弧，对不上。
- 点击穿透（`passthrough.rs` 每 12 ms 切 `set_ignore_cursor_events`）本身不影响材质，但材质窗口一旦和岛分开（垫底窗口方案），穿透和命中区域要两边一起管。

**Windows 10 怎么退化**：没有公开的背景材质 API，只能 `apply_acrylic` / `apply_blur`（未公开，卡）；系统设置「透明效果」关着、省电模式、远程桌面、虚拟机里都会退成纯色。不论哪条路，CSS 版必须是完整可用的样子，原生只是加分。

**如果以后要试（列进实测清单）**：「玻璃垫底窗口」——另开一个不接受鼠标（`WS_EX_TRANSPARENT | WS_EX_NOACTIVATE`）、没有网页、和岛同大小的窗口放在岛窗口正下方，给它 `DWMSBT_TRANSIENTWINDOW` 或 acrylic，岛的 CSS 底色改半透明；展开收起时原生端按同一条缓动曲线改它的大小（参考初代的区域插值）。先在 Windows 上只验证三件事：未激活时还实时不、圆角能不能裁、拖动和贴边动画卡不卡。

### 3. macOS

- `tauri.conf.json` 已有 `"macOSPrivateApi": true`，透明窗口可用。
- window-vibrancy 0.6（我们现在的版本）有 `apply_vibrancy(window, material, state, radius)`，第 4 个参数是 effect view 的圆角；0.7 起加了 `apply_liquid_glass`（macOS 26+，系统的 NSGlassEffectView，可设圆角），最新 0.8.1。tauri-plugin-liquid-glass（第三方）在旧系统上退回 NSVisualEffectView。
- 和 Windows 一样，这些 API 是给**整个窗口**加背景 view，我们的舞台比岛大。要用就得自己加一个和岛同大小、同形状的 effect view（`maskImage` 或圆角 + 顶边直角），并在展开收起时改 frame。Tauri issue #14165 报过 macOS 15 上 webview 没跟着 effect view 圆角裁剪的问题，说明这块要自己处理。
- NSVisualEffectView 的 `.behindWindow` 模式确实模糊**后面的窗口和桌面**，不需要屏幕录制权限，系统负责、开销低。这是三个平台里唯一一个「真透出」比较现实的地方。
- **和 G1.11（刘海）的关系**：刘海形态下折叠岛的两翼是纯黑，为了和硬件刘海融为一体；这时不能透，必须退回纯黑（菜单栏在刘海旁边是黑的或半透明的，玻璃会露出刘海的轮廓）。展开态、或形态是药丸 / 贴顶（C65）时才用玻璃。

### 4. 拿不到桌面时，网页里能做什么

| 技术 | 能做的 | 在我们这里的限制 | 开销（岛这么大） |
|---|---|---|---|
| 多层渐变（现在的做法） | 静态着色、斜向高光 | 静止，看着像着色底（issue 的原话） | 无 |
| 预先模糊的色块 + `transform` 动画（mesh / 极光） | 缓慢流动的彩色光 | 无 | 很低：只动合成层，不重绘；`filter: blur` 只在开始时栅格化一次。注意不要动画 `filter`、`background-position` 或渐变本身，那会每帧重绘 |
| `@property` 角度 + `conic-gradient` 边框（油膜虹彩边） | 边缘沿着岛流动的色散高光 | 无 | 低：每帧重绘一条细边（只重绘那一层） |
| 跟鼠标的镜面高光（现有 `useGlassPointer`） | 高光随指针走 | 只有鼠标在岛上时有用 | 很低 |
| SVG `feDisplacementMap` + `backdrop-filter: url(#f)` | 边缘折射（kube.io、archisvaze/liquid-glass 等做法） | **只能折射岛自己的内容**；只在 Chromium 里能用于 `backdrop-filter`（WebView2 行，Mac WKWebView 不行）；滤镜对栅格化后的图做，大半径时边缘发糊 | 中：内容一变就整块重算；尺寸变化（展开动画）时每帧重算位移图 |
| SVG 「goo」或弹簧缓动的液体形变 | 展开收起时边缘先鼓后回、像液体 | 用 `linear()` 缓动或几帧的 `scale` 回弹就够；真 goo 滤镜要整块重算 | 低（缓动）/ 中（goo 滤镜，只在动画那 0.4 秒） |
| WebGL / WebGPU 着色器（canvas） | 噪声流体、真正的折射、色散 | 要常驻一个 GPU 上下文；透明 WebView 里 canvas 叠在岛下面要处理圆角裁剪；WebView2 掉显卡时整块空白 | 中：限 30 fps 时一块 560×306 的着色器对独显很轻，但 GPU 不再空闲，笔记本的核显和电池会看得出 |

Liquid Glass 的 Web 复刻都依赖「后面有东西可以折射」（文章示例都放在照片上），放到我们这里只有方向 1 能完整成立；方向 2 的「透出 + 模糊」部分在预览页里放在一张假壁纸上，**是为了让用户看到原生材质能拿到时的样子**，预览页里另有一个「拿不到桌面时」开关，切过去才是在应用里实际会看到的样子。

### 5. 停动画

- CSS 档：给岛加一个 `island--glass-paused` 类（收起到边缘、游戏免打扰、窗口隐藏、`prefers-reduced-motion`），里面 `animation-play-state: paused`。停在当前帧，恢复时不跳。
- 折叠态：Chromium 对屏幕外 / `visibility: hidden` 的动画会降频，但透明窗口里的岛一直「在屏幕上」，不能指望浏览器自己停，要自己暂停。
- WebGL 档：停 `requestAnimationFrame`，保留最后一帧；`webglcontextlost` 时退回 CSS 档。
- 颜色跟封面：只在换歌时取一次色（缩到 16×16 的 canvas 求几个主色），过渡交给 CSS `transition`，不按帧取。

### 6. Windows 上要实测的（本机是 Mac，下面都没测过）

1. 预览页在 Edge（WebView2 同内核）里：2B / 2C 的折射是否显示，各档帧率；任务管理器里 Edge 的 GPU 占用在 1A / 1B / 1C / 1D 下各是多少。
2. 第 2 波实现后，`pnpm build:exe` 的岛：收起、闲着时 CPU（基线单核 10%，[idle-usage.md](../investigations/idle-usage.md)）和 GPU 列在开液态玻璃前后的差；展开着放歌时同样测一次。
3. 贴边收起、游戏免打扰、隐藏到托盘时动画确实停了（GPU 回到基线）；系统「设置 → 辅助功能 → 动画效果」关掉时不动。
4. 浅色岛 + 浅色桌面、深色岛 + 深色桌面四种组合下文字看得清；`pnpm test:regression` 的浅色对比度检查通过。
5. （只在决定做 Windows 原生实验时）「玻璃垫底窗口」：`DWMSBT_TRANSIENTWINDOW` 在**未激活**的无边框小窗口上是否实时；`SetWindowRgn` 圆角能否裁住材质；拖动、贴边滑出、换屏时卡不卡；系统「透明效果」关掉、省电模式、远程桌面下退成什么。Windows 10 上 `apply_acrylic` 同样走一遍。

### 7. 参考

- eIsland（JNTMTMTM/eIsland，346 star，2026-11-15 查）：Tauri 2 + React 的 Windows 灵动岛。岛本体没用原生材质也没用折射滤镜；只有「Agent 输入球」用一个 WGSL（WebGPU）着色器画「液态玻璃球」（流体 + 玻璃外壳 + 边缘光），说明同类项目也是走「自己画会动的颜色」，而不是透出桌面。
- DynamicWin（FlorianButz/DynamicWin，C#）：Windows 上的灵动岛，是否做玻璃未核实。
- Apple 的 Liquid Glass（iOS 26 / macOS 26）：透出 + 模糊 + 边缘折射 + 镜面高光 + 形变，系统 compositor 实现；Mac 上 `apply_liquid_glass` 可以直接用。

## 来源

- 本仓库：`git show f1365ca7 -- src-tauri/src/lib.rs`、`git show 92dea57f -- src-tauri/src/lib.rs`（注释原文）、`git show 48699bd1 -- README.md`
- 上游发布说明：[v0.2.18 `daeb3968`](https://github.com/flyl1u/fly-island/commit/daeb3968)、[v0.2.20 `b52b13e6`](https://github.com/flyl1u/fly-island/commit/b52b13e6)
- [window-vibrancy（tauri-apps）](https://github.com/tauri-apps/window-vibrancy)，[lib.rs 0.8.1 源码与文档](https://docs.rs/crate/window-vibrancy/latest/source/src/lib.rs)（acrylic / blur 拖动卡顿的说明、`apply_liquid_glass` macOS 26+）
- [DWM_SYSTEMBACKDROP_TYPE（Microsoft Learn）](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwm_systembackdrop_type)
- [SetWindowDisplayAffinity / WDA_EXCLUDEFROMCAPTURE（Microsoft Learn）](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity)，[New ways to do screen capture（Windows Blog）](https://blogs.windows.com/windowsdeveloper/2019/09/16/new-ways-to-do-screen-capture/)
- [flutter_acrylic issues](https://www.github.com/alexmercerind/flutter_acrylic/issues)（未激活窗口非实时 acrylic）、[Inkdrop：Acrylic 改尺寸卡顿](https://forum.inkdrop.app/t/lag-when-resizing-the-window-with-acrylic-background/4011)、[vscode-vibrancy #136](https://www.github.com/EYHN/vscode-vibrancy/issues/136)
- [Tauri issue #14165](https://github.com/tauri-apps/tauri/issues/14165)（macOS effect view 圆角与 webview 裁剪）、[tauri-plugin-liquid-glass](https://awesome.ecosyste.ms/projects/github.com%2Fhkandala%2Ftauri-plugin-liquid-glass)
- [Liquid Glass in the Browser: Refraction with CSS and SVG（kube.io）](https://kube.io/blog/liquid-glass-css-svg)、[archisvaze/liquid-glass](https://github.com/archisvaze/liquid-glass)、[liquid-glass-js](https://cdn.jsdelivr.net/npm/liquid-glass-js@0.1.0/README.md)、[LogRocket：How to create Liquid Glass effects with CSS and SVG](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)、[ekino：Liquid Glass in CSS and SVG](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d)
- [eIsland](https://github.com/JNTMTMTM/eIsland)（`src/renderer/components/components/DynamicIslandAgentInputBall/config/shaderSource.ts`）、[DynamicWin](https://github.com/FlorianButz/DynamicWin)
- 本仓库测量：[idle-usage.md](../investigations/idle-usage.md)
