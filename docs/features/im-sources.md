# 多款即时通讯软件消息上岛

除 QQ、微信与多邮箱外，浮屿内置支持 **Telegram、Discord、WhatsApp、TIM、飞书（含 Lark）、钉钉、企业微信** 7 款桌面聊天软件的消息提醒上岛（C102，#642 / #778–#780）。

## 开启与设置

1. 打开「设置 → 消息 → 即时通讯」，在「更多聊天软件」分组中开启需要上岛的应用开关。
2. **默认策略**：7 个新来源在新安装与旧版升级时**一律默认关闭**，不打扰原有配置；本机已检测到的应用自动排在分组前面并标注「已安装」。未开启的来源保持单行显示，开启后展开细项。
3. **TIM 在 macOS 上的显示规则**：鉴于腾讯官网已下架原生 macOS 版 TIM，macOS 默认隐藏 TIM 项，仅当检测到本机装有历史版 `com.tencent.tim`（或该开关已被开启）时才显示。
4. 开关与「看过后从岛上去掉」（默认开）均保存在内置插件 `messages` 的配置（`plugins-v3/plugins.yml` 的 `messages.config`）中：
   - 来源开关：`telegram`、`discord`、`whatsapp`、`tim`、`feishu`、`dingtalk`、`wecom`（布尔，缺省 `false`）；
   - 自动清除开关：`<source>AutoClear`（布尔，缺省 `true`）。

## 双端监听与展示形态

开启某款软件后，它与 QQ、微信共用岛上的收起条预览、新消息横幅、自动展开到达面板、页头消息圆点、侧边栏未读计数与消息页顶部来源导航栏（开启超过 3 个来源时导航栏自动切换为紧凑间距并支持滚轮/触控板/键盘横向滚动）：

- **Windows（Toast 正文优先 + 任务栏闪烁兜底）**：
  - 共用单实例 `UserNotificationListener` 轮询（按通知 `Id` 缓存跨进程 `AppInfo`，避免重复 COM 调用）和 `RegisterShellHookWindow` 任务栏闪烁监听，所有相关来源关闭时线程立即退出。
  - 当客户端发出标准 Windows 系统通知（`kind: "toast"`）时，岛上展示品牌图标、发送人/群名与消息摘要，支持悬停复制消息文本及横幅/到达面板一键复制验证码。
  - 当客户端处于软件自绘弹窗模式（如 Telegram Windows 版默认设置，或部分版本的 TIM、飞书、钉钉、企业微信）仅触发 `HSHELL_FLASH` 而未发系统通知时，自动退化生成「有新提醒」条目（`kind: "flash"`）；若 2 秒内同一来源补发了真实系统 Toast，后端通过 `replacedId` 将闪烁条目原位升级为真实正文卡片，横幅与到达面板不重复计数、不留空白残影。
  - **显示发送人与正文的客户端设置建议**：若只看到「有新提醒」，可在对应桌面客户端设置中打开系统通知（例如 Telegram Desktop：「Settings → Notifications and Sounds → Use Windows notifications」），并确保 Windows「系统 → 通知」允许该应用与浮屿访问通知。
  - **企业微信与微信隔离**：企业微信（`WXWork.exe`）仅使用系统通知与任务栏闪烁，绝不触碰微信 4.x 专用的内存界面公开逻辑（`wechat_reminders/gate.rs`）。
- **macOS（程序坞角标共享轮询）**：
  - 共用单线程每 3 秒遍历一次程序坞（`com.apple.dock`）的 `AXStatusLabel`，一次性匹配全部已开启来源的候选 Bundle ID（如 Telegram 同时覆盖官网/App Store 原生版 `ru.keepcoder.Telegram` 与跨平台版 `com.tdesktop.Telegram`，飞书覆盖 `com.electron.lark` 与 `com.larksuite.larkApp`）。
  - 角标未读数增加时在岛上产生「N 条未读」提醒（`kind: "badge"`）；需要对应应用保持运行并在「系统设置 → 隐私与安全性 → 辅助功能」中允许浮屿。

通知与提醒仅保留在本次运行的内存中（每个来源最多 20 条），退出即清空，不会删除系统通知中心或聊天软件内的消息。

## 点击唤起与看过后自动去掉

点击收起条预览、横幅、到达面板卡片或消息页列表项时，调用 `open_im_source(source)` 打开对应客户端：

- **Windows 三级唤起**：
  1. 优先查找已运行且可见、可交互的顶层主窗口（过滤过小的登录框/悬浮窗）并直接前置激活；
  2. 对 Microsoft Store 打包应用（如 WhatsApp Desktop、商店版 Telegram），调用公开的 `IApplicationActivationManager::ActivateApplication` 激活；
  3. 对已注册系统 URL 协议的单实例客户端（`tg://`、`discord://`、`whatsapp://`、`feishu://` / `lark://`、`dingtalk://`、`wxwork://`），通过协议请客户端自行从托盘恢复主窗口（经典 `TXGuiFoundation` 架构下的 TIM 收进托盘时提示从系统托盘打开，不强行 `ShowWindow` 隐藏窗口或拉起第二个登录框）。
- **macOS 唤起**：按候选 Bundle ID 依次通过系统打开已安装的应用。
- **看过后从岛上去掉**（默认开）：当对应应用窗口被切到前台、macOS 程序坞未读角标清零、或从岛上成功点开该应用后，自动移除该时刻之前到达的提醒，之后新到的提醒保留。

## Windows 只读通知与闪烁探测

在 Windows 真机核对各客户端真实 `AppUserModelId`、显示名与任务栏闪烁事件时，可在仓库根目录运行只读探测工具（不修改系统设置，不输出或落盘任何聊天正文）：

```powershell
cargo run --manifest-path src-tauri/Cargo.toml --example im_notification_probe -- --watch-seconds 30
```
