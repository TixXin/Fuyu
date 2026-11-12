# 新手引导

新装的浮屿第一次启动时，岛先出现，约 1.2 秒后打开新手引导：一个透明的遮罩（label `onboarding`，`?window=onboarding`），铺满岛所在屏幕的工作区，把屏幕压暗，只留真岛周围一圈亮着，岛下方是一张卡片。用户在卡片上做选择，效果直接出现在真岛上；练习也在真岛上做。设计来由和参考见 [调研](../research/onboarding-design.md)。

## 五幕

| 幕 | 卡片上 | 真岛上 | 改的设置 |
|---|---|---|---|
| 1 你好 | 「你好，这就是浮屿」，界面语言 | 亮圈套住岛，岛弹出消息面板：「你好啊，我在这儿 👋」 | `fuyu-locale` |
| 2 捏岛 | 深色 / 浅色 / 跟随系统、强调色、圆角 | 岛当场变样子 | `themeMode`、`accentMode`、`accentColor`、`islandCornerRadius` |
| 3 装岛 | 「你平时主要用电脑做什么」（写代码 / 办公 / 学习 / 娱乐，可多选）和 8 张功能贴纸 | 岛上对应的入口当场出现或消失 | `todoEnabled` 等 7 个开关；剪贴板历史写 `clipboard-history.json` 的 `enabled`。身份和功能的对应在 `windows/onboarding/personas.ts` |
| 4 练习 | 三个小任务，每完成一个亮一颗星；卡片挪到屏幕底部，给展开的岛让位置 | 用户自己让岛展开（顺带选悬停还是点击）、拖一个真文件到岛上（文件中转开着时才有）、按一次剪贴板快捷键（剪贴板开着时才有，顺带问要不要 Win+V） | `expandTrigger`、剪贴板 `winV` |
| 5 完成 | 开机启动；去设置连接 AI 编程工具、添加邮箱 | 点「开始使用」，遮罩消失，岛弹出「浮屿已就绪」 | 注册表的开机自启 |

- **演示模式**：引导开着的时候，岛上放一首演示歌曲「海边的风」，还有一个正在干活的演示 Claude Code 会话，这样刚装好的岛也能展示音乐和 Agent。真的有歌在放时用真的。引导关掉时演示马上消失；引导意外退出的话，最多 7 秒后也会消失。
- 每一项改了就保存，和设置窗口用同一套存储，真岛通过 storage 事件马上跟着变。随时「跳过」、点 ×、按 Esc 都能退出，已经选的保留。
- 遮罩只在卡片上接住鼠标，别的地方鼠标直接穿过去，所以能碰到真岛、能从桌面拖文件。
- 岛藏在托盘里时整屏压暗，卡片上提示点托盘图标让岛出来；岛一出来亮圈就跟过去。
- 系统开了「减少动画」时，亮圈的脉冲、卡片和星星的动画都关掉。
- **先露出桌面**：打开引导前，任务栏先「最小化所有窗口」（Win+M 那个命令，不用 Win+D：它会来回切换，也可能把置顶的岛一起藏掉），等约 0.35 秒动画结束再盖上遮罩；引导关闭时「撤销最小化全部」，窗口回到原处。见 `src-tauri/src/win32/desktop.rs`。
- 只摆出设置里已有的选项，不新增设置；不要账号密码，不弹系统权限对话框。

## 什么时候打开

- `windows/island/useFirstRunGuide.ts` 在岛第一次渲染时读 `islandRanBefore()`（有没有 `fuyu-settings`），没有才打开。岛的第一次渲染之后就会保存设置，所以只打开一次，不另存「看过了」的标记。
- 升级上来的用户已经有 `fuyu-settings`（改名前的 `focusd-island-settings` 会先被复制过来），不会看到。
- 设置 → 关于 →「新手引导」可以再打开。
- 开发时看：主工作区 `pnpm tauri dev` 后用「关于」里的按钮打开；`pnpm dev:lane` 的预览岛屿开始时没有数据，第一次启动会自动打开；只看卡片的样子用回归页（见下）。

## 代码

- 前端：`src/windows/onboarding/`。`OnboardingWindow.tsx` 串起五幕，每幕一个 `*Act.tsx`；`Spotlight` 是压暗和亮圈；`placement.ts` 算卡片放哪（纯函数，`tests/unit/onboarding-placement.test.mjs`）；`useIslandSpot` 收真岛的位置，`useCardRect` 把卡片的矩形交给 Rust，`useDemoHeartbeat` 让演示模式续命；`personas.ts` 是身份和功能的对应（`tests/unit/onboarding-personas.test.mjs`）；`storage.ts` 是给真岛的两个跨窗口请求。文案在 `src/i18n/sections/onboarding.ts`。
- 真岛那边：`windows/island/useFirstRunGuide.ts`（打开引导、在消息面板里打招呼，借用插件通知的显示方式）、`windows/island/useOnboardingDemo.ts`（演示歌曲和会话）。
- Rust：`src-tauri/src/onboarding_window/`。`mod.rs` 按需创建遮罩，铺满岛所在屏幕的**工作区**（不是整个屏幕，免得被当成全屏程序触发游戏模式）；`overlay.rs` 每 30ms 算一次岛在遮罩上的位置（`island/passthrough.rs` 的 `island_on_screen`），变了就发 `onboarding-island`，并按鼠标在不在卡片上切换遮罩的鼠标穿透。剪贴板弹出时 `clipboard_history/popup.rs` 把 `clipboard-popup-opened` 也发给引导。
- 回归页：`tests/regression/onboarding.html`（`?act=1-5`、`?locale=en`、`?light=1`、`?open=1` 用来看界面，`?test=1` 跑检查）。回归页里没有真岛，亮圈里只是背景。

## 以后

岛上的「第一次」提示（第一次有 Agent 会话、第一次收到横幅、第一次贴边……时轻轻提一句）还没做，见任务 C50。
