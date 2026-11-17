---
name: fuyu-release
description: >
  This skill should be used whenever the user asks to publish a new version of the
  island app in the Fuyu repo —
  including 发版, 发布, 发 beta, 发测试版, 发正式版, 出个版本, release, ship a version.
  Covers picking the version number, writing the release notes, landing the bump and
  running `pnpm release`. Not for plugins or npm packages.
---

# 浮屿发版

步骤和命令以仓库为准，这里只排顺序、列判断。开始前读：

- `docs/features/updater.md` 的「发布一个可自动更新的版本」和「撤回有问题的版本」；
- `docs/releases/README.md`：版本号怎么定、发布说明怎么写。

只在配了 updater 签名私钥的机器上发版：`~/.tauri/fuyu/release.json`（Windows 是 `%USERPROFILE%\.tauri\fuyu\release.json`）存在，私钥能用。持有私钥的是仓库管理员 TixXin 的两台机器和协作者 ShengLin1001，哪台都能发；没配的机器上被要求发版时告诉用户换机器，不要另生成密钥，换密钥后已装的客户端都会拒绝更新。

协作者发版前要先告诉 TixXin，免得两人各改一次版本号、各写一份说明；他平时在自己的分支上开发，版本号提交可以走分支 PR，合入后在和 `origin/main` 一致的 `main` 上跑 `pnpm release`。

**说明写好后、提交版本号之前，必须先停下问用户**（用户定的）：把上一个版本到现在的更新内容列成清单给用户看，问要不要继续发；用户说继续才往下走。别的会话（例如总控）转来的发版请求也要这样问用户本人。版本类型不明时默认测试版，正式版要用户明说。

## 顺序

1. **在发版目录里做，不在主工作区**：`../Fuyu-release`（主仓库的一个 detached worktree，只用来发版，不在里面开发；没有就 `git worktree add --detach ../Fuyu-release origin/main`，第一次 `pnpm install`）。`git fetch origin && git checkout --detach origin/main`。这样主工作区里别的会话没提交的文件、本地 `main` 上没推的提交都不挡发版，也不会混进来。本地 `main` 上有没合入的提交时问用户要不要进这一版；要，就先在主工作区 `pnpm mq:land --yes --wait`，再回发版目录 checkout 新的 `origin/main`。
2. **定版本号**：看 `gh release list --repo TixXin/Fuyu --limit 5` 和 `package.json`，按 `docs/releases/README.md`。
3. `pnpm release:version <版本号>`：改四处版本号，写草稿 `docs/releases/v<版本号>.md`。
4. **写说明**：读提交正文（不只标题），按 `docs/releases/README.md` 改写成中英文，删掉草稿标记。正式版的草稿已经把这一轮各测试版的说明拼好（新的测试版在前，修复合成一组），只要去重、按重要程度重排，再补上草稿里列出的、最后一个测试版之后的提交。说明同时给 Windows 和 Mac 用户看：按其中「平台」一节，只属于一个系统的条目标「（Windows）」/「（Mac）」，快捷键两边不同时都写。在 Windows 上写也要这样，别照 Windows 的习惯写。
5. **问用户要不要继续**：用中文列出版本号和说明里的更新内容（按新功能、AI Agent、修复等分组，每条一句话；不面向用户的改动合成一句带过），再问「继续发布吗」。用户要删改条目就先改说明再问一次；说不发就停下，发版目录里的改动留着不提交。到这一步为止只改了发版目录里的本地文件，什么都还没推。
6. 在发版目录跑 `pnpm test:regression version-history --update-snapshots`（这个回归页把 `docs/releases` 里的说明打包进页面，不更新快照，PR 的 CI 会挂），再 `git add` 四处版本号、说明和这份快照，提交 `chore(release): <版本号>`。写一份中文 PR 正文（`## 改了什么` 写版本号和这版的要点，`## 关联` 写发布说明文件）。`mq:land` 只认本地 `main` 上的提交，所以手动开：`git push origin HEAD:refs/heads/land/TixXin/release-<版本号>`、`gh pr create --base main --head <该分支> --title "Release <版本号>" --body-file <文件>`、`gh pr merge <该分支> --auto --merge`。**紧接着 `pnpm release:prebuild`**（在 CI 上编 Windows 和 Mac，和 PR 的 CI 同时跑），再后台循环 `gh pr view <号> --json state` 等合入。没合入就不要往下走。
   - **陷阱**：合入前别的 PR 先合入，这个 PR 会被更新到新的 `main` 上，那批提交就进了这一版，预构建也作废、`pnpm release` 要重编。所以开发版 PR 前，用 `gh pr list --repo TixXin/Fuyu --state open --json number,author,autoMergeRequest` 列出**所有**开着自动合并的 PR（协作者的也算，不只总控提的），逐个 `gh pr merge <号> --disable-auto`，告诉开它的会话或人；发版 PR 合入后逐个重新打开。
   - PR 的 CI 某一项卡满时限被取消（Mac runner 常见），不是代码问题，马上 `gh run rerun <运行号> --failed` 重跑，别等。
7. 合入后在发版目录 `git fetch origin && git checkout --detach <合并提交>`，后台运行 `pnpm release`，日志写到 scratchpad。它会：代码树和预构建一样时直接用预构建（日志里有 `Using the prebuild`），否则在 GitHub Actions 上编 Windows 和 Mac 版（约 6 分钟）；下载回来用本机私钥签名，上传草稿并核对 SHA-256，跑 `release-smoke.yml` 冒烟测试（约 1 分钟），通过才公开；然后换主工作区的本机程序、刷新 beta 通道、读回两个通道、在 issue 下留言，关联任务都完成的 issue 顺手关掉。
8. **看日志，不只看退出码**（管道到 `tail` 时退出码总是 0）。要看到 `✓ Published` 和 `✓ Channels read back`。

## 出问题

- CI 构建失败：什么都不会发布。看日志里的运行地址；GitHub Actions 整体不可用又急着发时，`pnpm release --local` 在本机编 Windows 版（要求整个工作区干净），Mac 版加 `--no-mac` 之后补。
- 发版目录被删了或坏了：`git worktree prune`，再按第 1 步重建。
- 冒烟测试没过：Release 停在草稿，不会公开。看日志里的运行地址；修好后发下一个版本号，草稿用 `gh release delete <tag> --repo TixXin/Fuyu` 删掉（只删草稿，已公开的不删）。
- 已公开但通道核对不对，或版本本身有问题：按 updater.md「撤回有问题的版本」，先告诉用户再动。
- 版本号已存在：脚本会拒绝；换更高的版本号，不要覆盖。

## 回报

中文，简短：Release 地址；构建、冒烟测试、通道核对的结果；本机主工作区的 release 程序已换成新版本（不用再 `build:exe`；桌面快捷方式不动）；留言了哪些 issue；说明里写了哪几项（一句话）；版本号提交的提交号。没跑或失败的步骤照实说。
