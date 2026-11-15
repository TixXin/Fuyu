# 会话的层级、分组和命名

> 日期：2026-11-15。问题：一个主会话开「任务主 agent」，主 agent 再派子会话，这样形成三层会话，侧边栏里第三层没法展开收起；会话名字也乱。用户想要 5～10 个只用来聊天的主会话，由它们按要求开任务主 agent、再派子会话，不同层级的会话名字也要能区分开。该怎么组织？
> 范围：Claude Code 官方文档（desktop、agent teams）、anthropics/claude-code 的 GitHub issue、同类工具（Conductor、Claude Squad、Vibe Kanban、Cursor subagents）和多 agent 层级的实践文章；本机 app 自带的侧边栏和会话工具（`list_sections`、`move_sessions`、`start_session`）。关键词：nested sessions sidebar、session groups、agent teams lead、orchestrator worker depth。

## 结论

1. **限制来自 app，不在我们的流程里。** 侧边栏按「谁开了谁」把会话挂成一棵树，看截图只有最上面一层能折叠。自定义分组也只有一层：分组里不能再套分组（[#93058](https://github.com/anthropics/claude-code/issues/93058)），这个需求官方还没回应，也没排期。所以「主会话 → 任务主 agent → 子会话」三层的结构，在现在的侧边栏里怎么排，第三层都收不起来。
2. **业内的共识是两层就够。** 一层统筹，一层干活：Anthropic 自己的研究系统、Claude Code 的 agent teams（一个 lead 带若干 teammate，teammate 不能再开下一级）、Cursor 都是这样。Cursor 的 subagent 最多只能嵌套两级，社区经验是平铺派发最稳。层级越深，token、延迟和排查成本越高。
3. **建议：主会话兼做任务主 agent，侧边栏只留两层；再用「分区」把 5～10 个主会话分开。**
   - **分区**：每个领域一个，分区可以整个折叠，用来区分不同的主会话。
   - **主会话**：每个分区里一个，由你自己新建，长期存在。它只聊天、规划、派会话、检查、合入，不写代码，等于现在的「任务主 agent」。只是它不再由别的会话开出来，而是你直接开。
   - **任务会话**：由主会话派出，挂在主会话下面，是第二层，跟着主会话一起折叠。做完就归档（fuyu-lead 收口这一步已经写好了）。
   - **总控**（就是现在这个会话）：在分区「总控」里。负责分 issue、整批合入、拦发版，有事用消息转给对应领域的主会话，**不再自己开主 agent**。这一点是两层能成立的关键：如果总控也开会话，就又多出一层。
4. **命名按角色加固定前缀**，在侧边栏一眼能分出层级和类型（细则见下面「命名」一节）。

还要你确认的一件事：一个会话被移到另一个分区、而开它的会话不在那个分区时，侧边栏会把它显示成那个分区里的顶层，还是仍然挂在原来的会话下面？文档里没写。这件事决定了现有的主 agent 能不能直接搬进分区，还是要按新做法重开，见「迁移」一节。

## 详细

### 现在的问题出在哪

- 现在的结构是：总控（Issue triage and routing）开主 agent，主 agent 再派子会话，一共三层，第三层收不起来。用户截图里，「消息与小功能主 agent」下面的 C72、C80 等就收不起来。
- 主会话、主 agent、子会话的名字看不出谁是谁。有的写「主 agent：…」，有的写任务编号，有的是一句话，还有英文。
- 做完的会话不归档。2026-11-15 一次清理就归档了 49 个；`fuyu-lead` 收口时归档子会话这一步已经加上，提交是 3af16261。

### app 能做什么（本机工具和文档）

- **分区（section）**：侧边栏现在是分区布局。内置的有「置顶」「定时任务」「会话」三个分区，可以新建自定义分区，用 `create_section`。每个分区能单独折叠、单独设排序（按最近、按名字、按创建时间），会话用 `move_sessions` 归进分区。分区里不能再套分区。
- **会话树**：`start_session` 开出来的会话记着是谁开的，侧边栏把它挂在开它的会话下面。官方文档原话是「侧边栏把开出来的会话列在当前会话下面」（the sidebar lists the started session under the current session），没写能挂几层、能不能折叠。
- **自动归档**：可以设成闲置 N 天后自动归档，现在是 2 天。也可以设成 PR 合入时归档，但我们是整批合入，不按会话开 PR，这个用不上。

### 别人怎么做

| 做法 | 层级 | 怎么分组 | 怎么命名 |
|---|---|---|---|
| Claude Code agent teams（实验功能） | 一个 lead 加若干 teammate，两层；teammate 不能再开下一级 | 一个团队一份共享任务清单 | 团队名，加任务清单里的任务 |
| Anthropic 的研究系统（orchestrator-worker） | 一个 lead agent 并行派多个 subagent，两层 | 不适用 | 不适用 |
| Cursor subagents | 最多到第二级；社区经验是平铺派发最稳 | 不适用 | 不适用 |
| Conductor、Claude Squad | 平铺，每个任务一个工作区（worktree） | 按仓库 | 用任务对应的分支名，例如 `feature-auth`、`bugfix-123` |
| Vibe Kanban | 平铺，一张卡片一个 agent | 看板的列（待做、进行中、完成） | 卡片标题 |
| 侧边栏「分组里再分组」的需求（#93058） | 想要多层分组 | 讨论里的变通做法：标题加路径前缀（`auth/login`），或者按主题建顶层分组 | 路径前缀；有人说这两种分组会互相打架，最后放弃了 |

一篇实践文章建议一个统筹者同时管的任务不超过 8 个，不然统筹者本身就成了瓶颈；这和「每个分区一个主会话，同时开 6 个左右改代码的会话」的现行规则对得上。

### 建议的结构

```text
分区「◆ 总控」
  总控（分 issue、整批合入、拦发版；只发消息，不开会话）
分区「插件平台」
  ◆ 插件平台                  ← 主会话，你开的，长期存在
    E36.3.18 翻译入口不收 baseUrl  ← 任务会话，主会话派的，做完归档
    E36.3.19 正式版不认开发来源
分区「Agent 页」
  ◆ Agent 页
    B52 接入 Kimi Code CLI
……（5～10 个分区）
```

- 分区建议按长期领域划分，不按一次性的主题划分。例如：总控、插件平台、Agent 页、岛外观、消息与小功能、剪贴板与音乐、Mac 适配、发版与流程。要几个由你定，数量多了只是多几个折叠的标题。
- 主会话对话变得很长时，在同一个分区里新开一个，把旧的归档。交接靠任务文件和计划文件，不靠对话。
- 一件事很大、要分好几批做时，主会话先写计划文件，按阶段一批批派任务会话。不另开一个「这件事的主 agent」，那样又变成三层。
- 只读的调研、查资料，主会话优先用后台子代理（Agent 工具）做，子代理不进侧边栏。要你能看到、能插手的工作才开任务会话。

### 命名

| 角色 | 标题格式 | 例子 | 会话短名（`name`） |
|---|---|---|---|
| 分区 | 领域名，总控加「◆」排第一 | 「◆ 总控」「插件平台」 | 不适用 |
| 主会话 | 「◆ <领域>」 | 「◆ 插件平台」 | 你开的会话没有短名 |
| 任务会话 | 「<任务编号> <一句话>」 | 「C72 待办颜色和优先级」 | 任务编号，点换成短横线，例如 `c72`、`e36-3-18` |
| 等你挑方案的会话 | 「预览：<主题>」或「调研：<主题>」 | 「预览：岛的三种形态」 | 例如 `c65-preview` |
| 排查（还没有任务编号） | 「排查：<现象>」 | 「排查：Mac 更新后卡在重启」 | 例如 `mac-restart` |

- 标题都用中文，任务编号和英文专有名词照原样写。
- 把分区的排序设成「按名字」，「◆」开头的主会话就会固定在最上面。

### 迁移

1. **先做一个一分钟的实验**：建一个测试分区，把一个空闲的主 agent（比如「消息与小功能主 agent」）连同它的子会话移进去，你看一眼侧边栏：它在分区里是变成顶层、带着子会话能折叠，还是仍然挂在总控下面。结果写回这份文档。
2. **如果实验结果是能变成顶层**：现有的主 agent 直接移进对应的分区，每个就成了这个分区的主会话，名字改成「◆ <领域>」；以后新的主会话由你自己开。
3. **如果实验结果是仍然挂在原来的会话下面**：现有的主 agent 做完手上的事就归档；每个分区由你新开一个主会话，第一条消息让它读这份文档和 `fuyu-lead`。
4. 改 `fuyu-lead`：开主 agent 的那一节，改成「总控把需求转给对应分区的主会话」；主会话直接派任务会话，不再开中间那一层。
5. 自动归档从闲置 2 天改成 1 天，兜住漏掉没归档的。

## 来源

- Claude Code 官方文档：desktop（会话、并行工作、归档、自动归档）<https://code.claude.com/docs/en/desktop>
- Claude Code 官方文档：agent teams（一个 lead 加若干 teammate，实验功能）<https://code.claude.com/docs/en/agent-teams>
- anthropics/claude-code #93058：侧边栏的分组不能嵌套，2026-11-15 时官方没有回应，#107889 已作为它的重复关闭 <https://github.com/anthropics/claude-code/issues/93058>
- 桌面版重设计的官方文章（侧边栏、按项目分组、PR 合入后自动归档）<https://claude.com/resources/articles/claude-code-desktop-redesign>
- 开出来的会话挂在父会话下面、做完向父会话汇报（第三方文章）<https://www.mindstudio.ai/blog/claude-code-3-0-parallel-sessions>
- Cursor 的 subagent 嵌套层数（社区论坛，引用了官方 FAQ）<https://forum.cursor.com/t/official-nesting-depth-for-subagents-how-deep-is-reliable-in-current-cursor/167883>
- 递归和平铺子代理的取舍（实践文章）<https://agentpatterns.ai/patterns/multi-agent/recursive-sub-agent-delegation-depth/>
- 并行编程 agent 工具汇总（Conductor、Claude Squad、Vibe Kanban）<https://dev.to/stravukarl/best-tools-for-managing-parallel-ai-coding-agents-in-2026-14l8>、<https://github.com/andyrewlee/awesome-agent-orchestrators>
- 多 agent 编程的实践（每个统筹者管的任务不超过 8 个）<https://addyosmani.com/blog/code-agent-orchestra/>（这个数字来自搜索摘要，原文未核实）
