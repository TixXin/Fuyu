# 闹钟 · Alarm

`@fuyu/alarm` · 浮屿官方插件 · Windows / macOS

设置多个单次或按星期重复的闹钟，到点在岛上弹出提醒并响铃。

## 装好后在哪里

- **岛的展开页**：多出「闹钟」一页，在这里添加、开关和删除闹钟。
- **收起条**：显示下一次闹钟的时间。
- **设置 → 插件**：闹钟的设置。

## 怎么用

1. 展开岛，切到「闹钟」页，选好时间、写个备注，点「添加」。
2. 想每周重复就勾上星期几（全选就是「每天」）；什么都不勾是只响一次的单次闹钟。
3. 添加时可以给这个闹钟单独选铃声；已有的闹钟可以随时关掉或删除。
4. 到点后岛上弹出提醒并播放铃声，可以「关闭响铃」或「贪睡 5 分钟」。30 秒没有处理会自动停止响铃。

插件还带一个命令「停止闹钟响铃」，可以在「设置 → 插件」的插件详情里给它设快捷键。

## 设置

- **默认铃声**：柔和风铃、清脆钟声、电子脉冲或静音提醒，旁边的「试听铃声」可以先听一下。
- **在收起条显示下一次闹钟**：默认开启。

## 它会用到什么

- 在岛上弹出提醒，并记入提醒列表。
- 闹钟只保存在本机的插件数据目录里。
- 不联网，不读取你的其他数据。

---

## English

`@fuyu/alarm` · Official Fuyu plugin · Windows / macOS

Set one-time or weekly alarms. When one goes off, the island shows a notification and plays a chime.

### Where it shows up

- **Island page**: a new "Alarm" page where you add, switch on and off, and delete alarms.
- **Collapsed bar**: the time of the next alarm.
- **Settings → Plugins**: the plugin's settings.

### How to use it

1. Expand the island, open the "Alarm" page, pick a time, add a label and click "Add".
2. Tick weekdays to repeat it every week (all of them means "Every day"); with none ticked it rings once.
3. You can pick a sound for each alarm when you add it, and switch alarms off or delete them at any time.
4. When it rings, choose "Dismiss" or "Snooze 5m". The sound stops by itself after 30 seconds.

The plugin also has a "Dismiss ringing alarm" command; give it a shortcut in the plugin's details under Settings → Plugins.

### Settings

- **Default ringtone**: Warm chime, Crystal bell, Digital pulse or Silent; "Test sound" plays it.
- **Show next alarm on collapsed bar**: on by default.

### What it uses

- Shows notifications on the island and adds them to the reminder list.
- Alarms are stored only in the plugin's data folder on your computer.
- No network access, and it doesn't read any of your other data.

---

## 给开发者 · For developers

- 服务：`messages/v1`（必需）、`reminders/v1`（可选）
- 插槽：`island.page/v1`、`island.collapsed/v1`、`island.runner/v1`、`settings.section/v1`
- 命令：`dismiss`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
