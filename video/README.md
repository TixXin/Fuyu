# 宣传视频

这里用代码做浮屿的宣传视频。画面里的岛屿不是录屏，也不是画出来的：它就是 `src/` 里真的前端，在浏览器里跑，Tauri 那一侧换成了一个假的后端。视频脚本按时间往假后端里放数据、发事件、点真的按钮，无界面浏览器一帧一帧截下来，ffmpeg 压成 MP4。

为什么这样做、对比过哪些工具，见 [docs/research/ai-promo-videos.md](../docs/research/ai-promo-videos.md)。

## 准备

```powershell
cd video
pnpm install --ignore-workspace
pnpm browser
winget install Gyan.FFmpeg
```

- `pnpm install --ignore-workspace`：这个目录不在 pnpm workspace 里，只装渲染用的两个包。React、Vite、TypeScript 用仓库根目录的，所以先在根目录 `pnpm install`。
- `pnpm browser`：下载 chrome-headless-shell 到 `video/.browser/`（约 220 MB）。逐帧渲染要用它，普通 Chrome 不行。
- ffmpeg 要在 `PATH` 里，或者渲染时用 `--ffmpeg <路径>` 指定。

## 常用命令

| 用途 | 命令 |
|---|---|
| 浏览器里实时预览 | `pnpm dev`，打开 `http://localhost:1430/?v=001-one-island&lang=zh` |
| 渲染成片 | `pnpm render --v 001-one-island --lang zh` |
| 英文版 | `pnpm render --lang en` |
| 只出几张静帧 | `pnpm still 9.4,14.5,20`（秒，逗号分隔） |
| 只渲染一段 | `pnpm render --from 18 --to 24`（没有声音） |
| 类型检查 | `pnpm check` |

成片和静帧在 `video/out/<视频 id>/`，不进仓库。默认 1920×1080、60 帧；`--scale 3` 出 3840×2160，`--fps 30` 出 30 帧。

## 目录

```text
video/
├── index.html            舞台页面：桌面、镜头、字幕、光标、结尾卡
├── app.html              岛屿页面：真的前端加假后端，嵌在舞台里
├── src/
│   ├── main.tsx          读 ?v= 和 ?lang=，装好舞台，交给渲染器控制
│   ├── app/              假后端：world.ts 是状态，backend.ts 应答 Tauri 命令
│   ├── stage/            舞台零件，所有视频共用
│   └── videos/
│       ├── types.ts
│       └── 001-one-island/   一条视频：copy.ts 文案，seed.ts 开场数据，windows.ts 开头的窗口，script.ts 时间表
├── render/render.mjs     渲染器
├── out/                  成片和静帧（不进仓库）
└── .browser/             chrome-headless-shell（不进仓库）
```

## 加一条新视频

1. 复制 `src/videos/001-one-island/` 为 `src/videos/<编号>-<名字>/`，在 `src/main.tsx` 的 `VIDEOS` 里登记。
2. `copy.ts` 写中英文案。画面上的每句话都要能在 README 或 `docs/features/` 里找到出处。
3. `seed.ts` 准备开场时岛上的数据。不要用真实的歌、真实的人名和聊天内容。
4. `script.ts` 写时间表：`at(毫秒, 动作)`。动作用 `island.click(选择器)` 点真的按钮，用 `island.world()` 改假后端的数据，用 `island.emit(事件, 数据)` 模拟原生事件，用 `showCaption`、`moveCamera` 控制字幕和镜头。
5. `pnpm still <几个时间点>` 看静帧，没问题再 `pnpm render`。

岛屿调了一个假后端没有的命令时会得到 `null`，多数情况没事；页面报错会在渲染结束时打印出来，按报错在 `src/app/backend.ts` 里补一条应答。

## 渲染是怎么保证每次一样的

渲染器把浏览器的时钟接管了：每一帧先让虚拟时间前进 1/60 秒，再让浏览器画一帧并截图。`setTimeout`、`Date.now()`、CSS 过渡和动画都跟着虚拟时间走，所以岛屿自己的展开回弹、歌词滚动、消息滑入都是真实的动效，而且每次渲染结果一样，和机器快慢无关。页面里的日期固定在 2026-11-18 10:24。

## 声音

`sound("名字")` 在时间表里记一个声音，渲染结束时由 ffmpeg 混进去。`start`、`approval`、`ack`、`complete` 是岛屿自带的音效（`src/assets/sounds/thumb-piano/`，原创，MIT）；`click` 和 `whoosh` 是 ffmpeg 现合成的。没有配乐：要加的话放一首确认可商用的曲子进 `video/assets/`，在这里记下来源和授权。
