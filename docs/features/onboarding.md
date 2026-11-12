# 新手引导

新装的浮屿第一次启动时，岛先出现，约 1.2 秒后在岛所在的屏幕中央打开一个单独的引导窗口（label `onboarding`，`?window=onboarding`，720 × 560，不能调大小）。

## 四步

| 步骤 | 内容 | 改的是哪项设置 |
|---|---|---|
| 1 欢迎 | 一句话介绍，岛的预览，界面语言，深色 / 浅色 / 跟随系统 | `fuyu-locale`、`fuyu-settings.themeMode` |
| 2 功能 | 8 个功能开关，分两列，每个带一句说明 | `fuyu-settings` 的 `todoEnabled` 等；剪贴板历史写 `clipboard-history.json` 的 `enabled` |
| 3 用法 | 悬停或点击展开、闲置时贴边、Win+V（剪贴板历史开着时才有）、开机启动 | `expandTrigger`、`autoTuck`、剪贴板 `winV`、注册表的开机自启 |
| 4 完成 | 设置在哪里、怎么移动和隐藏岛；去设置连接 AI 编程工具、添加邮箱 | 只打开设置窗口，不改设置 |

- 每一项改了就保存，和设置窗口用同一套存储，岛通过 storage 事件马上跟着变。随时跳过或关掉窗口，已经选的保留，其余是默认值。
- 引导只摆出设置里已有的选项，不新增设置；不要账号密码，不弹系统权限对话框。

## 什么时候打开

- `windows/island/useFirstRunGuide.ts` 在岛第一次渲染时读 `islandRanBefore()`（有没有 `fuyu-settings`），没有才打开。岛的第一次渲染之后就会保存设置，所以只打开一次，不另存「看过了」的标记。
- 升级上来的用户已经有 `fuyu-settings`（改名前的 `focusd-island-settings` 会先被复制过来），不会看到。
- 设置 → 关于 →「新手引导」可以再打开。
- `pnpm dev:lane` 的预览岛屿开始时没有数据，每次新建都会打开引导，可以拿来试。

## 代码

- 前端：`src/windows/onboarding/`（`OnboardingWindow.tsx` 和每步一个组件），文案在 `src/i18n/sections/onboarding.ts`。
- Rust：`src-tauri/src/onboarding_window/mod.rs`，命令 `open_onboarding_window`、`show_onboarding_window`。窗口先隐藏创建，页面画好后再显示，和设置窗口一样。
- 回归页：`tests/regression/onboarding.html`（`?step=1-4`、`?locale=en`、`?light=1` 用来看界面，`?test=1` 跑检查）。
