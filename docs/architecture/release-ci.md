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

Environment `release` 已建好，只允许 `main`（2026-11-14）。证书文件在 Mac 那台电脑的 `~/.tauri/fuyu/macos/`，所以还差一步要在那台 Mac 上做：`node scripts/macos/self-signed-cert.mjs --upload`（现在写进 Environment），确认下一次发版 Mac 构建正常后，`gh secret delete` 删掉仓库级的三个 `MACOS_*`。删之前 workflow 两边都读得到，不会中断。

## 谁能做什么

| 谁 | 能做的 |
|---|---|
| 外部贡献者（fork 的 PR） | GitHub 不把任何 Secrets 给 fork 的 PR；碰不到密钥 |
| 协作者（Write） | 能手动触发两个构建 workflow，拿到的是没签 updater 的安装包；发不了版，因为没有 updater 私钥 |
| 仓库管理员 | 在持有 updater 私钥的电脑上跑 `pnpm release` |

## 没做的

- 插件签名搬到 `TixXin/fuyu-plugins` 的 CI（另一个仓库，单独的任务）。
- Windows 的 Authenticode 签名（SmartScreen）。以后用 Azure Trusted Signing 时可以在 CI 里用 OIDC 签，不用存私钥。
- Environment 的 Required reviewers：现在只限分支，不要求每次审批，发版不会卡在等人点按钮上。协作者多了之后可以加。
