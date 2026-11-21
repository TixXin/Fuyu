# 发版分享图自动发到 QQ「我的手机」

> 日期：2026-11-21。问题：`pnpm release` 生成的分享图，能不能用开源方案、脚本自动发到用户 QQ 的「我的手机」。范围：NapCatQQ、LLOneBot、Lagrange.Core 的文档和 issue，OneBot 11 接口，macOS AppleScript / System Events 控制聊天软件的做法；关键词「我的手机」「数据线 dataline」「send_private_msg 给自己」「AppleScript 发送 QQ 图片」。相关任务：无（等用户定方案）。

## 结论

**建议用界面自动化，不用 QQ 机器人框架。** 让脚本在用户自己登录的 QQ 里做一遍人手会做的事：分享图已经在剪贴板里，激活 QQ，`⌘F` 搜「我的手机」，回车进入会话，`⌘V` 粘贴，回车发送。Mac 上用 `osascript` 驱动 System Events，Windows 上用 PowerShell 或 AutoHotkey 发按键。

- **好处**：用的是官方客户端和用户已登录的账号，不需要第二个账号、不走非官方协议，没有封号风险；脚本几十行，不引入新依赖。
- **代价**：要给运行脚本的程序（终端、Claude、Node）开「辅助功能」权限；QQ 改版后快捷键或搜索框行为变了就得跟着改；发送时 QQ 会被切到前台，几秒内不能动键鼠。
- **做成开关**：默认不发，`pnpm release:share --qq` 或环境变量打开；发之前在终端里提示一句、可按 Ctrl+C 取消，发完截一下 QQ 窗口留底更稳。

机器人框架（NapCat、LLOneBot、Lagrange）走不通或不划算：

1. **找不到「我的手机」的接口**。它们实现的是 OneBot 11：私聊、群聊、文件上传。QQ 里的「我的手机」是设备间传文件的会话，不是普通私聊。三个项目的文档和 issue 里都没搜到能发到这个会话的接口（未核实，可能有没公开的扩展）。
2. **给自己发私聊**：NapCat 的入门文档建议拿自己的 QQ 号试 `send_private_msg`。但那是机器人账号给自己发，消息落在和自己的私聊里，不是「我的手机」。手机上能不能收到提醒，要实测，这里未核实。
3. **代价大**：要另外跑一个注入 QQNT 的进程，或者用协议端登录。这是非官方协议，有封号风险，社区教程也建议用小号。NapCat 在 macOS 上的安装说明只在一个第三方镜像站见到，官方支持情况未核实。

## 详细

| 方案 | 发到「我的手机」 | 封号风险 | 要装什么 | 维护成本 |
|---|---|---|---|---|
| 界面自动化（osascript / PowerShell） | 能，和手点一样 | 无 | 无，开辅助功能权限 | QQ 改版要跟着改 |
| NapCat / LLOneBot（OneBot 11） | 没找到接口；只能私聊自己 | 有 | 注入 QQNT 的框架、配置 HTTP 端口和 token | 跟着 QQ 版本升级框架 |
| Lagrange.Core（协议实现） | 没找到接口 | 有 | .NET 程序，签名服务 | 高 |

界面自动化在 Mac 上大致是这几步（只是思路，没在 QQ 上跑过）：

1. `pnpm release:share` 已经把中文图放进剪贴板（`«class PNGf»`）。
2. `tell application "QQ" to activate`，等窗口在前。
3. System Events：`keystroke "f" using command down`，粘贴「我的手机」（搜索词也走剪贴板，避开输入法），回车进入会话。
4. 把图片重新写回剪贴板，`keystroke "v" using command down`，稍等图片出现在输入框，再 `key code 36`（回车）发送。
5. 没有辅助功能权限时 `osascript` 会报错，脚本只提示、不算发版失败。

Windows 上思路相同：`[System.Windows.Forms.SendKeys]` 或 AutoHotkey，QQ 的搜索快捷键是 `Ctrl+F`；QQ 不在运行或没登录时跳过。

微信 Mac 版已经有人用同样的剪贴板加按键方式自动发消息和文件，可以对照。Apple 开发者论坛也说明了，这类模拟按键属于界面脚本，要在「辅助功能」里授权。

## 来源

- NapCat 快速入门，建议用自己的 QQ 号试 `send_private_msg`：https://www.mintlify.com/NapNeko/NapCatQQ/quickstart
- NapCat 消息处理：https://www.mintlify.com/NapNeko/NapCatQQ/guides/message-handling
- NapCat 接口（含 `send_online_file`）：https://napcat.apifox.cn/410334673e0.md
- NapCat 安装说明（第三方镜像，Linux / macOS 可执行文件名）：https://www.mintlify.com/NapNeko/NapCatQQ/installation
- NapCat 发图相关 issue：https://github.com/NapNeko/NapCatQQ/issues/198 、https://github.com/NapNeko/NapCatQQ/issues/223
- 社区教程，提到非官方协议有封号风险：https://damodev.csdn.net/6aad08405c13c42b539d1f5d.html
- Lagrange.Core 文档：https://lagrangedev.github.io/Lagrange.Doc/Lagrange.Core/CreateBot
- 用 AppleScript 和剪贴板控制微信 Mac 版发消息：https://clawhub.ai/sincerememe/macos-wechat-send
- Apple 开发者论坛，模拟按键属于界面脚本、要辅助功能授权：https://developer.apple.com/forums/thread/807501
- 少数派 AppleScript 入门（System Events 操作界面）：https://sspai.com/post/46912
