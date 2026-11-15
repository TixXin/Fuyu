---
name: fuyu-skill-writing
description: >
  ALWAYS invoke BEFORE writing or editing a Fuyu agent instruction file: any SKILL.md under
  .claude/skills/, or AGENTS.md, src/AGENTS.md, src-tauri/AGENTS.md, including a small edit to an
  existing one (adding one rule, fixing one line, tweaking a description). Do NOT create or change a
  skill without loading this skill first. Do NOT invoke for ordinary docs, research, task files or README.
  触发：写个 skill、加个 skill、改一下 skill、把这个流程做成 skill、沉淀成 skill、调 description、
  skill 没触发、AGENTS.md 加一条、把规则写进 AGENTS.md、规则文件瘦身、这条规则该放哪。
---

# 写或改 skill 和规则文件

管 `.claude/skills/*/SKILL.md` 和三份 `AGENTS.md`（根、`src/`、`src-tauri/`）。做完的标准：一个没见过这次对话的会话只带这份文件就能做对；删掉其中任何一句，它都会少知道一件影响做法的事。

## 顺序

1. **先分流，多数内容不该进 skill。** 程序能判断对错的、每次都必须成立的，做成检查、脚本或钩子，文字会被跳过。每个会话都要守、一句话说得清的进根 `AGENTS.md`；只和一个目录有关的进那个目录的 `AGENTS.md`（它不会自动加载，「改这里前先加载某个 skill」这类指针放根文件或交给钩子）；背景、数值、现状进 `docs/`，skill 只指过去。剩下的才写成 skill：只有一部分任务要用，步骤多，带本仓库特有的命令和坑。形态已经定成 skill 时，也用这一步挑出正文里该放到别处的句子。
2. **查已有的**：`ls .claude/skills`，读触发条件相近的那个。触发条件相同就改已有的，有新的触发条件才新建：skill 清单有预算，超了先丢用得少的 skill 的描述。
3. **读目标文件和它上层的规则文件**，找重复和冲突。一个意思只写一处：代码、配置或 `--help` 查得到的不写，抄来的那份迟早和原处对不上。规则本体在别处的流程，动作留半句加原因，细节（格式、数字、清单）指过去：全指过去只剩一页链接，照抄又成了复制。指向仓库里的文件时写从仓库根起的路径加节名（`docs/architecture/workflow.md`「Rust 构建」），不写相对 skill 目录的链接，agent 的工作目录是仓库根。
4. **写 `description`（见下一节），再写正文**：只留会改变 agent 决定的规则、流程、边界和坑。做完的标准和最容易丢的那一步放最前，上下文压缩后加载过的 skill 只留开头。步骤只排 agent 自己做不对或顺序不能错的，其余给目标和约束。命令的路径从仓库根写，参数用 `<…>` 占位，仓库名这类固定的值写死。每个坑带半句原因，没有原因的规则遇到没写到的情况没法类推；原因查不到就写是用户定的，不自己推一个。
5. **少数分支才用到的内容**放同目录的 `references/`，正文写明什么情况读哪一份；没有这种内容就不建目录。
6. **不写的内容和去处**：进展和交接进任务文件（`pnpm tasks note <编号> "<内容>"`）；修复经过、为什么这样定进提交说明和 PR；日期、issue 编号、哪一次踩的坑都不留，它们不改变下一个会话怎么做。
7. **看能不能配钩子**：该加载的时刻认得出动作（写某些路径、跑某类命令、调某个工具）就能配，往 `scripts/gate/rules.mjs` 加一行，`tests/scripts/gate.test.mjs` 加一条。`description` 里的动作要和这一行认的路径、命令对得上，不然被拦下的会话看不出这个 skill 和手上的事有什么关系。要看内容或意图才知道该不该用的不配：每一行都会偶尔误拦，都要人维护。配了钩子的 skill 不能设成只能由用户调用（`disable-model-invocation: true`），被拦下的会话加载不了它，流程卡死。
8. **试做再提交**：新建的或改了流程的 skill，由一个全新会话只带着它做一个真实任务，对照步骤看它实际做了什么；走偏的地方改 skill，不靠简报补。没人审、没试做的自生成 skill 实测比不带 skill 还差。没定稿的草稿放在仓库外：文件一进 `.claude/skills/`，这份工作区上新开的会话就会看到并照它做。

## `description`

- 它是唯一的路由入口：skill 没加载时 agent 只读得到这一段，「什么时候用」写在正文里等于没写。frontmatter 只用 `name`（和目录同名）和 `description`，别的字段换一个 agent 多半不认。
- 骨架用英文祈使句加否定约束。动手前必须加载的：`ALWAYS invoke BEFORE <动作>. Do NOT <动作> without loading this skill first.`；容易误触发的：`Use ONLY when <条件>. Do NOT invoke for <反例>.`
- 明说改已有的、小修一处也算（`including a small fix to …`）。漏加载多出在这一类：只写「新建」「接入」，agent 会认为改一行不算。
- 触发词用中文，照用户实际会说的话写（「某家没显示」），不用功能的正式名称。
- 只写什么时候用，不写步骤：读到流程摘要的 agent 会照摘要做，不再读正文。最要紧的用例放最前，总长不超过 1,024 字符。

## 提交前自查

- 路由：拿三句用户会说的话（其中一句是小修）对 `description`，都该命中；再拿一句沾边但不归它管的，不该命中。
- 正文：不依赖写它的这次对话；提到的路径、命令和 skill 名都存在。同一批里还没合入的，在任务交接里点名，合入前再核对一次。
- 逐句问「删掉它 agent 会不会做错」，不会就删。改规则文件也这样查：根 `AGENTS.md` 每一行每个会话都要读，还有 Codex 的 32 KiB 上限，加之前 `wc -c AGENTS.md`。

改写自 ShengLin1001 的 [p-agent-doc-writing](https://github.com/ShengLin1001/codex-config/blob/main/skills-using/root/p-agent-doc-writing/SKILL.md)。
