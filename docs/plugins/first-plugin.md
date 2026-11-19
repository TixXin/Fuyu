# 从零做一个插件

做一个「喝水」插件：岛上多一页，显示已经喝了几杯，点一下加一杯，重启浮屿后数字还在。大约 15 分钟，做完你会用到插件的三样东西：后台逻辑（宿主部分）、岛上的界面、清单里的声明。

想让 AI 代你写，直接看最后的[让 AI 来写](#让-ai-来写)。

## 准备

- Node 22.15 或更新。
- 浮屿开着。
- 知道一点 TypeScript 和 React 就够。

插件和浮屿权限一样，没有沙箱：宿主部分是普通的 Node 代码，能读写文件、联网、运行程序。所以只写这个功能需要的事。

## 建项目

```bash
npm create fuyu-plugin@latest water
```

它会问你的 GitHub 用户名（包名是 `@<用户名>/<插件名>`，只在本机用时随便填一个英文名）和插件的中英文名字。不想被问就把答案写在命令里：

```bash
npm create fuyu-plugin@latest water -- --owner <你的 GitHub 用户名> --name water --display-name Water --display-name-zh 喝水 --yes
```

然后装依赖，跑起来：

```bash
cd water
npm install
npm run dev
```

`npm run dev` 先构建，再把插件登记进正在运行的浮屿，之后盯着源码，改了自动重新构建，浮屿跟着重新加载。它不会自己退出，另开一个终端做后面的事。

现在展开岛，页头多了一个按钮，点开是脚手架自带的示例：一个计时页。下面把它改成喝水。

## 项目里有什么

| 文件 | 在哪里运行 | 清单里对应的声明 |
|---|---|---|
| `src/host.ts` | 浮屿的插件进程（Node）：后台逻辑、文件、联网 | `fuyu.host: "dist/host.js"` |
| `src/island.tsx` | 岛窗口（React） | `fuyu.client.island: "dist/island.js"` |
| `src/settings.tsx` | 设置窗口（React） | `fuyu.client.settings: "dist/settings.js"` |
| `src/styles.css` | 跟着引用它的窗口 | 不用声明 |
| `package.json` | 清单，浮屿的字段在 `fuyu` 下 | |
| `AGENTS.md` | 给 AI 编程代理看的规则（2.1.0 起的脚手架才生成） | |

三个部分都可以不要，用不上的连同清单里的那一行一起删。清单写的是构建出来的文件，构建按路径找源码：`dist/host.js` 来自 `src/host.ts`。

窗口里不能用 Node。窗口要读写文件、联网，都是去问宿主部分：

- 窗口问：`ctx.host.call(方法名)`；宿主答：`ctx.clients.handle(方法名, 处理函数)`。
- 宿主主动发：`ctx.clients.publish(主题, 数据)`；窗口听：`ctx.host.on(主题, 回调)`。

## 第一步：宿主部分

杯数存在插件的数据目录里。`ctx.dataDir` 是浮屿分给这个插件的文件夹，插件的数据都放在它下面。

读写文件要用 Node 的 `fs`，先装上 Node 的类型声明：

```bash
npm install -D @types/node
```

把 `src/host.ts` 整个换成：

```ts
/// <reference types="node" />
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "fuyu-plugin";

export const name = "water";
export const inject = ["clients"];

export function apply(ctx: Context) {
  const file = join(ctx.dataDir, "count.json");
  let count = 0;
  try {
    count = Number(JSON.parse(readFileSync(file, "utf8")).count) || 0;
  } catch {
    count = 0;
  }

  ctx.clients.handle("count", () => count);
  ctx.clients.handle("drink", () => {
    count += 1;
    mkdirSync(ctx.dataDir, { recursive: true });
    writeFileSync(file, JSON.stringify({ count }));
    ctx.clients.publish("count", count);
    return count;
  });
}
```

- 第一行让 TypeScript 认得 `node:fs` 这些模块。只在宿主部分的文件里写，窗口代码用不了 Node。
- `inject` 列出这个文件用到的 `ctx` 上的东西：这里只用了 `ctx.clients`（和窗口通信）。用到别的服务（待办、消息、计时……）时，把服务名加进来，清单里也要加，见下面[改清单](#第三步删掉示例改清单)。
- `apply` 在插件启用时运行一次。插件停用时，经 `ctx` 登记的东西（处理函数、定时器、订阅）会自动撤掉，不用自己清理。
- 在浮屿仓库里建的项目，`"fuyu-plugin"` 写成 `"@fuyu/plugin-base"`；照生成的示例里的写法就行。

## 第二步：岛上的页面

界面文字放在 `src/text.ts`，中英文各一份。把它整个换成：

```ts
const en = {
  drink: "I drank a glass",
  count: (cups: number) => `${cups} glasses so far`,
};

const zhCN: typeof en = {
  drink: "喝了一杯",
  count: (cups: number) => `已经喝了 ${cups} 杯`,
};

export const text = navigator.language.toLowerCase().startsWith("zh") ? zhCN : en;
```

再把 `src/island.tsx` 整个换成：

```tsx
import type { Context } from "fuyu-plugin";
import { useEffect, useState } from "react";
import { text } from "./text.ts";
import "./styles.css";

export default function apply(ctx: Context) {
  function Page() {
    const [count, setCount] = useState(0);
    useEffect(() => {
      const off = ctx.host.on("count", setCount);
      void ctx.host.call<number>("count").then(setCount);
      return () => {
        void off();
      };
    }, []);
    return (
      <div className="water">
        <p className="water__note">{text.count(count)}</p>
        <button type="button" className="water__button" onClick={() => void ctx.host.call("drink")}>
          {text.drink}
        </button>
      </div>
    );
  }

  ctx.slots.add("island.page/v1", { id: "water", title: { "zh-CN": "喝水", en: "Water" }, component: Page });
}
```

- `ctx.slots.add("island.page/v1", …)` 往岛上加一页。岛和设置窗口上能放插件界面的位置叫插槽，有哪些见[服务、接缝与插槽参考](services-and-slots.md)「三、窗口界面插槽」。
- 页面先听 `count` 这个主题，再问一次当前的杯数。点按钮只调 `drink`，新的数字由宿主发回来，这样开着两个窗口也对得上。
- 界面文字中英文都要有，标题写成 `{ "zh-CN": "…", en: "…" }`。
- `src/styles.css` 里已经有 `.water`、`.water__note`、`.water__button` 这几个样式，颜色用的是 `--fuyu-plugin-text`、`--fuyu-plugin-accent` 这类主题变量，深色岛和浅色岛都能看。class 名都带插件名做前缀，因为插件的样式和浮屿的在同一个窗口里；用不上的规则可以删。

## 第三步：删掉示例，改清单

删掉示例里用不上的三个文件：`src/settings.tsx`、`src/timers.ts`、`src/useTimers.ts`。

再改 `package.json` 里 `fuyu` 下的三处，让声明和代码对得上：

```json
"client": {
  "island": "dist/island.js"
},
"inject": {
  "required": ["clients"]
},
"slots": ["island.page/v1"]
```

- `client` 去掉了 `settings`，因为 `src/settings.tsx` 删了。
- `inject.required` 去掉了 `timers/v1`，和 `src/host.ts` 里的 `inject` 一样。
- `slots` 只留用到的 `island.page/v1`。

浮屿、构建和市场都会拿清单和代码比，对不上的插件会被标出来：声明了没用的要删，用了没声明的要加。字段的完整说明见[清单和安装包](package.md)。

## 看效果，自查

`npm run dev` 还开着的话，保存后岛上的页面已经换成喝水了：点「喝了一杯」，数字加一；退出浮屿再打开，数字还在。

没出现时，看 `npm run dev` 的终端有没有构建错误，再看浮屿 设置 → 插件 里这个插件那一行的报错。

然后跑三项检查：

```bash
npm run typecheck
npm run lint
npm run check
```

- `typecheck`：类型。
- `lint`：除了常规规则，还会拦 `setTimeout`、`addEventListener`、手写 `<style>` 这类插件停用后撤不掉的写法。定时器在宿主部分用 `ctx.setTimeout`、`ctx.setInterval`，样式用 `import "./styles.css"`。
- `check`：市场会拦下的问题（报错），和上架前该补的东西（告警，比如还没有截图、依赖有变化）。新项目会以 `ok with N warning(s)` 结束，这就是通过；只在自己电脑上用，告警可以不管。

不想要这个插件了，把开发登记去掉：

```bash
npx fuyu-plugin dev --clean
```

## 让 AI 来写

浮屿的 设置 → 关于 → 插件系统 里有「让 AI 帮你写」：写下想要的功能，点「复制提示词」，发给能运行命令的 AI 代理（Claude Code、Codex、Cursor 这类）。提示词会让它建项目、先读文档再写、跑上面三项检查，并在做完后告诉你插件读了什么、写了什么、连了哪些网址。

脚手架（2.1.0 起）生成的 `AGENTS.md` 写的是同一套规则：声明要和代码对得上、名字只用文档里有的、停用时要撤干净。多数 AI 编程代理打开项目时会自己读它。

AI 写的插件和别的插件一样，有浮屿的全部权限。用之前看一眼它列出的那份清单。

## 下一步

- 在收起条上放一个小块、给消息加来源、加设置项：[服务、接缝与插槽参考](services-and-slots.md)。
- 用浮屿的服务（待办、剪贴板、计时、消息、翻译）：同一篇的「一、公开服务」，示例里的 `timers/v1` 就是一个。
- 清单的全部字段、联网要声明的 `fuyu.network`：[清单和安装包](package.md)。
- 命令行的其余命令（图标、截图、打包）：[命令行](cli.md)。
- 抄现成的写法：[官方插件的源码](../../plugins/v3/official)（天气、番茄钟、世界时钟、GitHub 提醒）。
- 发到市场：[发布](publish.md)和[市场规则](market-rules.md)。
