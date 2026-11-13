---
name: fuyu-video
description: >
  This skill should be used in the Fuyu repo whenever the user asks to make, change or
  re-render a promo video for the app — including 做视频, 宣传视频, 宣传片, 短视频, 功能短片,
  再做一条, 下一条, 竖版, 英文版, 旁白, 配音, 配乐, BGM, 结尾卡, 重新渲染, 重出成片, 封面,
  README 动图, promo video, launch video, render. Covers the concept, the script, narration
  with a local voice model, background music, rendering all cuts, checking them and landing.
  Not for recording the real desktop app and not for release notes.
---

# 浮屿宣传视频

工具的用法、目录和每种舞台的说明在 `video/README.md`，为什么这样做在 `docs/research/ai-promo-videos.md`。下面排顺序，并记下做前四条时踩过的坑。做到哪一步读哪一节。

## 不变的几条

- **界面必须是真的。** 画面里的岛屿是 `src/` 的前端对着假后端（`video/src/app/`）在跑，时间表往里放数据、发事件、点真的按钮。不重画界面，不用文生视频模型生成界面。
- **不用 AI 生成的实拍镜头。** 用户看过后定的：太假。只做软件画面。
- **内容要有出处，素材要是编的。** 画面上的每句话能在 README 或 `docs/features/` 找到；歌名、歌词、人名、聊天内容、邮件都自己编，不用真实的歌和真人。
- **不出现 Logo**（还在征集），用胶囊和「浮屿 Fuyu」字标。结尾卡的链接写 `官网:https://fuyu.ing`，英文版写 `Website: https://fuyu.ing`。
- **用户默认要的成片**：带配乐、带女声旁白、有设计感；中英文、横版（1920×1080）竖版（1080×1920）共四个文件。
- **花钱的生成服务先问。** Pollo 网页上的「无限」只在网页里生效，CLI 和 MCP 照常扣积分（实测过），而且它没有配乐和语音模型。要用就把提示词写给用户，让用户在网页里生成。

## 顺序

1. **开 lane、建任务**（`lanes` skill）：`pnpm tasks add D<n> --title .. --claim --as <会话名> --scope "video/"`。
2. **定概念，先告诉用户再动手**：一句话的想法、时长、每段展示什么。一条视频只讲一个想法（总览、单个功能、一天的时间线），不是功能清单。用户让「全网学习」时，把结论写进 `docs/research/ai-promo-videos.md` 的一个带日期的新节。
3. **新建视频模块**：复制最接近的一条（`video/src/videos/`），在 `src/main.tsx` 的 `VIDEOS` 登记。三种舞台按需要选：
   - 默认：自画壁纸，开头可以有一堆窗口（001、002）。
   - `backdrop` + `look: "recording"`：Windows 桌面录屏的样子（003）。
   - `scenery` + `look: "editorial"`：海报式排版，背景不随镜头缩放（004）。
4. **写台词**：`narration.json`，中英各一份，一句一个 id，一句对应一个画面。第一句是痛点，最后一句是名字加「开源、免费」。
5. **合成旁白**（见下面「旁白」），得到 `assets/voice/<视频>/durations.json`。时间表从每句的时长算起点（照 `003-messages/script.ts` 的 `beats()`），不要手写时间。
6. **写时间表** `script.ts`，再 `pnpm still '<时间点>'` 出静帧。用 `scripts/sheet.ps1` 拼成一张图看，一次看 8–12 帧。有问题改了再出，直到每段的操作都落在对应的旁白里。
7. **竖版和英文版各出一遍静帧**。英文句子长，最容易压到别的字；竖版的窗口位置、字幕位置都是另一套。
8. **配乐**（见下面「配乐」），放进 `assets/bgm/`，模块里写 `bgm`。
9. **先渲染中文横版一个文件**，核对后用 `Start-Process` 打开给用户看。用户说可以，或者没有新意见，再后台渲染另外三个。
10. **核对、提交、land**（见「核对」）。成片不进仓库；用户定稿后才把中文横版放进 `docs/assets/`。任务等用户看过成片再 `tasks done`。

## 核对

每个成片都做，结果如实写进回复和 PR：

- 渲染结束时有没有打印 `page errors`。`island element not found` 说明那一步没点到，画面一定不对。
- `ffprobe` 看分辨率、时长、有没有音轨；`ffmpeg -af volumedetect` 看音量。旁白约 -19 dB，配乐在句间约 -31 dB 是用户认可过的水平。
- 从成片抽帧拼图看：`scripts/sheet.ps1 -From <mp4> -Times ...`。重点看转场前后、结尾卡、字有没有互相压住。
- 旁白用语音识别回读：`scripts/readback.py`。中文会有同音字，只要不是漏字、读错词就算过。
- **你听不了声音。** 音色、读音、配乐好不好听只能让用户判断，回复里直接说，并指出回读里拿不准的那几句。

## 旁白

本机用 CosyVoice 3（仓库外，`E:\Projects\tools\CosyVoice`，自带 `.venv`）。

```powershell
cd video
& E:\Projects\tools\CosyVoice\.venv\Scripts\python.exe voice\synth.py --video <视频 id> --cosyvoice E:\Projects\tools\CosyVoice --reference E:\Projects\tools\cosy-run\ref-clean.wav --reference-text "第三件，一堆图片要压缩、换格式，系统自带的办法得绕好几步。" --lang zh,en
& E:\Projects\tools\CosyVoice\.venv\Scripts\python.exe ..\.claude\skills\fuyu-video\scripts\readback.py --lang zh (Get-ChildItem assets\voice\<视频 id>\zh\*.mp3 | ForEach-Object FullName)
```

- 只重做几句：加 `--only l3,l5`。改了台词就重新合成，时间表自己会跟上。
- `ref-clean.wav` 是从用户给的参考女声里取的 6.6 秒，已经去掉背景音乐；`--reference-text` 必须是这段音频里说的原话。参考音频不进仓库。
- 换参考音色时：先转写找一段 5–10 秒、纯中文、句子完整的；音频里有背景音乐就先做人声分离（`python -m demucs --two-stems vocals -n htdemucs`），再裁成 16 kHz 单声道。句间空隙的音量从 -21 dB 降到 -49 dB 才算干净。
- 克隆的声音会公开发布，换新的参考音色时向用户确认有权使用。
- 重装环境：Python 3.10；RTX 50 系要 `torch==2.7.1` 和 `torchaudio==2.7.1` 的 cu128 版，不能用仓库钉的 2.3.1；`openai-whisper` 不钉版本并加 `setuptools<81`；另外装 `pyworld`（只要预编译包）、`faster-whisper`、`demucs`（`--no-deps`）、`sphn`。模型从 ModelScope 下 `FunAudioLLM/Fun-CosyVoice3-0.5B-2512`。

## 配乐

本机用 ACE-Step 1.5 生成纯音乐（仓库外，`E:\Projects\tools\ACE-Step-1.5`）。

```powershell
cd E:\Projects\tools\ACE-Step-1.5
uv run python E:\Projects\fuyu-lanes\<N>\.claude\skills\fuyu-video\scripts\bgm.py --ace . --out E:\Projects\tools\ace-run\<视频 id> --caption "modern minimal electronic product film music, warm analog synth arpeggio, soft kick, airy pads, uplifting, clean, no vocals" --bpm 108 --duration 70 --seeds 5,31
```

- 时长比视频长 15 秒以上。一次出两首（批量上限是 2），用可量的指标挑：`ebur128` 的 LRA 小（平稳）、中间没有静音、`readback.py` 回读是空的（没有人声）。
- 转成成片用的文件：裁到尾部静音之前，`loudnorm=I=-16:TP=-1.5`，结尾 1–1.5 秒淡出，存成 `video/assets/bgm/<视频 id>.mp3`。
- 渲染器会循环铺满、开头结尾淡入淡出、有旁白时压低。压得太狠就听不见：现在的参数在 `render/render.mjs` 的 `sidechaincompress` 和 `volume=0.8`。
- 模型下载卡住时设 `$env:ACESTEP_DOWNLOAD_SOURCE = 'modelscope'` 再 `uv run acestep-download`（文档里写的 `--download-source` 参数下载器不认）。

## 踩过的坑

- **渲染期间不要改 `video/src/`，也不要 rebase 或 land。** 渲染器自带的 Vite 会热更新，正在渲染的那条会坏。要改就等它结束，或者先停掉它的 `node`、`chrome-headless-shell`、`ffmpeg`。
- **一条 45 秒的片子渲染约 3–4 分钟**（带颗粒和大面积渐变的更慢），四个文件放后台跑。
- **PowerShell 里 `pnpm still '2.5,6,9'` 要加引号**，逗号会被拆成多个参数。
- **改岛屿设置用 `world.settings`**，只写要改的几项，启动时会和默认值合并。直接往 `localStorage` 存几项会让岛屿按旧版本安装处理，岛上审批被关掉。
- **收起的岛想一直显示会话标题**：`agentTitleMode: "running"`。会话一开始就在跑会弹「开始」提醒，挡住别的画面：`agentAlertStarted: "off"`。
- **会前倒计时一出现就占着收起的岛**，直到会议开始后 5 分钟。只想展示日历页时设 `calendarRemindMinutes: 0`。
- **界面上的时间来自页面时钟**，默认 10:24。要让新消息显示别的时间，在视频文件夹放 `render.json`（`{ "clock": "11:19:55" }`），消息的时间戳用 `Date.now()`。已经过去的会议没有「加入」按钮，会议的结束时间要晚于时钟。
- **点新消息里的邮件能在岛上读**，正文放在 `world.mailBodies`；面板矮看不全就设 `maxPanelHeight`。
- **假后端没有的命令返回 `null`**。页面报错时按报错在 `backend.ts` 补一条应答，返回的结构照对应 `api.ts` 的类型写。
- **结尾卡出现时把字幕收掉**，结尾卡自己已经有名字和一句话；不收的话英文的长句会压在网址上。
- **同一个选择器在不同页面指向不同的东西**。点之前用静帧确认点到了（光标落点和点击后的变化）。`.window-actions > .icon-button:last-child` 才是收起按钮，不带 `>` 会点到排序。
- **ffmpeg 混音偶尔卡死**，渲染器超时 90 秒自动重试，最多 4 次。看到 `retrying` 不用管。
- **批量改 CSS 时核对替换了几处。** 一次替换把竖版规则的选择器改坏过，竖版的字幕规则套到了横版上。
