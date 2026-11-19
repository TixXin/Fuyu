# 服务、接缝与插槽参考

本文档列出插件平台已转正的全部**公开服务（`@fuyu/plugin-services`）**、**7 个扩展接缝（Seam）**与**窗口界面插槽（`@fuyu/plugin-base/protocol` 的 `SLOTS`）**。

---

## 一、公开服务（`@fuyu/plugin-services`）

在宿主插件中通过 `ctx.services.get(serviceDef)` 调用（并在 `package.json` 的 `fuyu.inject.required` 或 `optional` 中声明服务名）；在窗口插件中通过 `ctx.services.get(serviceDef)` 调用。想要整体替换某项内置服务的插件，在 `package.json` 中声明 `fuyu.provides` 与 `fuyu.replaces`，并在宿主调用 `ctx.services.provide(serviceDef, impl)`。

| 服务名 | 导出常量 | 默认提供者 | 方法 | 事件 | 说明 |
|---|---|---|---|---|---|
| `agents/v1` | `agentsV1` | `agents` | `sessions()`、`usage()`、`focus({ provider, sessionId?, cwd?, title? })`、`remoteHosts()` | `changed` | AI 代理会话列表、额度用量、跳到对应终端或编辑器窗口、SSH 远程电脑列表 |
| `calendar/v1` | `calendarV1` | `calendar` | `events({ refresh? })`、`sources()` | `changed` | 读取上月初至下月底的日程列表与失败源诊断（`problems`），不含订阅链接与密码 |
| `clipboard/v1` | `clipboardV1` | `clipboard` | `history({ limit? })`、`copyText({ text })`、`pasteText({ text, enter? })` | 无 | 读取最近复制的文本记录（1–50 条）、写入剪贴板历史、向当前前台窗口粘贴文本 |
| `commands/v1` | `commandsV1` | 宿主内核 | `list()`、`run({ plugin, command, args? })`、`setKeybinding({ plugin, command, keybinding })` | `changed` | 列出已声明与运行中注册的插件命令、执行命令、修改或恢复全局快捷键及查询冲突状态 |
| `file-shelf/v1` | `fileShelfV1` | `file-shelf` | `list()`、`add({ paths })` | 无 | 读取文件中转列表、将 1–20 个本地绝对路径加入文件中转 |
| `lyrics/v1` | `lyricsV1` | `music` | `lookup(query)`、`sources()` | `changed` | 查询当前曲目的 LRC 同步歌词与双语翻译、列出已登记的歌词来源 |
| `market/v1` | `marketV1` | `updater` | `catalog()`、`refresh()`、`inspectPackage({ base64 })`、`installMarket({ name, version? })`、`installFile({ base64, expectedSha256? })`、`setManualAllowed({ allowed })`、`setEnabled({ id, enabled })`、`uninstall({ id, removeData? })` | `changed` | 插件市场索引拉取与验签、3 天冷静期筛选、`.fuyu` 包预检与安装、撤销停用、第三方插件启停与卸载 |
| `media/v1` | `mediaV1` | `music` | `nowPlaying()`、`playPause()`、`next()`、`previous()`、`seek({ positionMs })` | 无 | 读取当前系统媒体播放状态与控制播放/上曲/下曲/跳转进度 |
| `messages/v1` | `messagesV1` | `messages` | `sources()`、`notify(notice)`、`clear({ source? })` | `changed`、`arrived`、`action` | 查询各消息来源未读状态、推送结构化新消息通知（进收起条预览、横幅与到达面板）、清理未读 |
| `plugin-config/v1` | `pluginConfigV1` | 宿主内核 | `list()`、`get({ id })`、`set({ id, values })`、`reset({ id })` | `changed` | 按插件 `fuyu.config` JSON Schema 读取、校验、持久化与重置插件配置（`<dataDir>/<id>/config.json`） |
| `plugin-windows/v1` | `pluginWindowsV1` | 宿主内核 | `getRules({ id })`、`setRules({ id, disallowAlwaysOnTop?, disallowClickThrough?, hideAll? })`、`list({ id? })` | `changed` | 查询当前实验性独立插件窗口状态，以及读写「禁止置顶 / 禁止点击穿透 / 隐藏全部窗口」护栏规则 |
| `reminders/v1` | `remindersV1` | `timer`（主窗口） | `push({ id, source, icon, title, detail?, snoozable? })` | 无 | 往主窗口提醒队列推送一条提醒卡片 |
| `timers/v1` | `timersV1` | `timer` | `list()`、`start(params)`、`pause({ id })`、`resume({ id })`、`extend({ id, seconds })`、`remove({ id })`、`dismissRinging()`、`adopt({ timers })` | `changed`、`due` | 倒计时、番茄钟与秒表的增删改查及到点事件 |
| `todos/v1` | `todosV1` | `todos` | `list({ date? })`、`days({ from, to })`、`add({ title, date?, project? })`、`update({ id, title?, completed? })`、`remove({ id })`、`note({ date? })`、`setNote({ note } \| { append })` | `changed` | 今日待办、未来排期、历史归档与每日笔记读写 |
| `translator/v1` | `translatorV1` | `translation` | `translate(params)`、`rewrite(params)`（流式 `progress`）、`engines()` | `changed` | 文本翻译、流式 AI 改写、查询已配置引擎列表（不含密钥与自定义地址） |

---

## 二、7 个扩展接缝（Seam：多加一个来源 / 引擎 / 动作）

除了通过 `provides` / `replaces` 整体替换上述服务外，插件还可以只往内置功能里**多加一个来源、引擎或动作**，插件停用时注册项自动撤除：

| 接缝 | 宿主注入名（`inject`） | 宿主访问器 | 注册项要点 |
|---|---|---|---|
| **1. 翻译引擎** | `translator.engines` | `ctx.translatorEngines.register(spec)` | `{ engine, label: { "zh-CN", en }, defaultModel, hasSecret?, translate(params), rewrite?(params, onPiece) }`，自动出现在翻译设置下拉框 |
| **2. 歌词来源** | `lyrics.sources` | `ctx.lyricsSources.register(spec)` | `{ id, label, order?, beforeBuiltin?, lookup(query) }`，按 `order` 优先级参与歌词查找 |
| **3. 日历来源** | `calendar.sources` | `ctx.calendarSources.register(spec)` | `{ id, name, host?, events({ refresh }) }`，日程与内置 ICS/CalDAV 合并去重，单源抛错隔离进 `problems` |
| **4. AI 代理接入** | `agents.sources` | `ctx.agentSources.register(spec)` | `{ provider, sessions?, others?, focus?, usage? }`，外部 Agent 会话、窗口聚焦器与额度汇入 `agents/v1` |
| **5. 剪贴板动作** | `clipboard.actions` | `ctx.clipboardActions.register(spec)` | `{ id, label: { zh, en }, note?, keywords?, group?, match?(item), run(context) }`，出现在剪贴板弹窗 `Ctrl+K` 面板与岛内剪贴板行菜单 |
| **6. 截图后动作** | `screenshot.actions` | `ctx.screenshotActions.register(spec)` | `{ id, label: { "zh-CN", en }, order?, run({ path, width, height, locale }) }`，出现在截图完成通知卡与截图历史面板 |
| **7. 消息来源** | `messages.sources` | `ctx.messageSources.register(spec)` | `{ id, label, order?, status?, clear?, open? }`，可新增消息来源标签或按同名 `id`（如 `qqMail`）替换单个内置来源 |

---

## 三、窗口界面插槽（`@fuyu/plugin-base/protocol` 的 `SLOTS`）

在窗口代码中通过 `ctx.slots.add(slotName, entry)` 注册，并在 `package.json` 的 `fuyu.slots` 中声明插槽名。插件停用时所有插槽项自动卸载。

| 插槽名 | 所在窗口 | 类型 | 每插件上限 | 元数据字段（`meta`） | 用途 |
|---|---|---|---|---|---|
| `island.page/v1` | `island` | `list` | 2 | `title`, `icon`, `shortcutOrder`, `headerDot`, `enabled`, `fallback`, `fold` | 悬浮岛展开态的独立页面，插件的页面在页头有按钮（见下面「插件的岛页面」） |
| `island.header/v1` | `island` | `list` | 1 | `enabled` | 悬浮岛展开态顶栏右侧操作按钮 |
| `island.collapsed/v1` | `island` | `list` | 2 | `group`, `width`, `hideable`, `shown`, `opens` | 悬浮岛收起条左翼 / 右翼状态项 |
| `island.collapsed-center/v1` | `island` | `single` | 1 | `width`, `shown` | 悬浮岛收起条正中央图案 / 宠物 |
| `island.alert/v1` | `island` | `list` | 1 | `trailing`, `popup` | 刘海双翼提醒与收起态临时提示（音量、设备、额度等） |
| `island.notice/v1` | `island` | `list` | 1 | `active`, `actions` | 收起态通知横条（计时到点、截图完成等） |
| `island.line/v1` | `island` | `list` | 2 | 无 | 悬浮岛下方附加浮条（同步歌词行、选区翻译条等） |
| `island.side/v1` | `island` | `list` | 2 | 无 | 竖向贴边侧栏状态项 |
| `island.overlay/v1` | `island` | `list` | 1 | 无 | 悬浮岛下方的浮动气泡 / 消息横幅 |
| `island.runner/v1` | `island` | `list` | 1 | 无 | 主窗口无界面常驻挂钩（事件监听、状态同步） |
| `island.dev/v1` | `island` | `list` | 1（总上限 3） | 无 | 展开态顶部的演示 / 开发调试条 |
| `settings.category/v1` | `settings` | `list` | 2 | `group`, `icon`, `tabs`, `available`, `feature`, `aliases` | 设置窗口左侧导航栏的一级分类 |
| `settings.section/v1` | `settings` | `list` | 4 | `category`（按 `category` 分组） | 设置窗口某个分类页内的配置分组卡片 |
| `settings.runner/v1` | `settings` | `list` | 1 | 无 | 设置窗口无界面挂钩 |
| `plugin-window.view/v1` | `plugin-window` | `list` | 8 | `windowId`, `title` | 实验性独立插件窗口（需声明 `fuyu.experimental: ["windows/v1"]`）的内容视图插槽 |

### 插件的岛页面（`island.page/v1`）

```ts
ctx.slots.add("island.page/v1", {
  id: "world-clock",
  title: { "zh-CN": "世界时钟", en: "World Clock" },
  icon: GlobeIcon,
  component: WorldClockPage,
});
```

- 插件注册的页面在岛的页头有一个按钮，排在内置页面后面、按注册顺序；按钮的提示是标题加 `Alt+数字`，点它或按 `Alt+数字` 打开这页，`Ctrl+Tab` 切页也会经过它。
- `title`：字符串，或按语言给的 `{ "zh-CN": "…", en: "…" }`（按界面语言取，缺哪种用另一种）。不写时用插件 `package.json` 里 `fuyu.displayName`，再没有就用包名去掉作用域的部分。
- `icon`：接受 `size`、`strokeWidth` 的组件（lucide 图标或自己的 SVG）。不写或渲染出错时显示标题的第一个字，页头照常显示。
- `headerDot: false`：不进页头，只能用 `Alt+数字` 和切页到达。
- `shortcutOrder`：只在插件页面之间排序，插件页面总在内置页面之后。
- 收起条上的 `island.collapsed/v1` 项写 `opens: "<页面 id>"`，点它就打开那一页：宿主把整项做成一个可以聚焦的按钮，有焦点时按 Enter 或空格也能打开。只能指向同一个插件注册的 `island.page/v1`，写了别的插件或内置页的 id 时忽略，控制台记一条告警；项里插件自己的按钮、链接照常收到点击，不会顺带打开页面。不写 `opens` 时和以前一样。

  ```ts
  ctx.slots.add("island.collapsed/v1", { id: "world-clock-bar", opens: "world-clock", component: WorldClockChip });
  ```

- 收起条上的 `island.collapsed/v1` 项按实际渲染出来的宽度算进岛宽（写不写 `group` 都一样）：宿主把项放进一个不压缩内容的容器，量它的宽度，加在岛自己的宽度上。所以内容会变的项（读数、时间、倒计时）不用写 `width`，也不会被截断。
  - `width`（像素数，或按收起条上下文算的函数）是下限：内容更窄时也按它留位置，量到之前也先按它算。只在想给变化的内容预留固定位置时写。写成非正数、非数字或函数出错时当作没写。
  - 防抖：项变宽时岛马上跟着变宽（按 8px 取整）；变窄要窄出 32px 以上才收回。所以每秒刷新的读数只会让岛涨一次，不会来回改窗口大小；不用自己补空格或固定位数。
  - 上限：收起条最宽 520px，和原生窗口的上限一致，也不超过当前收起缩放下舞台窗口放得下的宽度；收起条上的长消息（C124）用的是同一个上限。放不下时先压岛自己的文字，插件项最后在右端淡出裁掉，所以重要的读数放在前面。
  - 项内不要写 `width: 100%`、`flex: 1` 这类撑满剩余空间的样式，容器按内容的 `max-content` 量，撑满写法会量不准；要省略号自己用 `max-width` 限定。

### 插槽主题变量（`SLOT_THEME`）

第三方插件的界面包裹在主题容器中，请使用下列 CSS 变量以同时适配深色岛与浅色岛：

- 文字：`--fuyu-plugin-text`、`--fuyu-plugin-text-secondary`、`--fuyu-plugin-text-muted`
- 表面与边框：`--fuyu-plugin-surface`、`--fuyu-plugin-surface-hover`、`--fuyu-plugin-border`
- 强调色：`--fuyu-plugin-accent`、`--fuyu-plugin-on-accent`
- 状态色：`--fuyu-plugin-warning`（警告，深色岛是亮黄，浅色岛是深琥珀）、`--fuyu-plugin-danger`（危险、超限，深色岛是浅红，浅色岛是深红），都是能直接当文字色的深浅
- 字体与圆角：`--fuyu-plugin-font`、`--fuyu-plugin-radius`

主题容器还设了 `color-scheme`：深色岛是 `dark`，浅色岛是 `light`，插件的元素会继承它（容器是 `display: contents`，不影响布局，继承照常）。所以插件可以直接写 `light-dark(浅色岛的值, 深色岛的值)`，跟着岛的深浅变；岛上、设置窗口和插件独立窗口里都一样。
