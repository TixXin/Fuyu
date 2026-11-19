# 计时器

> 任务：[C58](/docs/tasks/C/C58.md)，issue #228；迁成第 3 版内置插件：[E36.3.28](/docs/tasks/0-archive/E/E36.3.28.md)，issue #576。内置插件 `timer`，默认开，休息提醒也归它，关掉时计时器页、收起条的小块、到点和休息提醒、快捷键一起撤掉。2026-11-15 之前是第 2 版内置插件 `focusd.timer`（默认关），升级时原来的开关、声音和快捷键照搬过来，从没动过的按新默认开着。

「10 分钟后提醒我」这种临时计时，以及秒表。第 2 版的番茄钟示例插件随第 2 版一起下线（E36.6），源码已从仓库删除。

## 怎么用

- 岛上有一个「计时器」页（头部的计时器图标，`Alt+数字` 也能切过去）。
- 全局快捷键 `Ctrl+Alt+K`（**设置 → 快捷键 → 计时器**里改或关掉；被别的程序占了时那里提示）：展开岛、打开计时器页，光标落在输入框。快捷键由 Rust 的 `src-tauri/src/timer/` 注册，配置存在 `plugins.yml` 里计时器的 `config.shortcut`。
- 输入时长按 Enter 开始倒计时。认得的写法：`10`（不写单位按分钟）、`2.5`、`10m`、`1h30m`、`90s`、`1:30`（分:秒）、`1:00:00`（时:分:秒）、`10 分钟`、`1小时30分`、`45秒`。最短 1 秒，最长 24 小时，读不懂时输入框下面提示。
- 输入框旁的秒表按钮开一个秒表。
- 最多同时 12 个计时，每个可以暂停、继续、取消。

## 收起条

有计时在走时，收起条右侧出现一个小块：显示最近到点的那个倒计时的剩余时间；没有在走的倒计时就显示正在走的秒表。点它打开计时器页。项目 id 是 `timer`，可以在 外观 → 收起条 里换位置或隐藏。

## 到点

- 岛上提示「10:00 的计时到了」（几个同时到点时写还有几个），响一声（**设置 → 行为**里计时器的「到点响一声」，默认开，存在 `config.sound`，用 Agent 提示音里的「完成」）。
- 提示上有「再加 5 分钟」和「知道了」；计时器页里到点的那一行也一样。
- 关掉岛屿再打开，倒计时按到点的实际时间接着走；关着的时候已经到点的，打开后马上提醒。

## 数据

计时由内置插件宿主经 `timers/v1` 存在 `plugins-v3/data/timer/timers.json`（只在本机，不进设置备份，所有窗口关闭时仍在宿主里继续计时，宿主重启后按实际时间恢复；2026-11-17 起，[E36.3.48](/docs/tasks/0-archive/E/E36.3.48.md)，issue #596）。升级后首次连上宿主时，将旧版 `localStorage` 的 `fuyu-timers` 一次性并入宿主并写入迁移标记 `fuyu-timers-migrated-v1`，旧 key 保留不删供降级兼容；宿主未启用时回退到窗口内读写 `fuyu-timers`。纯规则在 `src/features/timer/timers.ts` 与 `host/rules.mjs`（单元测试 `tests/unit/timer.test.mjs`、`tests/unit/timer-host.test.mjs`、`tests/unit/timer-store.test.mjs`），窗口状态和迁移在 `timerController.ts`、`store.ts`，回归页 `tests/regression/timer.tsx`。插件的部分在 `src/features/timer/plugin/`（岛页、收起条、提示、设置、`island.runner/v1`，`services.ts` 里的窗口服务 `reminders/v1`，拥有者 `OWNER = "timer"`），关掉后的残留由回归页 `builtins-off?only=timer` 查。
