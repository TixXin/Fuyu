# Skill 与规则第一批：计划

> 2026-11-15，主 agent 整理，用户当天确认按建议执行（见最后一节）。依据是 [project-skills.md](../research/project-skills.md)（结论第 2–5、7 点）和当天在本机会话记录上补量的几个数。第 5–7 节来自协作者 ShengLin1001 看过调研后提的三条意见。任务：F42–F46、F48、F49。全部做完后这份文件移到 `history/`。

## 结论

原来的四项建议都做；协作者 ShengLin1001 看过调研后提的三条意见并进来，多出两项（F48、F49），并扩大了门禁那张表（见第 5–7 节）。一共 6 个子会话，分三步，都只动脚本和文档，不编译 Rust。

| 任务 | 做什么 | 子会话 | 哪一步 |
|---|---|---|---|
| F42 | 门禁钩子改成一张表；加两条：改 `src/`、`src-tauri/` 前要读过对应的规则文件；再给各个 skill 配上能配的行 | `gate-table` | 第一步开始，做得最久 |
| F48 | 写 skill 和规则文件用的 skill（改写自协作者的 `p-agent-doc-writing`） | `skill-writing` | 第一步 |
| F49 | `doc-preview` 搬进仓库 | `doc-preview-move` | 第一步 |
| F43 | `fuyu-task` skill：做一个任务从认领到关 issue 的顺序清单 | `task-skill` | 第二步，带着 F48 的草稿写（这就是 F48 的试做） |
| F44 | `pnpm mq:commit-part`：同一个文件里只提交自己的改动 | `commit-part` | 第三步，带着 F43 的草稿试做 |
| F45 | `pnpm progress`：一屏的进度汇总 | `progress` | 第三步，带着 F43 的草稿试做 |
| F46 | Windows 上的实测清单（只建任务和 issue，留给 Windows 那台机器的会话） | 无 | 收口时建 |

F47 留给「机器名会变」那张卡片，见「顺带发现」。

- F44、F45 就是 `fuyu-task` 的试做：这两个会话的简报只写「加载 `fuyu-task`、做哪个任务」，不再抄那一长段约束。F42 用老办法写简报，正好当对照。
- 根 `AGENTS.md` 只由主 agent 在最后改一次，子会话都不碰它。
- 「和用户说话用中文」那一行现在本地和 `origin/main` 的 `AGENTS.md` 里都还没有。这一项归原会话，我没有动；你要是已经答应了，可以让我在最后改根文件时一起加上，省得两个会话都改这份文件。

## 今天补量的事实

统计脚本是我临时写的，读这台 Mac 上 119 份会话记录（调研时是 98 份），Bash 里的写入靠正则识别，数字是近似值。

| 事实 | 数字 | 对方案的影响 |
|---|---|---|
| 写过 `src/` 的会话怎么写文件 | 53 个里：只用 Edit / Write 的 8 个，只用 Bash 的 27 个，两种都用的 18 个；6 个用内联 python 写 | 门禁只拦 Edit / Write 的话，一半会话拦不到，Bash 的识别是主要工作量 |
| 写过 `src-tauri/` 的会话 | 43 个里：只用工具 20 个，只用 Bash 8 个，都用 15 个 | 同上 |
| 规则文件是怎么被读到的 | 没有一次用 Read 工具，全是 Bash 里 `cat`、`sed -n`；`src/AGENTS.md` 53 个里 19 个读过，`src-tauri/AGENTS.md` 43 个里 12 个读过 | 「读过」必须认 Bash 里的读法 |
| 子目录规则文件的自动加载 | 会话记录里自动加载的只有根 `AGENTS.md`（198 次）和本机记忆（9 次），子目录的 0 次 | 和调研一致，不能指望自动加载 |
| 手写 `GIT_INDEX_FILE` | 19 个会话、72 条命令（调研时 14 个、48 次） | 还在涨 |
| 手写时怎么提交 | 36 条用临时索引直接 `git commit`，8 条用 `commit-tree`；同一条命令里核对了 `HEAD` 有没有变的 13 条，把共用索引对齐了的 18 条（后面另起一条命令补做的没有统计） | 见第 3 节的两个风险 |
| 根 `AGENTS.md` 的大小 | 本地 30,923 字节，Codex 的上限是 32,768 字节，还剩 1,845 字节 | 这次要加的几行约 1,000 字节，加完就快到顶，见第 2 节的瘦身建议 |
| 钩子能不能直接把规则文件塞进上下文 | 官方文档：钩子给模型的附加内容上限 10,000 字符，超出只留 2,000 字符的预览；两份规则文件是 16,834 和 24,491 字节 | 不能直接注入，只能拦下来让会话自己去读 |
| 子代理触发钩子时 | 官方文档：钩子照样触发，输入里带 `agent_id`；子代理自己的记录在 `<会话>/subagents/agent-<id>.jsonl`（文档在 SubagentStop 一节写的，本机目录也是这样）。PreToolUse 里的 `transcript_path` 指的是不是主会话那份，实现时打一次真实输入确认 | 「读过」和「拦一次」按（会话，子代理）分别算 |
| 这台机器现在的负载 | 19 个会话在线，8 个在忙；工作区 128 个没提交的文件；本地 `main` 领先 16、落后 61 | 我这边同时最多 3 个写代码的会话，机器还是这么忙就改成一次 2 个 |

## 1. 按表配置的门禁（F42）

**现在**：`scripts/agent-harness-gate.mjs` 只管一件事：第一次改二十几个 agent 接入点文件、而会话还没加载 `fuyu-agent-harness` 时，拦一次。

**改成**：一个引擎加一张表，放在 `scripts/gate/`。表里一行写四样：管哪些路径（目录或文件，可以排除子目录）、要求什么（读过某个规则文件，或加载过某个 skill）、Bash 命令怎么认（见下）、提示里的半句话。给各个 skill 配钩子时，「什么时候拦」还要多认两种（跑某类命令、调某个工具），见第 6 节。

| 行 | 路径 | 要求 |
|---|---|---|
| 现有的一行，行为不变 | 那二十几个接入点文件，加上新建的 `agent_status/*.rs` | 加载过 `fuyu-agent-harness` |
| 新增 | `src/` | 读过 `src/AGENTS.md` |
| 新增 | `src-tauri/`（不含 `target/`、`gen/`） | 读过 `src-tauri/AGENTS.md` |
| 以后的界面 skill、引导 skill（这次不做） | 例如 `src/windows/onboarding/` | 加载过对应的 skill；到时候往表里加一行、测试里加一条 |

**「读过」怎么判断**：看会话记录（子代理看它自己的那份），下面任一条成立就算。

- 有一次 Read 工具调用，路径解析后正是这份规则文件；
- 有一条 Bash / PowerShell 命令，用读文件的命令（`cat`、`head`、`tail`、`sed`、`less`、`bat`、`nl`、`awk`、`Get-Content`）带着这个路径；`wc`、`ls`、`grep`、`git add` 不算；
- 记录里有这份文件被自动加载的附件。

根 `AGENTS.md` 的正文里本来就提到这两个路径，所以不能只在记录里搜字符串，要解析到工具调用这一层。不判断读了多少行：读了前 5 行也算。

**每个会话只拦一次**：沿用现在的做法，在临时目录里按（会话，子代理，规则）各放一个标记文件。第一次碰到某条规则时查一次会话记录：读过就记下、放行，以后不再查；没读过就记下、拦这一次，提示去读，重做时放行。一次操作同时碰到两条规则（例如改 `src/features/agent-status/status.ts`）时合成一条提示，只拦一次。会话记录最大的有 60 MB，所以每条规则只查一次。

**Bash 里写文件拦不拦得到**：

| 写法 | 拦得到吗 |
|---|---|
| Edit、Write、MultiEdit、NotebookEdit | 一定拦得到 |
| 重定向和 heredoc（`cat > src/x.ts <<'EOF'`）、`tee`、`sed -i`、`perl -i`、`mv` / `cp` 的目的地、PowerShell 的 `Set-Content` 这一类 | 拦得到，认的是写入的目标路径，不是命令里提没提到 `src/` |
| 内联的 python、node（`python3 - <<'PY'`、`node -e`）里有写文件的调用，路径写在代码或参数里，包括同一条命令里先赋给变量的 | 拦得到 |
| 内联的补丁（`git apply` 后面跟 heredoc） | 拦得到，读补丁里的 `+++ b/…` |
| 跑一个现成的脚本文件去改（`python fix.py`、`node scripts/x.mjs`）、运行时拼出来的路径、`pnpm settings:index` 这类生成命令 | 拦不到 |

只读的命令不会被误拦：`rg foo src/ > /tmp/out.txt` 写的是 `/tmp`。现有那一行保持原来的认法（命令里有写入的迹象并且提到了那个文件），所以原来的三条测试原样通过。

**验收里加一步回放**：拿新门禁的识别逻辑过一遍本机的会话记录，报告每个写过 `src/`、`src-tauri/` 的会话会在哪条命令上第一次被拦、漏掉几个、误拦的例子有哪些，数字记进任务。

**怎么上线**：钩子直接跑工作区里的脚本，所有会话共用。新门禁在 `scripts/gate/` 下开发，开发期间不接线；测试和回放都过了、主 agent 看过 diff，最后一步才改 `.claude/settings.json` 指过去。旧路径留一个只做转发的小文件，免得还没刷新配置的会话每次工具调用都报「脚本不存在」，过一周删。会话环境里设 `FUYU_GATE=off` 可以整个关掉。

**接线那一刻的影响**：这台机器上正在跑的会话，下一次改 `src/` 或 `src-tauri/` 时各被拦一次，被要求读 1.7 万或 2.4 万字节的规则文件。这是想要的效果，但会同时发生在二十来个会话上。

**管不到的**：钩子只对 Claude Code 生效，Codex、opencode 的会话靠根文件开头那两句话。上下文压缩之后规则不在上下文里了，这次不重新拦。

## 2. `fuyu-task` skill（F43）

**形态**：`.claude/skills/fuyu-task/SKILL.md`，60–80 行。只排顺序、列判断和坑，规则本体仍在 `docs/tasks/README.md` 和 `workflow.md`，skill 里不复制。按「Skill 编写规范」和调研第 5 点的补充写：开头是做完的标准，每个坑带半句原因，命令写成能直接执行的。

**骨架**：

- 做完的标准（放最前面）：提交在 `main` 上（PR 已合入）；任务在 `0-archive/` 并记了提交；issue 有完成回复并已关闭；没测到的进了实测清单。缺一样都不算做完。
- 顺序十步：
  1. 看任务，先查重：`pnpm tasks show`，`pnpm issue` 里有没有同一件事。没有任务的先提 issue 再建。
  2. 认领并写全 `--scope`。漏写的文件会在 `pnpm tasks dirty` 里变成没人认领。
  3. 动手前在 issue 下回复：谁接手、核实结果、打算怎么改。
  4. 查冲突：`git status --short`、`pnpm tasks conflicts`；要改哪个目录就先读那个目录的规则文件。
  5. 改。热点文件改完就单独提交；同一个文件里有别人的改动用 `pnpm mq:commit-part`；不 stash、不 reset、不 checkout。
  6. 按改动范围验证。`cargo` 写成 `pnpm heavy -- …`，长命令放后台；别人没提交的改动让检查失败时写明，不去改别人的文件。
  7. `pnpm tasks done <编号> --commit "<标题>"`，和功能改动进同一个提交。标题差一个字 land 就过不了。
  8. land：被主 agent 派来的不自己 land，把提交号报给主 agent；独立的会话按 workflow.md 攒批 `pnpm mq:land`，后台 `pnpm mq:wait`。
  9. 合入后在 issue 下回复改了什么、列出提交，再 `gh issue close`。不用 `Closes #N`，它会在完成回复之前就把 issue 关掉。
  10. 本机测不了的列进实测清单。
- 停下或做不完：`pnpm tasks note`，写清哪些没提交的文件是自己的；不做了就 `pnpm tasks release`。

第 5、第 9 步提到的命令（`mq:commit-part`、`pnpm progress`）以你确认要做的为准，没做的那一行不写。

**同一个任务里一起改的**：

- `fuyu-lead` 第 2 节第 4 条那一长段约束缩成一句：「每个子会话的简报开头写：先加载 `fuyu-task` 并照它做；后面只写这次特有的：认领哪个任务、`--scope`、怎样算做完、跑哪些验证、由主 agent 整批 land」。第 5 条加一句：用户问进度先跑 `pnpm progress`。开头「2026-11-14 在 #349 上第一次这样用」那句历史按编写规范删掉。
- `docs/tasks/README.md`「流程」一节加一句指向 skill。

**试做**：草稿先写在共享笔记目录里，主 agent 看过再放进 `.claude/skills/`。原因是文件一出现在那里，这台机器上新开的会话都会看到这个 skill。然后 F44、F45 两个全新会话带着它各做一个真实任务。我对着上面十步逐条核对它们实际做了什么（看提交、issue 上的回复和会话记录），把走偏的地方发回 `task-skill` 会话改，改完才提交。两次试做里有一步明显走偏、改一次还不行的，这个 skill 先不签入，我回来告诉你卡在哪。

**根 `AGENTS.md`**（动它要你点头，下面只是建议）：

必须加的（约 1,000 字节）：靠前的位置加一行「做 `docs/tasks` 里的任务或处理 issue：先看 `docs/tasks/README.md`，Claude Code 会话加载 `fuyu-task` skill」；命令表加 `pnpm mq:commit-part`、`pnpm progress` 两行；目录总览里门禁脚本的名字改掉。

可以缩成指针的段落：

| 段落 | 现在 | 建议 | 大约省 |
|---|---|---|---|
| a.「文档」一节里和任务有关的 7 条（任务、认领、新建任务要有 issue、GitHub issue、GitHub PR、交接、会话之间的消息） | 2,556 字节 | 缩成 3 行：规则在哪；必须遵守的几条护栏各半句（认领写 `--as` 和 `--scope`、带 issue 的先回复后动手、合入后回复并关闭、新任务先提 issue、交接写任务文件）；会话之间的消息那条原样留着 | 1,800 字节 |
| b.「Git 与协作」里改写历史的例外（去掉 Claude 署名行的整套步骤） | 631 字节 | 步骤搬到 `workflow.md`，根文件留一句 | 500 字节 |
| c.「重任务排队」「没提交的文件」两条 | 1,024 字节 | 各留一句规则，数字、文件清单和日期指向 `workflow.md` | 600 字节 |
| d.「其他协作者和外部贡献者」里 fork 网络的历史说明 | 618 字节 | 搬到 `workflow.md`「外部 PR」 | 350 字节 |

建议这次做 a 和 b：这两段正是流程，流程进了 skill 和 `workflow.md`，根文件留护栏，加完新行以后反而比现在小 1,300 字节左右。c、d 是规则居多，先不动。护栏不能删光：Codex 的会话读不到 `.claude/skills/`，只能靠根文件和 `docs/tasks/README.md`。

## 3. `pnpm mq:commit-part`（F44）

**为什么不只是省事**。现在的手写做法里有两个风险，都是照 git 的行为推出来的，我没有去历史里找实例：

- 用临时索引直接 `git commit`（72 条里的 36 条）：`read-tree HEAD` 之后别的会话提交了，这次提交的内容是照旧 `HEAD` 搭的，会把那个提交的改动整个冲回去，没有任何提示。同一条命令里先核对 `HEAD` 的只有 13 条。
- 提交后不对齐共用索引（同一条命令里对齐了的只有 18 条）：共用索引里那个文件还停在旧内容，`git status` 显示成一处「已暂存的反向改动」。`git merge` 要求索引和 `HEAD` 一致，所以这可能也是本地 `main` 跟不上 `origin/main` 的原因之一。

**接口**。会话记录里指明「哪些是我的」有三种写法，命令各给一个入口：

```
pnpm mq:commit-part --list <文件…>
    列出这些文件相对 HEAD 的每一处改动，每处一个短编号和开头两行

pnpm mq:commit-part -m "<标题>" [-F <说明文件>]
    --take <文件>:<编号,编号…>     只带这几处
    --match <文件>:<正则>          只带新增或删除的行匹配正则的那几处
    --as <文件>=<准备好的文件>      两个人的改动挨在一起、分不开时，直接给出要提交的内容
    -- <整个文件…>                 这些文件整个带上，新增、删除、改名的两头都算
    [--dry-run]                    只显示会提交什么
```

- 编号按那一处改动的内容算，不按行号。列出之后别人又改了这个文件，编号也不会指错地方：还在就照带，不在了就拒绝并重新列出。
- 「一处」按 `git diff -U0` 的最小块算，两个人隔开一行以上的改动就能分开。
- 一条总的保险：这次提交相对 `HEAD` 的每一行增删，都必须是工作区相对 `HEAD` 的增删里已有的。`--as` 给的内容如果是照旧版本准备的，会删掉 `HEAD` 里有、工作区里也还在的行，这时拒绝。
- 一次提交里可以混着带：几个整文件加几个文件的一部分。「`tasks done` 和功能改动进同一个提交」正是这种情况。

**做法**：全在仓库内部完成。私有的临时索引里搭好树，`commit-tree` 生成提交，再用带旧值核对的 `update-ref` 推进分支。工作区不动。

**`HEAD` 中途被别的会话推进**：`update-ref` 核对旧值，对不上就不写，然后照新的 `HEAD` 从头重来，最多 3 次。重来时自己的那几处如果已经在 `HEAD` 里了（别人把整个文件提交了），就照实说「已经在 `<提交>` 里」，不再重复提交。

**提交后共用索引怎么对齐**：对这次提交涉及的每个路径做 `git reset -q -- <路径>`，只动索引，不动工作区。整文件对齐后就是干净的；只带了一部分的文件，别人的改动照旧显示为没暂存的修改。索引被别的 git 进程锁着时重试几次，还不行就打印那条命令，提交本身已经成功。

**和两个 git 钩子的关系**：

- `commit-tree` 不触发钩子。`pre-commit` 只检查「在 `main` 上提交要写文件名」，这个命令每次都点名了路径，不需要它。
- `commit-msg` 拒绝 Claude 署名行，这条要保住：提交前用 `git hook run commit-msg` 把说明过一遍，不另抄一份正则。
- `pre-commit` 的拒绝提示里加一行指向这个命令；看到有人用自定义的 `GIT_INDEX_FILE` 提交时，打印一句不拦人的提醒。

**测试**（`tests/scripts/mq-commit-part.test.mjs`，照 `mq.test.mjs` 在临时仓库里跑，开头去掉 `GIT_*` 变量并确认 git 指向临时仓库）：

- 一个文件里两个会话各改一处，只带一处：新提交里只有那一处，工作区两处都在，共用索引和新 `HEAD` 一致；
- 整文件和部分文件混在一个提交里，含新增、删除和改名；
- 搭好树之后、写分支之前，另一个提交先落下：重来后两边的改动都在，没有谁被冲掉；
- 编号对不上、`--as` 的内容照旧版本准备、说明里带 Claude 署名行、什么都没选中：都拒绝，分支不动；
- 别人暂存过的其他文件不受影响；文件末尾没有换行、改第一行、纯删除这几种边界。

**文档**：`workflow.md`「现在怎么做」第 2 条和「没提交的文件」各加一句；根 `AGENTS.md` 的命令表由主 agent 加。

## 4. `pnpm progress`（F45）

**现有命令能给什么，缺什么**：

| 要说清的 | 现在 | 缺的 |
|---|---|---|
| 进行中的任务和负责的会话 | `pnpm tasks` 有，但连同所有没结束的任务一起列，今天是 188 行 | 只看进行中的一段 |
| 本地没推的提交 | `pnpm mq:pending` 有标题和「该不该提 PR」 | 领先落后各多少（今天是领先 16、落后 61，它没说） |
| 没提交的文件落在哪个任务的范围里 | `pnpm tasks dirty` 有，今天 74 行 | 一行的小结 |
| 开着的 PR | 没有任何命令列 | 整段 |
| 标了完成但 issue 还开着 | `pnpm issue` 每行带任务状态，但要在 80 行里自己找 | 筛出来，并说清是「已合入、可以关」还是「还没合入」 |

**新命令**：`scripts/progress/`，只读，把上面五样压成一屏，每段给总数和前几行，细节指向原来的命令。按今天的数据大致是这样：

```
进行中 11 项
  C78       break-reminders · tixxindemacbook-air   没提交 52 个   #333
  C80       voice-input · tixxindeair               没提交 63 个   #335   有交接
  E36.3.3   v3-rust-channel · tixxindemacbook-air   没提交 16 个   #467
  …
没提交的文件 128 个：热点 8，没人认领 12，超过 3 小时没动 17，已暂存 18（pnpm tasks dirty）
没推的提交 5 个，最早的 3 小时前，该提 PR 了；本地 main 落后 origin/main 61 个提交（pnpm mq:sync）
  feat(plugin-manifest): v3 manifest rules, .fuyu packages, digest and signatures (E36.5.1)
  …
开着的 PR 2 个
  #498 land/…-only-166af15   自动合并已开 · 等检查
  #493 land/…-only-5d0685e   自动合并已开 · 落后于 main
任务已完成、issue 还开着 2 个
  #425 E36.2.2   还没合入（在 #493 里）
  #391 B43       还没合入
等你的 5 项（pnpm tasks）
```

- 「负责的会话」是任务文件里的会话名和机器名，照原样显示，不分「本机」和「另一台机器」：机器名今天在这台 Mac 上就出现过两个，见「顺带发现」。这个会话现在是不是还活着，脚本看不到，由主 agent 用 ListAgents 补，这一句写进 `fuyu-lead`。
- 「任务已完成、issue 还开着」这一段我写计划的四十分钟里从 10 个降到了 2 个：那一批合入后有人统一关了 8 个。说明现在靠的是有人记得回头关。
- 「已合入」的判断：`origin/main` 上的任务文件是不是已完成。
- `--no-github` 跳过要联网的两段；`gh` 取不到时照样打印本地的部分并说明原因。`--json` 给脚本用。

**顺带补两处提醒**，对的是「回复过 issue 的会话 68 个，关过的只有 14 个」：

- `pnpm mq:wait` 等到合入时，打印这一批里完成的任务还有哪些 issue 开着。这时候等着的会话还活着。
- `pnpm tasks done` 在任务带 issue 时提醒一句「合入后回复并关闭 #N」。认领时已经有类似的提醒。

**测试**（`tests/scripts/progress.test.mjs`）：汇总逻辑是纯函数，喂假的任务、提交、PR、issue 数据核对输出；已合入和没合入两种；`gh` 失败时的输出。

**文档**：`docs/tasks/README.md`「先跑这几条」加一行。

## 5. 写 skill 用的 skill（F48，协作者的第 1 条）

**来源**：ShengLin1001 的 `p-agent-doc-writing`（他的 `codex-config` 仓库，SKILL.md 3,352 字节，另有一个 `agents/openai.yaml`）。我读了正文，和根 `AGENTS.md` 的「Skill 编写规范」方向一致，多出来的是怎么写 `description` 和怎么分层。

**要搬进来的要点**：

- 只留会改变 agent 决策的规则、流程、边界和陷阱；一个意思只写一处；能从代码或 `--help` 查到的不重复。
- 分层：所有任务都要的放根规则文件，特定任务才要的放 skill，少数分支才要的放 `references/`。
- `description` 是唯一的路由入口，只用 `name` 和 `description` 两个字段。骨架用英文祈使句加否定约束（`ALWAYS invoke BEFORE … Do NOT … without loading this skill first`；容易误触发的写 `Use ONLY when … Do NOT invoke for …`），触发词用中文，写用户实际会说的话。
- 明说「改已有的、小修一处」也算，漏调用多在这一类。
- 被钩子强制加载的 skill 不能设成只能由用户调用，否则被拦下的会话加载不了，流程卡死。
- 完成时自查：路由准确、正文自己能看懂、没有重复，删掉任一句都会丢信息。

**不能照搬的**：它引用了他自己环境里的东西（`pei_ai_univ_reinstall -hook`、`gate.json`、`<域>/explicit/`、`agents/openai.yaml`），本仓库没有；那个仓库没有许可证。所以改写成本仓库的版本，不复制原文，在 skill 末尾留一行「改写自 …」，提交说明里也写；建 issue 时请他本人确认一下可以这样用。

**本仓库要补进去的**：先按调研第 2 点分流（能用检查、脚本、钩子把关的不写成 skill）；新建前先查已有的 skill；签入前由一个全新会话带着它试做一次；被排除的内容去哪（进展和交接进任务文件，修复经过进提交说明）；能不能配钩子、往门禁表里加哪一行（见第 6 节）。

**名字和位置**：建议叫 `fuyu-skill-writing`，放 `.claude/skills/fuyu-skill-writing/`，40 行以内。管的是写或改 `SKILL.md` 和三份 `AGENTS.md`；普通文档、调研、README 不归它。

**和根 `AGENTS.md` 的关系**：「Skill 编写规范」那三句是你的原话，原样留着，后面加一句「写或改 skill 和规则文件前加载 `fuyu-skill-writing`」。

**试做**：`task-skill` 会话带着它写 `fuyu-task`，这就是它的试做。所以 F43 要等 F48 的草稿过了我这一关再开，比原计划多一步。

**两处要你知道的出入**：

- 它说祈使句的 `description`「实测差距很大」，这是他自己量的，我们没有复核；调研里各家对句式的说法并不一致。现有四个 skill 里加载最多的 `fuyu-agent-harness` 正是这种写法，所以照它写没有坏处。
- 调研曾建议 `fuyu-release` 可以设成只能由用户调用。如果给它配钩子（第 6 节），这条建议就不能采纳，两者只能选一个。

## 6. 每个 skill 能不能配钩子（协作者的第 2 条）

这和第 1 节的门禁是同一张表。为了装得下，表里一行的「什么时候拦」从只认路径扩成三种：写某些路径、跑某类命令、调某个工具。要求仍是两种：读过某个文件，或加载过某个 skill。

| skill | 能配吗 | 拦什么 | 建议 |
|---|---|---|---|
| `fuyu-agent-harness` | 已经配了 | 二十几个接入点文件，加上新建的 `agent_status/*.rs` | 不变 |
| `fuyu-release` | 能 | 命令：`pnpm release`、`pnpm release:version`、`pnpm release:prebuild`，以及直接跑 `scripts/release/` 下那几个脚本 | 配。发版一步错了代价大，命令很好认，误拦少 |
| `fuyu-video` | 能 | 路径：写 `video/` 下的文件 | 配。只在 Windows 那台机器上做视频，两天里一次都没加载过，进实测清单 |
| `fuyu-lead` | 能，但要挑时机 | 工具：一个会话第二次派出会话之前（`start_session`，`user_asked`）。只派一个不拦，那是普通的分一件事出去 | 配。派到第二个才算在统筹 |
| `fuyu-task`（F43） | 能 | 命令：`pnpm task:claim`、`pnpm tasks add … --claim` | 配。认领是这条链的第二步，拦在这里最准；主会话的简报漏写也不怕 |
| `fuyu-skill-writing`（F48） | 能 | 路径：写 `.claude/skills/` 下的文件 | 配 |
| 同上，三份 `AGENTS.md` | 能，不建议 | 路径：`AGENTS.md`、`src/AGENTS.md`、`src-tauri/AGENTS.md` | 先不配。根文件改过 116 次，绝大多数是加一行，拦下来多半是误拦 |
| `doc-preview`（F49） | 配不好 | 它是写完之后才用的；该不该打开，取决于这份文档是不是给你读的，路径看不出来 | 不配。误拦的代价是浏览器里弹出没人要看的页面 |
| 以后的界面 skill、引导 skill | 能 | 路径，到时候各加一行 | 这次不做 |

**几条一起成立的约束**：

- 每条规则每个会话（和每个子代理）只拦一次，重做就放行。
- 强制项多了会误拦，每多一行就多一份要维护的东西。上面建议配的是 5 行新的，加上两条规则文件，表里一共 8 行。
- skill 还没签入时，对应的行不生效：引擎先看 `.claude/skills/<名字>/SKILL.md` 在不在，不在就跳过。这样不会出现要求加载一个不存在的 skill。
- 被钩子强制的 skill 不能设成只能由用户调用。
- 钩子只对 Claude Code 生效，Codex、opencode 的会话不受管。

这些行都由 F42 的会话写，工作量比原计划多一截：命令和工具两种拦法各要一组测试。

## 7. skill 和钩子都放项目级（协作者的第 3 条）

**现状**：

- 钩子：两个门禁都登记在 `.claude/settings.json`，已经是项目级。用户目录的 `~/.claude/settings.json` 里没有和本仓库流程有关的钩子。
- skill：不符合的有一处，`doc-preview` 只在这台 Mac 的 `~/.claude/skills/` 里，主会话的简报还在点它。用户目录里另外四个（`jifang-*`、`loc-dashboard`、`pollo-generate`）不是这个项目的流程，不用搬。

**F49 要做的**：

- 把 `SKILL.md`、`preview.mjs`、`page.css`、`page.js` 和 `vendor/`（内嵌的 marked 和它的许可证）搬到 `.claude/skills/doc-preview/`，名字不变。
- `SKILL.md` 里的命令改成从仓库根执行：`node .claude/skills/doc-preview/preview.mjs <文件>`。`description` 按 F48 的写法过一遍。
- `docs/THIRD_PARTY_NOTICES.md` 给 marked（MIT）加一节；`docs/research/ai-doc-preview.md` 里「全局技能」那句改掉。
- 在仓库里跑一次，确认渲染和打开都正常。

**用户目录那一份**：同名时个人目录的优先，所以不处理的话这台 Mac 上跑的还是旧的。它在仓库外面，我不会不问就删。建议改名成 `~/.claude/skills/doc-preview.moved` 留几天，确认没问题你再删；你说直接删也行。

**顺带一提**：这台 Mac 的 Claude 记忆里还有几条其实是项目规则，同样只在一台机器上。「用中文」见最前面；其余几条调研里已经安排了去处，不在这一批。

**一件相关的事**：协作者的配置同时管 Codex 和 Claude Code。按调研，Codex 只读 `.agents/skills`，放进 `.claude/skills/` 的 skill 他在 Codex 里读不到。「重要的 skill 都放进本仓库」要对他也成立，就得搭桥，这在调研第 7 点里还等你定。

## 先后和依赖

1. 你确认之后，我建 6 个 issue 和任务（F42–F45、F48、F49），写好每个任务的「说明」和「验收」。F46 收口时再建，清单以实际没测到的为准。
2. 第一步，同时开：`gate-table`（F42）、`skill-writing`（F48）、`doc-preview-move`（F49）。后两个只动 skill 文件和文档。
3. 我读 F48 的草稿，过了就放进 `.claude/skills/`。
4. 第二步：开 `task-skill`（F43），带着 F48 写 `fuyu-task` 的草稿。我读草稿，过了就放进 `.claude/skills/fuyu-task/`。
5. 第三步，同时开：`commit-part`（F44）和 `progress`（F45），都只带 skill 和任务文件。这时 F42 多半还在做，同时写代码的会话最多 3 个。
6. 我检查 F44、F45 的 diff 和它们走流程的情况，把走偏的地方发给 `task-skill` 定稿、提交；写 `fuyu-task` 时 F48 暴露的问题发给 `skill-writing` 定稿。
7. 我检查 F42 的 diff 和回放结果，让它接线；我在自己的会话里往 `src/` 写一个探针文件试一次，应该被拦。
8. 我改根 `AGENTS.md`（一个提交），land。这几个提交和别人的不相干，优先用 `pnpm mq:land --yes --only` 单独开 PR；叠不上就跟整批走。
9. 合入后：每个任务的 issue 回复并关闭，`pnpm progress` 里不该再有这几项；建 F46；向你汇报。

**会改同一个文件的地方**：

| 文件 | 谁改 | 怎么避开 |
|---|---|---|
| 根 `AGENTS.md` | 只有主 agent | 最后一个提交，子会话把要加的行报给我 |
| `.claude/settings.json` | 只有 F42 | 接线是最后一步 |
| `package.json` | F44、F45 各加一行 | 热点文件：改完在同一条命令里单独提交 |
| `docs/architecture/workflow.md` | F42（门禁一段）、F44（只提交自己的改动） | 同上，提交前先 `git diff` 确认只有自己的改动 |
| `docs/tasks/README.md` | F45（第二波）、F43（定稿时） | 时间上错开 |
| `.claude/skills/fuyu-lead/SKILL.md` | 只有 F43 | |

**一条额外的规矩**：`scripts/mq/mq.mjs`（git 钩子和每个 `mq:` 命令都经过它）、`checkCommit.mjs`、`wait.mjs`、`scripts/tasks/tasks.mjs`、现在的门禁脚本和 `.claude/settings.json`，都是所有会话正在用的。改坏一个，整台机器的提交、认领或工具调用马上出问题。所以新逻辑先写在新文件里测好；往这些文件里接线放在最后，一次改完，马上跑一遍确认，马上提交。

## 子会话一览

| 任务 | 会话 | `--scope` | 怎样算做完 | 验证 |
|---|---|---|---|---|
| F42 | `gate-table` | `scripts/gate/`、`scripts/agent-harness-gate.mjs`、`tests/scripts/gate.test.mjs`、`tests/scripts/agent-harness-gate.test.mjs`、`.claude/settings.json`、`docs/architecture/workflow.md` | 表里三行；原来三条测试原样通过；新测试覆盖「读过」的三种证据、子代理、合并提示、Bash 写入目标；回放结果记进任务；接线后真的会拦 | 单测，`pnpm check`，`pnpm build`，回放，接线后的探针 |
| F43 | `task-skill` | `.claude/skills/fuyu-task/`、`.claude/skills/fuyu-lead/SKILL.md`、`docs/tasks/README.md` | 草稿过主 agent 这一关；两次试做对照十步没有明显走偏；`fuyu-lead` 的三处改完 | 只改文档，不用构建；对着「Skill 编写规范」逐条看；`pnpm check:tasks` |
| F44 | `commit-part` | `scripts/mq/commitPart.mjs`、`scripts/mq/hunks.mjs`、`scripts/mq/mq.mjs`、`scripts/mq/checkCommit.mjs`、`tests/scripts/mq-commit-part.test.mjs`、`package.json`、`docs/architecture/workflow.md` | 第 3 节的接口和测试都在；在真实仓库里用它提交一次自己的改动 | 单测，`pnpm check`，`pnpm build` |
| F45 | `progress` | `scripts/progress/`、`scripts/tasks/taskIssues.mjs`、`scripts/tasks/tasks.mjs`、`scripts/mq/wait.mjs`、`tests/scripts/progress.test.mjs`、`package.json`、`docs/tasks/README.md` | 一条命令打出第 4 节的五段，这台机器上不超过一屏；两处提醒接上 | 单测，`pnpm check`，`pnpm build`，在真实仓库里跑一次并把输出贴进任务 |

| F48 | `skill-writing` | `.claude/skills/fuyu-skill-writing/` | 第 5 节的要点都在，没有他环境里的东西，末尾注明来源；`task-skill` 带着它写出的 `fuyu-task` 没有明显走偏 | 只改文档，不用构建；自己对着自己的规则逐条看 |
| F49 | `doc-preview-move` | `.claude/skills/doc-preview/`、`docs/THIRD_PARTY_NOTICES.md`、`docs/research/ai-doc-preview.md` | 仓库里的那份能渲染、能打开；第三方声明补上；用户目录那份按你定的处理 | 在仓库里跑一次 `preview.mjs`；`pnpm check` |

F42 的范围因为第 6 节多了命令和工具两种拦法，以及给各个 skill 加的行，`--scope` 不变。

六个会话都不 land，做完把提交号报给我。别的会话没提交的文件让 `pnpm check` 失败时，写明哪些失败不是自己造成的。

## 要新建的 issue

F46 收口时建，其余确认之后就建，标题按 `[编号] 标题`：

- `[F48] fuyu-skill-writing：写 skill 和规则文件的规则（改写自 ShengLin1001 的 p-agent-doc-writing）`
- `[F49] doc-preview 搬进仓库，skill 和钩子都放项目级`

- `[F42] 门禁钩子按表配置：改 src/、src-tauri/ 前要读过对应的规则文件`
- `[F43] fuyu-task skill：做一个任务从认领到关 issue 的顺序清单`
- `[F44] pnpm mq:commit-part：同一个文件里只提交自己的改动`
- `[F45] pnpm progress：一屏看清进行中的任务、没推的提交、没提交的文件、PR 和没关的 issue`
- `[F46] 第一批协作工具在 Windows 上的实测清单`

## 实测清单（这台 Mac 上测不了的，进 F46）

- 门禁：Windows 上 Edit / Write 的反斜杠路径能不能命中规则；PowerShell 工具写文件（`Set-Content`、`Out-File`、重定向）；钩子在 Git Bash 和 PowerShell 两种外壳下都能起来；标记文件落在 `%TEMP%`；子代理触发时带不带 `agent_id`。
- `mq:commit-part`：`core.autocrlf=true` 加 CRLF 文件只带一部分；`git hook run` 在 Git for Windows 上可用；索引被锁时的重试。
- `pnpm progress`：`gh` 输出里的中文标题；机器名和 land 分支名对不对得上。
- `fuyu-task`：Windows 那台机器上的会话带着它做一次任务。
- 各 skill 的门禁行：`fuyu-video` 那一行只能在 Windows 上试（写 `video/` 下的文件被拦一次）；`fuyu-release` 那一行在配了签名私钥的机器上，下次发版时看一眼有没有先被拦。
- `doc-preview`：Windows 上从仓库里的路径跑一次，确认能打开浏览器。

## 顺带发现（不在四项里）

这台 Mac 今天用过两个机器名：`tixxindeair` 和 `tixxindemacbook-air`。证据：`origin` 上 `land/TixXin/tixxindeair-…` 的分支有 24 个，`…tixxindemacbook-air-…` 的有 14 个；今天 05:03 认领的 B29、B47 记的是前一个，08:27 以后认领的记的是后一个；C80 记的是前一个，而它的会话就在这台机器上跑，63 个没提交的文件也在这份工作区里。现在 `hostname` 返回的是 `TixxindeMacBook-Air.local`，系统里没有设固定的 HostName，名字多半跟着网络变。

影响：认领是按「会话名加机器名」认主人的，名字一变，同一台机器上的会话会把自己早先认领的任务当成别人的；land 分支名也跟着变，`pnpm mq:wait` 不写 PR 号时会找不到刚才开的 PR。

这是另一件事，我没有动。我提了一张单独的任务卡片，你点了才会开始；不点也不影响这四项。

## 这次不做的

- 界面 skill、引导 skill，以及调研里第 8 项往后的候选：只在门禁表里留了加一行的位置。
- 上下文压缩之后重新拦一次：要再加一个钩子，先看只拦一次的效果。
- 把手写 `GIT_INDEX_FILE` 的命令直接拦下来：先靠根文件里的一句话和 `pre-commit` 的提醒，过几天看还有多少人手写再说。
- 给 Codex 搭 skill 目录的桥：见第 7 节末尾和下面第 9 个问题，默认不在这一批。
- 现有另外三个 skill 的正文小修：F48 签入后再按它过一遍，另开一项。
- `AGENTS.md` 的 c、d 两处瘦身：见第 2 节。

## 已定的（2026-11-15，用户确认按建议执行）

1. 四项都做，加上协作者意见带来的 F48、F49。
2. 根 `AGENTS.md` 做到 a 加 b：任务相关的 7 条缩成 3 行护栏，改写历史的步骤搬去 `workflow.md`；c、d 不动。
3. 门禁做完就接线。
4. `fuyu-task` 的试做用 F44、F45 本身。
5. 「和用户说话用中文」那一行归原会话，这一批不加，收口时再问。
6. 写 skill 用的 skill 改写成 `fuyu-skill-writing`，末尾注明来源，在 issue 里请 ShengLin1001 确认。根文件「Skill 编写规范」原文保留，后面加一句指针。
7. 钩子配 `fuyu-release`、`fuyu-video`、`fuyu-lead`、`fuyu-task`、`fuyu-skill-writing` 五行；`doc-preview` 和三份 `AGENTS.md` 不配。`fuyu-release` 不设成只能由用户调用。
8. `doc-preview` 搬进仓库后，用户目录那一份改名成 `doc-preview.moved` 留着，不删。
9. 给 Codex 搭桥不在这一批，先在 F48 的 issue 里问协作者平时用哪个。
