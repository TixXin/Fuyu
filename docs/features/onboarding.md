# 新手引导

新装的浮屿第一次启动时，岛先出现，约 1.2 秒后在岛所在的屏幕中央打开一个单独的引导窗口（label `onboarding`，`?window=onboarding`，860 × 680，透明、不能调大小）。窗口里是一张「迷你桌面」，上面挂着一座按正在选的设置画出来的岛；五幕大约一分钟。设计来由和参考见 [调研](../research/onboarding-design.md)。

## 五幕

| 幕 | 内容 | 改的是哪项设置 |
|---|---|---|
| 1 落岛 | 一滴光从顶部落下、拉长成岛，岛里轮流说「你好 / Hello / こんにちは…」；点岛开始。下面选界面语言 | `fuyu-locale` |
| 2 捏岛 | 深色 / 浅色 / 跟随系统、强调色（默认 / 跟随 Windows / 自选）、圆角，岛上马上看到 | `themeMode`、`accentMode`、`accentColor`、`islandCornerRadius` |
| 3 装岛 | 「你平时主要用电脑做什么」：写代码 / 办公 / 学习 / 娱乐，可多选，岛装好对应的功能；8 张功能贴纸点一下装上或卸下，也能拖到岛上。岛的收起条每个功能一个图标 | `todoEnabled` 等 7 个开关；剪贴板历史写 `clipboard-history.json` 的 `enabled`。身份和功能的对应在 `windows/onboarding/personas.ts` |
| 4 玩岛 | 迷你桌面上音乐在放、一个 Agent 在干活。三个小任务，完成一个亮一颗星：悬停或点击打开岛（顺带选展开方式）；把桌面上的假文件拖给岛（文件中转开着时才有，也可以按「放进去」）；真按一次剪贴板快捷键（剪贴板开着时才有，真的会弹出剪贴板窗口；顺带问要不要 Win+V） | `expandTrigger`、剪贴板 `winV` |
| 5 放岛 | 开机启动；去设置连接 AI 编程工具、添加邮箱。点「开始使用」，窗口里的卡片缩成岛的形状，窗口同时飞到真岛上方后关闭；真岛收起条上出现「浮屿已就绪」，一道光扫过文字，约 4.5 秒后消失 | 注册表的开机自启 |

- 每一项改了就保存，和设置窗口用同一套存储，真岛通过 storage 事件马上跟着变。随时「跳过」或关掉窗口，已经选的保留，其余是默认值。
- 只摆出设置里已有的选项，不新增设置；不要账号密码，不弹系统权限对话框。
- 系统开了「减少动画」时：没有落下、扫光、星星和飞回的动画，「开始使用」直接关窗并让岛打招呼。
- 键盘能走完：迷你岛、身份卡片、贴纸、「放进去」都是能用 Tab 到达的按钮。

## 什么时候打开

- `windows/island/useFirstRunGuide.ts` 在岛第一次渲染时读 `islandRanBefore()`（有没有 `fuyu-settings`），没有才打开。岛的第一次渲染之后就会保存设置，所以只打开一次，不另存「看过了」的标记。
- 升级上来的用户已经有 `fuyu-settings`（改名前的 `focusd-island-settings` 会先被复制过来），不会看到。
- 设置 → 关于 →「新手引导」可以再打开。
- 开发时看：主工作区 `pnpm tauri dev` 后用「关于」里的按钮打开；`pnpm dev:lane` 的预览岛屿开始时没有数据，第一次启动会自动打开；只看界面用回归页（见下）。

## 代码

- 前端：`src/windows/onboarding/`。`OnboardingWindow.tsx` 串起五幕，每幕一个 `*Act.tsx`；`MiniDesk` 是迷你桌面，`MiniIsland` 是上面的岛（用 `useResolvedTheme` 的颜色画，不是真的主窗口）；`personas.ts` 是纯逻辑（`tests/unit/onboarding-personas.test.mjs`）；`storage.ts` 是给真岛的招呼请求 `fuyu-onboarding-welcome`。文案在 `src/i18n/sections/onboarding.ts`。
- Rust：`src-tauri/src/onboarding_window/`。`mod.rs` 按需创建窗口（先隐藏，页面画好后再显示）；`fly.rs` 是飞回：按 16ms 一帧把窗口的上边中点缓动到岛窗口的上边中点，结束时关窗；岛藏在托盘时原地等完再关。剪贴板弹出时 `clipboard_history/popup.rs` 把 `clipboard-popup-opened` 也发给引导窗口。
- 回归页：`tests/regression/onboarding.html`（`?act=1-5`、`?locale=en`、`?light=1` 用来看界面，`?test=1` 跑检查）。

## 以后

岛上的「第一次」提示（第一次有 Agent 会话、第一次收到横幅、第一次贴边……时轻轻提一句）还没做，见任务 C50。
