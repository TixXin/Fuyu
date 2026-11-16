# 剪贴板 Win+V 唤起卡顿（只在 Windows 上）

用户原话：「剪贴板的 win+V 唤起界面很慢很卡顿，mac 那边倒是正常」。组长：`[任务] 剪贴板 Win+V 唤起卡顿`（2026-11-16）。本文是排查结论和派工计划，派出去的任务会话先读这一份。

## 唤起链路（Windows）

1. 键盘钩子线程 `fuyu-keyboard-hook`（`src-tauri/src/win32/win_key_hook.rs` 的 `keyboard_proc`）：认出 Win+V 后发一次掩码键，再 `PostMessageW` 给剪贴板监听窗口。**这里很轻，不是瓶颈。**
2. 剪贴板监听线程的消息循环（`clipboard_history/listener.rs:107`）收到 `WIN_V_MESSAGE` → `service.emit_shortcut()`（`service.rs:543`）→ `popup::toggle`（`popup.rs:27`）。**`toggle` 跑在监听线程上，不在主线程。**
3. `toggle` 里依次调用：`is_visible`、`set_content_protected`、`hwnd`、`monitor_from_point`（固定位置的检查一次、指针位置再一次）、`primary_monitor`、`set_size`、`set_position`、两次 `emit_to`、`webview_memory::showing`、`show`、`set_focus`，最后 `activate_from_background`（`AttachThreadInput` + `SetForegroundWindow`）。在 Tauri 里，非主线程调用这些 getter 都要发到主线程、**同步等它回话**；主线程正忙（岛的动画、别的窗口在重绘）时，每一次都要排队等。尺寸和位置也分了两次设置。
4. 前端（`src/windows/clipboard/ClipboardWindow.tsx:35`）收到 `clipboard-popup-opened` → `openCount + 1` → `ClipboardPopup.tsx:66-75` 依次执行 `flush()`、6 个 setState，其中 `setNow(Date.now())` 每次都会变 → `filterPopupItems`、按天分组、最近统计全部重算 → **整张列表重新渲染**。
5. 列表（`ClipboardPopupList.tsx:48`）**没有虚拟化，行组件也没有 memo**：历史上限 500 条，默认 30 条。每行算 `formatAgo`、`contentKind`，挂 `useLinkPreview`；图片和文件行的缩略图是内联的 base64 data URL（`api.ts:66、73`）。
6. 窗口隐藏期间每复制一次，`useClipboardHistory.ts:77-79` 都会重新拉整份历史（缩略图都内联在里面），再整表 setState。被藏起来的 WebView2 会被节流，这些更新可能积压到唤起那一刻才一起执行。
7. Windows 独有：`useAccentColor.ts:22` 每次 `visibilitychange` 都会 invoke `getWindowsAccentColor`，颜色变了还会重写根元素的 CSS 变量。

## 和 Mac 的差别

- Mac 的 `popup_macos.rs:55` 结构几乎一样，但定位用逻辑坐标，聚焦用 `run_on_main_thread` 做一次 `make_panel_key`；没有 `AttachThreadInput`。
- 前端代码两边相同。WKWebView 唤醒隐藏的页面、重渲染一整张不虚拟化的列表，都比被藏起来的 WebView2 快。所以同一份前端，Windows 上更容易卡。
- 剪贴板窗口 `transparent: true`、`shadow: false`。透明的 WebView2 窗口第一次出帧要走 DirectComposition，比 Mac 慢，这一点无法完全消除。

## D48 / D51 有没有拖慢

- **D48**（#256，进行中，Mac 那台）：已提交 `d8e8b70c`，在 `toggle` / `hide` 里调用 `webview_memory::showing` / `hidden`，**但只有设了环境变量 `FUYU_WEBVIEW_LOW_MEMORY=1` 才生效**，默认什么都不做；也没有用 `TrySuspend`。所以默认情况下 D48 不是原因。要请用户确认一下自己的环境里没设这个变量。
- **D51**（#259，待做）：还没有提交。剪贴板窗口里 30 秒一次的 `setNow` 在隐藏时照样跑，属于 D51 的范围，和这里的卡顿关系不大。
- `clipboard-preview` 窗口：唤起时不会联动，只有按空格进入预览才会 show。和卡顿无关。

## 怀疑的原因（按可能性排序）

| # | 原因 | 在哪 | 怎么测 |
|---|---|---|---|
| R1 | 唤起时整张列表重新过滤、重新渲染（没有虚拟化，没有 memo，`setNow` 让每次都重算），数据有图片缩略图时更慢 | 前端 | 打点：收到 opened 事件 → 两次 rAF 后第一帧画出来；分别用 30 条和 500 条测 |
| R2 | `toggle` 在监听线程上，好几次同步往返主线程；尺寸、位置分两次设 | Rust | 打点：消息到达 → toggle 每一段 → show → 拿到焦点 |
| R3 | 被藏起来的 WebView2 被节流，积压的历史更新和缩略图解码集中在唤起时执行 | 两边 | 隐藏时连续复制十几张图后再唤起，和没复制时比较 |
| R4 | 透明窗口第一次出帧慢（WebView2 的合成） | 系统 | 打点里 show 到第一帧的时间；R1–R3 修完还慢，再查这一条 |
| R5 | `getWindowsAccentColor` 在显示时 invoke 并重写 CSS 变量 | 前端 | 打点；把强调色改成非「跟随 Windows」后对比 |

## 不改代码，用户先测几样（可选，几分钟）

在 Windows 上：

1. **换快捷键对比**：用默认的 `Shift+Win+V`（不走 Win+V 接管）唤起几次，和 `Win+V` 一样卡吗？一样卡，说明问题在窗口和页面，跟键盘钩子无关（我们预计是这样）。
2. **历史条数**：设置 → 剪贴板，把保留条数从当前值改成 30，再唤起几次，有没有明显变快？变快就是 R1。
3. **第一次和连着几次**：隔几分钟没用后第一次唤起，和紧接着第二次、第三次唤起，哪个更卡？只有第一次卡，偏向 R3 / R4。
4. 在 PowerShell 里运行 `echo $env:FUYU_WEBVIEW_LOW_MEMORY`，告诉我们有没有输出（排除 D48）。

不测也可以直接按下面的计划做：D79 会加打点，做完后用打点的数字对比。

## 计划

两个任务互不改同一个文件，可以并行（一个 Rust、一个前端，同时最多 1 个要 cargo 编译）。

### D79 剪贴板窗口唤起：打点，并去掉主线程的来回（Rust，Windows）

- issue：#659（https://github.com/TixXin/fuyu/issues/659），D79、D78 都挂在这个 issue 下。
- 做什么：
  1. 打点：设环境变量 `FUYU_CLIPBOARD_TRACE=1` 时，把「钩子消息到达 → toggle 各段 → show → set_focus → 前端回报第一帧」的毫秒数追加写到应用数据目录下的 `clipboard-open-trace.log`；不设时不做任何事。前端那一段由 D78 在第一帧画出来后 `emit` 一个事件回来，Rust 这边监听并写入（事件名两边在任务文件里约好，写进 `contracts.md`）。
  2. 把 `toggle` 里要用主线程的部分合成一次 `run_on_main_thread` 执行（取前台窗口、取显示器、定位、显示、聚焦都在里面），不再从监听线程一次次同步等主线程；尺寸和位置合成一次 `set_bounds` / 一次 `SetWindowPos`。
  3. 先 emit `clipboard-popup-opened`，再 show 的顺序保留（让页面先开始准备），其余行为不变：固定位置、跟随指针、居中、内容保护、取消序列粘贴、记下粘贴目标窗口都照旧。
- `--scope`：`src-tauri/src/clipboard_history/popup.rs`、`src-tauri/src/clipboard_history/service.rs`、`src-tauri/src/clipboard_history/listener.rs`、新文件 `src-tauri/src/clipboard_history/open_trace.rs`、`src-tauri/src/clipboard_history/mod.rs`、`docs/architecture/contracts.md`
- **和 D48 冲突**：D48（进行中，Mac 那台，owner `d48`）的 scope 里也有 `popup.rs`。D79 只动 `toggle` 的定位和显示部分，`webview_memory::showing` / `hidden` 两行原样保留。开工前先 `pnpm tasks conflicts`，并 SendMessage 告诉 D48 的会话。
- 做完：`cargo test --manifest-path src-tauri/Cargo.toml`（用 `pnpm heavy --`）、`pnpm build:exe`；在任务里写实测清单（Windows 真机：设 `FUYU_CLIPBOARD_TRACE=1` 后唤起 10 次，记下各段耗时；分别用 30 条和 500 条历史测）。

### D78 剪贴板窗口唤起时不整表重渲染（前端）

- 同一个 issue。
- 做什么：
  1. 唤起时不再因为 `setNow` 重新过滤整张列表：`now` 只给显示相对时间用，不放进 `filterPopupItems` 的依赖；6 个 setState 值没变时不触发（或合成一次）。
  2. 行组件 `memo`；列表改用已有的 `useVirtualRows`（`ClipboardManager` 在用），只渲染看得见的几十行。键盘上下选择、Alt+字母钉选、拖动排序、按天分组的分隔线、收藏置顶分隔线都要照常工作。
  3. 缩略图 `<img>` 加 `decoding="async"`、`loading="lazy"`。
  4. 窗口隐藏时收到 `clipboard-history-changed` 只记一笔「有更新」，显示时（opened 事件）再拉一次；显示中照旧实时拉。不能出现先显示旧数据再跳变的情况：拉取在 opened 事件里就开始，比 show 更早。
  5. `useAccentColor` 在 Windows 上 `visibilitychange` 时的 invoke，改到 opened 事件之后再做，不挡第一帧（只改剪贴板窗口用到的路径，不改全局行为的，就不动 `src/lib/theme/`）。
  6. 打点：设了 trace 时，第一帧画出来后把耗时 emit 给 Rust（事件名和 D79 一致）。
- `--scope`：`src/features/clipboard/ClipboardPopup.tsx`、`ClipboardPopupList.tsx`、`ClipboardPopupRow.tsx`、`ClipboardRowLead.tsx`、`useClipboardHistory.ts`、`src/windows/clipboard/`，以及 `tests/regression/` 里剪贴板弹窗的回归页
- 做完：`pnpm check`、`pnpm build`、`pnpm test:regression clipboard`（界面不该变，快照只在虚拟化后 DOM 结构确实变化时更新，并在提交说明里写清）。
- 和 D51 的关系：剪贴板窗口里的 `setInterval` 顺手在隐藏时停掉，D78 做完后在 D51 的任务文件里记一笔「剪贴板窗口已由 D78 处理」。

### 第二阶段（只在需要时）

D79、D78 合入后，请用户在 Windows 真机上按 D79 的实测清单测一轮。如果 show 到第一帧还是要几百毫秒（R4），再开一个 `[排查]` 会话，研究让隐藏的 WebView2 保持「可见」状态的办法（例如放到屏幕外而不是 hide，或者关掉 WebView2 的遮挡检测），先出数字再决定改不改。现在不建这个任务。

## 需要用户定的

1. 可以先做上面「用户先测」的 4 样吗？还是直接派会话？（不影响派工，测了能更早确认方向。）
2. 隐藏时不再实时拉历史，改成唤起时再拉（D78 第 4 条）：唤起那一刻会多一次 invoke，但隐藏时省掉每次复制的整表更新。可以吗？
3. D79 会碰 D48 正在做的 `popup.rs`：可以和 D48 并行，D79 只动定位和显示（推荐）；或者等 D48 收尾后再做 D79。

## 收口

D79、D78 的提交交给 `Fuyu-[总控] 全局` 整批合入；合入后请用户真机实测，再关 issue。进度更新在本文末尾。

## 进度

- 2026-11-16：D79（原 D77，合并 `origin/main` 时改号）`5012bba1`、D78 `d559bffc` 已在本地提交，组长看过 diff；`pnpm tasks dirty` 里没有它们留下的文件。交给 `Fuyu-[总控] 全局` 整批合入。
- D78 更新了 `clipboard-popup` 回归页的快照：原来有一帧整张渲染了约 460 行，虚拟化后只渲染看得见的行，所以快照少了约 1.3 万行；另加了一帧 300 条的虚拟化检查。
- D78 改了 `src/features/clipboard/api.ts` 的 `listenClipboardPopupOpened`（多带一个 `trace` 参数）。Mac 那台 C101.3 的认领范围里也有这个文件，合并时留意。

## 合入后在 Windows 真机上实测

1. 退出岛。在 PowerShell 里执行 `$env:FUYU_CLIPBOARD_TRACE='1'`，然后在同一个窗口里启动新的 `fuyu.exe`。
2. 历史 30 条：按 Win+V 唤起再关掉，共 10 次。打开数据目录里的 `clipboard-open-trace.log`，看每次 `open` 行的 `total` 和 `first-frame` 行的 `page`、`since-show`。
3. 把保留条数调到 500，复制到满（夹几张图），再测 10 次。
4. 窗口隐藏时连续复制十几张图，再唤起：列表应该直接是新的，不会先显示旧列表再跳。
5. 500 条时：滚轮、↑↓、Home/End、拖动固定项排序、Alt+字母粘贴都照常。
6. 强调色设成「跟随 Windows」，改一下系统强调色再唤起，颜色应该跟上。
7. 不设环境变量再启动一次：不会生成这个日志；跟随指针、居中、固定位置、粘贴回原窗口都和以前一样。
8. 主观感受：还卡吗？把 `clipboard-open-trace.log` 发给我们。如果 `since-show` 还有几百毫秒，再按「第二阶段」开排查会话。

## 设置窗口和托盘卡片打开也慢（2026-11-16 追加）

用户原话：「设置菜单窗口和托盘菜单打开也卡顿 慢」。和剪贴板是同一类问题：在 Windows 上，窗口要等 WebView2 准备好才显示。下面是排查结论，还没改代码。

### 设置窗口

- **每次打开都新建一个 WebView2**：`settings` 窗口是 `create: false`，关掉就销毁。`settings_window::open`（`src-tauri/src/settings_window/mod.rs:16`）每次都新建窗口，重新加载整套前端，再渲染设置页。这是 Windows 上最贵的一步，WebView2 启动比 Mac 的 WKWebView 慢得多。
- **等前端说「好了」才显示**：窗口建好时是隐藏的。前端在 `SettingsWindow.tsx:60` 等两次 `requestAnimationFrame` 后才调用 `show_settings_window`；一直没调用的话，Rust 侧 2 秒后兜底显示。WebView2 在窗口隐藏时可能不跑 `requestAnimationFrame`，那样每次都要等满 2 秒兜底。要打点确认：如果每次都正好约 2 秒，就是这个原因。

### 托盘卡片

- **第一次点托盘才建窗口**：`tray-menu` 也是 `create: false`，第一次点击时才在 `tray_menu/window.rs:84` 新建，所以第一次特别慢；之后隐藏常驻。
- **每次打开都等最慢的那份数据**：Rust 发 `tray-menu-open` → 前端 `TrayMenuWindow.tsx:42` 的 `open()` 用 `Promise.all` 等四样：托盘状态、内置插件、快捷键，布局是「状态」时还有媒体、会议、Agent 的 `refresh()`。四样都回来后才量尺寸、调 `resize_tray_menu`，Rust 收到尺寸后才显示（`window.rs` 的 `resize` → `reveal`），兜底 700 毫秒。所以最慢的那一项决定窗口什么时候出来。
- 隐藏期间 WebView2 会被节流，`tray-menu-open` 事件本身也可能晚到。

### 怎么测

先粗测，不用改代码：

1. 设置窗口连着开几次（开、关、再开）：是不是每次都要差不多 2 秒才出来？
2. 托盘卡片：开机后第一次点，和之后再点，哪次慢？之后再点也要半秒以上吗？
3. 设置 → 托盘卡片，把布局从「状态」换成别的，再点托盘：变快了吗？变快就说明 `refresh()` 慢。

任务里会加打点：设 `FUYU_WINDOW_TRACE=1` 时，把「请求打开 → 窗口建好 → 前端准备好 → 显示」各段的毫秒数写进数据目录的 `window-open-trace.log`，改完前后对比。

### 计划

两个任务，文件不重叠，可以并行。两个都要编译 Rust，正好是同时编译的上限 2 个。挂在一个新 issue 下。两个任务各自在自己的模块里打点，共用同一个环境变量和日志文件；日志格式写在 D82 的任务里，D83 照着用。

**D82 设置窗口打开变快（Windows）**

1. 打点（见上）。
2. 关设置窗口时改成隐藏、不销毁；再次打开直接显示，前端重新读一次设置、回到该去的页。退出岛、更新重启这些真正退出的路径照常关。
3. 显示时机：窗口隐藏时 `requestAnimationFrame` 靠不住，改成前端第一次渲染完（`useEffect` 里）就请求显示；Rust 的兜底从 2 秒降到 600 毫秒左右。
4. 可选，看你定：岛启动后空闲时（例如 10 秒后）在后台预先建好隐藏的设置窗口，第一次打开也快。
- `--scope`：`src-tauri/src/settings_window/`、`src/windows/settings/SettingsWindow.tsx`、`src/windows/settings/api.ts`、`src/windows/settings/WindowControls.tsx`、`docs/architecture/contracts.md`
- 验证：Rust 单元测试（`pnpm heavy --` 排队）、`pnpm build:exe`、`pnpm check`、`pnpm build`、`pnpm test:regression settings`；真机实测清单写进任务。

**D83 托盘卡片打开变快（Windows）**

1. 打点（见上）。
2. 收到打开事件后，先用上一次的数据量尺寸、显示，四样数据在显示后再刷新（尺寸变了照常 `resize`）。只有第一次打开、还没有旧数据时才等。
3. 岛启动后空闲时预先建好隐藏的托盘卡片窗口，第一次点击不用现建。
4. `resize` 之后的显示不再另排一次 `run_on_main_thread`，少排一次队。
- `--scope`：`src-tauri/src/tray_menu/window.rs`、`src-tauri/src/tray_menu/mod.rs`、`src-tauri/src/lib.rs`（只加预建的调用）、`src/windows/tray-menu/TrayMenuWindow.tsx`、`src/windows/tray-menu/useTrayMenuSize.ts`
- 验证：Rust 单元测试（`pnpm heavy --` 排队）、`pnpm build:exe`、`pnpm check`、`pnpm build`、`pnpm test:regression tray`；真机实测清单写进任务。

### 用户定的（2026-11-16，按推荐）

1. 设置窗口关掉后常驻（隐藏，不销毁）：再开很快，但多占一个 WebView2 的内存，大约 80–150 MB。可以吗？
2. 岛启动后空闲时预建：托盘卡片预建（推荐，它小）可以吗？设置窗口要不要也预建（第一次打开也快，但这块内存从开机就占着）？
3. 托盘卡片先用上一次的数据显示、再刷新：媒体、会议这些可能先显示一瞬间旧的再更新。可以接受吗？

用户同意派会话，没有逐条回答，按推荐：设置窗口关掉后常驻；托盘卡片启动后预建，设置窗口不预建；托盘卡片先用旧数据显示再刷新。issue #696。
