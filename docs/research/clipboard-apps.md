# 剪贴板同类软件对照（第三轮）

> 日期：2026-11-15。问题：剪贴板要做一次全面完善，对照同类软件看还缺什么、哪里体验比别人差，每条给「做 / 不做 / 以后」。范围：Maccy（README、2.0–2.8 发布说明、issue）、Paste 官网、Raycast Manual、Ditto（README、wiki）、CopyQ（README、FAQ）、Windows Win+V（Microsoft 支持和第三方介绍）、PastePal（App Store）、Clipy（GitHub）、macOS 26 Spotlight 剪贴板（媒体报道）；`gh api` 查 star、最近推送和最新版本。相关任务：C81（#365）。
>
> 前两轮在 [clipboard-managers.md](clipboard-managers.md)（2026-11-09 侧重 Win+V 和粘贴回原窗口，2026-11-10 看了 20 多个新工具的功能全景）。那两轮建议的「必做」「值得做」现在几乎都做完了，所以这一轮不重复列功能全景，而是拿**现在的代码**逐项对照，重点看前两轮没覆盖的维度：存储和规模、固定的语义、隐私收尾、Mac 上的细节。按调研规则本应续写原文件，这次按主 agent 的分工单独成文，原文件开头可以加一行链接过来（由主 agent 决定）。
>
> 已经有 issue 的不再列为建议：C69 / #320（管理视图、多选删除、上限 500）、C70 / #321（复制后岛上弹卡片）、C79 / #334（链接收藏）、G1.18 / #366（Mac 空格预览和实测）、C68（跨设备同步调研）。

## 结论

**功能面我们已经是第一梯队。** 和 Maccy、Raycast、Paste、Ditto、CopyQ、Win+V 逐项比，搜索（拼音 / 首字母、`/app:` `/today` 斜杠规则）、动作面板、20 多种本地转换、AI 提示词、OCR 和二维码、顺序粘贴和合并粘贴、片段带变量、打码、按应用排除、暂停 / 忽略下一次、截屏时隐藏、撤销删除、导入导出、本地 API 读取，我们都有，有几项（终端贴图片路径、终端命令压平、HTML→Markdown、繁简转换）别人没有。

**差距集中在四块，都不大：**

1. **「固定」不是置顶。** 收藏只在「收藏」胶囊里能看到，「全部」里还按时间排，过几页就沉下去了。Maccy、Win+V、Raycast 的固定都是钉在列表最上面，Maccy 还给每条固定的分配一个永久的字母键。这是这次最值得做的一条。
2. **存储撑不起「更多、更久」。** 历史是一个 `clipboard-history.json`，每次变化整份重写；没找到文本条目的大小上限；列表不是虚拟列表。C69 把上限提到 500 已经在量写盘时间。Paste、Raycast（Pro）是不限条数、按时间保留，Maccy 用 SwiftData、Ditto 用数据库。500 以内 JSON 够用，再往上要换存储，先不动。
3. **隐私收尾。** 密码管理器清空剪贴板时我们不跟着删（Maccy 会）；打码的条目一直留着，不能设「敏感条目 N 分钟后自动删」（PasteMemo 有）；没有「删掉最近 15 分钟 / 1 小时」（Raycast 有）。
4. **Mac 细节。** 不认 `org.nspasteboard.source`（复制时由来源应用写进剪贴板的真实来源，Maccy 2.4 起支持）；不区分 iPhone 等设备经接力（Universal Clipboard）传来的内容（`com.apple.is-remote-clipboard`）；**「截屏时隐藏」在 Mac 上默认开着，而 Maccy 2.4.1 正是因为同样的设置让窗口在 DisplayPort 外接屏上看不见而撤掉了它**（[Maccy #1136](https://github.com/p0deje/Maccy/issues/1136)），要 G1.18 实测。

### 建议一览

工作量：小 = 一个会话半天内；中 = 一两天，要动 Rust 和前端；大 = 要换存储或新窗口。

| # | 建议 | 结论 | 工作量 | 理由（一句话） |
|---|---|---|---|---|
| 1 | 固定的条目钉在「全部」最上面，可选给每条一个固定键（⌥/Alt + 字母直接粘贴） | **做** | 小–中 | Maccy、Win+V、Raycast 都这么做；我们的收藏用起来像书签，不像「常用」 |
| 2 | Mac 上「截屏时隐藏」先实测外接屏，有问题就在 Mac 上默认关并写明 | **做**（并入 G1.18） | 小 | Maccy 因为同一个设置出过「外接屏上弹不出来」，我们默认开着 |
| 3 | Mac 读 `org.nspasteboard.source` 作来源；接力传来的内容标「来自其他设备」，可选不记录 | **做** | 小 | 两个都是 Mac 剪贴板的约定类型，读一下就行，来源更准 |
| 4 | 按时间段删除：最近 15 分钟 / 1 小时 / 今天 | **做** | 小 | Raycast 有；复制了不该复制的东西时比逐条删快。放进 C69 的管理视图和动作面板 |
| 5 | 密码管理器清空剪贴板时，把刚记下的那条一起删掉；打码条目可选 10 分钟 / 1 小时 / 1 天后自动删 | **做** | 小–中 | Maccy、PasteMemo 有；补上「不记录密码」漏掉的情况 |
| 6 | 单条大小上限：文本超过某个大小（例如 1 MB）只存截断后的预览或不记录，设置里可调 | **做** | 小 | CopyQ 有按格式的大小上限；一次复制几十 MB 日志会让整份 JSON 一起变大 |
| 7 | 接管 Win+V 时提示「表情和符号用 Win+.」 | **做** | 小 | 系统的 Win+V 面板里有表情、颜文字、符号，接管后用户会找不到 |
| 8 | 循环模式：按住修饰键连按 V 在历史里往下翻，松开就粘贴（像 Alt+Tab） | 以后 | 中 | Maccy 2.4 加的，熟练用户很爱用；两个平台都要另写按键监听 |
| 9 | 正则搜索 `/re:…` | 以后 | 小 | Beetroot、Deck 有，需求面窄 |
| 10 | 标签管理：改名、合并、按标签浏览（胶囊现在只显示最常用的 3 个） | 以后 | 小–中 | CopyQ 标签页、Ditto 分组、Paste Pinboard、PastePal 集合都是「分组」；我们的 `#标签` 够用，等 C69 管理视图做完再看 |
| 11 | 换存储（SQLite 或按条分文件），支持不限条数、只按时间保留 | 以后 | 大 | 等 C69 量完 500 条的写盘和渲染再定 |
| 12 | 弹窗记住上次的筛选、搜索和滚动位置 | 以后 | 小 | vPaste、Maccy（记位置）有；我们只在固定时记位置 |
| 13 | 跨设备同步 | 以后（C68） | 大 | 已有调研任务；最便宜的一步是把「收藏和片段」放进可迁移的数据目录（见 [data-home.md](../features/data-home.md)），不做账号 |
| 14 | 加密存储 / 打开前 Touch ID、Windows Hello | 不做 | 中 | 第二轮已判过；已有打码、排除、截屏隐藏，弹窗每次验证太重。若做只加密打码条目 |
| 15 | 多个独立剪贴板槽（Ditto Copy Buffers） | 不做 | 中 | 片段 + 建议 1 的固定键已覆盖 |
| 16 | 自动规则 / 脚本（CopyQ 命令、Ditto 脚本、Paste 智能规则） | 不做（核心）；以后由插件平台第 3 版暴露剪贴板事件 | — | 功能强但设置复杂，适合插件 |
| 17 | 底部卡片条（Paste）、贴边侧栏（PastePal） | 不做 | 大 | 已有标准 / 宽版弹窗和岛上页面，再加一种形态收益低 |
| 18 | 「下一条会贴什么」的预测（Paste Intelligent Clipboard）、自然语言问历史（Raycast Ask Clipboard） | 不做 | 大 | 已有本地 API 读取，Agent 可以自己问 |

### 建议建的任务

给主 agent 让用户挑，没有建 issue。

| 建议名 | 内容 | 分组 | 工作量 | 涉及文件 |
|---|---|---|---|---|
| 剪贴板固定置顶和固定键 | 建议 1：收藏改叫「固定」（或两者合一），在「全部」里置顶并和其余条目分隔；可选给固定的条目分配字母键，弹窗里 ⌥/Alt + 字母直接粘贴；固定条目可拖动排序 | C | 小–中 | `src/features/clipboard/ClipboardPopup.tsx`、`ClipboardPopupRow.tsx`、`popupFilters.ts`、`popupKeys.ts`、`settings.ts`、`api.ts`；`src-tauri/src/clipboard_history/service.rs`（排序 / 新字段放新文件）、`mod.rs`；i18n；回归页 `clipboard-popup` |
| 剪贴板隐私收尾 | 建议 5 + 6：密码管理器清空剪贴板时删掉刚记的那条；打码条目限时自动删；单条文本大小上限 | C | 小–中 | `src-tauri/src/clipboard_history/listener.rs`、`listener_macos.rs`、`secrets.rs`、`service.rs`（新逻辑放新文件）、`mod.rs`（设置项）；`ClipboardRecordSettings.tsx`；`pnpm settings:index` |
| 剪贴板按时间段删除 | 建议 4：最近 15 分钟 / 1 小时 / 今天；可撤销 | C | 小 | 若 C69 还没合入，直接交给 C69 会话做；否则 `popupActions.ts`、C69 的管理视图、`service.rs` 旁的新文件 |
| Mac 剪贴板：来源类型和接力内容 | 建议 3：读 `org.nspasteboard.source`；识别 `com.apple.is-remote-clipboard`，来源显示「其他设备」，设置里可选不记录 | G | 小 | `src-tauri/src/macos/pasteboard.rs`、`clipboard_history/listener_macos.rs`、`system_macos.rs`；设置项和 i18n |
| （并入 G1.18）Mac 截屏隐藏实测 | 建议 2：外接屏（尤其 DisplayPort / 雷电转接）上剪贴板窗口是否可见；有问题就在 Mac 上默认关并在设置旁写原因 | G | 小 | `clipboard_history/popup_macos.rs`、`settings.ts` 的默认值 |
| （小修，可顺手）Win+V 接管提示 | 建议 7 | C | 小 | Win+V 开关旁的说明文案（`ClipboardShortcutRows.tsx`）和 i18n |

## 详细

### 我们现在有什么（2026-11-15 读代码）

读了 `src/features/clipboard/`、`src/windows/clipboard/`、`src-tauri/src/clipboard_history/`、`docs/architecture/platforms.md` 剪贴板一行。

- **记录**：文本、HTML、图片（PNG 单张 ≤10 MB，另存缩略图）、文件（图片文件 ≤40 MB 时生成预览）；来源应用；Windows 用 `AddClipboardFormatListener`，Mac 每 400 ms 读 `changeCount`；2 秒内重复的不记；划词翻译期间暂停。
- **过滤和隐私**：不记录密码（Windows 认密码管理器的排除格式，Mac 认 `Concealed` / `Transient` / `AutoGenerated`）；按应用排除（≤50 个）；密钥、令牌、卡号（Luhn）、身份证号检测，处理方式「打码 / 不记 / 保留」；暂停 15 分钟、1 小时、直到恢复，忽略下一次（托盘也能暂停）；截屏和共享屏幕时隐藏窗口（默认开）；按 1–365 天自动清理；条数 5–200（默认 30，C69 要提到 500），超出时删最旧的非收藏项。
- **找**：搜索文本、备注、文件名、OCR 文字、来源；拼音全拼和首字母；`/app:` `/today` `/yesterday` `/week` `/img` `/file` `/link` `/color` `/json` `/text` `/fav`；筛选胶囊（全部、收藏、图片、文件、链接、颜色、片段、最常用的 3 个 `#标签`）；宽版按天分组。
- **看**：空格预览窗口（G1.18 在修 Mac 上的问题）；链接可选抓标题和图标（默认关）、颜色色块、JSON 高亮；图片大图和识别出的文字。
- **用**：选中后贴回原窗口；纯文本粘贴、粘贴并回车、1–9 数字键；动作面板（Ctrl/⌘ K）：编辑后粘贴、20 多种转换（大小写、驼峰 / 下划线、JSON 格式化 / 压缩、URL 编解码、去追踪参数、全半角、繁简、去重 / 排序行、合成一行、HTML→Markdown）、AI 自定义提示词（≤20 个）、图片复制为文件 / 路径 / OCR 文字 / 二维码内容、文字存为 .txt 文件；多选后顺序粘贴或用换行 / 空格 / 逗号合并；终端里贴图片自动换成路径、多行命令压平（默认关）；拖出去；片段（带日期、剪贴板等变量）。
- **管**：收藏、备注（≤80 字，里面的 `#词` 成为标签，≤8 个）、删除可撤销、清空（保留收藏）、导入导出、固定窗口（失焦不隐藏）。
- **集成**：本地 API 读取（默认关，给 Agent 用）；旧插件的 `clipboard:read`；岛上剪贴板页；Win+V 接管（默认关）；快捷键 Windows `Ctrl+Shift+W`（老用户）/ `Shift+Win+V`，Mac ⌘⇧V。

没找到的（读代码，可能有遗漏）：收藏置顶、固定键、按时间段删除、文本大小上限、密码管理器清空后跟着删、敏感条目限时删除、正则搜索、Mac 的 `org.nspasteboard.source` 和接力内容识别、循环模式、虚拟列表。

### 对照表

图例：✓ 有；✗ 没有；? 没查到（不代表没有）。Maccy 2.8.0、Ditto 3.25.113、CopyQ 17.0.0、Clipy 1.4.1 是 2026-11-15 `gh api` 查到的最新版本。

| 维度 | 功能 | Maccy | Paste | Raycast | Ditto | CopyQ | Win+V | macOS 26 Spotlight | 我们 |
|---|---|---|---|---|---|---|---|---|---|
| 平台 | | Mac | Mac / iOS | Mac / Win | Win | Win / Mac / Linux | Win | Mac | Win / Mac |
| 记录 | 文本 / 图片 / 文件 | ✓ | ✓ | ✓ | ✓ | ✓ | 文本、HTML、位图 | ✓ | ✓ |
| 记录 | 自定义格式保真 | 只存选中的类型（2.8） | ? | 保留原格式，可「粘贴为…」 | ✓ | ✓ | ✗ | ? | 文本、HTML、图片、文件 |
| 记录 | 单条大小上限 | ? | ? | ? | ? | 按格式设（环境变量） | 4 MB | ? | 只限图片 |
| 规模 | 条数 / 保留 | 可设条数 | 不限 | 1 天–3 个月，Pro 到不限 | 可设 | 每个标签页默认 200 | 25 条，重启清空 | 30 分钟 / 8 小时 / 7 天 | 5–200 条 + 1–365 天 |
| 规模 | 存储 | SwiftData | ? | ? | 数据库 | 按标签页存文件 | 系统 | 系统 | 一个 JSON 整份重写 |
| 隐私 | 跳过密码管理器 | ✓ | ✓（规则） | ✓（预设） | ✓ | 按窗口标题写命令 | ✓ | ? | ✓ |
| 隐私 | 密码管理器清空时跟着删 | ✓ | ? | ? | ? | ? | — | ? | ✗ |
| 隐私 | 敏感内容打码 | ✗ | ? | ✗ | ✗ | 存哈希的黑名单 | ✗ | ✗ | ✓ |
| 隐私 | 暂停 / 忽略下一次 | ✓（⌥ / ⌥⇧ 点菜单图标） | ? | ? | ? | ✓（Ctrl+Shift+X） | ✗ | 只能整体关 | ✓ |
| 隐私 | 加密存储 | ✗ | iCloud 私有 | ? | ? | ✓（密码或系统钥匙串） | ✗ | ? | ✗ |
| 隐私 | 截屏隐藏 | 2.4 加了又撤掉 | ? | ? | ? | ? | ✗ | — | ✓（默认开） |
| 找 | 搜索 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ + 拼音 |
| 找 | 按类型 / 来源 / 日期 | ✗ | ✓ | 类型（⌘P） | ? | 标签页 | ✗ | ✗ | ✓ |
| 找 | 图片里的文字可搜 | ✓（2.4） | ? | ✓ | ✗ | ✗ | ✗ | ? | ✓ |
| 看 | 大预览 | ✓（⌃Space 侧滑面板，2.7） | ✓ | ✓ | F3 | F4 | ✗ | ✓ | ✓ |
| 用 | 贴回原窗口 | ✓（⌥↵） | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 用 | 纯文本 | ✓ | ✓ | ✓ | ✓（⇧↵） | ✓ | ✗ | ? | ✓ |
| 用 | 数字键 | ⌘1–9 | ⌘1–9 | ? | ? | ? | ✗ | ✗ | 1–9 |
| 用 | 顺序粘贴 | ✗ | ✓（Paste Stack） | ✓（可设 30 秒–3 分钟超时） | ✗ | ✗ | ✗ | ✗ | ✓ |
| 用 | 循环模式 | ✓（2.4） | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 用 | 转换 / AI | ✗ | ✗ | 发给 AI Chat | 脚本 | 命令 | ✗ | ✗ | ✓ |
| 整理 | 固定 / 置顶 | ✓ 置顶 + 固定键，可拖动排序（2.8） | Pinboard | ✓ 置顶、改名 | 分组 | 标签页 | ✓ 固定，重启保留 | ✗ | 收藏（不置顶） |
| 整理 | 分组 / 标签 | ✗ | Pinboard（可共享） | ✗ | 多层分组 | 标签页 + 标签 | ✗ | ✗ | `#标签` |
| 整理 | 片段 | ✗ | Pinboard | Save as Snippet | ✗ | ✗ | ✗ | ✗ | ✓（带变量） |
| 管理 | 批量删除 | 清空非固定 / 全部 | ? | 按时间段（5 分钟–24 小时） | ? | 多选 | 清空非固定 | 清空 | 清空非收藏（C69 做多选） |
| 同步 | 跨设备 | ✗ | iCloud | 只有接力 | 旧版有局域网发送（未核实） | 导出导入 | 微软账户 | — | 导出导入（C68 调研中） |
| 快捷键 | 默认 | ⇧⌘C | ⇧⌘V | 自定 | Ctrl+` | 自定 | Win+V | ⌘Space 再 ⌘4 | ⇧Win+V / ⌘⇧V |

另外几家，表里放不下：

- **Alfred**（Powerpack）：文本、图片、文件三类分别开关，保留 24 小时 / 7 天 / 1 个月 / 3 个月；按住 ⌘ 连按两次 C 把这次复制追加到上一条；⌘S 存为片段。（第二轮已记，[帮助页](https://www.alfredapp.com/help/features/clipboard/)）
- **PastePal**：Mac / iPhone / iPad，可选 iCloud 同步，自建带图标的集合，按应用和类型筛，可以贴在屏幕任一边的侧边窗口。（[App Store](https://apps.apple.com/au/app/id1503446680?l=en-au)，开发者自述）
- **Clipy**：Mac 老牌免费开源（8975★，2026-11-15 仍有推送，1.4.1 发布于 2026-10-30），卖点是片段按文件夹组织、从菜单栏选。第三方说它停更，和 GitHub 上的活跃度矛盾，以 GitHub 为准。（[GitHub](https://github.com/Clipy/Clipy)）
- **eIsland**：剪贴板历史、编辑、写回，链接识别和收藏（我们的 C79 就是从它来的）。我们的剪贴板比它完整，见 [eisland.md](eisland.md)。

### 各条建议的细节

#### 1. 固定置顶和固定键（做）

- **别人**：Maccy ⌥P 把条目钉到最上面，并分配一个「随机但永久」的字母键，之后打开弹窗按这个键就选中它；2.8 加了拖动排序和在预览里直接编辑固定的条目（[2.8.0 发布说明](https://github.com/p0deje/Maccy/releases/tag/2.8.0)、[README](https://github.com/p0deje/Maccy)）。Win+V 固定的条目重启后还在，「全部清除」不删它们。Raycast 可以置顶和改名。
- **我们**：收藏不被条数上限和过期清理删掉，但列表里按复制时间排，只在「收藏」胶囊里集中。
- **建议**：「全部」里收藏的条目排在最上面，下面一条分隔线（可在设置里关）；动作面板加「设固定键」，弹窗里 Alt/⌥ + 字母直接粘贴（避开 Maccy 踩过的 A、W 这类系统键）。和片段的区别要在设计稿里说清：片段是自己写的模板，固定是复制来的原件。
- **注意**：数字键 1–9 现在按「显示位置」粘贴，置顶后前几位会变成固定条目，要想好数字键是否跳过固定区。

#### 2. Mac 上的截屏隐藏（做，并入 G1.18）

- Maccy 2.4.0 加了「屏幕共享时隐藏」，2.4.1 就撤掉了，原因是这个设置让窗口在 DisplayPort 连接的外接屏上看不见（[2.4.1 发布说明](https://github.com/p0deje/Maccy/releases/tag/2.4.1)、[#1136](https://github.com/p0deje/Maccy/issues/1136)「只能在主屏上打开」）。
- 我们在 `clipboard_history/popup_macos.rs` 里同样调 `set_content_protected(settings.hide_from_capture)`，默认 `true`。Mac 上的实现是 `NSWindow.sharingType = .none`（Tauri / tao 的做法，未逐行核对）。
- 建议 G1.18 在外接屏上试一次；复现的话 Mac 默认关，设置旁写一句原因。

#### 3. Mac 的来源类型和接力内容（做）

- `org.nspasteboard.source`：nspasteboard.org 约定的类型，复制的应用把自己的 bundle id 写进去。Maccy 2.4 起用它显示真实来源（[2.4.0 发布说明](https://github.com/p0deje/Maccy/releases/tag/2.4.0)）。我们现在取前台应用，后台工具（剪贴板同步、密码管理器的自动复制、脚本）复制时会记错。
- `com.apple.is-remote-clipboard`：iPhone / iPad 经接力传来的内容带这个类型。Maccy 的 FAQ 教用户把它加进忽略列表；Raycast 有单独开关「立即保存其他 Apple 设备复制的内容」。我们现在把它当作前台应用复制的。
- 建议：读到前者就用它作来源；读到后者来源显示「其他设备」，设置里加「记录其他设备复制的内容」（默认开）。只动 Mac 的读取代码。

#### 4. 按时间段删除（做）

- Raycast：删除最近 5 / 15 / 30 分钟、1 / 24 小时（[Manual](https://manual.raycast.com/clipboard-history.md)）。复制了密码或私人内容后，不用找到那一条。
- 我们有删除单条、清空、按天自动清理。C69 正在做管理视图和多选删除，这一条放进 C69 最顺；C69 已经合入的话单独小任务。

#### 5. 密码管理器清空时跟着删、敏感条目限时删（做）

- Maccy：密码管理器清空剪贴板时，把那一条也从历史里删掉（[官网](https://maccy.app/)）。用处是密码管理器没打「不记录」标记的情况（部分浏览器扩展、老版本 KeePass 系、命令行工具）。
- PasteMemo：敏感条目 10 分钟到 7 天后自动删（第二轮已记）。
- 建议：最新一条记下后若干秒内剪贴板被清空，就删掉它（只看最新一条，不追溯）；打码的条目可选限时删除。两者都放 `listener*.rs` / `secrets.rs` 旁的新文件，`service.rs` 已经 690 行。

#### 6. 单条大小上限（做）

- CopyQ 可以按格式设大小上限，超过就跳过或截断（[FAQ](https://copyq.readthedocs.io/en/latest/faq.html)）；Win+V 单条 4 MB。
- 我们只限制图片（PNG 10 MB），文本没找到上限。复制一个大日志会进历史，每次写盘都带着它。建议默认 1 MB，超过只记前面一段并标「已截断」，原文不能再贴回就说清楚。

#### 7. 接管 Win+V 的提示（做）

- 系统的 Win+V 面板里还有表情、GIF、颜文字和符号；接管后这些入口没了。`Win+.` 能打开同一个表情面板（Windows 自带，未在本机核实）。在 Win+V 开关旁写一句即可。

#### 8–18

理由见上面的表。补充两点：

- **存储（11）**：Maccy 2.0 把存储从 Core Data 换到 SwiftData，2.5–2.8 连续修内存（每条都泄漏、大历史时菜单栏标题渲染慢），说明「条数多」本身就是持续的工程成本。我们先让 C69 在 500 条时量写盘和列表，超过 50 ms 再考虑按条分文件或 SQLite。
- **macOS 26 自带剪贴板**：⌘Space 再 ⌘4 打开，默认关，26.1 起保留时间可选 30 分钟 / 8 小时 / 7 天，没有固定、没有收藏（[MacRumors](https://www.macrumors.com/2025/11/04/more-spotlight-clipboard-settings-macos-26-1/)）。Mac 用户的「基线」从此是系统自带的，我们要赢在固定、片段、转换、终端贴图这些上，不必在「有历史」本身上多花力气。

### Mac 和 Windows 各自的体验

| | Windows | Mac |
|---|---|---|
| 系统自带 | Win+V：25 条、可固定、微软账户同步、重启清空未固定的 | Spotlight 剪贴板（macOS 26）：默认关，最长 7 天，无固定 |
| 主流第三方 | Ditto（数据库、分组、Ctrl+`）、CopyQ（标签页、脚本、加密） | Maccy（免费、⇧⌘C、⌥ 系列快捷键）、Paste（订阅、iCloud、卡片条）、Raycast、Alfred |
| 用户习惯 | 习惯 Win+V；我们可选接管 | 习惯菜单栏图标和 ⌥ 修饰键；贴回要「辅助功能」授权 |
| 我们的差距 | 接管后表情面板入口（建议 7） | 来源类型、接力内容（建议 3）；截屏隐藏在外接屏上的风险（建议 2）；空格预览（G1.18） |
| 我们独有 | 终端贴图片路径、命令压平、繁简、拼音搜索 | 同左；而 Mac 上的竞品几乎都不做拼音搜索 |

Mac 上还要留意两件 Maccy FAQ 里写到的事，现在不用改代码，G1.18 实测时顺带看：

- 贴回不工作时，十有八九是「辅助功能」授权没给（我们首次会提示）。
- 用户自定的快捷键如果会打出字符（比如 ⌥C 打出 ç），在密码框里会被系统的安全输入拦掉。我们默认 ⌘⇧V 不受影响，改键说明里可以写一句。

## 来源

2026-11-15 访问。

- Maccy：[GitHub README](https://github.com/p0deje/Maccy)（22327★，最新 2.8.0，2026-10-26）、[发布说明](https://github.com/p0deje/Maccy/releases)（2.0–2.8）、[#1136](https://github.com/p0deje/Maccy/issues/1136)、[官网](https://maccy.app/)
- Paste：[官网](https://pasteapp.io/)
- Raycast：[Clipboard History Manual](https://manual.raycast.com/clipboard-history.md)
- Ditto：[GitHub README](https://github.com/sabrogden/Ditto)（7477★，最新 3.25.113.0，2025-09-27）、[Wiki](https://github.com/sabrogden/Ditto/wiki)、[Copy Buffers](https://github.com/sabrogden/Ditto/wiki/Copy-Buffers)
- CopyQ：[GitHub README](https://github.com/hluk/CopyQ)（12636★，最新 v17.0.0，2026-10-06）、[官网](https://hluk.github.io/CopyQ/)、[FAQ](https://copyq.readthedocs.io/en/latest/faq.html)
- Clipy：[GitHub](https://github.com/Clipy/Clipy)（8975★，最新 1.4.1，2026-10-30）
- PastePal：[App Store](https://apps.apple.com/au/app/id1503446680?l=en-au)
- Windows Win+V：[Microsoft 支持](https://support.microsoft.com/en-us/windows/clipboard-in-windows-c436501e-985d-1c8d-97ea-fe46ddf338c6)（第二轮已引）、[technobezz](https://www.technobezz.com/how-to-use-clipboard-history-in-windows-11)、[geekrewind 同步设置](https://geekrewind.com/how-to-sync-clipboard-across-devices-in-windows-11/)
- macOS 26 Spotlight 剪贴板：[MacRumors 2025-11-04](https://www.macrumors.com/2025/11/04/more-spotlight-clipboard-settings-macos-26-1/)、[MacRumors 用法](https://www.macrumors.com/how-to/do-more-with-spotlight-in-macos-tahoe/)
- 前两轮：[clipboard-managers.md](clipboard-managers.md)；eIsland：[eisland.md](eisland.md)

本机：下载的 README 在会话的临时目录，不进仓库。代码基线来自上文列出的目录。
