# @fuyu/now-playing

正在播放（Now playing）— 浮屿第 3 版官方插件，支持 Windows 与 macOS。

- 经 `media/v1` 读取当前系统正在播放的曲目并监听切歌变化。
- 在设置分节（`settings.section/v1`）支持开启「换歌时自动提示」（持久化于 `ctx.dataDir`）或点击「立即显示正在播放」，通过 `messages/v1.notify` 在岛上提示歌名与歌手。
