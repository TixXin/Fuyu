# 前端规则（src/）

适用于 `src/` 下的所有文件，在根目录 [AGENTS.md](../AGENTS.md) 的基础上补充前端细则。各文件从旧位置迁到新位置的映射见 [docs/architecture/migration-map.md](../docs/architecture/migration-map.md)。

## 目标结构

```text
src/
├── main.tsx                 # 唯一入口：按 ?window= 动态加载 windows/ 下对应的根组件，每个窗口只加载自己的代码（不要改回静态导入）
├── windows/                 # 每个 Tauri 窗口一个目录，只负责组合与窗口级行为
│   ├── island/              # 主窗口：IslandApp（只做组装）、IslandShell、展开后的页面面板（IslandPages）、岛自己的接线 hook（useIslandTucking / Hover、窗口尺寸/拖拽/贴边、自动化）；外壳不 import 功能（plugin-kernel 除外，边界测试查）：功能的界面在 `features/<领域>/plugin/` 里注册插槽项，接线写进它的 runner，影响岛形状的往贡献表里交（规则见 `docs/architecture/plugins/v3-boundary.md`「岛的贡献表」）；slots/ 是外壳自己的插槽项和插槽句柄，builtins.ts 先载外壳样式再经 pluginFiles.ts 收各功能的插件文件；first-hints/ 是岛上的「第一次」提示
│   ├── clipboard/           # 剪贴板独立窗口（列表在 features/clipboard/ClipboardPopup.tsx，弹出、定位和粘贴在 src-tauri/src/clipboard_history/popup.rs）
│   ├── screenshot/          # 截图的选区窗口（?window=screenshot，每个显示器一个）：冻结画面、选区拖动（useSelection.ts）、工具栏和放大镜
│   ├── settings/            # 设置窗口；slots/ 是窗口这一侧的注册：categorySlot.ts（SettingsPageProps 和分类句柄）、categories.tsx（窗口自己的页面，并用 glob 收进各功能的 features/<领域>/plugin/settings.tsx）、runners.ts（窗口自己的 settings.runner/v1 项）；分类清单、句柄和快捷键页分节的类型在 features/plugin-kernel/（settingsCategories.ts、settingsSlots.ts），功能的设置页和注册写在功能里，不加进这里；sections/ 是设置页共用的分节组件（外观、行为、主题、预设、快捷键、数据与备份、系统权限）
│   ├── onboarding/          # 新手引导（?window=onboarding）：透明遮罩压暗屏幕、照亮真岛，旁边的卡片分幕讲解（有哪几幕、各在什么情况下出现，看 `OnboardingWindow.tsx` 的 `ACTS` 和它下面的筛选）；新装第一次启动时由 island/useFirstRunGuide.ts 打开，设置 → 关于里能再打开；引导开着时岛放演示内容（island/useOnboardingDemo.ts）
│   ├── tray-menu/           # 托盘卡片（?window=tray-menu）：点托盘 / 菜单栏图标弹出的卡片，几种布局、Agent / 媒体 / 会议块、功能按钮和卡片偏好（窗口的创建和定位在 src-tauri/src/tray_menu/）
│   ├── drag-grid/           # 拖岛时的中线辅助线（?window=drag-grid）：只画横竖两条线，状态由 Rust 经 api.ts 推来
│   ├── plugin-window/       # 第 3 版插件的独立窗口（?window=plugin-window，实验能力 windows/v1）：overlay 带宿主受控护栏标题条（显示插件名与关闭按钮），渲染 plugin-window.view/v1 插槽
│   └── translation/         # 快捷翻译窗口
├── features/                # 业务领域，每个领域自包含
│   ├── todos/               # 待办、每日笔记、归档、Markdown 导出
│   ├── calendar/            # 日历页、收起时的会前倒计时与加入按钮、设置里添加日历
│   ├── media/               # 媒体控制、波形；lyrics/ 为同步歌词（解析 LRC、跟随进度、设置项）
│   ├── system-levels/       # 音量、亮度变化时收起的小岛上显示的提示、设置项
│   ├── device-events/       # 耳机与蓝牙音频连接断开、蓝牙电量低、插拔电源时收起的小岛上显示的提示、设置项
│   ├── device-use/          # 摄像头、麦克风使用提示：折叠岛上的图标、设置项
│   ├── clipboard/           # 剪贴板历史、快捷键
│   ├── file-shelf/          # 文件中转：拖到岛上的文件（只存路径）、拖出、复制、打开
│   ├── screenshot/          # 截图（C41）：选区的纯计算（selection.ts，物理像素和 CSS 像素的换算）、放大镜、api.ts
│   ├── center-pattern/      # 第 3 版内置插件 center-pattern（中心图案）：SVG 动画（眼睛跟随光标）、Codex Pets 宠物 sprite、宠物随 Agent 状态的 mood（经 agents/v1 读），配置在 plugins.yml，设置在 外观 的「中心图案」分组
│   ├── island-bridge/       # 不是插件：Rust 转给岛的请求（local-api-request）的桥，方法分发、待办经 todos/v1，开发版另有岛屿实验台的动作；runner 拥有者 builtin，本机接口和岛屿实验台共用，关掉本机接口不撤它
│   ├── local-api/           # 第 3 版内置插件 local-api（本机接口）：设置是 通用 里的一节（LocalApiSettings.tsx：允许修改、地址、复制令牌、重新生成令牌，令牌只由 Rust 复制）。岛上接 Rust 转来的请求（local-api-request）的桥不在这里，在 island-bridge/
│   ├── plugin-kernel/       # 插件平台第 3 版的窗口一侧：向 Rust 要宿主的地址（api.ts）、连宿主并按宿主登记的界面文件加载插件（runtime.ts，宿主默认启动，设 FUYU_PLUGINS_V3=0 关掉）；插槽：每个窗口一份注册表和各插槽的类型化句柄（slots.ts，名单和规则在 @fuyu/plugin-base/protocol 的 SLOTS）、渲染（SlotView.tsx）、订阅（useSlotEntries.ts），宿主关着时内置功能也经它们注册和渲染
│   ├── messages/            # 消息导航与预览；mail/、qq-notifications/、wechat/ 子目录；banner/ 为岛下方的新消息横幅（分组与计时）；arrivals/ 为新消息自动展开的面板（只列这次到达的消息）；settings/ 是设置页的两个标签（来源列表、提醒方式和它的演示）；island/ 是它们在岛上的接线：读 QQ、微信、邮箱和插件通知（useIslandNotices）、收起条预览、横幅（useIslandBanner）、到达面板（useIslandMessagePanel）、未读时的贴边保持
│   ├── agent-status/        # AI 代理状态；sounds/ 为 Agent 音效：内置音效播放、设置 → 声音页、导入音效包；push/ 为手机推送（Bark 或 cc-connect，排队到离开电脑再发）
│   ├── cc-connect/          # 第 3 版内置插件 cc-connect：设置是 AI Agent → 提醒 里的一节（CcConnectSettings.tsx 是程序路径和由岛启动，下面是找到的程序、找不到时下载、是否在运行、各项目聊过的会话）；CcConnectSetup.tsx 为新建机器人向导，FeishuSetup.tsx 为飞书扫码；plugin/services.ts 提供窗口服务 cc-connect/v1（定义在 lib/cc-connect/），手机推送经它发送和列目标
│   ├── claude-usage/        # 收起条上的 Agent 用量双环（内置插件 claude-usage）：Claude Code、Codex 的用量经 agents/v1 取，GLM、Kimi 的用量和 Key 是自己的命令（api.ts）；阈值配色与悬停卡片文案（usageRing.ts），配置在 plugins.yml（usageConfig.ts、useUsageConfig.ts），设置在 AI Agent 页的「用量环」分组；用量的共用类型和工具在 lib/agent-usage/
│   ├── session-ring/        # 收起条上的 Agent 会话环（内置插件 session-ring）：按状态分段计数与悬停卡片文案（ringCounts.ts），会话经 agents/v1 取（useRingSessions.ts），样式和会话数开关在 plugins.yml（ringConfig.ts、useRingConfig.ts），设置在 AI Agent 页的「会话环」分组
│   ├── ssh-tunnel/          # 第 3 版内置插件 ssh-tunnel：设置是 AI Agent → SSH 远程 里的一节（SshTunnelSettings.tsx 是本地代理选择、自定义端口与当前转发信息，SshTunnelHosts.tsx 是主机列表、服务器端口、占用确认、隧道状态与 export 行；useSshTunnelProxy.ts 轮询本地代理，tunnelPort.ts、tunnelConfig.ts 为纯校验）
│   ├── theme-market/        # 设置 → 主题市场：从 TixXin/fuyu-plugins 读取 themes.json，预览并应用或保存为预设
│   ├── translation/         # 快捷翻译：服务与模型设置、凭据、快捷键的类型化封装，请求与自动翻译 hook，岛内翻译页
│   ├── timer/               # 第 3 版内置插件 timer：计时器页、秒表、收起条的小块、到点提醒和休息提醒；host/ 是宿主部分（服务 timers/v1），plugin/services.ts 提供窗口服务 reminders/v1（岛上的提醒）；快捷键由 Rust 的 timer/ 注册
│   ├── voice-input/         # 第 3 版内置插件 voice-input：收起条上的录音和识别结果（存待办、追加笔记、复制）、设置页（下载语音模型、快捷键）
│   ├── sync/                # 跨设备同步的设置：后端（文件夹、WebDAV）、同步哪些类别、端到端加密、设备列表和状态；页面入口是 windows/settings/SyncSettingsPage.tsx
│   └── updater/             # 自动更新
├── components/              # 与领域无关的通用 UI（controls/ 开关、数字输入、下拉等控件，插件页和岛上还在用；settings/ 设置窗口的分组列表：组、行、开关行、滑块行、数字行、颜色、输入框、分段选择、下拉、文字链接，设置页都用它；list/ 岛上列表通用样式、行操作菜单与相对时间；markdown/ 把外部 Markdown 渲染成元素，不插入 HTML；island-preview/ 是设置和主题市场共用的岛预览）
├── lib/                     # 有副作用的通用基础设施，例如 localStorage 安全读写；settings/ 是岛屿设置（fuyu-settings）的模型：范围在 settingsLimits.ts、首次启动值在 settingsDefaults.ts、读取按领域在 normalizeLayoutSettings.ts、normalizeBehaviorSettings.ts，日历、歌词、Agent 会话列表和提醒的设置字段与默认值在 calendarSettings.ts、lyricsSettings.ts、agentSettings.ts，待办项目列表在 lib/todo-projects/，新设置加在这几个文件里，settings.ts 只做入口；theme/ 是主题、强调色、玻璃配色和动效（含 useReducedMotion）；shortcut/ 是快捷键的通用工具和录制（剪贴板专用的在 features/clipboard/shortcut.ts）；settings-backup/ 是设置文件、导出和恢复（只含 BACKUP_KEYS 列出的设置 key，并经 registerBackupSwitches 桥接内置插件开关）、升级前的备份；system-permissions/ 是系统权限的查询
├── utils/                   # 无副作用的纯函数（文本测量、颜色、日期、数值）
├── i18n/                    # 类型化多语言字典与 Provider；sections/ 按分区放文案（settings/ 再按设置页分），types.ts 与 locales/ 只做汇总
├── styles/                  # 全局 CSS：变量、基础样式、字体
└── assets/                  # 品牌图标、字体及其许可证
```

单个 feature 目录的标准组成（按需创建，不需要的文件不建）：

```text
features/<领域>/
├── <Name>Panel.tsx / <Name>.tsx   # 组件，每个文件一个主组件
├── use<Name>.ts                   # 领域状态与副作用 hook
├── api.ts                         # 本领域全部 invoke / listen 的类型化封装、事件名常量、与 Rust 对应的类型
├── storage.ts                     # 本领域的 localStorage key 与 load / save / normalize
├── types.ts                       # 本领域共享类型（类型较少时可省略，直接写在使用处）
├── <纯逻辑>.ts                     # 可单测的纯函数，例如 markdown.ts、shortcut.ts
├── host/                          # 内置插件的宿主部分（插件平台第 3 版，跑在 Node 里）：入口登记在 src/features/builtins.json；可以 import 本领域的纯函数，不能 import 浏览器的东西和 @tauri-apps/api（pnpm lint 会拦，规则在 eslint.config.js），数据写 ctx.dataDir；规则见 docs/architecture/plugins/v3-builtins.md「内置插件的宿主部分怎么写」
├── plugin/                        # 内置插件的窗口部分（由 windows/ 和 main.tsx 的 glob 收集，按拥有者挂在插槽与窗口服务表上，插件关闭时一并撤除）：owner.ts（插件 id 常量）、island.tsx（岛页面、页头按钮、收起条、刘海提醒）、runners.tsx（不画界面的岛接线与贡献上报）、settings.tsx（设置分类、分节、快捷键分节与设置窗口 runner）、services.ts（窗口服务注册）
└── <Name>.css                     # 与组件同名的样式文件
```

`features/messages/` 下的 `mail/MailPanel.tsx`、`qq-notifications/QQNotifications.tsx`、`wechat/WeChatReminders.tsx`采用的就是"领域 hook + 面板 + 控件"的组织方式，可作为样板。迁移时再把其中的 invoke 调用和存储 key 拆到 `api.ts` 与 `storage.ts`。

## 分层与依赖方向

```text
main.tsx → windows/ → features/ → components/、lib/、utils/、i18n/、styles/
```

- 只能向右（向下）依赖，下层不得 import 上层。`components/`、`utils/` 不得依赖任何 feature。
- `utils/` 只放纯函数，不依赖 React、Tauri、DOM 和 `localStorage`。
- feature 之间不直接 import：共享的类型、函数和样式上提到 `lib/`、`components/`、`utils/`，运行时要调别的功能走服务（插件平台第 3 版，见 `docs/architecture/plugins/v3-phase3-plan.md`「关键设计」第 4 条）。`tests/unit/feature-boundaries.test.mjs` 检查 feature 之间、`lib/`、`components/`、`utils/` 到 feature 的 import，以及 feature 到 `windows/` 的 import；`scripts/feature-boundary-allowlist.json` 已清零，不得新增白名单记录。
- `windows/` 负责组合 feature、处理窗口级状态（折叠/展开、尺寸、面板切换），不写领域逻辑。

## 边界收口

- **IPC**：`invoke`、`listen` 只出现在各目录的 `api.ts` 中。组件和 hook 调用 `api.ts` 导出的类型化函数，不直接写命令名字符串。
  - `api.ts` 中与 Rust 结构对应的类型，尽量和 Rust 结构同名，不写注释标明对应关系。
  - 事件名定义为常量，与 Rust 侧常量保持一致。
  - `listen` 返回的取消函数必须在组件卸载时调用，并处理"Promise 尚未 resolve 就已卸载"的情况。
- **持久化**：`localStorage` 只在各目录的 `storage.ts` 中读写，统一通过 `lib/` 中的安全读写函数完成。`src/i18n/index.ts` 中的语言偏好属于存量例外，已有测试覆盖。
  - load 函数必须容错：JSON 解析失败、字段缺失、旧格式数据都要回退到默认值，不能抛出异常。
  - key 名和数据格式属于对外契约，见根目录规则。格式需要演进时，在 normalize 中兼容旧数据。

## 文件与命名

- 组件文件用 `PascalCase.tsx`，hook 用 `useXxx.ts`，其他模块用 `camelCase.ts`，目录用 `kebab-case`。
- 一个 `.tsx` 文件只导出一个主组件；仅被它使用、且不超过约 50 行的小子组件可以放在同一文件。
- 不含 JSX 的逻辑不放进 `.tsx` 文件。
- 统一使用具名导出；`App` 根组件等存量的默认导出在迁移时一并改为具名导出。
- 行数上限见根目录规则。另外有两条软性上限，代码评审时检查：单个组件函数不超过 200 行，单个 hook 不超过 150 行。

## 组件与状态

- 单个组件的 `useState` 超过 8 个时，把相关状态抽成自定义 hook 或改用 `useReducer`。
- 一个 `useEffect` 只做一件事。订阅、定时器、监听器必须返回清理函数。
- 能由现有状态计算出来的值，直接计算或用 `useMemo`，不要用 effect 把一个 state 同步到另一个 state。
- 状态共享按以下顺序选择：props 下传 → 提升到共同父级的 hook → React Context。Context 只用于语言、主题这类全局低频数据。不引入第三方状态管理库。
- 主窗口在展开时有性能约束（见 `docs/investigations/expansion-performance.md`）。高频更新的状态（音频电平、计时器等）应放在叶子组件或独立 hook 中，避免带动整个窗口重渲染。
- 类型禁止使用 `any`；外部数据先当作 `unknown`，经过校验或 normalize 后再使用。

## 样式

- 组件的样式放在同目录、同名的 `.css` 文件中，由组件自己 `import`。
- 全局样式只放在 `styles/` 下：`tokens.css`（CSS 变量：颜色、圆角、间距、字号）、`base.css`（重置与基础元素）、`fonts.css`。
- class 名使用领域前缀（如 `todo-`、`media-`、`clipboard-`、`mail-`），新增 class 不得与已有 class 冲突。搬迁时保持原 class 名不变。
- 颜色、圆角、间距优先使用 CSS 变量，不新增散落的硬编码值。
- 岛屿有深色和浅色（`.island-light`，在 `tokens.css`）。文字、底色、边框的颜色不写死：中性色写 `rgba(var(--overlay-rgb, 255, 255, 255), a)`，状态色写 `var(--error-text, 原值)`、`--warning-text`、`--mint-text`、`--info-text`，深色岛保持原值，浅色岛用 `tokens.css` 里的值；只适合某一种底色的颜色写在 `.island-light` 规则里。`pnpm check:colors` 拦新增的写死颜色；`pnpm test:regression` 把每个回归页切成浅色岛量文字对比度（`scripts/regression-contrast.mjs`），确有理由的例外记在 `tests/regression/contrast-allowlist.json`。
- 保持现有视觉语言：悬浮岛、紧凑面板、透明背景、清晰的控件状态。界面方向以 `docs/design/README.md` 为准。
- 图标使用 lucide-react，不手写图标库已有的 SVG。
- 无障碍：能用键盘到达的控件要有 `:focus-visible` 样式（鼠标操作时 `base.css` 会隐藏按钮的焦点框）；只有图标的按钮写 `aria-label`。新的 `animation` 要在同一个文件里加 `@media (prefers-reduced-motion: reduce)` 停掉或改成不动的形式（`tests/unit/reduced-motion.test.mjs` 会检查）；`transition` 已由 `base.css` 统一处理。曲线、时长档位和减少动画的目标见 `docs/design/motion.md`，加或改动画前加载 `fuyu-motion` skill。

## 多语言

- 所有用户可见文案，包括 `aria-label` 和 `title`，都通过 `useTranslation()` 取得，不硬编码。
- 新增文案只改对应分区文件 `i18n/sections/<分区>.ts`（设置页文案在 `i18n/sections/settings/<子分区>.ts`）：同一个文件里有类型、`zhCN` 和 `en` 三处，由类型检查保证没有遗漏。只有新增整个分区时才需要改 `i18n/types.ts` 和 `locales/*.ts` 这几个汇总文件。
- 用户输入的内容（待办、笔记、预设名、消息原文）保持原样，不翻译。原生命令的错误用 `useErrorText()`（`src/i18n`）转成文字：带 code 的按界面语言显示（`sections/errors.ts`，D15），外部服务的原话和还没迁移的字符串原样显示；不要 `String(error)`。没有 React 的地方（日志）用 `utils/error.ts` 的 `getErrorMessage`，得到英文。

## 测试

这一节只记写法约束；要不要写测试、断言写成什么样、快照和失败怎么判断，先加载 `fuyu-testing` skill。

- 纯逻辑写在不含 JSX 的 `.ts` 文件中，由 `tests/unit/*.test.mjs` 用 `node:test` 覆盖。
- Node 直接加载 `.ts` 源码，所以被测模块必须满足：
  - 运行时的相对导入写完整的 `.ts` 扩展名（纯类型导入用 `import type`，可以不写扩展名）；
  - 只使用可擦除的 TS 语法，不用 `enum`、`namespace`、构造函数参数属性。
- `tests/unit/updater-controller.test.mjs` 和 `tests/unit/island-automation.test.mjs` 用 `vm` 加载源码，并按 import 路径注入 mock。修改这些被测模块的 import 时，必须同步更新测试里的 mock 表。
- 移动被测模块时，同步更新 `tests/` 中的导入路径，并确认测试通过。
- 浏览器回归页 `tests/regression/*.html` 用于检查界面和数据兼容性：`pnpm test:regression` 自动跑全部页面（新增页面时把它和启动检查的查询参数加进 `scripts/run-regression.mjs` 的 `PAGES`，结果写成 `<html data-test-result>` 或 `#results` 中的 PASS / FAIL 行）；也可以在 `pnpm dev` 启动后打开 `/tests/regression/<name>.html` 手动查看。设置窗口在 Tauri 之外打开会是空白，看设置页用 `settings.html`（`?page=<分类>` 直接打开某一页）。设置页的 mock 在 `tests/regression/settingsMocks.ts`，`settings.html`、`settings-search.html` 和 `settings-feature-off.html` 共用。设置窗口的搜索按设置行查找，行来自 `src/windows/settings/searchIndex.json`：新增、删除或改名设置项（`SettingsRow` 及开关、滑块、数字行）后运行 `pnpm settings:index` 重新生成并一起提交；不是设置的行（插件、主机、预设这类数据，空列表的说明）给 `SettingsRow` 传 `searchable={false}`。回归页不经过 `main.tsx`，新增回归页时要自己导入 `src/styles/tokens.css`，否则组件样式中的变量无法解析。回归页的 `.tsx` 由 `tsconfig.tests.json` 做严格类型检查（`pnpm check` 中的 `check:tests-types`），修改组件属性或 `api.ts` 类型时要同步更新回归页中的 mock。

## 新增 Tauri 命令清单

1. Rust 侧实现命令，加进所在模块的 `tauri_commands!`（由 `lib.rs` 的 `collect_commands!` 汇总，见 `src-tauri/AGENTS.md`「lib.rs 与模块组织」）。
2. 在对应 feature 的 `api.ts` 中添加类型化封装和返回类型。
3. 如果用到插件或核心权限，更新 `src-tauri/capabilities/default.json`。
4. 运行 `pnpm build` 和 Rust 侧要求的验证。
