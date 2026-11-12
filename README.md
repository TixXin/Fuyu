<div align="center">
  <a href="https://fuyu.ing/logo/"><img src="docs/assets/logo-placeholder.svg" alt="浮屿 Logo 征集中" width="96" height="96"></a>
  <br>
  <sub><a href="https://fuyu.ing/logo/">Logo 征集中，欢迎投稿</a></sub>

  <h1>浮屿 Fuyu</h1>

  <p><a href="README.en.md">English</a> · 中文</p>

  <p>Windows 上的桌面灵动岛：待办、剪贴板、消息、翻译、音乐和 AI 状态，都在屏幕顶部的一座小岛上。</p>

  <p>
    <a href="https://fuyu.ing">官网</a>
    ·
    <a href="https://github.com/TixXin/fuyu/releases/latest">下载</a>
    ·
    <a href="https://github.com/TixXin/fuyu/issues">反馈问题</a>
  </p>

  <p>
    <img alt="Version" src="https://img.shields.io/github/v/release/TixXin/fuyu?label=version">
    <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0078D4">
    <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-24C8DB">
  </p>
</div>

> [!NOTE]
> 本项目由 [TixXin](https://github.com/TixXin) 和 [ShengLin1001](https://github.com/ShengLin1001) 独立维护，2026 年 11 月由 fly-island 改名为浮屿。原作者 [flyl1u](https://github.com/flyl1u/fly-island) 偏向于精简的灵动岛界面；为了进一步丰富灵动岛的功能，让更多用户把自己 DIY 的功能放上岛，本项目开始独立维护，并发展出了插件市场模式。欢迎大家把自己的组件上传到[插件市场](https://github.com/TixXin/fuyu-plugins)，或者在本地安装自己的插件（见[插件文档](docs/plugins/README.md)）。

## 这是什么

浮屿（Fuyu）是一座轻量、无边框、始终置顶的悬浮岛。平时收在屏幕顶部，需要时展开，用完自动收回。常用的东西都放在岛上，不用为了看一眼信息来回切窗口。

## 功能

- **待办与笔记**：每天的任务、当前专注的事项、每日笔记和历史归档。
- **剪贴板与文件中转**：图文剪贴板历史；把文件先拖到岛上暂存，再拖去别的程序。
- **消息**：QQ、微信提醒和多个邮箱，邮件可以直接在岛上阅读和回复。
- **快捷翻译**：一个快捷键打开，支持多家大模型翻译服务。
- **AI Agent**：显示 Claude Code 和 Codex 会话的运行状态，点一下切到对应窗口。
- **音乐**：控制正在播放的媒体，显示音频波形。
- **插件**：从插件市场安装插件来扩展岛屿，敏感数据需要你单独授权。

岛屿的外观、大小、收起方式、快捷键和每个功能都可以在设置窗口里调整，支持应用内自动更新。数据都保存在本机。

## 占用

收起、闲着、不放音乐时（默认设置，不装插件）：CPU 约占单核的 10%（20 核电脑上约占总量的 0.5%），浮屿本身占用的内存约 16 MB。Agent 页每秒刷新一次会话列表，实测只占单核的 0.1%。每装一个 PowerShell 插件约多 60 MB。测量方法和数据见 [idle-usage.md](docs/investigations/idle-usage.md)。

## 上手

1. 从 [Releases](https://github.com/TixXin/fuyu/releases/latest) 下载安装包并安装（安装包没有代码签名，SmartScreen 提示时点「更多信息 → 仍要运行」）。
2. 鼠标移到屏幕顶部的岛上即可展开，点齿轮或托盘图标打开设置。
3. 邮箱、翻译和 AI Agent 需要先在设置里配置一次，具体见各自的说明：[邮箱](docs/features/mail.md)、[AI Agent](docs/features/agent-status-hooks.md)、[QQ 通知](docs/features/qq-notifications.md)、[微信提醒](docs/features/wechat-reminders.md)。

想自己写插件，见 [插件文档](docs/plugins/README.md)。

## 从源码构建

需要 Windows 10/11、Node.js、pnpm、Rust、Visual Studio C++ Build Tools 和 WebView2 Runtime。

```powershell
git clone https://github.com/TixXin/fuyu.git
cd fuyu
pnpm install
pnpm tauri dev      # 开发模式
pnpm tauri build    # 打包安装程序
```

技术栈：Tauri 2、React 19 + TypeScript、Rust。发布与应用内更新见 [docs/features/updater.md](docs/features/updater.md)。

## 开源协议

[GPL-3.0](LICENSE)。插件作者可以自己选协议。第三方依赖和内置资源遵循各自的许可证，内置字体见[字体说明](src/assets/fonts/README.md)。
