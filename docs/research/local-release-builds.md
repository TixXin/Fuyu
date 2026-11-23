# 发版时在自己的 Mac 和 Windows 电脑上构建

> 日期：2026-11-23。问题：保留现在「GitHub Actions 构建、本机签名」的发版流程，另加一条用自己两台电脑（Mac M4 24 GB、Windows i5-14600KF 64 GB，用 Tailscale 连在一个局域网里）构建并发布的线路，值不值得、怎么做。范围：GitHub 托管 runner 的规格和 macOS 排队问题、自托管 runner 在公开仓库上的安全指南、Tauri v2 从 macOS 交叉编译 Windows、Tailscale 加 Windows OpenSSH 远程构建；关键词 self-hosted runner public repository fork、not acquired by Runner、tauri cargo-xwin nsis、tailscale ssh windows openssh、rust compile m4 vs github actions。另对照了本仓库 v0.3.13 的实测。相关任务：暂无。

## 结论

**值得做，做成 `pnpm release` 的一个开关，默认仍走 GitHub Actions。** 推荐的做法是：Mac 版在这台 Mac 上直接编，Windows 版经 Tailscale 用 SSH 让 Windows 电脑编，编好的文件拷回 Mac，签名、上传、公开这些步骤照旧。不推荐把两台电脑注册成 GitHub 的自托管 runner，也不推荐在 Mac 上交叉编译 Windows 版。

1. **快多少**：v0.3.13 在 GitHub 上，Windows 构建这一步 8 分 51 秒（整次运行 11 分钟），Mac 构建一次 10 分钟。另一次 Mac 构建和 PR 的 `rust-macos`，都因为排 15 分钟没排到机器被取消，多花了约 25 分钟。本机在验证目录里跑 `build:exe`（有增量缓存）是 3 分 58 秒。GitHub 公开仓库的 macOS arm64 机器只有 3 个虚拟核、7 GB 内存（[GitHub 文档](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)），虚拟机的单核性能本来就拖 Rust 编译（[Depot](https://depot.dev/blog/guide-to-faster-rust-builds-in-ci)、[Blacksmith](https://info.blacksmith.sh/task/blog/fastest-github-actions-runners-rust-builds)）。M4（10 核）和 14600KF（14 核 20 线程）都强得多，又有增量缓存，估计两边并行各 3–6 分钟（未实测，做之前先各量一次）。更要紧的是不再排 GitHub 的 Mac 队：从 2025 年到现在，macOS arm64 runner 一再出现排队、容量不足（[2025-10 事故](https://www.githubstatus.com/incidents/071h21gptcp0)、[macOS 14 镜像下线前减容量](https://github.blog/changelog/2026-10-01-github-actions-macos-14-runner-image-retirement)）。
2. **为什么用 SSH，不用自托管 runner**：GitHub 自己和 OWASP 都建议公开仓库不要用自托管 runner。fork 的 PR 能改 workflow 里的 `runs-on`，把代码送到你的机器上跑，能拦住它的只有「需要批准外部贡献者的 workflow」这一个设置（[OWASP](https://cheatsheetseries.owasp.org/cheatsheets/GitHub_Actions_Security_Cheat_Sheet.html)、[Legit Security](https://www.legitsecurity.com/blog/securing-your-ci/cd-pipeline-exploring-the-dangers-of-self-hosted-agents)、[Adnan Khan](https://adnanthekhan.com/2023/12/20/one-supply-chain-attack-to-rule-them-all/)）。默认装法装出来的 runner 也不是一次一清的（[StepSecurity](https://www.stepsecurity.io/blog/defend-your-github-actions-ci-cd-environment-in-public-repositories)）。这两台都是日常用的电脑，上面有 updater 私钥、Mac 证书和各种登录状态。SSH 的方式下，GitHub 碰不到这两台电脑，只有你在 Mac 上跑 `pnpm release` 时才会叫 Windows 编译。
3. **为什么不在 Mac 上交叉编译 Windows 版**：Tauri v2 能在 macOS 上用 `cargo-xwin` 出 NSIS 安装包，但官方文档写着「实验性，测试得少，不一定适用于每个项目」，而且出不了 MSI（WiX 只能在 Windows 上跑）（[Tauri 文档](https://v2.tauri.app/distribute/windows-installer/)）。浮屿大量用 Win32 和 WinRT，每版都发 MSI，正式版不该靠实验性的工具链编。
4. **代价和前提**：
   - 发版时 Windows 电脑要开着、连着 Tailscale。
   - Windows 上要打开系统自带的 OpenSSH 服务器：Tailscale SSH 不支持 Windows（[Tailscale 文档](https://tailscale.com/kb/1193/tailscale-ssh/)），防火墙规则只放 Tailscale 的网段。
   - Windows 上要有一份专门用来发版的仓库目录，不能在开发用的工作区里编，否则会把没提交的文件编进去。
   - 两边编译时都要先确认当前提交和代码树和要发的完全一样。
5. **GitHub 那条线留着**：自己的电脑不在、Tailscale 连不上、或者想要干净环境编出来的包时，仍然走 Actions。冒烟测试继续用 GitHub 的干净 Windows 机器跑（`release-smoke.yml`，约 1 分钟），它测的是「在没装过浮屿的电脑上能装、能打开」，自己的 Windows 电脑做不到这一点。

## 详细

### v0.3.13 的构建实测

| 构建 | 在哪 | 用时 | 备注 |
|---|---|---|---|
| Windows 安装包 | GitHub `windows-latest` | Build 一步 8 分 51 秒，整次运行 11 分钟 | 依赖从缓存恢复 |
| Mac 安装包 | GitHub `macos-latest` | 第一次排 15 分钟没排到机器被取消；重跑 10 分钟 | 注释写 `not acquired by Runner` |
| PR 的 `rust-macos` | GitHub `macos-latest` | 同样排 15 分钟被取消；重跑 5 分钟 | 同上 |
| `build:exe`（Mac，release 构建） | 本机验证目录 | 3 分 58 秒 | 有增量缓存，没打 dmg |

### 推荐线路：`pnpm release --builders local`

在发版目录（`../Fuyu-release`）里跑，和现在一样需要一个已经合入 `main` 的提交：

1. **检查**：当前提交在 `origin/main` 上，工作区干净；用 `tailscale status` 或直接 `ssh <windows 主机> exit` 确认 Windows 电脑在线。不在线时提示加 `--builders ci` 或 `--builders mac-local`（只有 Mac 在本机编，Windows 照旧走 Actions）。
2. **两边同时编**：
   - Mac：在发版目录里跑现在 `release-macos.yml` 做的事：前端构建，`tauri build` 出 `.app` 和 dmg，用 `~/.tauri/fuyu/macos/` 里的自签名证书签名（证书本来就在这台 Mac 上），检查能启动。
   - Windows：`ssh <windows 主机>`，在一个专用目录（比如 `D:\Fuyu-release-build`）里 `git fetch`、`git checkout --detach <提交>`、确认代码树一致，然后跑现在 `pnpm release --local` 用的那段 Windows 构建（`buildLocally()` 里写发布配置、编 NSIS 和 MSI 的部分）。编好用 `scp` 拷回 Mac 的 `src-tauri/target/publish/release`。Tailscale 直连时 85 MB 也就几秒。
3. **后面不变**：在 Mac 上用 updater 私钥签名，生成 `latest.json`，上传草稿并核对 SHA-256，冒烟测试（仍在 GitHub 的干净 Windows 机器上跑），公开，读回两个通道，导入官网，issue 留言。

和预构建配合：`pnpm release:open` 推上分支后，可以照样在两台电脑上「预先构建」。合入后代码树一样就直接用，和现在 `prebuild.json` 的做法一致。

### 安全上要守的

- updater 私钥只在 Mac 上，不拷到 Windows：Windows 只负责编译，签名在 Mac 上做。
- Windows 的 SSH 只认密钥登录，防火墙只放 Tailscale 的网段（`100.64.0.0/10`）；或者在 Tailscale 的 ACL 里只允许这台 Mac 连它的 22 端口。
- 编译用的目录只用来发版，每次都 `git clean -fdx`，但保留 `target`，好用上增量缓存；编之前核对 `git rev-parse HEAD^{tree}`。
- 拷回来的安装包要和 `SHA256SUMS.txt` 一起上传：现在的流程已经会核对上传后的 SHA-256。

### 自托管 runner 那条路为什么不走

- 公开仓库里，任何人都能开 PR。对外部贡献者，默认只有「第一次贡献的人」的 workflow 需要批准，之后的不用；改成「所有外部贡献者都要批准」之后，安全也只靠你每次批准前看清改了什么。
- runner 默认能被这个仓库的任何 workflow 用，不是一次一清，被利用后可以长期留在机器上。
- 要做得安全，得给每次构建开一个新的虚拟机（Mac 上用 Tart 之类），再加上只允许 `workflow_dispatch` 触发、只允许 `main` 上的 workflow 用。这比直接 SSH 复杂得多，收益差不多。

### 交叉编译那条路为什么不走

- Tauri 官方文档对 macOS 编 Windows：只能出 NSIS，「实验性」「测试得少」（[来源](https://v2.tauri.app/distribute/windows-installer/)）。
- 要装 `cargo-xwin`、LLVM、NSIS，Windows SDK 由 xwin 下载（[来源](https://v2.tauri.app/distribute/windows-installer/)）；MSI 出不了。
- 编出来的程序没在 Windows 上编过、测过，正式版风险太大。

## 来源

- [GitHub 托管 runner 的规格](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)、[更大的 runner](https://docs.github.com/en/actions/reference/runners/larger-runners)
- [GitHub Status：macOS runner 性能下降（2025-10）](https://www.githubstatus.com/incidents/071h21gptcp0)、[macOS 14 镜像下线](https://github.blog/changelog/2026-10-01-github-actions-macos-14-runner-image-retirement)
- [OWASP GitHub Actions 安全速查](https://cheatsheetseries.owasp.org/cheatsheets/GitHub_Actions_Security_Cheat_Sheet.html)、[GitHub 社区：自托管 runner 与公开仓库](https://github.community/t/self-hosted-runner-security-with-public-repositories/17860)、[StepSecurity](https://www.stepsecurity.io/blog/defend-your-github-actions-ci-cd-environment-in-public-repositories)、[Legit Security](https://www.legitsecurity.com/blog/securing-your-ci/cd-pipeline-exploring-the-dangers-of-self-hosted-agents)、[Adnan Khan：投毒 runner 镜像](https://adnanthekhan.com/2023/12/20/one-supply-chain-attack-to-rule-them-all/)、[Equinor 指南](https://appsec.equinor.com/guidelines/gh-actions-runners)
- [Tauri v2：Windows 安装包与交叉编译](https://v2.tauri.app/distribute/windows-installer/)
- [Tailscale SSH](https://tailscale.com/kb/1193/tailscale-ssh/)、[微软 OpenSSH 概览](https://learn.microsoft.com/en-us/windows-server/administration/OpenSSH/openssh-overview)
- [Depot：CI 里更快的 Rust 构建](https://depot.dev/blog/guide-to-faster-rust-builds-in-ci)、[Blacksmith：Rust 构建最快的 runner](https://info.blacksmith.sh/task/blog/fastest-github-actions-runners-rust-builds)、[FreeBSD 邮件：M4 Max 与 7950X3D 编译对比](https://lists.freebsd.org/archives/freebsd-arm/2025-March/004680.html)
