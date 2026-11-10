# 截图软件：该有什么、优秀的软件有什么独特做法

> 日期：2026-11-10。问题：浮屿要内置截图，先弄清楚一个截图软件应该具备什么功能，优秀的截图软件有哪些先进、独特的做法，以及在 Windows 上用 Rust / Tauri 怎么实现。范围：Snipaste、PixPin、ShareX、Greenshot、Flameshot、ksnip、Snagit、Windows 截图工具、微信 / QQ 截图，macOS 的 CleanShot X、Shottr、Xnip，新项目 Snow Shot；官网、更新日志、GitHub issue、V2EX、少数派等评测；Microsoft Learn 的截屏和 DPI 文档；crates.io / GitHub 上的 Rust 截图库。star 数、版本和价格都是当天查的。相关任务：[C40](/docs/tasks/C/C40.md)。

## 结论

1. **基础功能已经是共识**：区域 / 窗口 / 显示器 / 上次区域 / 延时截图，自动识别窗口和界面元素，放大镜和取色，一套标注（矩形、箭头、画笔、文字、马赛克、序号），复制 / 保存 / 贴到屏幕上，快捷键，多显示器和高 DPI。缺任何一项都会被拿来和系统自带的截图工具比。
2. **用户最在意的进阶功能**依次是：**贴图**（Snipaste 的招牌）、**长截图**（Snipaste 被抱怨最多的就是没有它，PixPin 靠它赢了不少用户）、**本地 OCR**、**自动打码**（PixPin、Snagit、微信都在做）。录屏 / GIF、上传图床、美化背景属于另一类需求。
3. **浮屿能做出别人做不到的**，在于截图之后去哪：截完在岛上出现缩略图，拖走、放进文件中转、进剪贴板历史；OCR 后一键交给快捷翻译；**一键把截图发给正在跑的 Claude Code / Codex 会话**（调研里没找到成熟的主流实现，只有 Snow Shot 开了 MCP 接口）。这是做这个功能的主要理由，单比截图本身我们追不上 PixPin 和 Snipaste。
4. **技术上可行，难点在 DPI 和多显示器**：先用 GDI / DXGI 把每个显示器冻结成图，再在每个显示器上各开一个置顶的选区窗口；进程要是 Per-Monitor V2。Flameshot 在混合 DPI 下选区偏移的 bug 拖了好几年，是现成的反面教材。Rust 有维护活跃的 [xcap](https://github.com/nashaofu/xcap)（2026-11-09 刚更新）和 [windows-capture](https://github.com/NiiightmareXD/windows-capture)；OCR 直接复用剪贴板历史已经在用的 `win32::ocr`。
5. **快捷键**：PrintScreen 在 Win11 默认归系统截图工具，Win+Shift+S / R 是系统快捷键。默认用别的组合（Snipaste 风格的 F1 或 Ctrl+Alt+A），另给一个"接管 PrintScreen"的开关。

### 建议的范围

2026-11-10 用户同意按下面的范围做，另外把录屏也加了进来（排在第三版），计划见 [screenshot-plan.md](/docs/architecture/screenshot-plan.md)，任务 [C41](/docs/tasks/C/C41.md)。

- **第一版**：区域截图 + 自动识别窗口和元素、放大镜和取色、基础标注、复制 / 保存 / 贴图、岛上的截图预览（拖出、进文件中转、进剪贴板历史）、OCR 复制文字和交给翻译、发给 Agent 会话。多显示器和混合 DPI 第一版就要做对。
- **第二版**：长截图（照 ShareX #8631 的思路处理吸顶头部）、自动打码（邮箱、手机号、IP 用规则就能做）、截图历史、像素测量。
- **不做**：录屏 / GIF、上传图床、美化背景、AI 抠图。前两项是另一类产品，后两项和浮屿关系不大。
- **形式**：建议做成可以关掉的内置模块（像音乐、翻译那样在设置里有开关），不做成插件：它要用到原生截屏、多窗口和 OCR，插件 API 暂时给不了。

## 详细

### 基础功能对照

| 功能 | 谁做得好 | 备注 |
|---|---|---|
| 截取模式 | ShareX 最全：全屏、活动窗口、活动显示器、菜单选窗口、区域、上次区域、自定义区域 [1] | Snow Shot 也有区域、聚焦窗口、当前显示器和延时 [2] |
| 自动识别窗口和元素 | Snipaste、PixPin [3][4] | Snipaste 的"层级元素检测"要 PRO；Windows 的 Perfect screenshot 用 AI 收紧选区，只在 Copilot+ PC 上 [5] |
| 放大镜和取色 | Shottr 能取文字颜色和区域平均色 [6]；Windows 截图工具 2025 年加了取色器（HEX、RGB、HSL）[5] | |
| 标注 | 矩形、椭圆、箭头、画笔、荧光笔、文字、马赛克 / 模糊、序号、聚光灯是标配 [1][4][6] | PixPin 还有水印和自动马赛克 [4] |
| 输出 | 复制、保存、贴图、拖进别的应用 [4][7] | Snipaste PRO 能"复制为文件"，保存时带阴影和边框 [3] |
| 快捷键 | Snipaste PRO 可按应用排除快捷键 [3] | |

### 各软件的独特做法

| 软件 | 独特之处 | 授权 / 价格 |
|---|---|---|
| **Snipaste** | 贴图是招牌；PRO 有文字提取、二维码、不占全局快捷键的 Super-snip、层级元素检测、固定比例、圆角截图、热角 [3]。没有长截图，V2EX 上的老用户抱怨的就是这一点 [8] | 免费版限个人使用；PRO 一次性 $19.99，3 台设备 [3] |
| **PixPin** | 长截图（按 A 自动滚动，横纵都行）；离线 OCR（9 种语言）；截图时按 Q 扫码；贴图可以是图片、文字、颜色、文件；自动打码邮箱 / IP / URL；录屏导出 MP4 / GIF / WebP [4][26] | 核心免费无广告；AI 翻译、表格、公式要会员（活动价永久 ¥158）[4] |
| **ShareX** | 截图后可串一串任务（工作流），自定义上传目标；滚动截图、OCR、录屏；附带取色器、尺子、二维码、去背景等一堆小工具 [1] | GPL-3.0，40.9k★ [9] |
| **Greenshot** | 2025-07 发 1.3：编辑器缩放、高 DPI 修复，修了一个反序列化执行代码的漏洞 [10] | 开源 |
| **Flameshot** | 截完原地编辑，可以用 DBus 控制 [11]；Windows 上混合 DPI 的选区偏移拖到 2026-02 才修 [29] | GPL-3.0，31.5k★ |
| **ksnip** | 贴纸、水印、导出 PDF，Tesseract 插件做 OCR [12]；作者已经没精力维护 | GPL-3.0，3.4k★ |
| **Snagit** | Smart Redact 用 AI 自动打码邮箱、电话、卡号、人脸；Step Capture 录操作步骤生成教程，导出 Word / PPT [13][14] | 订阅约 $39/年，2025 起不卖永久版（第三方文章，未在官网核实）[15] |
| **Windows 截图工具** | Win+Shift+R 录屏、可录单个窗口；不截图直接复制选区文字；AI 裁剪；取色器；文字标注 [5][16][17] | 系统自带 |
| **微信 / QQ** | 微信 PC 4.1.9 有滚动长截图 [18]；截图翻译、OCR、智能打码（自动认头像、昵称、手机号）[19][20] | 部分来源只看到标题或摘要 |
| **CleanShot X**（mac） | 加背景、截图时隐藏桌面图标、截图历史、录屏带摄像头小窗和按键显示、云分享 [7] | $35 一次性 [21] |
| **Shottr**（mac） | 像素尺子（方向键移动，点击把数值盖到图上）、前后对比叠图、截图约 17ms [6] | 自定价格，可填 $0 |
| **Snow Shot** | C++/Qt + Rust；离线 OCR、贴图、长截图、录屏导出 GIF / APNG / WebP、可选的 AI 翻译和**MCP 接口** [2]；早期是 Tauri 版 [23] | GPL-3.0，6.9k★（只能参考思路，不能抄代码） |

### 进阶功能怎么做

- **长截图**：ShareX 的做法是截可见区域、模拟滚轮或 PageDown、再截，用重叠区域匹配拼接，内容不再变化时停 [25]。难点是吸顶的头部和侧栏导致错位或提前停止；ShareX #8631 的提议是先比较两帧找出不动的区域，只在会动的区域里匹配，保留第一帧的头部和最后一帧的底部 [26a]。还有人要手动滚动模式（#8896）[28]。
- **OCR**：本地离线是默认做法（PixPin、CleanShot、Snow Shot）[4][7][2]。浮屿的剪贴板历史已经在用 Windows.Media.Ocr（`src-tauri/src/win32/ocr.rs`）。
- **贴图**：置顶、半透明、缩放、旋转、鼠标穿透、直接选中贴图里的文字 [4][26]。
- **自动打码**：Snagit 用 AI [14]；PixPin 按规则认邮箱、IP、URL [4]；微信认头像、昵称、手机号 [19]。规则做法配合 OCR 的文字位置就能实现。
- **AI**：截图翻译（PixPin 会员、微信、Snow Shot）、AI 裁剪（Windows）、AI 打码（Snagit）。"截图后直接交给 AI 会话"没找到成熟的主流实现（未核实）。

### 用户常见的抱怨

- 没有长截图，或长截图拼接出错 [8][27][28][26a]。
- 混合 DPI 多显示器下选区偏移（Flameshot #4495、#3056 等）。报告者指出截图工具、Greenshot、ShareX 都没有这个问题，根因是没用 Per-Monitor V2 [29][30]。
- PrintScreen 被系统截图工具占用（注册表 `HKCU\Control Panel\Keyboard\PrintScreenKeyForSnippingEnabled`）[31]。
- 安全：从 QQ 提取出来的截图工具被认为不安全 [8]；Greenshot 旧版的漏洞 [10]。
- 维护：ksnip 只有一位维护者 [12]。

### Windows 上的实现

| 接口 | 优点 | 缺点 |
|---|---|---|
| GDI BitBlt / PrintWindow | 最简单；PrintWindow 能截被挡住的窗口 | 部分硬件加速的应用截不对 [32][33] |
| DXGI Desktop Duplication | 按显示器逐帧，快 | 只能截整个显示器；旋转屏要自己转正；鼠标指针要自己画；要处理 `DXGI_ERROR_ACCESS_LOST` [34] |
| Windows Graphics Capture | 能截窗口和显示器 | 会显示黄色边框，去掉要用户同意并在包清单里声明 capability，没打包的 exe 能不能去掉未核实 [35] |

我的判断（没有来源）：区域截图用 BitBlt 或 DXGI 先把每个显示器冻结成图，再弹选区窗口，不会碰到黄框；截单个被挡住的窗口时再用 PrintWindow 或 WGC。

- **DPI**：进程要 Per-Monitor V2，否则查到的坐标会被系统"虚拟化"，就是 Flameshot 那个 bug [36][29]。每个显示器各开一个选区窗口，各按自己的 DPI 显示，不要一个窗口横跨 DPI 不同的屏幕。
- **窗口和元素识别**：截图前用 EnumWindows / UI Automation 取好矩形（未核实，常规做法）。

### Rust / Tauri 相关库和项目（2026-11-10）

| 库或项目 | 情况 |
|---|---|
| [xcap](https://github.com/nashaofu/xcap) | 约 1.0k★，0.9.10（2026-11-09），下载 284 万；截屏幕、截窗口、录屏 [37][38] |
| [windows-capture](https://github.com/NiiightmareXD/windows-capture) | 528★，MIT；WGC 和 DXGI，带硬件编码；2.0.1（2026-08-08）[41][42] |
| [win-screenshot](https://crates.io/crates/win-screenshot) | MIT / Apache；BitBlt 或 PrintWindow；4.0.14（2025-11-22）[32][43] |
| [screenshots](https://crates.io/crates/screenshots) | 2024-03 后不再更新，写着 "Move to XCap" [40] |
| [socorin](https://github.com/tronglinh98/socorin)、[snipit](https://github.com/parthh37/snipit) | Tauri + React 的截图工具，可以参考选区窗口的做法 [44][45]，星数未核实 |

我们已经直接用 `windows` crate，单张截图用 GDI / DXGI 自己写也不难；用 xcap 能省掉多显示器枚举和格式转换，要先看它的 Windows 后端和 DPI 处理（未核实）。

## 来源

1. https://getsharex.com/
2. https://github.com/mg-chao/snow-shot
3. https://raw.githubusercontent.com/wiki/Snipaste/feedback/PRO.md
4. https://pixpin.cn/
5. https://blogs.windows.com/windows-insider/2025/05/22/paint-snipping-tool-and-notepad-updates-with-new-features-begin-rolling-out-to-windows-insiders/
6. https://shottr.cc/
7. https://cleanshot.com/
8. https://www.v2ex.com/t/990576
9. https://github.com/ShareX/ShareX
10. https://getgreenshot.org/2025/07/14/final-release-greenshot-1-3/
11. https://github.com/flameshot-org/flameshot
12. https://github.com/ksnip/ksnip
13. https://www.techsmith.com/snagit/whats-new/
14. https://alternativeto.net/news/2025/2/new-ai-powered-upgrades-for-snagit-and-camtasia-2025
15. https://www.screensnap.pro/blog/snagit-pricing
16. https://www.windowslatest.com/2025/08/19/windows-11-can-now-screen-record-specific-app-windows-using-win-s-r-snipping-tool/
17. https://www.ghacks.net/2025/11/10/windows-11s-snipping-tool-is-getting-the-ability-to-add-text-to-screenshots/
18. https://www.ithome.com/0/948/172.htm （原文 403，只看到标题）
19. https://www.sohu.com/a/1050089417_122066678 （标注为 AI 生成内容）
20. https://finance.sina.com.cn/tech/roll/2025-01-22/doc-inefvzct7456638.shtml
21. https://cleanshot.com/pricing
22. https://apps.apple.com/us/app/xnip-screenshot-annotation/id1221250572?mt=12
23. https://github.com/xiaofeiTM233/snow-shot
25. https://getsharex.com/docs/scrolling-screenshot.html
26. https://www.mdview.cn/blog/efficiency-tools/pixpin-guide.html
26a. https://github.com/ShareX/ShareX/issues/8631
27. https://github.com/ShareX/ShareX/issues/7063
28. https://github.com/ShareX/ShareX/issues/8896
29. https://github.com/flameshot-org/flameshot/issues/4495
30. https://github.com/flameshot-org/flameshot/issues/3056
31. https://winaero.com/how-to-disable-print-screen-from-opening-snipping-tool-in-windows-11-and-10/
32. https://lib.rs/crates/win-screenshot
33. https://github.com/obsproject/obs-studio/pull/2208
34. https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/desktop-dup-api
35. https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.isborderrequired
36. https://learn.microsoft.com/en-us/windows/win32/hidpi/high-dpi-desktop-application-development-on-windows
37. https://github.com/nashaofu/xcap
38. https://crates.io/crates/xcap
40. https://crates.io/crates/screenshots
41. https://github.com/NiiightmareXD/windows-capture
42. https://crates.io/crates/windows-capture
43. https://crates.io/crates/win-screenshot
44. https://github.com/tronglinh98/socorin
45. https://github.com/parthh37/snipit
