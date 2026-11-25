# 新手引导与版本更新引导

新装的浮屿第一次启动时，岛先出现，约 1.2 秒后打开首次安装引导（label `onboarding`，`?window=onboarding`）；老用户从旧版本升级到新版本时（已有设置且 `fuyu-onboarding-guide-version` 小于当前版本），只打开精简的**版本更新引导（What's New）**，不重走安装引导。新装用户走完首次引导后会写入当前版本号，不会重复弹出本版本的更新引导。

## 三轨道可扩展架构（`src/windows/onboarding/flow.ts`）

引导由声明式注册表编排为三条轨道：

1. **首次安装主线（`STEP_REGISTRY`，5 幕，macOS 需权限时自动在练习前插入权限幕）**
   - **认识浮屿（`hello`）**：双栏宽舞台（`760px`），顶部真岛自动演示场景胶囊、可点击切换矢量/像素画风的水母徽标、界面语言切换。
   - **形态与外观（`shape`）**：覆盖浮屿全部真实形态（贴顶 / 悬空药丸 / 刘海 / 底边 / 左侧 / 右侧，Windows 任务栏可用时含任务栏嵌入及透明/跟随主题外观）并支持「轮播形态」；内置主题预设（玄墨 / 灰白 / 通透磨砂 / 暖纸磨砂）+ 液态玻璃 + 强调色 + 水母画风 + 开合动画现场试播。
   - **能力全景（`outfit`）**：4 组身份预设（可多选与无痛撤回）+ 11 项真实内置能力开关（待办、日历、音乐、AI Agent、剪贴板、文件中转、截图、翻译、计时器、语音输入、邮箱），右侧显示聚焦能力介绍并可「在真岛打开这一页」或「自动巡礼已选」。
   - **系统权限（`permissions`，仅 macOS 且需要时，前置在练习之前）**：自动撤掉压暗黑幕，方便切系统设置；可点「跳过此步」。
   - **上手体验（`play`）**：在真岛上完成展开、拖文件、剪贴板快捷键三项任务，每完成一项点亮一颗星；可点「跳过此步」。
   - **准备就绪（`release`）**：汇总当前形态、动效与已启能力数 + 开机启动 + **按需进阶配置中心（`EXTENSION_REGISTRY`）**（AI Agent 配置、推荐插件套装、邮箱、全部设置）。
2. **版本更新引导（`WHATS_NEW_REGISTRY`）**
   - **版本说明（`whatsNewNotes`）**：自动读取当前真实版本号、升级跨度与打包的本地中英文 Release Notes（`BUNDLED_RELEASES` + `historyNoteLines`），可跳转设置查看完整版本历史。
   - **多形态体验（`whatsNewForms`）**：复用的真实真岛形态选择器，让升级用户直接试玩多形态停靠。
3. **进阶配置工作区（`AGENT_SETUP_REGISTRY`）**
   - 从收尾页点「配置 AI Agent 与手机推送」进入宽卡片无黑幕工作区，串起可视化 5 布局 `AgentCardsAct`、`AgentConnectAct`（SSH / 钩子 / 回复标记）和 5 步 `PushAct`（cc-connect 手机推送）。

## 真岛自动化演示导演系统

- 前端导演 hook（`useOnboardingDirector.ts`）经跨窗口键 `fuyu-onboarding-director` 向真岛主窗口发送真实动作指令（`expand(page)`、`collapse`、`tuck`、`reveal`、`notify`），主窗口的 `useFirstRunGuide` 直接调用 `IslandApp` 自身的导航与通知函数，驱动 **100% 真实的 `IslandShell` 和 `IslandPages`**。
- 右上角提供悬浮导演控台 `DirectorHud`（显示当前演出的片段、暂停/继续、下一段）；遵循**用户优先原则**、切后台自动暂停（`visibilitychange`）与 `prefers-reduced-motion`（开启减少动画时停用自动轮播）。

## 左下角微信交流群二维码

- 首次引导与版本更新引导左下角常驻 `WechatCommunityCorner`，直接复用 `src/features/updater/community/` 的线上拉取机制（读 `community.json`、自动镜像源切换与过期判断）。
- 去掉独立放大按钮，整个卡片任意位置点击即可弹出屏幕正中央的 `280 × 280px` 超大白底二维码灯箱，点击遮罩空白、关闭按钮或按 `Esc` 关闭；右上角提供「收起」折叠为小胶囊。
- `useCardRect.ts` 通过 `requestAnimationFrame` 合帧并去重，将主卡片、右上角导演 HUD、左下角二维码卡片及打开时的居中灯箱矩形列表上报给 Rust 的 `set_onboarding_card_rects`，保证所有悬浮控件精准接鼠标、其余区域完全穿透到真岛和桌面。

## 回归页与单测

- 单元测试：`tests/unit/onboarding-flow.test.mjs`、`tests/unit/onboarding-placement.test.mjs`、`tests/unit/onboarding-personas.test.mjs`。
- 回归页：`tests/regression/onboarding.html`（`?act=1-5`、`?locale=en`、`?light=1`、`?open=1`、`?test=1`）与 `tests/regression/onboarding-push.html`。
