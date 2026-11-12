# 用 AI（Claude Code / Fable 5.2）批量做宣传视频

> 日期：2026-11-13。问题：全网搜集「AI 做视频、Claude / Opus / Fable 5.2 做视频」的资讯和开源项目，为浮屿在短视频平台、B 站、X 上批量发宣传视频定一套方案。范围：WebSearch 搜「Claude Code Remotion skill」「Claude Opus 生成视频 Remotion 教程」「HyperFrames / Revideo / OpenMontage」「Fable 5 launch video」「Screen Studio alternative open source Windows」「开源中文 TTS」「AI video models 2026」「AI 生成内容标识 B 站 抖音」「X / bilibili 视频规格」；打开核对了 Remotion、remotion-dev/skills、heygen-com/hyperframes、getopenscreen/openscreen、calesthio/OpenMontage、browser-use/video-use、digitalsamba/claude-code-video-toolkit、index-tts、CosyVoice、Revideo 的 GitHub 页面，Remotion 的价格页和提示词库，remocn 的发布视频指南，以及几篇实践文章。star 数、版本、价格都是 2026-11-13 查的。相关任务：无（方案等用户确认后再建）。

## 结论

> 2026-11-13 更新：第一条视频（任务 D32）没有用下面建议的 Remotion，也没有用录屏。实际做法见本节末尾「实际采用的做法」，工具在 [video/](/video/README.md)。
- **Claude（包括 Fable 5.2）不直接生成视频画面，它写代码，代码渲染出视频。** 现在公开的做法几乎都是这一条路：Claude Code 写 React（Remotion）或 HTML + GSAP（HyperFrames），逐帧渲染成 MP4，再用 ffmpeg 拼接、配音轨。Veo、Kling、Seedance 这类「文生视频」模型是另一类东西，生成的是实拍感的镜头，画不出准确的软件界面。
- **对浮屿最合适的是「真实界面 + 代码动画」**：界面必须是真的（真组件渲染或真机录屏），标题、字幕、转场、配乐由代码生成。文生视频模型最多用来做开头两三秒的氛围镜头，界面一律不让模型生成，否则等于展示不存在的功能。
- **建议的技术栈**（都是开源或对个人免费）：
  1. 合成：**Remotion**（React，和浮屿前端同一套技术，能直接用项目的设计变量，有希望直接渲染 `src/` 里的真组件）。个人和 3 人以内的团队免费。备选 **HyperFrames**（Apache-2.0，HTML + GSAP，专为 AI 代理设计），在第一步试做里用同一份脚本各做一条，比完再定。
  2. 素材：**OpenScreen**（MIT，Windows 可用，带自动缩放、光标效果，有命令行和 MCP，代理能自己录）录 `pnpm dev:lane:center` 的预览岛屿；需要完全可重复的片段时用 Playwright 录 `tests/regression/` 的回归页。
  3. 配音：短视频默认**不配音**，用配乐 + 大字幕（多数人静音刷）。B 站的长一点的讲解用自己的声音，或者本机跑 **CosyVoice 3**（Apache-2.0，本机 RTX 5070 能跑）。
  4. 剪辑：ffmpeg（本机还没装）。
- **「大量」靠模板和数据，不靠每条重新生成。** 做 3 个模板（功能短片 15–30 秒、总览 45–60 秒、版本更新 30 秒），每条视频只是一份文案数据（钩子、功能片段、中英字幕、结尾），同一份数据渲染出 16:9、9:16、1:1 三种画幅和中英两个语言版本。Fable 5.2 负责写模板、写每条的文案数据、渲染后看截图自查；人负责定选题、看成片、发布。
- **已知的坑**：同一个提示词重跑结果不一样，好的成片要留着改，不要重新生成；模型自查代替不了人看一遍；一条完整的视频大约用 38 万 token、一小时（一位作者在 Fable 5 上的单次数字，不是基准）。
- **国内平台要注意 AI 标识**：《人工智能生成合成内容标识办法》2025-09-01 起施行，B 站和抖音都有声明入口。用了 AI 配音或 AI 生成的镜头就勾上声明。

要用户定的三件事在文末「待确认」。

### 实际采用的做法（2026-11-13，任务 D32）

试做时发现两件事，方案因此改了：

- **浮屿的前端可以整个在浏览器里跑。** 把 Tauri 的调用换成一个假后端（`@tauri-apps/api/mocks`，回归页已经在用），`src/main.tsx` 不改一行就能启动。岛屿启动时调大约 45 个命令，其中十来个要返回正确的结构，其余返回空值即可。这样视频里的岛屿就是真的应用：展开回弹、歌词逐字、消息弹出、审批卡片都是它自己的代码在跑，不用截图，也不用重做动效。
- **无界面 Chrome 能把时钟交给外部控制。** chrome-headless-shell 的 `Emulation.setVirtualTimePolicy` 加 `HeadlessExperimental.beginFrame`：每帧让虚拟时间前进 1/60 秒再截图，`setTimeout`、`Date.now()`、CSS 过渡和动画都跟着走。实测 60 帧的 CSS 过渡每帧位置精确，同样的脚本每次渲染结果一样。这正好解决了上面担心的「CSS 动效逐帧渲染会跳帧」，Remotion 做不到这一点（它要求动画由帧号驱动）。要注意的是 `frameTimeTicks` 要从一个比系统运行时间大的值起算，否则动画时钟不走。

所以合成框架没有用 Remotion 或 HyperFrames：舞台就是一个普通的 Vite 页面，字幕、镜头、开头的窗口用 React 和 CSS 写，岛屿嵌在里面，渲染器是一个约 200 行的脚本。依赖只有 puppeteer-core 和 ffmpeg，没有许可问题。Remotion 的现成组件和工作室界面用不上，预览就是在浏览器里打开舞台页面。录屏工具（OpenScreen）这一条也没用上，以后要拍「岛屿在真实桌面上和别的软件一起工作」时再用。

## 详细

### 1. 现在大家怎么用 Claude 做视频

| 做法 | 说明 | 来源 |
|---|---|---|
| Claude Code + Remotion | 最主流。Remotion 官方出了一组 Agent Skills（13 个，`npx skills add remotion-dev/skills`，6.9k star），覆盖建项目、写动画、字幕、渲染。官网有提示词库，每条写明用的工具和模型，例如一条 37 秒、8 个场景的开源桌面代理发布视频，用的是 Claude Code + Opus 4.6。 | [remotion-dev/skills](https://github.com/remotion-dev/skills)、[提示词库的一条](https://www.remotion.dev/prompts/launch-video-on-x) |
| Claude Code + HyperFrames | HeyGen 开源的「HTML 就是视频」框架，83.4k star，Apache-2.0。用 `data-start`、`data-duration` 这类属性排时间轴，动画用 GSAP、CSS、Lottie、Three.js。自带 Claude Code 插件和 skill。要 Node 22+ 和 FFmpeg。README 没写明命令行在 Windows 上的支持情况（未核实，要试）。 | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) |
| Anthropic 自己的例子 | Fable 5 的发布视频是 Claude Code 剪的：本机 Whisper 给 17 条素材出逐词时间戳，Claude 把剪辑决定写成 `final-edit.json`，ffmpeg 切和拼，11 张设计稿重做成 Remotion 组件，每次完整渲染前先截静帧自查，一晚上重渲染了约 10 次。这些细节来自第三方整理，原始幻灯片是图片，我没能读出文字；提示词和脚手架没有开源。 | [幻灯片](https://thariqs.github.io/cc-video-editing-deck/)、[第三方整理](https://jc-aiwiki.pages.dev/ai-video-content/fable-edits-own-launch-video) |
| Fable 5 全自动出片 | 一位博主的单次实录：模型写稿并核对事实 → ElevenLabs 配音 → HeyGen 数字人 → ffmpeg 拼接 → HyperFrames 做动效并对齐到词 → 多代理截图检查。约 38 万 token、一小时一条。他的教训：重跑结果不同，好的要留着；网页自动化那一步容易坏；人要做最后检查。 | [mejba.me](https://www.mejba.me/blog/claude-fable-5-autonomous-video-production)（2026-06-13） |
| Fable 5.2 | 能找到的只有一期播客的节目说明（2026-11-09）：主持人用一条推文加品牌手册做出了「不像幻灯片」的动画营销视频，还做了游戏预告片；同时说它做网页设计仍然不行。没有找到 Fable 5.2 专门的做视频教程或官方说明。 | [How I AI](https://www.lennysnewsletter.com/p/claude-fable-52-review-fast-creative) |
| Opus 5 的非官方发布短片 | remocn 的作者用 Remotion + 自家组件 + 代理做了 55 秒的短片：12 个节拍，颜色和字体从 claude.com 的样式表读，画面上每句话都能在官方发布文里找到出处。 | [dev.to](https://dev.to/remocn/making-a-launch-video-for-claude-opus-5-2jlo) |

共同点：**把视频当成文本来做**（脚本、时间表、组件都是文件，能比对、能重渲染），以及**每一步都验证**（重新转写确认没剪坏、截静帧看画面）。

### 2. 开源项目

合成框架：

| 项目 | star | 许可 | 对浮屿的意义 |
|---|---|---|---|
| [Remotion](https://github.com/remotion-dev/remotion) | 72.8k | 自有许可：个人和不超过 3 人的公司免费；超过后创作者版每人每月 25 美元（[价格页](https://www.remotion.dev/docs/license/pricing.md)） | 首选。React，和前端同栈 |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | 83.4k | Apache-2.0 | 备选。许可最宽，HTML 写起来模型出错少；声称能让 CSS 动画按帧定位，这一点对录浮屿自己的 CSS 动画有用，要实测 |
| [Revideo](https://github.com/redotvideo/revideo) | 4.2k | MIT | 生态小，不选 |

零件和现成流程：

| 项目 | star | 许可 | 内容 |
|---|---|---|---|
| [remocn](https://www.remocn.dev/docs/guides/launch-video) | 未核实 | MIT | Remotion 的动画、转场、着色器背景组件，按 shadcn 的方式装。有一份 35 秒发布视频的 8 段结构：痛点 → 亮相 → 一句话介绍 → 定位 → 六个功能快切 → 三条价值 → 安装命令 → 标志。有 Claude Code 插件，先出分镜等确认再写代码 |
| [claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) | 2.5k | MIT | 产品演示、9:16 短讲解、版本说明等模板；带 Playwright 录制、配音、配乐的 skill 和命令。可以借它的模板结构 |
| [OpenMontage](https://github.com/calesthio/OpenMontage) | 80.0k | AGPL-3.0 | 把编码代理当导演的整套制作系统，11 条流程（含 Screen Demo、本地化配音），接了各家视频、配音、配乐服务，有预算上限。偏重生成素材和素材库拼片，对「展示真实界面」帮助有限；AGPL，只当工具用、不把代码抄进仓库 |
| [video-use](https://github.com/browser-use/video-use) | 31.0k | MIT | 给真人出镜素材用的：去口头禅和空白、调色、烧字幕、加动画叠层，渲染后在每个剪切点自查，最多重渲染三次。转写要 ElevenLabs 的 key。以后做真人讲解时再用 |

录屏：

| 项目 | star | 许可 | 内容 |
|---|---|---|---|
| [OpenScreen（社区版）](https://github.com/getopenscreen/openscreen) | 7.1k | MIT | Windows 10 1903 以上可用（`winget install --source msstore OpenScreen`）。自动或手动缩放、光标效果、背景、动态模糊、离线字幕，导出 MP4 / GIF。有无界面命令行（`openscreen record`、`openscreen export`）、MCP 服务和 `openscreen-demo` skill，代理能自己录和改缩放。自述「开发中，偶有破坏性变更」 |
| [OpenScreen（原版）](https://github.com/siddharthvaddem/openscreen) | 40.0k | MIT | 已归档不再维护，指向上面的社区版 |

中文配音：

| 项目 | star | 许可 | 内容 |
|---|---|---|---|
| [CosyVoice](https://github.com/FunAudioLLM/CosyVoice) | 24.4k | Apache-2.0 | Fun-CosyVoice 3.0（0.5B）。中英日韩等 9 种语言和 18 种以上中文方言，零样本克隆，能用拼音纠正读音，能用指令控制情绪和语速 |
| [IndexTTS](https://github.com/index-tts/index-tts) | 25.1k | bilibili 自有的模型许可，商用要联系对方 | IndexTTS-2.5（2026-08-10）。情绪控制强。许可不是标准开源许可，宣传用途算不算商用我没法判断，稳妥起见不选 |

文生视频模型（只做氛围镜头时才用）：各家评测互相矛盾，价格从每秒约 0.03 美元到 0.75 美元不等；开放权重的主要是 Wan。有一处来源说 Sora 的应用和 API 已在 2026 年停止服务（只有一个来源，未核实）。这部分没有逐家核对官方价格，用到时再查。

### 3. 浮屿的方案

#### 画面从哪来

| 来源 | 怎么做 | 适合 | 风险 |
|---|---|---|---|
| A. 真组件渲染 | 视频项目里直接引入浮屿 `src/` 的组件和 CSS 变量，喂模拟数据，由合成框架逐帧渲染 | 清晰度最高（可出 4K）、可批量、可换主题和语言 | 浮屿的动效是 CSS 过渡，Remotion 要求动画由帧号驱动，CSS 动画直接渲染会跳帧。要么在视频里用帧号重做这几个动效，要么换 HyperFrames 试它的 CSS 定位。**这是第一步试做要回答的问题** |
| B. 回归页录制 | Playwright 打开 `tests/regression/` 的页面（已有 32 个，覆盖待办、歌词、剪贴板、消息、代理会话、设置、新手引导等），按脚本操作并录像 | 动效是真的，脚本可重复 | 实时录制，帧率和清晰度受限；页面是测试用的布局，要加一个干净的展示外壳 |
| C. 真机录屏 | `pnpm dev:lane:center` 起预览岛屿，OpenScreen 录，自动缩放跟随光标 | 最真实，能拍到岛屿浮在真实桌面上、和 QQ / 音乐 / 终端一起工作 | 桌面上有私人内容，要准备一个干净的桌面和演示数据；每次录的不完全一样 |

建议 C 做「它在真实桌面上的样子」，A 或 B 做功能特写，在合成框架里拼起来。

#### 流水线

1. **选题和文案数据**：每条视频一份数据文件（钩子一句、2–4 个功能片段、中英字幕、结尾号召）。Fable 5.2 从 `docs/features/`、`docs/releases/` 和 README 起草，画面上的每句话都要在文档里有出处。
2. **分镜确认**：先出文字分镜，人确认后再写代码（remocn 插件的做法）。
3. **素材**：按上表录或渲染。
4. **合成**：模板 + 数据渲染出三种画幅。
5. **自查**：渲染静帧，模型看图检查错位、溢出、空白帧、字幕遮挡；检查通过再完整渲染。
6. **人看成片**，发布。好的成片对应的数据和提交留着，改动在它上面做，不重新生成。

把这套流程写成仓库里的一个 skill（类似现有的 `lanes`、`fuyu-release`），以后说「给这个版本做个更新视频」就能按流程走。

#### 三个模板

| 模板 | 时长 | 结构 | 用在 |
|---|---|---|---|
| 功能短片 | 15–30 秒 | 前 2 秒钩子（一个痛点或一个惊喜画面）→ 一个功能的真实操作 → 名字和下载方式 | 抖音、小红书、视频号、B 站竖屏、X |
| 总览 | 45–60 秒 | 痛点 → 岛屿亮相 → 5–6 个功能快切 → 开源、免费 → 下载 | B 站、X 置顶、README、官网首屏 |
| 版本更新 | 约 30 秒 | 版本号 → 3 个新变化 → 更新方式 | 每次发版，从发布说明生成 |

#### 各平台

| 平台 | 画幅 | 语言 | 说明 |
|---|---|---|---|
| X | 16:9 或 1:1 | 英文 | 免费账号单条一般限 140 秒、512 MB（第三方资料，未在官方帮助页核对）。受众偏开发者，优先做 AI 代理状态（岛上看 Claude Code 会话、审批）、插件、开源这几个角度 |
| B 站 | 16:9 为主，另出竖屏 | 中文 | 1–3 分钟带讲解的走查比纯动效更合适；1080P 建议码率按社区说法在 6–12 Mbps（非官方数字） |
| 抖音、小红书、视频号 | 9:16 | 中文 | 15–40 秒，大字幕，默认静音可看 |

第一批选题可以直接按功能列：待办和每日笔记、同步歌词、剪贴板历史和文件中转、快捷翻译、QQ / 微信 / 邮件提醒、AI 代理状态、插件市场、主题和预设、贴边收起。每个功能一条短片，中英各一版，就是二十条左右。

#### 分步

| 步骤 | 内容 | 产出 |
|---|---|---|
| 0. 试做（1–2 天） | 装 ffmpeg；建视频项目；同一份 20 秒脚本用 Remotion 和 HyperFrames 各做一条，试着引入一个真组件；用 OpenScreen 命令行录一段预览岛屿 | 两条样片，定下合成框架和画面来源 |
| 1. 模板和品牌 | 从 `DESIGN.md` 取颜色、字体、圆角做成视频的品牌变量；做三个模板；写 skill | 一条总览视频（替换现在的 `docs/assets/demo.mp4`） |
| 2. 批量 | 第一批功能短片，中英、三种画幅 | 约 20 条 |
| 3. 常态 | 每次发版出一条更新视频；按各平台数据调整选题 | 发布节奏 |

#### 放在哪

视频项目的依赖（Remotion、Chromium）、素材和成片都很大，仓库对 `src/`、`scripts/`、`packages/` 有行数、注释、CI 的规则，视频代码不适合受这些约束。建议另开一个仓库（例如 `fuyu-videos`，本机 `E:\Projects\fuyu-videos`），通过路径别名引用浮屿的 `src/`；成片不进任何仓库，只把最终用到的一两个文件放进 `docs/assets/`。

### 4. 合规和授权

- **AI 标识**：《人工智能生成合成内容标识办法》和配套国标 2025-09-01 起施行，要求显式标识和元数据里的隐式标识，平台要核验，用户不得删除或隐匿标识（[新华网](https://www.news.cn/digital/20250902/d08b592223954340af8c02ac3d7161e1/c.html)）。B 站 2025-08-29 公告上线了标识功能，抖音也有（来自媒体报道，具体入口以创作中心为准）。我的理解：代码渲染的真实界面动画不属于「生成合成内容」，AI 配音和文生视频的镜头属于；拿不准时勾上声明，不会有坏处。
- **配乐**：只用明确可商用的曲库或自己生成的音乐，把来源记在每条视频的数据文件里。
- **别人的商标**：演示 QQ、微信、音乐软件的提醒时会出现对方的图标和界面，属于说明兼容性的正常使用，但不要让画面看起来像对方的官方内容。
- **Remotion 许可**：现在是个人项目，免费；以后变成 4 人以上的公司就要买。

## 待确认

1. 合成框架先按 Remotion 为主、HyperFrames 为备选去试做，可以吗？
2. 视频项目另开仓库 `fuyu-videos`，还是放在本仓库的某个目录？
3. B 站的讲解用你自己的声音、本机 AI 配音，还是先全部不配音？

确认后建任务，从「0. 试做」开始。

## 来源

- Remotion：[仓库](https://github.com/remotion-dev/remotion)、[skills](https://github.com/remotion-dev/skills)、[价格](https://www.remotion.dev/docs/license/pricing.md)、[提示词库](https://www.remotion.dev/prompts/launch-video-on-x)
- HyperFrames：[仓库](https://github.com/heygen-com/hyperframes)
- remocn：[发布视频指南](https://www.remocn.dev/docs/guides/launch-video)、[Opus 5 短片的制作说明](https://dev.to/remocn/making-a-launch-video-for-claude-opus-5-2jlo)
- Fable 5 发布视频：[幻灯片](https://thariqs.github.io/cc-video-editing-deck/)、[第三方整理](https://jc-aiwiki.pages.dev/ai-video-content/fable-edits-own-launch-video)、[explainx 的简讯](https://explainx.ai/blog/fable-5-edited-own-launch-video-thariq-claude-code-2026)
- Fable 5 全自动出片：[mejba.me](https://www.mejba.me/blog/claude-fable-5-autonomous-video-production)
- Fable 5.2：[How I AI 节目说明](https://www.lennysnewsletter.com/p/claude-fable-52-review-fast-creative)
- 流程和工具：[OpenMontage](https://github.com/calesthio/OpenMontage)、[video-use](https://github.com/browser-use/video-use)、[claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit)、[Revideo](https://github.com/redotvideo/revideo)
- 录屏：[OpenScreen 社区版](https://github.com/getopenscreen/openscreen)、[OpenScreen 原版](https://github.com/siddharthvaddem/openscreen)
- 配音：[CosyVoice](https://github.com/FunAudioLLM/CosyVoice)、[IndexTTS](https://github.com/index-tts/index-tts)
- AI 标识：[新华网 2025-09-02](https://www.news.cn/digital/20250902/d08b592223954340af8c02ac3d7161e1/c.html)
- X 视频规格（第三方）：[postfa.st](https://postfa.st/sizes/x/video)
