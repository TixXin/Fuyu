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
- [ ] C127：9d9a038b、a66e38d1 已提交，交全局合入；汽水本地缓存可行（上游读 LMDB），记在 lyrics-sources.md，要做时另开任务
- 真机实测统一记在 C129（#915，needs user）：C122 的已写好，C127、C124 做完时各自补进对应一节
- [ ] 第 2 批：C124
- [ ] 收口：提交交全局合入，issue 关闭，归档任务会话
