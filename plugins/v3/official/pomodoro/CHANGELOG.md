# 更新记录 · Changelog

## 1.1.1

收起条上只剩一个倒计时。

- 番茄钟的计时不再进浮屿内置的计时器：内置计时器的页面和收起条都不列它，到点也不由内置计时器响铃，提醒由番茄钟自己出，「到点播放提示音」打开时响番茄钟自己的提示音。
- 插件自己的收起项因此默认打开，收起条上只有一个倒计时；在设置里关过的保持关。较早的浮屿不支持这样计时，那时照旧由内置计时器显示，番茄钟自己的收起项默认关。
- 到点、停止、切到休息或下一轮时都会清掉旧的计时；启动时发现番茄钟以前留下、已经不用的计时也会清掉。

Only one countdown on the collapsed bar.

- The pomodoro's timer no longer goes into Fuyu's built-in timer: the built-in timer page and collapsed bar leave it out and do not ring for it. The pomodoro shows its own reminder, and plays its own sound when "Play a sound when time is up" is on.
- So the plugin's own collapsed bar item is now on by default and the bar shows a single countdown; if you turned it off, it stays off. Older Fuyu versions cannot keep a timer out of the built-in timer; there the built-in timer still shows it and the plugin's own item stays off by default.
- Old timers are removed when a round ends, when you stop, and when switching to a break or the next round; leftover pomodoro timers from earlier runs are cleared on start.

## 1.1.0

能调时长、有休息和暂停，岛上更清爽。

- 新的设置分节：专注时长（25 分钟）、短休息（5）、长休息（15）、几轮后长休息（4）、专注结束后自动开始休息和休息结束后自动开始下一轮（都关）、到点提示音（关，可以试听）、每日目标轮数（0 = 不设）、待办列表默认展开（关）、收起条显示（关）。改了马上生效。
- 专注结束后有短休息和长休息；可以暂停、继续。
- 到点的提醒带按钮：专注结束是「休息一下」「再来一轮」，休息结束是「再来一轮」（接着做刚才那条待办）。
- 岛上的页面：待办列表折成一行「选一条待办 ›」，点开才出；按钮只留开始、暂停 / 继续、停止；设了每日目标时显示「今日 3/8」。
- 收起条：番茄钟的倒计时由浮屿内置计时器的收起项显示；插件自己的收起项默认关，免得同一个倒计时出现两遍，打开后休息时前面写「休息」、暂停时变灰、点一下打开番茄钟页（需要浮屿支持），读秒和内置计时器一致。
- 命令「开始番茄钟」「停止番茄钟」真正接上了，新增「暂停 / 继续番茄钟」；暂停时按 Ctrl+Alt+P 是继续。岛的页头按钮有了中英文标题。
- 过了零点，待办列表和今天的轮数自动换到新的一天。
- 描述不再写死「25 分钟」。
- 从 1.0.0 升级：今天的轮数和正在走的那一轮照旧，新设置取默认值。

Adjustable lengths, breaks and pause, and a quieter island page.

- New settings section: focus length (25 min), short break (5), long break (15), long break after (4 rounds), start the break and the next round automatically (both off), a sound when time is up (off, with a test button), daily goal (0 = none), todo list expanded (off), and its own collapsed bar item (off). Changes apply right away.
- Short and long breaks after focus rounds; pause and resume.
- Notifications have buttons: "Take a break" and "One more round" after focus, "One more round" after a break (it picks up the same todo).
- Island page: the todo list folds into one "Pick a todo ›" line until you click it; the buttons are just Start, Pause / Resume and Stop; with a daily goal it shows "Today 3/8".
- Collapsed bar: Fuyu's built-in timer item shows the pomodoro countdown; the plugin's own item is off by default so the same countdown does not appear twice. Turned on, it shows "Break" during a break, greys out while paused, opens the Pomodoro page when clicked (when Fuyu supports it), and ticks in step with the built-in timer.
- The "Start pomodoro" and "Stop pomodoro" commands now actually work, plus a new "Pause or resume pomodoro"; Ctrl+Alt+P resumes a paused round. The island header button has a title in Chinese and English.
- After midnight the todo list and today's rounds move to the new day.
- The description no longer hard-codes 25 minutes.
- Coming from 1.0.0: today's rounds and a running round carry over; the new settings start at their defaults.

## 1.0.0

首个版本。

First release.
