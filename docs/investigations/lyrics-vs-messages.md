# 放音乐时来了消息，收起岛上的歌词不恢复或恢复很慢

日期：2026-11-15。任务 D60，issue #394。只读代码排查，修改全在前端。

## 现象

放歌、收起的岛在显示歌词时，来了别的消息，消息走了以后歌词有时等很久才回来、有时等一会儿，有时干脆不再显示；消息替换歌词的动效也不顺。

## 收起条上谁会顶掉歌词

收起条只有一行，按 `IslandCollapsedBar.tsx` 的顺序显示，前面的出现时歌词让位：

| 顶掉歌词的东西 | 修改前持续多久 | 修改后 |
|---|---|---|
| 消息预览（QQ、微信、邮件、插件） | 约 5 秒 | 不变 |
| 截图 / 复制卡片、权限提示、设备提醒、用量提醒、音量亮度、快捷翻译 | 各自的时长 | 不变 |
| 会议提醒 | 会前整段「提前提醒」时间（几分钟） | 放歌词时到点轮流：进入提醒、会前 1 分钟、开始时各 8 秒 |
| Agent 插话：会话开始、完成、失败 | 4 秒 | 不变 |
| Agent 在等你（审批、提问） | 一直到你处理 | 4 秒，到「提醒」设置的时间还在等再插 4 秒 |
| 歌词里的空白行、最后一句之后 | 回落到 Agent 标题或待办 | 按「前奏时显示」 |

## 原因

1. **Agent 等你时歌词一直不回来**（「直接不显示」）。`useAgentInterjection` 只要有会话在 `waiting` 就一直返回它，`IslandApp.tsx` 把它当 `agentSession`，歌词被置空。开着几个 Claude Code 会话、有一个停在审批上，歌词就再也不回来。
2. **恢复后逐字高亮落后**（「等一会儿才继续」）。消息出现时歌词行卸载，恢复时 `KaraokeText` 重新挂载，`useState(positionMs)` 取到的是 `useCurrentLyric` 上一次重算时的位置。这个钩子只在换句和媒体状态变化时重算，所以常常是这一句开头的位置，高亮从句首重跑，比歌声慢几秒，等到下一句才对上。长句的 `follow` 滚动同样落后。
3. **会议提醒占几分钟**（「等很久」）：会前整段提醒时间都显示会议。
4. **间奏回落到别的东西**：空白行时 `currentLyric` 为空，`agentSession` 退回常驻的 Agent 标题，收起条在歌词、Agent 标题、待办之间跳，看起来像歌词断了。最后一句过后 12 秒也一样。
5. **动效节奏不一**：消息进出是 200ms 退出 + 560ms 弹簧进入，歌词换句是另一套 260ms ease-out，恢复时两套叠加；刘海模式两翼直接替换。

## 处理

- `useCurrentLyric` 给 `karaoke` 带上取样时刻 `sampledAt`；`KaraokeText` 挂载时（播放中）按 `positionMs + (Date.now() - sampledAt)` 起算，逐字填充和长句滚动都按真实时间接上。
- `useAgentInterjection` 不再让 `waiting` 常驻：进入等待时和其他插话一样 4 秒；`remindingSession` 用 `alerts.ts` 的 `trackWaiting` / `takeDueReminders`，到「Agent → 提醒」的时间还在等就再插一次（设置为「不提醒」时不再插）。等待状态仍在状态灯、会话数和 Agent 页。
- 新增 `features/calendar/meetingBeats.ts` 和 `useMeetingBeat.ts`：收起条在放歌词时，会议提醒只在三个时刻各显示 8 秒——第一次进入提醒（含岛屿启动时已在提醒期）、开始前 1 分钟、开始时（离上一拍不足 8 秒的拍合并）；其余时间回到歌词。没在放歌词时照旧整段显示。加入会议按钮整个提醒期间都在。
- `useCurrentLyric` 把空白行和「最后一句之后」也标成 `intro`，`useIslandLyrics` 按「前奏时显示」给出歌名或音符；选「待办」时返回一个没有文字的歌词行，所以 `IslandApp.tsx` 仍判断为「正在放歌词」，Agent 只插话、不退回常驻标题，岛宽也按最长一句不跳。`IslandApp.tsx` 没有改。
- 动效统一见 [collapsed-message-animation.md](../features/collapsed-message-animation.md)。

## 验证

`tests/regression/music-lyrics.html`（检查在 `lyrics-handoff-checks.tsx`）：句中被消息打断、1.2 秒后恢复，逐字高亮的延迟和真实时间相差不到 250ms；恢复时歌词行不叠加换句动画；换句走上移淡入；会议提醒先显示、8 秒后回到歌词且加入按钮还在；Agent 等你 4 秒后让回，到提醒时间再插一次；空白行、最后一句之后按「前奏时显示」。单元测试：`agent-interjection.test.mjs`、`meeting-beats.test.mjs`。

Windows 上真实 QQ / 微信消息打断歌词的实测记在共享笔记 `lyrics-handoff-manual-tests.md`，由主 agent 汇总。
