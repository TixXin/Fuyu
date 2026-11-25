# AGENTS.md

本文件是仓库总规则，面向 AI 编程代理与协作者。规则按目录就近生效（冲突时以子目录为准）：

- 修改 `src/` 先读 [src/AGENTS.md](src/AGENTS.md)；修改 `src-tauri/` 先读 [src-tauri/AGENTS.md](src-tauri/AGENTS.md)。
- 目标架构、窗口清单与目录细节见 [docs/architecture/overview.md](docs/architecture/overview.md)。
- 做 `docs/tasks` 任务或处理 issue：先读 [docs/tasks/README.md](docs/tasks/README.md) 并加载 `fuyu-task` skill。
- **插件平台第 3 版（万物皆插件）**代码已完成，待真岛验收；开工先读 [docs/architecture/plugins/v3-progress.md](docs/architecture/plugins/v3-progress.md)、[v3-workflow.md](docs/architecture/plugins/v3-workflow.md) 与 [v3-everything-plugin.md](docs/architecture/plugins/v3-everything-plugin.md)。第 2 版宿主与 SDK 已删，仅剩 `src-tauri/src/plugin_kernel/v2_migration.rs`、`v2_builtins.rs` 做迁移；`plugins/` 下冻结的第 2 版市场文件只给旧岛屿读，不再改。

## 通用开发约定

- 和用户说话用中文（回复、计划、总结、提问、按钮、会话标题）；提交标题和 PR 标题用英文。
- **代码和脚本不写注释**（用户定）：适用于 `src/`、`src-tauri/`、`scripts/`、`tests/`、`packages/`、`bot/` 全部源码与脚本。解释"为什么"写进提交说明、`docs/` 或任务文件。唯一例外是工具指令（`eslint-disable*`、`@ts-expect-error` / `@ts-ignore`、`/// <reference>`、`#!`、`#Requires`、`@vite-ignore`）和发布给第三方插件开发者的 `*.d.mts` JSDoc。
- 优先复用现有组件、类型、工具函数和 CSS class，不为小改动引入新抽象层。
- 前端状态继续用 `localStorage` 持久化，除非明确要求迁到文件、数据库或云同步。
- 新增 Tauri 命令时同步更新 Rust handler、前端类型化封装和权限配置（细则见子目录规则）。
- 修改窗口大小、定位、透明度、置顶、托盘或注册表逻辑时，同时考虑折叠态、展开态、贴边收起和托盘隐藏。
- 用户可见文案必须支持中英文，注意窄窗口下按钮、标签和标题不溢出。
- 避免与任务无关的改动和修改生成产物。

## Git 与协作

所有管理员和协作者的会话都在**主工作区、本地 `main`** 上工作，攒成一批再经 PR 合入（细则与排障见 [docs/architecture/workflow.md](docs/architecture/workflow.md)）。其他协作者（如 ShengLin1001）和外部贡献者在自己分支或 fork 上开发提 PR，不改写别人已推分支。

- **不开 worktree、不切分支、不跑破坏性命令**：主工作区和用户的 `pnpm tauri dev` 及其他会话共用，禁用 `git stash`、`git reset --hard`、`git checkout -- <文件>`（除非用户明确要求）。例外仅两个 detached worktree：`../Fuyu-release`（发版，见 `fuyu-release` skill）和 `../Fuyu-verify`（推前验证）。
- **只提交自己的文件**：修改前先看 `git status --short`，保留他人未提交改动；提交必须显式指定文件（`git add <文件>` 或 `git commit -- <文件>`），禁用 `git add -A` / `git add .`；同一文件有他人改动时用 `pnpm mq:commit-part`，不手写 `GIT_INDEX_FILE`。认领任务写 `--scope`，热点文件（清单见 `workflow.md`「没提交的文件」）改完单独提交；停下时 `pnpm tasks note` 记清自己的未提交文件。
- **完成可验证功能单元即主动提交，无需再次确认**：同一功能单元的改动合在一个提交里，提交前跑 `pnpm test:changed`。用户可感知的提交在正文末尾写一行 `Release note: <中文一句>` 和一行 `Release note (en): <英文一句>`（写法见 `docs/releases/README.md`），需真机确认的加 `Manual check: <在哪台机器上看什么>`。汇报时给出提交号，并写明跑了 `test:changed`、全量没跑。
- **修补未推提交**：`HEAD` 是自己刚做的提交就 `git commit --amend -- <文件>`，否则新开小提交写明补哪个提交；禁止 `git rebase`；已合入 `main` 的提交不再改写（仅用户明确要求去 Claude 署名行时按 `workflow.md` 处理）。
- **只在用户说要推时提 PR**（用户定）：用户未明确要求「推一下 / 提 PR / 合进去」前不跑 `pnpm mq:land`，汇报里提一句未推提交数（`pnpm mq:pending`）。开工前、land 前各 `pnpm mq:sync` 一次。用户说要推时，先 `pnpm mq:verify`，全过后 `pnpm mq:land --yes --upto <验过的提交> --body <中文正文文件>`（标题英文，正文分节见 `workflow.md`），再后台 `pnpm mq:wait` 至 PR 合入才算完成。`main` 不手动直推，紧急时管理员可 `gh pr merge --admin`。
- **Rust 构建与重任务**：代理用共用 `src-tauri/target/agents`，不碰 `debug`、不另建缓存目录、不跑 `pnpm tauri dev`；`cargo build/test/check/clippy`、`tauri build` 统一走 `pnpm heavy -- <命令>`。

## 验证

- **开发中不跑全量**（用户定）：`pnpm test`、`pnpm check`、`pnpm verify`、全量 `pnpm test:regression`、`pnpm build`、`pnpm build:exe`、`cargo test`、`pnpm mq:try` 攒到推 PR 时一起跑，除非用户点名。
- **例外：提交前跑 `pnpm test:changed`**（用户定）：按覆盖率表 / import 关系只跑碰到的回归页、单元测试与 Rust 模块；挂了当场修，断言随新行为改的写进提交说明。
- **推 PR 前在固定提交上验**：`pnpm mq:verify` 在 `../Fuyu-verify` 并行跑 `pnpm verify`、回归页、`build:exe` 与 try CI（无网时 `--no-ci`）；挂了在主工作区修好提交后再验（可 `--only <项>`、`--pages <词…>` 重跑挂项），全过后 `pnpm mq:land --yes --upto <验过的提交>`（仅文档免验，用户同意不验加 `--unverified`）。纯搬迁重构提交同样要验。
- **推时修了别的会话的提交**，用 SendMessage 告知对方改了什么、为什么（找不到就 `pnpm tasks note <任务> "<内容>"`）。
- 写/改测试、用 `--update-snapshots` 或测试失败/抖动时，先加载 `fuyu-testing` skill。不得因构建耗时跳过必要验证，受阻须如实报告。

| 改动范围 | 推 PR 前必须运行 |
|---|---|
| 仅文档 | 无需构建，确认 Markdown 可读 |
| 前端逻辑、样式、依赖或脚本 | `pnpm check` + `pnpm build` |
| Rust、Tauri 命令、窗口、托盘、注册表、系统 API、桌面配置 | `cargo test --manifest-path src-tauri/Cargo.toml` + `pnpm build:exe` |
| 岛屿 / 消息 / 设置界面或 `api.ts` 类型 | 另加 `pnpm test:regression`（同步更新 mock 与快照） |
| 发布相关 | `pnpm tauri build` |

## 本机更新与桌面快捷方式

- `pnpm build:exe` 随推前验证跑，生成 `src-tauri/target/release/fuyu.exe`（Mac 为 `Fuyu.app`）；`pnpm release` 后不用重跑。
- **默认不改桌面快捷方式 / `~/Applications/Fuyu.app`**（用户定）：仅用户明确要求时设 `FUYU_SYNC_SHORTCUT=1` 再跑（Windows 同步指向并重读确认，Mac 写 `Fuyu.app.new` 再替换）。

## 代码规模规则（全局）

单文件物理行数上限（`pnpm check:size` 检查）：

| 文件类型 | 上限 |
|---|---|
| `.ts` / `.tsx` / `.mjs` / `.ps1` / `.cmd` | 400 行 |
| `.css` | 500 行 |
| `.rs` | 生产代码 800 行；内联测试 150 行（超出移到同目录 `tests.rs`，不设上限） |

- 豁免：`src/i18n/locales/*.ts`、`src/i18n/sections/**/*.ts`、`src/i18n/types.ts`、锁文件、二进制资源、生成产物、`vendor/`。
- 存量白名单 `scripts/file-size-allowlist.json` **只减不增**：变短同步改小，降到上限以下或移走必须删条目；不往超限文件加新功能。
- 一文件一职责，不新建 `helpers.ts`、`common.rs`、`misc.css` 等杂物文件。

## 对外契约（不得随意变更）

纯重构中一律不得改变以下标识；确实需要变更时，须在同一提交同步改前后端、提供旧数据迁移或兼容读取，并在提交说明写明：

- `localStorage` key（`fuyu-*`，清单见 [docs/architecture/contracts.md](docs/architecture/contracts.md)）及数据格式
- Tauri 命令名、参数名与事件名
- 窗口 label（`main`、`translation`、`clipboard`、`clipboard-preview`、`settings`、`onboarding`、`tray-menu`、`drag-grid` 及 `screenshot-<n>`、`pin-<n>`、`plugin-window-<n>` 前缀）与 `?window=` 值
- 应用标识 `com.tixxin.fuyu`、开机自启注册表值 `Fuyu`、凭据管理器条目、数据目录文件名（如 `agent-status.json`）
- 更新端点与 `latest.json` 格式
- 旧名（FocuSD / fly-island）兼容代码（清单与删除时间见 `contracts.md`「改名兼容（D17）」，到期前不删；新代码和文档只用新名）

## 重构约定

- **搬迁和改写分开提交**（`refactor(<范围>): ...`）：搬迁零行为变化，不顺手改名、改格式、改逻辑或改 CSS class；不顺手升依赖或整仓格式化。
- 跨多提交的大重构先在 `docs/architecture/` 写分步计划；目录或模块变化同步更新对应 `AGENTS.md` 和 `docs/architecture/overview.md`。

## 常用命令

完整脚本清单见 `package.json` 与 [docs/architecture/workflow.md](docs/architecture/workflow.md)，只列易忘项：

| 用途 | 命令 |
|---|---|
| 提交前定向测试 | `pnpm test:changed [--dry-run]` |
| 推前全套验证 / 合入 | `pnpm mq:verify [<提交>] [--only …] [--pages …]`；`pnpm mq:pending` / `mq:land --yes --body <文件>` / `mq:wait` / `mq:sync` / `mq:try` / `mq:commit-part` |
| 重任务排队 / 清缓存 | `pnpm heavy [--label <名>] -- <命令>`；`pnpm prune:target [--dry-run]` |
| 全量检查 / 回归页 | `pnpm check`（含颜色、动效、CSS 括号、密钥字段、行数、Rust 生成类型、任务、单测）；`pnpm test:regression [词] [--update-snapshots]` |
| 生成产物维护 | 改设置项后 `pnpm settings:index`；改 `#[host_service]` 后 `pnpm gen:rust-types`；改 README SVG 用 `pnpm readme:assets`（改 `scripts/readme/assets.mjs`） |
| 任务、issue、进度 | `pnpm tasks` / `pnpm task:claim` / `pnpm issue [<编号>]` / `pnpm progress [--no-github]` |
| 调试与打包发布 | `pnpm lab`（实验台）；`pnpm logo`（水母预览）；`pnpm build:exe`；`pnpm msix`；`pnpm release:version <版本>`（四处同改，勿手改）；`pnpm release` |

若沙箱禁止派生子进程，`node --test` 加 `--test-isolation=none`（`release-manifest.test.mjs` 仍会因拦截 `spawnSync` 失败，如实说明）。若 `vite build` 清理临时目录报 Access is denied，把 `TEMP` / `TMP` 指到 `node_modules/.cache/` 重试。

## 项目概览

浮屿 / Fuyu（仓库 `TixXin/fuyu`）是 Windows 优先、适配 macOS 的 Tauri 2 悬浮岛效率工具。技术栈：React 19、TypeScript（strict）、Vite 7、lucide-react、dompurify、Rust 2021（`windows` crate）、pnpm、`node:test`。八个固定窗口加截图、贴图、插件独立窗口由 `?window=` 分发，详见 `docs/architecture/overview.md`。

## 目录总览

```text
src/            # React 前端（src/AGENTS.md）
src-tauri/      # Tauri / Rust 桌面端（src-tauri/AGENTS.md）：src/、examples/、capabilities/、tauri.conf.json
tests/          # unit/、scripts/（node:test *.test.mjs）；regression/（*.html + *.tsx）
vendor/         # 第三方代码（cordis/），豁免行数与无注释规则
packages/       # plugin-base（禁 import src/）与插件开发工具，不进发布产物
plugins/        # v3/official/ 官方插件 + 冻结的第 2 版市场，不进发布产物
scripts/        # 发布、合并队列（mq/）、门禁（gate/）、各项检查与开发脚本
video/ bot/     # 宣传视频与 QQ 机器人插件，不进发布产物
.githooks/      # pre-push、pre-commit（main 提交必写文件名）、commit-msg（拒 Claude 署名行）
docs/           # 文档与任务（docs/README.md、docs/tasks/）
```

细节见 `docs/architecture/overview.md`「仓库目录」。注意：被 `include_str!` 编入 Rust 的脚本放在模块旁（`src-tauri/src/agent_status/hooks/`、`src-tauri/src/qq_notifications/`），改动按 Rust 验证。

## 文档

- 中文文档用 UTF-8；根 `README.md` 为简体中文，外语版在 `docs/readme/README.<语言>.md`（改 README 先改中英，相对路径按 `docs/readme/` 写）。
- 文档按 [docs/README.md](docs/README.md) 归位：设计放 `docs/design/`，功能放 `docs/features/`，架构放 `overview.md` / `data-storage.md` / `contracts.md`；功能平台状态变更须在**同一提交**更新 [docs/architecture/platforms.md](docs/architecture/platforms.md)。
- **调研与交付物进 `docs/`**：联网调研、竞品对比写 `docs/research/<主题>.md`（规则见 `docs/research/README.md`）；排查、方案、预览页按 `docs/README.md` 用英文小写短横线放进对应目录，同主题更新原文件。本仓库不用 `ai-guide/`。
- **任务流程**（细则见 `docs/tasks/README.md`）：查任务用 `pnpm tasks next|show|progress`；认领用 `pnpm task:claim <编号> --as <会话> --scope <路径>`；新任务先 `gh issue create` 再 `pnpm tasks add --issue <N>`；有 issue 的动手前先回复、合入后回复并 `gh issue close`；`pnpm tasks done <编号> --commit "<标题>"` 与功能改动同提交；停下用 `pnpm tasks note` 交接。
- **会话间消息**（ListAgents / SendMessage）：仅用于告知与协商接口，长命令放后台以便及时读消息，等其他会话用 `notify_when_idle`。

## Skill 编写规范

改 `.claude/skills/*/SKILL.md` 或任意 `AGENTS.md` 前先加载 `fuyu-skill-writing` skill。自生成 skill 只留关键步骤、触发条件、核心命令和陷阱，不写工作日志；修改根 `AGENTS.md` 前检查 `wc -c AGENTS.md`，控制在 24 KiB 内避免被代理截断。
