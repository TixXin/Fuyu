# 官方插件标准

`plugins/v3/official/` 里的官方插件（`@fuyu/*`）上架前都要达到这份标准。第三方插件不强制，但照着做，用户用起来和官方插件一致。2026-11-19 用户定：官方插件要「设置齐全、岛上默认克制」。

## 1. 设置齐全

- 用户会想改的都能在设置里改，不用编辑文件、不用在岛上的页面里找按钮。判断「会想改」：同类软件（系统自带的同类功能、常见的同类 app）里有的常用选项，这里也有。
- 设置写在插件自己的 `settings.section/v1` 分节里，按「内容 → 显示 → 收起条」这类小标题分组。
- 每一项都有默认值，第一次装好不用改就能用；默认值写进 README 的「设置」一节。
- 改了马上生效，不用保存按钮、不用重启插件。
- 升级时老数据照读：新增的设置项取默认值，已有的设置不变。
- 增删、排序、改名这类管理操作放在设置里。岛上的页面可以留一个最常用的快捷操作（例如番茄钟的开始 / 暂停），不放表单。

## 2. 岛上默认克制

- **收起条**：默认只放一样最要紧的信息（一个数字、一个时间或一个图标），不放第二行、不放说明文字。其余在设置里打开，可以选样式。收起条是否显示也能在设置里关。
- **展开页**：默认只放主要内容；次要信息（时区名、技术细节、统计数字、调试信息）默认不显示，在设置里打开。
- 不在岛上重复设置里已有的开关。
- 读数可能有的「读不到」「这个平台不支持」各自有明确的显示，不显示空白或 `NaN`。

## 3. 中英文、两个平台

- 所有用户看得到的文字都有简体中文和英文，跟随浮屿的界面语言。
- 清单的 `platforms` 写 `windows` 和 `macos`。某项功能只在一个平台上有，另一个平台的页面和设置里不出这一项，README 写明。
- 颜色用插件主题变量（`--fuyu-plugin-*`，见[服务、接缝与插槽](services-and-slots.md)），深色岛和浅色岛都看得清；自己的颜色写在 `light-dark()` 里。
- 窄面板（默认宽度）下文字和按钮不溢出。

## 4. 名字和描述统一

- `fuyu.displayName` 的中英文、岛页 `title`、设置分节的标题、README 的标题、市场和插件页上用同一个名字（统一后的名字见 [插件页预览](../investigations/plugin-pages-preview.html) 的「名字」表）。
- 顶层 `keywords` 写搜索用的别名（中英文都写，最多 32 个）：用户会搜、名字和说明里没有的词，例如系统监控的「任务管理器」「task manager」。市场和插件页的搜索框会搜它。
- `fuyu.description` 一句话说对用户有什么用，不写实现方式（不写「基于 Node 原生接口」「免 API Key」「在设置中配置 owner/repo」这类）；市场卡片上最多显示两行，要放得下。英文和中文意思一致，`package.json` 顶层的 `description` 和英文描述相同。示例见插件页预览「说明」一节。
- **至少一张截图**（2026-11-19 用户定）：每个官方插件写 1 到 3 张截图进 `fuyu.screenshots`（`path` 指向包里的 png / jpg / webp，`caption` 中英文一句话）。没有自己界面的插件截它起作用的地方，例如词典截翻译窗口里的查词结果。以深色岛为主，第一张最能说明用处（市场卡片的封面用它，只露出顶上一段，要紧的内容放在图的上半截），后面是收起条、提醒或设置；顺序参考插件页预览的「截图」一节。截图是真界面，不用 CSS 画的示意图。
  - 岛上页面和收起条可以用 `fuyu-plugin shots` 截：插件带一份示例数据 `shots/sample.ts`，命令把真的组件渲染出来截图，见[截图和封面](screenshots.md)。提醒、设置分节和没有自己界面的插件在真岛上截，或者照[截图和封面](screenshots.md#没有岛上页面的)用浮屿的真组件加示例数据截。
  - 一张都没有时 `fuyu-plugin check` 给警告 `listing:screenshots`，第三方插件不会因此被拒；加 `--strict` 当错误。
  - 官方插件由 `tests/unit/plugin-cli-lint.test.mjs` 拦住：有一个没截图测试就失败（12 个都补齐了，E77.6）。
- README 按「怎么用 / 设置 / 开销和数据来源 / 用到的系统程序（有的话）」写，中英文各一份。
- **这一节由 `fuyu-plugin check` 查**（E77.4）：说明两行放不下、说明里写了实现方式、顶层 `description` 和英文说明不一样、没有 README、README 标题或岛页标题里的名字和清单不一样，各有一条 `listing:` 告警，清单见[命令行](cli.md#check)。设置分节的标题读不出来，要自己对。
  - 第三方插件只是告警；`fuyu-plugin check --strict` 把它们当错误，官方插件上架前跑这一条。
  - 官方插件由 `tests/unit/plugin-cli-lint.test.mjs` 拦住：任何一个官方插件出了 `listing:` 告警测试就失败。原来登记「还没改好」的名单在 E77.6 清空后去掉了，不再有例外。

## 5. 图标

`fuyu.icon`（`assets/icon.svg`）显示在设置的插件页和插件市场，和设置概览页的功能图标是同一个风格：浅底色的圆角方块上一个同色的线条图标。2026-11-19 用户定。12 个官方插件现在的样子见 [图标预览](../investigations/official-plugin-icons-preview.html)（深色、浅色各一排）。

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256"><rect width="24" height="24" rx="6" fill="#f08a24" fill-opacity="0.16"/><g transform="translate(5.28 5.28) scale(0.56)" fill="none" stroke="#f08a24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!-- lucide 图标的路径 --></g></svg>
```

- **底**：铺满的圆角方块（`width="24" height="24" rx="6"`），填主色，`fill-opacity="0.16"`。不用实心色块，不用圆形底。
- **图形**：一个 lucide 图标的路径原样放进 `<g>`（lucide 没有合适的，就按它的 24 格、线宽 2、圆头圆角自己画）；只描边不填充，描边用主色，靠 `<g>` 的 `transform` 缩到 56% 居中。不放文字、位图、渐变和阴影。
- **主色**：每个插件一个，和下表已有的拉开；选深色底和浅色底上都看得清的中等亮度颜色，不用白、黑、灰。
- 图形和插件在岛上的页面图标（`island.page/v1` 的 `icon`）表达同一个意思。
- **用命令生成**：`fuyu-plugin icon --glyph <lucide 名> --color <#rrggbb>` 写出这个骨架的 `assets/icon.svg`，主色和下表某个插件相同或太近时给告警（用法见[命令行](cli.md#icon)）。自己画的图形存成一个 SVG，用 `--glyph <文件.svg>` 套进同一个骨架。
- `pnpm test`（`tests/unit/official-plugin-icons.test.mjs`）检查每个官方插件的图标是这个结构、主色不重复，并且用命令重新生成 lucide 的那 10 个，结果和仓库里的文件逐字节相同。换图标也是一次改动，照「发版」加版本号、写更新记录。
- 新增官方插件或换主色时，下表和命令行里的 `OFFICIAL_ICONS`（`packages/plugin-cli/src/icon/tones.mjs`）一起改，测试会核对两边。

| 插件 | 主色 | lucide 图标 |
|---|---|---|
| `alarm` | `#f08a24` | `alarm-clock` |
| `countdown` | `#6f7dfa` | `calendar-clock` |
| `ecdict` | `#3b94f5` | `book-a` |
| `github-issues` | `#9575f5` | `circle-dot` |
| `launcher` | `#e0a020` | `rocket` |
| `now-playing` | `#f0559a` | `music-2` |
| `pomodoro` | `#f25a4c` | 自己画的番茄钟（lucide 没有） |
| `system-monitor` | `#1fb877` | `activity` |
| `todo-digest` | `#1fb5b5` | `list-checks` |
| `todo-ring` | `#4fbf4a` | `circle-check-big` |
| `weather` | `#22a8ee` | `cloud-sun` |
| `world-clock` | `#4f8cf7` | 自己画的：地球右下角压一个小时钟（照 `globe` 和 `calendar-clock` 的画法） |

## 6. 接上平台

- `island.page/v1` 写中英文 `title`（E60.5），图标用 lucide 风格的线条图标。
- 设置分节按插件 id 挂，设置窗口里插件行的齿轮能进到（E60.6）。
- `island.collapsed/v1` 写 `opens`，点收起项打开自己的页（E60.9）；宽度按 E60.8 的规则声明。
- 命令（`commands`）给出中英文标题；常用命令考虑默认快捷键，不和内置快捷键冲突。

## 7. 发版

- 每次改动 `version` 加一档（新功能加次版本号，只修问题加修订号），写 `CHANGELOG.md`。
- 跑插件自己的 `typecheck`、`lint`（有的话）、`check`、`build`，以及 `pnpm test`（含官方插件套件 `tests/unit/official-plugins-v3.test.mjs`）。
- `fuyu-plugin preview` 看一眼市场卡片和详情页：说明有没有被截掉、封面和截图的裁切、README 排出来的样子（用法见[命令行](cli.md#preview)）。
- 打包装进开发版，在真岛上看过深色、浅色、窄面板，再交给插件开发总控上架（流程见[发布](publish.md)）。
