# 快捷键文件搜索（Everything / Spotlight）

> 日期：2026-11-15。问题：用户群要「按快捷键调出搜索框或 Everything 搜索，快速找文件」，Windows 上怎么接 Everything（SDK、HTTP 服务、es.exe 三种接入怎么选），没装时怎么办，Mac 上的对等做法是什么，做成插件平台第 3 版的官方插件要哪些能力。范围：voidtools 官网的 SDK / IPC / HTTP / 命令行文档、下载页和论坛，GitHub 上的 everything_sdk3、EverythingPowerToys、Flow Launcher 文档，docs.rs 的 Rust 包，Apple 的 Spotlight 文档和 `mdfind` 手册；本仓库的 [v3-everything-plugin.md](../architecture/plugins/v3-everything-plugin.md)。相关任务：C67（#318），依赖 E36.5（#295）。

## 结论

1. **Windows 走 Everything 的 IPC，不带 DLL**。Everything 1.5（2026-05 起是 beta，安装后覆盖 1.4）用命名管道（SDK3 的协议），插件的宿主部分是 Node，Node 自带的 `net` 就能连 Windows 命名管道，**不用原生扩展**；1.4 用的是 `WM_COPYDATA` 窗口消息，Node 直接做不了，退到 **es.exe**（用户另装，`winget install voidtools.Everything.Cli`）。HTTP 服务默认关、默认绑所有网卡、没有 TLS，只作为用户自己开了时的第三选择，不引导用户去开。
2. **没装 Everything** 时搜索框里直接说明并给两个按钮：用 winget 装（`winget install voidtools.Everything`）、打开官网下载页。装了 Lite 版要单独说明（Lite 没有 IPC、ES、SDK、HTTP，四种接入都用不了）。装了但没在运行时提示启动它（检测用「试着连 IPC」，不靠注册表）。可选的后备是 Windows 自带的索引（`SystemIndex`），但它要原生 OLE DB 调用、只搜索引过的位置，第一版不做。
3. **Mac 上第一版用 `mdfind`**（插件宿主部分 `child_process.spawn`，输入防抖，`-name` + `-onlyin ~` 或全盘）；以后要实时更新、要更快再换成 Rust 里的 `NSMetadataQuery`（要跑在有 run loop 的线程上）。Spotlight 排除的文件夹和系统目录搜不到，要在说明里写清。
4. **按第 3 版的规则，整个功能可以写成纯 JS 的官方插件**：宿主部分负责查（Windows 命名管道 / es.exe，Mac `mdfind`）和打开文件（`explorer /select,` / `open -R`），界面部分画搜索框。插件包不能带 `.node` 原生扩展和可执行程序（方案「宿主进程」「插件包」两节），所以 **不把 Everything64.dll 或 es.exe 打进插件**；也不需要往 Rust 加 Everything 专用的代码。
5. **第 3 版现在缺两样**，E36.5 之前要补上或确认：插件能注册**全局快捷键**（清单里有 `commands` 和默认快捷键，但宿主怎么收到热键还没定）；插件能开一个**能拿键盘焦点的浮层窗口**（第 2 版的 E34 做过 Win32 浮层，第 3 版的方案里还没有插件窗口；退一步可以放进剪贴板窗口那样的常驻隐藏窗口或岛屿展开页的插槽，但输入框要能马上拿到焦点）。这两项写进 E36 的待定事项，C67 等它们。

建议的实现顺序（E36.5 之后）：先 Mac `mdfind` + Windows es.exe（最简单、两边都能先跑起来）→ 再加 Windows 命名管道（1.5，不要用户另装 es）→ 视反馈再做 `NSMetadataQuery` 和 Windows 索引后备。

## 详细

### Everything 的三种（其实是四种）接入

| 接入 | 要用户做什么 | 速度 | 授权 / 分发 | 第 3 版插件里能不能用 |
|---|---|---|---|---|
| **SDK（Everything64.dll）** | Everything 在运行；1.4.1 以上 | 最快（进程内调 IPC），几十万文件的搜索是即时的 | Everything 本体是 MIT 式许可，可再分发；老 SDK 压缩包里没找到许可说明（未核实能否随包分发 DLL）；SDK3 仓库是 MIT | **不能**：要加载 DLL，Node 里得靠原生扩展或 FFI 包，插件包不允许带 |
| **IPC 直连（不用 DLL）** | 同上 | 同上 | 协议本身公开（官方 IPC 文档，SDK3 源码 MIT） | 1.5 的命名管道：**能**，Node `net.connect('\\\\.\\pipe\\…')`。1.4 的 `WM_COPYDATA`：不能（要有窗口收回复） |
| **es.exe（命令行）** | 另装 ES（不随 Everything 安装，winget `voidtools.Everything.Cli`），Everything 在运行 | 每次查询起一个进程，没找到实测数字；估计每次几十毫秒，加杀毒扫描（未核实），要防抖 | 免费 | **能**：`child_process.spawn('es.exe', ['-json', '-n', '50', …])`，退出码 8 表示连不上 Everything |
| **HTTP 服务** | 在 Everything 的「选项 → HTTP 服务器」里手动打开，并且应该把绑定改成 `127.0.0.1` | 一次本机 HTTP 请求，快 | — | **能**（`fetch`），但默认绑所有网卡、无 TLS、空密码就不认证，开了等于把整个文件列表和下载暴露到局域网；不引导用户开 |

细节：

- SDK / IPC 都要求 Everything 正在运行，只能本机用。SDK3 对应 1.5，SDK2 对应 1.4，老 SDK 也能连 1.5。
- 1.5 的管道名是 `\\.\PIPE\Everything IPC Session <会话号>`，具名实例再加 ` (<实例名>)`；1.5 alpha 默认跑在实例 `1.5a` 下，官方论坛的建议是先试 `1.5a` 再试不带实例名。1.5 进 beta 后的实例名没核实，两个都试。
- 可以要的字段：路径、大小、修改时间、高亮片段；可以限条数和分页；按名字排序免费，其他排序要用户在「选项 → 索引」里勾了快速排序才是即时的。
- Rust 包：`everything-sdk` 是 GPLv3，不能用；`everything-ipc` 0.1.4（2026-07）原生实现 1.4 / 1.5 的 IPC，许可证在 docs.rs 上没显示。只有决定在 Rust 里做时才相关，按结论第 4 条用不上。

### 检测和没装时的提示

| 情况 | 怎么判断 | 显示什么 |
|---|---|---|
| 能用 | 连上命名管道，或 es.exe 返回 0 | 正常搜索 |
| 装了没运行 | 卸载注册表 `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Everything` 在（有 `InstallLocation`），但 IPC 连不上 / es 退出码 8 | 「Everything 没在运行」+「启动它」按钮（运行 `InstallLocation\Everything.exe -startup`，参数未核实） |
| 装的是 Lite | 版本信息或安装目录判断（具体字段未核实） | 「Lite 版不支持外部程序搜索，请换完整版」 |
| 1.4 且没装 es.exe | IPC 管道连不上、注册表显示 1.4 | 「装一下 Everything 命令行工具」+ winget 命令 |
| 没装 | 以上都没有 | 「快速搜索文件要用 Everything（免费）」+「用 winget 安装」「打开下载页」 |

winget 的 id：`voidtools.Everything`（正式版）、`.Beta`、`.Alpha`、`.Lite`、`.Cli`。版本（2026-11-15 查）：稳定版 1.4.1.1032，1.5.0.1424b beta，1.5 没有 Lite。

### 别人怎么接

| 产品 | 做法 |
|---|---|
| PowerToys Run 的 EverythingPowerToys | 用 SDK（Everything64.dll），有的版本随包带 DLL；v3 改用 SDK3，支持具名实例（默认 `1.5a`）；不支持 Lite |
| Flow Launcher | Everything 和 Windows 索引两种都有；文档写只支持 1.4，不支持 1.5 alpha |
| uTools | 用 1.4 的 SDK（未核实）；1.5a 跑在 alpha 实例下时检测不到，用户要在 ini 里设 `alpha_instance=0`（未核实）——**实例名要两个都试**的教训 |
| Raycast | 文件搜索用自己的索引，Spotlight / Windows 搜索只用于可选的内容搜索 |

### Mac：Spotlight

| 做法 | 优点 | 缺点 |
|---|---|---|
| `mdfind -name <词>`（或 `"kMDItemDisplayName == '*词*'cd"`，`-onlyin <目录>`，`-0`） | 一行 `spawn`，纯 JS 插件就能做 | 每次一个进程；没有排序和条数限制要自己截；`-live` 只更新数量 |
| `NSMetadataQuery`（objc2-foundation 0.3 有绑定） | 异步、实时更新、可按名字排序、可限范围（用户目录 / 本机 / 网络） | 要在有 run loop 的线程上跑，读结果前后要 `disableUpdates` / `enableUpdates`；要写 Rust，等于往 Rust 加一项能力 |

- 浮屿不在沙盒里，用户目录下的结果不受影响；不需要完全磁盘访问（未核实，邮件等受保护数据表现不一）。
- 搜不到的：Spotlight 隐私里排除的文件夹（有报告说 macOS 26 不认排除）、光盘、磁盘映像、系统目录。
- 其他：`fd` / `locate` 要用户装或自己建库，不考虑。

### 作为第 3 版插件要哪些能力

| 能力 | 第 3 版现状（读方案得到的） | C67 怎么用 |
|---|---|---|
| 宿主部分跑 Node，能 `spawn`、`net`、`fetch` | 有（「插件的后台部分能直接用 Node 的接口」） | es.exe、`mdfind`、命名管道、打开文件 |
| 窗口部分往插槽放 React 组件，`ctx.host.call` 调宿主 | 有（协议 1，`ctx.clients` / `ctx.slots`） | 搜索框和结果列表 |
| 清单里声明命令和默认快捷键 | 方案里有 `commands` 字段 | 「打开文件搜索」，默认快捷键待定（不能和剪贴板、翻译、截图的冲突） |
| **全局快捷键触发到插件** | 未定 | 要 Rust 收到热键后经管道通知宿主 |
| **能拿焦点的浮层窗口** | 第 3 版方案里没有插件窗口 | 要一个类似剪贴板窗口的常驻隐藏窗口，弹出时输入框立刻有焦点；或者 Rust 侧提供「插件浮层」 |
| 设置项（插槽「设置的分节」） | 有 | 搜索范围、条数、Mac 上是否全盘 |
| 文件图标 | 未定 | 可选，第一版用扩展名图标 |
| 插件包不能带原生扩展 / 可执行程序 | 已定 | 所以不带 DLL、不带 es.exe |
| 清单声明「会运行程序、读文件」 | 已定（市场显示） | 声明运行 es.exe / mdfind / explorer / open |

## 来源

- Everything SDK：https://www.voidtools.com/support/everything/sdk/ ，IPC：https://www.voidtools.com/support/everything/sdk/ipc/ ，`Everything_SetRequestFlags`：https://www.voidtools.com/support/everything/sdk/everything_setrequestflags/ ，`Everything_SetSort`：https://www.voidtools.com/support/everything/sdk/everything_setsort/
- SDK3（MIT，命名管道）：https://github.com/voidtools/everything_sdk3 ；实例名：https://www.voidtools.com/forum/viewtopic.php?t=15853 、https://www.voidtools.com/forum/viewtopic.php?p=75090
- HTTP 服务：https://www.voidtools.com/support/everything/http/ ；Lite 没有 HTTP：https://www.voidtools.com/forum/viewtopic.php?p=74699
- es.exe：https://www.voidtools.com/support/everything/command_line_interface/ ；winget：https://wingetly.io/publishers/voidtools 、https://winstall.app/apps/voidtools.Everything
- 下载页与版本（2026-11-15 查）：https://www.voidtools.com/downloads/ ；1.5 进 beta：https://www.voidtools.com/forum/viewtopic.php?p=81831
- 许可：https://www.voidtools.com/License.txt ；FAQ（速度、Lite、服务）：https://www.voidtools.com/faq/ ；多实例：https://www.voidtools.com/support/everything/multiple_instances/
- 卸载注册表项：https://samibs.github.io/Registry-Keys-for-Open-Source-Applications-on-Windows/everything/
- Rust 包：https://docs.rs/crate/everything-sdk/latest 、https://docs.rs/crate/everything-ipc/latest
- EverythingPowerToys：https://github.com/lin-ycv/EverythingPowerToys/wiki/Features 、https://newreleases.io/project/github/lin-ycv/EverythingPowerToys/release/v0.82.1
- Flow Launcher：https://github.imc.re/Flow-Launcher/docs/blob/main/plugin-explorer-usage.md ；uTools（未核实）：https://www.zhihu.com/tardis/jm/art/2051796440746403433 ；Raycast：https://manual.raycast.com/file-search 、https://manual.raycast.com/troubleshooting/spotlight
- `mdfind`：https://keith.github.io/xcode-man-pages/mdfind.1.html ；Spotlight 查询：https://developer.apple.com/library/mac/documentation/Carbon/Conceptual/SpotlightQuery/Concepts/QueryingMetadata.html ；objc2 绑定：https://docs.rs/objc2-foundation/0.3.2/objc2_foundation/struct.NSMetadataQueryResultGroup.html ；沙盒 / 权限讨论：https://developer.apple.com/forums/thread/783958 、https://developer.apple.com/forums/thread/121187 、https://developer.apple.com/forums/thread/845516
- Windows 索引：https://learn.microsoft.com/en-us/windows/win32/search/-search-sql-windowssearch-entry 、https://learn.microsoft.com/nb-no/windows/win32/search/-search-sql-select
