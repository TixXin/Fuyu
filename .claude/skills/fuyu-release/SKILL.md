---
name: fuyu-release
description: >
  This skill should be used whenever the user asks to publish a new version of the
  island app in the Fuyu repo (the main checkout and its lanes) —
  including 发版, 发布, 发 beta, 发测试版, 发正式版, 出个版本, release, ship a version.
  Covers picking the version number, writing the release notes, landing the bump and
  running `pnpm release`. Not for plugins (发插件 is the lanes skill) or npm packages.
---

# 浮屿发版

步骤和命令以仓库为准，这里只排顺序、列判断。开始前在 lane 里读：

- `docs/features/updater.md` 的「发布一个可自动更新的版本」和「撤回有问题的版本」；
- `docs/releases/README.md`：版本号怎么定、发布说明怎么写。

只在 Windows 上发版：签名私钥和发布配置只在那台机器上，其他机器上被要求发版时告诉用户换到 Windows。

用户说"发版"就是授权发布，不用再问；版本类型不明时默认测试版，正式版要用户明说。

## 顺序

1. **在自己的 lane 里**（EnterWorktree 或 `pnpm lane:open --as <会话名>` 开的，有归属记录；不要手动 `git worktree add`），工作区干净，快进到 `origin/main`。
2. **定版本号**：看 `gh release list --repo TixXin/Fuyu --limit 5` 和 `package.json`，按 `docs/releases/README.md`。
3. `pnpm release:version <版本号>`：改四处版本号，写草稿 `docs/releases/v<版本号>.md`。
4. **写说明**：读提交正文（不只标题），按 `docs/releases/README.md` 改写成中英文，删掉草稿标记。
5. 提交 `chore(release): <版本号>`，写一份中文 PR 正文（`## 改了什么` 写版本号和这版的要点，`## 关联` 写发布说明文件），`pnpm mq:land --body <文件> --wait`（开 PR、开自动合并，等 CI 通过、GitHub 合入）。只改版本号和 Markdown 时 CI 走快速路径，很快。没合入就不要往下走。
6. 在**同一个 lane**、合入的那个提交上（`--merge` 合入，提交号不变），后台运行 `pnpm release`，日志写到 scratchpad。它会：在主工作区的 `target/publish` 增量构建（约 3 分钟），上传草稿并核对 SHA-256，触发 `release-smoke.yml` 在干净 runner 上装一遍、启动一遍（约 1 分钟），通过才公开；然后换本机 exe 和快捷方式、刷新 beta 通道、读回两个通道、在 issue 下留言。
7. **看日志，不只看退出码**（管道到 `tail` 时退出码总是 0）。要看到 `✓ Published` 和 `✓ Channels read back`。

## 出问题

- 冒烟测试没过：Release 停在草稿，不会公开。看日志里的运行地址；修好后发下一个版本号，草稿用 `gh release delete <tag> --repo TixXin/Fuyu` 删掉（只删草稿，已公开的不删）。
- 已公开但通道核对不对，或版本本身有问题：按 updater.md「撤回有问题的版本」，先告诉用户再动。
- 版本号已存在：脚本会拒绝；换更高的版本号，不要覆盖。

## 回报

中文，简短：Release 地址；构建、冒烟测试、通道核对的结果；本机主工作区的 release 程序已换成新版本（不用再 `build:exe`；桌面快捷方式不动）；留言了哪些 issue；说明里写了哪几项（一句话）；版本号提交的提交号。没跑或失败的步骤照实说。
