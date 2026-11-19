# 插件平台第 3 版：市场 CI（逐版审核和市场构建）

> 状态：2026-11-15 经 `TixXin/fuyu-plugins` 的 PR [#25](https://github.com/TixXin/fuyu-plugins/pull/25) 合入（E36.5.5，#484），合入后 `Publish v3` 第一次签名并推上 `main`；`main` 的规则集已加。代码在那个仓库的 `scripts/v3/`、`.github/workflows/`，本文只记流程、工作流、密钥和规则集。

索引和撤销名单的格式见 [v3-market.md](v3-market.md)，审核分档见 `packages/plugin-review`，命令行见 [v3-cli.md](v3-cli.md)。定下这些做法的决定见 [第 5 阶段地基的计划](v3-phase5-foundation-plan.md) Q6（官方插件靠受保护的 `main`）、Q7（市场仓库加规则集）、Q8（作者签提交号）、Q9（单独的撤销密钥）。第 2 版的做法见 [market-ops.md](market-ops.md)。

## 流程

```text
作者                      PR 检查（Check submission）              维护者            合入后（Publish v3）
───────────────────────   ─────────────────────────────────────   ──────────────   ─────────────────────────────
提交并推送版本 → sign  →  v3-plan  验签、所有权、改动规则         看报告、批准、   plan    索引里缺哪些版本
开 PR 改 plugins/v3/…     v3-build 按提交号构建、审核（每版一个） 合入             build   重新构建、审核（红档不上架）
                          v3-report 汇总、预演索引、贴报告                         release 发 Release、拼索引
                                                                                   sign    索引密钥签名
                                                                                   push    部署密钥提交 index.v3.json
```

1. **提交**：作者在自己的仓库提交并推送一个版本，`fuyu-plugin sign --commit <提交号>` 签下 `fuyu-plugin-commit/1`（插件名、版本、仓库、提交号），开 PR 在 `plugins/v3/<作用域>/<名字>.json` 的 `versions` 里加一行 `{ version, repository, commit, authorSignature }`。第一次提交时 `authorKeys` 写上 `fuyu-plugin keygen` 打印的公钥。
2. **报告**：PR 检查按提交号构建这个版本，和上一版对比审核，把报告贴到 PR 上。
3. **批准**：维护者读报告（黄档逐项看源码），批准并合入。规则集要求一个批准和两个检查通过。
4. **上架**：`Publish v3` 重新构建，发到市场仓库的 Releases，标签 `v3.<作用域>.<名字>@<版本>`，附件 `<作用域>-<名字>-<版本>.fuyu`、图标、截图。
5. **索引签名**：拼出 `index.v3.json`，签名 job 用索引密钥签，推送 job 提交。每天无论有没有变化都重签一次（索引 7 天过期）。

## 提交文件

`plugins/v3/<作用域>/<名字>.json`，作用域是仓库所有者的小写：

```json
{
  "name": "@someone/weather",
  "path": "plugins/weather",
  "authorKeys": [{ "keyId": "…", "publicKey": "…" }],
  "versions": [
    { "version": "1.0.0", "repository": "https://github.com/someone/fuyu-weather", "commit": "<40 位>", "authorSignature": { "keyId": "…", "signature": "…" } },
    { "version": "1.1.0", "…": "…", "urgent": { "reason": { "zh-CN": "…", "en": "…" } } }
  ]
}
```

| 规则 | 谁能做 |
|---|---|
| 加版本、加作者密钥（`endorsedBy` 可选，没有证明的新密钥在报告里标 ⚠️） | 仓库所有者或其组织的公开成员 |
| 已上架的行改任何字段 | 谁都不行 |
| 删版本、删作者密钥、删文件、标 `urgent` | 维护者（仓库的 OWNER / MEMBER / COLLABORATOR） |
| 提交官方插件 `@fuyu/*` | 维护者；不带作者签名，仓库必须是 `https://github.com/TixXin/fuyu`，提交号必须在它的 `main` 上 |

官方插件的核对：`GET /repos/TixXin/fuyu/rules/branches/main` 里要有 `pull_request` 和 `non_fast_forward` 两条规则，`GET /repos/TixXin/fuyu/compare/<提交>...main` 的 `status` 是 `ahead` 或 `identical`。只查提交存在不够：GitHub 会通过父仓库的地址提供 fork 里的提交。

## 套装

套装是几个已上架的插件，岛屿的市场页确认一次就全部装上（格式见 [v3-market.md](v3-market.md)「套装」，E77.8）。市场仓库里一个套装一个文件 `bundles/<id>.json`，内容就是索引里的一条：

```json
{
  "id": "pomodoro-flow",
  "displayName": { "zh-CN": "番茄工作法", "en": "Pomodoro flow" },
  "description": { "zh-CN": "…", "en": "…" },
  "plugins": ["@fuyu/pomodoro", "@fuyu/todo-ring", "@fuyu/todo-digest"],
  "onboarding": true
}
```

- **谁能改**：只有维护者；成员目前只能是 `@fuyu/*` 官方插件，不收第三方提交（放开时改 `scripts/v3/lib/bundles.mjs` 的那一条）。
- **PR 检查**（`v3-plan`，`scripts/v3/plan.mjs`）：把这个套装放进一份替身索引，用钉住的 `@fuyu/plugin-market` 的 `validateIndex` 查，所以格式规则和岛屿是同一份；成员必须已经在 **base 分支**的 `index.v3.json` 里，PR 自己改索引不算数，所以插件和套装不能在同一个 PR 里一起上；文件名去掉 `.json` 等于 `id`；不认识的字段报错。删除只在报告里记一笔。
- **进索引**：`assembleIndex` 收到 `bundles/` 的全部文件，成员都在这次索引里的才放进顶层 `bundles`（按 `id` 排序）；一个都没有时索引里没有这个字段，和加套装之前逐字节一样。合入后的发布和每天的重签走同一条 `release.mjs`，都带上。`publish-v3.yml` 的 `paths` 有 `bundles/**`，只改套装的 PR 合入后也会重出索引。
- **套装出问题不拖垮索引**：发布时某个套装的成员已经下架、或文件坏了，这个套装不进索引，问题记进 `release.json` 的 `failed`，这次运行报红，索引照常签名、推送。整次失败的话每天的重签也跟着停，7 天后所有岛屿的索引过期，代价比少一个套装大得多。看到红了就修那个套装文件或删掉它。
- **旧岛屿**：0.3.10 及以前的 `validateIndex` 不认识 `bundles`，当成不认识的字段放过，索引照常打开（2026-11-19 用 `v0.3.10` 标签上的 `@fuyu/plugin-market` 打开带套装的索引核对过）。

## 工作流

都在 `TixXin/fuyu-plugins/.github/workflows/`，Actions 都按提交号固定。

| 工作流 | 触发 | job | 权限和密钥 |
|---|---|---|---|
| `Check submission` | 每个 PR | `check`（第 2 版检查和全部测试）、`v3-plan`、`v3-build`（矩阵，每个新版本一个）、`v3-report` | 全部只读、没有 secret；`v3-report` 多一个 `pull-requests: write`，只用来贴评论 |
| `Comment the v3 report` | `Check submission` 跑完（`workflow_run`） | `comment`，只处理 fork 来的 PR | `pull-requests: write`；读那次检查上传的报告，PR 最新提交不是检查过的那个就不贴，PR 还改了 `plugins/`、`themes/` 以外的文件时加警告 |
| `Publish v3` | `main` 上第 3 版的文件变化、每天 02:41 UTC、手动 | `plan` → `build`（矩阵）→ `release` → `sign` → `push`；不在 `main` 上时 `rehearse-sign`、`cleanup` 代替 `sign`、`push` | 见下 |
| `Update index`、`Update likes`、`Update themes` | 原来的触发 | 推 `main` 的 job 挂在 `ci-push` 环境 | 部署密钥推送，`GITHUB_TOKEN` 只读 |

`Publish v3` 各 job 拿到什么：

| job | 运行谁的代码 | 能做什么 |
|---|---|---|
| `plan` | 本仓库 | 只读；先把 `main` 最新的提交定下来，后面每个 job 都检出这一个 |
| `build` | 作者的源码和依赖 | 只读令牌，没有 secret |
| `release` | 本仓库 | `contents: write`（发 Release）；只核对构建产物的哈希再上传，不跑插件代码，上传后下载回来再核对一遍 |
| `sign` | 本仓库，只装 `@fuyu/plugin-market` | `release` 环境的 `FUYU_INDEX_V3_SIGNING_KEY`；只拿到拼好的 `index.v3.json` |
| `push` | 无 | `ci-push` 环境的部署密钥；只拿到签好的两个文件 |

在别的分支上跑（手动选分支，或临时加 `push` 触发）是**预演**：Release 标成预发布，标签前缀 `rehearsal-<运行号>.`，索引用临时密钥签并按岛屿的规则打开，不推送，结束时 `cleanup` 删掉这次的预发布和标签。

### 构建 job 怎么防恶意代码

- 按提交号 `git fetch --depth 1`，`core.symlinks=false`，检出后核对 `HEAD`，删掉 `.git`；`GIT_TERMINAL_PROMPT=0`、`GIT_LFS_SKIP_SMUDGE=1`。
- `package.json` 的 `name`、`version`、`repository` 必须和提交行一致。
- 有依赖时只接受 `package-lock.json`（`lockfileVersion` 2 或 3）：每个包都来自 `https://registry.npmjs.org/` 并带 `sha512` 校验；`link`、git、本地路径、别的锁文件都拒绝。删掉作者的 `.npmrc` 这类文件后 `npm ci --ignore-scripts`。
- 用 `market/v3/build-config.json`（`nodeTarget: node22`、`browserTarget: es2022`）和钉在 `market/v3/tools.json` 的 `TixXin/fuyu` 提交打包，`allowExperimental: false`；官方插件加 `--official`。
- `fuyu-plugin review` 和上一个版本对比（同一个 PR 里加的几个版本，后一个和前一个比；合入后只和已上架的比），再用第 2 版的密钥扫描扫一遍源码。红档不能上架。

### 工具从哪来

不发 npm 包：`market/v3/tools.json` 写 `TixXin/fuyu` 的固定提交号（2026-11-19 起是 `498ce7cd`，第一个带套装校验的提交）和 pnpm 版本。`scripts/v3/fetch-tools.mjs` 稀疏检出这个提交：只要 `@fuyu/plugin-market`、`@fuyu/plugin-manifest`、`@fuyu/plugin-review`（只用 Node 内置模块）时直接检出，要 `@fuyu/plugin-cli` 时再 `pnpm install --frozen-lockfile --ignore-scripts --filter "@fuyu/plugin-cli..."`。换工具版本就改那个提交号，走一次 PR。

## 时间

| 字段 | 取值 |
|---|---|
| `reviewedAt` | 那一行第一次进 `main` 的时间：`git log --first-parent --reverse -S <提交号> -- <文件>` 的提交时间 |
| `publishedAt` | 发 Release 的时间。冷静期 3 天从它算 |
| `serial` | `max(现在的秒数, 上一份 + 1)` |
| `expires` | 生成后 7 天 |

## 密钥和 secret

| 名字 | 放在哪 | 用途 |
|---|---|---|
| `FUYU_INDEX_V3_SIGNING_KEY` | `fuyu-plugins` 的 `release` 环境（只允许 `main`） | 签 `index.v3.json`（公钥 `keyId: d5a27e09caa2594b`）。新的一把，不复用第 2 版的 `FOCUSD_PLUGIN_SIGNING_KEY`：那把同时签第 2 版的撤销名单，第 3 版要求索引密钥签不了撤销名单（信任根两组不能重叠） |
| 撤销密钥（`~/.tauri/fuyu/revocation-v3.key`） | 维护者自己的电脑，离线 | 签 `revoked.v3.json`（公钥 `keyId: 63fd60abfbf525be`，2026-11-17 生成并入信任根），用 `node scripts/plugins-v3/sign-revoked.mjs <revoked.v3.json>` 离线签好后开 PR；CI 不经手 |
| `CI_PUSH_DEPLOY_KEY` | `ci-push` 环境（只允许 `main`） | 有写权限的部署密钥 `ci-push`，四个推 `main` 的工作流用它；规则集里给它 Always 绕过 |
| `FOCUSD_PLUGIN_SIGNING_KEY` | `release` 环境 | 第 2 版索引，不变 |

两组公钥都写在市场仓库的 `keys/trusted.v3.json`（`{ "index": [...], "revocation": [...] }`），也要编进岛屿的信任根，两边一起改。PR 检查会校验这个文件的格式和两组不重叠；`revoked.v3.json` 的改动必须由 `revocation` 里的密钥签、序号只增、条目和收回都只增。

部署密钥推的提交会触发别的工作流（`GITHUB_TOKEN` 推的不会），所以 `index.json` 一变 `Update likes` 就会跑一次；每个工作流推的文件都不在自己的触发路径里，不会循环。

## 规则集

`main` 的规则集 `main protection`（Q7 第二段，2026-11-15 加，id 27350247；加完手动跑的 `Publish v3` 用部署密钥照常推上了 `main`）：

- 必须经 PR，一个批准；禁止强推和删除。
- **要求的检查：`check`、`v3-report`**（`Check submission` 的两个 job 名）。`v3-report` 总会运行（`if: always()`），没有第 3 版改动时也报告成功。
- 绕过：部署密钥 Always；仓库管理员只在 PR 上。

## 演示

2026-11-15 在草稿 PR 上用测试插件 `@tixxin/market-ci-demo` 走了一遍，作者密钥是现场生成的临时密钥。源码放在临时分支，演示完分支和演示提交都删了。运行链接记在 PR 的「演示」一节。

| 步骤 | 结果 |
|---|---|
| 提交 1.0.0（依赖 `ms@2.1.2`） | 🟡：首次上架、新依赖、新声明的域名 |
| 恶意更新 1.1.0：`child_process` 读 `~/.ssh`，把待办发到字符串拼出来的域名 | 🟡：新 `child_process`、没声明的拼接域名、读主目录、运行时拼网址，源码和构建产物里都查到 |
| 换成 1.2.0（`ms` 升到 2.1.3） | 🟡：依赖换版本 |
| 在分支上预演 `Publish v3` | 两个版本发成预发布，下载核对哈希；索引用临时密钥签名，按岛屿的规则能打开；跑完删掉预发布 |

现在的分档规则下，这种投毒是黄档，不是红档：PR 检查照样通过，挡住它要靠维护者读报告后不批准。红档目前是混淆代码、Node 原生扩展、可执行文件这类情况；构建失败和密钥扫描命中不算分档，直接让检查失败。要不要把「没声明的域名」「新 `child_process`」升成红档，由 `@fuyu/plugin-review` 决定，不在市场 CI 里改。
