# 音乐平台的名字、识别和图标

换歌提示的卡片、音乐页和音乐设置里显示的播放软件名字和图标从哪来，哪些平台核对过。任务 E66.12（卡片）、E66.13（国内和国际主流平台）。

## 怎么认出一个播放软件

1. **标识**：系统报给浮屿的来源标识。Windows 上是进程名（`cloudmusic.exe`）或应用标识（`SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify`），Mac 上是包名（`com.netease.163music`），读不到歌名时是出声进程的应用名（`汽水音乐`）。
2. **名字表**：`src-tauri/src/media_control/players.rs` 的 `KNOWN_PLAYERS`，标识里含某个词就算这个播放软件，得到一个固定的名字（`NetEase Music`）。这个名字还用来比对「是不是同一个应用」和存进 `fuyu-music-sources`，所以不改已有的名字，只往后面加词；每项的第一个词还会拼成网页播放器的来源标识，不能动。
3. **按语言显示**：`src/features/media/playerNames.ts` 把名字表的名字换成界面语言的写法，卡片顶上、音乐页、音乐来源列表和「添加播放器」的候选都用它。
4. **兜底**：名字表不认识的，Mac 上取应用包自己的名字（`汽水音乐.app` → 汽水音乐），由命令 `get_media_source_app` 给出；再没有就显示标识本身。
5. **图标**：同一个命令按标识找到应用再取它的图标。Mac 按包名找（找不到再按应用名找正在运行的），Windows 按进程名找正在运行的进程。找不到时卡片上用专辑封面或音符。

Windows 上「按进程名找」的规则（`source_app.rs`，E66.15）：从来源标识里取一个词，进程名要和它相等，或者两者一个是另一个的开头且不少于 5 个字。商店版应用的标识形如 `包名_发布者!应用`，`!` 后面是 `App` 这类通用词时改用包名的最后一段（`AppleInc.AppleMusicWin_…!App` → `applemusicwin`，能对上 `AppleMusic.exe`）。对不上就没有图标，也不算「在最前面」，不会拿别的程序顶替。

换歌提示插件（`plugins/v3/official/now-playing`）的「只提示选中的」列表在插件自己的设置页里，读不到浮屿的名字表，所以在 `src/model.ts` 里另有一张小表：下面两类主流平台，加上有中文名的几个第三方客户端。给一个平台加中英文名时两处都要加。

## 核对过的平台

「测试」指 `players_tests.rs` 里有这个标识的断言。「来源」是标识从哪知道的。

### 国内主流

| 平台 | 中文 / 英文名 | Windows 标识 | Mac 包名 | Mac 包名的来源 |
|---|---|---|---|---|
| 网易云音乐 | 网易云音乐 / NetEase Cloud Music | `cloudmusic.exe` | `com.netease.163music` | 本机实测 |
| QQ 音乐 | QQ音乐 / QQ Music | `QQMusic.exe` | `com.tencent.QQMusicMac` | Homebrew 清单 |
| 酷狗音乐 | 酷狗音乐 / KuGou Music | `KuGou.exe` | `com.kugou.mac.Music` | 第三方应用库，没在真机上核对 |
| 酷我音乐 | 酷我音乐 / Kuwo Music | `kwmusic.exe` | 没查到 | 包名里有 `kuwo` 就能认出 |
| 汽水音乐 | 汽水音乐 / Soda Music | `SodaMusic.exe` | `com.soda.music` | 本机实测 |
| 咪咕音乐 | 咪咕音乐 / Migu Music | `MiguMusic.exe` | 没查到 | 认不出时靠兜底取应用名 |

### 国际主流

| 平台 | 名字 | Windows 标识 | Mac 包名 | Mac 包名的来源 |
|---|---|---|---|---|
| Spotify | Spotify | `Spotify.exe`、`SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify` | `com.spotify.client` | Homebrew 清单 |
| Apple Music | Apple Music | `AppleInc.AppleMusicWin_nzyj5cx40ttqa!App` | `com.apple.Music` | 本机实测 |
| iTunes | iTunes | `iTunes.exe`、`AppleInc.iTunes_nzyj5cx40ttqa!iTunes` | 无 | |
| YouTube Music（th-ch 版） | YouTube Music | `YouTube Music.exe` | `com.github.th-ch.youtube-music` | 第三方应用库 |
| YouTube Music Desktop App | YouTube Music | `YouTube Music Desktop App.exe` | `app.ytmd` | Homebrew 清单 |
| Amazon Music | Amazon Music | `Amazon Music.exe` | `com.amazon.music` | Homebrew 清单 |
| TIDAL | TIDAL | `TIDAL.exe` | `com.tidal.desktop` | Homebrew 清单 |
| Deezer | Deezer | `Deezer.exe` | `com.deezer.deezer-desktop` | Homebrew 清单 |
| Qobuz | Qobuz | `Qobuz.exe` | `com.qobuz.QobuzDesktop` | Homebrew 清单 |

Windows 的进程名和应用标识是按各平台的安装包和已有的名字表写的，没有在 Windows 真机上逐个核对。

## 封面

封面是系统给的，浮屿不自己去下载。

- 网易云音乐（Mac）：系统的播放信息里带封面（本机读到一张约 4 KB 的 JPEG）。
- 汽水音乐（Mac）：2026-11-19 的真岛截图里卡片左边是软件图标，说明当时没拿到封面；它在 Mac 上报给系统的信息一直不全（见 G1.35），没有再查是不是每首都没有。
- 其余平台没有实测。

## 已知问题

- Mac 上浮屿自己播放提示音时，系统的「正在播放」曾被它占走：读到的来源变成 `com.apple.WebKit.GPU`、歌名是「Fuyu」，音乐页和换歌提示暂时读不到歌名。原因是提示音用音频元素播放，WebKit 把它登记成「正在播放」。G1.36 把 Agent 音效和计时器到点改用 Web Audio（`src/lib/sound/playSound.ts`）后不再发生；以后在 WebView 里加会响的东西都用它，不用 `new Audio()`。
- 岛屿实验台的「插件通知」按钮发的是没有人接的旧事件，点了岛上不会出现提示（2026-11-19 发现，没有修）。

### 本地播放器（E66.17）

| 播放器 | 名字 | Windows 标识 | Mac 包名 | Mac 包名的来源 |
|---|---|---|---|---|
| foobar2000 | foobar2000 | `foobar2000.exe` | `com.foobar2000.mac` | Homebrew 清单 |
| MusicBee | MusicBee | `MusicBee.exe` | 无 | |
| AIMP | AIMP | `AIMP.exe` | 无 | |
| VLC | VLC | `vlc.exe` | `org.videolan.vlc` | Homebrew 清单 |
| IINA | IINA | 无 | `com.colliderli.iina` | Homebrew 清单 |
| PotPlayer | PotPlayer | `PotPlayerMini64.exe` | 无 | |
| Windows Media Player | Windows Media Player | `wmplayer.exe` | 无 | |
| Groove 音乐 | Groove 音乐 / Groove Music | 标识里带 `zune` 或 `groove` | 无 | |
| Swinsian | Swinsian | 无 | `com.swinsian.Swinsian` | Homebrew 清单 |
| Audirvana | Audirvana | 没核对 | `com.audirvana.Audirvana` | Homebrew 清单 |
| VOX | VOX | 无 | `com.coppertino.Vox` | Homebrew 清单 |
| Clementine | Clementine | 没核对 | `org.clementine-player.clementine` | Homebrew 清单 |
| DeaDBeeF | DeaDBeeF | 没核对 | `com.deadbeef.deadbeef` | Homebrew 清单 |
| Doppler、Cog、Pine Player | 同名 | 无 | 没查到 | 认不出时靠兜底取应用名 |

### 第三方和自建曲库客户端（E66.17）

| 播放器 | 中文 / 英文名 | Windows 标识 | Mac 包名 | Mac 包名的来源 |
|---|---|---|---|---|
| 洛雪音乐 | 洛雪音乐 / LX Music | `lx-music-desktop.exe` | `cn.toside.music.desktop` | 项目的打包配置，没在真机上核对 |
| YesPlayMusic | YesPlayMusic | `YesPlayMusic.exe` | `com.electron.yesplaymusic` | Homebrew 清单 |
| Listen 1 | Listen 1 | `Listen1.exe` | `com.listen1.listen1` | Homebrew 清单 |
| Plexamp | Plexamp | `Plexamp.exe` | `tv.plex.plexamp` | Homebrew 清单 |
| Roon | Roon | `Roon.exe` | `com.roon.Roon` | Homebrew 清单 |
| 椒盐音乐 | 椒盐音乐 / Salt Player | `SaltPlayer.exe` | 无 | |
| 海贝音乐 | 海贝音乐 / HiBy Music | `HiByMusic.exe` | 无 | |
| 音流 | 音流 / Stream Music | `streammusic.exe` | 没查到 | |
| 铜钟 | 铜钟 / Tongzhong | `tongzhong.exe` | 没查到 | |
| 飞牛音乐 | 飞牛音乐 | `xtMusic.exe`、`fnmusic.exe` | 没查到 | |
| Feishin、Cider、MusicFree、SPlayer、Supersonic、Sonixd、Aonsoku、Spotube | 同名 | 进程名同名 | 没查到 | 认不出时靠兜底取应用名 |

Mac 包名「没查到」的是 Homebrew 清单里没有、也没有装在本机的。它们的包名里只要带名字表里的词就能认出，否则走兜底。

## 还没做的

- 名字表里其余的播放器（Winamp、MediaMonkey、Strawberry、Tauon 等）没有逐个核对。
- 换歌提示插件设置里的软件列表靠插件自己的小表，表里没有的取包名里靠后的一段（跳过 mac、desktop 这类通用词），所以 `org.videolan.vlc` 显示成 vlc。要和岛上一样，得让浮屿把名字随播放信息一起给插件，还没做。
