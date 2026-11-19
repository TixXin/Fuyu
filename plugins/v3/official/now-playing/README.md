# 换歌提示 · Track change notice

`@fuyu/now-playing` · 浮屿官方插件 · Windows / macOS

换歌时在岛上弹一下歌名和歌手，不用切过去看。

## 怎么用

装好就能用：每次换歌，收起的岛上弹出一条提示，显示歌名、歌手和上一首 / 暂停 / 下一首按钮，6 秒后自己消失。

- 暂停、继续同一首不提示；连续切歌只提示最后停下的那首。
- 岛展开、贴边收起或安静模式时不弹提示（浮屿本身的规则），收起后的下一首照常提示。
- 想马上看一眼现在放的是什么：在「设置 → 插件 → 换歌提示」点「现在提示一次」，或者运行命令「立即提示当前歌曲」（可以在插件详情里给它设快捷键）。

这个插件不在岛上加页面，也不占收起条；浮屿自带的音乐页和收起条照常显示正在播放。

## 设置

在「设置 → 插件 → 换歌提示」里，改了马上生效。

| 设置 | 默认 |
|---|---|
| 换歌时提示 | 开（以前存过「关」的照旧是关） |
| 连续切歌只提示最后一首 | 开 |
| 显示内容：歌名 + 歌手 / 只有歌名 / 歌名 + 歌手 + 专辑 | 歌名 + 歌手 |
| 停留时长：3 / 6 / 10 / 15 秒 | 6 秒 |
| 显示上一首、暂停、下一首按钮 | 开 |
| 提示来自：全部 / 只提示选中的音乐软件 | 全部；放过歌的软件会列出来勾选 |

## 开销和数据来源

- 读取系统里正在播放的歌曲信息（歌名、歌手、专辑、播放软件），和浮屿自带的媒体控制用的是同一份。
- 靠浮屿发的「换歌」事件知道换了歌。收到事件后还会每 15 秒看一次当前播放兜底，防止漏掉一次事件；切歌那一刻读不到歌名时，1.5 秒后再看一次。浮屿还不发这个事件时（旧版本），开着「换歌时提示」就每 2.5 秒看一次；读不到播放信息时放慢到 30 秒。
- 设置和见过的音乐软件名只保存在本机的插件数据目录里。
- 不联网。

---

## English

`@fuyu/now-playing` · Official Fuyu plugin · Windows / macOS

Shows the song title and artist on the island when the track changes.

### How to use it

It works as soon as it is installed: every time the track changes, the collapsed island shows a notice with the title, artist and previous / pause / next buttons, and it goes away after 6 seconds.

- Pausing and resuming the same song does not pop up; when you skip quickly, only the track you stop on is shown.
- No notice pops up while the island is expanded, tucked away or quiet (Fuyu's own rule); the next track after it collapses shows as usual.
- To see what is playing right now, click "Show it now" under Settings → Plugins → Track change notice, or run the "Show the current song" command (you can give it a shortcut in the plugin's details).

The plugin adds no island page and takes no room on the collapsed bar; Fuyu's own music page and collapsed bar still show what is playing.

### Settings

Under Settings → Plugins → Track change notice; changes take effect right away.

| Setting | Default |
|---|---|
| Notify on track change | On (stays off if you turned it off before) |
| When skipping quickly, only show the last track | On |
| Show: title + artist / title only / title + artist + album | Title + artist |
| Stay for: 3 / 6 / 10 / 15 s | 6 s |
| Show previous, pause and next buttons | On |
| Notify for: all / only the ticked music apps | All; apps that have played music are listed to tick |

### Cost and data

- Reads the song information your system reports (title, artist, album, player app), the same information Fuyu's built-in media controls use.
- Learns about track changes from Fuyu's "track changed" event. After that it still checks what is playing every 15 seconds in case an event is missed, and looks again 1.5 seconds later when the title cannot be read right at the change. On older Fuyu versions without the event it checks every 2.5 seconds while "Notify on track change" is on, slowing to 30 seconds while nothing can be read.
- The settings and the names of music apps it has seen are stored only in the plugin's data folder on your computer.
- No network access.

---

## 给开发者 · For developers

- 服务：`commands`、`media/v1`、`messages/v1`
- 插槽：`settings.section/v1`
- 命令：`show`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
