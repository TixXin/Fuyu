# 开源剪贴板管理器调研

> 日期：2026-11-09。问题：我们已经有剪贴板历史页，参考开源剪贴板管理器，看还缺什么、哪些值得做；重点弄清三件事：怎么接管 Win+V、独立弹窗怎么粘贴回原窗口、历史图片怎么在 Claude Code 这类终端 CLI 里粘贴成功。范围：GitHub（`gh search repos "clipboard manager" --sort stars`，以及 `crosspaste`、`clipboard sync`、`剪贴板` 等关键词）、各项目源码（`gh search code` 搜 `DisabledHotkeys`、`WH_KEYBOARD_LL`、`ExcludeClipboardContentFromMonitorProcessing` 等）、anthropics/claude-code 的 issue、Microsoft Learn 和 Microsoft 支持文档。相关任务：暂无。
>
> star 数、最后推送时间、版本号都是 2026-11-09 用 `gh api` 查到的。
>
> 2026-11-10 又查了一轮，看得更宽（商业工具和 2025–2026 年新出的 GitHub 项目），结果在文末[「第二轮：功能全景」](#第二轮功能全景2026-11-10)。

## 结论

### 我们现在有什么（对照基线）

读了 `src/features/clipboard/` 和 `src-tauri/src/clipboard_history/`：

- 记录**文本**和**图片**（`arboard` 读写；图片存为 PNG 加缩略图，单张 PNG 上限 10 MB），`AddClipboardFormatListener` 监听，失败时每 2 秒轮询。
- 历史条数 5～200，默认 30；超出时先删最旧的**非收藏**项。数据存在应用数据目录的 JSON 文件和 `clipboard-images/`。
- 收藏、备注（≤80 字）、搜索、「全部 / 收藏」切换、删除、清空。
- 全局快捷键（默认 `Ctrl+Shift+W`，`RegisterHotKey` 注册，可以录制、可以关闭），按下后展开岛屿的剪贴板页。
- 点一条 = **只写回剪贴板**，不自动粘贴到原来的窗口。
- 划词翻译期间暂停记录；插件可以通过 `clipboard:read` 权限读文本历史。

没有的：富文本（HTML/RTF）、文件、自动粘贴、独立弹窗、数字键快速粘贴、纯文本粘贴、忽略密码管理器的内容、来源应用、按时间清理、导入导出、同步、Win+V。

### 三个重点问题的答案

**1. 接管 Win+V**：Win+V 被 Explorer 用 `RegisterHotKey` 占着，我们直接注册 `Win+V` 会失败。开源项目有三种做法：

| 做法 | 谁在用 | 代价 |
|---|---|---|
| **低级键盘钩子** `WH_KEYBOARD_LL`：Win 按住时吞掉 V 的按下和抬起，再注入一次未分配的虚拟键 `0xE8`，阻止松开 Win 时弹出开始菜单 | EcoPaste 1.0.0 起（设置项「接管 Win+V」） | 不改注册表、不重启 Explorer，关掉开关就恢复；但钩子常驻，回调慢了会被系统摘掉，还有边界 bug（EcoPaste #1466：Win 不放、连按 V 第二次会漏给系统） |
| **注册表** `HKCU\...\Explorer\Advanced` 的 `DisabledHotkeys` 字符串里加 `V`，**重启 Explorer**，然后自己 `RegisterHotKey(MOD_WIN, 'V')` | QuickClipboard、TieZ（TieZ 还把系统剪贴板历史和云剪贴板一起关掉） | 要杀掉并重启 explorer.exe（任务栏闪一下，打开的资源管理器窗口全关）；卸载或关闭功能时必须把 `V` 删掉再重启一次，否则 Win+V 一直失效（TieZ 在 NSIS 卸载脚本里做了这件事） |
| 不做，让用户用 AutoHotkey / PowerToys 把 Win+V 改到别的键 | Ditto（维护者明确拒绝，#143、#783） | 无 |

**建议**：如果要做，走 EcoPaste 的钩子方案，做成默认关闭的开关；不要改注册表和重启 Explorer，那样对一个「悬浮岛」来说副作用太大，而且应用异常退出时恢复不了。

**2. 独立弹窗**：做得好的都是「**弹窗不抢焦点**」或「**记住原窗口、粘贴前还给它**」。EcoPaste 把剪贴板窗口设成不可聚焦（`set_focusable(false)`），可见期间用低级键盘钩子收方向键、回车、数字键，用鼠标钩子处理点外面关闭；原窗口一直保持焦点，粘贴时只需 `SendInput` 一次 Ctrl+V。Ditto 和 QuickClipboard 用的是另一种办法：弹出前记下前台窗口（Ditto 还用 `GetGUIThreadInfo` 记下具体的焦点控件），粘贴前 `AttachThreadInput` + `SetForegroundWindow` 还回去，等它真的回到前台再发按键。弹出位置一般三选一：跟随鼠标（EcoPaste 默认）、屏幕中央、记住上次。粘贴键用 **Ctrl+V** 而不是 Shift+Insert（EcoPaste 在代码注释里写了原因：Monaco 编辑器会把 Insert 当成切换改写模式）。Ditto 还能按目标程序配置不同的粘贴按键。

**3. 历史图片粘贴到 Claude Code CLI**：

- Claude Code 在 Windows 上用 **Alt+V** 粘贴图片（Windows Terminal 自己拦了 Ctrl+V）。实现方式是起 PowerShell 5.1，调 `System.Windows.Forms.Clipboard.ContainsImage()` / `GetImage()`（#100899 记录了具体命令）。所以剪贴板上要有 .NET 认得的 **Bitmap**（`CF_DIB` / `CF_DIBV5` 都行，系统会互相合成）。
- 我们写回图片用的 `arboard` 3.x 会同时放 **`PNG` 注册格式和 `CF_DIBV5`**，格式上已经够了。但 Claude Code 自己的读取路径有一串还没修好的 bug：明明有图却报「No image found in clipboard」、第一次失败第二次成功、几分钟后失效（#68021、#90657、#103062、#69234），每次要 1～2.6 秒（#100899）。这些不是我们能修的。
- **更可靠的绕法是给路径**：在 #68021 里，有人确认读取只在「原始位图」上失败，剪贴板里是**文件引用（`CF_HDROP`）**时一直正常；另外 Claude Code 会把粘贴文本里的图片路径当成图片附上（#105249、#105680 是用户抱怨这个行为，正好说明它可行）。我们的历史图片本来就以 PNG 文件存在应用数据目录里，路径稳定。
- **建议**：图片条目加一个「**复制为文件**」/「**粘贴为路径**」操作。前者参照 QuickClipboard 的 `set_clipboard_image_file`，一次写入 `CF_DIB` + `PNG` + `CF_HDROP`（贴到聊天软件、画图、终端都能用）；后者直接写入带引号的路径文本，在 Windows Terminal 里用普通 Ctrl+V 就能贴，Claude Code 会把它识别成图片。以后做自动粘贴时，如果目标进程是 `WindowsTerminal.exe` 且条目是图片，可以改发 Alt+V，或者改贴路径。

### 推荐做的事

见文末「[优先级建议](#优先级建议)」。前三项：**忽略密码管理器内容**（几十行，隐私上必须有）、**图片复制为文件 / 粘贴为路径**（直接解决 Claude Code 的痛点）、**选中后自动粘贴回原窗口 + 键盘导航 + 数字键**（剪贴板工具最核心的体验，我们现在没有）。

## 详细

### 一、项目概览

| 项目 | ★（2026-11-09） | 许可证 | 平台 | 技术栈 | 最近推送 | 说明 |
|---|---|---|---|---|---|---|
| [Maccy](https://github.com/p0deje/Maccy) | 22251 | MIT | macOS | Swift | 2026-10-26 | 键盘优先、极简；⌥+回车粘贴，⌥+⇧+回车纯文本粘贴，⌥+数字快速粘贴；可以「忽略下一次复制」 |
| [CopyQ](https://github.com/hluk/CopyQ) | 12619 | GPL-3.0 | Win / macOS / Linux | C++ / Qt | 2026-11-02（v17.0.0，2026-10-06） | 标签页、多格式、脚本 API 和命令行、按窗口或内容忽略、加密标签页（`itemencrypted` 插件，GPG） |
| [Clipy](https://github.com/Clipy/Clipy) | 8965 | MIT | macOS | Swift | 2026-11-09 | 历史加片段（snippets）菜单 |
| [EcoPaste](https://github.com/EcoPasteHub/EcoPaste) | 7572 | Apache-2.0 | Windows / macOS | **Tauri 2** + React 19，SQLite（sqlx）+ FTS5 | 2026-08-13（v1.1.0，2026-07-22） | 和我们技术栈最接近，详见下文 |
| [Ditto](https://github.com/sabrogden/Ditto) | 7443 | GPL-3.0 | Windows | C++ / MFC，SQLite | 2026-10-01（3.25.113.0，2025-09-27） | Windows 上的老牌；分组、查找即输入、局域网同步（带密码加密） |
| [Slackadays/Clipboard](https://github.com/Slackadays/Clipboard) | 5945 | GPL-3.0 | 终端 | C++ | 2026-05-06 | 命令行剪贴板，参考价值小 |
| [SyncClipboard](https://github.com/Jeric-X/SyncClipboard) | 5210 | MIT | Win / macOS / Linux / 手机 | C# | 2026-11-09 | 同步为主，支持 WebDAV / S3 / 自建服务器 |
| [TieZ](https://github.com/jimuzhe/tiez-clipboard) | 3099 | GPL-3.0 | Windows 等 | **Tauri 2** + Rust | 2026-10-23 | 标签、贴边隐藏、WebDAV / MQTT 同步、局域网传输、顺序粘贴、隐私打码 |
| [Flycut](https://github.com/TermiT/Flycut) | 2700 | MIT | macOS | Objective-C | 2026-08-07 | 面向开发者的极简历史（⇧⌘V） |
| [CrossPaste](https://github.com/CrossPaste/crosspaste-desktop) | 2693 | AGPL-3.0 | Win / macOS / Linux | Kotlin | 2026-11-09 | 局域网端到端加密同步、本地 OCR、MCP Server、CLI |
| [PasteBar](https://github.com/PasteBar/PasteBarApp) | 2195 | 自定义（NOASSERTION） | Windows / macOS | **Tauri** + React 19，Diesel | 2026-08-18 | 无限历史、收藏夹/标签页/看板、PIN 保护的收藏、表单和模板、备份恢复 |
| [QuickClipboard](https://github.com/mosheng1/QuickClipboard) | 2061 | Apache-2.0 | Windows（加 Android） | **Tauri 2** + React | 2026-10-14 | 数字键 1-9 粘贴、Win+V、分组、贴图、OCR、WebDAV、应用过滤、低内存模式 |
| [UniClipboard](https://github.com/UniClipboard/UniClipboard) | 1982 | AGPL-3.0 | Win / macOS / Linux | TypeScript | 2026-11-09 | P2P 加中继的加密同步、本地全文索引也加密 |
| [ClipCascade](https://github.com/Sathvik-Rao/ClipCascade) | 1966 | GPL-3.0 | Win / macOS / Linux / Android | Python（客户端）+ Java 服务端 | 2026-11-08 | 自建服务器或 P2P 同步、端到端加密、按设备选收发方向 |
| [Qopy](https://github.com/0PandaDEV/Qopy) | 407 | AGPL-3.0 | Win / macOS / Linux | Tauri + Vue | 2026-03-15 | 小型 Tauri 剪贴板管理器 |

闭源参考（只看设计）：Paste（macOS，横向卡片条、Pinboards）、Raycast 的剪贴板历史（搜索框加右侧大预览、按类型过滤），没有逐项核实。

**Windows 11 自带剪贴板历史（Win+V）是基线**（[Microsoft 支持](https://support.microsoft.com/en-us/windows/clipboard-in-windows-c436501e-985d-1c8d-97ea-fe46ddf338c6)）：最多 25 条，单条 4 MB 以内，只支持文本、HTML、位图；可以固定，固定的在重启和清空后保留；**每次重启清空未固定的条目**；可以通过微软账户跨设备同步。我们已经比它多了持久化、搜索、备注和 200 条上限，比它少的是 HTML、自动粘贴和同步。

### 二、接管 Win+V

**为什么不能直接注册**：Win+V 被系统 shell 用 `RegisterHotKey` 占着。Windhawk 的一个模组正是在 explorer.exe、TextInputHost.exe、ShellExperienceHost.exe 里拦截 `RegisterHotKey(MOD_WIN, 'V')`，让它失败，然后要求重启 Explorer、结束 TextInputHost.exe，这样别的程序才能注册 Win+V（[gist](https://gist.github.com/nielpattin/82122f86e8161d85f39703b7482b77cc)）。由此可以知道占用者是 shell 的那几个进程。我们的 `parse_shortcut_binding` 支持 Win 修饰键，但用户录 Win+V 会注册失败。

**做法 A：低级键盘钩子（EcoPaste）**。源码 `src-tauri/src/shortcut/win_v.rs`：

- 设置开关打开时起一个线程，`SetWindowsHookExW(WH_KEYBOARD_LL)` 后跑消息循环；关闭时 `PostThreadMessageW(WM_QUIT)` 退出并 `UnhookWindowsHookEx`。不碰注册表，也不重启任何进程。
- 回调里只看 V：`GetAsyncKeyState(VK_LWIN/VK_RWIN)` 判断 Win 是否按住；是就返回 1 吞掉，并用原子变量区分首次按下和自动重复，只切换一次窗口；**V 的抬起也配对吞掉**，避免前台程序收到一个孤立的 KEYUP。
- 吞键后 `SendInput` 注入一次虚拟键 `0xE8`（未分配，AutoHotkey 的 menu mask key 也用它）的按下和抬起，让 shell 认为 Win 按住期间有过别的输入，松开 Win 时就不会弹开始菜单。带 `LLKHF_INJECTED` 标记的事件直接放行。
- 窗口切换不在钩子线程里做，用 `run_on_main_thread` 回到主线程。
- 更新日志：1.0.0（2026-07-03）「Added a Windows Win+V toggle, so EcoPaste can replace the system clipboard panel」（[CHANGELOG](https://github.com/EcoPasteHub/EcoPaste/blob/master/CHANGELOG.md)，对应 [PR #1273](https://github.com/EcoPasteHub/EcoPaste/pull/1273) 关闭了 [#1092](https://github.com/EcoPasteHub/EcoPaste/issues/1092)）。
- 已知问题：[#1466](https://github.com/EcoPasteHub/EcoPaste/issues/1466)（2026-10-30，v1.1.0，Win11）：一直按住 Win，松开 V 再按，第二次会弹出系统面板，还没修。
- 通用风险（Microsoft 文档）：低级钩子回调要在 `LowLevelHooksTimeout` 内返回，超时后系统会跳过它，Windows 7 起还会不通知地直接把钩子摘掉（[LowLevelKeyboardProc](https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc)）。所以钩子线程只能做判断和投递消息，不能在里面做任何耗时操作。前台是管理员权限的窗口时，非管理员进程的钩子是否还能收到按键：**未核实**（EcoPaste 有「以管理员身份运行」选项 `src-tauri/src/admin.rs`，可能与此有关）。

**做法 B：`DisabledHotkeys` + 重启 Explorer（QuickClipboard、TieZ）**。

- QuickClipboard `src-tauri/src/services/system/win_v_hotkey.rs`：打开 `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced`，往字符串值 `DisabledHotkeys` 末尾加 `V`（已有就不加），`taskkill /F /IM explorer.exe` 后等 1 秒再 `start explorer.exe`；恢复时把 `V` 删掉，删空了就删除这个值，再重启一次 Explorer。
- TieZ `src-tauri/src/app/commands/system_cmd.rs`（`trigger_registry_win_v_optimization`）做得更彻底：除了 `DisabledHotkeys`，还把 `HKCU\Software\Microsoft\Clipboard` 下的 `EnableClipboardHistory`、`EnableCloudClipboard` 设成 0；恢复时还会清除 `DisallowClipboardHistory`、`AllowClipboardHistory`、`AllowCrossDeviceClipboard` 这几个策略值。卸载时 `src-tauri/nsis/uninstall.nsh` 把上面全部改回去，再用 PowerShell 重启 Explorer。
- `DisabledHotkeys` 本身是一个老的、没有正式文档的 Explorer 值（字母即对应 Win+字母），网上的资料都是第三方的（[gHacks](https://www.ghacks.net/2015/03/22/how-to-disable-specific-global-hotkeys-in-windows/)）。**没找到微软文档确认它在 Windows 11 当前版本上对 Win+V 有效**，但两个活跃项目都在用。
- 副作用：杀 Explorer 会让任务栏、托盘图标、打开的资源管理器窗口全部重建（我们的托盘图标也会被重建，要处理 `TaskbarCreated`）；关闭功能、卸载、应用崩溃后能不能恢复全看清理逻辑写得好不好；这改的是用户全局设置。
- 另一个更粗暴的做法：`HKLM\SOFTWARE\Microsoft\Clipboard\IsCloudAndHistoryFeatureAvailable = 0` 后重启，整个系统剪贴板历史功能从设置里消失（[EcoPaste #1092 的评论](https://github.com/EcoPasteHub/EcoPaste/issues/1092)）。要管理员权限，只适合作为文档里给用户的手动方案。

**做法 C：不做（Ditto）**。维护者两次拒绝：[#143](https://github.com/sabrogden/Ditto/issues/143)（2021，建议 AutoHotkey；社区给出的方案是把 Ditto 设成 Win+Shift+V，再用 AHK 把 Win+V 映射过去）、[#783](https://github.com/sabrogden/Ditto/issues/783)（2025-01-16：「不 hook Windows 提供之外的快捷键」）。PowerToys Keyboard Manager 也可以改键。CopyQ：**没找到**内置接管 Win+V 的资料。

**对我们的建议**：做成「快捷键」页里一个默认关闭的开关「使用 Win+V 打开剪贴板历史」，实现照 EcoPaste 的钩子方案，放在 `src-tauri/src/win32/` 里（钩子回调只判断并 `PostMessage` 到现有的剪贴板消息窗口）；剪贴板历史关闭时一起摘掉钩子。要处理 #1466 那种 Win 一直按住的情况（以 Win 抬起为周期重置状态，而不是 V 抬起）。不改注册表、不重启 Explorer。

### 三、独立弹窗和粘贴回原窗口

我们现在的形态是展开岛屿上的剪贴板页，点一条只复制。剪贴板管理器的核心体验是「按快捷键 → 选一条 → 内容直接出现在刚才的输入框」，我们还没有最后这一步。

**焦点策略两种**：

1. **弹窗不拿焦点（EcoPaste）**。`src-tauri/src/window/windows.rs`：显示剪贴板窗口前 `set_focusable(false)`，显示后开启 `keyboard::enable_navigation_keys`（又一个 `WH_KEYBOARD_LL` 钩子，只在窗口可见时装，吞掉并转发方向键、回车、Esc、Tab、空格预览，以及 Ctrl+数字等少数组合）和鼠标钩子（点窗口外面就隐藏）。用户要在搜索框打字或编辑备注时，临时 `set_focusable(true)` 并记下之前的前台窗口，编辑结束后 `SetForegroundWindow` 还回去。好处：原窗口的光标和选区完全不受影响，粘贴就是一次 `SendInput`。代价：可见期间多一个全局键盘钩子，搜索要先切到「编辑态」。
2. **记住原窗口再还回去（Ditto、QuickClipboard）**。Ditto `src/ExternalWindowTracker.cpp`：弹出前 `GetForegroundWindow`，可选再用 `GetGUIThreadInfo` 拿到焦点控件；粘贴时 `AttachThreadInput` 到前台线程、`SetForegroundWindow`，然后 `WaitForActiveWnd` 轮询直到它真的回到前台（有超时设置），延迟一小段时间再发按键。还支持**按目标程序配置粘贴按键串**（`GetPasteString(app)`），以及给管理员权限窗口粘贴的辅助进程（`PasteAsAdmin`）。QuickClipboard `src-tauri/src/services/system/focus.rs`：用 WinEvent 钩子持续记录最后一个外部前台窗口（排除自己的窗口），粘贴前 `SetForegroundWindow`。

对我们来说：岛屿是 `main` 窗口，展开时是否拿焦点要看现有的窗口逻辑。比较稳的路线是方案 2：快捷键触发时（在 `WM_HOTKEY` 处理里，焦点还没变）记下前台窗口；选中条目后写剪贴板、收起岛屿、还焦点、`SendInput` Ctrl+V。

**发什么键**：EcoPaste `src-tauri/src/keystroke/windows.rs` 发 Ctrl 按下、V 按下、V 抬起、Ctrl 抬起四个事件，注释写明不用 Shift+Insert，因为 Monaco（VS Code 聊天输入框等）把 Insert 当成改写模式切换。**终端例外**：Windows Terminal 默认把 Ctrl+V 绑定成自己的文本粘贴，图片要 Alt+V 才进到 Claude Code（见下一节）。

**弹出位置**：EcoPaste `WindowPosition` 有 `FollowCursor`（默认）/ `Center` / `Remember`；QuickClipboard「跟随光标唤出」「记忆位置 / 尺寸」。Ditto 的源码里在选项和弹窗代码中引用了文本光标（caret）位置，即可以弹在输入光标旁边（`src/OptionsGeneral.cpp`、`src/QPasteWnd.cpp` 有 `CaretPos`，未逐行核实具体选项名）。我们是「岛」，固定在顶部展开反而是自己的特点，不一定要跟随鼠标。

**键盘操作**（几家共有）：打开后直接打字就是搜索（Ditto 的「查找即输入」）；↑↓ 选择，回车粘贴，Esc 关闭；**数字键 1-9 直接粘贴第 N 条**（QuickClipboard、Maccy 的 ⌥+数字）；**带修饰键回车 = 纯文本粘贴**（Maccy ⌥⇧回车）；空格预览（EcoPaste，按住显示松开关闭）。

### 四、图片：剪贴板格式和终端 CLI

**格式**（[Microsoft Learn：Clipboard Formats](https://learn.microsoft.com/en-us/windows/win32/dataxchg/clipboard-formats)）：系统会在 `CF_BITMAP`、`CF_DIB`、`CF_DIBV5` 之间自动合成，所以放 `CF_DIB` 或 `CF_DIBV5` 一个就够；微软建议位图优先放 DIB 而不是 `CF_BITMAP`。`PNG` 是浏览器、截图工具常用的注册格式，能保留透明度。文件列表是 `CF_HDROP`。多种格式按「信息量从多到少」的顺序放。

- 我们用的 `arboard`（3.7.0，2026-10-15）在 Windows 上写图片时**同时放 `PNG` 注册格式和 `CF_DIBV5`**；读图片时**先读 `PNG`，没有再读 `CF_DIBV5`**（[`src/platform/windows.rs`](https://github.com/1Password/arboard/blob/master/src/platform/windows.rs)）。所以我们写回的图片对一般程序来说没问题。
- EcoPaste 读取时也是「PNG 直通优先」，没有 PNG 才解码 DIB 再编码（`src-tauri/src/clipboard/read.rs`）。
- QuickClipboard 的 `set_clipboard_image_file`（`src-tauri/src/services/paste/clipboard_content.rs`）一次放三种：`CF_DIB`、`PNG`、`CF_HDROP`（指向图片文件）。这样贴到聊天软件、画图、资源管理器、终端都能用。

**Claude Code CLI 在 Windows 上的情况**：

- 文档：图片粘贴是 `Ctrl+V`，在 Windows 和 WSL 上是 `Alt+V`，粘贴后在光标处插入 `[Image #N]`（[Interactive mode](https://code.claude.com/docs/en/interactive-mode)）。原因是 Windows Terminal 把 Ctrl+V 绑定成了自己的文本粘贴，按键到不了 Claude Code（[#68021](https://github.com/anthropics/claude-code/issues/68021)）。
- 实现：每次 Alt+V 依次起三个 `powershell.exe`：`[System.Windows.Forms.Clipboard]::ContainsImage()` 检查、`GetImage()` 存成临时 PNG、`Remove-Item` 删临时文件，合计 1～2.6 秒（[#100899](https://github.com/anthropics/claude-code/issues/100899)）。`ContainsImage` 认的是 Bitmap，系统会从 `CF_DIBV5` 合成，所以我们写回的图片在格式上满足要求。
- 未修的读取 bug：剪贴板里明明有 `PNG` + `Bitmap` 也报「No image found in clipboard」（[#68021](https://github.com/anthropics/claude-code/issues/68021)，已因不活跃关闭；[#90657](https://github.com/anthropics/claude-code/issues/90657)）、几分钟后失效（[#103062](https://github.com/anthropics/claude-code/issues/103062)）、整场会话都失败（[#69234](https://github.com/anthropics/claude-code/issues/69234)）、第一次失败第二次成功（#68021 评论、[#78395](https://github.com/anthropics/claude-code/issues/78395)）。
- **能绕开的路**：
  - #68021 的评论：读取只在**原始位图**上失败，剪贴板里是**文件引用**时一直正常；有人用 AutoHotkey 在 Windows Terminal 里拦下 Ctrl+V，把剪贴板图片转成临时 PNG 的文件拖放（file-drop）格式再粘贴（[yvoolab/claude-code-windows-screenshot-paste](https://github.com/yvoolab/claude-code-windows-screenshot-paste)，没打开核实）。
  - 粘贴的文本里有图片路径时，Claude Code 会把它当成图片附上：[#105249](https://github.com/anthropics/claude-code/issues/105249)、[#105680](https://github.com/anthropics/claude-code/issues/105680) 都是有人想关掉这个行为。也就是说，**贴路径文本这条路现在可行**，而且是用普通 Ctrl+V（Windows Terminal 的文本粘贴），不依赖 Alt+V 和 PowerShell。缺点是将来 Claude Code 如果加了「不把路径当图片」的开关，用户打开后就失效。
  - Windows Terminal 1.24 / 1.25 起，剪贴板里只有图片时按 Ctrl+V 会发一个空的括号粘贴（`ESC[200~ESC[201~`），让 CLI 知道「用户粘贴了，但不是文本」（[microsoft/terminal#20037](https://github.com/microsoft/terminal/pull/20037)）。[#101869](https://github.com/anthropics/claude-code/issues/101869) 说 Claude Code 还没用这个信号（openai/codex 已经用了）。这件事要等 Claude Code 改，我们管不了。
- **对我们的建议**：
  1. 图片条目的操作菜单加「**复制为文件**」：参照 QuickClipboard 一次放 `CF_DIB`、`PNG`、`CF_HDROP`，`CF_HDROP` 指向历史里已有的原图 PNG（`clipboard-images/<hash>.png`）。注意：资源管理器里粘贴会**复制出一个文件**，Word 之类可能插入文件而不是图片，所以作为单独的操作，不改默认写回。条目删除后路径会失效，可以在写入前把文件复制到临时目录里一个带时间戳的名字。
  2. 加「**复制路径**」：写入带引号的绝对路径文本，在任何终端里都能用 Ctrl+V 贴，Claude Code、Codex 等会把它当图片。
  3. 以后做自动粘贴时：目标进程是 `WindowsTerminal.exe`（或用户配置的终端列表）且条目是图片，就发 Alt+V，或者改用「复制路径」再发 Ctrl+V。Ditto 的「按程序配置粘贴按键」就是这个思路。
  4. 写回时自己保证一定有 `PNG`（`arboard` 已做到），不只放 `CF_BITMAP`。

### 五、功能清单对比

| 功能 | Win+V | Ditto | CopyQ | EcoPaste | PasteBar | QuickClipboard / TieZ | 我们 |
|---|---|---|---|---|---|---|---|
| 文本 / 图片 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| HTML / RTF 富文本 | HTML | ✓ | ✓ | ✓ | 未核实 | ✓ | ✗ |
| 文件 / 文件夹 | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| 固定 / 收藏 | 固定 | ✓ | ✓ | 固定 + 收藏 | ✓ | ✓ | 收藏 |
| 分组 / 标签 / 标签页 | ✗ | 分组 | 标签页 + 标签 | 自定义分组 | 收藏夹 / 标签页 / 看板 | 分组 / 多色标签 | ✗ |
| 备注 | ✗ | ✓ | ✓ | ✓ | ✓ | 未核实 | ✓ |
| 全文搜索 | ✗ | ✓ | ✓ | SQLite FTS5 | ✓ | ✓ | ✓（内存过滤） |
| 自动粘贴回原窗口 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| 数字键快速粘贴 | ✗ | ✓ | 未核实 | Ctrl+数字 | 未核实 | 1-9 | ✗ |
| 纯文本粘贴 | ✗ | ✓ | ✓ | 复制 / 粘贴为纯文本 | ✓ | ✓ | 不适用（只存纯文本） |
| 文件粘贴为路径 | ✗ | 未核实 | 未核实 | `paste_files_as_path` | 未核实 | 未核实 | ✗ |
| 片段 / 模板 | ✗ | ✗ | 命令 | ✗ | 表单 + 全局模板 | ✗ | ✗ |
| 文本变换 / 脚本 | ✗ | 少量 | 脚本 API | ✗ | 未核实 | 未核实 | ✗（插件可读文本历史） |
| 顺序粘贴 / 粘贴栈 | ✗ | 未核实 | 可脚本实现 | ✗ | 未核实 | TieZ 顺序粘贴、QC 合并粘贴 | ✗ |
| 忽略密码管理器（格式） | 系统自己 | ✓ | ✓ | 未用格式，改用规则 + 应用排除 | 未核实 | TieZ ✓ | ✗ |
| 按应用排除 | ✗ | 未核实 | 按窗口 | ✓ | 未核实 | ✓ | ✗ |
| 密钥 / token 内容检测 | ✗ | ✗ | ✗ | ✓（私钥、JWT、AWS key 等） | ✗ | TieZ 预览打码 | ✗ |
| 来源应用和图标 | ✗ | 未核实 | 窗口标题 | ✓ | 未核实 | ✓ | ✗ |
| 条数上限 | 25 | ✓ | ✓ | ✓ | 无限 | ✓ | 5～200 |
| 按时间保留 | 重启清空 | 按天过期 | 未核实 | `Retention`（默认永久） | 未核实 | 清理规则 | ✗ |
| 单条大小上限 | 4 MB | 未核实 | 未核实 | 文本 4 MB / 图片 100 MB | 长度过滤 | 未核实 | 图片 PNG 10 MB |
| 加密 / 锁 | ✗ | 同步加密 | 加密标签页（GPG） | 加密备份 | PIN 保护收藏、锁屏 | 未核实 | ✗ |
| 导入 / 导出 | ✗ | ✓ | ✓ | `.ecopastebak`（可加密） | 备份恢复 | ZIP | ✗ |
| 跨设备同步 | 微软账户 | 局域网 | ✗（未核实） | ✗ | ✗ | WebDAV / 局域网 / MQTT | ✗ |
| OCR | ✗ | ✗ | ✗ | ✗ | ✗ | QuickClipboard ✓ | ✗ |
| 拖出到其他应用 | ✗ | 未核实 | ✓ | ✓ | 未核实 | 未核实 | ✗ |

来源：各项目 README（[EcoPaste](https://github.com/EcoPasteHub/EcoPaste)、[PasteBar](https://github.com/PasteBar/PasteBarApp)、[QuickClipboard](https://github.com/mosheng1/QuickClipboard)、[TieZ](https://github.com/jimuzhe/tiez-clipboard)、[CrossPaste](https://github.com/CrossPaste/crosspaste-desktop)、[Maccy](https://github.com/p0deje/Maccy)）、[CopyQ 主页](https://hluk.github.io/CopyQ/)、EcoPaste `src-tauri/src/settings/model.rs`。Ditto 的部分功能来自第三方介绍（[How-To Geek](https://www.howtogeek.com/the-free-open-source-clipboard-manager-i-use-instead-of-the-built-in-one/)），没打开 Ditto 的选项页核实，表里标的「未核实」没有算作事实。

**几项值得细说的**：

- **忽略密码管理器**。Microsoft 定义了三个注册格式（[Clipboard Formats › Cloud Clipboard and Clipboard History Formats](https://learn.microsoft.com/en-us/windows/win32/dataxchg/clipboard-formats#cloud-clipboard-and-clipboard-history-formats)）：`ExcludeClipboardContentFromMonitorProcessing`（有就不进历史也不同步）、`CanIncludeInClipboardHistory`（DWORD 0 = 不进历史）、`CanUploadToCloudClipboard`（DWORD 0 = 不同步）。CopyQ 在 Windows 上检查这三个外加老的 `Clipboard Viewer Ignore`，命中就不存（[docs/security.rst](https://github.com/hluk/CopyQ/blob/master/docs/security.rst)）；Ditto（`src/CP_Main.cpp` 等）、TieZ、CrossPaste、SyncClipboard 都在源码里查这个格式。KeePass、1Password、Bitwarden 等密码管理器复制密码时会带这些格式（具体是哪一个未逐一核实）。我们**现在没有检查**，密码会被写进历史 JSON。实现很小：在 `read_clipboard_capture` 前 `RegisterClipboardFormatW` 拿到这几个 id，`IsClipboardFormatAvailable` 判断，命中就跳过。`arboard` 写入时也有 `exclude_from_history` 等选项，可以用在我们自己的划词翻译临时复制上，让它不进 Windows 自带的历史。
- **密钥内容检测**：EcoPaste `src-tauri/src/clipboard/secrets.rs` 只拦「高置信」的：PEM / OpenSSH 私钥块、带固定前缀的服务 token、AWS access key id、结构完整的 JWT、带明确字段名的 secret 赋值；刻意不拦普通长文本。可以直接参考这个范围（只写规则，不搬代码）。
- **来源应用**：EcoPaste `src-tauri/src/clipboard/source.rs` 在剪贴板变化回调里**立即同步**取 `GetForegroundWindow` → `QueryFullProcessImageNameW`（只需 `PROCESS_QUERY_LIMITED_INFORMATION`，不要管理员），拿 exe 路径作 id、提取图标；注释强调晚了前台就可能已经换了。这同时是「按应用排除」的基础。（`GetClipboardOwner` 是另一条路，但很多程序用隐藏窗口持有剪贴板，未核实哪种更准。）
- **回环抑制**：EcoPaste 写回前登记内容哈希，监听到同哈希就不新增（`src-tauri/src/clipboard/write.rs`）。我们用 `last_capture_hash` 做了同样的事。
- **存储**：EcoPaste、Ditto、QuickClipboard、PasteBar 都用 SQLite。我们是一个 JSON 文件，最多 200 条时没问题；如果要做无限历史、全文搜索、分组，就得换 SQLite，那是一次对外契约变更（应用数据目录的文件名在 contracts.md 里）。
- **同步**：做法分三类：自建服务器 / WebDAV / S3（SyncClipboard、TieZ、QuickClipboard）、局域网 P2P 加端到端加密（CrossPaste、UniClipboard、ClipCascade 的 P2P 模式）、系统账户（Win+V）。工作量都很大，而且和「悬浮岛」的定位关系不大。

## 优先级建议

**已经有的**（不用再做）：文本和图片历史、PNG 原图加缩略图、收藏（不被上限清掉）、备注、搜索、全部 / 收藏切换、5～200 条上限、可录制的全局快捷键、删除和清空、复制回剪贴板、写回时的回环抑制、划词翻译时暂停记录、插件只读文本历史。

**建议做的**（价值：高 / 中 / 低；工作量：小 ≈ 一两天以内，中 ≈ 几天，大 ≈ 一周以上）：

| 优先级 | 功能 | 价值 | 工作量 | 说明 |
|---|---|---|---|---|
| P0 | 忽略密码管理器内容（`ExcludeClipboardContentFromMonitorProcessing` / `CanIncludeInClipboardHistory=0` / `Clipboard Viewer Ignore`） | 高（隐私） | 小 | 只改 `service.rs` 的读取；可以默认开启、不加设置项 |
| P0 | 图片「复制为文件」（`CF_DIB` + `PNG` + `CF_HDROP`）和「复制路径」 | 高（直接解决 Claude Code 等终端 CLI 贴图） | 小～中 | 新增 Tauri 命令和条目菜单项；写 `CF_HDROP` 要在 `win32/` 里加一点代码 |
| P1 | 选中后自动粘贴回原窗口（记下前台窗口 → 还焦点 → `SendInput` Ctrl+V），加设置项「只复制 / 自动粘贴」 | 高（剪贴板工具的核心体验） | 中 | 要和岛屿展开、收起的焦点逻辑配合；终端里的图片改发 Alt+V 或贴路径 |
| P1 | 剪贴板页键盘操作：打开后直接打字搜索、↑↓、回车、Esc、数字键 1-9 | 高 | 小～中 | 依赖上一项才有完整意义 |
| P1 | 密钥 / token 内容检测（范围参考 EcoPaste：私钥、带前缀 token、JWT 等） | 中 | 小 | 默认开启；误判要少 |
| P2 | 来源应用（exe 和图标）+ 按应用排除列表 | 中 | 中 | 历史数据要加字段，兼容读取旧数据 |
| P2 | 按时间清理（如 7 天 / 30 天 / 永久，收藏除外） | 中 | 小 | |
| P2 | 接管 Win+V（低级键盘钩子，默认关闭） | 中（很多用户会问） | 中 | 不改注册表、不重启 Explorer；处理 EcoPaste #1466 的情况 |
| P2 | 文件 / 文件夹条目（`CF_HDROP`），附「粘贴为路径」 | 中 | 中 | |
| P3 | HTML / RTF 富文本，加「纯文本粘贴」 | 中 | 中 | `arboard` 能写 HTML；读 RTF 要自己处理 |
| P3 | 导入 / 导出（可选加密） | 低～中 | 中 | |
| P3 | 分组 / 标签 | 低～中 | 中～大 | 条数上限只有 200 时意义不大；做无限历史时再考虑 |
| P3 | 片段 / 模板、顺序粘贴 | 低 | 中 | 可以留给插件 |
| 不建议 | 跨设备同步、OCR、贴图到屏幕、Emoji 库、`DisabledHotkeys` 加重启 Explorer | — | 大 | 和岛屿定位关系小，或副作用大 |

## 来源

项目和源码（2026-11-09 查询）：

- EcoPaste：<https://github.com/EcoPasteHub/EcoPaste>；源码 `src-tauri/src/shortcut/win_v.rs`、`keystroke/windows.rs`、`window/windows.rs`、`keyboard/windows.rs`、`clipboard/{read,write,secrets,source}.rs`、`settings/model.rs`、`admin.rs`；[CHANGELOG](https://github.com/EcoPasteHub/EcoPaste/blob/master/CHANGELOG.md)；[#1092](https://github.com/EcoPasteHub/EcoPaste/issues/1092)、[#1466](https://github.com/EcoPasteHub/EcoPaste/issues/1466)、[PR #1273](https://github.com/EcoPasteHub/EcoPaste/pull/1273)
- QuickClipboard：<https://github.com/mosheng1/QuickClipboard>；`src-tauri/src/services/system/win_v_hotkey.rs`、`services/system/focus.rs`、`services/paste/clipboard_content.rs`
- TieZ：<https://github.com/jimuzhe/tiez-clipboard>；`src-tauri/src/app/commands/system_cmd.rs`、`src-tauri/nsis/uninstall.nsh`
- Ditto：<https://github.com/sabrogden/Ditto>；`src/ExternalWindowTracker.cpp`；[#143](https://github.com/sabrogden/Ditto/issues/143)、[#783](https://github.com/sabrogden/Ditto/issues/783)
- CopyQ：<https://github.com/hluk/CopyQ>、<https://hluk.github.io/CopyQ/>、[docs/security.rst](https://github.com/hluk/CopyQ/blob/master/docs/security.rst)
- PasteBar：<https://github.com/PasteBar/PasteBarApp>
- Maccy：<https://github.com/p0deje/Maccy>；Clipy：<https://github.com/Clipy/Clipy>；Flycut：<https://github.com/TermiT/Flycut>
- 同步类：[ClipCascade](https://github.com/Sathvik-Rao/ClipCascade)、[CrossPaste](https://github.com/CrossPaste/crosspaste-desktop)、[SyncClipboard](https://github.com/Jeric-X/SyncClipboard)、[UniClipboard](https://github.com/UniClipboard/UniClipboard)
- 其他：[Qopy](https://github.com/0PandaDEV/Qopy)、[Slackadays/Clipboard](https://github.com/Slackadays/Clipboard)
- arboard：[src/platform/windows.rs](https://github.com/1Password/arboard/blob/master/src/platform/windows.rs)
- Windhawk Win+V 模组：<https://gist.github.com/nielpattin/82122f86e8161d85f39703b7482b77cc>

Microsoft：

- [Clipboard Formats](https://learn.microsoft.com/en-us/windows/win32/dataxchg/clipboard-formats)（合成格式、Cloud Clipboard and Clipboard History Formats）
- [LowLevelKeyboardProc](https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc)（钩子超时）
- [Clipboard in Windows](https://support.microsoft.com/en-us/windows/clipboard-in-windows-c436501e-985d-1c8d-97ea-fe46ddf338c6)
- `DisabledHotkeys`：[gHacks](https://www.ghacks.net/2015/03/22/how-to-disable-specific-global-hotkeys-in-windows/)（第三方）

Claude Code 和终端：

- [Interactive mode](https://code.claude.com/docs/en/interactive-mode)
- anthropics/claude-code issue：[#68021](https://github.com/anthropics/claude-code/issues/68021)、[#69234](https://github.com/anthropics/claude-code/issues/69234)、[#78395](https://github.com/anthropics/claude-code/issues/78395)、[#90657](https://github.com/anthropics/claude-code/issues/90657)、[#100899](https://github.com/anthropics/claude-code/issues/100899)、[#101869](https://github.com/anthropics/claude-code/issues/101869)、[#103062](https://github.com/anthropics/claude-code/issues/103062)、[#105249](https://github.com/anthropics/claude-code/issues/105249)、[#105680](https://github.com/anthropics/claude-code/issues/105680)
- [microsoft/terminal#20037](https://github.com/microsoft/terminal/pull/20037)
- [yvoolab/claude-code-windows-screenshot-paste](https://github.com/yvoolab/claude-code-windows-screenshot-paste)（#68021 评论里提到，未打开核实）

本次下载的源码片段放在本机 `%TEMP%\cliprefs\`（eco、tiez、qc），不进仓库。

## 第二轮：功能全景（2026-11-10）

> 日期：2026-11-10。问题：为剪贴板弹窗的下一版找功能，比本文前半部分（2026-11-09，侧重 Win+V、粘贴回原窗口、终端贴图）看得更宽、更新：商业和系统自带工具，以及 2025–2026 年仍活跃或新出的 GitHub 项目。范围：官网和文档（PowerToys Advanced Paste、Raycast Manual、Paste 官网和 App Store、Alfred、Pastebot、ClipboardFusion、ClipBook、PasteNow、ClipClip、Clipboard Master、Maccy、Microsoft 支持），GitHub（`gh search repos "clipboard manager" --sort stars`，只保留 2025-10 以后推送过的；`gh search repos clipboard --created ">2025-01-01" --sort stars`；读了约 20 个仓库的 README）。相关任务：暂无（C22 / C24 / C29 是已经做完的）。
>
> star 数、最后推送、价格都是 2026-11-10 查的；没打开原页核实的写「未核实」。

### 结论

#### 先说基线：弹窗现在有什么、缺什么

调研时读的是 C37 之前的弹窗：只有搜索框、列表和底栏，Tab 切到片段。C37（2026-11-10）已补上**筛选胶囊**（全部 / 收藏 / 图片 / 文件 / 片段 / 常用 `#标签`）和**宽版预览栏**（全文、大图和识别出的文字、文件列表）。仍然没有的：**弹窗里每一条的操作菜单**（复制为文件等只在岛上页面）、**文本变换**、**粘贴前编辑**、链接 / 颜色识别。

本轮看下来，2025–2026 年新出的工具（Deck、Beetroot、PasteMemo、ElegantClipboard、ClipBook、vPaste、Clippi）在基础功能上彼此趋同，我们已经大部分都有了。差距集中在四件事上：**空格大预览**、**Ctrl+K 动作面板和文本变换**、**按类型 / 来源 / 日期筛选**、**内容识别**（链接、颜色、代码）。

#### 必做

| 功能 | 理由 | 放哪里 |
|---|---|---|
| **空格预览**（宽版已有，C37；标准宽度还没有）：右侧（或下方）预览栏，图片显示大图和尺寸，长文本显示全文，HTML 按格式渲染，文件显示路径列表 | 这一轮看过的 Windows / macOS 工具几乎都有空格预览（Raycast、Paste、Clipbara、vPaste、Beetroot、PasteNow、EcoPaste）。我们 380 宽的弹窗只有一行摘要，图片条目基本靠猜 | 预览栏；按空格开关，或选中后停顿自动显示 |
| **动作面板 Ctrl+K（也做成右键菜单）**：粘贴、纯文本粘贴、复制、收藏、编辑、写备注、复制为文件、复制路径、复制 OCR 文字、删除 | Raycast、PasteMemo、Beetroot（Shift+F10）都用一个统一的动作面板。我们这些操作已经写好了，只在岛上页面能用，接到弹窗里工作量小 | 右键菜单 + Ctrl+K，底栏提示「Ctrl+K 更多」 |
| **类型筛选**：全部 / 文本 / 图片 / 文件 / 链接 / 颜色 / 收藏，←→ 或 Ctrl+P 切换 | Raycast（⌘P）、PasteMemo（←→）、vPaste、Clipbara、Beetroot 都有。岛上页面已有其中一部分，弹窗应当一致 | 顶部筛选（搜索框下一行胶囊；窄窗口只显示图标） |
| **拼音 / 首字母搜索 + 容错模糊** | Clippi 和 Win顺 把它作为卖点；Beetroot 分阶段排序：子串 → 词首 → 元数据 → 模糊。中文用户搜「会议」时输 `hy` 很常见 | 搜索框（无 UI 变化） |
| **常用文本变换**：去首尾空白、去换行合成一行、大小写、JSON 格式化 / 压缩、URL 编解码、去链接追踪参数、全角 / 半角、繁 / 简 | Deck、PasteMemo、ElegantClipboard、ClipBook（78 种）、Clipboard Master 都有；全部本地运算，没有隐私风险 | 动作面板的「转换后粘贴」子菜单 |
| **暂停记录 / 忽略下一次复制** | Maccy、Deck、vPaste、Pesty、ElegantClipboard 都有，实现几乎不花功夫，偶尔复制敏感内容时最需要它 | 底栏开关 + 托盘；动作面板里也放一个 |

#### 值得做

| 功能 | 理由 | 放哪里 |
|---|---|---|
| **内容识别和标记**：链接显示域名（可选抓标题和 favicon）、颜色显示色块（HEX / RGB / HSL 互转）、代码按语言高亮、邮箱 / 电话 | Raycast、PasteMemo、vPaste、Deck、Beetroot 都会识别；让列表一眼看出是什么 | 行（行首图标换成色块或网站图标）；预览栏（代码高亮、颜色转换） |
| **粘贴并回车** | PasteMemo 的 Shift+Enter（我们的 Shift+Enter 已经是纯文本粘贴，所以用 Ctrl+Enter）；终端和聊天软件常用 | 按键 + 动作面板 |
| **多选后合并复制 / 粘贴**（换行、逗号、自定义分隔符） | ClipBook、Beetroot 的批量复制、Alfred 的追加合并。我们已经有 Ctrl+点击多选（用于顺序粘贴），加一个「合并粘贴」就行 | 多选状态下的底栏 |
| **粘贴前编辑**（编辑后另存为新条目，或只这一次用） | Raycast、Paste、Clipbara（⌘E）、PasteNow、ClipClip 都能编辑 | 预览栏变为可编辑；动作面板「编辑」 |
| **终端命令压平**：复制的多行 shell 命令（`\` 续行、提示符 `$`）粘贴到终端时合成一行 | Trimmy（749★，2025-11 新建）专做这件事；我们已经能识别终端（贴图片路径时用），用户群正好是 Claude Code / 终端用户 | 设置（默认关）+ 动作面板「粘贴为单行命令」 |
| **HTML → Markdown 粘贴** | PowerToys Advanced Paste 内置（本地运算，不需要 AI）；PasteMD（5431★）的反方向需求也说明网页内容和 AI 对话之间转来转去很常见。我们已经存了 HTML | 动作面板「粘贴为 Markdown」 |
| **筛选语法**：搜索框里写 `/app:chrome`、`/today`、`/img` | Deck 的斜杠规则；PasteMemo、vPaste、Paste 都能按来源和日期筛。我们已经有 `#标签` 语法，扩展起来顺手 | 搜索框 |
| **屏幕共享时隐藏弹窗** | Deck、ClipBook 都有。Windows 上用 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` 就行（Tauri 的 `set_content_protection`），开会共享屏幕时不会把历史露出去 | 设置（默认开） |
| **QR 码识别**：图片里有二维码时提供「复制二维码内容」 | Raycast、Clippi 都有；我们已经有 OCR 流程 | 动作面板 |
| **撤销删除**（Ctrl+Z） | Clipbara 有；误删一条收藏代价大 | 删除后底栏提示「已删除 · 撤销」 |
| **银行卡、身份证号检测**（Luhn 校验） | Deck、ClipBook 有；我们目前只识别密钥和令牌，正好补上 | 设置（并入现有的「打码」策略） |

#### 可选

| 功能 | 理由 | 放哪里 |
|---|---|---|
| **AI 变换**（总结、翻译、改写、修语法、自定义提示词；用户自带 key 或本地 Ollama） | PowerToys、Beetroot、Raycast、openclip 都在做；我们已有快捷翻译的服务配置，可以复用。但要配置 key，按需付费，还要说清隐私 | 动作面板「AI」子菜单；提示词在设置里 |
| **MCP / AI 工具读取剪贴板历史** | Paste（内置本地 MCP）、PasteMemo（5 个 MCP 工具）、Win顺 都已做到；我们的插件系统已有 `clipboard:read` 权限，可以做成一个插件，不放进核心 | 设置 / 插件 |
| **文字粘贴为 .txt 文件** | PowerToys、PasteMemo 都有；和我们的「图片复制为文件」对称 | 动作面板 |
| **按时间段删除**（最近 1 小时 / 今天） | Raycast、PasteMemo 都有；我们已有自动清理 | 顶部「⋯」 |
| **顺序粘贴：把一段文字按分隔符拆成队列** | PasteMemo 的 Relay 拆分；填表时有用 | 动作面板 |
| **模拟键入粘贴**（逐字敲出，给禁止粘贴的远程桌面或网页用） | Deck 有；场景窄 | 动作面板 |
| **IDE 来源锚点**（记下文件路径和行号，点击跳回去） | Deck 独有；有意思，但要逐个编辑器适配 | 行的第二行 |
| **自动规则**（复制时自动去追踪参数，等） | PasteMemo、Deck、Pastebot、ClipboardFusion 的 Triggers；功能强，但设置界面复杂 | 设置 |

#### 不做

| 功能 | 理由 |
|---|---|
| 跨设备云同步（Paste iCloud、ClipboardFusion、Win+V 账户同步、ClipCascade） | 上一轮已经判过：工作量大、隐私负担重，和岛屿定位关系不大 |
| 看板 / Pinboard 多层文件夹、团队共享 | 条数上限 200，`#标签` 已经够用 |
| 语义搜索、使用统计、主题市场、Vim 模式 | 收益低；主题跟随岛屿 |
| 音视频转码、隐写术（Deck）、截图 / 录屏 | 不属于剪贴板弹窗 |
| 打开弹窗前要求 Windows Hello 解锁 | Deck 有 Touch ID；我们已经有打码和排除，一个快捷弹窗每次都要验证太重 |

### 功能清单

图例：✓ 有；部分；✗ 没有；? 未核实。「我们」一列指剪贴板功能整体，「弹窗缺」表示岛上页面有、弹窗里没有。

| 类别 | 功能 | Win+V | PowerToys AP | Raycast | Paste | Pastebot | ClipBook | Deck | Beetroot | PasteMemo | ElegantClipboard | 我们 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 捕获 | 文本 / 图片 | ✓ | 当前一条 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 捕获 | HTML / 富文本 | HTML | ✓ | ✓ | ✓ | ? | ? | ✓ | ? | ✓ | HTML+RTF+自定义格式 | HTML |
| 捕获 | 文件 | ✗ | 单个文件 | ✓ | ✓ | ? | ? | ✓ | ? | ✓ | 路径 | ✓ |
| 捕获 | 链接 / 颜色识别 | ✗ | ✗ | ✓ | ✓（Pinboard 存颜色） | ? | ✓ | ✓ | ✓（标记） | ✓ | ✗ | ✗ |
| 捕获 | 来源应用 | ✗ | ✗ | ? | ✓ | ? | ? | ✓ | ✓（含窗口标题） | ✓ | ✓ | ✓ |
| 捕获 | 按应用排除 | ✗ | ✗ | ✓ | ✓（规则） | ✓（分类型） | ✓ | ✓ | ? | ✓ | ✓ | ✓ |
| 捕获 | 去重 | ? | — | ? | ? | ? | ? | ? | ? | ? | ✓（合并 HTML 和纯文本） | ✓ |
| 捕获 | 暂停 / 忽略下一次 | ✗ | — | ? | ? | ? | ✓ | ✓ | ? | ? | ✓ | ✗ |
| 组织 | 收藏 / 置顶 | 固定 | — | ✓ | Pinboard | Pastebin | 标签 | ✓ | ✓ | ✓ | 收藏 + 置顶 | 收藏 |
| 组织 | 标签 / 分组 | ✗ | — | ✗ | Pinboard | 智能 Pastebin | ✓ | ✓ | ✗ | ✓ | 分组 | `#标签` |
| 组织 | 重命名 / 备注 | ✗ | — | 重命名 | ? | 备注 | 重命名 | 标题 | 备注 | ? | 备注 | 备注 |
| 组织 | 片段 / 模板 | ✗ | 自定义动作 | 存为 snippet | ✗ | ✗ | ? | 模板库 | ✗ | ✗ | ✗ | ✓ |
| 查找 | 搜索 | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓（含语义） | ✓（模糊） | ✓ | ✓ | ✓ |
| 查找 | 正则 | ✗ | — | ✗ | ? | ? | ? | ✓ | ✓ | 规则里有 | ? | ✗ |
| 查找 | 按类型筛选 | ✗ | — | ✓ | ✓ | ? | ✓ | ✓ | ✓ | ✓ | ? | 弹窗缺 |
| 查找 | 按来源 / 日期筛选 | ✗ | — | ✗ | ✓ | ? | ? | ✓ | 来源 | ✓ | ? | ✗ |
| 查找 | 拼音搜索 | ✗ | — | ? | ? | — | — | ? | ✗ | ? | ? | ✗ |
| 查找 | 图片内文字可搜 | ✗ | — | ✓ | ? | ? | ✓ | ✓ | ✗ | ? | ✗ | ✓ |
| 预览 | 大图 / 全文预览 | 缩略图 | 当前一条 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓（空格） | ✓ | 悬停浮层 | 弹窗缺 |
| 预览 | 代码高亮 | ✗ | ✗ | ? | ? | ? | ? | ✓（识别语言） | ✓ | ✓ | ✗ | ✗ |
| 预览 | 链接标题 / 图片 | ✗ | ✗ | ✓ | ? | ? | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| 预览 | 颜色色块 | ✗ | ✗ | ✓ | ? | ? | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| 粘贴 | 自动粘贴回原窗口 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 粘贴 | 数字键快速粘贴 | ✗ | ✗ | ? | ⌘1–9 | ? | ? | ? | Ctrl+1–9 | ⌘1–9 | ✓（可设） | 1–9 |
| 粘贴 | 纯文本粘贴 | ✗ | ✓ | ✓ | ✓ | ? | ? | ? | ✓ | ? | ✓ | ✓ |
| 粘贴 | 格式转换（Markdown / JSON / 文件） | ✗ | ✓ | PNG | ✗ | ✗ | ? | ✗ | ✗ | 文字转 .txt 文件 | 按单一格式 | 图片转文件 |
| 粘贴 | 粘贴栈 / 队列 | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| 粘贴 | 合并多条 | ✗ | ✗ | ✗ | ? | ? | ✓（分隔符） | ? | ✓（分隔符） | ✓ | ✗ | ✗ |
| 粘贴 | 文本变换 | ✗ | 少量 | ✗ | ✗ | 自定义过滤器 | 78 种 | ✓ | AI | ✓ | 少量 | ✗ |
| 粘贴 | AI 粘贴 | ✗ | ✓ | 发到 AI Chat | ✗ | ✗ | ✗ | ✗ | ✓ | 规则里有 | ✗ | ✗ |
| 粘贴 | 粘贴并回车 | ✗ | ✗ | ✗ | ? | ? | ? | ? | ✗ | ✓ | ✗ | ✗ |
| 编辑 | 粘贴前编辑 | ✗ | ✗ | ✓ | ✓ | ? | ? | ? | ? | ? | ✓ | ✗ |
| 同步备份 | 跨设备同步 | 微软账户 | ✗ | ✗ | iCloud | iCloud | ✗ | 局域网 | ✗ | ? | ✗ | ✗ |
| 同步备份 | 导入 / 导出 | ✗ | ✗ | ? | ? | ? | ? | ✓ | 自动备份数据库 | ? | ✓ | ✓ |
| 隐私 | 密码管理器标记 | ✓ | — | ✓ | ✓ | ? | ✓ | ✓ | ? | ✓ | ? | ✓ |
| 隐私 | 敏感内容检测 / 打码 | ✗ | — | ✗ | ✓（规则） | ✗ | ✓（密码 / key / 卡号） | ✓（Luhn） | ✗ | ✓（含限时删除） | ✗ | ✓（密钥 / 令牌） |
| 隐私 | 自动清理 | 重启清空 | — | 1 天–无限 | ? | ? | ? | ? | ✗ | 1–365 天 | 按分组 | ✓ |
| 隐私 | 共享屏幕时隐藏 | ✗ | ✗ | ? | ? | ? | ✓ | ✓ | ✗ | ? | ✗ | ✗ |
| 隐私 | 加密 / 解锁 | ✗ | ✗ | ? | ? | ? | ✗ | Touch ID | API key 存凭据管理器 | ✗ | ✗ | ✗ |
| 界面 | 窗口形态 | 弹出面板 | 弹出面板 | 启动器 | 底部卡片条 | 菜单 | 列表 + 预览 | 面板 | 列表窗口 | 面板 | 卡片窗口 + 悬停预览 | 鼠标旁弹窗 / 岛上页面 |
| 界面 | 动作面板 | ⋯ | ✗ | ⌘K | ? | ? | ? | ? | 右键 | ⌘K | ✗ | 弹窗缺 |
| 界面 | 全键盘 | 部分 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓（Vim） | ✓（可改键） | ✓ | ✓ | ✓ |
| 集成 | OCR | ✗ | ✓ | ✓ | ? | ✗ | ✓ | ✓ | ✓ | ? | ✗ | ✓ |
| 集成 | 二维码 | ✗ | ✗ | ✓ | ✗ | ✗ | ? | 生成 | ✗ | ✗ | ✗ | ✗ |
| 集成 | 翻译 | ✗ | AI | AI Chat | ✗ | ✗ | ✗ | ✗ | AI | AI | ✗ | 岛屿有快捷翻译，弹窗没接 |
| 集成 | 分享 / 拖出 | ✗ | ✗ | 分享 | 共享 Pinboard | ? | ? | 局域网 | ✗ | ✓ | 拖放 | ✗ |
| 集成 | MCP / CLI | ✗ | CLI | ✗ | MCP | CLI | ✗ | CLI | ✗ | MCP | ✗ | 插件读取 |

表中的「?」大多是官网和 README 没提到，不代表没有。

### 各产品要点

#### 商业和系统自带

- **Windows Win+V**（[Microsoft 支持](https://support.microsoft.com/en-us/windows/clipboard-in-windows-c436501e-985d-1c8d-97ea-fe46ddf338c6)）：25 条、单条 4 MB、文本 / HTML / 位图；固定的条目重启后保留；可通过微软账户同步，也可以只手动同步某一条。2025–2026 年没找到新功能（官方页面没写表情或 AI 动作，搜索结果也没有）。
- **PowerToys Advanced Paste**（[Learn，2026-10 更新](https://learn.microsoft.com/en-us/windows/powertoys/advanced-paste)；PowerToys 140809★，2026-11-10 推送）：Win+Shift+V 打开，只处理「当前这一条」，弹窗里也能翻历史。本地动作：纯文本、**HTML→Markdown**、**CSV / XML / INI→JSON**、粘贴为 .txt / .html / .png 文件、图片转文字（Windows OCR）、音视频转 mp3 / mp4。每个动作都可以设直接快捷键（纯文本默认 Ctrl+Win+Alt+V）。AI（默认关）：自由提示词、修语法（带「讲解模式」）、保存的自定义动作；提供方可选 OpenAI、Azure、Mistral、Google、Foundry Local、Ollama、Phi Silica。「转换结果先预览再粘贴」默认开，长任务有进度和取消。还有一个 CLI（`PowerToys.AdvancedPaste.CLI.exe transform`）。**最值得借鉴的**：本地格式转换动作、结果预览、给每个动作单独设快捷键。
- **Raycast 剪贴板历史**（[Manual](https://manual.raycast.com/clipboard-history.md)；Mac 和 Windows）：类型有文本、图片、文件、链接、邮箱、颜色，⌘P / Ctrl+P 按类型筛；链接显示社交卡片和 favicon，颜色显示色块；⌘K 动作面板（纯文本粘贴、编辑、存为 snippet、重命名、置顶、分享、OCR、读二维码、发送到 AI Chat、按时间段删除）。可以「顺序粘贴」，每条后面可选加换行。保留 1 天到 3 个月，Pro 6 个月到无限。另有自然语言的「Ask Clipboard」。**借鉴**：⌘K 动作面板 + 类型筛选的组合，Windows 上的快捷键是 Ctrl 版本，可以直接照搬。
- **Paste**（[官网](https://pasteapp.io/)、[价格](https://pasteapp.io/pricing)、[App Store](https://apps.apple.com/us/app/paste-limitless-clipboard/id967805235)、[MCP](https://pasteapp.io/mcp)）：只有 Mac / iOS。底部横向卡片条、Pinboard（可共享给团队并设查看 / 编辑权限）、Paste Stack、按应用 / 日期 / 设备 / 类型筛选、Smart Rules 跳过密码，⌘1–9。2026 年新加了 **Intelligent Clipboard**（用 Apple Intelligence 预测下一条要贴的）和**本地 MCP 服务器**（Claude、Codex、Cursor 可以搜索历史、存条目、管理 Pinboard，用户按工具授权）。价格：官网 $2.49/月 或 $29.99/年；App Store 月付 $3.99、年付 $29.99、**终身 $99.99**、家庭 $59.99；7 天试用。
- **Alfred 剪贴板**（[帮助](https://www.alfredapp.com/help/features/clipboard/)，Powerpack 功能）：文本、图片、文件三类可分别开关，保留 24 小时 / 7 天 / 1 个月 / 3 个月；**⌘ 按住再双击 C 就把当前复制追加到上一条**（合并）；⌘S 把条目存为 snippet（带自动展开）；默认忽略钥匙串和 1Password，「concealed」类型也默认忽略。价格未核实。
- **Pastebot**（[官网](https://tapbots.com/pastebot/)）：可组合的**自定义过滤器**（文本变换，可设快捷键，实时预览）、带颜色和图标的 Pastebin 和按规则的智能 Pastebin、Stack 顺序粘贴（⌃⌘V）、按应用分类型屏蔽（只屏蔽图片或只屏蔽文本）、iCloud 同步、CLI。价格：直购 $39（含一年更新，续期 $19），App Store $24.99/年或 $2.99/月；14 天试用；需要 macOS 26。
- **ClipBook**（[官网](https://clipbook.app/)）：标签、重命名、**78 种文本变换**、粘贴栈（⌃V 每次推进一条）、多选后带分隔符一起粘贴、OCR、链接预览、打码（密码、API key、卡号）、**屏幕共享时隐藏窗口**。$9.99 买断 1 台（官网说 2026-10 起涨到 $14.99，版本号各站不一致，未核实）。它的对比页提到 macOS 26 Tahoe 的 Spotlight 自带剪贴板历史只保留 30 分钟 / 8 小时 / 7 天，没有收藏（[链接](https://clipbook.app/compare/macos-tahoe-clipboard-history-alternative/)，竞品自述）。
- **ClipboardFusion**（[功能](https://www.clipboardfusion.com/Features/)、[免费版 vs Pro](https://www.clipboardfusion.com/Compare/)）：Windows 老牌。卖点是 **C# 宏**（自己写文本转换，有社区宏库）和 **Triggers**（剪贴板变化、开机、锁屏、定时、窗口焦点时自动运行）；Pro 才有跨设备同步和在线固定。Pro 买断 $19（1 台）/ $29（个人不限台数），免费版只限个人使用。
- **Clipboard Master**（[官网](https://www.clipboardmaster.com/)）：Windows，免费加捐赠；多剪贴板、文本模板、密码保险箱、截图。右键菜单里有大小写转换、短链接等 80 多个功能，「Flexikeys」用于补全路径和模板。后两者只来自第三方介绍（[gHacks](https://www.ghacks.net/2015/06/10/clipboard-master-4-0-review/)、[techpp 2026](https://techpp.com/2026/04/02/best-clipboard-managers-for-windows/)），未核实。
- **ClipClip**（[官网](https://clipclip.com/)）：Windows 免费。文件夹组织、直接编辑富文本和图片、离线转换器（含翻译）、自带截图和录屏工具。价格页没有数字，未核实。
- **PasteNow**（[官网](https://pastenow.app/)）：Mac / iOS；空格预览、右键编辑、Smart List（按条件归组）、按应用排除、把条目拖出去。价格未核实。
- **Maccy**（[GitHub](https://github.com/p0deje/Maccy)，22265★，MIT，2026-10-26）：免费开源；⌥回车粘贴，⌥⇧回车纯文本，⌥P 置顶（分配一个固定键），**按住 ⌥ 点菜单图标暂停记录、⌥⇧ 点忽略下一次复制**；密码管理器清空剪贴板时也跟着删掉那一条；可以自定义要忽略的剪贴板类型。
- **Flycut**（[GitHub](https://github.com/TermiT/Flycut)，2700★，2026-08-07）、**1Clipboard**（Google Drive 同步，竞品说它多年没更新，[第三方](https://relic.space/vs/1clipboard)，未核实）：没有新东西。

#### GitHub：活跃和新项目（2026-11-10）

| 项目 | ★ | 最近推送 | 创建 | 许可证 | 平台 / 技术 |
|---|---|---|---|---|---|
| [CopyQ](https://github.com/hluk/CopyQ) | 12625 | 2026-11-09 | — | GPL-3.0 | 跨平台 C++ |
| [EcoPaste](https://github.com/EcoPasteHub/EcoPaste) | 7574 | 2026-08-13 | — | Apache-2.0 | Tauri |
| [Ditto](https://github.com/sabrogden/Ditto) | 7444 | 2026-10-01 | — | GPL-3.0 | Windows |
| [Slackadays/Clipboard](https://github.com/Slackadays/Clipboard) | 5945 | 2026-05-06 | — | GPL-3.0 | 终端 |
| [PasteMD](https://github.com/RICHQAQ/PasteMD) | 5431 | 2026-10-10 | 2025-10-25 | AGPL-3.0 | Windows，Python |
| [TieZ](https://github.com/jimuzhe/tiez-clipboard) | 3103 | 2026-10-23 | — | GPL-3.0 | Tauri |
| [ClipCascade](https://github.com/Sathvik-Rao/ClipCascade) | 1966 | 2026-11-08 | — | GPL-3.0 | 同步 |
| [Deck](https://github.com/yuzeguitarist/Deck) | 1485 | 2026-10-31 | 2025-12-06 | AGPL + 保留所有权利 | macOS Swift |
| [GPaste](https://github.com/Keruspe/GPaste) | 963 | 2026-11-07 | — | ? | GNOME |
| [Win顺 WinShun](https://github.com/LingCore/WinShun) | 950 | 2026-11-10 | 2026-10-08 | MIT | Windows 启动器 |
| [openclip](https://github.com/ganeshmshetty/openclip) | 751 | 2026-11-10 | 2026-08-01 | AGPL-3.0 | macOS |
| [Trimmy](https://github.com/steipete/Trimmy) | 749 | 2026-10-23 | 2025-11-15 | MIT | macOS |
| [clipcat](https://github.com/xrelkd/clipcat) | 617 | 2026-11-09 | — | GPL-3.0 | Linux Rust |
| [ElegantClipboard](https://github.com/Y-ASLant/ElegantClipboard) | 486 | 2026-11-10 | 2026-02-03 | MIT | Rust + GPUI，Windows 已实测 |
| [Clippi](https://github.com/Ruszero01/clippi) | 453 | 2026-11-09 | 2026-04-23 | MIT | Rust + GPUI |
| [PasteMemo](https://github.com/lifedever/PasteMemo-app) | 316 | 2026-11-06 | 2026-04-01 | GPL-3.0 | macOS |
| [Clipbara](https://github.com/mobrava/Clipbara) | 258 | 2026-11-10 | 2026-02-28 | GPL-3.0 | macOS + iPhone |
| [Beetroot](https://github.com/mnardit/beetroot-releases) | 208 | 2026-09-09 | 2026-02-09 | Apache-2.0 | **Windows**，Tauri（README 写「原生 Rust」，前端是 WebView，未细核） |
| [vPaste](https://github.com/Loxonl/vPaste-desktop) | 183 | 2026-11-09 | 2026-07-02 | GPL-3.0 | Win / macOS，Rust + WebView2 |
| [Pesty](https://github.com/momenbasel/pesty) | 160 | 2026-10-24 | 2026-06-26 | MIT | macOS |

- **Deck**：本轮功能最全的。斜杠筛选规则（按应用 / 日期 / 类型，可包含和排除）、本地语义搜索、**按当前应用调整排序**、Smart Rules（可写 JS）、**光标助手**（三击 Shift 在输入光标旁给建议）、大量文本变换（JSON、Base64、URL、大小写、时间戳、MD5、行排序去重）、**IDE 来源锚点**（从 VS Code / JetBrains 复制时记下文件和行号）、链接去追踪参数、复制算式立即出结果、Luhn 卡号检测、**检测到密码框 / 登录页窗口时自动暂停**、**屏幕共享时隐藏**、队列模式、**模拟键入粘贴**、Vim 模式、从 Paste / Maccy 迁移。
- **Beetroot**：Windows 上和我们最像的竞品。搜索分五段（子串、词首、元数据、模糊）+ `/正则/` 高亮；来源记录到**窗口标题**并可按应用下拉筛；内容标记（URL、邮箱、代码、JSON、颜色）和代码语言识别；Ctrl+点击多选后批量复制（自定义分隔符）；AI 变换（OpenAI / Gemini / Claude / DeepSeek / 本地，10 个文本 + 5 个图片内置提示词，后台运行完成后通知，key 放在 Windows 凭据管理器）；空格预览；Alt+T AI、Alt+P 窗口置顶、Alt+F 跟随鼠标；数据目录放在 OneDrive 时会警告；数据库自动轮转备份。
- **PasteMemo**：**复制即文件**（文字粘贴成 .txt，截图粘贴成图片文件）、「AI 终端可用」（往终端贴图片 / 文件）、Shift+Enter **粘贴并回车**、⌘K 命令面板、←→ 切换类型；**Relay** 接力粘贴可以把一段文字按分隔符拆成队列；规则引擎的条件可以是**目标应用**、时间段，结果可以替换、新增、写到文件夹或 POST 到 webhook；**敏感条目限时删除**（10 分钟到 7 天）；按来源 / 类型 / 时间看占用空间；**5 个 MCP 工具**。
- **ElegantClipboard**：**保真回贴**（其他原生格式，包括应用自定义格式，全部记下来，大的用 zstd 压缩成内容寻址的 blob）；同一段纯文本再带 HTML 复制时并入原条目；**复制后 300 ms 确认窗口**，用来过滤瞬时的中间内容；可选**粘贴后恢复原剪贴板**；序列粘贴用一个全局「推进键」（Ctrl+Shift+G）而不是监听 Ctrl+V；**悬停预览浮层透明、鼠标穿透、不抢焦点**，Ctrl+滚轮缩放；文件只存路径，路径失效时提示；快速粘贴有「受控 / 连贴」两种投递节奏；诊断日志不记正文。
- **Clippi**（中文作者）：快速窗口**不获取系统焦点**；**全拼和首字母搜索**，且不接管输入法；按住 Alt 显示快捷键；OCR 和**二维码识别**；表情与符号面板；OneDrive / iCloud / WebDAV 同步文本和标签；敏感内容预览脱敏。
- **vPaste**：横向卡片 ←→，空格预览（文本、图片、网页、文件）；颜色在 HEX / RGB / HSL 间转换；链接预览默认联网，可以关；粘贴队列用 Alt+Shift+V 开关；**可选记住上次的搜索、标签页和滚动位置**；多显示器跟随。
- **Clipbara**：Quick Look 预览里可编辑；**删除后 ⌘Z 撤销**；按住 ⇧ 粘贴时临时反转「纯文本」开关；`clipbara://` 链接给启动器调用；FAQ 专门有一条「图片贴不进终端」。
- **Pesty**：类似 Paste 的底部卡片条，**按来源应用给卡片头着色**，⌘1–9 加 ⇧ 是纯文本。
- **Trimmy**：只做一件事，多行 shell 命令压成一行；终端和普通应用的灵敏度分开设，会识别 Terminal、iTerm、Ghostty、WezTerm、Alacritty 等；保留 YAML 缩进；随时可以「粘贴原文」。
- **PasteMD**：Markdown / AI 对话网页内容一键贴成 Word / WPS 格式，Markdown 表格贴进 Excel；可以**按应用 / 窗口标题配置粘贴模式**。我们不做 Word 转换，但「按目标应用决定粘贴格式」这个思路和我们的终端特判一致。
- **openclip**：选中文字时在附近弹出动作条（大小写、搜索、计算、自定义脚本、AI），属于「划词动作」，和我们的划词翻译同类。
- **Win顺**：中文 Windows 启动器，内置剪贴板历史「代替 Win+V」、分组、悬停预览，以及给 AI 用的 MCP；拼音和首字母搜索是它的卖点。
- **CopyQ 14–17**（[CHANGES](https://github.com/hluk/CopyQ/blob/master/CHANGES.md)）：14 加了单密码的标签页加密（可存进系统钥匙串，可设到期自动锁）；16 加了按 MIME 类型的大小上限（默认每种格式 100 MiB）。具体发布日期 CHANGES 里没有写。
- **ClipCascade**：端到端加密同步文本、图片、文件，可以自建服务（Docker / JAR）或 P2P。**clipcat**、**GPaste**、cliphist、clipse 都是 Linux / 终端项目，对我们没有新的参考点。

### 来源

官方和商业（2026-11-10 访问）：

- PowerToys Advanced Paste：<https://learn.microsoft.com/en-us/windows/powertoys/advanced-paste>
- Windows 剪贴板：<https://support.microsoft.com/en-us/windows/clipboard-in-windows-c436501e-985d-1c8d-97ea-fe46ddf338c6>
- Raycast：<https://manual.raycast.com/clipboard-history.md>
- Paste：<https://pasteapp.io/>、<https://pasteapp.io/pricing>、<https://pasteapp.io/mcp>、<https://apps.apple.com/us/app/paste-limitless-clipboard/id967805235>
- Alfred：<https://www.alfredapp.com/help/features/clipboard/>
- Pastebot：<https://tapbots.com/pastebot/>
- ClipBook：<https://clipbook.app/>、<https://clipbook.app/compare/macos-tahoe-clipboard-history-alternative/>
- ClipboardFusion：<https://www.clipboardfusion.com/Features/>、<https://www.clipboardfusion.com/Compare/>
- Clipboard Master：<https://www.clipboardmaster.com/>；第三方：<https://www.ghacks.net/2015/06/10/clipboard-master-4-0-review/>、<https://techpp.com/2026/04/02/best-clipboard-managers-for-windows/>
- ClipClip：<https://clipclip.com/>；PasteNow：<https://pastenow.app/>；Maccy：<https://maccy.app/>
- 1Clipboard（第三方）：<https://relic.space/vs/1clipboard>、<https://www.thewindowsclub.com/1clipboard-review-a-universal-clipboard-for-windows-which-syncs-across-multiple-devices>

GitHub（`gh api repos/...` 和 README，2026-11-10）：上面表格里的所有仓库链接，另外还有 [Maccy](https://github.com/p0deje/Maccy)、[Flycut](https://github.com/TermiT/Flycut)、[PowerToys](https://github.com/microsoft/PowerToys)、[CopyQ CHANGES](https://github.com/hluk/CopyQ/blob/master/CHANGES.md)。

本机：下载的 README 放在 `%TEMP%\clipreadmes\`，不进仓库。我们的代码基线来自 `src/features/clipboard/ClipboardPopup.tsx`、`ClipboardPopupRow.tsx`、`popupKeys.ts` 和 `docs/design/clipboard.md`。
