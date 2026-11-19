# 截图和封面

> `fuyu-plugin shots` 的约定和做法（E77.4，2026-11-19）。命令的选项见[命令行](cli.md#shots)。

市场卡片和详情页要截图，官方插件至少一张（见[官方插件标准](official-quality.md)）。截图是真界面：`shots` 把插件自己的岛上页面和收起条组件渲染出来截图，不画示意图。它不启动浮屿、不运行插件的宿主部分，所以页面要的数据由插件带的一份示例数据给。

## 怎么截

1. 用 esbuild 把插件的岛上入口（`fuyu.client.island` 对应的源码）、示例数据和一个小的装载页打成一个网页，样式照常带上。
2. 装载页给入口一个 `ctx`：`ctx.slots.add` 记下插件注册的项；`ctx.host.call` 用示例数据应答；`ctx.host.on` 收示例数据里的事件。
3. 把要截的那一项放进岛的外壳，用本机的 Chrome、Edge 或 Chromium 无界面打开，等界面不再变化后截图，2 倍像素。
4. 再用第一张图合成一张封面。

不依赖浮屿的源码，第三方插件装了 `fuyu-plugin` 就能用。要一个 Chromium 内核的浏览器；找不到时设环境变量 `CHROME_PATH`。

### 外壳是照着画的

组件、样式、文字是插件真的；外面那层岛是照浮屿的默认外观重画的，不是浮屿的代码：

| | 展开页（`island.page/v1`） | 收起条（`island.collapsed/v1`） |
|---|---|---|
| 尺寸 | 792 × 360，页面区域 752 × 274 | 高 38，宽度跟内容，左右各留 18 |
| 圆角 | 32 | 23.5 |
| 底色 | 深色 `#030303`，浅色 `#f2f2f5` | 同左 |
| 其他 | 页头只画这个插件自己的页面按钮（选中态） | 只放这个插件的这一项 |

主题变量（`--fuyu-plugin-*`）和岛上的取值一样，字体用系统界面字体。和真岛的差别：页头没有别的页面按钮和右侧的操作按钮；收起条没有岛自己的文字和别的插件项；岛的自定义外观（背景色、圆角、像素字体）都按默认值。要这些的截图仍然在真岛上截。

现在只支持岛上页面和收起条。岛上提醒（`island.alert/v1`、`island.notice/v1`）、设置分节（`settings.section/v1`）、插件独立窗口还不支持，这几种先在真岛和设置窗口里截。

## 示例数据

放在插件文件夹的 `shots/sample.ts`（也认 `.tsx`、`.mts`、`.js`、`.jsx`、`.mjs`、`.json`，只能有一个），默认导出一个对象。它和岛上入口一起打包、在浏览器里运行，所以可以引用插件自己的类型，数据和协议对不上时 `tsc` 会报出来；也可以写函数，按参数算出应答。`shots/` 不进安装包。

```ts
import type { MonitorState } from "../src/protocol.ts";

const state: MonitorState = { /* … */ };

export default {
  now: "2026-11-19T10:24:00",
  host: {
    calls: {
      getState: state,
      watchPage: state,
      getHistory: () => ({ windowMs: 300_000, points: [] }),
    },
    events: [{ topic: "state", data: state }],
  },
  shots: [
    { slot: "island.page/v1", file: "page.png" },
    { slot: "island.collapsed/v1", file: "bar.png" },
  ],
};
```

| 字段 | 说明 |
|---|---|
| `now` | 可选。把页面里的当前时间固定在这一刻（`Date.now()` 和不带参数的 `new Date()`），带相对时间、倒计时、曲线的界面每次截出来都一样。写成 `Date` 能解析的字符串或毫秒数 |
| `host.calls` | 对 `ctx.host.call(方法, 参数)` 的应答，键是方法名。值是数据，或 `(参数) => 数据`（可以返回 Promise）。没写的方法调用会失败，命令在结束时列出这些方法名 |
| `host.events` | 可选。界面挂上之后依次发给 `ctx.host.on(topic, …)` 的事件，`{ topic, data }` |
| `shots` | 可选。要截哪几张，见下表。不写时：插件有岛上页面就截一张 `page.png`，有收起条就截一张 `bar.png` |

`shots` 的每一项：

| 字段 | 说明 |
|---|---|
| `slot` | `island.page/v1` 或 `island.collapsed/v1` |
| `file` | 文件名（`.png`），写进输出文件夹 |
| `id` | 可选。插件在这个插槽注册了不止一项时，按注册时的 `id` 选；不写取第一项 |
| `theme` | 可选。`dark`（默认）或 `light` |
| `locale` | 可选。`zh-CN`（默认）或 `en`，页面里的 `navigator.language` 和 `<html lang>` 跟着它 |
| `width`、`height` | 可选。展开页外壳的宽高，默认 792 × 360，用来截窄面板或更高的面板 |

没有 `shots/sample.*` 也能跑：`ctx.host.call` 全部失败，截出来的是插件的「读不到」状态。

### 宿主服务怎么模拟

不用模拟。岛上的界面代码不直接用宿主服务（待办、计时器、媒体这些只在插件的宿主部分里），它只通过 `ctx.host.call` / `ctx.host.on` 和自己的宿主部分说话，示例数据应答的就是这一层。`ctx.settings.open()`、`ctx.island.open()`、`ctx.island.collapse()` 在截图页里什么也不做。

## 封面

`cover.png`，默认 1280 × 800：插件主色的浅底（深色图是主色 22% 叠在深底上，浅色图是 14% 叠在白底上，和市场卡片封面的底色一样）中间放第一张图（优先展开页），带一圈投影。主色取图标 `assets/icon.svg` 里第一个 `<rect>` 的 `fill`（`fuyu-plugin icon` 生成的图标就是主色），也可以用 `--color` 给。

市场卡片上的封面不用这张图：浮屿在卡片上用清单里第一张截图和图标的主色现场拼（`src/windows/settings/PluginMarketCover.tsx`）。`cover.png` 是给 README、发布说明和分享用的，不必写进 `fuyu.screenshots`。

## 给官方插件加截图（E77.6 用）

1. 在插件文件夹里加 `shots/sample.ts`：照这个插件的 `protocol.ts` 写一份好看的状态，`host.calls` 里把岛上页面和收起条启动时调的方法都答上（跑一次 `shots`，没答的方法会列出来）。带时间的写 `now`。
2. `fuyu-plugin shots`，图写进 `screenshots/`。看一眼图，不对就改示例数据。
3. 把 `screenshots/page.png`、`screenshots/bar.png` 写进 `fuyu.screenshots`，各配中英文 `caption`；`tsconfig.json` 的 `include` 加上 `shots`。
4. 从 `tests/unit/plugin-cli-lint.test.mjs` 的 `PENDING` 里删掉这个插件。

没有自己界面的插件（例如词典）截不了，在它起作用的地方（翻译窗口）手动截。
