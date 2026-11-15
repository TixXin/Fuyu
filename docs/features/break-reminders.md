# 休息提醒

> 任务：[C78](/docs/tasks/C/C78.md)，issue #333。和计时器（[timer.md](timer.md)）放在同一个模块 `src/features/timer/`，但不依赖计时器插件是否打开。

按间隔在岛上提醒起身、远眺。默认关，在 **设置 → 行为 → 提醒** 的「休息提醒」里打开。

## 提醒项

- 打开后默认两项：久坐 60 分钟、护眼 20 分钟。
- 每项可以改名字（留空时显示默认名）、点图标换一个（起身、眼睛、喝水、伸展、咖啡、铃铛）、改间隔（1–480 分钟）、单独开关、删除；最多 8 项。
- 提示语跟着图标走：起身「坐了 60 分钟，起来走走」、眼睛「看看 6 米外，放松 20 秒」、铃铛「30 分钟到了」等。

## 计时规则

- 每 15 秒向原生要一次空闲时间和锁屏状态（`get_user_idle_seconds`、`is_session_locked`，手机推送早就有这两个命令），每项累加这段时间。
- **锁屏或 5 分钟以上没有键鼠操作时不计时**（暂停，不清零）。
- 一次最多算 60 秒，电脑睡眠醒来不会一下子跳到点。
- 到点的项停在「到点」状态，不再累加，等你处理：
  - **5 分钟后再提醒**：退回到离到点还差 5 分钟（同样只算在电脑前的时间）。
  - **跳过**：从 0 重新计。
- 关掉整个功能或某一项，进度清零、已经在岛上的提醒撤掉。
- 进度只在内存里，重开岛屿从 0 开始。

## 在岛上

收起条上的提示和计时器到点一样（`screenshot-notice` 那套样式）：图标 + 「名字 · 提示语」，几条一起时写「还有 N 条」；右侧两个按钮「5 分钟后再提醒」「跳过」。排在录屏、语音、计时器到点、截图卡片、复制卡片之后，新手提示之前（`src/windows/island/islandNotice.tsx`）。

**前台全屏时不显示**（`get_foreground_fullscreen` 和 `foreground-fullscreen-changed` 事件），退出全屏后再出来；全屏期间到点的不会丢。

## 通用提醒队列

提醒卡片和队列不只给休息提醒用（C72 的「高优先级待办到期」也要推进来），在 `src/features/timer/reminders.ts`：

- `pushIslandReminder({ id, source, icon, title, detail?, snoozable?, onSnooze?, onDismiss? })`：推一条，同 id 的替换。
- `replaceIslandReminders(source, reminders)`：把某个来源的提醒整体换成这一组（休息提醒每次计时后这样同步）。
- `dismissIslandReminder(id)` / `snoozeIslandReminder(id)`：卡片上的两个按钮。推迟时有 `onSnooze` 就交给推的人处理，没有就 5 分钟后原样再推一次；`snoozable: false` 时只有「跳过」。
- 图标是 `reminderIcons.ts` 里的名字（`stand`、`eye`、`water`、`stretch`、`coffee`、`bell`、`flag`），要新的图标在那里加。
- 全屏推迟对队列里的所有提醒都生效（`useIslandReminder.ts`）。

## 数据

设置存在 `localStorage` 的 `fuyu-break-reminders`：`{ enabled, items: [{ id, name, icon, minutes, enabled }] }`（见 [contracts.md](../architecture/contracts.md)）。逻辑在 `breakReminders.ts`、`reminderQueue.ts`（纯函数，单元测试 `tests/unit/break-reminders.test.mjs`），计时在 `useBreakReminders.ts`，设置组 `BreakRemindersGroup.tsx`，回归页 `tests/regression/timer.tsx` 后半段。

## 平台

两个平台都是通用前端 + 已有的原生命令。Windows 上锁屏状态靠 `win32/session_notifications.rs` 的会话通知（插件宿主启动时开始监听），空闲用 `GetLastInputInfo`；Mac 用 `macos/session.rs`（`CGEventSource`、`CGSessionCopyCurrentDictionary`）。
