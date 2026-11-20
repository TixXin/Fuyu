# 标志：水母

更新：2026-11-20（应用图标、菜单栏、托盘和岛上已换）

浮屿的标志是一只宽头、四瓣触手、没有光环的小水母（issue #281）。它同时是应用图标、Mac 菜单栏图标，以及岛上收起条左边常驻的「浮屿水母」（开着 Agent 时随状态变色、做动作）。状态、动效和各种尺寸的预览在 `pnpm logo` 打开的 [jellyfish-set-preview.html](../investigations/jellyfish-set-preview.html)。

## 定稿文件

都在 `docs/assets/logo/`，画布都是 64 宽的同一套坐标，改造型先改这里，再导出。

| 文件 | 用途 | 说明 |
|---|---|---|
| `app-icon.svg` / `.png` | 应用图标母版（Windows、安装包、商店、README） | 64×64 画布，圆角方块铺满；PNG 是 1024 像素，给 `pnpm tauri icon` |
| `app-icon-macos.svg` / `.png` | macOS 的 `.icns` | 同一图标按 Apple 网格缩到 824/1024，留边并带一层柔和投影 |
| `app-icon-small.svg` | 32 像素及以下（16、24、32 的 ico 层、托盘） | 去掉光晕、高光和腮红，眼睛放大，水母放大到 0.9 |
| `menubar-template.svg` | Mac 菜单栏模板图 | 25×18，纯黑单路径，眼睛是镂空；系统按深浅色自动反色 |
| `jellyfish.svg` | 岛上状态灯的分层母版（空闲色） | 分组 `lobes`（`lobe-1`…`lobe-4`）、`head`（`bell`、`highlight`、`cheeks`、`eyes`），动效按组驱动 |

PNG 用无头 Chrome 从 SVG 导出（本机没有 rsvg / inkscape）：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 --window-size=1024,1024 --screenshot="$PWD/app-icon.png" "file://$PWD/app-icon.svg"
```

## 几何

- 头：`M5 30.5C5 16 17 7 32 7S59 16 59 30.5c0 3-2.4 5.5-5.4 5.5H10.4C7.4 36 5 33.5 5 30.5Z`
- 触手：四个圆，圆心 x = 18、27.3、36.7、46，y = 39，半径 6.6
- 合并后的单一轮廓（图标、模板图用；岛上分层母版仍用头加四个圆，方便触手各自动）：
  `M5 30.5C5 16 17 7 32 7S59 16 59 30.5c0 3-2.4 5.5-5.4 5.5H51.88A6.6 6.6 0 0 1 41.35 43.68A6.6 6.6 0 0 1 32 43.63A6.6 6.6 0 0 1 22.65 43.68A6.6 6.6 0 0 1 12.12 36H10.4C7.4 36 5 33.5 5 30.5Z`
- 眼睛 (24, 25) 和 (40, 25)，竖椭圆；腮红 (17.6, 31.5) 和 (46.4, 31.5)
- 图标里水母的位置：`translate(4.5 9.4) scale(.86)`；圆角方块 `x=1 y=1 62×62 rx=15`

## 颜色

应用图标（深海）：

| 用处 | 颜色 |
|---|---|
| 底色 | `#03101F` |
| 光斑 | `#00C2FF`（左下）、`#2D5BFF`（右）、`#7A3DFF`（右上）、`#00FFC8`（左上，弱） |
| 水母身体 | 渐变 `#DFF6FF` → `#6CC4FF`，外发光 `#6FD0FF` |
| 眼睛 / 腮红 | `#0E2340` / `#FF7FA5` |

岛上状态灯（身体颜色随状态变，眼睛 `#1D1B22`，腮红 `#FF8FA0`）：

| 状态 | 代码里的 phase | 颜色 |
|---|---|---|
| 空闲 | `idle` | `#F6E3D3` |
| 运行中 | `running`、`compacting` | `#6DB6F4` |
| 等你 | `waiting` | `#FFCD3C` |
| 出错 | `failed` | `#F2554C` |
| 完成 | `completed` | `#5ED69E` |
| 过期 | `stale` | `#A9ADB8` |

图标里的水母是蓝色，岛上空闲时是米白，这是有意的：图标要在深色炫彩底上亮，岛上空闲要安静。

## 替换进度

产品里换标志的位置（每项落地时另开任务）：

- ~~**应用图标**~~：已换（C157）。`src-tauri/icons/` 的 PNG 和 MSIX 方块图从母版缩出，32 及以下（`32x32`、`Square30x30Logo`、`Square44x44Logo`、ico 的 16/24/32 层）用小尺寸版；`icon.icns` 用 macOS 版经 `iconutil` 生成；VS Code 扩展图标同步换了。`mark.svg` 跟岛上那一项一起换了
- ~~**托盘 / 菜单栏**~~：已换（C158）。Mac 菜单栏的模板图由 `src-tauri/src/tray_mark.rs` 按 `menubar-template.svg` 的几何（头的曲线、四个触手圆、两个眼睛椭圆）逐像素画，改造型要两边一起改；托盘卡片头部的 `FuyuMark` 用同一条路径。Windows 托盘直接用 `icon.ico`
- ~~**岛上**~~：已换（C159）。状态灯样式和中心图案的取值仍是 `mark`（老设置不用迁移），画法在 `src/features/center-pattern/JellyfishMark.tsx` / `.css`；设置里的选项名、Agent 页的样式预览、文案和搜索索引一起改了；`src-tauri/icons/mark.svg` 换成了水母图标
- **对外**：关于页的「Logo 征集中」，`scripts/readme/assets.mjs` 生成的 README 图，各语言 README 的图片说明
