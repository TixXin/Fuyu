# 宣传视频

这里用代码做浮屿的宣传视频。画面里的岛屿不是录屏，也不是画出来的：它就是 `src/` 里真的前端，在浏览器里跑，Tauri 那一侧换成了一个假的后端。视频脚本按时间往假后端里放数据、发事件、点真的按钮，无界面浏览器一帧一帧截下来，ffmpeg 压成 MP4。

为什么这样做、对比过哪些工具，见 [docs/research/ai-promo-videos.md](../docs/research/ai-promo-videos.md)。

做一条新视频的顺序、核对方法和踩过的坑整理成了 skill：[.claude/skills/fuyu-video/SKILL.md](../.claude/skills/fuyu-video/SKILL.md)（旁白、配乐、拼静帧的脚本在它的 `scripts/` 里）。

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
| 9:16 竖版 | `pnpm render --v 002-agents --format vertical`（1080×1920，文件名带 `-vertical`） |
| 只出几张静帧 | `pnpm still '9.4,14.5,20'`（秒，逗号分隔；PowerShell 里要加引号，不然逗号会被拆开） |
| 只渲染一段 | `pnpm render --from 18 --to 24`（没有声音） |
| 类型检查 | `pnpm check` |

成片和静帧在 `video/out/<视频 id>/`，不进仓库。默认 1920×1080、60 帧；`--scale 3` 出 3840×2160，`--fps 30` 出 30 帧。

## 已有的视频

| id | 内容 | 时长 |
|---|---|---|
| `001-one-island` | 总览《一座岛》：待办、音乐、消息、剪贴板、翻译、AI Agent 各几秒 | 48 秒 |
| `002-agents` | 功能短片：AI Agent。岛上看会话、弹出审批、看用量、点一下回到终端 | 24 秒 |
| `003-messages` | 功能短片：消息。Windows 桌面录屏的样子，带旁白和配乐；新消息弹出，在岛上读邮件 | 约 28 秒，随旁白长短变 |
| `004-one-day` | 全面介绍《浮屿的一天》：从早到晚八个时刻，待办、日历、消息、AI Agent、剪贴板、翻译、音乐；海报式排版，带旁白和配乐 | 约 45 秒 |

## README 里的动图和截图

仓库首页 README 的动图和截图都从 `001-one-island` 出，放在 `docs/assets/readme/`，中英各一份，文件名以 `-zh` / `-en` 结尾。README 里链接的完整视频是 `docs/assets/promo-001-one-island.mp4`（中文）和 `docs/assets/promo-001-one-island-en.mp4`（英文）。这条视频或岛屿的界面改了之后，在 `video/` 里重出一遍（下面是中文版，英文版把 `zh` 换成 `en`，成片的文件名加 `-en`）：

```powershell
pnpm render --v 001-one-island --lang zh
pnpm still '11,15,18,22.6,27.2,32.6,37.2' --lang zh
Copy-Item out\001-one-island\001-one-island-zh.mp4 ..\docs\assets\promo-001-one-island.mp4
ffmpeg -y -t 43.15 -i out\001-one-island\001-one-island-zh.mp4 -filter_complex "fps=12.5,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 ..\docs\assets\readme\tour-zh.gif
ffmpeg -y -i out\001-one-island\still-zh-011.00.png -vf "scale=1280:-1:flags=lanczos" -c:v libwebp -q:v 90 ..\docs\assets\readme\todo-zh.webp
ffmpeg -y -i out\001-one-island\still-zh-018.00.png -vf "crop=1920:240:0:0,scale=1600:-1:flags=lanczos" -c:v libwebp -q:v 90 ..\docs\assets\readme\collapsed-zh.webp
```

| 文件 | 静帧（秒） | 画面 |
|---|---|---|
| `tour-*.gif` | 0 – 43.15 | 整条视频，不含结尾卡 |
| `collapsed-*.webp` | 18 | 收起的岛在显示歌词，只留画面顶部一条 |
| `todo-*.webp` | 11 | 待办 |
| `music-*.webp` | 15 | 音乐和歌词 |
| `messages-*.webp` | 22.6 | 新消息 |
| `clipboard-*.webp` | 27.2 | 剪贴板 |
| `translate-*.webp` | 32.6 | 翻译 |
| `agents-*.webp` | 37.2 | AI Agent 审批 |

- 动图在 43.15 秒截断：这时岛已经收回、字幕已经消失，循环回开头的画面是接得上的。结尾卡留给完整视频。
- 动图用 12.5 帧：GIF 的帧间隔以 1/100 秒为单位，12.5 帧正好是 8，播放速度不会偏。宽 800 是 GitHub 上 README 正文的宽度，一个动图约 5 MB。
- 截图存成 WebP，一张约 30 KB；六张功能截图都用上面 `todo` 那条命令，只换文件名。

## 横版和竖版

同一份时间表出两种画幅。竖版（`?format=vertical`）上面是一行标题（`stage.set({ title })`），中间是一块圆角的「屏幕」，岛屿面板宽度设成 560；下面留空给平台自己的文字。时间表里镜头倍数用 `ZOOM.panel`、`ZOOM.popup`、`ZOOM.bar`，不写死数字，两种画幅各有一套；开头的窗口位置在 `windows.ts` 里按画幅各写一份。

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
│       ├── 001-one-island/   一条视频：copy.ts 文案，seed.ts 开场数据，windows.ts 开头的窗口，script.ts 时间表
│       └── 002-agents/
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

要改岛屿的设置（例如让收起的岛一直显示会话标题），在 `seed.ts` 里写 `world.settings = { ... }`，只写要改的几项。启动时会和默认设置合并后整份存进去：只存几项的话，岛屿会把它当成旧版本留下的设置，其余项按旧版本的默认值走，岛上审批也会关掉。

岛屿调了一个假后端没有的命令时会得到 `null`，多数情况没事；页面报错会在渲染结束时打印出来，按报错在 `src/app/backend.ts` 里补一条应答。

## 渲染是怎么保证每次一样的

渲染器把浏览器的时钟接管了：每一帧先让虚拟时间前进 1/60 秒，再让浏览器画一帧并截图。`setTimeout`、`Date.now()`、CSS 过渡和动画都跟着虚拟时间走，所以岛屿自己的展开回弹、歌词滚动、消息滑入都是真实的动效，而且每次渲染结果一样，和机器快慢无关。页面里的日期固定在 2026-11-18 10:24。

## 录屏风格、旁白和配乐

`003-messages` 起，视频可以做成 Windows 桌面录屏的样子：

- **桌面**：视频模块给出 `backdrop`（`stage/desktop/WindowsDesktop`：壁纸、应用窗口、任务栏）和 `look: "recording"`（白色光标、字幕条）。窗口和任务栏是 HTML 画的，文字清楚；壁纸是生成的图片。`stage.set({ scene })` 切换桌面的状态，`busy` 时任务栏上带角标的图标闪烁。
- **旁白**：台词写在视频文件夹的 `narration.json`（中英各一份，一句一个 id）。`voice/synth.py` 用本机的 CosyVoice 3 按参考音色合成每一句，存成 `assets/voice/<视频>/<语言>/<id>.mp3`，并把每句的时长写进 `assets/voice/<视频>/durations.json`。时间表从这份时长算出每一句的起点，所以换台词或换语言后重新合成，画面会自动跟上。时间表里 `sound("voice:<id>")` 放一句旁白。
- **配乐**：视频模块的 `bgm` 是 `assets/bgm/` 里的文件名。渲染时配乐循环铺满全片，开头结尾淡入淡出，有旁白时自动压低。

合成旁白（CosyVoice 装在仓库外面，参考音频不进仓库）：

```powershell
& E:\Projects\tools\CosyVoice\.venv\Scripts\python.exe voice\synth.py --video 003-messages --cosyvoice E:\Projects\tools\CosyVoice --reference <参考音频.wav> --reference-text "<参考音频里说的话>"
```

## 海报式排版和时间线

`004-one-day` 用的是另一种舞台：视频模块给出 `scenery`（`stage/day/DayScenery`）和 `look: "editorial"`。`scenery` 画在镜头外面，镜头只缩放岛屿，所以背景上的大数字和时间轴不会跟着放大。一个场景是一个时刻：时间、功能名、天色的两个颜色、太阳的位置、字用深色还是浅色。时间表里 `stage.set({ scene, ink })` 换场景，天色、太阳、数字和时间轴上的小岛一起过渡。

页面里的时钟默认是 10:24。要让界面上显示别的时间（例如新消息的到达时间），在视频文件夹里放 `render.json`：`{ "clock": "11:19:55" }`。
## 声音

`sound("名字")` 在时间表里记一个声音，渲染结束时由 ffmpeg 混进去。`start`、`approval`、`ack`、`complete` 是岛屿自带的音效（`src/assets/sounds/thumb-piano/`，原创，MIT）；`click` 和 `whoosh` 是 ffmpeg 现合成的。没有配乐：要加的话放一首确认可商用的曲子进 `video/assets/`，在这里记下来源和授权。
