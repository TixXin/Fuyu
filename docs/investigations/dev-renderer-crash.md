# 开发版岛的渲染进程崩溃（STATUS_BREAKPOINT）：是哪一处 CHECK

日期：2026-11-15。任务 D67（issue #445）。只读排查，没有改代码。前情见 [dev-island-issues.md](dev-island-issues.md) 第 1 节。

## 结论

两份转储崩在同一处：Blink 预绘制（pre-paint）阶段，`ClipPathClipper::HasCompositeClipPathAnimation` 里的

```cpp
case CompositedPaintStatus::kComposited:
  CHECK(GetClipPathAnimation(layout_object));
```

元素上缓存的「clip-path 动画走合成器」状态还是 `kComposited`，但这时已经找不到那个可合成的 clip-path 动画了（动画被取消、结束或换掉，状态没跟着改），CHECK 失败，渲染进程自己崩掉。这是 Chromium 的 bug（合成 clip-path 动画，`CompositeClipPathAnimation` 特性），不是我们的页面写错了什么；但触发它的是我们自己的代码。

岛上唯一用 Web Animations 动 `clip-path` 的地方是 Agent 页的列表动效 `src/features/agent-status/useListMotion.ts`（`e878d306`，2026-11-15 02:55 合入，三小时后出现这两次崩溃）：会话进出列表时 `row.animate([{ clipPath: "inset(0 0 100% 0)" }, …])`，下一次重排时先 `moving.get(row)?.cancel()` 再给同一行开新动画；离开的行是克隆节点，动画结束后 `remove()`。「刚取消或刚移除一个合成的 clip-path 动画，下一帧的预绘制就去读它」正好对得上这个 CHECK。崩溃那会儿有多个 Claude Code 会话在起停，Agent 列表在频繁增删。

这条因果链有一半是推断：调用栈和 CHECK 是确定的，「是 `useListMotion` 触发的」没有复现过（见下文「还没做的」）。

## 调用栈

两份转储（`e6f8d687-…` 05:48:42，`dbc09061-…` 05:51:03）的栈完全一样，模块偏移逐帧相同。微软公共符号服务器上没有这个 WebView2 版本的 `msedge.dll.pdb`（`8EE0E7D6138E9B194C4C44205044422E1`，请求返回 404），只有导出符号，所以函数名是根据函数里引用的字符串（trace 事件名、`base::Location` 的函数名和文件名）再对照 Chromium 源码认出来的：

| 帧 | msedge.dll 偏移 | 认定的函数 | 依据 |
|---|---|---|---|
| 00 | `+0x4da69c2` | `int3` 陷阱，属于下一行函数的冷代码段 | `.fnent` 显示这段的展开信息链回 `+0x4f8400` |
| — | `+0x4f8400` | 绘制属性树构建（内联了 `ClipPathClipper::HasCompositeClipPathAnimation`） | 冷代码段引用 `clip_path_clipper.cc`、`HasCompositeClipPathAnimation`、`FallbackClipPathAnimationIfNecessary` |
| 01 | `+0x4e7b90` | 调用上面函数的预绘制步骤 | |
| 02–0b | `+0x4e6db1`、`+0x4e6ec9` ×9 | 预绘制树的递归遍历（`PrePaintTreeWalk`），每层一个 DOM/布局节点 | 同一函数递归 10 层 |
| 0c | `+0x4f7cef` | 预绘制遍历入口 | |
| 0d–13 | `+0x979d2e` … `+0x96d961` | `LocalFrameView::RunPrePaintLifecyclePhase` → `UpdateLifecyclePhases` → `WebFrameWidgetImpl::UpdateLifecycle` | 引用 `LocalFrameView::RunPrePaintLifecyclePhase`、`Blink.PrePaint.UpdateTime`、`WebFrameWidgetImpl::UpdateLifecycle` |
| 14–17 | `+0xb0f06b` … `+0xa36f55` | `cc::ProxyMain::BeginMainFrame` | 引用 `ProxyMain::BeginMainFrame`、`cc\trees\proxy_main.cc` |
| 18–19 | `+0x11c806c`、`+0xba703b` | `ThreadControllerImpl::RunTask`、`MessagePumpDefault` | |
| 1a–27 | `ChromeMain` … `RtlUserThreadStart` | 渲染进程主线程（`CrRendererMain`） | |

失败的分支（`msedge+0x4da6b3f` 起）反汇编：

```text
mov  rcx, rsi                 ; rsi = LayoutObject
call msedge+0xf3bb390         ; GetClipPathAnimation(layout_object)
test rax, rax
jne  继续
jmp  msedge+0x4da69c2         ; int3 —— CHECK 失败
```

`msedge+0xf3bb390` 的结构和 Chromium 157（`157.0.8103.39`）的 `GetClipPathAnimation` 一致：从元素取文档和 frame，拿 clip-path 的绘制 worklet 生成器，再虚调用 `GetAnimationIfCompositable(element)`。同一段冷代码里还有两处 `base::Location("HasCompositeClipPathAnimation" / "FallbackClipPathAnimationIfNecessary", "clip_path_clipper.cc")` 后接 `DumpWithoutCrashing`，对应源码里「预绘制之前/之后不该调用」的两处 `DCHECK(false) … DumpWithoutCrashing()`（不致命，崩溃的不是这两处）。Edge 的行号（422、465）和上游 tag 的（295、358）不同，Edge 改过这个文件或取的提交不同，不影响认定。

转储里的其他信息：`ptype=renderer`，`loaded-origin-0=http://localhost:1420`，主线程 `CrRendererMain`，`renderer_foreground=true`，Chromium 157.0.8103.39，NVIDIA 显卡（`gpu-venid=0x10de`，驱动 32.0.16.2101），缩放 1.25。没有 V8 内存不足的迹象，和 GPU 进程无关（崩在渲染进程主线程的生命周期更新里，还没到提交给合成器）。

## 和我们页面的关系

- **clip-path 动画**：见「结论」。全仓库 `src/` 里只有 `useListMotion.ts` 用 `clipPath` 做动画；`IslandTopEdge.css`、`IslandBottomEdge.css` 的 `clip-path: polygon(...)` 是静态的，没有 transition，不会进入这条路径。
- **React StrictMode**（`src/main.tsx`，只在 dev 下双调用 effect）和 **HMR**：会让 `useLayoutEffect` 多跑一次、组件重挂，增加「动画刚开就被取消、节点刚加就被移除」的机会，可能是 dev 下更容易碰到的原因，但不是必要条件。
- **插件平台的 WebSocket**（`packages/plugin-base/src/client/connection.mjs`）：第二份转储里出现这个路径只是因为模块在内存里，和崩溃的调用栈无关。
- **透明窗口、GPU**：崩溃发生在主线程预绘制，跟窗口透明和 GPU 栅格化无关。

## 正式版会不会碰到

会，只是还没见到。`e878d306` 已经在 v0.3.9 里（`git tag --contains` 含 `v0.3.9`），正式版用的是同一个 WebView2 运行时，Agent 页列表变动时同样会跑这些 clip-path 动画。正式版没有 StrictMode 的双调用，触发概率应该低一些。正式版的数据目录里目前没有转储。

## 能不能在我们这边避开

能，而且改动很小：不再用 `clip-path` 做列表行的进出动画，只用 `opacity` + `transform`（例如 `translateY` 加轻微 `scaleY`），或者让行内容在一个 `overflow: hidden` 的容器里位移出现。这样就不会走 Chromium 的合成 clip-path 动画路径。等 Chromium 修好后也没必要改回来。

建议新任务（由主 agent 决定是否建）：**Agent 页列表动效不再动画 `clip-path`，避开 WebView2 157 渲染进程崩溃**，范围 `src/features/agent-status/useListMotion.ts`（和对应的回归页），验收：动效观感接近；在 `pnpm tauri dev` 下反复让会话进出列表不再出现崩溃页。可以顺手加一个回归页或浏览器脚本，在 Chrome 157 里快速 `animate` → `cancel` → 再 `animate` clip-path，看能不能直接复现。

崩溃后自动重载（D66）仍然需要：这是浏览器内核的 CHECK，别的页面写法将来也可能撞上别的 CHECK。

## 还没做的、要用户提供的

1. **没有复现**。下一步可以在本机 Chrome / Edge（157）里写一个最小页面复现（见上面的建议任务）；复现成功的话可以向 Chromium 报 bug（`Blink>Animation`，带上 `CompositeClipPathAnimation`）。
2. 用户能回忆的话：两次崩溃时岛是不是展开在 Agent 页，列表里有没有会话刚出现或刚消失。
3. 如果再崩：最新 `.dmp` 的时间，以及当时开着哪一页。

## 怎么复查

在本机重做一遍符号化的步骤（转储只在本机处理，没有上传）：

1. 装调试器：`winget install Microsoft.WinDbg` 在这台机器上下载被拒（403），改为用 Windows SDK 安装器 `winsdksetup.exe /features OptionId.WindowsDesktopDebuggers /layout <目录>` 只下载调试器的 MSI，再 `msiexec /a "X64 Debuggers And Tools-x64_en-us.msi" /qn TARGETDIR=<目录>` 解出 `cdb.exe`（不需要管理员权限）。
2. 把转储拷到临时目录，`cdb -z <dmp> -y "srv*<缓存>*https://msdl.microsoft.com/download/symbols" -c ".ecxr; kn; !analyze -v; q"`。
3. 没有私有符号时，用 `.fnent <地址>` 找函数范围，`u <起> <止>` 反汇编，把 `lea` 引用的 `.rdata` 地址换算成 RVA，到 `msedge.dll` 文件里读出字符串，就能认出函数。Crashpad 的进程级注释（版本、命令行开关、显卡）在转储的 `0x43500001` 流里。
