# 项目改名：同类产品的名字和候选名查重

> **2026-11-10 用户定名：浮屿 / Fuyu**，英文不带 `-island`。没有采用下面「推荐」一节的结论，取舍和定名后的查重见文末「定名」一节和 [D17](/docs/tasks/0-archive/D/D17.md)。

> 日期：2026-11-09。问题：`fly-island` 和 `FocuSD` 都是上游的名字，项目要重新取名；先看 GitHub 上同类产品都叫什么，新名字不能和它们重名。范围：GitHub 仓库搜索（`gh search repos`，关键词 `dynamic island`、`dynamic island windows`、`灵动岛`、`桌面 灵动岛`、`topic:dynamic-island`，以及名字里带 `island` 或 `notch`、150 star 以上的仓库）；89 个拉丁字母候选名逐个查 GitHub 仓库名、npm、crates.io 和 GitHub 账号名；18 个中文候选名查 GitHub 仓库的名字和简介；入围的名字再查域名和网页搜索。相关任务：[D17](/docs/tasks/0-archive/D/D17.md)
>
> star 数、创建时间和各项占用情况都是 2026-11-09 查到的。商标只做了网页搜索，没有查商标局的数据库。

## 结论

### 两个名字都来自上游

- 上游 [flyl1u/fly-island](https://github.com/flyl1u/fly-island)（551 star）先后用过 FocuSD 和 fly-island：它的 fork 里两种名字都有，例如 `mrtinhnguyen/FocuSD` 和 `yuyann-dev/fly-island`。
- 我们的仓库 [TixXin/fly-island](https://github.com/TixXin/fly-island)（2026-11-03 创建，4 star）把两个名字都带了过来。仓库里 `fly-island` 出现 793 次（312 个文件），`focusd`（不分大小写）出现 2139 次（311 个文件），`Fly Island` / `FlyIsland` 出现 57 次（21 个文件）。
- 已经在外面用的名字：npm 上的 `fly-island-plugin` 和 `create-fly-island-plugin`（都已发布），插件市场仓库 [TixXin/focusd-plugins](https://github.com/TixXin/focusd-plugins)，以及写在已安装版本里的更新地址 `https://github.com/TixXin/fly-island/releases/latest/download/latest.json`。

### 这四类名字已经用满，不要再用

1. **「某某 Island」**。同类项目里名字带 Island 的搜到 30 多个：CodeIsland（2566）、open-vibe-island（2070）、music-island（1182）、ping-island（1144）、Tide-island（784）、SuperIsland（685）、HyperIsland（640）、MioIsland（543）、SmartIsland（465）、WinIsland（两个不同的仓库，407 和 199）、eIsland（339）、WinIslands（69）、LuckyIsland（31）等等。另外有两个不是灵动岛、但名气更大的：Windows 上的课表工具 ClassIsland（2914）和 Android 的 Island（4001）。再叫「X Island」，既和它们分不清，也搜不到。
2. **Dynamic 和 Notch**。Dynamic Island 是苹果的功能名；Notch 指 MacBook 的刘海，Windows 上没有。DynamicWin（653）、DynamicNotch（647）、boring.notch（11327）、NotchDrop（2129）、NotchPeninsula（242）、V-Notch（99）已经在用。
3. **「岛」的近义词和外语词**。同类项目把能想到的都用了：Atoll（环礁，5238）、Ukishima（日语「浮島」，121）、Skerry（礁岛）、Saari 和 Luoto（芬兰语）、Isleta（西班牙语）、Ostrov（俄语）、Islet、Topisle、Surfisle、HoverIsle。明细见下面「已经被同类项目用掉的名字」。
4. **中文的「X屿」和「浮岛」「悬岛」**。最初想到的「浮屿」已经有两个 Windows 同类项目在用，「灵屿」有一个 macOS 同类项目在用；此外还有星屿岛、词屿、简屿、星野灵屿、悬岛、悬浮岛、浮岛。

也有不走这四类、用自己的词的：coucou（7099）、BrimDeck（545）、nabyscape（254）、Nectar（235）、Ripple（190）。新名字也走这条路。

### 推荐

| | 名字 | 意思 | 查重结果 | 缺点 |
|---|---|---|---|---|
| 首选 | **Skyholm**，中文可以叫「空岛」 | sky 加 holm。holm 在英语里指河湖里或近岸的小岛，来自古诺尔斯语 holmr。合起来是「天上的小岛」，对应屏幕顶上悬着的岛 | GitHub 仓库的名字、简介、主题里都搜不到（0 条）；npm 的 `skyholm`、`skyholm-plugin`、`create-skyholm-plugin`，crates.io 的 `skyholm`，GitHub 账号 `skyholm` 都没人用；`skyholm.app` 和 `skyholm.dev` 没注册，`skyholm.com` 已注册 | Sky 开头，见下面第 2 条 |
| 其次 | **Enisle** | 英语动词，17 世纪初就有，意思是「放到岛上」「使成为岛」，也有「隔离」的意思。中文里把内容显示到灵动岛上叫「上岛」（例如 [signaldock](https://github.com/jizizr/signaldock) 的「取餐码上岛」），enisle 正好是这个动词，也对应插件市场「把自己的功能放上岛」 | GitHub 只搜到 1 个仓库（某个人的主页，用户名里碰巧有这串字母）；npm 的 `enisle`、`enisle-plugin`、`create-enisle-plugin` 和 crates.io 的 `enisle` 都没人用；`enisle.app` 和 `enisle.dev` 没注册，`enisle.com` 已注册 | s 不发音，读作 en-ILE，中文用户不容易读对，也没有顺口的中文叫法；GitHub 账号 `enisle` 已被占 |
| 备选 | **Hoverholm** | hover 加 holm，「悬浮的小岛」，就是文档里一直说的「悬浮岛」 | GitHub 0 条；npm、crates.io、GitHub 账号都没人用；`.com`、`.app`、`.dev` 都没注册 | 9 个字母，偏长 |

选 Skyholm 的理由和要知道的三件事：

1. 三个里它最好读、最好记：sky 谁都认识，整个词照着拼就能读出来；中文直译「空岛」也顺口。
2. 英国的 Sky 公司对 Sky 开头的软件和云服务名字打过商标官司（[SkyKick 案](https://mofo.com/resources/insights/241115-uk-supreme-court-ruling-sky-falls)，2024 年英国最高法院判决）。本项目免费开源、用户主要在国内，实际受影响的可能很小；不想留这个隐患就用 Hoverholm 或 Enisle。
3. 这个词以前出现过两次，都不是软件产品：Poul Anderson 1983 年的小说 [Orion Shall Rise](https://en.wikipedia.org/wiki/Orion_Shall_Rise) 里，Skyholm 是一座悬在高空的浮空平台；2022 年有一份美国商标申请 SKYHOLM（序列号 97436756，申请人 Revolving Games，类别是手机游戏软件），[第三方商标站](https://markinton.com/trademark/skyholm-97436756)显示已失效，没有在美国专利商标局核实。

中文叫法：现在的中文 README 标题也是英文（Fly Island），正文里叫「岛」，新名字可以照旧只用英文名。想要中文名的话，Skyholm 直译是「空岛」：GitHub 上有 262 条结果，几乎都是「森空岛」的签到脚本和 Minecraft 的空岛玩法，没有同类产品。它是通用词，单独搜搜不到我们，要和 Skyholm 一起出现。更少见的是「天屿」和「云渚」，都没有同名项目，但「X屿」已经很多，「渚」字偏生僻。

### 2026-11-10 补充：三个名字的中文名，和 fuyu-island

用户问三个推荐名各自的中文名，并要求把 `fuyu-island` 加进候选。

| 英文名 | 中文名 | 中文名的查重 |
|---|---|---|
| Skyholm | 空岛（直译） | 没有同类产品叫这个；是通用词，结果里几乎都是「森空岛」和 Minecraft 空岛 |
| Enisle | 登岛 | 直译是「上岛」，但「上岛」是这类软件的通用说法，当不了名字；「登岛」完全匹配的只有 4 条，都无关。「栖岛」不能用：[windlively/IsleNest](https://github.com/windlively/IsleNest)「栖岛 IsleNest」是 macOS 菜单栏 / 刘海的效率岛 |
| Hoverholm | 悬屿 | 直译「悬浮岛」「悬岛」「浮岛」都有同类项目在用；「悬屿」没有同名项目 |
| fuyu-island | 浮屿 | 两个 Windows 同类项目已经叫「浮屿」，见「已经被同类项目用掉的名字」 |

`fuyu-island` 的查重结果：GitHub 上名字里含 `fuyu-island` 或 `fuyuisland` 的仓库都是 0 个；npm 的 `fuyu-island`、`fuyu-island-plugin`、`create-fuyu-island-plugin`，crates.io 的 `fuyu-island`，GitHub 账号 `fuyu-island` 都没人用。英文这串字母没有重名，但不建议用，原因有三个：

1. 它的中文名只能是「浮屿」，而 [John4874314/islet](https://github.com/John4874314/islet)「浮屿 Islet」和 [yanhaoran01/FloatIsland](https://github.com/yanhaoran01/FloatIsland)「浮屿 FloatIsland」做的是同一种东西。两个都很小（1 star 和 0 star），但中文用户搜「浮屿」会同时搜到三家。
2. 它属于上面第 1 类「某某 Island」，和 30 多个同类项目是同一种写法；和现在的 `fly-island` 只差两个字母，看起来像是上游名字的变体，而改名的目的正是和上游分开。
3. 单独的 `fuyu` 已有别的含义：npm 包 `fuyu` 已被占，GitHub 上有 Adept 的 Fuyu 模型的实现（[kyegomez/Fuyu](https://github.com/kyegomez/Fuyu)，24 star）。

如果就是喜欢「浮屿」这个中文名，比较稳妥的做法是英文名另取（例如 Hoverholm），中文名的重名问题仍然存在。

### 名字定下来后要改的地方

以 Skyholm 为例。右边一列只是示意，具体写法在改名计划里定。

| 位置 | 现在 | 换成 |
|---|---|---|
| GitHub 仓库 | `TixXin/fly-island` | `TixXin/skyholm` |
| 插件市场仓库 | `TixXin/focusd-plugins` | `TixXin/skyholm-plugins` |
| 显示名：README 标题、`productName`、窗口标题 | `Fly Island`、`fly-island` | `Skyholm` |
| 可执行文件、Cargo 包、根 `package.json` | `focusd-island.exe`、`focusd-island`、`focusd_island_lib` | `skyholm.exe`、`skyholm`、`skyholm_lib` |
| 应用标识和凭据服务名 | `com.focusd.island`、`com.focusd.island.*` | `com.skyholm.island`、`com.skyholm.island.*` |
| 开机自启的注册表值 | `FocuSD Island` | `Skyholm` |
| 链接协议 | `focusd://` | `skyholm://` |
| localStorage key | `focusd-island-*`（[contracts.md](../architecture/contracts.md) 里登记了三十多个） | `skyholm-*` |
| npm 包 | `fly-island-plugin`、`create-fly-island-plugin` | `skyholm-plugin`、`create-skyholm-plugin` |
| PowerShell 模块和 SDK 文件 | `FlyIsland.Plugin`、`lib/focusd.ps1` | `Skyholm.Plugin`、`lib/skyholm.ps1` |
| VS Code 扩展 ID | `tixxin.focusd-island` | `tixxin.skyholm` |
| Agent hook 的标记 | `# BEGIN/END FocuSD Agent Status Hooks`、`focusd-agent-` | 对应的新名字 |
| 内置插件 id | `focusd.local-api` | `skyholm.local-api` |

这里面除了显示名，几乎都是 [AGENTS.md](../../AGENTS.md)「对外契约」里的标识，改的时候必须带迁移，有三处要先想清楚：

- **应用标识**。它决定应用数据目录和 WebView 存储的位置。lane 预览用另一个标识，所以一开始没有数据；正式版换标识也一样，不迁移的话老用户的设置、待办和凭据都会留在旧目录里。
- **更新地址**。已安装的旧版本只认 `TixXin/fly-island` 的发布地址，另外两个是经 `ghfast.top` 和 `gh-proxy.com` 代理的同一地址。仓库改名后旧版本还能不能收到更新，要实测，代理地址尤其要测。
- **已发布的 npm 包**。旧包名要留着并标记为已弃用，指向新包名。

### 接下来

名字要用户来定，记在 [D17](/docs/tasks/0-archive/D/D17.md)。定名后建议分两步：先改不碰用户数据的部分（仓库名、README、显示名、新的 npm 包名），再写计划改内部标识并做迁移。

## 详细

### 同类产品叫什么

Windows 上的开源项目，按 star 排：

| 名字 | 仓库 | star | 说明 |
|---|---|---|---|
| music-island | [redheadesign/music-island](https://github.com/redheadesign/music-island) | 1182 | Rust；屏幕顶边的音乐控制、听写和 AI 额度 |
| DynamicWin | [FlorianButz/DynamicWin](https://github.com/FlorianButz/DynamicWin) | 653 | C# |
| 岛仔 Daozai | [Renly1994/xiaotang-daozai](https://github.com/Renly1994/xiaotang-daozai) | 566 | Rust；2026-11-03 才创建 |
| fly-island（上游） | [flyl1u/fly-island](https://github.com/flyl1u/fly-island) | 551 | |
| BrimDeck | [MoFeng2223/BrimDeck](https://github.com/MoFeng2223/BrimDeck) | 545 | C#；AI 编程工具额度、音乐控制 |
| WinIsland | [WinIslandProject/WinIsland](https://github.com/WinIslandProject/WinIsland) | 407 | Rust；另有同名的 [lb-li/WinIsland](https://github.com/lb-li/WinIsland)（199） |
| eIsland | [JNTMTMTM/eIsland](https://github.com/JNTMTMTM/eIsland) | 339 | Electron 和 Tauri |
| NetSpeed-Dynamic（NSD） | [GEORGEWWWU/NetSpeed-Dynamic](https://github.com/GEORGEWWWU/NetSpeed-Dynamic) | 314 | |
| nabyscape | [BillyNabil/nabyscape](https://github.com/BillyNabil/nabyscape) | 254 | C# |
| Python-island | [Python-island/Python-island](https://github.com/Python-island/Python-island) | 253 | |
| NotchPeninsula | [GEORGEWWWU/NotchPeninsula](https://github.com/GEORGEWWWU/NotchPeninsula) | 242 | C# |
| Nectar | [kua8/Nectar](https://github.com/kua8/Nectar) | 235 | Rust；刘海加 Dock |
| Ripple | [TopMyster/Ripple](https://github.com/TopMyster/Ripple) | 190 | 跨平台 |
| Oyenza Studio | [lucacadalora/oyenza-studio](https://github.com/lucacadalora/oyenza-studio) | 144 | Rust；Windows 和 Mac |
| Island | [exuupery/island](https://github.com/exuupery/island) | 111 | |
| Crest | [andrealo20/crest](https://github.com/andrealo20/crest) | 100 | Tauri 加 React；Windows 和 macOS |
| V-Notch | [w0otdev/V-Notch](https://github.com/w0otdev/V-Notch) | 99 | C# |
| FluidBar | [Doulor/FluidBar](https://github.com/Doulor/FluidBar) | 96 | C# |
| WinLand | [luolangaga/WinLand](https://github.com/luolangaga/WinLand) | 76 | C#；有插件和插件市场 |
| WinIslands | [JudeKwong/WinIslands](https://github.com/JudeKwong/WinIslands) | 69 | C# |
| wisland | [AsamiAkito/wisland](https://github.com/AsamiAkito/wisland) | 59 | Python |
| Lumen | [Risuleia/Lumen](https://github.com/Risuleia/Lumen) | 34 | Rust |
| LuckyIsland | [thisxiaoyuQAQ/LuckyIsland](https://github.com/thisxiaoyuQAQ/LuckyIsland) | 31 | Tauri 2 加 React |
| Pillar | [warpirate/pillar-dynamic-island-for-windows](https://github.com/warpirate/pillar-dynamic-island-for-windows) | 24 | |

`dynamic island windows` 这个关键词取了前 40 个结果，几乎都直接叫 `dynamic-island-windows`、`DynamicIsland-Windows` 这一类名字，star 都不超过 2。

macOS 上的（star 500 以上）：[boring.notch](https://github.com/TheBoredTeam/boring.notch)（11327）、[coucou](https://github.com/Louis-CFM/coucou)（7099）、[Atoll](https://github.com/Ebullioscopic/Atoll)（5238）、[CodeIsland](https://github.com/wxtsky/CodeIsland)（2566）、[vibe-notch](https://github.com/farouqaldori/vibe-notch)（2535）、[NotchDrop](https://github.com/Lakr233/NotchDrop)（2129）、[open-vibe-island](https://github.com/Octane0411/open-vibe-island)（2070）、[ping-island](https://github.com/erha19/ping-island)（1144）、[notchi](https://github.com/sk-ruban/notchi)（1047）、[SuperIsland](https://github.com/shobhit99/SuperIsland)（685）、[DynamicNotch](https://github.com/jackson-storm/DynamicNotch)（647）、[HermesPet](https://github.com/basionwang-bot/HermesPet)（602）、[mew-notch](https://github.com/monuk7735/mew-notch)（556）、[MioIsland](https://github.com/MioMioOS/MioIsland)（543）。

Linux（Hyprland）：[Tide-island](https://github.com/enhaoswen/Tide-island)（784）、[impasto](https://github.com/andreumassanet/impasto)（447）、[ActivSpot](https://github.com/Devvvmn/ActivSpot)（316）、[ChillPill-Shell](https://github.com/LUCKYS1NGHH/ChillPill-Shell)（207）、[Ukishima](https://github.com/amanhex/Ukishima)（121）。Android：[HyperIsland](https://github.com/1812z/HyperIsland)（640）、[SmartIsland](https://github.com/agupta07505/SmartIsland)（465）、[HyperBridge](https://github.com/D4vidDf/HyperBridge)（437）。

不在 GitHub 上或不开源的：Isle Notch、Dynamic Edge、Notchify、NotchPixel、Yata Notch、Smart Notch、ORBIT。这些名字来自 [AlternativeTo 的 WinIsland 替代品页](https://alternativeto.net/software/winisland/)、[toolradar 的 Isle Notch 页](https://toolradar.com/tools/isle-notch) 和 [docs/tasks/README.md](../tasks/README.md) 末尾列的两篇对比，只看了网页搜索给的摘要，没有逐个打开核实。

### 已经被同类项目用掉的名字

这些都是查候选名时撞上的。star 大多很少，但做的是同一种东西，名字不能再用。

| 名字 | 谁在用 | star |
|---|---|---|
| Atoll | [Ebullioscopic/Atoll](https://github.com/Ebullioscopic/Atoll)，macOS | 5238 |
| 岛仔 Daozai | [Renly1994/xiaotang-daozai](https://github.com/Renly1994/xiaotang-daozai)，Windows | 566 |
| Ukishima 浮島 | [amanhex/Ukishima](https://github.com/amanhex/Ukishima)，Hyprland | 121 |
| Skerry | [Casellus/Skerry](https://github.com/Casellus/Skerry)，Windows | 3 |
| Saari | [pogiii/saari](https://github.com/pogiii/saari) | 0 |
| Luoto | [amidamaru940/luoto](https://github.com/amidamaru940/luoto)，macOS | 0 |
| Isleta | [idevtim/isleta](https://github.com/idevtim/isleta)，macOS | 2 |
| Ostrov | [tenyyq/dynamic-island-windows](https://github.com/tenyyq/dynamic-island-windows)，Windows | 1 |
| Islet、浮屿 | [John4874314/islet](https://github.com/John4874314/islet)「浮屿 Islet」，Windows 桌面小岛 | 1 |
| 浮屿、FloatIsland | [yanhaoran01/FloatIsland](https://github.com/yanhaoran01/FloatIsland)「浮屿 FloatIsland」，Windows 贴边工作台 | 0 |
| 灵屿 Lingyu | [ColonelG-yue/Lingyu](https://github.com/ColonelG-yue/Lingyu)，macOS，基于 Atoll | 0 |
| 星野灵屿、Notch Isle | [mycherish/notch-isle](https://github.com/mycherish/notch-isle)，macOS | 1 |
| 星屿岛 | [wei-xingyu/xingyu-island](https://github.com/wei-xingyu/xingyu-island)，Windows | 4 |
| 词屿 | [iLuns2000/lyric_isle-flutter](https://github.com/iLuns2000/lyric_isle-flutter)，macOS 歌词悬浮窗 | 0 |
| 简屿 | [maomengen888-maker/trae-flow](https://github.com/maomengen888-maker/trae-flow)，macOS | 0 |
| 悬岛、HoverIsle | [Nahzzz77/HoverIsle](https://github.com/Nahzzz77/HoverIsle)，Mac 屏幕顶部的工作台 | 1 |
| 悬浮岛 | [17lijunyi/xuanfudao](https://github.com/17lijunyi/xuanfudao)、[MN0709/xuanfudao](https://github.com/MN0709/xuanfudao)，都是 Mac 顶部工作台 | 2、1 |
| 浮岛 | [cass-2003/Floatly](https://github.com/cass-2003/Floatly)「Floatly（浮岛）」桌面小组件；[Watertube-bilibili/free-island](https://github.com/Watertube-bilibili/free-island)「浮岛」Windows 桌面时间助手 | 8、1 |
| Topisle | [wind-far/Topisle](https://github.com/wind-far/Topisle)，「屏幕顶端的本地工作岛」 | 1 |
| Surfisle | [beginner1868/Surfisle](https://github.com/beginner1868/Surfisle)，Windows；简介里的功能组合和上游几乎一样 | 4 |

### 中文候选名

GitHub 搜中文时按单个字匹配，搜「空岛」会把只含「空」和「岛」两个字的仓库也算进去。所以结果多的词取回了最多 300 条，再筛出名字或简介里完整包含这个词的。

| 中文名 | GitHub 上的情况 | 能不能用 |
|---|---|---|
| 浮屿 | 两个 Windows 同类项目在用，见上表 | 不能 |
| 灵屿 | 一个 macOS 同类项目在用，另有「星野灵屿」 | 不能 |
| 悬岛 | 一个 Mac 同类项目在用 | 不能 |
| 浮岛、悬浮岛 | 本来就是这类软件的通称，至少还有四个项目拿它当名字 | 不能 |
| 上岛、岛上 | 这类软件的常用说法（「取餐码上岛」「歌词上岛」），不是谁的名字 | 当不了名字 |
| 蓬莱 | [kevinchennewbee/PenglaiAgent](https://github.com/kevinchennewbee/PenglaiAgent)「Penglai 蓬莱」是桌面端的插件生态（13 star）；另有 Penglai-Enclave 组织 | 不建议 |
| 云汀 | 有一个「云汀素材管理工具」（1 star） | 不建议 |
| 岛主 | 有人拿它当个人品牌（「岛主 AI 日报」） | 不建议 |
| 悬屿、天屿 | 没有完全同名的项目 | 能，但「X屿」已经很多：除了上表里的，还有映屿、伴屿、心屿、知屿、集屿、静屿 |
| 汀洲 | 4 条结果：两条引用同一首词，一条是个人的「汀洲工作台」（0 star） | 能；意思是水中的小洲，知道的人不多 |
| 云渚 | 2 条结果，没有叫这个名字的项目 | 能；「渚」字偏生僻 |
| 空岛 | 262 条，几乎都是「森空岛」签到脚本和 Minecraft 空岛；有一个「空岛图吧工具箱」（4 star）；没有同类产品 | 能，适合做 Skyholm 的中文叫法 |
| 天岛 | 完全匹配的只有 2 条，都无关 | 能；不如「空岛」顺口 |
| 浮空岛、云岛、登岛 | 完全匹配的都是游戏、3D 场景和无关项目 | 能，但没有对应的英文名 |

### 拉丁字母候选名的全部查询结果

按「名字里含它的仓库」从少到多排。各列的意思：

- 名字里含它的仓库：`gh api search/repositories -f q="<名字> in:name"` 返回的总数，包括只是名字里含有这串字母的（例如搜 `isola` 会算上 `isolated-vm`）。
- 同名仓库：只在 star 最多的 30 个结果里找仓库名完全相同的，最多列 3 个。仓库数超过 30 的名字，这一列写「无」不代表没有同名仓库。
- npm、crates.io：请求 `registry.npmjs.org/<名字>` 和 `crates.io/api/v1/crates/<名字>`，返回 200 记「已占」，404 记「空」。
- GitHub 账号：`gh api users/<名字>`，查得到记「已占」。仓库在 `TixXin` 名下，账号被占只影响以后想不想建同名的组织。

| 名字 | 名字里含它的仓库 | 同名仓库（star） | npm | crates.io | GitHub 账号 |
|---|---|---|---|---|---|
| deskholm | 0 | 无 | 空 | 空 | 已占（组织） |
| glassholm | 0 | 无 | 空 | 空 | 空 |
| hoverholm | 0 | 无 | 空 | 空 | 空 |
| skyholm | 0 | 无 | 空 | 空 | 空 |
| skyholme | 0 | 无 | 空 | 空 | 空 |
| cloudholm | 1 | 无 | 空 | 空 | 空 |
| enisle | 1 | 无 | 空 | 空 | 已占 |
| uharte | 1 | 无 | 空 | 空 | 已占 |
| topisle | 2 | wind-far/Topisle（1） | 空 | 空 | 空 |
| onogoro | 5 | 无 | 空 | 空 | 已占 |
| qundao | 5 | herjoyy/qundao（0）、kiliter/qundao（0） | 空 | 空 | 空 |
| topholm | 5 | 无 | 空 | 空 | 已占 |
| nisaki | 7 | akashbiswas0/nisaki（0） | 空 | 空 | 已占 |
| kongdao | 8 | kongdaoasd/kongdao（0）、sd9960528-ui/kongdao（0） | 空 | 空 | 已占 |
| kisiwa | 14 | GeorgeBonga/Kisiwa（0）、RashidJuma198/kisiwa（0） | 空 | 空 | 已占 |
| onisle | 14 | 无 | 空 | 空 | 空 |
| tingzhou | 14 | 无 | 空 | 空 | 已占 |
| eilean | 21 | 无 | 空 | 空 | 已占 |
| isleta | 36 | idevtim/isleta（2）、Lepiozdyx/Isleta（0） | 空 | 空 | 已占 |
| natant | 41 | 无 | 空 | 空 | 已占 |
| skyisle | 46 | Demigod1410/skyisle（0）、WitherRedstone/SkyIsle（0）、Andymcdreamy/SkyIsle（0） | 空 | 空 | 已占 |
| bimini | 47 | ethereum/bimini（7）、zellio/bimini（1）、trialspark/bimini（0） | 已占 | 空 | 已占 |
| skerry | 50 | ChaoxiYu9/Skerry（9）、Casellus/Skerry（3）、zitaofeng-china/Skerry（1） | 已占 | 已占 | 已占 |
| luoto | 54 | eetu/luoto（1）、amidamaru940/luoto（0） | 空 | 空 | 已占 |
| eyot | 55 | steeleduncan/eyot（58）、eyotlab/eyot（1）、dlorbarkhbotcla/eyot（0） | 已占 | 空 | 已占 |
| kobbe | 58 | NPIOcean/kobbe（2）、galiogalfor/kobbe（0） | 空 | 空 | 已占 |
| enys | 60 | vjrc0nrpj5/enys（0）、ewebgratsan/enys（0） | 空 | 空 | 已占 |
| isly | 65 | fanchann/isly（4）、juanortiz10/Isly（3）、islym/isly（0） | 已占 | 空 | 已占 |
| seamark | 65 | sheshbabu/seamark（2）、rzs1221a/seamark（0）、bot69388-lab/seamark（0） | 空 | 已占 | 已占（组织） |
| eyja | 81 | asenchi/eyja（2）、analogrelay/eyja（1）、RaoulChartreuse/eyja（0） | 空 | 空 | 已占 |
| fudao | 89 | wangpGroup1/fudao（0）、InfcnFrontDev/fudao（0）、vklonghml/fudao（0） | 空 | 空 | 已占 |
| yunzhu | 99 | amadeus549/yunzhu（0）、staycloud/yunzhu（0）、PineappleFruit/yunzhu（0） | 空 | 空 | 已占 |
| cupola | 108 | matthw-labs/cupola（189）、DanAndersen/cupola（37）、cosmic-utils/cupola（15） | 已占 | 空 | 已占 |
| tombolo | 108 | hpcc-systems/Tombolo（9）、baloozeone972/tombolo（0）、reeyongee/tombolo（0） | 已占 | 空 | 已占 |
| penglai | 113 | 无 | 空 | 空 | 已占（组织） |
| kilda | 114 | MCorentin/kilda（1）、HCL-HUBL/KILDA（1）、sandseat62/kilda（0） | 空 | 空 | 已占（组织） |
| topside | 117 | hmil/topside（10）、waterloo-rocketry/topside（9）、UiASub/Topside（4） | 已占 | 已占 | 已占 |
| ashore | 121 | xsdream/Ashore（3）、Kai-x64/Ashore（2）、blahtv/Ashore（1） | 已占 | 空 | 已占 |
| eiland | 121 | sanfran/Eiland（1）、ataggart21/EiLand（0） | 已占 | 空 | 已占 |
| aeolia | 122 | TELOS-syslab/Aeolia（13）、terraceonhigh/Aeolia（1）、danefilipczak/Aeolia（1） | 已占 | 空 | 已占 |
| eyrie | 124 | tloncorp/eyrie（8）、PteroPackages/Eyrie（7）、EyrieCommander/eyrie（5） | 已占 | 已占 | 已占 |
| isleo | 128 | 无 | 空 | 空 | 已占 |
| inish | 140 | TobiOyalowo/inish（0）、KostyukD/inish（0）、trevorjn/Inish（0） | 空 | 空 | 已占 |
| hallig | 159 | jmhall12/hallig（0）、jommelhallig/hallig（0） | 空 | 空 | 已占 |
| masthead | 172 | dijkstrasoftware/masthead（15）、Debuggedd/Masthead（3）、had-nu/masthead（3） | 已占 | 空 | 已占 |
| lanai | 185 | TrueBitProject/lanai（32）、openjdk/lanai（27）、maranix/Lanai（1） | 已占 | 空 | 已占（组织） |
| pelago | 188 | Mikebouskila/pelago（7）、epfl-dias/pelago（2）、pelago-claude/pelago（2） | 空 | 空 | 已占 |
| daoyu | 195 | daoyeqiuzhang/daoyu（0）、yuh25505-cell/daoyu（0）、zyu22341/daoyu（0） | 空 | 空 | 已占 |
| landfall | 195 | lucafrancescoorlandi/landfall（4）、mrgriscom/landfall（3）、AmElmo/landfall（3） | 已占 | 空 | 已占（组织） |
| afloat | 213 | rwu823/afloat（873）、millenomi/afloat（694）、AdelaideSky/Afloat（109） | 已占 | 已占 | 已占 |
| aloft | 223 | lingeringlight/ALOFT（60）、OTGApps/aloft（28）、stanographer/aloft（20） | 已占 | 已占 | 已占 |
| saari | 300 | samarthtayal31-ops/saari（0）、benzyon/saari（0）、pogiii/saari（0） | 空 | 空 | 已占 |
| nesia | 307 | galihru/nesia（3）、the-noob-engineer/neSia（1）、Joseito48/nesia（1） | 空 | 空 | 已占 |
| ellan | 331 | Mouryat3007/Ellan（2）、kutifatiha-prog/ELLAN（0）、elianjoyatiang-cell/ellan（0） | 空 | 空 | 已占 |
| mooring | 332 | ChiChou/Mooring（6）、dankelley/mooring（5）、bramblex/Mooring（3） | 已占 | 已占 | 已占 |
| insel | 353 | Melle1986/Insel（1）、LoTwT/insel（1）、EmeraldKingg/INSEL（1） | 空 | 空 | 已占 |
| xuanyu | 417 | 无 | 空 | 空 | 已占 |
| flotilla | 423 | tylertreat/Flotilla（238）、blendogames/flotilla（187）、YeoLab/flotilla（124） | 已占 | 已占 | 已占（组织） |
| ayre | 450 | jacksleight/ayre（77）、zimlit/Ayre（1）、0xrpheus/ayre（1） | 已占 | 空 | 已占（组织） |
| shoal | 513 | cazala/shoal（248）、BT10011/shoal（100）、rishabdesigns/shoal（35） | 已占 | 已占 | 已占 |
| qianyu | 525 | 无 | 空 | 空 | 已占 |
| tingyu | 540 | mk4no1/TingYu（76）、Celestial-end/TingYu（2）、tingyusys/TingYu（2） | 空 | 空 | 已占 |
| otok | 675 | kamod-ch/otok（3） | 空 | 空 | 已占 |
| daymark | 687 | btafoya/Daymark（9）、sharathdoes/daymark（6）、naolselemon/daymark（5） | 已占 | 空 | 已占 |
| neso | 719 | dropbox/neso（19）、hperrin/neso（8）、ExCALIBUR-NEPTUNE/NESO（6） | 已占 | 已占 | 已占 |
| lilypad | 722 | Lilypad-Tech/lilypad（93）、shendrew/Lilypad（75）、winton/lilypad（56） | 已占 | 空 | 已占（组织） |
| lingyu | 774 | uusa24132-design/lingyu（6）、smryyyyy/lingyu（1） | 空 | 空 | 已占 |
| horai | 856 | uneco/horai（17）、Minamirb/horai（2）、RichardBlow/Horai（1） | 已占 | 空 | 已占 |
| cayo | 1024 | ublue-os/cayo（110）、matthew-ia/cayo（5）、yunling101/cayo（3） | 已占 | 空 | 已占 |
| fuyu | 1049 | zykrah/fuyu（28）、kyegomez/Fuyu（24）、yukino-org/fuyu（5） | 已占 | 空 | 已占 |
| floe | 1072 | jannskiee/floe（213）、thaw-app/Floe（194）、floe-audio/Floe（96） | 已占 | 空 | 已占 |
| qingyu | 1078 | EvinfTech/qingyu（229）、GUAPIXIA/qingyu（14） | 已占 | 空 | 已占 |
| jingyu | 1099 | liuwanli007/jingyu（4）、sunday-lil/jingyu（3） | 已占 | 空 | 已占 |
| islet | 1107 | islet-project/islet（141）、jonschipp/ISLET（113）、msantos/islet（13） | 已占 | 已占 | 已占 |
| qiyu | 1295 | linxyannie-hub/qiyu（21） | 已占 | 空 | 已占 |
| delos | 1444 | Hellblazer/Delos（2）、ILIAS-eLearning/delos（1） | 已占 | 已占 | 已占 |
| islo | 1589 | jeroenrinzema/islo（3） | 已占 | 空 | 已占 |
| insula | 1754 | chandlerprall/insula（13） | 已占 | 空 | 已占（组织） |
| pharos | 2070 | cmu-sei/pharos（1741）、ithaka/pharos（134）、EEddeenn/Pharos（101） | 已占 | 已占 | 已占（组织） |
| buoy | 2247 | Buoy-gg/buoy（696）、tytydraco/Buoy（204）、everettraven/buoy（81） | 已占 | 已占 | 已占（组织） |
| moku | 2314 | moku-project/Moku（193）、Jrayp/Moku（47）、wilsen0/moku（29） | 已占 | 已占 | 已占 |
| perch | 2341 | google-research/perch（404）、lakeday-org/perch（314）、ricardodantas/perch（104） | 已占 | 已占 | 已占 |
| motu | 2932 | vampirefrog/motu（23）、clstoulouse/motu（19）、liyaonbnb/motu（16） | 已占 | 空 | 已占（组织） |
| roost | 3558 | CompRhys/roost（61）、Flockingbird/roost（35）、Beakpoint-Insights/roost（33） | 已占 | 已占 | 已占 |
| shima | 4285 | VendavalSC/Shima（5） | 已占 | 已占 | 已占 |
| holm | 4536 | volfpeter/holm（132）、man15h/holm（97） | 已占 | 空 | 已占 |
| cay | 9309 | 无 | 已占 | 已占 | 已占 |
| nusa | 9674 | JorgeDeLosSantos/nusa（139）、rama2555/nusa（96）、irfanzainudin/nusa（7） | 已占 | 已占 | 已占 |
| isola | 10665 | 无 | 已占 | 已占 | 已占 |

表里没被同类项目用、也没有成名的同名项目的，除了推荐的三个，还有 glassholm、deskholm、cloudholm、uharte（巴斯克语的「岛」）、onogoro、eilean、kisiwa、tingzhou（汀洲）、qundao（群岛）。它们不如推荐的三个好读或好懂，所以没有入围。

### 没查的和查不准的

- **商标**：只对 Skyholm 和 Enisle 各做了一次网页搜索。Skyholm 搜到上面那份美国申请，Enisle 没搜到同名的软件、品牌或公司。中国、美国、欧盟的商标数据库都没有查。
- **国内的应用商店和软件站**：搜索工具对中文站点覆盖有限，只搜了「浮屿」「汀洲」「空岛」三个词，都没搜到同名的桌面软件，这不能说明没有。
- **域名**：用 RDAP 查的（`.com` 查 Verisign，`.app` 和 `.dev` 查 Google Registry），返回 404 记作没注册。只查了三个推荐名。
- **Microsoft Store、winget、PowerShell Gallery**：没有查。
- **GitHub 搜索的覆盖面**：仓库搜索只匹配名字、简介和主题，README 里才提到名字的项目搜不到；star 很少的新项目每天都在冒出来，定名当天要再搜一次。

## 定名（2026-11-10）

用户定为 **浮屿 / Fuyu**，英文就是 `Fuyu`，不带 `-island`。

定名当天查的（「空」表示没人用）：

| 用途 | 名字 | 结果 |
|---|---|---|
| GitHub 仓库 | `TixXin/fuyu`、`TixXin/fuyu-plugins` | 都不存在，可以改名过去 |
| npm 插件包 | `fuyu-plugin`、`create-fuyu-plugin` | 空 |
| npm 单名 | `fuyu` | 已被占，所以 npm 包要带后缀 |
| crates.io | `fuyu` | 空 |
| 域名 | `fuyu.com`、`fuyu.app`、`fuyu.dev` | 都已注册 |

用这个名字要接受的几点（前面「详细」里都有出处）：

- 中文「浮屿」已有两个 Windows 小项目在用：「浮屿 Islet」（1 star）和「浮屿 FloatIsland」（0 star）。
- 单独搜 `fuyu` 会搜到很多无关的东西：GitHub 上名字含 fuyu 的仓库有一千多个，包括 Adept 的 Fuyu 多模态模型的实现。README 和仓库简介里要把「浮屿 Fuyu」和「灵动岛」「Windows」写在一起，方便被搜到。
- 自己的域名要另想，三个常见后缀都已被注册。

## 来源

- GitHub 仓库搜索和仓库信息：`gh search repos`、`gh api search/repositories`、`gh api repos/<仓库>`、`gh api repos/flyl1u/fly-island/forks`，2026-11-09。文中每个仓库都给了链接。
- npm 和 crates.io：`https://registry.npmjs.org/<包名>`、`https://crates.io/api/v1/crates/<包名>` 的返回码。
- 域名：`https://rdap.verisign.com/com/v1/domain/<域名>`、`https://pubapi.registry.google/rdap/domain/<域名>` 的返回码。
- holm 的意思和来历：[Merriam-Webster](https://merriam-webster.com/dictionary/Holm)、[Etymonline](https://www.etymonline.com/word/holm)。
- enisle 的意思和年代：[Dictionary.com](https://www.dictionary.com/browse/enisle)、[Vocabulary.com](https://www.vocabulary.com/dictionary/enisle)。
- 小说里的 Skyholm：[Wikipedia: Orion Shall Rise](https://en.wikipedia.org/wiki/Orion_Shall_Rise)。
- SKYHOLM 商标申请：[markinton.com](https://markinton.com/trademark/skyholm-97436756)（第三方站点，页面本身没能打开，内容来自搜索摘要）。
- Sky 公司的商标诉讼：[Morrison Foerster 对 SkyKick 案判决的说明](https://mofo.com/resources/insights/241115-uk-supreme-court-ruling-sky-falls)。
- 不在 GitHub 上的同类产品：[AlternativeTo: WinIsland Alternatives](https://alternativeto.net/software/winisland/)、[toolradar: Isle Notch](https://toolradar.com/tools/isle-notch)。
- 仓库里现在的名字和标识：`src-tauri/tauri.conf.json`、`package.json`、`src-tauri/Cargo.toml`、`packages/*/package.json`、[contracts.md](../architecture/contracts.md)，出现次数用 `git grep` 数的。
