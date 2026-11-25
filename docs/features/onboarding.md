# 新手引导

新装的浮屿第一次启动时，岛先出现，约 1.2 秒后打开新手引导：一个透明窗口（label `onboarding`，`?window=onboarding`），在轻量体验幕压暗屏幕并照亮真岛，在权限和进阶配置幕自动撤掉黑幕、让出外部窗口视野。用户在卡片上做选择，效果直接出现在真岛上；练习也在真岛上做。设计来由和参考见 [调研](../research/onboarding-design.md)。

## 两层结构：核心主线 + 按需进阶中心

引导拆成**核心主线（4–5 幕，约 1 分钟）**和**按需进阶配置中心**，由声明式注册表 `src/windows/onboarding/flow.ts` 统一编排：

### 核心主线（`STEP_REGISTRY`）

| 幕 | 聚光灯 | 卡片上 | 真岛上 | 改的设置 |
|---|---|---|---|---|
| 1 认识浮屿（`hello`） | 脉冲亮圈 | 浮屿水母徽标、「你好，这就是浮屿」、3 步轻预览胶囊、界面语言 | 亮圈套住岛，岛弹出消息面板：「你好啊，我在这儿 👋」 | `fuyu-locale` |
| 2 外观风格（`shape`） | 柔和常亮 | 深色 / 浅色 / 跟随系统、纯色 / 液态玻璃、强调色 | 岛当场变样子 | `themeMode`、`appearanceMode`、`accentMode`、`accentColor` |
| 3 功能搭配（`outfit`） | 柔和常亮 | 身份快捷预设（写代码 / 办公 / 学习 / 娱乐，可多选撤回）、已开启计数与 8 张功能贴纸 | 岛上对应的入口当场出现或消失 | `todoEnabled` 等 7 个开关及内置插件开关；剪贴板 `enabled` |
| 4 系统权限（`permissions`，仅 macOS 且所选功能需要时，**排在上手体验之前**） | 撤掉黑幕 | 按第 3 幕留下的功能列出需要的 macOS 权限（剪贴板、翻译 → 辅助功能；截图 → 屏幕录制）；可点「跳过此步」 | — | 系统隐私授权 |
| 5 上手体验（`play`） | 脉冲亮圈 | 星级计数 + 三个小任务（展开岛并选悬停/点击、拖文件到岛上、按剪贴板快捷键并可选 Win+V）；可点「跳过此步」 | 真岛展开、接文件、弹剪贴板；演示歌曲和演示 Agent 正在运行 | `expandTrigger`、剪贴板 `winV` |
| 6 准备就绪（`release`） | 柔和常亮 | 开机启动 + **按需进阶配置中心**（按当前开关和市场目录动态展示扩展卡）+「打开全部设置」与托盘/菜单栏提示 | 点「开始使用」，遮罩消失，岛弹出「浮屿已就绪」 | 开机自启 |

### 按需进阶配置中心（`EXTENSION_REGISTRY` 与 `AGENT_SETUP_REGISTRY`）

为了避免新功能不断堆高首次引导步数，所有重型配置与市场推荐统一挂在收尾页的扩展中心：

- **配置 AI Agent 与手机推送（`agentSetup`，AI Agent 开着时出现）**：点开后原地切入**宽卡片工作区模式**（`640px` 居中、无黑幕压暗、顶部显示子步骤标签和「返回收尾」），串起：
  1. **会话样式（`agentCards`）**：5 种会话布局的可视化缩略图卡片选择（分层聚焦 / 分栏 / Bento / 按项目 / 极简）+ 归档动画 + 卡片光效（极简时隐藏）。
  2. **连接代理（`agentConnect`）**：SSH 远程电脑、AI 代理开关与状态钩子安装/修复、回复状态标记。
  3. **手机推送（`push`）**：`cc-connect` 五步配置（安装 / 建项目 / 选平台 / 接机器人 / 测试），支持跳过返回收尾页并标出「已配置」。
- **推荐插件套装（`bundle`，市场目录里有未装全的 `onboarding` 套装时出现）**：直接以扩展卡片形式展示套装名、简介与包含插件胶囊，点「去市场看看」结束引导并打开设置 → 插件市场对应确认框，不额外增加主线步数。
- **添加邮箱（`mail`，邮箱开着时出现）**：结束引导并直达设置 → 邮箱。

### 以后扩展新引导页怎么加

- 需要加入首次核心体验的短步骤：在 `src/windows/onboarding/flow.ts` 的 `STEP_REGISTRY` 追加一条 `OnboardingStepSpec`（声明 `id`、`layout`、`spotlight`、`skippable`、`when(ctx)`），在 `OnboardingWindow.tsx` 挂组件并在 `src/i18n/sections/onboarding.ts` 补中英文文案即可。
- 重型或可选配置项：优先在 `EXTENSION_REGISTRY` 增加扩展卡（直达设置页或进入宽卡片子流程），不拉长主线。

## 交互与性能要点

- **演示模式**：引导开着的时候，岛上放演示歌曲「海边的风」和演示 Claude Code 会话；引导关闭时演示立即消失，意外退出最多 7 秒后消失。
- **导航语义统一**：顶部进度圆点支持点击已完成步骤回跳，并展示 `当前 / 总步数 · 阶段名`；左下角为明确的「稍后再说」（关闭引导），可跳过幕在右下角提供独立的「跳过此步」；键盘支持 `Esc` 退出、`Alt+←/→` 前后翻页。
- **定位与动效**：`placement.ts` 统一通过 `top` 计算位置（不再在 `top`/`bottom` 间切换导致瞬移），收起态留出顶部呼吸感，展开态自动避让；卡片正文切幕仅做纯透明度淡入，文字零位移零缩放；`useCardRect` 使用 `requestAnimationFrame` 合帧并去重后再发给原生侧更新穿透区；遵守 `prefers-reduced-motion`。
- **聚光灯自适应**：当岛紧贴屏幕顶边时保持顶边直角；悬浮或有顶部偏移时自动切换为完整四角圆角边框；在权限幕和宽卡片进阶模式下自动关闭压暗黑幕，避免挡住系统设置或浏览器。
- **先露出桌面**（仅新装首次启动）：打开引导前最小化/隐藏其他窗口，关闭后恢复；从收尾页跳去设置窗口时会先开设置再关引导，并将设置提到最前。

## 什么时候打开

- `windows/island/useFirstRunGuide.ts` 在岛第一次渲染时读 `islandRanBefore()`（有没有 `fuyu-settings`），没有才打开。
- 升级上来的用户已有 `fuyu-settings`，不会自动弹出。
- 设置 → 关于 →「新手引导」可随时重新打开。

## 代码

- 前端：`src/windows/onboarding/`。
  - `flow.ts`：声明式主线/进阶/扩展注册表与筛选纯函数（`tests/unit/onboarding-flow.test.mjs`）；
  - `placement.ts`：卡片几何定位纯函数（`tests/unit/onboarding-placement.test.mjs`）；
  - `OnboardingWindow.tsx`、`OnboardingHeader.tsx`、`Spotlight.tsx`：外壳、双模式导航栏、自适应聚光灯；
  - `HelloAct.tsx`、`ShapeAct.tsx`、`OutfitAct.tsx`、`PermissionsAct.tsx`、`PlayAct.tsx`、`ReleaseAct.tsx`、`AgentCardsAct.tsx`、`AgentConnectAct.tsx`、`push/`：各幕界面；
  - `personas.ts`、`useCardRect.ts`、`useIslandSpot.ts`、`useDemoHeartbeat.ts`、`useRecommendedBundle.ts`、`storage.ts`、`api.ts`。
- 真岛侧：`windows/island/useFirstRunGuide.ts`、`windows/island/useOnboardingDemo.ts`。
- Rust：`src-tauri/src/onboarding_window/`（`mod.rs` 创建与清桌面，`overlay.rs` 同步岛位置与鼠标穿透）。
- 回归页：`tests/regression/onboarding.html`（`?act=1-5`、`?locale=en`、`?light=1`、`?open=1`、`?test=1`）和 `tests/regression/onboarding-push.html`。

## 引导之后：岛上的「第一次」提示

引导只练核心三件事，其余的等用户第一次遇到时，在收起条上轻轻提一句（C50）：

| 什么时候 | 提示 | 按钮 |
|---|---|---|
| 第一次有 Agent 会话（AI 代理状态开着） | Agent 会话显示在这里，点岛看全部 | 插头：打开 设置 → AI Agent → 连接；对勾：知道了 |
| 第一次有新消息提醒（收起条预览、横幅或消息面板） | 新消息来了，点一下岛就能看（等这条消息的提醒结束后才出） | 对勾 |
| 第一次贴边收起 | 岛藏在顶边，鼠标碰一下就回来（等岛下次出来时才出） | 对勾 |

- 一天最多一条，按本地日期算；显示 8 秒，鼠标停在上面时不收；点对勾或插头后不再出现，未点最多出 3 次。
- 记录在 `fuyu-first-hints`（见 [contracts.md](../architecture/contracts.md)），实现在 `src/features/first-hints/` 和 `windows/island/useIslandFirstHints.ts`。
