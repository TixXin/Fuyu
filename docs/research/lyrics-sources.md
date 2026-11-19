# 歌词来源：lrclib、Apple Music 逐字、AMLL TTML DB、汽水音乐

> 日期：2026-11-15。问题：岛的歌词还能从哪些来源取，尤其是逐字（卡拉 OK）歌词；每个来源的接口、授权和风险，能接哪些。范围：GitHub（amll-dev 组织、汽水音乐 / 抖音音乐相关仓库、LDDC）、lrclib.net 的 API 文档、Apple Music 逐字歌词的社区实现和 Apple 开发者论坛；关键词 `syllable-lyrics`、`Music-User-Token`、`AMLL TTML`、`汽水音乐 歌词`。相关任务：C75（#330）。

## 结论

| 来源 | 结论 | 状态 |
|---|---|---|
| lrclib | 开放接口，免费、不要密钥，已在用 | 已接入：关掉「中文歌词来源」时是唯一的在线来源，开着时排在酷狗、网易云后面兜底（英文歌排第一） |
| Apple Music 逐字（在线） | 只有未公开接口，要开发者令牌加用户订阅令牌 | **不接** |
| 本地 `.ttml` 文件 | Apple / AMLL 风格的逐字 TTML，用户自己放进歌词文件夹 | **已接入**（C75） |
| AMLL TTML DB | 社区逐字歌词库，提交者写的部分 CC0，按平台曲目 ID 直链取文件，欢迎第三方接入 | **已接入**（用户 2026-11-15 定）：知道网易云曲目 ID 时先取它的逐字歌词，没有再用网易云的逐行歌词；在「中文歌词来源」开关下 |
| 汽水音乐 | 没有公开或社区维护的歌词接口；也拿不到汽水的曲目 ID | **这次不做**，另开 issue 记录（C127 复看：读客户端本地缓存可行，见下文） |
| QQ 音乐 QRC | 匿名接口，逐字歌词用 QQ 魔改的 3DES 加密 | **已接入**（C127，2026-11-18） |
| 网易云逐字 yrc | `/api/song/lyric/v1` 带 `yv=-1` 就回 `yrc`，只要 Referer，不要 eapi | **已接入**（C127） |
| 酷狗客户端本地 KRC 缓存 | 只读本机文件，不联网 | **已接入**（C127，只有 Windows） |

建议：
1. 想要逐字歌词又不想依赖不稳定接口的用户，用本地歌词文件夹放 `.ttml`（AMLL TTML Tool 导出、或从 AMLL TTML DB 下载）。
2. lrclib 的 v1 接口现在每条记录都带 `lyricsfile`（YAML），`hasWordSync` 为真时含逐字时间。可以另开任务把 lrclib 的逐字也接进来（要解析 YAML，仓库里还没有 YAML 依赖）。

## 详细

### lrclib（已接入，核实现状）

- 代码：`src-tauri/src/lyrics/lrclib.rs`，请求 `https://lrclib.net/api`，`User-Agent` 写明 `Fuyu/<版本> (https://github.com/TixXin/fuyu)`。
- 来源顺序（`src-tauri/src/lyrics/mod.rs` 的 `source_order`，2026-11-18 起 C127 加了 QQ 音乐）：
  - 「中文歌词来源」关（默认）：只有 lrclib。
  - 开着、歌名或歌手含汉字：酷狗 → QQ 音乐 → 网易云 → lrclib。
  - 开着、不含汉字：lrclib → 酷狗 → QQ 音乐 → 网易云。
  - 开着、InfLink 给了网易云曲目 ID：网易云 → 酷狗 → QQ 音乐 → lrclib。
- 逐字优先（C127）：开着「中文歌词来源」时按上面的顺序问，某个来源给了逐字歌词就用它、不再往下问；给的只是逐行歌词时先记下，继续问后面的来源，问完都没有逐字才用第一个逐行结果。所以 lrclib 排第一的英文歌，lrclib 有歌词也会再问酷狗、QQ 音乐、网易云。关着时照旧：lrclib 有就用。
- 在问在线来源之前（也在读岛自己的在线缓存之前），开着「中文歌词来源」时先读酷狗客户端的本地缓存（见下文），找到就用，来源记为 `kugou-local`。
- 所以 #330 验收里「lrclib 作为默认可用的来源接进现有的来源顺序」已经满足。
- 接口条件（lrclib 文档，2026-11-15 查）：不要密钥；按 IP 限流，带应用名的 `User-Agent` 约 90 次 / 分钟，不带约 45 次 / 分钟；可以选择注册应用拿更高额度。歌词由社区上传，文档没写歌词数据的授权条款（未核实）。
- 新变化：v1 记录多了 `lyricsfile`（YAML）和 `hasWordSync`，带逐字时间的记录可以直接用于卡拉 OK；另有 beta 的 `/api/v2/search`（只返回元数据）。我们现在只读 `syncedLyrics`（逐行）。

### Apple Music 逐字（在线接口：不接）

- 接口：`GET https://amp-api.music.apple.com/v1/catalog/{店面}/songs/{id}/syllable-lyrics`，返回 TTML。没有出现在 Apple Music API 的公开文档里，社区实现（LyricaAME-py、MusanovaKit）都称它为私有接口。
- 要两个令牌：`Authorization: Bearer <开发者令牌>`（社区做法是从 music.apple.com 网页里抓），和 `Music-User-Token`（用户自己的 Apple Music 订阅登录后的令牌）。Apple 开发者论坛有帖子说 Apple 已给网页版的令牌加了来源校验。
- 风险：接口随时可能变；抓网页令牌违反 Apple 的使用条款的可能性高；岛要保存用户的账号令牌，出了问题影响用户的 Apple 账号。
- 结论：不接。替代做法是本地 `.ttml`（下一节）和 AMLL TTML DB。

### 本地 `.ttml`（已接入）

- 歌词文件夹里的 `.ttml` 和 `.lrc` 用同一套文件名匹配（`歌手 - 歌名`、`歌名 - 歌手`、`歌名`），同名的两个都在时先用 `.ttml`，`.ttml` 解析不出歌词时回落到 `.lrc`。
- 解析（`src-tauri/src/lyrics/ttml.rs`，用已有的 `quick-xml` 依赖）：
  - 每个 `<p>` 一行；带 `begin` 的 `<span>` 是一个字 / 词，输出成现有的逐字 LRC：`[行开始]<字开始>字<下一个字开始>…<行结束>`，前端 `lrc.ts` 的卡拉 OK 直接能用，前端不用改。
  - 两个字之间有空隙时插一个结束标记，前端据此让上一个字在它真正结束的时候填满。
  - 只有行时间（`itunes:timing="Line"`）的 `<p>` 输出成普通 LRC 行；没有时间的行跳过。
  - 翻译：行内的 `<span ttm:role="x-translation">`，或 Apple 文件头里的 `<translations><translation><text for="L1">`（按 `itunes:key` 对应，有多种语言时取第一种），输出到翻译 LRC。
  - 音译（`x-roman`）和背景人声（`x-bg`）不显示，也不会混进主歌词。
  - 一行结束到下一行开始超过 4 秒时补一个空行，岛在间奏时不停在上一句。
  - 时间格式支持 `mm:ss.mmm`、`hh:mm:ss.mmm`、`12.5s`、`250ms`。

### AMLL TTML DB

- 仓库：[amll-dev/amll-ttml-db](https://github.com/amll-dev/amll-ttml-db)（2026-11-15：483 star，当天还有提交；原仓库 Steve-xmh/amll-ttml-db 已迁到 amll-dev 组织）。
- 授权：README「共享协议」一节：提交者自己写的部分（分词、时间轴、翻译）用 CC0 1.0；外来数据部分遵循原数据提供方的协议。歌词文本本身的版权属于词作者，这一点和酷狗、网易云、lrclib 一样。README 欢迎第三方接入，希望（不强制）展示仓库链接或歌词作者。
- 访问：按平台的曲目 ID 取直链 `https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/<平台文件夹>/<ID>.<后缀>`，平台文件夹有 `ncm-lyrics/`（网易云，主要来源）、`qq-lyrics/`、`am-lyrics/`、`spotify-lyrics/`；后缀有 `.ttml`、`.lrc`、`.yrc`、`.qrc`、`.lys`、`.eslrc`。作者镜像 `https://amll-ttml-db.stevexmh.net/ncm/<ID>`，另有几个社区镜像。
- 没有按歌名搜索的接口。全部元数据在 `metadata/raw-lyrics-index.jsonl`（约 1.7 MB）和各平台文件夹的 `index.jsonl`，要按歌名匹配得自己下载这些索引。
- 质量：只对网易云 ID 对应的音频保证时间轴；README 明确不收直接搬运的 Apple Music TTML。实测一首（网易云 2048982668）是逐字 + 中文翻译，格式和 `ttml.rs` 的测试样例一致。
- 能用的场景：岛只在两种情况下知道网易云 ID——InfLink 给的 `NCM-<ID>`，以及网易云搜索已经找到的歌。别的播放器（Spotify、Apple Music、QQ 音乐）的曲目 ID 现在拿不到。
- 风险：`raw.githubusercontent.com` 在国内常常慢或连不上，要短超时并回落；路径结构是 README 写明给下游用的，算稳定。
- 接入方式（用户 2026-11-15 定「按建议接」，代码在 `src-tauri/src/lyrics/amll.rs`，从 `netease.rs` 调用）：
  - 只在知道网易云 ID 时用：InfLink 给的 `NCM-<ID>`，或网易云搜索找到的歌。拿到 ID 后同时请求 AMLL 的 `ncm-lyrics/<ID>.ttml` 和网易云的歌词接口，AMLL 有能解析的逐字歌词就用它（含翻译），404、超时（4 秒）、解析不出时用网易云的逐行歌词；AMLL 失败不影响网易云的结果。
  - 因为要靠网易云 ID，挂在现有「中文歌词来源」开关下，没有新开关，前端不变；结果的来源仍记为 `netease`。
  - 来源顺序不变：开着开关时，InfLink 给了网易云 ID 的歌先走网易云（于是先走 AMLL）；含汉字的歌先走酷狗（酷狗本身就有逐字），找不到再到网易云。
  - 缓存：已经缓存的网易云逐行歌词不会因此重新下载，过期或清缓存后才会换成 AMLL 的。

### 汽水音乐（这次不做）

- 汽水音乐（抖音音乐，字节跳动）没有公开的歌词接口，也没有社区维护的歌词库或稳定实现：
  - 常用的歌词工具 LDDC（1.9k star）只支持 QQ 音乐、酷狗、网易云和 lrclib。
  - GitHub 上只有两三个个人项目（个位数 star）：一个油猴脚本，一个 MusicFree 插件。后者靠解析汽水分享页 / 歌曲页（`music.douyin.com/qishui/song/<track_id>`）拿逐字歌词，「搜索」只能返回热歌榜和推荐榜的 28 首，不能按歌名查。
- 岛拿不到汽水的曲目 ID（Windows 媒体会话里没有），没有按歌名搜索的路子；自己逆向字节系接口维护成本高、随时会被风控。
- 结论：这次不做；以后出现稳定的社区实现或公开接口再看。主 agent 据此开 issue。

### QQ 音乐 QRC（C127 已接入）

- 代码：`src-tauri/src/lyrics/qq.rs`（搜索和取歌词）、`qrc.rs`（解密和解析）。
- 搜索：`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=<歌名 歌手>&format=json`，`data.song.list[]` 里有 `songmid`、`songname`、`singer[].name`、`interval`（秒），按歌名、歌手、时长和现有来源一样匹配（`matching::same_track`）。
- 歌词：`https://u.y.qq.com/cgi-bin/musicu.fcg?data=<JSON>`，模块 `music.musichallSong.PlayLyricInfo`、方法 `GetPlayLyricInfo`，参数 `songMid`、`qrc: 1`、`crypt: 1`、`trans: 1`。要 Referer `https://y.qq.com/`，不要登录。2026-11-18 在 Mac 上实测《晴天》能取到。
- 加密：`lyric`、`trans` 是十六进制。解法是 3DES（先用 `!@#)(NHL` 解密、再用 `123ZXC!@` 加密、再用 `!@#)(*$%` 解密），但不是标准 DES：每 8 字节按两个小端 32 位读写；子密钥取 PC2 右半时错一位；S 盒 2、4 各有一个值不同。解出来再 zlib 解压。用别的项目公开的测试向量核对过。
- 格式：XML 里 `LyricContent` 属性是正文，每行 `[行开始,行时长]字(开始,时长)字(开始,时长)`，时间是绝对毫秒、写在字后面；转成和酷狗一样的逐字 LRC。没有 QRC 的歌解出来是普通 LRC，按逐行用。翻译 `trans` 是 LRC，按时间对上行，`//` 当作没有翻译。
- 不知道 QQ 音乐的曲目 ID 时只能按歌名搜；以后播放器能给 `QQ-<songmid>` 时可以跳过搜索。

### 网易云逐字 yrc（C127 已接入）

- 代码：`src-tauri/src/lyrics/netease.rs`。歌词接口换成 `https://music.163.com/api/song/lyric/v1`，比原来多带 `yv=-1&ytv=-1&yrv=-1`；它失败时回落到原来的 `/api/song/lyric`。
- 2026-11-18 实测：有逐字歌词的歌回 `yrc`（和逐字翻译 `ytlrc`），只要 Referer，**不需要 eapi 加密**；没有逐字的歌（例如《晴天》）只回 `lrc`。
- `yrc` 每行 `[行开始,行时长](开始,时长,0)字(开始,时长,0)字`，时间是绝对毫秒、写在字前面；开头几行是 JSON 的署名，跳过。
- 顺序：AMLL TTML DB 有逐字时仍先用 AMLL，其次 yrc，最后逐行 `lrc`。

### 酷狗客户端本地 KRC 缓存（C127 已接入，只有 Windows）

- 代码：`src-tauri/src/lyrics/kugou_cache.rs`。只读，不写、不删酷狗的文件。
- 目录：先读 `%APPDATA%\KuGou8\KuGou.ini` 的 `LyricPath=`（UTF-8 或 UTF-16，限 64 KiB），再看 `%SystemDrive%\KuGou\Lyric`。
- 文件名形如 `歌手 - 歌名-<32 位十六进制>-<十六进制>….krc`，按文件名的歌名歌手先挑（最新的 6 个），再解密（和在线 KRC 同一套，只是没有 base64），用文件头 `[ti:]`、`[ar:]`、`[total:]` 再核对歌名、歌手和时长，对不上就跳过。单个文件限 2 MiB。
- Mac 上本机没有装酷狗，没有找到 Mac 客户端的缓存目录，暂不支持；`APPDATA`、`SystemDrive` 不存在时直接跳过。

### 汽水音乐本地缓存（C127 复看，没做）

- 上游 fly-island（11c76da9）读的是汽水客户端的 `%APPDATA%\SodaMusic\LunaCacheV2\entries.db`：一个 LMDB 库，值是 msgpackr 编码，`info.mediaDetail.lyrics` 里是明文 KRC 或 LRC。上游复制一份快照再只读解析，不调用 LMDB 的写接口。
- 可行，但要自己写只读的 LMDB 页解析和 msgpackr 解码（上游约 400 行），格式随客户端版本可能变。值得做时另开任务。

## 来源

- lrclib API 文档：https://lrclib.net/docs （Markdown 版 https://lrclib.net/docs.md）
- AMLL TTML DB：https://github.com/amll-dev/amll-ttml-db ，README 的「接入到其他项目」「共享协议」两节
- AMLL TTML 格式规范：https://github.com/amll-dev/amll-ttml-db/wiki
- 上游 fly-island 的 11c76da9、85269c87（GPL-3.0，只看思路，代码自己写）：https://github.com/flyl1u/fly-island/commit/11c76da9
- Apple Music 私有逐字接口的社区实现：https://codeberg.org/willooper/LyricaAME-py ，https://github.com/rryam/MusanovaKit
- Apple 开发者论坛，网页版令牌被滥用的讨论：https://developer.apple.com/forums/thread/702228
- Apple Music API 用户令牌文档：https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit
- LDDC：https://github.com/chenmozhijin/LDDC
- 汽水音乐的个人项目：https://github.com/zaoqiu2/douyin-lyric-plugin ，https://github.com/AP201923/tampermonkey-scripts
