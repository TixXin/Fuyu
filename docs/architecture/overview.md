# 架构总览

本文描述 浮屿 / Fuyu 的运行时架构、目标代码结构、从现有文件到目标位置的迁移映射，以及对外契约清单。编码规则见 [AGENTS.md](../../AGENTS.md)、[src/AGENTS.md](../../src/AGENTS.md) 和 [src-tauri/AGENTS.md](../../src-tauri/AGENTS.md)，迁移步骤见 [refactor-plan.md](history/refactor-plan.md)，插件系统设计见 [v1-design.md](plugins/v1-design.md) 与 [v2-platform.md](plugins/v2-platform.md)。

## 运行时架构

```text
┌──────────────────────── WebView2（同一前端包，按 ?window= 分发）────────────────────────┐
│  main：悬浮岛    translation：快捷翻译    clipboard：剪贴板    settings：设置    screenshot-<n>：截图 │
└────────────┬─────────────────────────────────────────────────────────────────────────┘
             │ invoke（命令，请求/响应）        ▲ emit / emit_to（事件，后端主动推送）
             ▼                                │
┌──────────────────────────────── Rust（Tauri 2）──────────────────────────────────────┐
│  lib.rs 组装：插件 / setup / 托盘 / collect_commands!（汇总各模块的 tauri_commands!） │
│  领域模块：island · todos · calendar · media_control · lyrics · clipboard_history     │
│           file_shelf · screenshot · agent_status · agent_approval · phone_push       │
│           pets（只读的 Codex Pets 宠物包）· claude_usage（可选经代理查 oauth/usage）  │
│           ssh_tunnel（内置插件：每台主机一条常驻 ssh -R，把本机代理借给服务器）      │
│           cc_connect（内置插件：找 cc-connect、读它的会话列表，经它把推送发到手机）  │
│           local_api（127.0.0.1 HTTP，内置插件 focusd.local-api）                     │
│           plugin_host（插件子进程，stdio JSON-RPC，市场与签名，独立 WebView2 页面）  │
│           mail · qq_notifications · wechat_reminders · translation · settings_window │
│           device_use · system_levels · device_events · system · rename_migration     │
│  后台服务：IMAP IDLE 收信、剪贴板监听、通知监听、微信窗口闪烁检测、鼠标穿透循环        │
└────────────┬─────────────────────────────────────────────────────────────────────────┘
             ▼
   Windows：Win32 / WinRT（SMTC 媒体、音频端点、通知监听、注册表、窗口）、凭据管理器
```

各项数据存在哪里见 [data-storage.md](data-storage.md)。

## 目标结构

前端和 Rust 的目标目录树，以及各目录的职责，分别见 [src/AGENTS.md](../../src/AGENTS.md#目标结构) 和 [src-tauri/AGENTS.md](../../src-tauri/AGENTS.md#目标结构)。本文只记录迁移映射。

### 前端依赖方向

```text
main.tsx → windows/ → features/ → components/、lib/、utils/、i18n/、styles/
```

## 其他文档

- [data-storage.md](data-storage.md)：每项数据存在哪里、由哪个模块负责
- [contracts.md](contracts.md)：对外契约清单（localStorage key、事件、命令与文件格式）
- [migration-map.md](migration-map.md)：结构重构时旧文件到新位置的对照
