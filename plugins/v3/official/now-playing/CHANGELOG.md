# 更新记录 · Changelog

## 1.2.0

- 默认停留 3 秒（原来 6 秒）。以前没改过时长的会变成 3 秒，自己选过 10 秒或 15 秒的不变；想要 6 秒在设置里再选一次。
- 新开关「播放软件在最前面时不提示」，默认开：你正看着播放软件时不再弹。
- 浏览器里播放的默认不提示（网页视频也会被系统当成换歌），在设置的「音乐软件」里可以打开。
- 「只提示选中的」列表里，网易云音乐、QQ音乐、酷狗、酷我、汽水音乐、咪咕音乐和 Spotify、Apple Music、YouTube Music、Amazon Music、TIDAL、Deezer、Qobuz 显示各自的名字，不再是包名的一截。
- 市场页有了截图，补了搜索关键词。
- 新版浮屿上，提示会显示专辑封面、播放软件的图标和名字，点提示打开岛的音乐页；岛上正显示 Agent 提示或聊天消息时不弹。这些由浮屿提供，0.3.11-beta.4 及更早的版本上提示还是原来的样子。

- Notices now stay for 3 seconds by default (was 6). If you never changed it, it becomes 3 seconds; a choice of 10 or 15 seconds is kept, and you can pick 6 again in the settings.
- New switch "Skip it while the player is the front app", on by default: no notice while you are looking at the player.
- Playback in browsers no longer notifies by default (the system reports web videos as track changes too); turn it on under "Music apps" in the settings.
- In the "only the ticked ones" list, NetEase Cloud Music, QQ Music, KuGou, Kuwo, Soda Music, Migu Music, Spotify, Apple Music, YouTube Music, Amazon Music, TIDAL, Deezer and Qobuz show their own names instead of a piece of the package id.
- The market page now has a screenshot, and the plugin lists search keywords.
- On newer Fuyu versions the notice shows the album cover and the player's icon and name, clicking it opens the island's music page, and it stays out of the way while the island is showing an agent notice or a chat message. Fuyu provides these; on 0.3.11-beta.4 and earlier the notice looks as before.

## 1.1.1

- 切歌那一刻读到「在放但没有歌名」时，1.5 秒后再读一次，不会因此漏掉这首。
- 收到浮屿的换歌事件后，不再完全停止查看，改成每 15 秒看一次兜底，漏掉一次事件也不会很久不更新。
- 说明：浮屿现在的版本里，插件在后台发的提示还到不了岛上（平台问题，另行修复），修好之前换歌提示仍可能看不到。
- 图标换成和浮屿设置一致的风格：浅底色加同色线条。

- When the title cannot be read right at a track change, the plugin looks again 1.5 seconds later instead of missing that track.
- After Fuyu's track change events start arriving, it no longer stops checking altogether: it checks every 15 seconds in case an event is missed.
- Note: in current Fuyu versions, notices sent by plugins in the background do not reach the island yet (a platform issue being fixed separately), so track change notices may still not appear until then.
- New icon in the same style as Fuyu's settings: a tinted tile with a line glyph in the same color.

## 1.1.0

改名「换歌提示」，换歌时默认就提示，设置补完整。

- 名字从「正在播放」改成「换歌提示」：浮屿自带音乐页和收起条，这个插件只管换歌时在岛上弹一下。插件 id 不变。
- 「换歌时提示」新装默认打开。以前存过「关」的照旧是关，打开一次就行。
- 修好换歌不弹：原来等的「换歌」事件浮屿还没有发，打开开关后只靠轮询，开关又默认关。现在先等事件，浮屿发了就不再轮询；没发之前每 2.5 秒看一次，读不到播放信息时放慢到 30 秒。
- 暂停、继续同一首不再算换歌；暂停时切到的歌不提示。
- Mac 上有的播放器（例如汽水音乐）报给系统的播放状态不准：读到的歌名常被标成「暂停」，另一份「在放」的读数又没有歌名，原来因此一直不弹。现在只要几秒内确实有声音在放，换了歌名就照样提示；「只提示最后一首」也不再因为复查时读不到歌名而作废。
- 新设置：停留时长（3 / 6 / 10 / 15 秒，默认 6）、显示内容（歌名 + 歌手 / 只有歌名 / 加上专辑）、显示上一首 / 暂停 / 下一首按钮（开）、连续切歌只提示最后一首（开）、只对选中的音乐软件提示（默认全部）。
- 设置改了马上生效。
- 提示带上音乐图标。
- 命令「立即提示当前歌曲」接上了，可以在插件详情里设快捷键；修好原来的英文「Show now playing now」。
- 岛展开、贴边收起或安静模式时，浮屿本身不显示插件的提示，这一点写进了设置说明。

Renamed to Track change notice; it now notifies by default and has full settings.

- Renamed from "Now playing" to "Track change notice": Fuyu has its own music page and collapsed bar, so this plugin just pops up a notice when the track changes. The plugin id is unchanged.
- "Notify on track change" is on for new installs. If you had turned it off before, it stays off; turn it on once.
- Fixed track changes not showing: the "track changed" event the plugin waited for is not sent by Fuyu yet, so with the switch on it only polled, and the switch was off by default. It now listens for the event and stops polling once Fuyu sends it; until then it checks every 2.5 seconds, slowing to 30 seconds while nothing can be read.
- Pausing and resuming the same song no longer counts as a change, and a track that changes while paused does not pop up.
- Some Mac players (Soda Music, for example) report their state badly: the reading with the song title often says paused, while the reading that says playing has no title, so nothing ever popped up. Now a new title pops up as long as sound was actually playing in the last few seconds, and "only the last track" no longer drops the notice when a second look cannot read the title.
- New settings: how long it stays (3 / 6 / 10 / 15 seconds, 6 by default), what it shows (title and artist / title only / plus album), previous / pause / next buttons (on), only the last track when skipping quickly (on), and only selected music apps (all by default).
- Settings take effect as soon as you change them.
- The notice has a music icon.
- The "Show the current song" command now works, so you can give it a shortcut in the plugin's details; the old English label "Show now playing now" is fixed.
- Fuyu does not show plugin notices while the island is expanded, tucked away or quiet; the settings now say so.

## 1.0.0

首个版本。

First release.
