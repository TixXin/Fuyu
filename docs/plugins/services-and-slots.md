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
| `media/v1` | `mediaV1` | `music` | `nowPlaying()`、`playPause()`、`next()`、`previous()`、`seek({ positionMs })` | `changed` | 读取当前系统媒体播放状态与控制播放/上曲/下曲/跳转进度；换歌或播放状态变化时发 `changed` |
| `messages/v1` | `messagesV1` | `messages` | `sources()`、`notify(notice)`、`clear({ source? })` | `changed`、`arrived`、`action` | 查询各消息来源未读状态、推送结构化新消息通知（进收起条预览、横幅与到达面板）、清理未读。`notify` 返回 `{ shown, receivedAt }`：`shown` 是岛上真的显示了这条通知才为 `true`；岛展开着、用户关了插件通知、岛窗口没开、3 秒内没回话或中途关掉时都是 `false`，不报错。宿主代码和窗口代码调用的结果一样，`shown: false` 时可以换别的方式提醒 |
| `plugin-config/v1` | `pluginConfigV1` | 宿主内核 | `list()`、`get({ id })`、`set({ id, values })`、`reset({ id })` | `changed` | 按插件 `fuyu.config` JSON Schema 读取、校验、持久化与重置插件配置（`<dataDir>/<id>/config.json`） |
| `plugin-windows/v1` | `pluginWindowsV1` | 宿主内核 | `getRules({ id })`、`setRules({ id, disallowAlwaysOnTop?, disallowClickThrough?, hideAll? })`、`list({ id? })` | `changed` | 查询当前实验性独立插件窗口状态，以及读写「禁止置顶 / 禁止点击穿透 / 隐藏全部窗口」护栏规则 |
| `reminders/v1` | `remindersV1` | `timer`（主窗口） | `push({ id, source, icon, title, detail?, snoozable? })` | 无 | 往主窗口提醒队列推送一条提醒卡片 |
| `timers/v1` | `timersV1` | `timer` | `list()`、`start({ kind, durationMs?, hidden? })`、`pause({ id })`、`resume({ id })`、`extend({ id, byMs? })`、`remove({ id })`、`dismissRinging()`、`adopt({ timers })` | `changed`、`due` | 倒计时、番茄钟与秒表的增删改查及到点事件。插件建的计时带 `owner`（宿主按调用方填，传了也不认；用户建的没有），不隐藏的在计时器页标出插件名；`hidden: true` 的不进计时器页和收起条，到点不响铃、不弹提醒，只发 `due`。插件只能 `pause`、`resume`、`extend`、`remove` 自己建的计时（`owner` 是它），别人的当作不存在：前三个报 `not-found`，`remove` 返回 `{ removed: false }`；插件调 `dismissRinging()` 只删它自己在响的计时（含隐藏的），用户关提醒时删在响且不隐藏的。`list()` 和事件照旧给全部计时；`adopt` 只加进新 id，已有的计时原样不动 |
| `todos/v1` | `todosV1` | `todos` | `list({ date? })`、`days({ from, to })`、`add({ title, date?, project? })`、`update({ id, title?, completed? })`、`remove({ id })`、`note({ date? })`、`setNote({ note } \| { append })` | `changed` | 今日待办、未来排期、历史归档与每日笔记读写 |
| `translator/v1` | `translatorV1` | `translation` | `translate(params)`、`rewrite(params)`（流式 `progress`）、`engines()` | `changed` | 文本翻译、流式 AI 改写、查询已配置引擎列表（不含密钥与自定义地址） |

`media/v1` 的 `changed`：载荷和 `nowPlaying()` 的返回值同一个形状（带 `playing`）。系统媒体会话换歌、暂停或继续、换了播放器时发；短时间里连续来的几次变化合并成一次（约 150 ms），曲目、播放状态、播放器和可用的控制都没变时不发，所以只跳了进度不会收到。要显示进度的插件用载荷里的 `positionMs` 和 `updatedAt` 自己往前推，跳转后再 `nowPlaying()` 一次。

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

---

## 四、打开自己的设置（`ctx.settings.open()`）

插件在 `package.json` 里写了 `fuyu.config`，或在设置窗口注册了 `settings.section/v1`，它的设置就在插件详情弹窗的「设置」标签里（插件行上 ⚙ 打开的那一页）。`ctx.settings.open()` 打开设置窗口（已经开着就拉到前面），落到本插件详情弹窗的「设置」标签。适合空状态里的「去设置」按钮（天气没填城市、GitHub Issue 没填仓库），或点一条「缺少设置」的通知时调用。

```ts
// 窗口代码（岛上、设置窗口、插件独立窗口都能调）
<button type="button" onClick={() => void ctx.settings.open()}>去设置</button>

// 宿主代码：和 config、windows 一样，代码的 inject 和 package.json 的 fuyu.inject 里写 "settings"
export const inject = ["clients", "settings"];
export function apply(ctx) {
  ctx.commands.register("configure", () => ctx.settings.open());
}
```

- 不带参数，只能打开自己的设置：插件 id 由窗口的加载器（窗口代码）或宿主（宿主代码）按调用方填，传进去的参数一概忽略。
- 返回 `Promise<void>`。宿主代码里调用时，宿主转给岛窗口去打开；岛窗口没连上宿主时失败，错误码 `not-ready`。
- 插件没有设置项、或还没在运行时，弹窗照常落到「设置」标签，显示对应的提示（「这个插件没有可以改的设置」或「插件运行时，这里才会显示它自己的设置」）。

## 五、打开自己的岛页面、收起岛（`ctx.island`）

插件用 `island.page/v1` 注册了岛页面后，可以自己把岛切到这一页，在用户用完时把岛收起来。例如应用启动台：点收起条上的按钮打开启动台页，启动一个应用后收起岛。

```ts
// 窗口代码（岛上、设置窗口、插件独立窗口都能调）
<button type="button" onClick={() => void ctx.island.open()}>打开启动台</button>
<button type="button" onClick={() => void ctx.island.open("launchpad-recent")}>最近用过</button>

async function launch(app) {
  await ctx.host.call("launch", app);
  await ctx.island.collapse();
}

// 宿主代码：代码的 inject 和 package.json 的 fuyu.inject 里写 "island"，只有 open
export const inject = ["commands", "island"];
export function apply(ctx) {
  ctx.commands.register("show", () => ctx.island.open());
}
```

- `open(page?)`：岛在托盘里或贴边藏着时先唤出，再展开、切到这一页、拿到焦点；已经展开在别的页上也直接切过去。`page` 是注册 `island.page/v1` 时写的 `id`，不写时打开本插件注册的第一个页面。返回 `Promise<void>`，打开不了时失败，错误码：
  - `not-owner`：`page` 是别的插件或浮屿自己的页面。插件 id 由窗口的加载器（窗口代码）或宿主（宿主代码）按调用方填，插件只能打开自己的页面。
  - `not-found`：本插件没有叫这个 `id` 的页面。
  - `no-page`：本插件现在没有岛页面（没注册，或岛上的那部分还没加载完）。
  - `not-ready`：岛窗口还没连上宿主；`timeout`：岛 10 秒没回答；`bad-params`：`page` 不是非空字符串。
- `collapse()`：只给窗口代码。岛展开着、当前是本插件的页面时收起岛，返回 `true`；岛已经收起、或用户正在看别的页面时什么也不做，返回 `false`，不会关掉用户在看的东西。宿主代码里没有 `collapse`：宿主不知道用户此刻在不在看岛，收起应该跟着用户在插件界面上的操作走；确实需要时，宿主用 `ctx.clients.publish` 通知窗口部分，由窗口代码调。
- 老版本的浮屿没有 `ctx.island`：窗口代码用 `ctx.island?.open` 判断接口在不在；宿主代码 inject 了 `island` 的插件在老版本上会一直停在「等待」，要么只在窗口代码里用，要么用 `package.json` 的 `engines.fuyu` 限定版本。
