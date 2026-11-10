# 用 AI 做软件官网：怎么做出好看的页面，以及参考网站

> 日期：2026-11-10。问题：用 AI 做软件官网、做出炫酷的页面，该靠 skill、UI 库还是别的东西；列一些优秀的软件官网做参考。范围：WebSearch 搜「Claude Code frontend-design skill」「animated UI component libraries Aceternity Magic UI React Bits shadcn」「GSAP free ScrollTrigger」「landing page inspiration gallery」「best SaaS / tech website design examples」，打开了 Anthropic 的 cookbook 和 spell.sh 的官网清单。相关任务：无（用户的问答，还没建官网任务）。

## 结论

- **决定好不好看的主要是设计方向（brief），不是库。** AI 不加约束时会收敛到同一套页面：Inter / Roboto 字体、白底紫色渐变、一排圆角卡片加柔和阴影。Anthropic 官方的建议是把字体、配色、动效、背景四件事分别写清楚，给出具体的灵感来源（IDE 配色、某种文化风格），并明确列出不许用的默认选择（[cookbook](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)）。有人实测：只装 frontend-design skill，排版会好一些，但还是一眼像 AI 做的；配上写明「不要什么」的 brief 才明显变好（[wmedia.es](https://wmedia.es/en/tips/claude-code-frontend-design-skill)、[dev.to](https://dev.to/dedupedai/stop-claude-code-from-building-the-same-generic-landing-page-2him)）。
- **三层一起用，各管一件事：**
  1. **skill / 提示词管方向**：Anthropic 的 frontend-design skill，加上自己写的 brief 和禁用清单。brief 可以直接写进项目的 `DESIGN.md` / `CLAUDE.md`，每次生成都带上。
  2. **UI 库管零件**：shadcn/ui 做底，Magic UI、Aceternity UI、React Bits 提供动画组件（光效、文字逐字出现、跑马灯、3D 卡片等）。它们都按 shadcn 的 registry 格式发布，可以混在同一个项目里，代码复制进项目后能随便改，AI 也好改。
  3. **动效库管「炫」**：React 里的进场、悬停用 Motion；跟着滚动讲故事的长页面用 GSAP 的 ScrollTrigger。GSAP 被 Webflow 收购后，从 3.13（2025 年春）起所有插件免费，商用也可以（[GSAP 3.13](https://gsap.com/blog/3-13/)、[CSS-Tricks](https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/)）。
- **最能打动人的是真实产品画面**，不是装饰。参考网站里做得好的几家（Linear、Raycast、Figma、Resend）都把真的产品界面、真的代码、能直接操作的演示放在首屏（[spell.sh](https://spell.sh/blog/websites-great-ui-inspiration)）。对浮屿来说就是：岛屿收起、展开、切页面的录屏或可交互的模拟，比任何渐变背景都有用（仓库里已有 `docs/assets/` 的演示视频和 `tests/regression/` 的回归页可以借来做）。
- **页面要克制**：一个让人记住的亮点（比如首屏岛屿从屏幕顶端展开的动画），其余部分安静。每一节都在抢眼球，反而显得廉价（[dev.to](https://dev.to/dedupedai/stop-claude-code-from-building-the-same-generic-landing-page-2him)）。

### 给浮屿官网的建议做法

1. 先在 [Land-book](https://land-book.com)、[Lapa Ninja](https://www.lapa.ninja)、[SaaS Landing Page](https://saaslandingpage.com) 和下面的参考网站里挑 2–3 个喜欢的，截图放本机（例如 `E:\Projects\design-refs\website\`）。
2. 写一页 brief：一句话定位、目标用户、字体（中文和英文各一款）、主色和强调色（可以沿用岛屿的深色 + 强调色）、动效风格、**禁用清单**（Inter、紫色渐变、千篇一律的三列卡片、每个标题上方的全大写小标签）。
3. 技术栈：Vite + React（和岛屿同一套）或 Astro 出静态页；Tailwind + shadcn/ui；按需从 Magic UI / React Bits 拿组件；Motion 做进场，GSAP ScrollTrigger 做滚动叙事；部署 GitHub Pages / Vercel / Cloudflare Pages。
4. 让 AI 按 brief 先出首屏，满意了再往下做；每节都对照截图和禁用清单检查。

## 详细

### skill 和提示词

| 做法 | 说明 | 来源 |
|---|---|---|
| frontend-design skill（Anthropic） | 一个 SKILL.md，让 Claude 写界面前先定一个明确的审美方向。安装命令各处写法不一（`/plugin install frontend-design@claude-code-plugins`、`claude install anthropics/skills/frontend-design`），用前查当时的官方说明 | [agenticskills.io](https://agenticskills.io/skills/frontend-design)、[aidesigner.ai](https://www.aidesigner.ai/blog/claude-code-frontend-design) |
| Anthropic cookbook 的审美提示词 | 字体：避开 Inter / Roboto / Arial / Open Sans / Lato，粗细对比拉大（100–200 对 800–900），字号跳 3 倍；配色：用 CSS 变量，一个主色加锐利的强调色，不平均分配；动效：一次编排好的页面进场（错开的 `animation-delay`），胜过到处撒的小动画；背景：叠加渐变、几何图案，不用纯色。还给了字体搭配例子（代码风 JetBrains Mono / Space Grotesk，编辑风 Playfair Display / Fraunces，创业风 Clash Display / Satoshi，技术风 IBM Plex） | [cookbook](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics) |
| avoid-ai-design（第三方） | 扫描生成的前端、找出「AI 味」并改写，带一个零依赖的扫描脚本。未核实效果 | [GitHub](https://github.com/funboy322/avoid-ai-design) |
| Landing Page Designer（第三方 skill） | 未核实 | [mcpmarket](https://mcpmarket.com/tools/skills/landing-page-designer) |

### UI 库

信息来自搜索摘要，几家对比文章有的是库的作者自己写的，组件数量、star 数说法不一，不列具体数字。

| 库 | 定位 | 收费 | 安装 | 来源 |
|---|---|---|---|---|
| shadcn/ui | 底座：按钮、表单、对话框等基础组件，代码复制进项目 | 免费 | shadcn CLI | [pkgpulse](https://www.pkgpulse.com/guides/aceternity-ui-vs-magic-ui-vs-shadcn-animated-react-2026) |
| Magic UI | 精致、偏统一风格的动画组件，基于 Tailwind + Motion | 免费（另有 Pro） | shadcn CLI | [designrevision](https://designrevision.com/alternatives/magic-ui)、[pkgpulse](https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026) |
| Aceternity UI | 深色、戏剧化的官网区块（光束、聚光灯、3D 卡片），基于 Tailwind + Motion | 组件免费，区块和模板收费 | shadcn CLI | [shadcn.io](https://www.shadcn.io/awesome/item/aceternity-ui)、[componentblocks](https://www.componentblocks.com/blog/magic-ui-pro-vs-aceternity-pro-vs-motion-blocks) |
| React Bits | 文字动画、背景效果多，可调参数多，带减弱动效的开关 | 免费 | 复制粘贴或自己的 CLI | [pkgpulse](https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026) |
| Motion（原 Framer Motion） | React 动画库，上面几家都依赖它 | 免费 | npm | [cookbook](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics) |
| GSAP + ScrollTrigger | 滚动驱动的复杂动画、文字拆分（SplitText）、SVG 变形，不限框架 | 2025 年起全部免费 | npm | [GSAP 3.13](https://gsap.com/blog/3-13/) |

注意：复制来的组件常常引用 `@/lib/utils` 里的 `cn()`，不同库的安装方式也不完全一样，拿来先看一遍代码（[pkgpulse](https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026)）。

### 优秀的软件官网

| 网站 | 值得学的地方 |
|---|---|
| [Linear](https://linear.app) | 克制的灰阶，只在表示状态时用颜色，信息很密也好读；「Linear 风格」（深色、细边框、微光渐变）被大量模仿 |
| [Raycast](https://www.raycast.com) | 悬停反馈几乎没有延迟，和产品「快」的感觉一致；扩展商店用卡片网格。和浮屿一样是桌面效率工具，最值得参考 |
| [Arc](https://arc.net) | 不对称布局、旋转的截图、超大字号，打破网格但读起来顺 |
| [Vercel](https://vercel.com) | 深色主题、随滚动淡入、渐变点缀，用示意图解释产品 |
| [Stripe](https://stripe.com) | 层叠的渐变背景、会动的代码示例 |
| [Resend](https://resend.com) | 深色、专注，首屏直接放 API 代码，不放大图 |
| [Figma](https://www.figma.com) | 真实产品截图和嵌入，不注册就能试 |
| [Notion](https://www.notion.so) | 从首页到各场景页层层展开功能 |
| [Lemon Squeezy](https://www.lemonsqueezy.com) | 柠檬主题、温暖圆润，和同类支付网站拉开差别 |

以上描述来自 [spell.sh 的清单](https://spell.sh/blog/websites-great-ui-inspiration)（2026-11-10 查询）；清单作者自己卖 UI 组件，作为参考即可。Warp（[warp.dev](https://www.warp.dev)）、Cursor（[cursor.com](https://cursor.com)）也常被拿来当开发工具官网的例子，但这次没找到可靠的设计分析，未核实。

### 找灵感的图库

| 图库 | 特点 | 来源 |
|---|---|---|
| [Land-book](https://land-book.com) | 最常用的综合网页图库，适合起步 | [uideck](https://uideck.com/blog/landing-page-inspiration) |
| [Lapa Ninja](https://www.lapa.ninja) | 落地页数量多（几千个，各处说法不一） | [adhamdannaway](https://www.adhamdannaway.com/blog/web-design/landing-page-design-inspiration) |
| [SaaS Landing Page](https://saaslandingpage.com) | 专收 SaaS 和创业公司的落地页 | [saaslandingpage](https://saaslandingpage.com/articles/10-inspiration-sites-every-landing-page-lover-should-bookmark/) |
| [Landingfolio](https://www.landingfolio.com) | 按行业、页面类型筛选 | [landingfolio](https://www.landingfolio.com/) |
| [One Page Love](https://onepagelove.com) | 2008 年起收集单页网站 | [pagesthatprint](https://www.pagesthatprint.com/blog/best-landing-page-inspiration-sites) |
| [A1 Gallery](https://www.a1.gallery/type/landing) | 落地页分类图库 | [a1.gallery](https://www.a1.gallery/type/landing) |
| Godly（godly.website） | 以动效炫酷著称，这次搜索结果里没出现，未核实 | — |

## 来源

- [Prompting for frontend aesthetics（Anthropic cookbook）](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)
- [Frontend Design Skill: why your Claude Code UIs still look AI-generated](https://wmedia.es/en/tips/claude-code-frontend-design-skill)
- [Stop Claude Code from building the same generic landing page](https://dev.to/dedupedai/stop-claude-code-from-building-the-same-generic-landing-page-2him)
- [Frontend Design — AI Agent Skill by Anthropic](https://agenticskills.io/skills/frontend-design)
- [How to Design Beautiful UIs With Claude Code (2026)](https://www.aidesigner.ai/blog/claude-code-frontend-design)
- [funboy322/avoid-ai-design](https://github.com/funboy322/avoid-ai-design)
- [react-bits vs Aceternity vs Magic UI 2026](https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026)
- [Aceternity UI vs Magic UI vs shadcn/ui 2026](https://www.pkgpulse.com/guides/aceternity-ui-vs-magic-ui-vs-shadcn-animated-react-2026)
- [Magic UI Alternatives](https://designrevision.com/alternatives/magic-ui)
- [Aceternity UI on shadcn.io](https://www.shadcn.io/awesome/item/aceternity-ui)
- [Magic UI Pro vs Aceternity Pro vs shadcn Motion Blocks](https://www.componentblocks.com/blog/magic-ui-pro-vs-aceternity-pro-vs-motion-blocks)
- [GSAP 3.13 release](https://gsap.com/blog/3-13/)
- [GSAP is Now Completely Free（CSS-Tricks）](https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/)
- [10 Websites with Great UI to Inspire You in 2026（spell.sh）](https://spell.sh/blog/websites-great-ui-inspiration)
- [10+ Best Websites For Landing Page Design Inspiration（uideck）](https://uideck.com/blog/landing-page-inspiration)
- [Best landing page design inspiration sites in 2026](https://www.adhamdannaway.com/blog/web-design/landing-page-design-inspiration)
- [15 Web Design Inspiration Sites to Bookmark in 2026](https://saaslandingpage.com/articles/10-inspiration-sites-every-landing-page-lover-should-bookmark/)
- [The Best Landing Page Inspiration Sites in 2026](https://www.pagesthatprint.com/blog/best-landing-page-inspiration-sites)
