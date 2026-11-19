# 功能领域零散任务计划

> 组长：`[任务] 功能零散`（由 `Fuyu-[总控] 功能` 开出，2026-11-18）。功能领域（C 组里外观以外的部分）的零散小任务都攒在这里，一轮一节，新的往下加。
> 合入：任务会话验完、提交后告诉组长，组长核对后发给 `Fuyu-[总控] 全局` 整批 land；组长和任务会话都不各自 land。issue 由做的任务会话在合入后回复并关闭。

## 第 1 轮：借鉴上游 fly-island（2026-11-18）

来源：[upstream-recent-changes.md](../research/upstream-recent-changes.md)。四个任务都是待做、没人认领，issue 已建。

### 现状（2026-11-18 看代码）

| 任务 | 现状 | 要改的地方 |
|---|---|---|
| C124（#897）收起条长消息自适应展开 | `CollapsedMessageContent.css` 里发送人、正文都是 `white-space: nowrap` + 省略号，收起条宽度固定；鼠标停在岛上时消息预览照常按时消失 | 前端：`src/features/messages/CollapsedMessageContent.*`、`island/useLatestMessagePreview.ts`（停留不消失）、岛壳的收起条样式和收起宽度；原生：`src-tauri/src/island/state.rs`（收起尺寸、点击区域） |
| C127（#900）歌词源加 QQ QRC、酷狗本地 KRC、网易 yrc | `src-tauri/src/lyrics/` 已有酷狗在线（KRC，逐字）、网易云（逐行，有 ID 时先试 AMLL 逐字）、lrclib、本地 `.lrc` / `.ttml`；C4c 当时只做了酷狗逐字，QRC（魔改 DES）和 yrc（eapi 加密）推迟。前端来源列表在 `src/features/media/host/lyricsSources.mjs`。依赖里有 `base64`、`flate2`，没有 DES / AES | `src-tauri/src/lyrics/` 新增 `qq.rs`、`qrc.rs`、`kugou_cache.rs`，改 `netease.rs`（yrc）、`mod.rs`（来源顺序、逐字优先）；前端来源列表和文案 |
| C122（#901）微信会话定位重试 | `src-tauri/src/wechat_reminders/chats.rs` 的 `open()` 读一次列表就点，找不到、不在可视区就直接失败 | 只改 `chats.rs` 的 `open()`（重试循环写在 `chats.rs` 里，复用 `uia_list::list_rows` 和 `click_in`）：3 秒内反复取样，两次位置一致才点；超时照旧只唤出微信 |
| C123（#902）岛上翻译页打开不往下跳 | `TranslationPanel.tsx:60` 和 `:69`、`useTranslationRequest.ts:89` 用普通 `focus()` | 三处改成 `focus({ preventScroll: true })` |

D104（#835，需要用户本人）是 Windows 真机验收单，第 1 项正好是「快捷键以岛上页面打开翻译时的焦点」，C123 的实测并进去：C123 的会话在 D104 的正文加第 5 项，用户验 D104 时一起看。

### 分几个会话

三个会话，C122 和 C123 合成一个（都是一两处的小修，文件不重叠，省一行侧边栏）：

| 会话 | 任务 | 要编译 | `--scope` |
|---|---|---|---|
| `[C127] 歌词源加 QQ、酷狗本地缓存和网易逐字` | C127 | 是（cargo） | `src-tauri/src/lyrics/,src/features/media/host/lyricsSources.mjs,src/features/media/lyrics/,src/i18n/sections/settings/lyrics.ts,docs/research/lyrics-sources.md`（要加 crate 时再加 `src-tauri/Cargo.toml,src-tauri/Cargo.lock`，热点文件，改完单独先提交） |
| `[C122] 微信会话定位重试和翻译页不跳` | C122 + C123 | 是（cargo，Windows 交叉 clippy） | C122：`src-tauri/src/wechat_reminders/chats.rs`（`uia_list` 在平台层 `src-tauri/src/win32/`，归 Win 适配，尽量不动；非动不可时先问组长，组长和 `[任务] Win 适配零散` 对过再加）；C123：`src/features/translation/TranslationPanel.tsx,src/features/translation/useTranslationRequest.ts,docs/tasks/D/D104.md` |
| `[C124] 收起条长消息自适应展开` | C124 | 是（cargo + 回归页） | `src/features/messages/CollapsedMessageContent.tsx,src/features/messages/CollapsedMessageContent.css,src/features/messages/island/,src-tauri/src/island/state.rs,tests/regression/collapsed-message-animation.*,tests/regression/snapshots/collapsed-message-animation.html`，另加 `notch.rs`、`geometry.rs`，岛壳收起条样式的文件由会话找到后再加（见下） |

### 顺序

- **第 1 批（并行）**：C127、C122+C123。两个要编译的会话，正好是上限。三者互不依赖，文件不重叠。
- **第 2 批**：C124。UI 外观已确认不重叠；等第 1 批有一个做完（编译和回归页名额）就派。
- C127 的工作量最大（三个源加排序），可能跨好几轮；C122+C123 一轮能完。

### 和 UI 外观的文件重叠（C124）

2026-11-18 问过 `Fuyu-[总控] UI 外观`，回复：**不重叠，C124 可以先做**。它近期只有 C125（#898，闲置贴边的岛叫回来），改 `src/windows/island/useIslandNavigation.ts`、`useIslandTucking.ts`、新文件 `tuckRecall.ts` 和 `tests/unit/tuck-recall.test.mjs`，不碰收起条样式、收起宽度、`messages/`、`state.rs`、`notch.rs`。C124 不要动这四个文件。

Mac 组的 **G1.33**（#725，刘海屏融合）认领范围里有 `src-tauri/src/island/state.rs`、`notch.rs`、`geometry.rs`。2026-11-18 问过 `Fuyu-[总控] Mac 适配`，回复：**G1.33 已改完并合入，只等用户在 Mac 上验收，C124 可以直接认领这三个文件**；用户验收时如果还要改 `notch.rs`，Mac 适配会先找组长协调，不直接动。认领时 `task:claim` 若因 G1.33 的旧范围报重叠，用 `--force`，并在 issue 回复里写明已协调。

C124 的 `--scope` 因此定为：`src/features/messages/CollapsedMessageContent.tsx,src/features/messages/CollapsedMessageContent.css,src/features/messages/island/,src-tauri/src/island/state.rs,src-tauri/src/island/notch.rs,src-tauri/src/island/geometry.rs,tests/regression/collapsed-message-animation.tsx,tests/regression/snapshots/collapsed-message-animation.html`，岛壳收起条样式的文件由任务会话找到后报给组长再加。不碰 C125 的 `useIslandNavigation.ts`、`useIslandTucking.ts`、`tuckRecall.ts`。

### 每个任务怎样算做完

**C127**
- QQ 音乐：按歌名歌手搜到曲目，取 QRC 并解密（魔改 3DES + zlib），转成现有的逐字 LRC（`[行]<字>字…`，和 `krc.rs`、`ttml.rs` 的输出一致，前端 `lrc.ts` 不改）；有翻译时一起出。
- 酷狗本地缓存：只读酷狗客户端本地的 KRC 缓存目录（Windows 先做；Mac 客户端有缓存目录就一起，没有写进文档），按歌名歌手匹配，复用 `krc.rs` 解密。不写、不删别人的文件。
- 网易 yrc：取网易云的逐字 yrc（接口需要 eapi 加密时照上游的做法），解析成逐字 LRC；AMLL 有逐字时仍先用 AMLL。
- 逐字优先：在开着「中文歌词来源」时，几个来源里有逐字的先用逐字，没有再用逐行；顺序规则写进 `lyrics-sources.md`。「中文歌词来源」关着时行为不变（只有 lrclib）。
- 新来源进前端来源列表（`lyricsSources.mjs`），中英文案齐全；改了设置项就跑 `pnpm settings:index`。
- 上游代码只作对照：先看 fly-island 的许可证，照着思路自己写，不整段搬；搬了的在提交说明里写来源。
- 解析（QRC、yrc、本地 KRC 匹配）有 Rust 单元测试，用短样例，不放真实歌词全文。
- 验证：`pnpm heavy -- cargo test`、clippy（含 Windows 交叉）、`pnpm check`、`pnpm build`；`pnpm mq:try` 拿 Windows CI 链接附在报验里。

**C122**
- `open()` 改成：3 秒内每 150～200 毫秒取一次列表，找到目标行且连续两次中心点一致才点；行不在可视区时先滚到可见（UIA `ScrollIntoView`）或继续等；超时返回原来的错误，调用方照旧只唤出微信。
- 不改别的提醒逻辑，不碰 `wechat_reminders` 以外的文件。
- 验证：`cargo test`、clippy、Windows 交叉 clippy，`pnpm mq:try` 的 Windows CI 链接；真机实测留给 Windows（见实测清单）。

**C123**
- 三处 `focus()` 改成 `focus({ preventScroll: true })`，独立窗口和岛上都照样拿到焦点。
- 在 D104 正文加第 5 项「岛上和独立窗口打开翻译页不往下跳」。
- 验证：`pnpm check`、`pnpm build`（没有翻译的回归页，不用跑 `test:regression`）。

**C124**
- 短消息外观不变；长消息先加宽（量实际排版是否被截断，不按字数猜），到上限再换行，超出可滚动；鼠标停在岛上时通知不消失，移开后按原来的剩余时间收。
- 原生的点击区域、窗口尺寸跟着变，折叠态、贴边收起、刘海模式、底边吸附都要看。
- 动效按 `fuyu-motion` 用 `--motion-*` token。
- 回归页覆盖短、长、超长三种消息，快照随提交。
- 验证：`pnpm check`、`pnpm build`、`pnpm test:regression collapsed`、`cargo test` + clippy（含 Windows 交叉）、`pnpm mq:try` 的 Windows CI 链接。

### 只能在 Windows 上实测的（实测清单）

| 项 | 为什么 Mac 上看不了 |
|---|---|
| C122：微信刚唤出、列表还在加载时点提醒，能打开对应会话；目标会话在列表下面、不在可视区时也能打开；超时照旧唤出微信不卡住 | 微信提醒走 Windows UIA |
| C127：酷狗客户端本地缓存的 KRC 能读到（先在酷狗里放一首，再用别的播放器放同一首） | 酷狗本地缓存目录在 Windows 客户端（Mac 客户端如果也有，在 Mac 上一并看） |
| C124：长消息加宽、换行后，岛的点击区域和实际大小一致，岛外的桌面照常能点；刘海、贴边收起下也一样 | 点击穿透区域是 Windows 窗口区域，Mac 上原生行为不同（Mac 上也要看一遍） |
| C123：并进 D104 第 5 项 | 用户验 D104 时一起看 |

QQ 音乐、网易 yrc 是在线接口，Mac 上就能测。

### 做不到的、要开的 issue

- 汽水音乐本地缓存（上游 11c76da9 里也有）：C127 不做，之前的调研结论是拿不到曲目 ID；做 C127 时顺便看上游怎么读汽水缓存，可行再另开 issue。
- 暂时没有要新开的 issue。

### 需要用户定的

- C127 的 QQ 音乐、网易 yrc 是非公开接口（和现在的酷狗、网易一样），挂在现有「中文歌词来源」开关下，不新加开关。默认这样做，用户不同意再改。

### 进度

- [x] C123：0eaac9b7（main 上 9851320f），#908 合入，#902 已关；实测并进 D104 第 5 项
- [x] C122：097feb51、00018a27（main 上 edb401c8、7352cb82），#910 合入，#901 已关；Windows 真机实测待做（清单在任务交接）；会话已归档
- [x] C127：9d9a038b、a66e38d1（main 上 d838c887、740cd66b），#916 合入，#900 已关，会话已归档；汽水本地缓存可行（上游读 LMDB），记在 lyrics-sources.md，要做时另开任务
- 真机实测统一记在 C129（#915，needs user）：C122 的已写好，C127、C124 做完时各自补进对应一节
- [x] C124：main 上 989b538f、98bebcaf、199a623f，#1015 合入，#897 已关，会话已归档
- [x] 收口：第 1 轮全部合入，issue 都已关，任务会话都已归档；剩 C129（#915）真机实测等用户

## 第 2 轮：C133 剪贴板删除按钮和密钥内容（2026-11-19）

功能总控转来（#863，ShengLin1001 提，来自用户群反馈，有录屏）。任务文件在本地提交 147eff55。

### 现状（2026-11-19 看代码）

- **删除入口**：岛上剪贴板的行菜单用公共组件 `src/components/list/RowMenu.tsx`，菜单放在 portal 里，位置按 `window.innerHeight` 算：下面放不下、上面放得下才往上翻；两边都放不下时照旧往下。岛的窗口是透明的大窗口，看得见的面板比窗口小，菜单可能落在面板下面的透明区域，那里的点击会穿透到桌面。这是最可能的原因，要看录屏核对。独立剪贴板窗口（`ClipboardPopupRow.tsx`）的删除入口是另一套，也要查。#847（D105）修的是确认态被 `pointerdown` 提前清掉，和位置无关。
- `RowMenu.tsx` 不只剪贴板在用，文件中转、待办、Agent 会话的行菜单也用它，改了它，这几处都要看一眼。
- **密钥内容**：已经有设置项「密钥和令牌」（`secrets`：打码 / 不记录 / 照常，**默认打码**，打码的条目可以设到时删除）。识别在 `src-tauri/src/clipboard_history/secrets.rs`：常见前缀（`sk-`、`ghp_`、`AKIA`、`AIza`、`hf_` 等）、JWT、私钥、银行卡号、身份证号，以及 32 位以上、大小写字母和数字都有的长串。**故意不算**纯小写 hex，免得把 git 提交号当密钥。智谱 GLM 的 key 是 `<32 位 hex>.<16 位大小写字母数字>`，按现在的规则大概率能认出来，但没有专门的规则，也没有测试；火山方舟的 key 是 UUID 样式，认不出来。
- **E36.3.34**（剪贴板迁成内置插件）已完成，没有进行中的任务占着 `src/features/clipboard/` 或 `clipboard_history/`。

### 计划

一个会话 `[C133] 剪贴板删除按钮点不到和密钥识别`：

- 先修删除入口：在岛上和独立剪贴板窗口里，把最后一行、窗口边缘、面板贴底几种情况都复现一遍；菜单按**看得见的面板**的边界翻转、往里收，上下都放不下时贴边显示，保证整个菜单都能点到。回归页覆盖最后一行的菜单位置；用了 `RowMenu` 的其他几处回归页一起跑。
- 密钥识别按用户的决定改（见下），`secrets.rs` 加对应测试，中英文案齐全。
- `--scope`：`src/components/list/RowMenu.tsx,src/features/clipboard/,src-tauri/src/clipboard_history/secrets.rs,src/i18n/sections/settings/clipboard.ts`，加上剪贴板相关的回归页和快照（具体文件由会话找到后报组长）。
- 验证：`pnpm check`、`pnpm build`、`pnpm test:regression clipboard`；改了 Rust 就再跑 Rust 测试、clippy（含 Windows 交叉）和 `pnpm mq:try`。Windows 上岛面板外的点击穿透写进 C129 的实测清单。
- 「查 GLM 用量能不能不让用户手动复制 key」属于 AI Agent 领域的用量环，C133 不做，转给 `Fuyu-[总控] AI Agent`，由它决定要不要建任务。

### 要用户定

密钥内容怎么处理（推荐 A）。**2026-11-19 用户定：A。**

- **A（推荐）**：保持现有设置（默认打码，可选不记录 / 照常），只补识别规则：GLM 的 `<hex>.<key>` 格式和几家国内厂商的前缀，并加测试。改动小，不会误伤 git 提交号。
- **B**：在 A 的基础上，把 32 位以上的纯 hex 也算作密钥。能多认出一些 key，但 git 提交号、哈希值都会被打码。
- **C**：在 A 的基础上，把默认从「打码」改成「不记录」。更保险，但这些 key 就没法再从历史里粘贴了。

## 第 3 轮：C136 歌词高亮颜色不跟设置走（2026-11-19，插队到 C124、C133 前面）

功能总控转来，用户在 Mac 开发版上反馈（#989）。原因：`src/lib/settings/lyricsSettings.ts` 的 `karaokeLook` 在开着「跟随封面颜色」时把高亮色写成 `var(--cover-accent, <选的颜色>)`，封面色盖过自定义色；设置页预览没有封面色，显示的是自定义色。和 C127、C4c 无关。

**用户定：自定义优先。** 高亮颜色选「自定义」时一律用自定义色；「跟随封面颜色」只在高亮颜色选「文字色」或「主题色」时接管歌词高亮，波形和音乐页光晕照旧跟封面。设置页写明规则。

一个会话 `[C136] 歌词高亮颜色自定义优先`：
- `--scope`：`src/lib/settings/lyricsSettings.ts,src/features/media/lyrics/LyricsKaraokeSettingsSection.tsx,src/i18n/sections/settings/lyrics.ts,tests/unit/lyrics-karaoke.test.mjs,tests/regression/music-lyrics.tsx,tests/regression/snapshots/music-lyrics.html`
- 顺带确认设置窗口改了以后岛上即时生效（跨窗口同步），不生效就一起修。
- 验证：`pnpm check`、`pnpm build`、`pnpm test:regression music settings-search`（改了文案就先 `pnpm settings:index`）。纯前端，不用 Windows CI。

**C136 完成**：3e98d1b6（main 上 917bcc20），#993 合入，#989 已关，会话已归档。跨窗口同步本来就正常，没改。

**C133 完成**：main 上 ed050fd3e（879347bd 和 68a38ed1 合成一个，测试里的密钥样例改成运行时拼接，过了 GitHub 推送保护），#1015 合入，#863 已关，会话已归档。
