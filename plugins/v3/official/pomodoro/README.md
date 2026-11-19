# 番茄钟 · Pomodoro

`@fuyu/pomodoro` · 浮屿官方插件 · Windows / macOS

挑一条待办开始专注，岛上倒计时，到点提醒你休息，记下今天完成了几轮。可以暂停，休息时长和每天的目标都能在设置里改。

## 装好后在哪里

- **岛的展开页**：多出「番茄钟」一页，显示倒计时、进度条、现在是专注还是休息，以及今天完成的轮数。
- **收起条**：番茄钟运行时显示剩余时间，休息时前面写「休息」，暂停时变灰；点一下打开番茄钟页。
- **设置 → 插件 → 番茄钟**：时长、自动开始、提示音、每日目标等全部设置。

## 怎么用

1. 展开岛，切到「番茄钟」页，点「开始」专注一轮。想做某条待办，先点「选一条待办 ›」，从今天没完成的待办里挑一条。
2. 专注中可以「暂停」「继续」或「停止」。中途停止的那一轮不计数。
3. 一轮专注结束，岛上弹出提醒，带「休息一下」「再来一轮」两个按钮；页面上也会出现「休息 5 分钟」按钮。每专注 4 轮，下一次是长休息。
4. 休息结束再提醒一次，点「再来一轮」接着做刚才那条待办。

不打开页面也能用：按 **Ctrl+Alt+P** 开始一轮（暂停时按它是继续）。插件带「开始番茄钟」「停止番茄钟」「暂停 / 继续番茄钟」三个命令，快捷键在「设置 → 插件」的插件详情里改。

## 设置

**计时**

- **专注时长**：25 分钟（1–120）。
- **短休息**：5 分钟（1–60）。
- **长休息**：15 分钟（1–90）。
- **几轮后长休息**：4 轮（1–12）。
- **专注结束后自动开始休息**：默认关。
- **休息结束后自动开始下一轮**：默认关。

**提醒**

- **到点播放提示音**：默认关；旁边的「试听」可以先听一下。
- **每日目标轮数**：0（不设目标）。设了以后页面右上角显示「今日 3/8」，达到时变成强调色。

**岛上页面**

- **待办列表默认展开**：默认关，只显示一行「选一条待办 ›」，点开才出列表。

**收起条**

- **在收起条显示倒计时**：默认开。番茄钟的计时不进浮屿内置的计时器，收起条上只有这一个倒计时，到点的提醒和提示音也都由番茄钟自己出。较早的浮屿不支持这样计时，那时番茄钟的倒计时显示在内置计时器的收起项里，这一项默认关，免得同一个倒计时出现两遍。

改了马上生效；正在走的这一轮按开始时的时长走完，下一轮用新时长。从 1.0.0 升级的，今天的轮数和正在走的那一轮都保留，新设置取上面的默认值。

## 开销和数据来源

- 读取今天的待办列表（只读，不会改动或勾选你的待办）；过了零点自动换成新一天的列表，今天的轮数从 0 开始。
- 计时用浮屿自带的计时器，在岛上弹出提醒。
- 轮数和设置只保存在本机的插件数据目录里。
- 不联网。

---

## English

`@fuyu/pomodoro` · Official Fuyu plugin · Windows / macOS

Pick a to-do and focus; the island counts down, tells you when to take a break, and counts today's rounds. You can pause, and set the break lengths and a daily goal in the settings.

### Where it shows up

- **Island page**: a new "Pomodoro" page with the countdown, a progress bar, whether you are focusing or on a break, and today's rounds.
- **Collapsed bar**: the time left while it runs, with "Break" in front during a break and greyed out while paused; click it to open the Pomodoro page.
- **Settings → Plugins → Pomodoro**: lengths, auto-start, sound, daily goal and every other setting.

### How to use it

1. Expand the island, open the "Pomodoro" page and click "Start" for one focus round. To work on a todo, click "Pick a todo ›" first and choose one of today's open todos.
2. While it runs you can Pause, Resume or Stop. A round you stop early does not count.
3. When a focus round ends the island shows a notification with "Take a break" and "One more round"; the page also offers a "Break 5 min" button. Every 4 rounds the next break is a long one.
4. When the break ends you get another notification; "One more round" picks up the same todo.

You can also use it without opening the page: press **Ctrl+Alt+P** to start a round (or resume a paused one). The plugin has "Start pomodoro", "Stop pomodoro" and "Pause or resume pomodoro" commands; change their shortcuts in the plugin's details under Settings → Plugins.

### Settings

**Timer**

- **Focus length**: 25 min (1–120).
- **Short break**: 5 min (1–60).
- **Long break**: 15 min (1–90).
- **Long break after**: 4 rounds (1–12).
- **Start the break automatically when focus ends**: off by default.
- **Start the next round automatically when a break ends**: off by default.

**Reminders**

- **Play a sound when time is up**: off by default; "Test sound" next to it plays it once.
- **Daily goal**: 0 (no goal). With a goal the page shows "Today 3/8" in the corner and turns it the accent colour once you reach it.

**Island page**

- **Show the todo list expanded**: off by default: the page shows a single "Pick a todo ›" line and opens the list when clicked.

**Collapsed bar**

- **Show the countdown on the collapsed bar**: on by default. The pomodoro keeps its timer out of Fuyu's built-in timer, so the collapsed bar shows a single countdown and the pomodoro gives its own reminder and sound. Older Fuyu versions cannot keep a timer out; there the countdown shows in the built-in timer item and this setting is off by default so it does not appear twice.

Changes apply right away; a round already running finishes at the length it started with, and the next one uses the new length. Coming from 1.0.0, today's rounds and a running round carry over and the new settings start at the defaults above.

### Cost and data

- Reads today's todo list (read only: it never changes or ticks off your todos); after midnight it switches to the new day's list and today's rounds start from 0.
- Uses Fuyu's built-in timers and shows notifications on the island.
- Rounds and settings are stored only in the plugin's data folder on your computer.
- No network access.

---

## 给开发者 · For developers

- 服务：`timers/v1`、`todos/v1`、`messages/v1`，以及 `commands`
- 插槽：`island.page/v1`、`island.collapsed/v1`、`settings.section/v1`
- 命令：`start`（默认 `Ctrl+Alt+P`）、`stop`、`pause`
- 在本目录 `pnpm build` 构建、`pnpm dev` 调试；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
