---
name: fuyu-testing
description: ALWAYS invoke BEFORE adding, changing or deleting a test in the Fuyu repo (tests/unit, tests/scripts, a tests/regression page, a Rust #[test]), before running `pnpm test:regression --update-snapshots`, and when a test or check fails or passes only sometimes, including a one-line assertion fix or one page's snapshot. Do NOT write a test, refresh a snapshot or retry a failing check without loading this skill first. Do NOT invoke just to run the commands the AGENTS.md 验证 table asks for when they pass. 触发：补个测试、加测试、要不要写测试、测试挂了、回归页失败、快照对不上、更新快照、偶尔失败、时好时坏、再跑就过了、Mac 上过了 Windows CI 挂了。
---

# 写测试、更新快照、判断失败

测试要拦一个说得出的错误，代价和风险相称；条数和一次绿色的运行都不是证据。这个仓库的实现和测试多半是同一个会话写的，两边可能带着同一个错误假设：期望值从需求、对外契约（`docs/architecture/contracts.md`）、真实出过的 bug 里来，不从当前实现的输出抄。跑哪些命令看根 `AGENTS.md`「验证」，这里管写不写、写成什么样、失败怎么判断。

## 加或改一个测试之前

三个问题，答案写进提交说明：

1. 什么错误会让它失败？那个错误会让用户或维护者损失什么？
2. 等价的重构或更好的实现会不会也让它失败？会的话它锁的是实现细节，改成断言结果。
3. 已有的测试、类型检查或 `pnpm check` 里的检查是不是已经拦住了？拦住了就扩展那一个，不另起一套 fixture。

修 bug 时让新测试在修之前先失败一次，证明它拦得住；做不到就在提交说明里写明。

## 放在哪一层

- 纯逻辑：抽到不含 JSX 的 `.ts`，`tests/unit/*.test.mjs` 测输入输出（写法约束见 `src/AGENTS.md`「测试」）。
- 界面：回归页断言用户看得到的契约（某个控件在、点了之后变成什么），不新增整页快照来顶替断言。整页 DOM 快照只防意外变化，不证明界面是对的。
- Rust：`cargo test` 测公开行为，不为测试加生产分支或导出。
- 架构规则：查 import 关系，像 `tests/unit/feature-boundaries.test.mjs`。不用 `readFileSync` 读源码或配置（含 `.github/workflows/`）匹配字符串：换个写法它就挂，漏了一处它又不挂。配置解析成结构再断言字段；要守「CI 跑了某个脚本」「发布带上某个文件」这类事实，直接跑那个脚本、查产物，或在临时目录里跑一遍。

## 快照

- `--update-snapshots` 只在界面本该变时用。重写前看差异，只该有自己改的那几处，多出来的是回归，去查，不重写；提交说明写明界面为什么本该变。
- 快照只存稳定的状态。「已复制」、高亮、定时消失的提示这类过一两秒自己变回去的，在这一页的 `tests/regression/<页名>.tsx` 里轮询到它回落再报通过，不存进快照；不加放行名单或跳过检查的参数，换了名字也一样，进了名单的页再也没人查。运行器打出 `snapshot settled late` 或 `DOM is still changing` 就是这一页有这个问题。

## 失败了先分诊

先分清是哪一种，再决定改什么：

1. **自己造成的**：改实现。需求确实变了才改断言，提交说明写明；旧断言不否决用户同意的改动。
2. **别人没提交的文件**：`git status --short`、`pnpm tasks dirty` 看归谁。不改别人的文件，把剩下的检查单独跑完，汇报里写明哪一步不是自己造成的。
3. **环境**：沙箱拦子进程、没有浏览器、临时目录没权限。如实报告，不算通过（根 `AGENTS.md`「常用命令」后面那段）。
4. **时好时坏**：再跑就过不等于修好；先看失败的测试用到的文件自己改没改过，改过就按第 1 种查。不加重试、不调大超时、不加固定等待，它们只把竞态藏起来。单独连跑（`for i in $(seq 20); do pnpm test:regression <页名> || break; done`）看失败率和挂在哪一步，把等待改成轮询真实的就绪信号（每 50 毫秒查一次，等到期望值再检查）；当场查不清就开任务，写下挂在哪一步、几次挂几次。修好的标准是连跑几十次都过。

## 跨平台

- 按换行匹配文件内容前先把 `\r\n` 换成 `\n`，或者匹配不带换行的片段：Windows CI 检出的是 CRLF。比较路径先 `realpath` 或比文件本身，不比字符串：Windows 可能给出 8.3 短路径。在临时仓库里提交的测试，其余坑见 `docs/architecture/workflow.md`「两台机器」。
- Mac 上通过不代表 Windows 上通过。测试碰到路径、换行、子进程、计时的，报验前后台跑 `pnpm mq:try --wait`（`docs/architecture/workflow.md`「提前看 CI」）。

## 确认真的跑到了

命令成功而目标测试没跑，不是证据。

- `pnpm test:regression <词>` 按页面名子串挑页：对一下输出里 `✓` / `✗` 后面的页名，是不是正好是你要的那几页。
- `node --test --test-name-pattern <模式> <文件>`：名字一个都对不上时，输出只有文件名一行 `✔`、`pass 1`、退出码 0；对上了才会列出每个测试的名字。看名字，不看退出码。
- 修好一个失败的测试后，确认它走到了原来失败的那一步，不是在前面就提前结束了。

## 什么时候不用写

只改文案；纯搬迁（照样跑已有的测试）；已有的测试会因为这个错误失败。不是每次改动都要配一个测试，不写时在提交说明里点一句靠哪个已有检查。
