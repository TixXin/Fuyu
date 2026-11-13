# Mac 上 QQ / 微信提醒的技术验证（G1.10）

> 日期：2026-11-13。环境：MacBook Air（Apple 芯片），macOS 27.2（26B123）；微信 4.1.34（`com.tencent.xinWeChat`，正在运行），QQ 已安装（`com.tencent.qq`，没有运行）。按决定 M8：先验证，对外只承诺未读数。相关任务：G1.10。

## 结论

1. **读 Dock 角标可行，这是 Mac 上唯一可靠的信号。** 用辅助功能读 Dock 进程（`com.apple.dock`）的树，每个 Dock 图标的 `AXStatusLabel` 就是角标文字。实测：一个测试程序设了角标 `7`，读回 `7`；「系统设置」的 `1` 也读到了。需要「辅助功能」授权，浮屿的剪贴板贴回和划词翻译本来就要这个授权。只能拿到数字（或应用自己写的短文字），拿不到谁发的、说了什么。
2. **`lsappinfo` 读不到角标。** `lsappinfo info -only StatusLabel …` 对微信和测试程序都返回空，`lsappinfo list` 里也没有 `StatusLabel`（macOS 27.2）。网上流传的这条路在新系统上不可用。
3. **微信 4.x 的辅助功能树几乎是空的。** 统计整棵树（只数角色，没有读取任何文字内容）：199 个元素、深 6 层，其中 170 个是菜单项，窗口里只有一个空的 `AXTable`（会话列表没有暴露行），没有任何像未读数的短数字。设 `AXManualAccessibility` 后结果一样。所以读会话列表、读发件人在微信 4.x 上做不到。
4. **QQ（NTQQ，Electron）没有实测。** QQ 没在运行，为了不替用户登录 QQ，没有启动它。按 Electron 的惯例，设 `AXManualAccessibility = true` 后网页内容会进辅助功能树，理论上能读到会话列表；但这依赖 QQ 的页面结构，随版本变化，**未核实**。
5. **读系统通知做不到。** macOS 没有读取其他应用通知的公开接口（见 [macos-platform-apis.md](../research/macos-platform-apis.md)）；通知中心的数据库在新系统上要「完全磁盘访问」，读它属于越界，不做。

## 建议

- 对外承诺：**QQ 和微信的未读数**（来自 Dock 角标），在岛上和消息页显示，数字变大时提醒一次；点击打开对应的应用。不承诺发件人和内容。
- 前提：Dock 里要有 QQ / 微信的图标（运行时总在 Dock 里，除非用户用了隐藏 Dock 图标的工具），并允许辅助功能。没授权时消息页给出说明。
- 实现放在平台层：`macos/dock_badges.rs` 每几秒读一次 Dock 的 `AXStatusLabel`（按图标标题或 `AXURL` 认出应用），变化时发事件；QQ / 微信模块在 Mac 上换成只看未读数的版本。
- NTQQ 的会话列表：等用户愿意时开着 QQ 再验证一次，结论补在这里。

## 做法记录

测试程序是临时写的 Swift 小程序，放在会话的临时目录，没有进仓库：

- 角标：`NSApplication.shared.dockTile.badgeLabel = "7"`，运行 4 秒。
- 读 Dock：`AXUIElementCreateApplication(Dock 的 pid)` → 子元素（`AXList`）→ 每个图标取 `AXTitle` 和 `AXStatusLabel`。
- 微信结构：从 `AXUIElementCreateApplication(微信 pid)` 递归，只统计 `AXRole` 的数量、有文字的元素个数和 1–3 位纯数字的个数，不输出文字。
