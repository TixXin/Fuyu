# 存量测试体检（D84，2026-11-16）

按 `fuyu-testing` skill（F57）的原则，给存量测试做一次体检，列出清单给用户挑。这一步只体检，没有改任何测试、快照和源码。任务见 [D84](../tasks/D/D84.md)，issue #685。

## 查了什么、怎么查的

| 类别 | 范围 | 方法 |
|---|---|---|
| 回归页快照 | `tests/regression/snapshots/` 共 67 份（63 页深色 + 4 份浅色），25544 行 | 逐份统计行数和改动次数，搜时间文字、定时消失的提示、动画中途的类名和小数样式，两两比对重复，再回到页面源码核对 |
| 读源码的测试 | `rg -l readFileSync tests/` 共 35 个文件 | 逐个文件、逐条测试分类：A 查 import，B 读配置或数据，C 断言源码字符串 |
| 时好时坏的测试 | D73、D74、D76、E36.3.24/25、E38 等任务，#531、#535、#554、#367；最近 50 次失败的 CI；39 次成功 CI 的 regression 日志 | 看失败挂在哪一步、同一棵代码树别处过没过；搜固定等待、重试和超时 |

没有为了找时好时坏的测试去连跑回归页。

## 结论

- **快照**：没有发现存了时间或动画中途的状态，冻结时钟和 fixture 的写法是对的（见文末「查过、没问题的」）。存了定时消失状态的只有 1 页（`clipboard-links`）。主要问题是**快照太占地方**：SVG 图标内部占了 28% 的行；默认收起岛在约 14 份快照里各存一遍；11 份超过 1000 行。改一处岛就要重写十几份快照，差异没法逐行看，最后只能直接 `--update-snapshots` 了事。另有 10 份几乎是空的，什么也拦不住。
- **读源码的测试**：A 类 1 个（`feature-boundaries`，是范本），B 类 24 个（合理），**C 类 10 个文件 19 条测试**在断言源码字符串。其中 4 条会漏掉真 bug（发布不带资源、开发版才显示的设置、减少动效、原生错误码缺文案），另有 2 条已经被纯搬迁或 CRLF 弄挂过。
- **时好时坏**：最近 50 次失败的 CI 里有 7 次时好时坏，6 次已经修好。**还开着的只有 `agent-sessions-interact`**：同一棵代码树在 main 上挂、在 PR 上过，没有任务跟进。另有几处卡定时器的固定等待只留了 100 毫秒余量。运行器的 1 秒重抓在最近 39 次 CI 里一次都没触发过。

按严重程度：高 7 条、中 9 条、低 6 条。

---

## 高：会漏掉真 bug，或已经误报过

### H1 `agent-sessions-interact` 读透明度前固定等 40 毫秒（时好时坏，还开着）

- **文件**：`tests/regression/agent-sessions-interact.tsx:82-86`，检查「compact：平时「⋯」不显示」。
- **问题**：`await wait(40)` 之后马上读 `getComputedStyle(...).opacity === "0"`，透明度过渡没走完就读到中间值。main 上的 51deb19b 挂过（[run 43847478752](https://github.com/TixXin/fuyu/actions/runs/43847478752)），同一棵树在 PR #666 上过了（[run 43846577347](https://github.com/TixXin/fuyu/actions/runs/43846577347)）。更早「键盘选中时「⋯」出现」也是第 1 次挂、重跑过（[run 43758181070](https://github.com/TixXin/fuyu/actions/runs/43758181070)），61d1f5cb 只把那一项改成了轮询。整页还有 29 处固定等待，悬停卡片在第 194、196、210 行用 200、600、700 毫秒卡时间窗。
- **属于**：fuyu-testing「失败了先分诊」第 4 条：不用固定等待，轮询真实的就绪信号。
- **建议**：给这一页写一个 `until(predicate)`（每 50 毫秒查一次），先改透明度和悬停卡片这几处，其余 `wait()` 能换的一起换；改完单独连跑 30 次。工作量 M。

### H2 `clipboard-links` 的快照存了 6 秒后消失的「已复制」卡片

- **文件**：`tests/regression/snapshots/clipboard-links.html:16`，`已复制 · a.com`；页面 `tests/regression/clipboard-links.tsx:109`。
- **问题**：倒数第二步发出 `clipboard-item-copied`（`seconds: 3`，链接取 `max(3, LINK_SECONDS=6)`，6 秒后 `setCurrent(null)`），之后页面没等卡片消失就报通过了，快照里存的是卡片还在的样子。现在能过，是因为从发事件到抓深色、浅色快照不到 6 秒。CI 机器慢、对比度检查耗时一长，浅色那份就会抓到卡片已经没了；1 秒重抓也救不回来。和 D74 是同一类问题，还没在 CI 上挂过。
- **属于**：「快照」一节：定时消失的状态不存进快照，轮询到它回落再报通过。
- **建议**：断言完点「关闭」，或者轮询到 `.clipboard-copy-notice` 消失再报通过，然后更新这一份快照。工作量 S。

### H3 `plugins-v3-settings-gate`：查「没写 `import.meta.env.DEV`」只查了 4 个文件

- **文件**：`tests/unit/plugins-v3-settings-gate.test.mjs:16-18`，「the plugin platform v3 window code follows the Rust switch, not the build kind」。
- **问题**：对 4 个点名的文件断言不含 `import.meta.env.DEV`，再对 `usePluginHostStatus.ts` 匹配 `/connection\?\.enabled === true/`。第 5 个文件写了 `DEV`，或者写成 `import.meta.env.MODE === "development"`，测试照样过，结果是插件平台的设置页只在开发版里出现。反过来，把判断写成 `Boolean(connection?.enabled)` 或者把 hook 挪到别的文件，测试就挂。
- **属于**：「放在哪一层」：不用 `readFileSync` 匹配字符串，漏一处它不挂，换个写法它就挂。
- **建议**：改成 ESLint `no-restricted-syntax`，对 `src/features/plugin-kernel/**` 和插件宿主的 hook 禁用 `import.meta.env.DEV` / `MODE`（按 AST 查，覆盖所有文件）；删掉 `=== true` 那条正则，同文件第 1 条测试已经测了 `isCategoryAvailable`。工作量 S。

### H4 `plugins-v3-release-resources`：拿字符串查发布配置和 macOS 工作流

- **文件**：`tests/scripts/plugins-v3-release-resources.test.mjs`，下面两条：
  - 「both Windows release overlays carry the same resources」的本地这一半：在 `scripts/release/prepare-release-config.mjs` 上匹配 `/resources: releaseResources\(\)/` 和 `/await prepareReleaseResources\(\)/`。
  - 「the macOS release build bundles the resources after preparing them」：在 `.github/workflows/release-macos.yml` 上用 `indexOf` 找 `run: node scripts/plugins-v3/release-resources.mjs\n` 是否排在 `--config "$(node … --overlay)"` 前面，再逐个 `includes` 要带的文件名。
- **问题**：调用在、但值后来被覆盖或没传进配置，测试照过，**发出去的安装包不带插件资源**。写成 `{ ...releaseResources() }`、`Promise.all([...])`、`pnpm node …`、换个引号，或把步骤挪进 composite action，测试就挂。文件名只出现在一句 `echo` 里也算过。macOS 那条已经因为 CRLF 挂过一次（388adf2b）。
- **属于**：「放在哪一层」：守「发布带上某个文件」要直接跑脚本、查产物，不匹配工作流文本。
- **建议**：`prepare-release-config.mjs` 导出一个纯的配置构造函数，断言它的 `bundle.resources` 等于 `RELEASE_RESOURCES`（CI 那一半已经用 `windowsOverlay()` 这么做了）；macOS 的准备、构建、校验挪进 `scripts/release/macos-build.mjs`，导出 overlay 和校验函数来测，YAML 里只调用这个脚本。工作量 M。

### H5 `plugin-slot-theme`：在 `SlotView.tsx` 上匹配一整段 JSX

- **文件**：`tests/unit/plugin-slot-theme.test.mjs:28`，「the slot renderer loads the theme and wraps only plugin items in .plugin-slot」。
- **问题**：匹配 `item\.external \? \(\s*<div className="plugin-slot" data-slot=\{slot\.name\}>` 和 `import "./PluginSlot.css";`。抽一个 `<PluginWrapper>`、把三元换成 `if`、调换属性顺序都会挂，而回归页 `tests/regression/plugin-slot.tsx` 已经检查了外层、`data-slot`、`display: contents` 和每个主题变量都有定义。
- **属于**：加测试前的第 2、3 个问题：等价重构会挂；已有检查已经拦住了。
- **建议**：删掉这条；在 `plugin-slot` 回归页加一个内置项，断言它不在 `.plugin-slot` 里面。工作量 S。

### H6 `reduced-motion`：自己写的 CSS 括号解析器，有盲区，D85 一改就会挂

- **文件**：`tests/unit/reduced-motion.test.mjs`，「every animation stops or calms down when Windows asks for less motion」。
- **问题**：遍历 `src/**/*.css`，每个写了 `animation:` 的选择器都要以子串形式出现在某个减少动效的块里。盲区有三处：其他 `@media`、`@supports`、`@container` 里的动画直接跳过（第 55 行 `prelude.startsWith("@")`）；`Element.animate()` 这类 JS 驱动的动效查不到；子串匹配会误判通过（`.toast` 因为别处有 `.toast-x` 就算过）。反过来，把减少动效统一成「在 `prefers-reduced-motion` 下把 `--motion-*` 时长归零」或一条全局 `*` 规则，其余文件全部挂。D85 正在做动效 token（00de9cf9），正好会撞上。
- **属于**：「放在哪一层」：断言结果，不锁写法。
- **建议**：改成回归页检查：用 `scripts/regression/cdp.mjs` 已有的减少动效模拟（`agent-list-motion` 等页已经在用），在有动画的几页断言 `document.getAnimations()` 为空或时长为 0，然后删掉这个单元测试。和 D85 的会话商量好先后再动。工作量 M。

### H7 `native-error`：只认 `UserError::new("字面量")`，看不见变量传进来的错误码

- **文件**：`tests/unit/native-error.test.mjs`，「every code the native side sends has its wording」。
- **问题**：用 `/UserError::new\("([A-Za-z.]+)"/` 扫 `src-tauri/src/**/*.rs`，再查 `errors.ts` 里都有文案。错误码用变量传入的 4 处（`user_error.rs:141`、`lyrics/inflink.rs:118`、`calendar/mod.rs:117`、`system/download_mirrors.rs:84`），以及 `http_error("calendar.read", …)`、`failed("credential.save", …)` 这类包装函数都扫不到。现在这些码碰巧都有文案，以后新加一个没文案的，用户会看到原始错误码，测试照样过。
- **属于**：「放在哪一层」：漏一处它不挂。
- **建议**：Rust 侧把错误码收进一个列表（`const CODES` 或给 `UserError::new` 用的枚举），用 `cargo test` 把列表和 `src/i18n/sections/errors.ts` 对一遍，或者导出成 JSON 让前端测试读。工作量 M–L，要动 Rust。

---

## 中：容易误报、藏问题，或让快照形同虚设

### M1 单元测试里卡定时器的固定等待

- **文件**：
  - `tests/unit/todo-migration.test.mjs:169`：`setTimeout(resolve, 2100)` 赌约 2 秒的重试定时器已经跑过，只留约 100 毫秒余量。
  - `packages/plugin-base/test/guarantees-health.test.mjs:109`：`sleep(600)` 之后马上断言 `auto-disabled`。
  - `packages/plugin-base/test/main-health.test.mjs:160`、`builtins-dev.test.mjs:75`：`sleep(300/400)` 等文件监听就绪，再写文件。
- **问题**：还没在 CI 上挂过，但都是在和定时器抢时间。plugin-base 的 `serve::tests` 就是这么挂过两次（8972a2ab、66abac56 修好）。Windows CI 慢一点就会挂。
- **属于**：「失败了先分诊」第 4 条。
- **建议**：重试间隔能注入的就注入一个短值，或者轮询到 `writes.length === 3` 或状态变成 `auto-disabled`；文件监听等它发出就绪信号再写。工作量 S，每处一小改。

### M2 回归页大量固定等待

- **文件**（固定 `wait(N)` 处数，最长时长）：`calendar.tsx` 31 处（40 ms）、`agent-approvals.tsx` 26 处（1100 ms，没有一处轮询）、`tucked-hover.tsx` 17、`agent-alerts.tsx` 17（1100 ms）、`agent-list-motion.tsx` 13（900 ms）、`claude-usage.tsx` 11、`onboarding.tsx` 10、`agent-alert-card.tsx` 10、`onboarding-push.tsx` 9（5200 ms）；页面里直接写的长 `setTimeout`：`agent-sessions.tsx:230`（1100 ms）、`settings.tsx:299/309`（1200、1500 ms）、`liquid-glass.tsx:92`（1400 ms）、`ssh-tunnel.tsx:120`（3200 ms）、`music-lyrics.tsx:110`（1100 ms）、`lyrics-handoff-checks.tsx` 的 `pause(4300)`；`list-pages.tsx:137` 的 `type()` 里固定等 300 ms。
- **问题**：只在本地挂过、没有任务跟进的几页：`list-pages` 的拼音搜索 kzz（D74 交接里写着改成轮询后仍挂过 1 次，pinyin-pro 冷启动慢）、`music-lyrics` 并行构建时计时检查失败（E36.3.24）、`claude-usage` 和 `bottom-island` 机器负载高时超时（E36.3.25）。这些长等待也拖慢了整套回归页。
- **属于**：「失败了先分诊」第 4 条。
- **建议**：把 H1 写的 `until()` 放进回归页共用的工具里，按页改，先改上面四页挂过的，再改等待最多的几页。工作量合计 L，按页拆，每页 S–M。

### M3 快照里 SVG 图标内部占了 28% 的行

- **范围**：全部快照共 25544 行，其中 SVG 和 path 这类行 7164 行，lucide 图标 1315 个。`clipboard-popup` 886 行、`session-ring` 704 行、`todo-island` 601 行都是 SVG。
- **问题**：升级 lucide-react 或换一个图标，几十份快照跟着重写，和行为无关，差异里真正的回归也被淹掉。
- **属于**：「放在哪一层」：整页快照只防意外变化；变化太多就没人看了，形同虚设。
- **建议**：在 `scripts/regression/snapshots.mjs` 的 `CAPTURE` 里，带 `lucide` 类名的 `<svg>` 只留开标签（类名能看出是哪个图标），不写子节点；再一次性重写全部快照。工作量 S，但要挑一个界面提交少的时候做，避免和别的会话的快照更新撞上。

### M4 默认收起岛在约 14 份快照里各存一遍

- **范围**：`notch-island.html` 和 `island-forms.html` 一字不差，`bottom-island.html` 只差 3 处；`liquid-glass`、`side-island`、`update-reminder`（深浅两份）、`collapsed-message-animation`、`session-ring`、`message-panel`、`message-banner`、`music-lyrics`、`claude-usage`、`collapsed-slots` 都包含收起岛 107 行里的 67–101 行。
- **问题**：这几页结束时都回到了默认收起岛，快照存的是同一个东西，和这一页要测的形态、横幅、歌词无关。改一次岛壳就要重写十几份。
- **属于**：「快照」和「放在哪一层」：回归页断言契约，不拿整页快照顶替。
- **建议**：要定一个快照策略（见文末「要你定的」）。可以让每页停在它要测的那个状态再抓快照，也可以只抓这一页测的那块区域，或者干脆不给这几页存快照。工作量 M。

### M5 超过 1000 行的快照有 11 份

- **范围**：`clipboard-popup` 3984 行、`session-ring` 1899、`todo-island` 1756、`plugins-v3` 1349、`list-pages` 1251、`tray-menu` 和 `tray-menu-en` 各 1214、`island-colors` 1164、`update-reminder` 深浅各 1117、`plugin-views` 1106。
- **问题**：这么长的差异没人逐行看，`--update-snapshots` 前「只该有自己改的那几处」这一条执行不了。
- **建议**：先做 M3，去掉 SVG 后再量一次；还超过 1000 行的，按 M4 定下来的策略拆成几个小场景，或者只抓要测的区域。工作量 M。

### M6 `light-island-colors`：用正则禁用白色字面量

- **文件**：`tests/unit/light-island-colors.test.mjs`，「island styles write neutral whites through --overlay-rgb…」。
- **问题**：正则只认 `rgba(255,255,255,` 和 `color: #fff;`，另有一份按文件名的放行名单。纯搬迁就挂过一次：3eb0e6ad 把玻璃样式挪进 `IslandGlass.css`，270aa506 只好把它加进名单。`white`、`rgb(255 255 255 / .1)`、`#ffffffcc`、`background: #fff` 都查不出来。
- **建议**：并进 `pnpm check:colors`（它已经在扫 CSS 颜色字面量，还按文件计数），或者交给 `regression-contrast` 的浅色岛对比度检查，然后删掉这条。工作量 S–M。

### M7 `nsis-template`：锁死安装器脚本的行排列

- **文件**：`tests/scripts/nsis-template.test.mjs`，「the installer's shortcuts are named 浮屿, and old Fuyu.lnk ones are renamed or removed」。
- **问题**：要求 `!define SHORTCUTNAME "${U+6D6E}${U+5C7F}"`、每行 `${PRODUCTNAME}.lnk` 都带 `${dir}`，以及 `Function CreateOrUpdateDesktopShortcut` 下面紧跟着的两行一字不差。函数里多加一行就挂。同一条里查 ASCII 的部分没问题。
- **建议**：`scripts/release/smoke-test.ps1` 已经在干净机器上装了真安装包，让它断言 `浮屿.lnk` 在、`Fuyu.lnk` 不在，然后删掉这几条正则，ASCII 检查留下。工作量 M，属于发布相关，要跑完整的 `pnpm tauri build`。

### M8 `plugins-v3-release-resources` 后两条

- 「development builds and build:exe do not bundle the resources」：在 3 个 Tauri JSON 和 2 个构建脚本上断言不含 `plugins-v3` 字样。任何无关的提及都会挂，而且文件清单是写死的。建议解析 JSON 查 `bundle.resources`，两个脚本导出配置再断言。工作量 S–M。
- 「the Windows smoke test checks every shipped file」：在 `smoke-test.ps1` 上逐个 `includes` 路径，路径只出现在一句输出里也算过。建议把清单作为参数传给脚本，或者让脚本从安装包里读，清单只留一处。工作量 S。

### M9 运行器的 1 秒重抓是一次重试，只打印不失败

- **文件**：`scripts/regression/snapshots.mjs:171-182`（`RECAPTURE_MS = 1000`），`scripts/run-regression.mjs:229`。
- **问题**：快照不一致时等 1 秒重抓，一致就算过，只打印 `snapshot settled late`。这是 D73 有意加的、写进了文档，但它就是重试；提示只打印、不失败，混在几百行输出里没人看。最近 39 次成功 CI 和所有失败日志里一次都没出现过，说明现在没有在悄悄救场。
- **属于**：「失败了先分诊」第 4 条（不加重试）和「快照」一节（打出 `settled late` 就是这一页有问题）。
- **建议**：既然一次都没触发，就让 `settled late` 在 CI 上（`CI=true` 时）直接算失败，本地照旧只提示。这样以后哪页开始存会变的状态，第一次就会被发现。工作量 S。

---

## 低：写法不好，暂时不碍事

### L1 几乎是空的快照有 10 份

- **范围**：只有空 `#root` 的 5 份：`builtins-off`、`i18n`、`onboarding`、`settings`、`todos-off`。只有测试外壳的 2 份：`agent-approvals`、`agent-alert-card`。提示消失后只剩一条空黑条的 2 份：`clipboard-notice`、`screenshot-card`。还有 `screenshot-pin` 存的是 `pin-window--closing`，也就是淡出到一半的窗口（测试里关窗被 mock 了，所以是稳定的）。
- **问题**：页面结束时已经卸载或者回到空状态，快照什么也拦不住，只是让快照数量显得多。不会误报。
- **建议**：先不动。如果按 M4 定了「每页停在要测的状态」，这几页一起改；也可以让运行器遇到空 `#root` 时不写快照（这是对没内容的页不存，不算放行名单）。工作量 S。

### L2 4 份浅色快照只比深色多一个类名

- **范围**：`onboarding-push.light`、`settings-feature-off.light`、`settings-search.light`、`update-reminder.light`，各自和深色那份只差 1 行，比如多了 `settings-stage--light`。运行器本来就会删掉和深色完全一样的浅色快照。
- **建议**：留着不动。做完 M3、M5 后它们会自然变小；也可以在抓快照时把这个类名规范掉，不过收益很小。

### L3 `tray-menu` 和 `tray-menu-en` 各 1214 行，只差文案

- **问题**：两份结构一样，差的 170 行全是中英文案。英文页本意是看英文文案对不对，整页快照把结构也重复存了一遍。
- **建议**：英文页不存快照，改成断言几处关键英文文案和「没有中文残留」。工作量 S。

### L4 断言源码字符串、但目前没惹过麻烦的几条

| 文件和测试 | 断言什么 | 建议 |
|---|---|---|
| `light-island-colors`「the light island sets the overlay, error, warning and popover colours」 | 从 `tokens.css` 的 `.island-light {` 截到文件尾，`includes("--x:")` | 改成回归页里在 `.island-light` 元素上读 `getComputedStyle`，S |
| `motion-tokens` 3 条（今天刚加，00de9cf9） | 正则读 `tokens.css` 第一个 `:root` 块，和 `motionTokens.ts` 对比 | 能拦住两份定义不一致，可以留着；更好的做法是只留一处定义，另一处生成。和 D85 一起看，S–M |
| `plugin-slot-theme` 第 1、3 条 | 正则读 `PluginSlot.css` 和示例插件的 `island.js` | 留着，或者第 1 条并进 `plugin-slot` 回归页，S |
| `plugin-sdk`「the PowerShell module exports every function…」导出那一半 | 正则对 `.psm1` 的函数名和 `.psd1` 的导出列表 | 失败时报错很明显，留着；或者改成只在 Windows 上跑的 `Import-Module` + `Get-Command`，S |
| `release-smoke`「the workflow the release starts exists and runs the PowerShell check」 | 在 `release-smoke.yml` 上找脚本路径 | 留着，真发版时会暴露问题 |
| `host-lint`「pnpm lint covers the plugin base host」、`plugins-v3-bundle-host` 的打包横幅 `__fuyuCreateRequire`、`build-builtins` 第 1、4 条对产物的 `doesNotMatch` | 正则查已解析的配置字符串和构建产物 | 留着，后面的启动步骤已经证明了同一件事 |

### L5 `island-automation`、`updaterTestRuntime.mjs` 的假 `require`

- 这两个文件把 `.ts` 转译后放进 vm 里跑，是行为测试，没问题。唯一脆的地方是：除了 `"./api"` 以外的 import 一律拿到假 React，hook 里新加一个 import 测试就挂，不过挂得很明显。留着不动。

### L6 `release-history` 拿真实的发布说明当 fixture

- 读 `docs/releases/v0.3.9-beta.1.md` 当输入。那份说明以后被改，测试就挂。留着；真改到时把它复制成 `tests/fixtures/` 里的固定文件。

---

## 不用动的

- **A 类（查 import）**：`tests/unit/feature-boundaries.test.mjs`，从 `src/` 建出 import 图，再和 JSON 放行名单比对。其他架构规则都应该照这个写。
- **B 类（读配置、数据、产物，24 个文件）**：
  - 只读临时目录里自己的输出：build-app-macos、mq-commit-part、mq-sync、plugins-v3-install-demo、plugins-v3-measure、regression-snapshots、release-manifest、timer-host。
  - 解析 JSON，或者拿提交的文件和生成器的输出比对：plugin-index、readme-assets、plugin-sdk 第 1 条、regression-contrast、sync-settings-whitelist、plugin-view-model、builtin-switches、builtins-off、feature-domains、release-version。
  - 查原始字节是不是纯 ASCII：weather-plugin，以及 plugin-sdk、nsis-template 里的 ASCII 部分。
  - `feature-domains` 第 1 条读真实的 `api.ts`，但交给生产代码的 `ipcDomains` 去解析，是拿真实输入测行为。

## 查过、没问题的

- **时间文字**：`clipboard-popup` 里的「刚刚」「5 分钟前」、`claude-usage` 的「2 分钟前更新」这类，fixture 都按 `Date.now()` 往前推，而 `FREEZE_CLOCK` 在每页加载时把时钟重置到 2026-11-15 10:00。页面跑不到一分钟就不会变。
- **`todo-island` 的「已保存」**：是 fixture 直接传进去的 `saveState: "saved"`，不是保存后 1.2 秒就复原的那个状态。
- **`timer` 的「倒计时 · 05:01」**：1 秒的倒计时到点后加 5 分钟，`durationMs` = min(1 s, 已过时间) + 5 min，结果是确定的。
- **动画中途**：快照里没有动画中途的小数 transform 或透明度。出现的 `scaleX(0.35)`、`opacity: 0.9` 都来自 fixture 的进度值。

## 已经修好的时好时坏（不用再做）

| 测试 | 证据 | 怎么修的 |
|---|---|---|
| `todo-island` 菜单（D76，#554） | [run 43770379329](https://github.com/TixXin/fuyu/actions/runs/43770379329) 在 main 上挂，同一棵树在 PR 上过 | 6228b635，等滚动事件送达后再开菜单，之后连跑 30 次都过 |
| `agent-sessions` 快照里的运行秒数 | [run 43748420988](https://github.com/TixXin/fuyu/actions/runs/43748420988)、[run 43750589781](https://github.com/TixXin/fuyu/actions/runs/43750589781) | 2948ef85，加进 `LIVE_TEXT` |
| `side-island` 抓在切换动画中途（D73，#531） | [run 43754873986](https://github.com/TixXin/fuyu/actions/runs/43754873986) 重跑后过 | 7ffb478b |
| plugin-base `serve::tests`（只在 macOS 上） | [run 43738832386](https://github.com/TixXin/fuyu/actions/runs/43738832386)、[run 43745093827](https://github.com/TixXin/fuyu/actions/runs/43745093827) | 8972a2ab、66abac56，改成等真实信号 |
| plugins-v3-measure 的 busy 长跑测试（E38，#367） | [run 43716489619](https://github.com/TixXin/fuyu/actions/runs/43716489619) | d0aeceea |
| plugin-cli 的 git 提交检查（只在 Windows 上） | [run 43745201332](https://github.com/TixXin/fuyu/actions/runs/43745201332) | 827adad7 |

D74（#535）不算时好时坏：那 4 页存的是过一会儿会自己变回去的状态，结果是确定的，544dbb20 已修好。

## 最近 50 次失败的 CI 怎么分

| 类别 | 次数 | 说明 |
|---|---|---|
| 真问题，后来的提交修好了 | 33 | Windows `0xc0000139` 9 次（D77）；CRLF 和 Windows 路径 11 次；clippy 6 次；任务检查 5 次；行数超限 3 次；托盘页没还原 `localStorage` 连累后面的页 4 次（8fb84f27）；其余零散 |
| 快照没跟着更新 | 7 | 界面本该变，提交时漏带了快照 |
| 时好时坏 | 7 | 6 次已修，1 次是 H1 |
| 环境或工作流 | 3 | update-behind 找不到分支或遇到冲突；第一批快照 Windows 和 Mac 渲染不同（0d2105f6 修好） |

一次运行只按主要原因算一次。

---

## 分批建议

每批一个会话，scope 互不重叠，可以并行（第 2 批要重写全部快照，最好单独挑时间做）。

| 批 | 内容 | 范围 | 工作量 | 验证 |
|---|---|---|---|---|
| **1 时好时坏（建议先做）** | H1、M1，以及 M2 里挂过的四页（`list-pages`、`music-lyrics`、`claude-usage`、`bottom-island`） | `tests/regression/` 共用工具和这几页、`tests/unit/todo-migration.test.mjs`、`packages/plugin-base/test/` | M | 每页单独连跑 30 次；`pnpm check` |
| **2 快照瘦身** | H2、M9、M3，再按「要你定的」第 1 条处理 M4、M5、L1、L3 | `scripts/regression/`、`tests/regression/snapshots/`、相关几页 | M（只做 H2+M9+M3 是 S） | `pnpm test:regression --update-snapshots` 后逐份看差异；`pnpm check` |
| **3 源码字符串改成行为或 lint** | H3、H5、M6、L4 里值得改的 | `tests/unit/`、`eslint.config.js`、`tests/regression/plugin-slot.tsx`、`scripts/check-colors*` | S–M | `pnpm check`、`pnpm test:regression plugin-slot` |
| **4 发布相关** | H4、M7、M8 | `scripts/release/`、`.github/workflows/release-macos.yml`、`tests/scripts/` | M | 完整的 `pnpm tauri build`，再 `pnpm mq:try --wait` 看两个平台 |
| **5 减少动效（和 D85 一起）** | H6，以及 L4 的 `motion-tokens` | `tests/unit/reduced-motion.test.mjs`、相关回归页 | M | `pnpm test:regression`；先和 D85 的会话商量先后 |
| **6 Rust 错误码** | H7 | `src-tauri/src/user_error.rs` 等、`tests/unit/native-error.test.mjs` | M–L | `cargo test`、`pnpm build:exe` |
| **7 其余固定等待（可以缓）** | M2 剩下的页 | `tests/regression/` 各页 | L，按页拆 | 每页单独连跑 |

## 要你定的

1. **快照策略**（影响第 2 批的 M4、M5、L1、L3）：
   - 甲：保留整页快照，只去掉 SVG（M3）和 H2，其余不动。最省事，但改一次岛还是要重写十几份。
   - 乙：每页停在它要测的那个状态，或者只抓这一页测的那块区域。改动面大，之后每份快照只对应一件事。
   - 丙：只给「图库」类的页存快照（`list-pages`、`island-colors`、`settings*` 这类专门铺开界面的），其余页只靠断言。快照最少，但图库以外的页面意外变了就发现不了。
2. 先做哪几批。建议 1 → 2（按甲或乙）→ 3，4、5、6 等相关的会话空出来再做。
