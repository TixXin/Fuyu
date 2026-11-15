# 项目 skill：哪些流程该沉淀，一致性 skill 怎么写、怎么保证被加载

> 日期：2026-11-15。问题：本项目的 AI 编程会话里，哪些重复或必要的流程该做成 Agent Skill；该有哪些「一致性 skill」，让不同会话、不同开发者做出同样水准的结果（用户举的例子：怎样设计好网页和界面、怎样设计好新手引导）；这类 skill 怎么写、怎么保证被加载、怎么测试和治理；对本仓库的建议是什么。范围：本机会话记录统计（这台 Mac 上 98 份 Claude Code 会话，UTC 2026-11-13 16:06 至 2026-11-15 15:08）和 git 历史；联网查了 Claude Code、Anthropic 平台、agentskills.io、Codex、opencode 等的官方文档，arXiv 上 SkillsBench、Evaluating AGENTS.md 等论文，公开的设计类和引导类 skill，59 个知名仓库里签入的 skill，NN/g、Apple、Microsoft、Material、W3C 的引导和无障碍指南。网页都在 2026-11-15 查阅，文中的额度、上限、star 数和安装数都是这一天的值。相关任务：无（用户的问答；候选做不做、先做哪几个等用户定）

## 结论

两天的会话里重复最多的是「做一个任务」这条链和主会话手抄规则。按公开证据分流后，最该先做的五项里只有一项是 skill，其余是一行规则、一个钩子和两个脚本。一致性 skill 建议本仓库做两个（应用内界面、引导和「第一次」提示），官网的放官网仓库；公开数据说明这类 skill 起作用靠的是必定被加载和配上确定性检查，只把文字写好不够。下面都是提案，还没有做。本仓库的数字出自本机会话记录统计（2026-11-15）和 git 历史（2026-11-15），只覆盖这台 Mac 上的 Claude Code 会话，Windows 那台机器和别的 harness 的会话没有统计。

### 1. 两天的会话里看到什么

- 98 份会话（UTC 2026-11-13 16:06 到 11-15 15:08，约 47 小时）里，19 个派出过子会话，共派出 92 个；48 个有用户亲手输入，共 404 条。大部分会话是主会话写简报派出来的子会话。
- 「认领 → 在 issue 下回复 → 改 → 验证 → 标完成 → land → 回复并关 issue」这条链一半以上的会话在走：认领 55 个会话，标完成 55 个，在 issue 下回复 68 个，`pnpm mq:land` 50 个，关 issue 14 个（一部分由主 agent 统一关；用户两天里三次追问过 issue 关没关）。规则散在 [AGENTS.md](../../AGENTS.md)、[docs/tasks/README.md](../tasks/README.md)、[workflow.md](../architecture/workflow.md) 三处，没有一处是按顺序排好的清单。
- 主会话靠简报重抄规则：92 份简报多数带一段约束，内容是 AGENTS.md 里已有的规则；常见的 14 条里单条的覆盖率在 43%–75% 之间，11-15 才加的 `pnpm heavy` 排队只有 3 份提到。
- 子目录的规则文件很多相关会话没读到：提交过 `src/` 下文件的 33 个会话里 14 个从没读过 [src/AGENTS.md](../../src/AGENTS.md)，提交过 `src-tauri/` 下文件的 35 个会话里 23 个从没读过 [src-tauri/AGENTS.md](../../src-tauri/AGENTS.md)（子代理读的、只读了一部分的都算读过）。98 份记录里没有一次自动加载，读到的都是会话自己去读的。
- 14 个会话、48 次各自现写 git 底层命令，只为提交同一个文件里自己的那几处，写法每个会话都不太一样。
- 用户反复说的话：「用中文」26 次（22 个会话），问进度 24 次（10 个），先要看法再说「可以」20 次（12 个），重新设计、排版、UI 15 次（9 个），调研 13 次（8 个）。
- 现有四个项目 skill 两天里的加载次数是 19、10、2、0，加载最多的 `fuyu-agent-harness`（18 个会话）是唯一配了门禁钩子的。AGENTS.md 从 2026-07-07 的 5.2 KB 涨到 11-15 的 29.5 KB，改过 116 次（统计时 197 行；加上「Skill 编写规范」一节后是 201 行、29,891 字节）。

### 2. 一条指引该放哪

先问能不能用程序把关，能就停在第一级；不能的，按适用范围落到后面某一级。确定性手段排在文字之前，这一点 PostHog（[editing-agents-md](https://github.com/PostHog/posthog/blob/HEAD/.agents/skills/editing-agents-md/SKILL.md)）、Every（[form.md](https://github.com/EveryInc/compound-engineering-plugin/blob/HEAD/skills/ce-compound/references/form.md)）和 Claude Code 文档（[Extend Claude Code](https://code.claude.com/docs/en/features-overview)）一致。

- **检查、脚本或钩子**：能用程序判断对错的，或者必须每次成立的。Claude Code 文档写明，被跳过的若是每次都必须成立的规则，就移到钩子里（[Skills](https://code.claude.com/docs/en/skills)）；确定性的操作写成脚本比现场生成的代码可靠、每次一致（[Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)）；几次运行里代理各自重写相似的辅助脚本，是该打包成脚本的信号（[skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)）。本仓库对应：只提交自己的改动、issue 关没关、进度汇总。
- **根规则文件**：每个会话都要遵守、一句话说得清、模型自己推不出来的。好处是不需要触发：Vercel 的评测里放进 AGENTS.md 的文档索引通过率 100%，默认的 skill 是 53%（[Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)）。代价是每一行由每个会话付费，PostHog 把往根文件里加规则当最后手段（[editing-agents-md](https://github.com/PostHog/posthog/blob/HEAD/.agents/skills/editing-agents-md/SKILL.md)）；ETH 的评测里这类文件总体不提高任务成功率、推理成本增加 20% 以上，其中的指令会被遵守，仓库概览没有帮助，作者建议用来写非标准做法（[arXiv 2602.11988](https://arxiv.org/abs/2602.11988)）。本仓库对应：和用户说话用中文。
- **目录级规则文件**（[src/AGENTS.md](../../src/AGENTS.md)、[src-tauri/AGENTS.md](../../src-tauri/AGENTS.md)）：只和这个目录有关的约定。Claude Code 的文档写的是用 Read 工具打开该目录里的文件时才加载这份文件（[Memory](https://code.claude.com/docs/en/memory)）；Codex 只在启动时拼一次，见第 6 点。本仓库实测这一级不可靠：两天里没有一次自动加载，靠的是根文件里「修改 `src/` 时还须遵守 src/AGENTS.md」这句话让会话自己去读，结果见第 1 点。所以「改这里之前先加载哪个 skill」的指针不能只放在这一级，要放根文件，或者交给门禁钩子。
- **skill**：只有一部分会话需要、步骤多、带项目特有的命令和坑、模型不看就做不对的流程。同一套多步流程第三次粘进对话就该做成 skill（[Extend Claude Code](https://code.claude.com/docs/en/features-overview)）；人工整理的 skill 把平均通过率从 33.9% 提到 50.5%，至多三个模块的聚焦型好于更大的打包（[SkillsBench](https://arxiv.org/abs/2602.12670)）；98 个公开的通用软件工程 skill 里 92 个没有显著效果（[SWE-Skills-Bench](https://arxiv.org/abs/2603.15401)），所以值得写的是模型无从知道的项目流程；100 个开源仓库里 35% 把本该进 skill 的任务专用指令留在了常驻文件里（[arXiv 2606.15828](https://arxiv.org/abs/2606.15828)）。
- **文档**（`docs/`）：人不带代理也会去查的背景、数值、现状和已定的决定。skill 只链接过去，不复制（[PostHog 手册](https://posthog.com/handbook/engineering/ai/writing-skills)）。
- 不保存：一次性任务、环境故障、已经解决的瞬时错误、没找到办法的失败尝试（[Hermes](https://github.com/NousResearch/hermes-agent/blob/HEAD/agent/background_review.py)）。另外，只记在一台机器的 Claude 记忆里的项目规则要搬进仓库：本机 5 条记忆里有 4 条其实是项目规则，另一台机器、协作者和别的 harness 都读不到。

### 3. 候选

| 候选 | 形式 | 依据 | 建议的先后 |
|---|---|---|---|
| 和用户说话用中文：回复、计划、总结、提问、按钮、会话标题；提交标题和 PR 标题照旧用英文 | [AGENTS.md](../../AGENTS.md) 一行 | 「用中文」26 次、22 个会话；现在只记在这台 Mac 的 Claude 记忆里，92 份简报里 52 份带了这条。同一条约定错了两次就写进规则文件（[Claude Code](https://code.claude.com/docs/en/features-overview)） | 1（第一批） |
| 改 `src/`、`src-tauri/` 之前必须读过对应的规则文件 | 钩子：把 [agent-harness-gate.mjs](../../scripts/agent-harness-gate.mjs) 改成按表配置（路径 → 要先读的规则文件或要先加载的 skill） | 提交过 `src/` 的 33 个会话里 14 个没读过 `src/AGENTS.md`，提交过 `src-tauri/` 的 35 个里 23 个没读过；现有门禁配的那个 skill 是四个里加载最多的。必须每次成立的事交给钩子（[Claude Code](https://code.claude.com/docs/en/skills)） | 2（第一批） |
| `fuyu-task`：做一个任务，从认领到关 issue。按顺序的清单：看任务 → 认领并写 scope → 在 issue 下回复 → 查冲突 → 改 → 按改动范围验证 → `tasks done` 进同一个提交 → land 或交给主 agent → 合入后回复并关 issue → 实测清单 | skill；AGENTS.md 留一行指针，主会话的简报点名加载 | 认领 55 个会话、回复 issue 68 个、关 issue 14 个；简报约束覆盖率 43%–75%。常驻文件里长成流程的段落移进 skill，原处只留要点（[Claude Code](https://code.claude.com/docs/en/costs)）；规则文件放「遇到 X 用某 skill」，流程本体放 skill（[OpenAI](https://developers.openai.com/blog/skills-agents-sdk)） | 3（第一批） |
| 只提交同一文件里自己的改动 | 脚本（`pnpm mq:` 下的一个命令） | 14 个会话、48 次各写各的 git 底层命令。确定性的重复操作交给脚本（[Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)、[OpenAI](https://developers.openai.com/blog/skills-agents-sdk)） | 4（第一批） |
| 进度汇总：进行中的任务和负责的会话、没推的提交、没提交的文件属于谁、开着的 PR、标了完成但没关的 issue | 脚本为主；怎么呈现写进总会话用的 skill | 问进度 24 次、10 个会话；回复 issue 的会话 68 个，关 issue 的 14 个。必须每次成立的事不靠文字（[Claude Code](https://code.claude.com/docs/en/skills)） | 5（第一批） |
| `fuyu-ui-design`：界面改动从方案到落地 | 一致性 skill：只分流和排流程，区域约定留在 `docs/design/`；根 [AGENTS.md](../../AGENTS.md) 加一行指针，或进门禁表 | 界面设计类 20 个会话，15 个会话提交了 `docs/design/`，预览页的套路已经成型（仓库里 9 个这类 HTML）。按调研的判断，公开设计 skill 里最接近「让改动符合既有体系」的结构是注入项目上下文加规则文件加 evals（[shadcn](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/SKILL.md)） | 6（第二批） |
| `fuyu-onboarding`：引导和「第一次」提示 | 一致性 skill；描述要覆盖「新增用户可见功能」；门禁只管引导和首次提示的目录 | 用户点名；频率低、规则多，每次容易重新想一遍。安装量大的引导 skill 面向网页 SaaS，不含桌面权限、双语和引导的维护（[coreyhaines31](https://github.com/coreyhaines31/marketingskills/blob/main/skills/onboarding/SKILL.md)） | 7（第二批） |
| `fuyu-research`：调研。README 的规则，加上先查同主题的旧文档、数字带查询日期、截图放本机、和任务挂钩、写完用 `doc-preview` 打开给用户 | skill，先测基线 | 20 个调研会话，用户 13 次提出；规则已在 [docs/research/README.md](README.md)。先让代理直接做，做得成就不需要 skill（[PostHog 手册](https://posthog.com/handbook/engineering/ai/writing-skills)） | 8（第三批） |
| `fuyu-mac-port`：把功能适配到 Mac。平台层放哪、权限说明和授权文件、快捷键文案、刘海和菜单栏和全屏空间、`platforms.md` 和适配计划、交叉检查 Windows 构建、真机实测清单 | skill，先测基线；适配收尾后退役 | Mac 适配 20 个会话，G 组任务 26 个。上游升级这类 playbook 是真实仓库里常见的一类（[Electron](https://github.com/electron/electron/tree/HEAD/.claude/skills)）；不带 skill 也能通过评估时可以退役（[Anthropic](https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills)） | 9（第三批） |
| `fuyu-investigate`：排查。开发版和正式版怎么分辨、数据和日志在哪、实验台、先讲原因和看法再改、补回归、什么写进 `docs/investigations/` | skill，先测基线；数据和日志在哪留在文档里 | 排查类 18 个会话。Runbook 是 Anthropic 内部九类 skill 之一（[Claude blog](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills)）；系统怎么工作属于文档，skill 只链过去（[PostHog 手册](https://posthog.com/handbook/engineering/ai/writing-skills)） | 10（第三批） |
| 总会话：分诊 issue（`pnpm issue --untracked` → 核实、回复、建任务 → 归组 → 开哪个主 agent）、交接提示词（不超过 5 行，指向任务文件的「交接」） | 触发条件和 [fuyu-lead](../../.claude/skills/fuyu-lead/SKILL.md) 相同的并进去，不同的（分诊）单独一个 | 两天里 4 个分诊会话，交接提示词至少 3 次。新的触发条件才配新 skill，更多细节进已有的（[PostHog](https://github.com/PostHog/posthog/blob/HEAD/.agents/skills/writing-skills/SKILL.md)） | 11 |
| 官网 / 网页设计 | 官网仓库（fuyu-site）里的 skill | 官网不在本仓库。落地页要辨识度，应用内界面要一致和熟悉，两类界面分开处理（[impeccable](https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.src.md)） | 12 |
| `doc-preview` 搬进仓库 | 现有用户级 skill 挪进 `.claude/skills/` | 现在只在这台 Mac 上，主会话的简报里已经在提它。云端会话不读用户级目录，签入仓库的才可用（[Claude Code](https://code.claude.com/docs/en/skills)） | 13（随时可做） |

- 顺序沿用统筹会话的初步清单，没有删项；第 2 项是核对子目录规则文件的加载情况后加的，其余改的都是形式。第一批直接对应重复最多的动作；第二批是一致性 skill，随 skill 带 eval；第三批先各拿两三个真实任务做不带 skill 的基线，现有文档已经够用就不建（[Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)）。
- `fuyu-task` 有一条反方证据：多数会话都要的知识放常驻上下文比放 skill 可靠（[Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)）。仍建议做成 skill：这些规则已经在 AGENTS.md 里，缺的是按顺序排好；子会话由主会话派出，简报里点名加载属于显式调用。链条末尾（合入后回复并关 issue）最容易丢，因为会话越长遵守率越低（[arXiv 2605.10039](https://arxiv.org/abs/2605.10039)），压缩后被调用的 skill 只保留开头（[Claude Code](https://code.claude.com/docs/en/skills)），所以这一步交给第 5 项的脚本兜底。
- 本机记忆里另外两条项目规则随对应的候选进仓库：预览页用系统浏览器打开写进 `fuyu-ui-design`，总会话自己攒批 land 写进总会话那一项。
- 另外四处形式上的出入。`fuyu-ui-design` 的指针放根文件，不放 `src/AGENTS.md`（那一份有四成相关会话没读）；要不要再进门禁表、拦哪些路径由用户定，因为它的范围是整个 `src/`，而强制项要少（[Best practices](https://code.claude.com/docs/en/best-practices)）。`fuyu-onboarding` 的路径门禁只拦得住已经在改引导的会话，最需要它的是加新功能、没想到引导的会话，所以触发条件要写进描述，并在 `fuyu-task` 或 `fuyu-ui-design` 的收尾步骤里留一行。官网的 skill 放官网仓库，不放用户级目录（只在一台机器上）。`doc-preview` 搬进来时删掉本机那份：Claude Code 里个人目录的同名 skill 优先于项目的（[Claude Code](https://code.claude.com/docs/en/skills)），不删就还是跑旧的。

### 4. 怎么让一致性 skill 真的被加载

- 只靠 description 不够。公开实测里不加干预的调用率在 0%–55% 之间，Vercel 测到 56% 的用例里 skill 根本没被调用（[Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)、[Codeminer42](https://blog.codeminer42.com/stop-putting-best-practices-in-skills/)、[Scott Spence](https://scottspence.com/posts/measuring-claude-code-skill-activation-with-sandboxed-evals)）。各次测量的模型、日期、题目都不同，只能看方向，见「触发率实测」。
- 规则文件里加一行指针有用，但不保证。Vercel 在 AGENTS.md 里明确要求用 skill 后从 53% 到 79%，措辞有影响，「先看项目，再查 skill」好于「必须先调用 skill」（[Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)）；Codeminer42 的多轮测试里 CLAUDE.md 一行提示是 5/15，普通 skill 是 1/15（[Codeminer42](https://blog.codeminer42.com/stop-putting-best-practices-in-skills/)）。
- 钩子最稳。每条提示都注入「先逐个评估 skill」的钩子测到 84%（Haiku 4.5）和 100%（Sonnet 4.5）（[Scott Spence 2025](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably)、[2026](https://scottspence.com/posts/measuring-claude-code-skill-activation-with-sandboxed-evals)）。Claude Code 文档的立场是必须每次发生的事交给钩子，同时提醒强制项要少，每个钩子都会偶尔误触发并且要人维护（[Best practices](https://code.claude.com/docs/en/best-practices)）。
- 仓库已有确定性更强的一种：[agent-harness-gate.mjs](../../scripts/agent-harness-gate.mjs) 登记为 PreToolUse 钩子，会话第一次改二十几个接入点文件而还没加载 `fuyu-agent-harness` 时，拦下这次操作一次并提示加载。它是两天里加载最多的 skill（19 次、18 个会话）；其中多少次是被拦下后才加载的没有统计。
- 建议的组合：描述写触发条件和中文触发词，关键用例放最前；指针放根 AGENTS.md，不放子目录的规则文件（那一级很多会话没读到，见第 1 点）；主会话的简报点名（92 份里现在 28 份点了 skill）；把现有门禁改成按表配置，范围清楚的一小组文件直接进表（引导、首次提示），整个 `src/` 的界面改动要不要拦由用户定；最重要的指令放 SKILL.md 开头。

### 5. 「Skill 编写规范」和证据的对照

AGENTS.md 末尾新加的规则是：「自生成的 skill 只保留关键步骤、触发条件、核心命令和陷阱。不记录详细工作进度、一次性修复记录或面面俱到的细节。skill 是可复用的流程模板，不是工作日志。」证据支持它，没有找到相反的研究或权威指引。Hermes 的规则几乎逐条对应（流程在前，坑写成带原因的通用规则，不放 PR 编号、日期和事件经过，不重复 AGENTS.md：[background_review.py](https://github.com/NousResearch/hermes-agent/blob/HEAD/agent/background_review.py)、[skill_manager_tool.py](https://github.com/NousResearch/hermes-agent/blob/HEAD/tools/skill_manager_tool.py)）；superpowers 和 VS Code 的元 skill 同样排除对某次解题经过的叙述（[writing-skills](https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md)、[feedback-learning](https://github.com/microsoft/vscode/blob/HEAD/.github/skills/feedback-learning/SKILL.md)）；SkillsBench 里穷尽式的一档接近零收益（v4 +0.7、v1 −2.9 个百分点），紧凑的一档是 +19.0 和 +17.1（[v4](https://arxiv.org/html/2602.12670v4)、[v1](https://arxiv.org/html/2602.12670v1)）。局限：没有针对「事后从会话提炼、精简、人审」这类 skill 的对照实验，支持来自一手规则的一致和相邻的实验。下面是证据提示的补充，采不采纳由用户定。

- 收紧三处措辞。「关键步骤」限定为模型自己做不对或顺序不能错的步骤，其余给目标和约束（[Claude blog](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills)）。「面面俱到的细节」限定为不写进 SKILL.md 正文，确实需要的放 `references/` 或脚本按需加载（[Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)）。「核心命令」写成能直接执行的确切命令和参数：最短不是最优，两版 SkillsBench 最好的都是中间档，自生成 skill 的失败之一是空泛（[v1](https://arxiv.org/html/2602.12670v1)）。
- 补四条。完成标准或验证步骤（[Hermes](https://hermes-agent.nousresearch.com/docs/developer-guide/creating-skills)、[PostHog 手册](https://posthog.com/handbook/engineering/ai/writing-skills)）；每个坑带半句原因，不写发现经过（[skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)）；新建前先查已有 skill 并优先修补，不重复 AGENTS.md 已有的内容（[Hermes](https://github.com/NousResearch/hermes-agent/blob/HEAD/agent/background_review.py)），新的触发条件才新建（[PostHog](https://github.com/PostHog/posthog/blob/HEAD/.agents/skills/writing-skills/SKILL.md)）；人审，并由一个全新会话带着 skill 试做一次再签入（[Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)）。没人审、没试跑的自生成 skill 在 SkillsBench 的三个配置上降了 8.1 到 11.5 个百分点（[v4](https://arxiv.org/html/2602.12670v4)）。
- 写明被排除的内容去哪：进展和交接进任务文件，修复经过进提交说明和 PR。这条规则只回答 skill 里写什么；该不该做成 skill，先按第 2 点分流。

### 6. 跨 agent 的事实

- skill 目录不通用。Claude Code 只从 `.claude/skills` 读项目 skill（另有个人、插件、嵌套和托管位置），它的 skills 页面不提 `.agents/skills`（[Claude Code](https://code.claude.com/docs/en/skills)）；Codex 扫 `.agents/skills`（从工作目录到仓库根）、`$HOME/.agents/skills` 和 `/etc/codex/skills`，页面不提 `.claude/skills`，会跟随符号链接的 skill 文件夹（[Codex](https://learn.chatgpt.com/docs/build-skills)）；opencode 两个都读（[opencode](https://opencode.ai/docs/skills/)）。仓库只有 `.claude/skills`，按文档 Codex 会话看不到现有四个 skill（没有在 Codex 里试）。
- 搭桥要考虑 Windows。Next.js 把 `.claude/skills` 做成指向 `.agents/skills` 的符号链接（[next.js](https://github.com/vercel/next.js/tree/HEAD/.claude)）；Claude Code 文档在讲规则文件时提醒，有人在 Windows 上工作就不要用符号链接（[Memory](https://code.claude.com/docs/en/memory)）。本仓库有一台 Windows 机器，更稳的是同步脚本加一条两边一致的测试（推断，没有来源直接背书）。
- Codex 的规则文件有 32 KiB 上限。Codex 启动时拼一次规则文件，从项目根到启动目录，合计到 `project_doc_max_bytes`（默认 32 KiB）就不再加文件，之后碰到子目录的文件也不会再加载（[Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md)）。根 AGENTS.md 201 行、29,891 字节（2026-11-15，含末尾新加的一节），离上限 2,877 字节；`src/AGENTS.md` 16,834 字节，`src-tauri/AGENTS.md` 23,746 字节。按文档推算：从仓库根启动的 Codex 会话只拿到根文件，而且已经贴近上限；在 `src/` 或 `src-tauri/` 里启动会超限。这是计算，没有在 Codex 里实测。根文件开头已经写明改 `src/`、`src-tauri/` 时要遵守对应的规则文件，代理可以自己去读，只是不会自动注入；这句话在 Claude Code 会话里的实际效果见第 1 点。
- 钩子只管 Claude Code。两个门禁登记在 [.claude/settings.json](../../.claude/settings.json)；别的 agent 的钩子能力这次没查，跨 agent 的强制只能确定落在脚本、git 钩子和 CI 上。
- 清单有预算。Claude Code 的 skill 清单占上下文窗口的 1%，超出时先丢最少调用的 skill 的描述，每条 `description` 加 `when_to_use` 在 1,536 字符处截断（[Claude Code](https://code.claude.com/docs/en/skills)）；Codex 是 2%，窗口未知时 8,000 字符（[Codex](https://learn.chatgpt.com/docs/build-skills)）。低频但关键的 skill（发版、引导）最先受影响，要靠显式调用或门禁兜底。
- 写法要可移植。标准字段只有六个（[规范](https://agentskills.io/specification)）；Claude Code 的扩展字段别的 agent 多半不认，正文里的命令写成从仓库根执行的 `pnpm …`、不依赖 Claude Code 专有的路径变量更稳（推断）。

### 7. 要用户定的

- 第一批做不做、做哪几项。建议 1–5：一行规则、按表配置的门禁、`fuyu-task`、两个脚本。
- 界面和引导两个一致性 skill 做不做；做的话要不要随 skill 带 eval（每个 3–5 个场景，先测不带 skill 的基线）；引导是单独一个 skill，还是界面 skill 下的一份参考文件（impeccable 是后者：[onboard.md](https://github.com/pbakaus/impeccable/blob/main/skill/reference/onboard.md)）。
- 写引导 skill 之前先定两处现状：Mac 上在引导里集中请求权限的那一幕算不算有意的例外；Mac 上算上权限共 6 幕，要不要守「不超过 5 幕」（见「引导清单」）。
- 要不要给 Codex 搭桥（opencode 已经能读 `.claude/skills`），以哪个目录为正本。
- 根 AGENTS.md 要不要瘦身：`fuyu-task` 做出来以后把「Git 与协作」「文档」里的流程段落缩成指针，目录总览这类能从代码库推出来的内容留不留。「Skill 编写规范」按第 5 点补不补，补在根文件里还是另放一份文档（根文件离 Codex 的上限只有 2,877 字节）。
- 界面改动要不要门禁钩子、拦哪些路径；回归页的对比度门槛要不要从 3:1 收紧到正文 4.5:1。现有四个 skill 的小修做不做（见「现有四个 skill 对照新规则」）。

## 详细

### 会话统计

来源是本机会话记录统计（2026-11-15）和 git 历史（2026-11-15）。方法：脚本读每份记录里的工具调用和用户亲手输入的内容；命令先去掉 heredoc 里的文字再按开头计数；子代理的调用算在所属会话上。表里是「多少个会话至少做过一次」和「一共做了多少次」。

| 步骤 | 会话数（共 98） | 次数 |
|---|---|---|
| `git commit` | 86 | 423 |
| 认领任务 / `pnpm tasks done` | 55 / 55 | 83 / 84 |
| 在 issue 下回复 / 关 issue（`gh issue comment` / `gh issue close`） | 68 / 14 | 142 / 39 |
| `pnpm mq:land` / `mq:wait` / `mq:pending` | 50 / 44 / 44 | 160 / 127 / 93 |
| `pnpm test:regression` / `cargo test` / `cargo clippy` | 44 / 48 / 36 | 199 / 254 / 190 |
| `pnpm tasks note` / `tasks add` / `tasks conflicts` | 32 / 31 / 29 | 66 / 70 / 37 |
| 新建 issue（`gh issue create`） | 19 | 31 |
| `pnpm settings:index` | 23 | 40 |
| 用了内置浏览器看页面 | 24 | — |
| 联网搜索（WebSearch / WebFetch） | 19 | 351 / 304 |
| 提交了 `docs/research/` / `docs/design/` / `docs/investigations/` | 15 / 15 / 10 | — |
| 用临时索引（`GIT_INDEX_FILE`）只提交同一文件里自己的那部分 | 14 | 48 |

- 按内容粗分（可重叠）：接入 AI 代理 18 个会话，调研 20 个，Mac 适配 20 个，界面设计 20 个，排查 18 个，改了界面文案（`src/i18n/`）24 个。
- 用户亲手输入的 404 条里重复的说法（次数 / 会话数）：「用中文」26 / 22；问进度 24 / 10；「说说你的看法」再说「可以」20 / 12；推和合 18 / 9；重新设计、排版、UI 15 / 9；调研 13 / 8；适配 Mac 12 / 7；开主 agent 11 / 5；排查 8 / 6；要一段去另一台机器或新会话继续的提示词至少 3 / 3。「用中文」到第 24 次才被记进本机的 Claude 记忆，之后 20 分钟里又说了 2 次。
- 92 份简报（正文中位数 1892 个字符）里各条约束出现的份数：不开 worktree 不切分支 69，只提交自己的文件 69，要跑哪些验证 66，先读 AGENTS.md 65，长命令放后台 59，不 stash / reset 54，用中文 52，`mq:land` 怎么走 51，`task:claim` 48，`tasks done` 45，本机测不了的写进实测清单 43，Rust 构建用 `target/agents` 43，不跑 `pnpm tauri dev` 41，认领后先在 issue 下回复 40，加载某个 skill 28，`pnpm heavy` 排队 3。
- 子目录规则文件的加载。方法：在记录里找自动注入的规则文件、Read 工具读它的调用和任何提到该路径的命令，子代理的也算。提交过 `src/` 下文件的 33 个会话里，19 个读过 `src/AGENTS.md`（15 个从开头读），14 个从没读过；提交过 `src-tauri/` 下文件的 35 个会话里，12 个读过 `src-tauri/AGENTS.md`（8 个从开头读），23 个从没读过。98 份记录里自动注入的规则文件只有根 AGENTS.md 和本机记忆，没有一次是子目录的。这些会话读文件多用 Bash（`cat` 3,048 次、95 个会话），Read 工具只有 243 次、35 个会话；其中 4 个和 3 个会话用 Read 工具读过这两个目录下的文件，也没有记录到自动加载，原因没有查。没读规则文件不等于违反了规则：行数、颜色、lint 有检查把关，漏的是检查管不到的那部分，例如新增 Tauri 命令要同步改哪几处、文案要中英文都写。
- 设计类的要求已经形成套路：先调研，做一个能点的预览页给几种方案并标出推荐，用系统浏览器打开，用户挑一个再实现。两天里 4 个会话专门做预览页，仓库里已有 9 个这类 HTML。
- 更长的历史：2440 个提交（2026-07-04 起），任务 437 个（355 个已归档），`docs/research/` 42 篇，`docs/design/` 10 份区域约定；提交按范围最多的是 tasks 395、plugins 226、agent-status 137、island 132、settings 103。
- 不在仓库里的机制：用户级 skill `doc-preview`（项目会话在用）只在这台 Mac 上；本机 Claude 记忆 5 条里，用中文、主 agent 模式、预览页用系统浏览器打开、总会话自己攒批 land 这四条是项目规则。

### SKILL.md 的限制和字段

| 项 | 规则或数值（2026-11-15） | 来源 |
|---|---|---|
| `name` | 1–64 字符，小写字母、数字、连字符，和所在目录同名 | [规范](https://agentskills.io/specification) |
| `description` | 标准上限 1,024 字符，写清做什么和何时用；Claude Code 的清单里 `description` 加 `when_to_use` 每条在 1,536 字符处截断，关键用例放最前 | [规范](https://agentskills.io/specification)、[Claude Code](https://code.claude.com/docs/en/skills) |
| 清单预算 | Claude Code：上下文窗口的 1%，超出时先丢最少调用的 skill 的描述；`/context` 的 Skills 行能看到裁剪后的大小。Codex：2%，窗口未知时 8,000 字符 | [Claude Code](https://code.claude.com/docs/en/skills)、[Codex](https://learn.chatgpt.com/docs/build-skills) |
| 正文长度 | 500 行以内；标准另写 5,000 token 以内。加载后每一行都是持续的成本 | [Claude Code](https://code.claude.com/docs/en/skills)、[规范](https://agentskills.io/specification) |
| 压缩之后 | 每个被调用的 skill 只保留最近一次调用的前 5,000 token，所有 skill 合计 25,000 token；最重要的指令放开头 | [Claude Code](https://code.claude.com/docs/en/skills) |
| 引用文件 | 从 SKILL.md 只挂一层；长的参考文件开头放目录（Anthropic 写 100 行以上，skill-creator 写 300 行以上）；写清什么情况读哪个文件 | [Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)、[skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)、[agentskills.io](https://agentskills.io/skill-creation/best-practices) |
| 可移植的字段 | 标准只有 `name`、`description`、`license`、`compatibility`、`metadata`、`allowed-tools`；Claude Code 的 20 个字段里 14 个是扩展（`when_to_use`、`paths`、`disable-model-invocation`、`context`、`hooks` 等），带着它们上传到 claude.ai 或 Skills API 会报错 | [规范](https://agentskills.io/specification)、[Claude Code](https://code.claude.com/docs/en/skills) |
| 谁能调用 | `disable-model-invocation: true` 时只有用户能调，描述不进清单；文档建议有副作用的流程用它。Codex 的对应项是 `agents/openai.yaml` 里的 `policy.allow_implicit_invocation` | [Claude Code](https://code.claude.com/docs/en/features-overview)、[Codex](https://learn.chatgpt.com/docs/build-skills) |
| `paths` | glob 列表，只在处理匹配的文件时自动加载，相对当前工作目录；Claude Code 和 Cursor 认这个字段 | [Claude Code](https://code.claude.com/docs/en/skills)、[Cursor](https://cursor.com/docs/context/skills) |
| 同名优先级 | Claude Code：企业 > 个人 > 项目，`/name` 跑的是个人目录那份 | [Claude Code](https://code.claude.com/docs/en/skills) |
| frontmatter 写坏 | YAML 解析失败时正文照常加载、元数据为空，自动触发失效；`claude plugin validate .claude/skills`（v2.1.233 起）能查出来 | [Claude Code](https://code.claude.com/docs/en/skills) |
| description 的句式（有分歧） | Anthropic 要第三人称、做什么加何时用；agentskills.io 要祈使句并写得主动些；superpowers 只写触发条件，理由是代理读到流程摘要后会照摘要做、不再读正文 | [Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)、[agentskills.io](https://agentskills.io/skill-creation/optimizing-descriptions)、[superpowers](https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md) |
| 坑（Gotchas） | 两个来源都说这是 skill 里信号最高的部分：写违反合理假设的环境事实，每纠正代理一次加一条 | [agentskills.io](https://agentskills.io/skill-creation/best-practices)、[Claude blog](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills) |
| 不该放的 | 会过期的信息；模型本来就知道的解释（判断标准：没有这句话代理会不会做错）；只对一次任务成立的答案；skill 文件夹里的 README | [Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)、[agentskills.io](https://agentskills.io/skill-creation/best-practices)、[Complete Guide](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf) |
| 测试 | 分开量「该触发时触发了没有」和「触发后做对了没有」，都靠全新会话里带 skill 和关掉 skill 的对比；触发用约 20 条查询（一半该触发，一半沾边但不该触发）各跑 3 次；`/skill-doctor`（v2.1.252 起）列出每个 skill 的上下文成本和使用频率 | [Claude Code](https://code.claude.com/docs/en/skills)、[agentskills.io](https://agentskills.io/skill-creation/optimizing-descriptions) |

- description 的分歧可以折中（推断）：一句做什么，接触发条件和触发词，必要时加一句不适用的边界，不写步骤。现有四个 skill 基本是这个写法。中文触发词的效果没有找到公开测量，只能自己量。
- 「正文要短、不叙述为什么」（[Claude Code](https://code.claude.com/docs/en/skills)）和「带原因的指令更可靠」（[agentskills.io](https://agentskills.io/skill-creation/evaluating-skills)）可以并存：一条规则配半句原因，长的背景放参考文件或 `docs/`（推断）。
- 测试工具：项目 skill 直接能用的是 skill-creator 的评估循环（用例放 skill 目录的 `evals/evals.json`）和用 `skillOverrides` 关掉 skill 做手动基线（[Claude Code](https://code.claude.com/docs/en/skills)）。`claude plugin eval` 能用 `tool_used: Skill` 量触发、在 CI 里设通过线，但对象是插件，评估时不加载项目的规则文件、钩子和别的 skill，测到的是 skill 单独的效果，每次运行都是真实的模型调用（[Plugin evals](https://code.claude.com/docs/en/plugin-evals)）。这些工具都只测 Claude Code，Codex 和 opencode 上没有找到现成的。

### 触发率实测

| 来源和日期 | 模型和环境 | 测法 | 结果 |
|---|---|---|---|
| [Scott Spence](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably)，2025-11-16 | Haiku 4.5，合成 API 调用 | 5 个提示各 10 次 | 简单提示钩子 20%（10/50）；forced-eval 钩子 84%（42/50）；LLM-eval 钩子 80%（40/50） |
| [Scott Spence](https://scottspence.com/posts/measuring-claude-code-skill-activation-with-sandboxed-evals)，2026-02-08 | Sonnet 4.5，真实 Claude Code（`claude -p`，沙箱） | 22 个提示跑两轮，约 250 次调用，共 5.59 美元 | 无钩子 55% 和 50%；简单钩子 59% 和 50%；forced-eval 两轮都是 100%；较难的 24 题上 forced-eval 75%、llm-eval 67% |
| [Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)，2026-01-27 | 没写明模型和题数 | Next.js 16 新 API 的构建、lint、测试 | 无文档 53%；skill 默认 53%（56% 的用例里没被调用）；AGENTS.md 里明确要求用 skill 79%；AGENTS.md 里放压缩的文档索引 100% |
| [Codeminer42](https://blog.codeminer42.com/stop-putting-best-practices-in-skills/)，2026-04-09 | Opus 4.6，`claude -p` | 单轮 31 加 10 个任务；多轮每种配置 15 次调用机会 | 单轮普通 skill 0%；多轮：superpowers 的启动钩子 10/15，CLAUDE.md 一行提示 5/15，普通 skill 1/15 |
| [Tessl](https://tessl.io/blog/a-proposed-framework-for-evaluating-skills-research-eng-blog)，2026-04-15 | 约 500 个注册表里的 skill；准确率一项用的是 Sonnet 4.6 | 2,286 个生成任务，强制和不强制对比 | 不强制 929/2,286（41%）；强制 2,240/2,286（98%） |
| [Anthropic](https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills)，2026-03-03 | 没写明模型 | 用 skill-creator 调 description | 6 个公开的文档类 skill 里 5 个触发改善 |
| 本仓库，本机会话记录统计（2026-11-15） | Claude Code 桌面应用，模型没有统计 | 98 份会话里各 skill 的加载次数 | `fuyu-agent-harness`（有门禁）19 次、18 个会话；`fuyu-lead` 10 次；`fuyu-release` 2 次、1 个会话；`fuyu-video` 0 次。这不是触发率，该加载的场合有多少没有统计 |

- 各行的模型、harness、题目都不同，数值不能互相比较，只能看方向：只靠描述不可靠，明确指令和钩子提升明显，常驻上下文不需要触发。数据多来自 Sonnet 4.5、Haiku 4.5、Opus 4.6，放到现在的模型上要重新量。Codeminer42 样本小、作者自测。
- forced-eval 钩子的代价是每次回复都带一段评估，输出更长（[Scott Spence](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably)）。代理通常只在任务超出自己能直接处理的范围时才去查 skill，简单的一步请求即使描述完全匹配也可能不触发（[agentskills.io](https://agentskills.io/skill-creation/optimizing-descriptions)）。
- Anthropic 给的目标值是相关请求里 90% 能触发，用 10–20 个测试请求量，文档说明这是期望值（[Complete Guide](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)）。按 Scott Spence 约 250 次调用 5.59 美元估，一个 skill 测 20 条查询各 3 次的成本在一两美元上下（推算，按他当时用的模型）。
- 另有两个数字只见二手转述或只看到标题（Seleznov 的 650 次试验：[mcp.directory](https://mcp.directory/blog/why-your-claude-skill-isnt-activating-2026-fixes)；SessionStart 钩子从 15% 到 62%：[Towards Data Science](https://towardsdatascience.com/a-session-start-hook-raised-claude-code-skill-firing-from-15-to-62/)），未核实，不作依据。

### 各 agent 读哪个 skill 目录

| Agent | 项目级目录 | 读 `.claude/skills` | 读 `.agents/skills` | 来源 |
|---|---|---|---|---|
| Claude Code | `.claude/skills/`；子目录里的 `.claude/skills/`（会话在该子目录或其下启动时）；插件 | 是 | 否，页面没列 | [Skills](https://code.claude.com/docs/en/skills) |
| Codex | `.agents/skills`（从工作目录到仓库根），跟随符号链接的 skill 文件夹 | 否，页面没列 | 是 | [Build skills](https://learn.chatgpt.com/docs/build-skills) |
| opencode | `.opencode/skills`，兼容另外两个 | 是 | 是 | [opencode](https://opencode.ai/docs/skills/) |
| Cursor | `.agents/skills/`、`.cursor/skills/`，兼容 `.claude/skills/`、`.codex/skills/` | 是 | 是 | [Cursor](https://cursor.com/docs/context/skills) |
| GitHub Copilot | `.github/skills`、`.claude/skills`、`.agents/skills` | 是 | 是 | [GitHub Docs](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) |
| VS Code | 按 harness 分：Copilot 读 `.github/skills/`，Claude 读 `.claude/skills/`，Codex（实验）读 `.agents/skills/` 和 `.github/skills/` | 看 harness | 看 harness | [VS Code](https://code.visualstudio.com/docs/copilot/customization/agent-skills)（2026-11-11 更新） |
| Gemini CLI、Antigravity | `.gemini/skills/` 或 `.agents/skills/`；Antigravity 是 `.agents/skills/` | 页面未提 | 是 | [Gemini CLI](https://geminicli.com/docs/cli/skills/)、[Antigravity](https://antigravity.google/docs/skills) |
| Amp | `.agents/skills/`，其后是 `.claude/skills/` | 是 | 是 | [Amp](https://ampcode.com/docs/customize/skills) |
| goose | `.agents/skills/`（推荐），兼容 `.goose/skills/`、`.claude/skills/` | 是 | 是 | [goose](https://goose-docs.ai/docs/guides/context-engineering/using-skills) |

- 标准只规定 skill 文件夹里面的内容，不规定放哪。接入指南把 `.agents/skills/` 称为跨客户端约定，同时承认不少实现也扫 `.claude/skills/`（[agentskills.io](https://agentskills.io/client-implementation/adding-skills-support)）。
- 让 Claude Code 读 `.agents/skills` 的请求 [#31005](https://github.com/anthropics/claude-code/issues/31005) 在 2026-11-15 仍是 open（约 470 个赞），没有 Anthropic 员工说明是否计划支持。issue 里有人说逐个 skill 建符号链接可行、整目录链接会失败，都是用户的说法，没有独立验证。
- 真实仓库的做法：Next.js 的 `.claude/skills` 是指向 `../.agents/skills` 的符号链接（[next.js](https://github.com/vercel/next.js/tree/HEAD/.claude)）；PyTorch、PostHog、Sentry、Supabase 的同名路径也是符号链接，目标没有逐个读。Windows 上创建符号链接要管理员权限或开发者模式，git 没开 `core.symlinks` 时会把提交的符号链接检出成纯文本文件（[Memory](https://code.claude.com/docs/en/memory)）。
- 对本仓库（推断）：以 `.claude/skills` 为正本时，opencode、Cursor、Copilot、Amp、goose 直接可用，只需给 Codex（和 Gemini CLI、Antigravity）补 `.agents/skills`，办法是同步脚本加一条两边一致的测试，或者在 `.agents/skills` 放只含 frontmatter 和一句指向正本的薄 skill。`fuyu-video` 的命令里写了 `.claude/skills/fuyu-video/scripts/` 的路径，换正本目录时要一起改。
- 规则文件这一层只维护 AGENTS.md 就够：仓库没有 CLAUDE.md，Claude Code 在这种情况下直接读 AGENTS.md（v2.1.277 起），子目录的那份按文档是在它用 Read 工具打开该目录里的文件时加载（[Memory](https://code.claude.com/docs/en/memory)），本仓库两天里没有记录到一次（见「会话统计」）；Codex 的拼接方式和上限见结论第 6 点。Claude Code 建议每个规则文件 200 行以内（[Memory](https://code.claude.com/docs/en/memory)），根文件现在 201 行。

### 公开的设计 skill 怎么搭的

| skill | 用量（2026-11-15） | SKILL.md | 结构 | 对本仓库有用的 |
|---|---|---|---|---|
| [frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)（Anthropic） | [skills.sh](https://skills.sh/anthropics/skills/frontend-design) 1.1M 安装；仓库 195,125 star | 71 行，没有参考文件和脚本 | 单文件立场型：先列五类「AI 味」聚类做校准，再「小计划 → 对照 brief 审计划 → 写代码」 | 两遍流程；写明 brief 的原话优先 |
| [web-design-guidelines](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md)（Vercel） | 864.8K 安装；34,097 star | 约 40 行 | 薄壳：每次评审前联网取 [command.md](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)（191 行、16 组规则），只评审不生成 | 扁平的检查清单和 `file:line` 输出格式 |
| [design-taste-frontend](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md)（taste-skill） | 780.5K 安装；115,925 star | 381 行 | 只做网站：house rules 加脚本，脚本负责发牌、无头浏览器检查和 Stop 钩子里的收尾闸门 | 规则不强制就被跳过，要升级成检查器的失败条件 |
| [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md) | 452.9K 安装；149,807 star | 217 行 | 10 类规则的优先级表，细则在参考文件，CSV 数据加检索脚本 | 全局文件加页面级差异文件，不经授权不覆盖 |
| [emil-design-eng](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md)（Emil Kowalski） | 450.3K 安装；57,106 star | 684 行，单文件 | 动效为主：决策四问、时长表，评审必须用 Before / After / Why 表格输出 | 固定的评审输出格式；每条都写理由 |
| [impeccable](https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.src.md) | 409.6K 安装；110,536 star | 93 行，另有 45 个参考文件 | 路由型：命令表把每类请求指到一个参考文件；62 条确定性检测规则；钩子分「每次编辑后」和 Stop 两档（[hooks.md](https://github.com/pbakaus/impeccable/blob/main/skill/reference/hooks.md)） | 动手改界面前才读检查清单；「检查」和「默认拒绝」分两张清单（[craft-floor.md](https://github.com/pbakaus/impeccable/blob/main/skill/reference/craft-floor.md)） |
| [shadcn](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/SKILL.md) | 148.8K 安装（总榜摘要里是 271.1K，原因未核实）；128,231 star | 296 行，`rules/` 6 个文件 | 加载时跑命令注入项目现状（已装组件），规则配正误代码对，随带 8 个 eval 场景（[evals.json](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/evals/evals.json)） | 先复用后新建、只用语义颜色；随 skill 带 eval |

- 证据的质量：没有找到针对设计类 skill 的同行评议基准；表里的安装数来自安装命令的匿名遥测，页面没说明是否去重（[skills.sh](https://skills.sh/docs/faq)），star 是所在仓库的。taste-skill 自己的盲测里，最后一轮评委分是用它 7.7、不用 skill 7.8、用另一个 skill 7.2，而同一批页面在它的检查器下是 0 个失败对 8–13 个；第一版建的 10 个页面没有一张真实图片，直到检查器把这项设成失败条件（[CHANGELOG](https://github.com/Leonxlnx/taste-skill/blob/main/CHANGELOG.md)）。所以「一致」能量出来的是检查项通过率和 DOM、样式的差异，不是审美评分（推断）。
- 通用设计 skill 的作用是把输出从模型的默认外观上挪开：Paralect 用同一份落地页 brief 测了 8 个设计 skill，`frontend-design` 做到了这一点，但仍会编造文案、客户和价格（[Paralect](https://www.paralect.com/skills/top-design-skills)）。Subframe 归纳的用户讨论是每个流行 skill 会带出自己可辨认的风格，它建议只装一个，并和不用 skill 的结果对照（[Subframe](https://www.subframe.com/tips/best-claude-code-skills-for-ui-design)）。两篇都是带商业立场的博客，没写模型和运行次数。公共市场上带可执行脚本的 skill 含漏洞的几率是纯指令 skill 的 2.12 倍（[arXiv 2601.10338](https://arxiv.org/abs/2601.10338)）。对已有设计语言的应用，目标是贴近既有体系，不是挪开默认值，所以建议不把公开的通用设计 skill 常驻装进本仓库，只借结构（推断）。
- 应用内界面 skill（提案）：SKILL.md 100–150 行，只分流和排流程。按要改的区域指到 `docs/design/<区域>.md`（只给路径）→ 先查可复用的组件和 class → 要用户挑的做预览页（2–4 个方案、标推荐、系统浏览器打开、放 `docs/investigations/`）→ 少量硬规则，每条对应一个已有的检查（`pnpm check:colors`，`pnpm test:regression` 的深浅两轮快照和对比度）→ 改完跑哪些命令、给出什么证据 → 决定记进区域文档，顺带更新设置索引、引导和外观预览。色值、间距、时长留在 CSS 变量里，skill 只写变量名：impeccable 自己也声明 CSS 令牌文件才是事实来源，文档里的数值只是导出（[DESIGN.md](https://github.com/pbakaus/impeccable/blob/main/DESIGN.md)）。参考文件挂一层：桌面检查项、不做的事、可复用清单（最好由脚本生成）。eval 场景可以是「给设置窗口加一行设置项」「给岛加一种消息样式」，期望写成能机械判断的：没有新增写死的颜色、两种语言都不溢出、快照差异只出现在预期位置。
- 能从文字升级成回归检查的候选（推断）：中英文下按钮和标题是否溢出；交互元素的最小尺寸（WCAG 是 24×24 CSS px：[2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)；macOS 控件默认 28×28 pt、最小 20×20 pt：[Apple HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility)）；模拟减少动态效果后是否还有动画；`forced-colors` 下边界是否还在（这个模式下 `box-shadow` 被置为 none：[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors)）；焦点是否可见。回归页现在的对比度门槛是 3:1，WCAG 对普通字号的正文是 4.5:1、大字 3:1（[WCAG 2.2](https://www.w3.org/TR/WCAG22/)）。Apple 有两条规范和产品形态冲突（不提供应用自己的外观设置：[Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)；应用不活跃时隐藏面板：[Panels](https://developer.apple.com/design/human-interface-guidelines/panels)），在检查项里写成有意的例外和理由。
- 官网 skill（提案，放官网仓库）：[product-website-design.md](product-website-design.md) 的结论（brief 加禁用清单比组件库重要）仍然成立，2025-11 之后多了四层。先写产品事实和具体参照物，再谈视觉（[init.md](https://github.com/pbakaus/impeccable/blob/main/skill/reference/init.md)、[PHILOSOPHY.md](https://github.com/google-labs-code/design.md/blob/main/PHILOSOPHY.md)）；「计划 → 对照 brief 审计划 → 实现 → 看截图」的两遍流程；禁用清单换代，2026-09 改写的 frontend-design 把上一轮「反 AI 味」催生的奶油底、衬线、陶土色列为第一类要避开的默认值（[提交历史](https://github.com/anthropics/skills/commits/main/skills/frontend-design/SKILL.md)），清单里再加上不编造评价、客户和数字（[taste-skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md)）；最后用浏览器里的检查把关。禁用清单要带日期，定期对照（推断）。

### 引导清单

四家指南（NN/g、Apple、Microsoft、Material）一致的是：能不做就不做，要做就短、可跳过、边做边学，设置和权限往后放，之后能找回来，后续用情境提示接着教；没有哪一家给出「引导最多几步」的统一数字。下面 14 条是调研整理的 34 条候选里新会话最容易漏的，这个挑选是判断，没有在真实会话里试过。

| 条目 | 来源 | 证据 |
|---|---|---|
| 加新功能先回答：不加任何引导，用户能不能发现并用起来；能就不加 | [NN/g 2020](https://www.nngroup.com/articles/mobile-app-onboarding/)、[Microsoft: First Experience](https://learn.microsoft.com/en-us/windows/win32/uxguide/exper-first-exper) | 研究机构、平台方 |
| 确实要教的，默认做成用到时出现的首次提示，不往引导里加一幕 | [Apple HIG: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)、[NN/g 2023](https://www.nngroup.com/articles/onboarding-tutorials/) | 平台方、研究机构 |
| 任何一步都能跳过，入口醒目；跳过或完成后不再自动出现 | [Apple HIG: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)、[NN/g 2020](https://www.nngroup.com/articles/mobile-app-onboarding/) | 平台方、研究机构 |
| 能从设置或帮助里重新打开，入口位置固定 | [Apple HIG: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)、[WCAG 3.2.6](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) | 平台方、标准 |
| 总步数不超过 5，目标 3–4；要加一幕先删一幕 | [Chameleon 2025](https://www.chameleon.io/benchmark-report)、[Chameleon 2024](https://www.chameleon.io/benchmark-report-24) | 厂商数据，方向可信、绝对值不可靠 |
| 权限在第一次用到对应功能时再请求；只有离了它应用不能工作的才放进引导 | [Apple HIG: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)、[Apple HIG: Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy) | 平台方 |
| 不假设用户看得见托盘或菜单栏图标：告诉用户入口在哪，并保证有不依赖图标的入口 | [Apple HIG: The menu bar](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar)、[Microsoft: Notification Area](https://learn.microsoft.com/en-us/windows/win32/uxguide/winenv-notification) | 平台方（微软这页是 Windows 7 时代的） |
| 同一时间只出现一个提示，同一会话最多一个 | [NN/g 2014](https://www.nngroup.com/articles/mobile-instructional-overlay/)、[Material](https://m1.material.io/growth-communications/feature-discovery.html)、[Chromium](https://chromium.googlesource.com/chromium/src/+/main/components/feature_engagement/README.md) | 研究机构、平台方 |
| 每条提示定四件事：谁有资格看、最多出现几次、用过或关掉即永久失效、全局频率上限 | [TipKit](https://developer.apple.com/documentation/tipkit)、[Apple HIG: Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help)、[Chromium](https://chromium.googlesource.com/chromium/src/+/main/components/feature_engagement/README.md) | 平台方；每 24 小时一条只是 Apple 文档里的示例值 |
| 只用键盘能走完、跳过和关闭：Tab 在引导控件间循环，Esc 关闭，打开时焦点进入，关闭后回到原处 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/)、[APG: Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | 标准 |
| 系统开了减少动态效果时，位移和缩放动画关掉或换成淡入淡出；招牌动画有静态替代 | [WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)、[Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | 标准（AAA 级）、平台方 |
| 中文和英文文案同时写、同时验收；容器不写死宽度，按较长的语言留余量并允许换行 | [W3C](https://www.w3.org/International/articles/article-text-size)、[Microsoft: Notifications](https://learn.microsoft.com/en-us/windows/win32/uxguide/mess-notif) | 标准组织、平台方；中文译成英文膨胀多少没有权威数字 |
| 改了引导演示到的功能、界面或文案：同一个提交里更新对应的幕、演示数据和回归测试，或在提交说明里写明为什么不影响引导 | [Owl-Listener](https://github.com/Owl-Listener/designer-skills/blob/main/interaction-design/skills/onboarding-design/SKILL.md)、[rshankras](https://github.com/rshankras/claude-code-apple-skills/blob/main/skills/generators/onboarding-generator/SKILL.md)、[Frigade](https://frigade.com/blog/onboarding-tours-break) | 社区 skill、厂商文章 |
| 别的测试默认关掉引导和首次提示，专门的测试显式打开；提示机制提供全部显示、全部隐藏、重置的开关 | [rshankras](https://github.com/rshankras/claude-code-apple-skills/blob/main/skills/generators/onboarding-generator/SKILL.md)、[TipKit](https://developer.apple.com/documentation/tipkit)、[Chromium](https://chromium.googlesource.com/chromium/src/+/main/components/feature_engagement/README.md) | 社区 skill、平台方 |

- 证据等级：独立的定量证据只有 NN/g 的一项 70 人研究，看教程组和跳过组的任务成功率是 91% 对 94%（不显著），看了教程的人反而觉得更难（[NN/g](https://www.nngroup.com/articles/mobile-tutorials/)）。步数和完成率的数字都来自卖引导工具的厂商，对象是网页 SaaS，而且互相矛盾：导览平均完成率 2019 年版是 61%，2024 年版是 33.5%（[2019](https://www.chameleon.io/blog/product-tour-benchmarks-highlights)、[2024](https://www.chameleon.io/benchmark-report-24)）。没有找到任何针对桌面托盘、菜单栏或悬浮窗工具的基准。所以 skill 里来自标准的条目写「必须」，步数和频率写「默认」。
- 和现状对照（对着 [onboarding.md](../features/onboarding.md) 核的）：可跳过、Esc 退出、从「关于」重开、减少动画时关掉动画、首次提示一天最多一条且没点的最多出 3 次，都已经做到。两处有出入，写 skill 前要先定：Mac 上有一幕在引导里集中请求权限（按留下的功能列出、可以不开直接下一步、点了「去允许」才弹系统提示），和「第一次用到时再请求」不同；Mac 上算上权限一幕是 6 幕，超过上表的默认上限。
- skill 正文不可替代的是项目特有的指路信息，通用原则压成十来行。要指的地方：各幕在 `src/windows/onboarding/` 的 `*Act.tsx`，身份和功能的对应在 `personas.ts`，文案在 `src/i18n/sections/onboarding.ts`，演示数据在 `windows/island/useOnboardingDemo.ts`，首次提示在 `src/features/first-hints/`（状态键 `fuyu-first-hints`），回归页是 `tests/regression/onboarding.html`，现状和已定的决定在 onboarding.md 和 [onboarding-design.md](onboarding-design.md)。只指路径，不抄内容。
- 触发条件要覆盖没提引导的情形：新增用户可见功能、改了引导演示到的界面、改文案、动权限或开机自启或托盘的逻辑、适配另一个平台。eval 至少三条：加了新功能但提示语里没提引导；改了被引导演示的界面；只写了中文文案。
- 可借的结构来自 [rshankras 的 onboarding-generator](https://github.com/rshankras/claude-code-apple-skills/blob/main/skills/generators/onboarding-generator/SKILL.md)：开头一个决定性问题，一份每次动引导都重跑的审计清单，frontmatter 里记上次核实和下次复核的日期。社区 skill 会把来源里没有的数字写死（一份写 Apple 规定引导最多三屏，Apple 的页面没有这个数字：[hig-patterns](https://github.com/raintree-technology/apple-hig-skills/blob/main/skills/hig-patterns/SKILL.md)），所以清单里每个数字都要能回到出处。

### 从会话里挖 skill：方法和实证

- Claude Code 的 `/insights` 只出一份 HTML 报告（做了什么、哪里出问题、建议），不生成 skill；单次最多分析 200 个没分析过的会话，会话数据默认保留 30 天（[Manage costs](https://code.claude.com/docs/en/costs)）。按两天 98 份的节奏，200 个只够四天左右（推算）。
- 真正从会话里产出 skill 或规则的工具用的信号一致：用户纠正了流程或步骤顺序，用户反复补充同一段背景，走过弯路才找到的做法，跨会话重复的摩擦，几个会话各自重写相似的脚本，已加载的 skill 被证明有错（[Hermes](https://github.com/NousResearch/hermes-agent/blob/HEAD/agent/background_review.py)、[ce-retro](https://github.com/EveryInc/compound-engineering-plugin/blob/HEAD/skills/ce-retro/SKILL.md)、[skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)）。没有任何一手来源给出「重复几次就该做成 skill」的阈值；工具调用序列长本身不是信号，Every 明确写顺利完成的工作不触发沉淀（[ce-compound](https://github.com/EveryInc/compound-engineering-plugin/blob/HEAD/skills/ce-compound/SKILL.md)）。
- 沉淀到哪是分流，不是默认建 skill：Every 依次是检查、规范、文档（[form.md](https://github.com/EveryInc/compound-engineering-plugin/blob/HEAD/skills/ce-compound/references/form.md)）；VS Code 是回归测试、设计文档、指令文件、临时的 learning 收件箱、skill（[feedback-learning](https://github.com/microsoft/vscode/blob/HEAD/.github/skills/feedback-learning/SKILL.md)）；Hermes 先修补已有的 skill，再扩充，最后才新建。会话记录里混有粘贴的网页和别的代理的输出，ce-retro 把它们当不可信数据，只作证据，不当指令，也不把原文抄进提交。
- 对本仓库（推断）：这次的统计脚本就是一种挖掘。要持续做，就在会话被清掉之前各台机器各跑一次，产出「候选加建议的去处」，再由人挑。

| 研究 | 日期 | 数字 | 局限 |
|---|---|---|---|
| [SkillsBench](https://arxiv.org/abs/2602.12670)，人工整理的 skill | v4 2026-06-14 | 87 个任务、8 个领域、18 种模型加 harness 的组合；平均通过率 33.9% → 50.5%（+16.6 个百分点）；至多三个模块的聚焦型好于更大的打包；87 个任务里 13 个变差 | 只有终端里的容器化任务；基准里的 skill 质量高于生态平均，结果偏乐观 |
| [SkillsBench v4](https://arxiv.org/html/2602.12670v4)，模型动手前自己写 skill | 同上 | 测的三个配置都变差：Claude Code 加 Opus 4.7 −8.1，Codex 加 GPT-5.5 −11.3，Gemini CLI 加 Gemini 3.1 Pro −11.5 个百分点（同配置下人工整理的是 +18.2 到 +24.8）；审计的 12 条 Codex、Gemini CLI 轨迹里 10 条没读生成的 skill | 条件是没有任务经验、没有人审地预先写，不是事后从真实会话提炼 |
| [SkillsBench v4](https://arxiv.org/html/2602.12670v4)，篇幅和数量 | 同上 | 按篇幅：Compact +19.0，Standard +21.5，Detailed +14.5，Comprehensive +0.7；按每个任务配的 skill 数：1 个 +18.0，2–3 个 +19.0，4 个以上 +10.1 | Comprehensive 档只有 5 个任务；[v1](https://arxiv.org/html/2602.12670v1) 的最优档不同（Detailed +18.8，Comprehensive −2.9） |
| [Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988) | v1 2026-02-12，v3 2026-09-29 | 上下文文件总体不提高任务成功率，推理成本平均增加 20% 以上；文件里的指令会被遵守；仓库概览没有帮助；建议用来写非标准做法。[v3 正文](https://arxiv.org/html/2602.11988v3)：LLM 生成的文件解决率 −0.5% 和 −2%，开发者写的平均 +2.4%（不显著，p = 0.21）；文件里提到 `uv` 时每个实例用约 1.6 次，不提时不到 0.01 次 | 只测 Python 仓库的 issue 修复，只看是否解决；没测协作流程类规则 |
| [Lulla 等](https://arxiv.org/abs/2601.20404) | v1 2026-01-28，v2 2026-03-30 | 10 个仓库、124 个 PR：有 AGENTS.md 时运行时间中位数低 28.64%，输出 token 少 16.58%，完成情况相当 | 样本小，摘要没写明用的 agent；方向和上一行相反 |
| [Configuration Smells](https://arxiv.org/abs/2606.15828) | v1 2026-06-14，v5 2026-07-30 | 100 个流行开源仓库的 AGENTS.md / CLAUDE.md：Lint Leakage 62%，Context Bloat 42%，Skill Leakage 35% | 只核对了摘要里的这三项 |
| [Instruction Adherence](https://arxiv.org/abs/2605.10039) | 2026-05-11 | 1,650 个 Claude Code 会话：文件大小、指令位置、组织方式对是否遵守没有检测到影响；会话内每多生成一个函数，遵守的几率比约降 5.6%（OR=0.944） | 单作者；遵守目标是一条琐碎的标注要求；探索性结果 |
| [SWE-Skills-Bench](https://arxiv.org/abs/2603.15401) | v1 2026-03-16，v2 2026-10-27 | 98 个公开的软件工程 skill、3,920 组成对评估：92 个没有统计显著的效果，平均通过率 76.6% → 76.9%；最大增益 +17.7、最大损失 −17.0 个百分点；有害的 skill 让代理锚定在自带的模板上 | 测的是公开的通用 skill，不是项目特有的流程 |
| [skill 数量和选择准确率](https://arxiv.org/abs/2601.04748) | v2 2026-01-14 | 200 个合成 skill：20 个以内选择准确率高于 90%，超过 30 个后持续下降，200 个时约 20%；每多 1 个容易混淆的竞争者，准确率降 7%–30% | 合成 skill；只测了 GPT-4o 和 GPT-4o-mini；只量选择，不量任务表现 |
| [Letta](https://www.letta.com/blog/skill-learning) | 2025-12-02 | Terminal Bench 2.0 的 89 个任务、Sonnet 4.5：只从轨迹学出的 skill 绝对提升 9%，加上验证器反馈后是 15.7% | 厂商博客；单一基准、单一模型；没有报方差 |

- 读法（推断）：现有数据否定的是让模型凭通用知识预先写、没人看也没人试的 skill；事后从真实会话提炼、经人审的 skill 没有对照实验，最接近的是 Letta 的厂商数据。软件工程是 skill 增益最小的领域之一，有用的是模型无从知道的项目流程、命令和坑。语义相近的 skill 比数量多更伤选择准确率，并行会话各自起草 skill 时先查重。

### 治理，以及真实仓库签入了什么

| 仓库 | 目录 | skill 数和 SKILL.md 行数（2026-11-15） | 内容 |
|---|---|---|---|
| [facebook/react](https://github.com/facebook/react/tree/HEAD/.claude/skills) | `.claude/skills` | 7 个，12–79 行，都是单文件 | 跑测试、提交前校验、功能开关 |
| [oven-sh/bun](https://github.com/oven-sh/bun/tree/HEAD/.claude/skills) | `.claude/skills` | 8 个，47–363 行 | 子系统写法、测试写法、端到端验证 |
| [vercel/next.js](https://github.com/vercel/next.js/tree/HEAD/.agents/skills) | `.agents/skills` | 21 个，45–442 行 | PR 与回移、CI 分诊、功能开关、文档写作；带一个管自己的元 skill |
| [electron/electron](https://github.com/electron/electron/tree/HEAD/.claude/skills) | `.claude/skills` | 5 个，119–351 行 | 上游升级 playbook、安全修复回移、PR 分诊 |
| [openai/openai-agents-python](https://github.com/openai/openai-agents-python/tree/HEAD/.agents/skills) | `.agents/skills` | 14 个，24–287 行 | 改动验证、发版准备、评审；多个描述写明只在显式调用时用 |
| [denoland/deno](https://github.com/denoland/deno/tree/HEAD/.claude/skills) | `.claude/skills` | 6 个，16–227 行 | 三个是单条命令的薄封装，另有 issue 分诊和 PR 评审 |
| [PostHog/posthog](https://github.com/PostHog/posthog/tree/HEAD/.agents/skills) | `.agents/skills` | 120 个 | 数量最多的一个，有对外发布的流水线和管自己的元 skill |

- 调研抽查了 59 个知名仓库（用 GitHub API，2026-11-15；上表是其中 7 个），32 个签入了 skill，数量从 1 个到 120 个，中位数约 11 个；逐个统计行数的 132 个 skill 里 54 个（约 41%）不到 100 行，128 个（约 97%）不超过 400 行，超过 500 行的只有 1 个，没有看到工作日志形态的。59 个是按知名度手选的，不能当普及率。候选全做的话本仓库是 12 个左右，现有四个是 41–95 行。
- 签入的 skill 大致六类：提交前校验和跑测试的命令封装，PR、CI、issue 的分诊与评审，发版和回移，上游或依赖升级 playbook，某个子系统的写法和测试约定，文档和提交信息的写作。本仓库的校验类已经由 `pnpm check`、`pnpm verify` 和 AGENTS.md 的验证表承载，分诊类对应候选第 11 项。

| 治理做法 | 来源 |
|---|---|
| 新的触发条件才配新 skill；更多细节进已有 skill 的 `references/`；触发条件相同的近似 skill 合并 | [PostHog](https://github.com/PostHog/posthog/blob/HEAD/.agents/skills/writing-skills/SKILL.md) |
| 同一条规则只记一处：规则文件放一句话的护栏和指向 skill 的指针，流程放 skill；新增 skill 时在规则文件加一行 | [Next.js](https://github.com/vercel/next.js/blob/HEAD/.agents/skills/authoring-skills/SKILL.md)、[OpenAI](https://developers.openai.com/blog/skills-agents-sdk) |
| 给规则文件里的每条规则标明谁在把关（`[lint: <id>]` 或 `[review]`），长期停在 `[review]` 的是该升级成检查的候选 | [PostHog](https://github.com/PostHog/posthog/blob/HEAD/.agents/skills/editing-agents-md/SKILL.md) |
| 格式校验进 CI：`claude plugin validate .claude/skills`，标准自带的 `skills-ref validate` | [Claude Code](https://code.claude.com/docs/en/skills)、[规范](https://agentskills.io/specification) |
| 用使用数据找从不触发的 skill：`/skill-doctor`；Anthropic 内部用 PreToolUse 钩子记录。都是本机数据，两台机器要各看各的 | [Claude Code](https://code.claude.com/docs/en/skills)、[Claude blog](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills) |
| 定期审计重叠、过时和失效的引用（每周一次，或一周内新增超过一个 skill 之后）；不因为最近没人改就建议删 | [LobeHub](https://github.com/lobehub/lobe-chat/blob/HEAD/.agents/skills/skills-audit/SKILL.md) |
| 外部 skill 复制进仓库并保留署名，不做运行时依赖 | [Sentry](https://github.com/getsentry/skills) |

- 数量没有可靠的通用上限，PostHog 的手册明确说没有数字上限（[PostHog 手册](https://posthog.com/handbook/engineering/ai/writing-skills)）。项目 skill 加不加前缀各家不同：Next.js 规定不加（[authoring-skills](https://github.com/vercel/next.js/blob/HEAD/.agents/skills/authoring-skills/SKILL.md)），Home Assistant 的 9 个里 7 个带 `ha-`（[home-assistant](https://github.com/home-assistant/core/tree/HEAD/.claude/skills)）。本仓库的 `fuyu-` 前缀可以保留，它还能避开和个人目录里的 skill 重名（推断）。
- 签入仓库的 skill 以 git 历史为版本，没有来源要求在 skill 里另放变更记录（推断）。

### 现有四个 skill 对照新规则

| skill | 行数 | 两天里的加载 | 对照「Skill 编写规范」 | 建议 |
|---|---|---|---|---|
| [fuyu-agent-harness](../../.claude/skills/fuyu-agent-harness/SKILL.md) | 55 | 19 次、18 个会话 | 符合：只排顺序、列判断，现状和细节指向 `docs/` | 不动 |
| [fuyu-lead](../../.claude/skills/fuyu-lead/SKILL.md) | 42 | 10 次 | 第 13 行末尾一句是历史记录（哪天在哪个 issue 上第一次用）；第 2 节第 4 条是一长段子会话约束 | 删掉历史句；`fuyu-task` 做出来后把第 4 条缩成一句指过去 |
| [fuyu-release](../../.claude/skills/fuyu-release/SKILL.md) | 41 | 2 次、1 个会话 | 符合：步骤和命令指向 `docs/features/updater.md` 和 `docs/releases/README.md` | 不动 |
| [fuyu-video](../../.claude/skills/fuyu-video/SKILL.md) | 95，带 `scripts/` | 0 次（只在 Windows 上做视频） | 「重装环境」一条和模型下载的细节属于环境搭建；「踩过的坑」13 条是陷阱，符合规范，但已经占了全文四分之一 | 环境搭建搬到 [video/README.md](../../video/README.md)；以后再加坑先看能不能合并 |

- 四个的描述都是英文加中文触发词，三个写了不适用的边界；长度离 500 行的上限很远，和真实仓库里签入的 skill 相当。
- `fuyu-release` 有副作用、由人发起。Claude Code 文档建议这类流程加 `disable-model-invocation: true`、由用户输入 `/fuyu-release` 调用（[Extend Claude Code](https://code.claude.com/docs/en/features-overview)）；代价是说「发版」不再自动加载，改不改由用户定。
- `fuyu-video` 里写死了 Windows 那台机器上的工具路径。Anthropic 的做法是把和用户相关的配置放进 skill 目录的 `config.json`（[Claude blog](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills)），协作者要做视频时再改。

## 来源

- **本仓库的第一手数据**
  - 本机会话记录统计（2026-11-15）：这台 Mac 上 98 份 Claude Code 会话的工具调用和用户输入；不含 Windows 机器和别的 harness。
  - git 历史（2026-11-15）：提交数、任务数、文档数、AGENTS.md 的体量变化。
- **skill 的写法、加载和测试**
  - [Claude Code 文档：Skills](https://code.claude.com/docs/en/skills)：项目 skill 的位置、清单预算和截断、500 行、压缩后的保留、字段表、同名优先级、测试口径。
  - Claude Code 文档 [Extend Claude Code](https://code.claude.com/docs/en/features-overview)、[Memory](https://code.claude.com/docs/en/memory)、[Best practices](https://code.claude.com/docs/en/best-practices)、[Manage costs](https://code.claude.com/docs/en/costs)、[Plugin evals](https://code.claude.com/docs/en/plugin-evals)：规则文件、skill、钩子的分工；子目录规则文件的加载；Windows 上的符号链接；`/insights`；`claude plugin eval`。
  - [Anthropic：Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)：description、引用层级、脚本、先评估后写、两个实例迭代。
  - [Anthropic：The Complete Guide to Building Skills for Claude（PDF，2026-01）](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)：触发目标值、不放 README。
  - agentskills.io：[Specification](https://agentskills.io/specification)、[Best practices](https://agentskills.io/skill-creation/best-practices)、[Optimizing descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)、[Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)、[Adding skills support](https://agentskills.io/client-implementation/adding-skills-support)：标准字段、gotchas、触发查询的测法、跨客户端的目录约定。
  - [anthropics/skills：skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) 和 [Improving skill-creator（2026-03-03）](https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills)：从对话里提炼、description 调优、skill 的退役。
  - [Lessons from building Claude Code: How we use skills（2026-06-03）](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills)：九类 skill、gotchas、给目标不给每一步、用钩子记录使用。
  - [obra/superpowers：writing-skills](https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md)：skill 不是解题经过的叙述、description 只写触发条件。
  - Codex 文档 [Build skills](https://learn.chatgpt.com/docs/build-skills)、[AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)：Codex 的 skill 目录和清单预算，规则文件的拼接方式和 32 KiB 上限。
  - [opencode](https://opencode.ai/docs/skills/)、[Cursor](https://cursor.com/docs/context/skills)、[GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)、[VS Code](https://code.visualstudio.com/docs/copilot/customization/agent-skills)、[Gemini CLI](https://geminicli.com/docs/cli/skills/)、[Antigravity](https://antigravity.google/docs/skills)、[Amp](https://ampcode.com/docs/customize/skills)、[goose](https://goose-docs.ai/docs/guides/context-engineering/using-skills) 的 skill 文档：目录对照表。
  - [anthropics/claude-code#31005](https://github.com/anthropics/claude-code/issues/31005)：Claude Code 读 `.agents/skills` 的请求现状。
- **触发率实测**
  - Scott Spence：[2025-11-16](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably)、[2026-02-08](https://scottspence.com/posts/measuring-claude-code-skill-activation-with-sandboxed-evals)：forced-eval 钩子的两次测量和成本。
  - [Vercel：AGENTS.md outperforms skills in our agent evals（2026-01-27）](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)：skill 默认、加指令、常驻索引的对比。
  - [Codeminer42（2026-04-09）](https://blog.codeminer42.com/stop-putting-best-practices-in-skills/)、[Tessl（2026-04-15）](https://tessl.io/blog/a-proposed-framework-for-evaluating-skills-research-eng-blog)：一行提示、启动钩子、强制激活的数字。
  - 未核实、没有作为依据：[mcp.directory](https://mcp.directory/blog/why-your-claude-skill-isnt-activating-2026-fixes)（转述 Seleznov 的 650 次试验）、[Towards Data Science](https://towardsdatascience.com/a-session-start-hook-raised-claude-code-skill-firing-from-15-to-62/)（只看到标题）。
- **实证研究**
  - [SkillsBench，arXiv 2602.12670](https://arxiv.org/abs/2602.12670)（[v4](https://arxiv.org/html/2602.12670v4)、[v1](https://arxiv.org/html/2602.12670v1)）：人工整理和自生成 skill 的效果，篇幅和数量。
  - [Evaluating AGENTS.md，arXiv 2602.11988](https://arxiv.org/abs/2602.11988)（[v3](https://arxiv.org/html/2602.11988v3)）和 [arXiv 2601.20404](https://arxiv.org/abs/2601.20404)：规则文件对成功率、成本、耗时的影响。
  - [arXiv 2606.15828](https://arxiv.org/abs/2606.15828)、[arXiv 2605.10039](https://arxiv.org/abs/2605.10039)：规则文件的坏味道占比；会话内遵守率的衰减。
  - [SWE-Skills-Bench，arXiv 2603.15401](https://arxiv.org/abs/2603.15401)、[arXiv 2601.04748](https://arxiv.org/abs/2601.04748)、[arXiv 2601.10338](https://arxiv.org/abs/2601.10338)：公开 skill 的效果、数量和选择准确率、带脚本的 skill 的漏洞率。
  - [Letta：Skill Learning（2025-12-02）](https://www.letta.com/blog/skill-learning)：从轨迹学 skill 的厂商数据。
- **挖掘和治理**
  - Hermes Agent：[background_review.py](https://github.com/NousResearch/hermes-agent/blob/HEAD/agent/background_review.py)、[skill_manager_tool.py](https://github.com/NousResearch/hermes-agent/blob/HEAD/tools/skill_manager_tool.py)、[Creating Skills](https://hermes-agent.nousresearch.com/docs/developer-guide/creating-skills)：自动建 skill 的信号、不保存清单、写教训不写日志。
  - Every：[ce-compound](https://github.com/EveryInc/compound-engineering-plugin/blob/HEAD/skills/ce-compound/SKILL.md)、[form.md](https://github.com/EveryInc/compound-engineering-plugin/blob/HEAD/skills/ce-compound/references/form.md)、[ce-retro](https://github.com/EveryInc/compound-engineering-plugin/blob/HEAD/skills/ce-retro/SKILL.md)：沉淀的门槛、最便宜的持久形态、读会话历史的做法。
  - [microsoft/vscode：feedback-learning](https://github.com/microsoft/vscode/blob/HEAD/.github/skills/feedback-learning/SKILL.md)：纠正之后记到哪。
  - PostHog：[手册](https://posthog.com/handbook/engineering/ai/writing-skills)、[writing-skills](https://github.com/PostHog/posthog/blob/HEAD/.agents/skills/writing-skills/SKILL.md)、[editing-agents-md](https://github.com/PostHog/posthog/blob/HEAD/.agents/skills/editing-agents-md/SKILL.md)：阶梯、新触发才新建、给规则打把关标签。
  - [vercel/next.js：authoring-skills](https://github.com/vercel/next.js/blob/HEAD/.agents/skills/authoring-skills/SKILL.md)、[OpenAI：Using skills to accelerate OSS maintenance](https://developers.openai.com/blog/skills-agents-sdk)：规则文件放指针、skill 放流程。
  - [lobehub/lobe-chat：skills-audit](https://github.com/lobehub/lobe-chat/blob/HEAD/.agents/skills/skills-audit/SKILL.md)、[getsentry/skills](https://github.com/getsentry/skills)：定期审计、外部 skill 的引入方式。
  - 签入了 skill 的仓库：[react](https://github.com/facebook/react/tree/HEAD/.claude/skills)、[bun](https://github.com/oven-sh/bun/tree/HEAD/.claude/skills)、[next.js](https://github.com/vercel/next.js/tree/HEAD/.agents/skills)、[electron](https://github.com/electron/electron/tree/HEAD/.claude/skills)、[openai-agents-python](https://github.com/openai/openai-agents-python/tree/HEAD/.agents/skills)、[deno](https://github.com/denoland/deno/tree/HEAD/.claude/skills)、[posthog](https://github.com/PostHog/posthog/tree/HEAD/.agents/skills)、[home-assistant](https://github.com/home-assistant/core/tree/HEAD/.claude/skills)：数量、行数、内容类别；[next.js 的 .claude 目录](https://github.com/vercel/next.js/tree/HEAD/.claude)：两个目录之间的符号链接。
- **设计类 skill 和界面规范**
  - [frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)、[web-design-guidelines](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md)、[taste-skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md)、[ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md)、[emil-design-eng](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md)、[impeccable](https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.src.md)、[shadcn](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/SKILL.md)：七个公开设计 skill 的结构和体量；安装数取自各自的 skills.sh 页面（例如 [frontend-design](https://skills.sh/anthropics/skills/frontend-design)），统计口径见 [FAQ](https://skills.sh/docs/faq)。
  - 上面几个 skill 的附属文件：Vercel 的 [command.md](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)，impeccable 的 [craft-floor.md](https://github.com/pbakaus/impeccable/blob/main/skill/reference/craft-floor.md)、[hooks.md](https://github.com/pbakaus/impeccable/blob/main/skill/reference/hooks.md)、[init.md](https://github.com/pbakaus/impeccable/blob/main/skill/reference/init.md)，shadcn 的 [evals.json](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/evals/evals.json)，frontend-design 的[提交历史](https://github.com/anthropics/skills/commits/main/skills/frontend-design/SKILL.md)：规则清单、检查分档、eval 的写法、禁用清单的换代。
  - [taste-skill CHANGELOG](https://github.com/Leonxlnx/taste-skill/blob/main/CHANGELOG.md)：盲测分数和检查器失败数。
  - [Subframe（2026-10-24）](https://www.subframe.com/tips/best-claude-code-skills-for-ui-design)、[Paralect](https://www.paralect.com/skills/top-design-skills)：设计 skill 的对比（带商业立场）。
  - [impeccable DESIGN.md](https://github.com/pbakaus/impeccable/blob/main/DESIGN.md)、[google-labs-code/design.md：PHILOSOPHY.md](https://github.com/google-labs-code/design.md/blob/main/PHILOSOPHY.md)：数值的事实来源只留一处、具体参照物。
  - [WCAG 2.2](https://www.w3.org/TR/WCAG22/)（[2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)）、[Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)、[Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)、[Panels](https://developer.apple.com/design/human-interface-guidelines/panels)、[MDN: forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors)：点击目标、对比度、和产品形态冲突的两条规范。
- **引导**
  - NN/g：[Mobile-App Onboarding（2020）](https://www.nngroup.com/articles/mobile-app-onboarding/)、[Mobile Tutorials（2020）](https://www.nngroup.com/articles/mobile-tutorials/)、[Onboarding Tutorials vs. Contextual Help（2023）](https://www.nngroup.com/articles/onboarding-tutorials/)、[Instructional Overlays（2014）](https://www.nngroup.com/articles/mobile-instructional-overlay/)：何时做引导、70 人研究、推和拉、一次一个提示。
  - Apple：[HIG: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)、[Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help)、[Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)、[The menu bar](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar)、[Motion](https://developer.apple.com/design/human-interface-guidelines/motion)、[TipKit](https://developer.apple.com/documentation/tipkit)：可跳过、权限时机、提示的资格和频率。
  - Microsoft Learn：[First Experience](https://learn.microsoft.com/en-us/windows/win32/uxguide/exper-first-exper)、[Notification Area](https://learn.microsoft.com/en-us/windows/win32/uxguide/winenv-notification)、[Notifications](https://learn.microsoft.com/en-us/windows/win32/uxguide/mess-notif)：桌面程序的首次运行、托盘图标、文案余量。
  - [Material Design (M1): Feature discovery](https://m1.material.io/growth-communications/feature-discovery.html)、[Chromium: Feature Engagement](https://chromium.googlesource.com/chromium/src/+/main/components/feature_engagement/README.md)：每个会话最多一个提示、提示的状态机。
  - W3C：[What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)、[APG: Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)、[Understanding 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)、[Text size in translation](https://www.w3.org/International/articles/article-text-size)：键盘、减少动效、双语。
  - Chameleon：[2025](https://www.chameleon.io/benchmark-report)、[2024](https://www.chameleon.io/benchmark-report-24)、[2019](https://www.chameleon.io/blog/product-tour-benchmarks-highlights)：导览步数和完成率（厂商数据）。
  - 社区 skill 和厂商文章：[rshankras](https://github.com/rshankras/claude-code-apple-skills/blob/main/skills/generators/onboarding-generator/SKILL.md)、[Owl-Listener](https://github.com/Owl-Listener/designer-skills/blob/main/interaction-design/skills/onboarding-design/SKILL.md)、[coreyhaines31](https://github.com/coreyhaines31/marketingskills/blob/main/skills/onboarding/SKILL.md)、[impeccable onboard.md](https://github.com/pbakaus/impeccable/blob/main/skill/reference/onboard.md)、[hig-patterns](https://github.com/raintree-technology/apple-hig-skills/blob/main/skills/hig-patterns/SKILL.md)、[Frigade](https://frigade.com/blog/onboarding-tours-break)：引导 skill 的结构、引导的维护。
