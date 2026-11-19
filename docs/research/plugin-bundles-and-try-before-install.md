# 插件套装和先试再装

> 日期：2026-11-19。问题：(1) 一键装几个相关插件的「套装」放在哪、谁能定义、出错怎么办；(2) 市场详情里不装就能试用插件，没装的代码怎么安全地跑。范围：读本仓库的代码和文档（路径见「现状」）；联网查 Raycast、VS Code、Obsidian、uTools、Figma、WordPress.org、Shopify、Firefox 的官方文档，以及 Tauri / wry 的文档、安全通告和 issue。相关任务：[E77.8](../tasks/E/E77.8.md)（issue [#1038](https://github.com/TixXin/fuyu/issues/1038)）。
>
> **2026-11-19 用户定：12 个问题都按文末的建议来。** 先做套装；试用等 E77.6 的示例数据和真机验证。
>
> **做到哪了**：套装的岛屿侧已实现（索引格式、宿主的 `installBundle`、市场页的卡片和确认框）。剩下的是子任务：市场仓库出 `bundles` 和第一个套装（E77.8.1）、新手引导推荐套装（E77.8.2）、试用的真机隔离验证（E77.8.3）。

## 结论

**套装**：放进市场索引 `index.v3.json`，加一个可选的顶层字段 `bundles`。只有维护者能合入（别人可以提 PR）。套装只是「一起装」的快捷方式，装完不留下「套装」这个东西，每个插件照常单独更新、停用、卸载。成员一个一个装，各自成败，装不上的不影响已装好的。旧版本的岛不认识这个字段，会直接忽略。

**先试再装**：推荐做法 (b)：市场 CI 用插件的示例数据打一份「试用包」（一个网页），岛在详情页里用沙箱 iframe 打开它。它拿不到浮屿的任何数据和接口，只有示例数据。先只对官方插件开放，作者要自己选择加入。**动手前先做一次真机验证**：Windows 上 Tauri 的脚本会进到每个 iframe 里，隔离够不够要在两个系统上实测，不过关就退回「只放截图」。做法 (c)（在隔离宿主里跑真包）不推荐，工作量大而且绕不开「要么用假数据、要么读到用户数据」。

## 现状（读代码得到的）

### 市场和安装

- 索引 `index.v3.json` 由市场仓库 `TixXin/fuyu-plugins` 的 CI 生成，用索引密钥签名，每天重签，7 天过期，`serial` 只增（[v3-market.md](../architecture/plugins/v3-market.md)）。撤销名单 `revoked.v3.json` 用另一把离线的撤销密钥签。
- 索引里不认识的字段会被忽略：`validateIndex` 只检查它认识的字段（`packages/plugin-market/src/index-format.mjs` 147–156 行），文档也写明「以后只加可选字段」。签名签的是原文，加字段不影响验签。
- 装一个插件：`installMarket({ name, version? })`（`src/features/updater/host/market.mjs` 139 行起）。先用 `selectVersions` 按平台、浮屿版本、冷静期、撤销挑版本，再把它 `requires` 的插件排进来，最后 `downloadAndInstallSteps`（`marketInstall.mjs` 22–64 行）：全部下载并核对 SHA-256，全部解到暂存区，一起落盘。任何一步失败都不落盘。
- 第三方插件每个版本要有作者签名；官方插件靠 `TixXin/fuyu` 受保护的 `main`。
- 安装确认框 `PluginInstallConfirmModal.tsx` 列出这个插件要连的域名、用的 Node 模块、提供和替换的服务、放界面的位置。流程在 `usePluginInstallFlow.tsx`。
- 插件页已有「推荐」卡片（`InstalledPluginSuggestions.tsx`），一次装一个。新手引导的分幕在 `src/windows/onboarding/OnboardingWindow.tsx` 38 行的 `ACTS`，现在没有讲插件的一幕。
- 官方插件 12 个（`plugins/v3/official/`）。例子里的三个都在：`@fuyu/pomodoro`、`@fuyu/todo-ring`、`@fuyu/todo-digest`，两个系统都支持。

### 插件的界面代码现在怎么跑

- **没有隔离，也没有权限表。** 插件「和浮屿同权」（[docs/plugins/README.md](../plugins/README.md) 第 7 行）。用户的「同意」就是安装确认那一下。
- 界面部分是直接 `import()` 进岛窗口和设置窗口自己的 JS 环境的（`packages/plugin-base/src/client/loader.mjs` 20–30 行，`src/features/plugin-kernel/runtime.ts`）。所以它够得着窗口里的一切：Tauri 命令、所有窗口服务（[v3-boundary.md](../architecture/plugins/v3-boundary.md)「任何窗口都能调任何服务」）、`localStorage`、任意 `https` 请求（`src-tauri/tauri.conf.json` 149 行的 `connect-src`）。
- 文件来自 `fuyu-plugin://localhost`（Mac）或 `http://fuyu-plugin.localhost`（Windows），只放行已安装的包（v3-boundary.md「窗口能读的文件」）。
- 界面代码拿到的 `ctx` 只有四样：`slots`、`settings`、`island`、`host`（`loader.mjs` 第 10 行）。官方插件的岛上代码实际只用了 `ctx.slots.add`、`ctx.host.call`、`ctx.host.on`。
- React 是岛给的（`installShared`，`packages/plugin-base/src/client/react.mjs`）。所以安装包里的 `dist/island.js` 离开浮屿跑不起来。

### `fuyu-plugin shots` 怎么喂示例数据

- 约定在 [docs/plugins/screenshots.md](../plugins/screenshots.md)。插件带一份 `shots/sample.ts`：`host.calls` 应答 `ctx.host.call`，`host.events` 发给 `ctx.host.on`，`now` 固定时间。
- `packages/plugin-cli/src/shots/bundle.mjs` 把岛上入口的源码、示例数据、自己的一份 React 和装载代码打成一个脚本加一份样式。
- `harness.mjs` 56–89 行是假的 `ctx`：`slots.add` 只记下来，`host.call` 按示例数据应答（没写的方法报错并记名字），`settings`、`island` 什么也不做。外壳是照岛的默认外观重画的（180–250 行）。
- 两处是为截图定的，试用时要改：时间是冻住的（23–36 行），动画全部关掉（249 行）。
- 现在只支持岛上页面和收起条。`shots/` 不进安装包。官方插件的示例数据由 E77.6 在加。

### 和隔离有关的几件事

- 应用的 CSP 没写 `frame-src`，回落到 `default-src`，里面没有 `https:`。所以页面里的 iframe 不能被导航到外网地址。`script-src` 不许内联脚本。
- `fuyu-plugin` 协议给每个回应带自己的 CSP 头（`src-tauri/src/plugin_kernel/protocol.rs` 10、253 行），现在放行 `img-src https:`。
- 宿主的 WebSocket 查来源名单和令牌（`packages/plugin-base/src/host/sockets.mjs` 28 行）。
- Tauri 2.12 的源码（本机 cargo 缓存里的 2.12.7）：调用命令的脚本和调用密钥标的是「只进主框架」（`manager/webview.rs` 161–184 行）；每次调用都核对密钥（`webview/mod.rs` 2010 行）；走自定义协议的调用还要一个合法的 `Origin`（`ipc/protocol.rs` 487–495 行）；**应用自己注册的协议算「本地」来源**（`webview/mod.rs` 1978–2000 行），也就是 `fuyu-plugin://` 下的页面在权限上和岛同级。
- 联网查到的和上一条有出入的地方：Windows 的 WebView2 会把这些脚本注入每一个框架，包括沙箱 iframe，修它的 wry PR 还开着 [T3]。有项目在 Tauri 2.12.5 上实测：沙箱 iframe 看得到这些全局对象，但调用因为来源是 `null` 被拒 [T4]。**这一点没在我们自己的机器上试过。**

## 一、套装

### 别人怎么做

- VS Code 的「扩展包」是一个空扩展，清单里列出成员；谁都能发；停用或卸载包会连带所有成员，为此有人提过「只删包、留成员」的需求 [B1][B2][B3]。
- Firefox 的收藏集只是列表，没有「全部安装」，官方说没有计划做 [B4]。
- Raycast、Obsidian 没有套装（Raycast 未核实到更多）[B5][B6]。
- 结论：一等公民的套装只有 VS Code 一家，它的麻烦都出在「包本身是个装着的东西」。

### 定义放在哪

| 做法 | 好处 | 坏处 |
|---|---|---|
| **A. 索引里加可选字段 `bundles`（推荐）** | 一个文件、一次请求、一个签名；过期、防回放、镜像都是现成的；CI 能核对成员确实在同一份索引里 | 改套装要等索引重新生成（合入即生成，本来每天也重签） |
| B. 市场仓库里单独一个签名文件 | 和索引互不影响 | 多一次请求（市场已经被说慢）；多一套过期和 `serial`；两个文件可能对不上（套装指向的插件不在本机缓存的索引里） |
| C. 写死在应用里 | 不联网也有，新手引导最省事 | 改一次要发一版；插件下架了，旧版里的套装还指着它 |
| D. 套装做成一个空插件，用 `requires` 带出成员 | 不用新格式，旧岛也能用 | 已装列表里多一个空壳；`requires` 的意思是「缺了不能用」，和「放一起好用」不是一回事；卸载谁带谁说不清（VS Code 的老问题） |

格式草案（每个套装一项）：

```json
"bundles": [
  {
    "id": "pomodoro-flow",
    "displayName": { "zh-CN": "番茄工作法", "en": "Pomodoro flow" },
    "description": { "zh-CN": "番茄钟、今天的待办进度和每日摘要", "en": "…" },
    "plugins": ["@fuyu/pomodoro", "@fuyu/todo-ring", "@fuyu/todo-digest"],
    "onboarding": true
  }
]
```

- 不写版本：每个成员照常由 `selectVersions` 挑（冷静期、平台、浮屿版本都照旧）。
- 不带图：卡片用成员的图标叠出来，不用新素材。
- 成员 2 到 6 个。CI 检查：成员都在索引里，`id` 不重复，中英文都写了。

### 谁能定义

只有维护者能合入。套装文件放在市场仓库（例如 `bundles/<id>.json`），谁都可以提 PR，规则集本来就要求维护者批准。不做「作者自己发套装」：套装会出现在市场最显眼的位置，放开就是广告位。

成员能不能有第三方插件：格式不限制；第一批只放官方插件。

### 市场页上长什么样

- 浏览页顶部一行「套装」，横排卡片；搜索或筛选时收起，搜套装名能搜到。
- 卡片：叠在一起的成员图标、名字、一句话、「3 个插件」，一个按钮。按钮跟着状态变：「全部安装」「安装其余 2 个」「已全部安装」。
- 点卡片开一个对话框：逐个列成员（图标、名字、一句话、状态），下面是合并后的安装确认（每个成员要连什么、用什么，可以展开看），一个确认按钮。
- 新手引导：加一幕，放索引里标了 `onboarding` 的套装。索引几秒内取不到就跳过这一幕。这一步放最后做。

### 各种情况

| 情况 | 怎么办 |
|---|---|
| 有的已装 | 跳过，标「已安装」。有新版也不顺带更新，更新走原来的流程 |
| 已装但停用了 | 不动它，标「已安装（已停用）」 |
| 这个平台不可用、浮屿版本太旧 | 置灰并写原因，装其余的。按钮写「安装可用的 2 个」 |
| 被撤销（`disable`），或只剩带 `warn` 的版本 | 当作不可用，不经套装装 |
| 能装的加已装的不到 2 个 | 这个套装在本机不显示 |
| 装到一半失败 | **逐个装，各自成败**（每个成员连同它的 `requires` 是一个整体，沿用现在的「全成或全不成」）。装好的留着，失败的写原因，按钮变成「重试其余 1 个」。全部结束后宿主只重读一次配置 |
| 成员里有没装过的发布者、冷静期内的版本 | 确认框里逐个成员照现在的规则提示 |

为什么不整包「全成或全不成」：成员之间没有硬依赖，一个镜像抽风不该让另外两个也装不上；而且「部分已装」本来就要处理，失败后的状态和它是同一个。

### 旧版本的岛

不认识 `bundles`，忽略，其余照常（见「现状」）。新岛读到没有 `bundles` 的索引，就不显示那一行。

### 和撤销名单的关系

- 套装不进撤销名单。撤销按插件名和版本算，安装时每个成员都过一遍，被停用的装不上。
- 套装装完就不存在了，所以没有「已装的套装被撤销」这回事；成员以后被撤销，照单个插件处理。
- 下架一个套装就是从索引里拿掉。它由索引密钥签，不需要撤销密钥：套装不带代码，索引密钥泄露时攻击者本来就能改插件条目，套装没有多给他什么。

### 分步计划

1. **格式和纯函数**：`packages/plugin-market/src/index-format.mjs`（校验可选的 `bundles`）、新文件 `bundles.mjs`（给定索引、平台、撤销、已装，算出每个成员的状态）、`index.d.mts`、`packages/plugin-market/test/`；文档 `v3-market.md`、`contracts.md`。
2. **市场 CI**（另一个仓库 `TixXin/fuyu-plugins`）：`bundles/*.json`、`scripts/v3/` 里拼索引和 PR 检查。
3. **宿主服务**：`packages/plugin-services/src/services/market.mjs`（快照加 `bundles`，新方法 `installBundle`）、`src/features/updater/host/market.mjs`、`marketInstall.mjs`、`marketListing.mjs`；模拟数据 `tests/regression/pluginPageMocks.ts`。
4. **界面**：`PluginMarketBrowse.tsx`、新的套装卡片和对话框、`PluginMarket.css`、`marketSearch.ts`、文案 `src/i18n/sections/settings/pluginMarket.ts`；回归页 `tests/regression/plugin-market.tsx` 加断言。
5. **新手引导的一幕**：`src/windows/onboarding/`。

## 二、先试再装

### 别人怎么做「不装先看」

- **Raycast、VS Code、Obsidian、uTools 都不让试。** 它们的插件都不带沙箱，详情页给的是截图、说明、更新记录和信任标记 [P1][P2][P3][P4][P5]。
- **真能试的只有本来就有沙箱的**：Figma 的插件跑在 WebAssembly 里的 JS 虚拟机加 iframe 里，社区页能直接打开一个文件试用 [P6][P7]；WordPress.org 用浏览器里的 WebAssembly 跑一整套 WordPress [P9]；Shopify 试的是主题，不是有权限的代码 [P10]。
- **Figma 的教训**：同环境的沙箱被找出漏洞后，换成了独立的虚拟机 [P7]。
- **WordPress 的教训**：2023 年 10 月给全部约 5.9 万个插件默认开了「实时预览」，很多插件在预览里是坏的（缺依赖、要先配置），作者反对，几天后撤掉；11 月改成作者提供一份配置文件、再手动公开，两步都做了才显示，至今如此 [P8][P9]。

### 四种做法

| | (a) 只放截图或短动画 | (b) 沙箱 iframe 跑试用包 | (c) 隔离宿主里跑真包 | (d) 只对官方开放 |
|---|---|---|---|---|
| 是什么 | 不跑代码。`shots` 截的图，可以多几张状态，按用户的深浅色和语言挑 | CI 把岛上代码、示例数据、React 和外壳打成一个网页，岛用沙箱 iframe 打开 | 下载 `.fuyu`，验签，另起一个宿主进程跑它的宿主部分，界面仍要进沙箱 | 不是一种做法，是开放范围，可以叠在 (b) 上 |
| 要信任什么 | 只是图片，SHA-256 在签名索引里（已经是这样） | 市场 CI（包是它从审过的提交构建的）、索引签名、浏览器的沙箱和 CSP、Tauri 的调用密钥 | 以上全部，加 Node 的进程级权限开关，加一套假服务 | 和浮屿自己的代码同一来源 |
| 包从哪来、怎么校验 | 现有的截图地址和 SHA-256 | 索引每个版本加可选的 `demo: { url, sha256, size }`，宿主下载、核对、按哈希缓存 | 现有的 `.fuyu` 地址、SHA-256、作者签名 | 同 (b) |
| CSP 和网络 | 不涉及 | 回应头：`default-src 'none'`，脚本和样式只许页面自带的，图片字体只许 `data:`，`connect-src 'none'`，`form-action 'none'`，再加 `sandbox allow-scripts` | 界面同 (b)；宿主进程要关网络、限制读写 | 同 (b) |
| 对作者的要求 | 有截图（官方插件已要求） | 有 `shots/sample`；界面代码不用 `localStorage`、不直接联网；示例数据要接住点击；自己选择加入 | 同 (b)，另外宿主部分要能在假服务下跑 | 无 |
| 工作量 | 小，几天 | 中，约两周，另加真机验证 | 大，一个月以上，假服务要一直维护 | 省掉对第三方的审核和文档 |
| Windows 和 Mac | 没差别 | 地址写法不同；Windows 上 Tauri 的脚本进 iframe，Mac 不进；死循环会卡住设置窗口，哪边更重要实测 | 两边都要新起进程、新管一类宿主 | 同 (b) |
| 用户得到什么 | 看得到，点不了 | 能点能看，数据是示例的 | 最像真的 | — |

(c) 的硬伤：插件的宿主部分要待办、计时器这些服务才跑得起来。给真的，就是没同意就读了用户数据，和装了没区别；给假的，每个服务都要写一份假实现，而岛上页面要的数据其实示例数据已经能给。多出来的真实感不值这个代价。

### 推荐：(b)，先官方，作者选择加入，先验证再做

**它怎么工作**

1. 作者在清单里选择加入（字段暂叫 `fuyu.demo`，不能叫 `preview`，那个已经表示「还不稳定」）。没有 `shots/sample` 或没选的插件，详情页照旧只有截图。
2. 市场 CI 构建 `.fuyu` 时顺手跑 `fuyu-plugin shots` 的打包部分，出一个自带一切的网页，作为 Release 附件；索引里记地址、SHA-256 和大小。
3. 用户在详情页点「试用」才下载（不是打开详情就下）。宿主走现有的下载器和镜像，核对 SHA-256，按哈希存进缓存目录，有大小上限。
4. Rust 的 `fuyu-plugin` 协议加一条只读的路径来发这个文件，带上表里那份更严的回应头。设置窗口用 `<iframe sandbox="allow-scripts">` 打开，按详情页宽度缩放（岛上页面 792 宽，对话框 860 宽）。
5. 深浅色和语言经地址里的参数传进去（装载代码已经认 `theme`、`locale`、`slot`）。页面和收起条各能看。

**它够不着什么**

- 浮屿的数据：来源是不透明的（`null`），读不到父页面、`localStorage`、Cookie。
- 宿主服务：WebSocket 要令牌，来源不在名单里；`connect-src 'none'` 也挡着。
- 外网：`connect-src 'none'`；想把自己导航到外网，会被应用的 CSP 拦（`frame-src` 回落到没有 `https:` 的 `default-src`）；`sandbox` 不许弹窗和动顶层页面。
- Tauri 命令：靠调用密钥和 `Origin`，见下面的风险。
- 里面唯一的数据是作者自己写的示例数据。

**试用和截图的装载代码要分两种模式**

- 时间：从 `now` 开始往前走，不冻住，倒计时才会动。
- 动画：打开。
- 点了示例数据没接住的操作：外壳提示一句「示例里没有接这个操作」，不让界面像坏了。这是 WordPress 那次的教训。
- 示例数据里的函数多给一个参数，能在应答之后再推事件（番茄钟点了开始，环才会走）。

**没法试用的**：没有自己界面的插件、岛上提醒、设置分节、独立窗口（`shots` 现在也不支持）。这些照旧放截图。

### 分步计划

0. **真机验证（先做，约两天，决定做不做）**：做一个最小的试用页，在 Windows 和 Mac 的设置窗口里各打开一次，逐项试：看不看得到 `window.__TAURI_INTERNALS__`、`window.ipc`、`chrome.webview`、`webkit.messageHandlers`；调一个 Tauri 命令；连宿主的 WebSocket；`fetch`、图片、WebRTC、表单、把自己导航走；死循环时设置窗口卡不卡。结果写进 `docs/investigations/`。任何一项能碰到命令或用户数据，就停在 (a)，或者改用不经过 Tauri 的独立 WebView（[macos-webview.md](../architecture/plugins/macos-webview.md) 里评估过的 wry 那条路，工作量再加一档）。
1. **作者工具**：`packages/plugin-cli/src/shots/`（`harness.mjs` 加试用模式，`bundle.mjs` 出压缩过的单个网页）、`fuyu-plugin check` 加检查（选了试用就得有示例数据、岛上代码不碰 `localStorage` 和网络）、`packages/plugin-manifest/`（新字段）、文档 `docs/plugins/screenshots.md`、`package.md`。
2. **索引和 CI**：`packages/plugin-market/src/index-format.mjs`（可选的 `demo`）、`v3-market.md`、`contracts.md`；市场仓库的 `scripts/v3/` 构建并上传试用包。
3. **宿主和 Rust**：`src/features/updater/host/` 加下载和缓存（照 `marketMedia.mjs` 的做法）、`market/v1` 加一个方法；`src-tauri/src/plugin_kernel/protocol.rs` 加试用路径和回应头，配 Rust 测试。
4. **界面**：`PluginMarketDetailModal.tsx`、`PluginMarketDetailTabs.tsx`（或截图条旁边的「试用」按钮）、新组件、`PluginMarket.css`、文案；回归页断言 iframe 的 `sandbox` 属性、没有试用包时不出现入口。
5. **给官方插件开**：等 E77.6 的示例数据合入后逐个选择加入，每个在两个系统上点一遍。
6. **以后再定**：对第三方开放（审核清单里加一项「试用包」）。

### 风险和没想清楚的地方

- **Windows 上的隔离比 Mac 弱。** WebView2 把 Tauri 的脚本注入每个框架，沙箱 iframe 里看得到调用接口 [T3]；挡住它的只剩「来源是 `null`」这一道 [T4]。Tauri 以前出过 iframe 够到命令的漏洞 [T1]，官方文档也说在 Linux 和 Android 上分不清 iframe 和窗口 [T2]。所以第 0 步必须做，而且以后每次升级 Tauri 都要重跑。
- **`fuyu-plugin://` 算本地来源。** 试用页绝不能不带 `sandbox` 打开，回应头里的 `sandbox` 指令是第二道保险。
- **CSP 管不住的**：脚本把自己导航走（靠应用的 `frame-src` 回落挡，要实测）、WebRTC [T5][T6]。能带出去的只有示例数据，但会暴露用户的 IP 和「他看过这个插件」。
- **卡死**：试用页死循环可能卡住设置窗口。可以接受到什么程度，看第 0 步的结果。
- **外壳是重画的**，不是浮屿的代码。岛的外观改了，试用和截图都会和真岛有差别。
- **试用包不等于安装包**：它是源码加示例数据另打的一份。审核看的是同一个提交，但用户试到的和装上的不是同一个文件，文案里不能写成「和装上一模一样」。
- **体积和流量**：每个试用包带一份 React，估计 200–400 KB，没量过。
- **示例数据写得不好，试用就像坏的。** 这是作者的工作量，官方 12 个插件要逐个补。
- 没查到的：Chrome 网上应用店、Alfred、Home Assistant 的做法（查询额度用完）。

## 要拍板的问题

套装：

1. **定义放哪？** 建议：索引里的可选字段 `bundles`（做法 A）。
2. **谁能定义？** 建议：只有维护者合入，别人提 PR；第一批只放官方插件。
3. **装完留不留「套装」这个东西？** 建议：不留，只是一次性的一起装。
4. **装到一半失败？** 建议：逐个装，装好的留着，失败的可以重试。
5. **新手引导里要不要加一幕？** 建议：要，但放最后做，取不到索引就跳过。
6. **第一批放哪几个套装？** 建议：先一个「番茄工作法」（番茄钟、待办进度环、待办摘要），其余等看到效果再加。

先试再装：

7. **走哪种做法？** 建议：(b) 沙箱 iframe，先官方。
8. **同不同意先花两天做真机验证，不过关就只做截图？** 建议：同意。
9. **作者选择加入还是默认开？** 建议：选择加入。
10. **对第三方插件开不开？** 建议：这一期不开，官方的跑顺了再定。
11. **界面上叫什么、放哪？** 建议：叫「试用」，放在详情页截图条的开头，点了才下载。
12. **套装和试用先做哪个？** 建议：先套装（风险小、不依赖别的）；试用等 E77.6 的示例数据和第 0 步的结果。

## 来源

查询日期都是 2026-11-19。

先试再装：

- [P1] Raycast 上架要求（截图 2000×1250、最多 6 张）：https://developers.raycast.com/basics/prepare-an-extension-for-store
- [P2] Raycast 安全说明（开源、合入前审核、不带沙箱）：https://developers.raycast.com/information/security
- [P3] VS Code 扩展运行时安全（扩展和 VS Code 同权、信任提示、签名）：https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security
- [P4] Obsidian 插件安全（默认受限模式、无法可靠限制插件）：https://obsidian.md/help/plugin-security
- [P5] uTools 插件详情页示例（截图、介绍，没有试用）：https://www.u-tools.cn/plugins/detail/thesis_tools/ 。发布流程页直接打不开，未核实。
- [P6] Figma 插件怎么运行：https://developers.figma.com/docs/plugins/how-plugins-run ；社区页试用：https://help.figma.com/hc/en-us/articles/360042532714
- [P7] Figma 插件系统的沙箱演变：https://www.figma.com/blog/how-we-built-the-figma-plugin-system/
- [P8] WordPress 撤回默认开启的实时预览：https://wptavern.com/wordpress-reverts-live-preview-button-on-plugins-after-developer-backlash
- [P9] WordPress 改成选择加入：https://make.wordpress.org/meta/2023/11/22/plugin-directory-preview-button-revisited/ ；现行规则：https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/
- [P10] Shopify 试用主题：https://help.shopify.com/manual/online-store/themes/adding-themes

浏览器和 Tauri：

- [T1] Tauri 安全通告 CVE-2024-35222（iframe 够到 IPC，之后加了调用密钥）：https://github.com/tauri-apps/tauri/security/advisories/GHSA-57fm-592m-34r7
- [T2] Tauri 权限文档（Linux、Android 上分不清 iframe 和窗口）：https://v2.tauri.app/security/capabilities/
- [T3] wry PR 1874（WebView2 把启动脚本注入每个框架，2026-10-04 开，还没合）：https://github.com/tauri-apps/wry/pull/1874
- [T4] 下游项目的实测（Tauri 2.12.5，沙箱 iframe 看得到全局对象，调用因 `null` 来源被拒；二手，未自己验证）：https://github.com/memrynote/memry/issues/4150
- [T5] CSP 的 `navigate-to` 已从规范里删掉：https://github.com/w3c/webappsec-csp/pull/564
- [T6] WebRTC 不受 `connect-src` 管：https://github.com/w3c/webappsec-csp/issues/92
- [T7] iframe 的 `sandbox`（MDN）：https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe

套装：

- [B1] VS Code 清单的 `extensionPack`：https://code.visualstudio.com/api/references/extension-manifest
- [B2] 卸载扩展包连带成员：https://github.com/microsoft/vscode/issues/55055
- [B3] 「只删包、留成员」的需求：https://github.com/microsoft/vscode/issues/169109
- [B4] Firefox 收藏集没有全部安装：https://discourse.mozilla.org/t/is-there-way-to-install-all-add-ons-in-a-collection-at-once/52941
- [B5] Raycast 商店（没找到套装，未核实更多）：https://manual.raycast.com/store
- [B6] Obsidian 没有内置的批量安装：https://forum.obsidian.md/t/a-single-button-click-to-reinstall-all-community-plugins-after-cloning-pulling-git-repository-that-ignores-plugins/100826
