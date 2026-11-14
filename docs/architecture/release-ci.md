# 发版：构建在 GitHub，签名在本地（F35）

2026-11-14 用户定方向（issue 223，方案 A）。

## 做法

| 步骤 | 在哪 | 用到的密钥 |
|---|---|---|
| Windows 构建（EXE、MSI、`fuyu.exe`） | `release-windows.yml`，windows runner | 无。公钥本来就写在 `tauri.conf.json` 里 |
| Mac 构建（`.app`、dmg） | `release-macos.yml`，macOS runner | Mac 自签名证书（Environment `release`） |
| updater 签名（`.sig`） | 跑 `pnpm release` 的维护者电脑 | updater 私钥，**不上 GitHub** |
| 上传草稿、冒烟测试、公开、刷新通道 | 本机脚本 + `release-smoke.yml` | `gh` 的登录 |

`pnpm release` 先确认当前提交已在 GitHub 上，同时触发两个构建，等它们跑完，把产物下载到 `src-tauri/target/publish/release`（Windows 的布局和本机构建一样：`bundle/nsis`、`bundle/msi`、`fuyu.exe`），本地签名后照旧生成 `latest.json`、上传、冒烟测试、公开。`--local` 保留在本机编 Windows 版的旧做法，GitHub Actions 不可用时兜底。

代码：`scripts/release/ci-build.mjs`（触发、等待、下载、签名）、`windows-build.mjs`（Windows 产物和 CI 里的配置）、`mac-build.mjs`。

## 为什么这样分

- **updater 私钥**：拿到它就能给所有已装用户推一个"更新"，用户不用点任何东西。GitHub Secrets 对有 Write 权限的人、对 workflow 里用到的第三方 action 都不是绝对隔离的，所以它只留在维护者的电脑上。签名只是对几个文件跑 `tauri signer sign`，不需要构建环境。
- **构建**：不需要任何秘密，放 CI 后发版不再依赖某一台电脑的工作区，别的会话没提交的文件也不再挡住发版（以前要开临时 worktree）。
- **Mac 证书**：浮屿在 Mac 上按这张证书认应用，用它签的程序会继承用户给浮屿的辅助功能和屏幕录制授权，所以从仓库级 Secrets 挪进 Environment `release`，只允许 `main` 上的 workflow 读。`main` 只能经 PR 改（规则集），所以在别的分支改 workflow 读不到它。

Environment `release` 只允许 `main`（2026-11-14 建）。证书文件在 Mac 那台电脑的 `~/.tauri/fuyu/macos/`，在那里 `node scripts/macos/self-signed-cert.mjs --upload` 写进 Environment；仓库级的三个 `MACOS_*` 已删。删掉之后在 `main` 上手动跑了一次 `release-macos.yml`（run 43556838319）：证书导入成功，`.app` 满足 Designated Requirement，没有退回 ad hoc。

同一天用 `pnpm release --no-upload` 走了一遍 Windows：CI 构建（run 43555842665，没有缓存约 11 分钟），下载到 `target/publish/release`，本机签出 EXE、MSI 的 `.sig`，`latest.json` 有三个 Windows 条目。第一次真正用这套流程发版时，再看测试版通道能不能从 CI 构建的包更新上来。

## 谁能做什么

| 谁 | 能做的 |
|---|---|
| 外部贡献者（fork 的 PR） | GitHub 不把任何 Secrets 给 fork 的 PR；碰不到密钥 |
| 协作者（Write） | 能手动触发两个构建 workflow，拿到的是没签 updater 的安装包；发不了版，因为没有 updater 私钥 |
| 仓库管理员 | 在持有 updater 私钥的电脑上跑 `pnpm release` |

## 提速（F37，2026-11-14）

0.3.8 的实际用时：版本号 PR 4 分钟，Windows CI 6.6 分钟，Mac CI 5.8 分钟（两边同时），下载、签名、上传约 1.2 分钟，冒烟测试 49 秒；写正式版说明另外约 15 分钟。

- **预构建**：`pnpm release:prebuild`（`scripts/release/prebuild.mjs`）在 `pnpm mq:land` 把版本号提交推上 `land/…` 分支之后马上触发两边的构建，把版本号、提交、代码树和两次运行的编号记在 `src-tauri/target/publish/prebuild.json`。PR 合入后 `pnpm release` 比较合并提交的代码树：一样就下载这两次运行的产物（签名仍在本机），不一样（合入时 `main` 又进了别的提交）就照常重新构建；`--no-prebuild` 强制重新构建。构建和 PR 的 CI 重叠，一次发版约省 4–5 分钟。发布成功后删掉记录。
- **正式版说明**：`pnpm release:version` 出正式版时读 `docs/releases/v<版本>-beta.*.md`，把各测试版的「更新内容」/ What's New 按新到旧拼进草稿，修复合成一组；提交列表只列最后一个测试版之后的提交（`scripts/release/beta-notes.mjs`）。
- **issue 留言**：同时最多 6 个（`after-release.mjs` 的 `tellIssues`），0.3.8 那样 21 个 issue 从一个个发变成几批。
- **等 CI 时 GitHub 报错**：`gh run watch` 中途退出时先用 `gh run view` 查真实状态，还在跑就接着等（PR #248）。

**Windows 编译为什么还要 4 分钟**：0.3.8 那次 Rust 依赖全部从缓存恢复，`Compiling` 只有 `fuyu` 这一个 crate，编了 3 分 55 秒；打包 NSIS 和 MSI 约 35 秒。瓶颈是一个大 crate 在 4 核的免费 runner 上做 release 优化。没改编译选项：release 默认已经是 `codegen-units = 16`、不开 LTO，开 LTO 只会更慢；降优化等级会让用户拿到的程序变慢。真要再快只有两条路：换 GitHub 的大核 runner（按分钟收费），或者把 `src-tauri` 拆成几个 crate 让它们并行编译（大重构）。现在都不值得。

## 没做的

- 插件签名搬到 `TixXin/fuyu-plugins` 的 CI（另一个仓库，单独的任务）。
- Windows 的 Authenticode 签名（SmartScreen）。以后用 Azure Trusted Signing 时可以在 CI 里用 OIDC 签，不用存私钥。
- Environment 的 Required reviewers：现在只限分支，不要求每次审批，发版不会卡在等人点按钮上。协作者多了之后可以加。
