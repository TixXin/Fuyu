# tauri-cordis 对外发声：顺序和草稿

给 [tauri-cordis](https://github.com/TixXin/tauri-cordis) 引流用的帖子和文章草稿（E78）。这里只是草稿，发不发、发在哪、用哪个账号由用户定；发之前按当时的版本号和数字再核对一遍。

## 先做完再发

发出去的链接点进来要能立住，下面几条没满足之前不发：

- tauri-cordis 的新 README、文档和示例应用已经合进 `main`，`examples/tauri-app` 照 README 的命令能跑起来。
- 发一个补丁版本（0.2.1），让 npm 页面带上新的 README 和 `keywords`。npm 上的 README 和关键词只在发版时更新。
- 仓库设置里上传社交预览图（Settings → General → Social preview），否则链接贴到聊天软件里只有 GitHub 的默认卡片。
- 打开私下报告漏洞（Settings → Security → Private vulnerability reporting），`SECURITY.md` 指向的入口才存在。
- 浮屿的 README 已经链到 tauri-cordis（已做）。

顺序建议：awesome-tauri（留得最久）→ Cordis / Koishi 社区（最对口）→ 文章 → Tauri Discord、Reddit、V2EX 带上文章链接。Hacker News 放最后，等前面有了几条真实反馈再发。

## awesome-tauri

仓库 [tauri-apps/awesome-tauri](https://github.com/tauri-apps/awesome-tauri)，放在 `## Integrations` 一节，按字母序插在 `tauri-mcp-server` 之前。格式照它现有的条目：

```markdown
- [tauri-cordis](https://github.com/TixXin/tauri-cordis) ![v2] - Plugin runtime that lets users extend a Tauri app at run time: a supervised Node host, versioned services and React slots.
```

PR 标题：`Add tauri-cordis to Integrations`。正文一两句：它是什么、和 `tauri-plugin-*` 的区别（用户在运行时装的，不是开发者编译进去的）、浮屿在用。

浮屿本身也可以另提一条放进应用列表，那是另一个 PR。

## Tauri Discord（#showcase）

```text
tauri-cordis: let users extend your Tauri app at run time

I pulled the plugin runtime out of Fuyu (a desktop island for Windows and macOS, built on Tauri 2) into its own MIT library.

- Built-in features and third-party extensions are the same thing: plugins you can switch on, off or replace while the app runs
- Plugins run in one headless Node process that Rust supervises; UI goes into named React slots in your windows
- Typed, versioned services between plugins; everything a plugin registers is undone when it stops
- Manifest, signed packages, a signed market index and a version-to-version review tool are included
- 60+ written guarantees, each with a test

It is not a tauri-plugin-*: those are compiled in by the developer, this is for code users install later. Plugins are not sandboxed, and the README says what that costs.

https://github.com/TixXin/tauri-cordis
There is a small notes app in examples/tauri-app to try it.
```

## Reddit（r/tauri，可以转 r/rust）

标题：

```text
I turned all 22 features of my Tauri app into plugins, then open-sourced the runtime
```

正文：

```text
Fuyu is a desktop island for Windows and macOS (Tauri 2, about 430 stars). Users kept asking for things I did not want to build into the core, so I rebuilt it so that every feature is a plugin, the built-in ones included, and third-party plugins use the same interfaces.

The runtime is now a separate MIT library, tauri-cordis:

- One headless Node process hosts all plugins. Rust starts it, pings it, restarts it with backoff.
- Windows talk to it over a local WebSocket with a per-launch token, not through Tauri events.
- Plugins talk through versioned services (`notes/v1`). A plugin waits for the services it needs and stops when their provider stops.
- UI goes into named slots. Each item has its own error boundary.
- The kernel is Cordis (the framework under Koishi), so timers, listeners and services a plugin registers are undone when it stops. Loading and unloading a plugin 1000 times leaves the heap and the handles where they were, and there is a test for it.

What it costs: you ship with Node (found on the machine or downloaded, about 25 MB for the idle host on macOS in my measurements), and plugins are not sandboxed. A plugin has the user's permissions; the protection is a market that builds from source, reviews every version, signs, and can revoke.

Repo: https://github.com/TixXin/tauri-cordis
Example app with a real window: examples/tauri-app

Happy to hear where this is wrong for your app.
```

## Cordis / Koishi 社区

发在 Cordis 仓库的 Discussions 或 Koishi 论坛，中文：

```text
标题：把 Cordis 用在 Tauri 桌面应用里：tauri-cordis

我在做一个桌面灵动岛「浮屿」（Tauri 2，Windows 和 macOS）。为了让内置功能和第三方扩展用同一套接口，把整个应用改成了 Cordis 插件树：22 个内置功能都是插件，市场里还有 12 个官方插件。

外面那一圈单独开源了，叫 tauri-cordis（MIT）：

- Rust 这边看管一个无界面的 Node 宿主进程：心跳、退避重启、找不到 Node 时下载并核对哈希
- 窗口用本机 WebSocket 连宿主，每次启动换令牌
- 在 Cordis 的 service 之上加了带版本的服务（notes/v1）：声明方法和事件，校验参数，带超时，窗口里也能调
- 界面插槽：窗口声明位置，插件往里放 React 组件
- 清单、可复现的包、签名、市场索引、版本对比审核

Cordis 是以构建产物的形式放在 vendor 里的（cordis 4.0.0-rc.13），有三处本地改动，都写在 vendor/README.md 里：
1. loader 里的 new Function 改成用到时才建（宿主带 --disallow-code-generation-from-strings 启动）
2. emit 逐个 try/catch，一个监听器抛错不影响同一事件的其他监听器
3. 删掉了 core 的 bin

第 1、2 条如果上游愿意收，我可以提 PR。也想听听把 Cordis 这样用有没有踩到你们已经知道的坑。

https://github.com/TixXin/tauri-cordis
```

第 1、2 条向上游提 PR 是另一件事，要做的话单独建任务。

## V2EX / 掘金

标题备选：

- 把一个 Tauri 应用的 22 个功能全改成了插件，底座开源了
- 给 Tauri 应用做一套「用户能自己装」的插件系统，我是怎么做的

正文用下面文章的前三节加仓库链接即可，不用另写。

## 文章

题目：**把一个 Tauri 应用的全部功能改成插件**（英文：*Every feature a plugin: rebuilding a Tauri app around a plugin host*）

发在博客，再转到掘金、dev.to。下面是提纲和每节要写的点，数字都来自仓库里的文档，发之前按文档再核对。

1. **为什么要改**
   - 用户想要的功能越来越多，都做进本体不现实。
   - 上一版插件各跑各的进程：一个 PowerShell 插件约多占 60 MB（[idle-usage.md](../../investigations/idle-usage.md)），而且内置功能和插件是两套写法。
   - 目标：内置功能和第三方扩展用同一套接口，每项能力能被替换，每块界面能往里加东西。
2. **几个决定和放弃了什么**
   - 插件和应用同权，不做沙箱。理由和代价，防线放在安装之前（[plugin-security.md](../../research/plugin-security.md)）。
   - 宿主是独立的 Node 进程，不放在 WebView 里，也不嵌进 Rust。安装包不带 Node，找不到时再下载。
   - 内核用 Cordis，不自己写（[cordis-vs-rutis.md](../../research/cordis-vs-rutis.md)）。
   - 窗口和宿主之间走 WebSocket，不走 Tauri 的事件。
3. **做出来是什么样**
   - 三处代码各在哪跑；一个插件的两半；服务和插槽各一段代码（用 tauri-cordis README 里的例子）。
   - 「副作用自己撤掉」带来的东西：运行时开关、热重载、反复出错自动停用。
4. **数字**
   - 闲置的宿主进程在 macOS 上约 25 MB；冷启动开着关着一样（约 0.58 秒）。来源：[v3-progress.md](v3-progress.md)「基线和实测」、[v3-kernel-measurements.md](../../investigations/v3-kernel-measurements.md)。
   - 同一个插件装卸 1000 次，GC 后的堆从 8.7 MB 到 9.2 MB，句柄不变。
   - 六十多条保证，每条一个测试。
5. **没解决的和不适合的场景**
   - 不信任的代码不该用它跑。
   - 要带 Node；界面只支持 React。
   - 0.x，默认值里还有浮屿的名字（E79）。
6. **怎么用**
   - 仓库、示例应用、三行命令。

可选的一节：这次重构是多个 AI 编程会话并行做的，从方案定稿到下线旧版用了大约五天（2026-11-14 到 11-18）。写不写、写多细由用户定；要写的话数字从 [v3-progress.md](v3-progress.md) 的进度表里取。

## Hacker News

```text
Show HN: tauri-cordis – a plugin runtime for Tauri apps, extracted from a desktop island
```

第一条评论自己写：为什么不做沙箱、为什么带 Node。这两点一定会被问，先答。
