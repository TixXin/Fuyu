# 发布说明的写法

`docs/releases/vX.Y.Z.md` 会成为 GitHub Release 的正文和应用内更新提示（`latest.json` 的 `notes`），读者是用户，不是开发者。发版的步骤在 [docs/features/updater.md](/docs/features/updater.md)「发布一个可自动更新的版本」；这里只讲说明怎么写。

## 版本号

- 先看已发布的：`gh release list --repo TixXin/fuyu --limit 5` 和 `package.json` 的 `version`。
- 当前是正式版 `0.3.6`，下一个测试版是 `0.3.7-beta.1`；当前是 `0.3.7-beta.N`，下一个测试版是 `beta.N+1`，正式版是 `0.3.7`。
- 用户没说就发测试版；正式版要用户明说。
- 用 `pnpm release:version <版本号>` 改，它会检查比已发布的都新，并写出草稿。

## 草稿给的材料

提交正文里的 `Release note: <中文>` / `Release note (en): <英文>` 行，草稿直接放进「更新内容」和 What's New，按这份文件的写法写（加粗短语开头、写现象、单平台标出）；`Manual check: <…>` 行列在草稿的注释里，发版前给用户看。写功能的会话最清楚用户能感觉到什么，所以这句在提交时就写好。

`pnpm release:version` 写的草稿列出上一版以来的 feat / fix / perf 提交（测试版从上一个任意版本算）。正式版的草稿已经把这一轮各测试版说明的「更新内容」和 What's New 拼好（新的测试版在前，修复合成一组，F37），提交列表只列最后一个测试版之后的提交：把重复的条目合并（同一功能后来又改过的，按最后的样子写），按重要程度重排，再补上新提交。只看标题不够：

- 读正文：`git log <上一个 tag>..HEAD --no-merges --format="=== %h %s%n%b" -E --grep="^(feat|fix|perf)"`。
- 草稿只收 feat / fix / perf。`test(...)`、`refactor(...)`、`build(...)` 里也可能带了用户能看到的修复，扫一眼 `git log <上一个 tag>..HEAD --oneline`。
- 开发工具（`feat(dev)`、lane、合并队列、发布脚本）不写。

## 怎么写

- **只写用户能感觉到的**：做了什么、在哪里找到、怎么用。不写类名、文件名、命令名、任务编号、"重构"。
- **按功能合并**：同一功能的多个提交（先加、再调、再修）写成一条，按最后的样子写。
- **顺序**：新功能在前，改进其次，最后一条「**修复**：」下面列子项。最重要的放第一条。
- **每条以加粗短语开头**，接冒号，再一两句说明。新功能默认关闭的写「（新，默认关闭）」并说在哪打开。
- **路径和按键**：设置路径写 设置 → 分类 → 项目，名字照界面上的中文 / 英文写（在 `src/i18n/sections/` 里查）；快捷键用反引号 `` `Ctrl+Shift+2` ``。
- **修复写现象**："切换页面时文字不再跳一下"，不写原因和实现。
- **插件**：市场插件的新版本写版本号和变化一句话；它们由插件市场更新，不随岛屿。
- **中英两份内容一致**，英文不是逐字翻译，按英文习惯写；英文界面名用英文界面上的叫法。
- **固定部分不动**：开头「关于这个版本」、英文的 About this release 和末尾 Downloads 由草稿生成（两个平台的安装和下载都在里面），只改版本序数之类的字。正式版的开头写"包含 vX.Y.Z 以来的全部改动"。
- **开头的下载链接不动**（2026-11-14 起，用户定）：「关于这个版本」和 About this release 下面第一行是 Windows 安装包和 Mac dmg 的直链，中文那行另有国内镜像，点一下就能下载。草稿按版本号写好，`pnpm release` 发现缺了或版本号对不上会拒绝发布。
- 写完删掉开头的 `<!-- release-notes-draft -->` 和提交列表注释，`pnpm release` 见到标记会拒绝发布。

## 平台

浮屿同时发 Windows 和 Mac 版，一份说明给两边的用户看，不能写成只在 Windows 上成立的样子。

- **只在一个系统上有的条目**，开头标「（Windows）」或「（Mac）」，英文写 (Windows) / (Mac)；两边都有的不标。草稿的提交列表里，`feat(macos)` 这类提交已经标了 `[Mac]` / `[Windows]`。拿不准时查 [platforms.md](/docs/architecture/platforms.md)：功能在另一个平台上「不支持」「未开始」的，按单平台写。
- **快捷键两边不一样时都写**：`` `Ctrl+Shift+2` ``（Mac 上 `` `⌃⇧2` ``）。浮屿在 Mac 上把设置里的 Ctrl 当 Control 键，同一个组合按法其实一样，但 Mac 用户认 ⌃⌥⇧⌘ 符号，所以照样写出来；用到 Win 键或 ⌘ 的只有一边，按单平台标。
- **界面叫法**：托盘图标在 Mac 上是菜单栏图标，任务栏、注册表、SmartScreen 只属于 Windows，钥匙串、程序坞、「隐私与安全性」只属于 Mac。说明里提到时按平台标，或换成两边通用的说法（例如「托盘 / 菜单栏图标」）。
- 固定部分（开头的安装说明、末尾的 Downloads）已经分平台写好，包括 Mac 的 dmg 和第一次打开的放行说明。

可以参照：[v0.3.5-beta.6](v0.3.5-beta.6.md)（功能多的测试版）、[v0.3.6](v0.3.6.md)（正式版）、[v0.3.7-beta.2](v0.3.7-beta.2.md)。

## 分享图

`pnpm release:share` 把最新一版说明（`docs/releases` 里版本号最大的那份）画成一张分享图，中英文各一张，写到 `src-tauri/target/release-share/v<版本号>/`，画完把中文那张复制进剪贴板（英文的不复制），再打开这个文件夹，直接粘贴就能发。图宽 1080 的两倍（2160px），高度随内容：顶上一座黑色的岛写版本号，下面按「更新内容」的 `###` 分组排成两列，每条只写加粗的短语，但每一条都列出来、不写「还有几项」；修复单独一块，写整句，超过 10 条时字小一号。没分组的旧说明合成一块、块里排成两列，`**修复**：` 下面的子项进修复那块。

- 指定版本：`pnpm release:share 0.3.9`；只要一种语言：`--lang zh`；倍率：`--scale 1`；不复制：`--no-copy`；不打开文件夹：`--no-open`。
- 用本机的 Chrome 或 Edge 无界面截图，找不到时设 `CHROME_PATH`。复制图片在 Mac 上用 `osascript`，Windows 上用 PowerShell，Linux 上要装 `xclip`；复制失败只提示，不影响出图。日期取版本 tag 的提交日期，还没打 tag 时用今天。
- 推到 QQ：`--push` 把中文图和一份说明文件（`fuyu-v<版本号>.json`）用 `scp` 传到环境变量 `FUYU_BOT_INBOX` 指的机器人收件箱（`主机:/路径/inbox/`），QQ 机器人插件随后私聊发出，插件见 [bot/README.md](../../bot/README.md)。`pnpm release` 在设了这个变量时自动带上 `--push`；推送失败只提示，不影响发布。收件箱地址写在本机环境变量里，不进仓库。
- 推到微信群：设了环境变量 `FUYU_FUXI=<ssh 主机>:<浮汐部署目录>` 时，`--push` 还会经 ssh 调浮汐（微信机器人，仓库 `TixXin/Fuxi`）的 `/announce`：中文图加一段「浮屿 v… 已更新 / 在 设置 → 关于 里更新 / 更新说明链接」直接发到发版群，发到哪个群在浮汐里用 `/设置 发版群` 配；想先在文件传输助手预览、回 `/发布 编号` 才进群，在浮汐里 `/设置 发版公告预览 开`。幂等键是 `fuyu-v<版本号>`，重跑不会重复发群。`pnpm release` 设了这个变量也自动带 `--push`。
- 样式在 `scripts/release/share-card.html`，解析在 `scripts/release/share-card-notes.mjs`；三个方案的对比见 [release-share-card-preview.html](../investigations/release-share-card-preview.html)。
