# 别的产品怎么让插件拥有窗口或桌面组件

> 日期：2026-11-13。问题：浮屿想让插件开独立窗口（启动台、桌面小组件这类），别的产品是怎么做的，尤其是窗口归谁管、怎么隔离、给不给权限。范围：各产品的官方开发文档（Raycast、uTools、Rainmeter、Übersicht、Stream Deck、Windows 11 小组件），用 WebSearch 找入口、WebFetch 读原文；没有装这些软件实测。相关任务：[E31](/docs/tasks/E/E31.md)，方案见 [plugin-windows.md](/docs/architecture/plugins/plugin-windows.md)。

## 结论

1. **没有一个产品让第三方代码随意建窗口，同时还管着它的权限。** 要么宿主把窗口和里面的界面都管起来（Raycast、Windows 小组件、Stream Deck），要么把窗口完全交给插件、同时也不谈隔离（uTools、Rainmeter、Übersicht）。中间那条路，即「宿主建窗口并拦住页面，页面内容归插件」，只有 Windows 的网页小组件在走，而且它限制地区。
2. **桌面小组件的窗口属性归用户，不归作者。** Rainmeter 把位置、层级、能否拖动、是否穿透点击、透明度全放在用户的配置里，作者只画内容。Übersicht 相反，由作者用 CSS 定位，结果是用户换屏幕就要改代码。浮屿应该学 Rainmeter。
3. **启动台类的产品宁可不给窗口。** Raycast 只让扩展描述列表、详情、表单，由它自己画；这正是浮屿第 1 版选「宿主绘制模板」时参考的做法。uTools 给了 `createBrowserWindow`，等于把 Electron 的窗口原样交出去，它的插件本来就能用 Node.js 的全部能力，所以不存在要守的边界。
4. **微软自己做小组件也是「先模板、后网页」。** Windows 11 小组件默认用 Adaptive Cards 由系统绘制；网页小组件是后加的，页面跑在宿主的 WebView2 里，资源请求可以被拦下来交给提供者回答，页面和提供者之间只有字符串消息。这和浮屿现有的独立 WebView2 页面是同一个结构，说明这个结构站得住。
5. **对浮屿的建议：窗口由岛屿建并管理，页面沿用现有的隔离，窗口属性按 Rainmeter 的分法交给用户。** 不照 uTools 那样把窗口对象交给插件。先只做 Windows。

## 详细

### 对照

| 产品 | 插件能不能有自己的窗口 | 窗口归谁管 | 页面或插件的隔离 | 权限 |
|---|---|---|---|---|
| Raycast | 不能。只能用它提供的界面组件，由 Raycast 画成原生界面 | 宿主 | 所有扩展在一个 Node 子进程里，每个扩展一个 V8 isolate；通过 RPC 只暴露定义好的接口；文件和网络不再另外沙箱 | 没有按接口的权限；开源加人工审核 |
| uTools | 能。`createBrowserWindow(url, options, callback)`，`options` 和 Electron 的 `BrowserWindow` 一样 | 插件 | 没有。预加载脚本能用 Node.js 和 Electron 的接口 | 没有；官方审核上架 |
| Rainmeter | 每个皮肤就是一个窗口 | 宿主建，属性归用户 | 没有。皮肤可以带原生插件（DLL）、执行命令 | 没有 |
| Übersicht | 所有小组件画在同一层桌面网页里，不是各自的窗口 | 宿主建那一层；位置由作者的 CSS 定 | 没有。小组件可以执行任意 shell 命令 | 没有 |
| Stream Deck | 不能。设置界面（属性检查器）是嵌在 Stream Deck 里的网页 | 宿主 | 设置页是宿主里的网页视图，和插件进程通过宿主转发消息 | 没有 |
| Windows 11 小组件 | 不能。小组件显示在系统的小组件面板里 | 系统 | 默认由系统按 Adaptive Cards 绘制；网页小组件跑在宿主的 WebView2 里，匹配过滤规则的请求交给提供者回答 | 提供者是打包的应用，走应用商店 |

### Raycast

- 扩展跑在一个 Node 子进程里，每个扩展有自己的 V8 isolate，通过一层很薄的 RPC 只能用到定义好的接口。官方明说文件读写、网络这些 Node 自带的能力「没有进一步沙箱」。
- 界面用 React 声明，由 Raycast 渲染成原生控件。文档里的界面组件是列表、网格、详情、表单和菜单栏项，没有「开一个自己的窗口」的接口。1.78 加的窗口管理接口是移动别的应用的窗口，不是建窗口。
- 所有扩展开源，合入公共仓库前由 Raycast 和社区的人审核；自动的静态安全分析还在计划中。

### uTools

- `createBrowserWindow` 的第二个参数就是 Electron 的窗口选项，返回的对象保留了大部分实例方法，示例里能置顶、全屏、执行脚本。父子窗口用 Electron 的 `ipcRenderer` 互发消息。
- 另有「分离窗口」：用户把插件从主输入框里拖出来当系统窗口用，插件通过 `onPluginDetach` 得知。分离后的窗口不随主窗口隐藏。
- 插件的预加载脚本能直接用 Node.js 和 Electron 的接口，所以窗口给不给都不改变它能做的事。这条路对浮屿不适用：浮屿的页面是特意不给任何宿主能力的。
- 官方文档站 2026-11-13 抓取失败（连接被关闭），以上内容来自一个镜像页，细节以官方为准。

### Rainmeter

每个皮肤的窗口设置存在用户的 `Rainmeter.ini` 里，由用户在管理窗口、右键菜单或拖动时改：

- 位置 `WindowX` / `WindowY`，支持百分比和指定第几块屏幕；`SavePosition` 决定拖动后是否记住。
- 层级 `AlwaysOnTop`：2 最顶层、1 置顶、0 普通、-1 置底、-2 贴在桌面上。
- `Draggable` 能否拖动，`SnapEdges` 靠边吸附，`KeepOnScreen` 不出屏幕，`ClickThrough` 点击穿透，`AlphaValue` 透明度，`OnHover` 鼠标悬停时隐藏或淡入淡出。
- `AutoSelectScreen` 让屏幕编号跟着窗口实际所在的屏幕走。

这套分法的好处是：作者只管内容，用户换显示器、想把组件压到桌面最底层，都不用碰皮肤的代码。皮肤本身没有任何隔离，能带 DLL 插件和执行命令（文档未专门谈安全，未核实其审核方式）。

### Übersicht

- 小组件是一个 `.jsx` 文件：`command` 是要定时执行的 shell 命令，`refreshFrequency` 是间隔，`render` 把命令输出画成 React 界面。还能用 `run()` 执行额外的命令。
- 小组件用绝对定位画在屏幕上（扣掉菜单栏），位置写在作者的 `className` 里。
- 默认不能点击：要点击得先设置一个交互快捷键，并给 Übersicht 辅助功能权限。这是「贴在桌面层」的常见代价：桌面层的窗口不抢焦点，也就不好收输入。
- 文档没有谈权限和信任，小组件以用户身份执行任意命令。

### Stream Deck

- 插件是一个本地进程，界面在硬件按键上。唯一的网页界面是属性检查器：清单里用 `PropertyInspectorPath` 指向插件包里的一个 HTML，显示在 Stream Deck 应用里，用来改设置。
- 页面和插件进程通过宿主互发设置和消息。文档没有提到插件能自己开窗口。

### Windows 11 小组件

- 小组件显示在系统的小组件面板里。提供者是一个应用，「拥有内容、布局和交互元素」，但绘制由系统做：内容用 Adaptive Cards 的 JSON 描述，尺寸只有小、中、大三档。
- 网页小组件：提供者仍然先给一张 Adaptive Card 作为不支持网页时的退路，再在里面写 `webUrl`。清单里可以写请求过滤规则，匹配的请求被拦下交给提供者的 `OnResourceRequested` 回答；页面用 `window.chrome.webview.postMessage` 发字符串消息，提供者用 `SendMessageToContent` 回。
- 网页小组件目前只对欧洲经济区的用户开放。
- 和浮屿的对应关系很直接：Adaptive Cards 相当于浮屿的模板，网页小组件相当于浮屿的 `webview` 模板，连「请求由宿主拦下、消息只走字符串通道」都一样。

## 来源

2026-11-13 查询。

- Raycast 安全与运行模型：<https://developers.raycast.com/information/security>
- Raycast 界面组件：<https://developers.raycast.com/api-reference/user-interface>
- Raycast 更新日志（窗口管理接口）：<https://developers.raycast.com/misc/changelog>
- uTools 接口文档（官方，未能抓取）：<https://www.u-tools.cn/docs/developer/api-reference/utools/window.html>
- uTools 接口文档镜像：<https://share121.github.io/codeing/utools/api>
- uTools 预加载脚本说明：<https://www.u-tools.cn/docs/developer/information/preload.html>
- Rainmeter 皮肤设置：<https://docs.rainmeter.net/manual/settings/skin-sections/>
- Übersicht 说明：<https://raw.githubusercontent.com/felixhageloh/uebersicht/master/README.md>
- Stream Deck 属性检查器：<https://docs.elgato.com/streamdeck/sdk/guides/ui>
- Windows 小组件概览：<https://learn.microsoft.com/en-us/windows/apps/design/widgets/>
- Windows 网页小组件：<https://learn.microsoft.com/en-us/windows/apps/develop/widgets/web-widget-providers>
