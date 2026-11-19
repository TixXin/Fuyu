# 正在播放 · Now playing

`@fuyu/now-playing` · 浮屿官方插件 · Windows / macOS

在岛上弹一条提示，告诉你现在放的是什么歌、谁唱的。可以手动看一下，也可以每次换歌时自动提示。

## 装好后在哪里

- **设置 → 插件**：「正在播放」分节。

这个插件不在岛上加页面，提示以岛上弹出的消息出现。

## 怎么用

- 点「立即显示正在播放」，岛上马上弹出当前的歌名和歌手；没有在放歌时会告诉你。
- 打开「换歌时自动提示」，之后每次切歌都会自动弹出。

插件还带一个命令「立即显示正在播放」，可以在「设置 → 插件」的插件详情里给它设快捷键。

## 设置

- **换歌时自动提示**：默认关闭。

## 它会用到什么

- 读取系统里正在播放的歌曲信息（歌名、歌手），和浮屿自带的媒体控制用的是同一份信息。
- 在岛上弹出提示。
- 开关状态只保存在本机的插件数据目录里。
- 不联网。

---

## English

`@fuyu/now-playing` · Official Fuyu plugin · Windows / macOS

Shows the title and artist of the song that is playing in a notification on the island, either when you ask or every time the track changes.

### Where it shows up

- **Settings → Plugins**: a "Now playing" section.

It adds no page to the island; the song appears as a notification on the island.

### How to use it

- Click "Show now playing now" and the island shows the current title and artist right away (or tells you nothing is playing).
- Turn on "Notify on track change" to get a notification every time the song changes.

The plugin also has a "Show now playing" command; give it a shortcut in the plugin's details under Settings → Plugins.

### Settings

- **Notify on track change**: off by default.

### What it uses

- Reads the song information your system reports (title and artist), the same information Fuyu's built-in media controls use.
- Shows notifications on the island.
- The setting is stored only in the plugin's data folder on your computer.
- No network access.

---

## 给开发者 · For developers

- 服务：`media/v1`、`messages/v1`
- 插槽：`settings.section/v1`
- 命令：`show`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
