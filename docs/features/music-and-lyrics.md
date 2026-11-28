# 音乐控制与同步歌词

音乐与歌词由内置插件 `music` 提供，负责读取系统正在播放的媒体、展示封面与音频波形、在岛上和收起条同步显示逐行或逐字歌词，并向第三方插件提供 `media/v1` 与 `lyrics/v1` 服务。播放器名称与图标对照见 [music-players.md](music-players.md)，平台差异见 [platforms.md](../architecture/platforms.md)。

## 媒体控制（`media/v1`）

- **系统接入**：Windows 通过 SMTC（`SystemMediaTransportControls`）读取曲目、封面、进度与播放状态；macOS 通过系统媒体接口读取，支持播放/暂停、上一首、下一首与进度跳转。
- **多播放器优先级与自定义播放器**：自动记住近期活跃的播放器（`fuyu-music-sources`），支持手动调整优先级；对不提供 SMTC 的播放器，可在设置中手动添加自定义播放器（`media-custom-players.json`）。
- **封面取色与波形**：可开启封面主色联动（波形、逐字高亮与音乐页光晕跟随专辑封面色）；音乐页及收起条均支持实时音频波形。

## 同步歌词（`lyrics/v1`）

- **本地歌词**：可指定本地歌词文件夹，支持标准 `.lrc` 与逐字 `.ttml`（Apple / AMLL 风格）。
- **在线歌词来源**：默认关闭，开启后依次支持 LRCLIB，以及可选中文来源（酷狗、网易云 / AMLL TTML DB、QQ 音乐与本地酷狗缓存）；另可选启用 Apple Music 官方歌词（需在设置中保存 `media-user-token`，密钥存系统凭据 `com.tixxin.fuyu.apple-music`）。结果缓存于家目录 `lyrics-cache/`。
- **收起条歌词与逐字卡拉 OK**：可选在收起条显示当前歌词、调整逐字高亮样式（平滑 / 逐字、高亮颜色、暗度与发光），以及第一句开始前的占位内容（待办 / 歌名 / 音符）；支持为单首歌曲微调 ±10 秒歌词偏移（`fuyu-lyrics-offsets`）。
- **岛上歌词不显示时说明原因**：「在收起的岛上显示当前歌词」开着时，说明文字改写成挡住歌词的那一项（「显示折叠岛屿文字」关着、「文字的先后」里歌词关着、没有歌词来源、贴合刘海时设成「不显示」或收在「+N」里）；这个开关关着时，「文字的先后」和「刘海屏上的文字」里的歌词一行写明要先去音乐设置打开（D133）。
- **InfLink-rs 一键安装（Windows）**：针对网易云音乐提供 InfLink-rs 补丁一键下载安装（经共享国内镜像 `system/download_mirrors.rs` 与 SHA-256 校验，实现于 `src-tauri/src/lyrics/inflink.rs`），用于向系统媒体会话上报精确曲目 ID 与进度。

## 扩展与实现

- **对外服务与接缝**：提供 `media/v1`（`nowPlaying`、`playPause`、`next`、`previous`、`seek`、`changed` 事件）、`lyrics/v1`（`lookup`、`sources`）及歌词来源接缝 `lyrics.sources`（见 [services-and-slots.md](../plugins/services-and-slots.md)）。
- **实现位置**：Rust 侧在 `src-tauri/src/media_control/` 与 `src-tauri/src/lyrics/`，前端在 `src/features/media/`。
