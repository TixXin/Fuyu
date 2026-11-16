# 托盘 / 菜单栏图标的卡片面板：计划

起因：用户给了 CitePix 的托盘卡片截图，要求「参考这个重新设计任务栏图标的右键菜单，要适配 mac 和 win」。只借鉴版式（标题行 → 一排大按钮 → 图标行 → 状态行 → 底部开关和退出），不照抄它的功能和样子。

组长：`[任务] 托盘菜单`。状态：**用户挑定三版都要、设置里切换；阶段 1（C99.2、C99.3）进行中**（2026-11-15）。总 issue #627，C99.1–C99.3 对应 #628–#630。

## 现状

- `src-tauri/src/tray.rs`（213 行）：Tauri 原生 `Menu`，六项：显示 / 隐藏岛屿、快捷翻译、截图、暂停 / 恢复剪贴板记录、设置、退出；跟随界面语言（`set_tray_language`）。`show_menu_on_left_click(true)`，左键同时还会把岛显示出来。
- `tray_mark.rs` 画 Mac 的模板图；`tray_visibility.rs` 是 C82「隐藏托盘图标」（存 `tray-icon.json`，隐藏后再次打开浮屿 → 显示岛 + 打开设置通用页）。
- 设计约定：`docs/design/island.md` 的 F13（菜单三项，后来加到六项）、C82 两条。
- 内存：D47（测量）、D48（隐藏窗口用 WebView2 内存 API，进行中）、D50（翻译 / 截图窗口按需创建、空闲销毁）、D51（隐藏窗口停定时器）。

## 先定下来的方案（组长的建议，用户可以改）

1. **左键弹卡片，右键弹原生精简菜单**（显示 / 隐藏岛屿、设置、退出）。原生菜单就是退路：卡片窗口坏了、WebView 卡住时右键仍能退出。Mac 上点菜单栏图标弹卡片，⌃点击 / 右键弹原生菜单。左键不再顺手把岛显示出来（卡片里有这个开关）。
2. **新窗口 label `tray-menu`、`?window=tray-menu`**，`create: false`，第一次点图标时创建，之后隐藏常驻（不每次销毁：托盘点开要即时）；隐藏时接 D48 的 `MemoryUsageTargetLevel = Low`，定时器按 D51 停掉。新 label 要写进 `contracts.md` 和 `AGENTS.md` 的窗口表。前端入口单独分包，岛的包不变大。
3. **弹出位置在 Rust 算**（纯函数 + 单测）：拿托盘图标的矩形和所在显示器的工作区；Windows 任务栏在下 / 上 / 左 / 右四种都贴着图标、不出屏，溢出托盘（^ 里的图标）也按图标矩形算；Mac 在菜单栏下面、右边对齐图标，靠屏幕右沿时往左收。多显示器、不同缩放按图标所在的那块屏算。
4. **失焦就关**，Esc 关，再点图标关；Mac 做成不抢菜单栏的 NSPanel（`macos/` 里加，参照 `island_panel.rs`），全屏应用的空间里也能弹；Windows 无边框、圆角、阴影、不进任务栏。打开时焦点在第一个按钮，Tab / 方向键移动，按钮都有无障碍名字，开关用 `role="switch"`。
5. **深浅色**：跟系统（任务栏 / 菜单栏是系统颜色），不跟岛的主题；强调色用主题色。
6. **和 C82 的关系**：图标隐藏了卡片自然打不开，C82 的找回路径不变；卡片底部不放「隐藏图标」开关（容易把自己锁在外面），留在设置 → 通用。

## 卡片里放什么（预览页给两三种组合挑）

按浮屿自己的功能，大致从上到下：

- **标题行**：浮屿标记 + 名字 + 版本号；有新版本时版本号旁边一个「可更新」小标，点了走更新；右边设置齿轮。
- **主按钮行**：大按钮「显示 / 隐藏岛屿」（状态型，亮着表示岛在显示），旁边三个方块：截图（带快捷键）、快捷翻译、剪贴板。功能关掉的格子变灰并提示去设置里开。
- **状态区**（可选、按情况出现）：正在放的歌（封面 + 歌名 + 播放 / 暂停）、下一个会议、Agent 正在跑几个会话 / 等你几个。
- **开关行**：游戏勿扰、暂停剪贴板记录、（可选）开机自启。
- **底部**：重启、退出（红色）。

预览页出三版内容让用户挑：A「入口型」（贴近参考图，功能按钮为主），B「状态型」（状态区为主，按钮少），C「精简型」（只比原生菜单多一排按钮）。每版都有 Windows 右下托盘向上弹、Mac 菜单栏向下弹，各深浅两色，并演示任务栏在左 / 上时的位置。

## 分阶段

### 阶段 0：预览页（1 个会话，只写 HTML，不编译）

- 任务 **C99.1** `[C99.1] 托盘卡片的预览页`，scope `docs/investigations/tray-menu-preview.html`。
- 做完：上面三版 × 两平台 × 深浅色，中英文切换看溢出，能点开关和键盘 Tab 走一遍；每出一版就用 `open` 在系统浏览器打开。
- 用户挑定后写回本文件（见下一节）；`docs/design/island.md` 由 C99.3 改。

### 用户挑定（2026-11-15）

**三版都要，在设置里切换**（用户原话：「都要，可以设置」）。版式按预览页 `tray-menu-preview.html`（8990b1b3）的 A 入口型、B 状态型、C 精简型照做。

- 设置 → 通用，紧挨「在托盘显示图标」：「托盘卡片样式」三选一（入口型 / 状态型 / 精简型，带小示意图），默认 **A 入口型**（组长定，贴近用户给的参考图）。托盘图标隐藏时这一项变灰。
- 存在 localStorage `fuyu-tray-menu-layout`，值 `entry` / `status` / `compact`，读不到或值不认识时按 `entry`；加进设置备份的 `BACKUP_KEYS`，写进 `contracts.md`。卡片窗口和设置窗口同源，卡片每次打开时读一次，并监听 `storage` 事件。
- 右键的原生精简菜单三版都一样（显示 / 隐藏岛屿、设置、退出）。

### 阶段 1：实现（2 个会话并行，都要编译，正好占满 2 个名额）

两边按下面的接口各做各的；要改接口时先 SendMessage 告诉另一边和组长，再改本文件。

- **窗口**：label `tray-menu`、`?window=tray-menu`，`create: false`，Rust 第一次点图标时创建，透明、无边框、不进任务栏、置顶，初始宽 320 逻辑像素。
- **尺寸**：三版高度不同，前端渲染完量卡片大小后调 `tray_menu_resize(width: f64, height: f64)`（逻辑像素），Rust 按当前锚点（图标矩形）重算位置再显示。打开顺序：Rust 定位并通知前端 → 前端刷新数据、量尺寸、调 resize → Rust 显示并给焦点。
- **命令**：
  - `tray_menu_state() -> TrayMenuState`：`islandVisible`、`clipboardPaused`、`translateEnabled`、`screenshotEnabled`、`version`、`updateAvailable`（新版本号或 null）、`platform`（`windows` / `macos`）、`shortcuts`（截图、翻译、剪贴板的快捷键显示文字）。
  - `tray_menu_action(action: String, arg: Option<String>)`：`toggle_island`、`screenshot`、`translate`、`clipboard`、`toggle_clipboard_pause`、`open_page`（arg 是岛的页面：todo、notes、calendar、file-shelf、agent）、`open_settings`、`update`、`restart`、`quit`、`close`。执行完除了开关类都把卡片关掉。
  - `tray_menu_resize(width, height)`，见上。
- **事件**：`tray-menu-open`（Rust → 卡片，每次要弹出前发，卡片刷新数据并把焦点放到第一个按钮）、`tray-menu-state`（状态变了才推，内容没变不发，D49）。
- **已经有现成读写的不经这两个命令**：游戏勿扰、开机自启这类本来就有命令或 localStorage 的设置，前端直接用现有的；B 版的正在放的歌、下一个会议、Agent 会话数，前端用现有的命令和事件取（媒体、日历、Agent 状态各自的 `api.ts`），缺什么告诉组长再定，不在 `tray_menu_state` 里重复一份。
- **C99.2 Rust**（`[C99.2] 托盘卡片的窗口和定位`）：scope `src-tauri/src/tray.rs`、`src-tauri/src/tray_menu/`（新目录：窗口创建、定位纯函数和单测、命令、失焦关闭）、`src-tauri/src/macos/tray_panel.rs`（新）、`src-tauri/src/lib.rs`（注册）、`src-tauri/capabilities/`、`src-tauri/tauri.conf.json`（如需）、`docs/architecture/contracts.md`、`docs/architecture/platforms.md`、`AGENTS.md` 的窗口表。验证：`cargo test` + `pnpm build:exe`；Mac 上用打出的 `Fuyu.app` 点图标看位置。
- **C99.3 前端**（`[C99.3] 托盘卡片的界面和设置项`）：scope `src/windows/tray-menu/`（新，含 `api.ts`）、`src/main.tsx` 里加一个分支、`src/i18n/sections/trayMenu.ts`（新）和 i18n 的注册处、设置 → 通用里的样式选择（`src/windows/settings/GeneralSettingsPage.tsx` 及它的子组件、设置的 i18n、`searchIndex.json`）、`BACKUP_KEYS`、`tests/regression/tray-menu.*`、`docs/design/island.md`（替换 F13 那条，写三版和默认）。用 mock 接口先做，不等 Rust。验证：`pnpm check` + `pnpm build` + `pnpm test:regression`。
- 两个都做完后组长在 Mac 上实测一遍；**Windows 的实测**要用户在 Windows 机器上看（任务栏四个方向、多屏、溢出托盘），组长把要点列成清单。

### 阶段 2：收尾（可并进 C99.2，或单开一个小会话）

- 接 D48 的内存 API（看 D48 做到哪），量打开延迟和多出来的内存，写进 `docs/investigations/tray-menu-preview.html` 旁边的记录或 D47 的报告。
- `AGENTS.md` 窗口表加 `tray-menu`，`docs/design/island.md` 改约定，`platforms.md` 托盘行改写。

## 要开的 issue / 任务

已建：总 issue #627（C99），#628（C99.1）、#629（C99.2）、#630（C99.3）；C99.2、C99.3 依赖 C99.1。

## 要用户定的

1. 左键卡片、右键原生精简菜单，这样分可以吗？（建议是）
2. 深浅色跟系统，不跟岛的主题？（建议是）
3. 窗口第一次点时创建、之后常驻隐藏（约几十 MB，靠 D48 压）；还是每次关掉就销毁（省内存，但每次点开约 1 秒）？（建议常驻）
4. 内容方向等预览页出来再挑。

## 做不到 / 风险

- Mac 菜单栏图标拿到的矩形在某些菜单栏管理工具（Bartender 等）下不准，退回到鼠标位置。
- Windows 溢出托盘里点图标，系统的溢出窗会先关掉，卡片按点击位置弹。
- Windows 的实测只能用户或另一台机器做，Mac 这边测不到。
