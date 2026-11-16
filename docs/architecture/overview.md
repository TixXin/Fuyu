# 架构总览

本文描述 浮屿 / Fuyu 的运行时架构、目标代码结构、从现有文件到目标位置的迁移映射，以及对外契约清单。编码规则见 [AGENTS.md](../../AGENTS.md)、[src/AGENTS.md](../../src/AGENTS.md) 和 [src-tauri/AGENTS.md](../../src-tauri/AGENTS.md)，迁移步骤见 [refactor-plan.md](history/refactor-plan.md)，插件系统设计见 [v1-design.md](plugins/v1-design.md) 与 [v2-platform.md](plugins/v2-platform.md)。

## 运行时架构

```text
┌──────────────────────── WebView2（同一前端包，按 ?window= 分发）────────────────────────┐
│  main：悬浮岛    translation：快捷翻译    clipboard：剪贴板    settings：设置    screenshot-<n>：截图 │
│  onboarding：新手引导（新装第一次启动时打开）                                             │
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
   macOS（适配中，G1）：平台层 macos/；暂不支持的模块编译成 unsupported 空实现
```

插件平台第 3 版（E36，开发中，默认关）：设了 `FUYU_PLUGINS_V3=1` 才启动，开发版和正式版一样；正式版用安装包资源目录里的 `plugins-v3/host` 和 `plugins-v3/builtins`，开发版和 `pnpm build:exe` 用仓库里的源码。Rust 的 `plugin_kernel` 用基座 crate `src-tauri/crates/plugin-base` 找电脑上的 Node（没有就下载到数据目录的 `runtime/`），拉起没有界面的宿主进程（`packages/plugin-base` 的 host，跑 `vendor/cordis` 内核），标准输入输出上走 JSON-RPC、心跳、退避重启，用作业对象 / 进程组管住它。窗口经本机 WebSocket（令牌、来源核对、快照和序号）连宿主，插件的界面文件和 React 转接模块由自定义协议 `fuyu-plugin` 提供，前端一侧在 `src/features/plugin-kernel/`。协议和边界见 [v3-boundary.md](plugins/v3-boundary.md)，进度见 [v3-progress.md](plugins/v3-progress.md)。旧的 `plugin_host` 冻结，只修 bug。

岛和设置窗口的界面经插槽拼装（E36.2，第 2 阶段）：`src/features/plugin-kernel/slots.ts` 给每个窗口一份不依赖宿主的注册表，内置功能在 `windows/island/slots/`、`windows/settings/slots/` 和各设置页文件里同步注册，由 `SlotView` 渲染（内置项不加外层，第三方插件的项包 `.plugin-slot`，每项有自己的错误边界）。不设 `FUYU_PLUGINS_V3` 时也走这条路。插槽的名单和规则在 `@fuyu/plugin-base/protocol` 的 `SLOTS`，见 [v3-boundary.md](plugins/v3-boundary.md)「插槽」。

### 平台层

- 系统 API 的 `unsafe` 调用只放在平台层：`src-tauri/src/win32/`（Windows）和 `src-tauri/src/macos/`（macOS，决定 M10）。业务模块不直接调系统 API。
- 两个平台都有的能力（进程树、进程启动时间、可执行文件路径、进程环境变量、程序图标、作业对象）在 `win32/` 和 `macos/` 里用同名模块和同样的函数签名，业务代码经 `src-tauri/src/platform.rs` 引用，不写 `cfg`。
- 只在 Windows 上有的模块，在 `lib.rs`（或所在模块的 `mod` 声明）上用 `#[cfg_attr(not(windows), path = "…unsupported.rs")]` 换成 Mac 上的空实现：命令名、参数和其他模块用到的函数保持不变，命令返回错误码 `platform.unsupported`（`user_error::unsupported_commands!` 批量生成）或无害的默认值。Windows 上原文件一行不改。
- 只差几处的文件在原处用 `#[cfg(windows)]` / `#[cfg(not(windows))]` 写两份函数。
- 各功能在每个平台上的状态见 [platforms.md](platforms.md)，迁移表见 [macos-port-plan.md](macos-port-plan.md)「第 0 步的迁移表」。

各项数据存在哪里见 [data-storage.md](data-storage.md)。

## 目标结构

前端和 Rust 的目标目录树，以及各目录的职责，分别见 [src/AGENTS.md](../../src/AGENTS.md#目标结构) 和 [src-tauri/AGENTS.md](../../src-tauri/AGENTS.md#目标结构)。本文只记录迁移映射。

### 前端依赖方向

```text
main.tsx → windows/ → features/ → components/、lib/、utils/、i18n/、styles/
```

功能之间不直接 import（插件平台第 3 版的要求，见 [v3-phase3-plan.md](plugins/v3-phase3-plan.md)「关键设计」第 4 条）。不属于任何一个功能的共享代码在 E36.3.24 上提了：岛屿设置的模型在 `lib/settings/`，主题、强调色和动效在 `lib/theme/`，快捷键工具在 `lib/shortcut/`，设置文件和备份在 `lib/settings-backup/`，系统权限在 `lib/system-permissions/`，设置页共用的分节在 `windows/settings/sections/`，岛的「第一次」提示在 `windows/island/first-hints/`；原来的 `features/appearance`、`settings-backup`、`system-permissions`、`first-hints` 不再存在。`lib/settings/` 是唯一反过来 import 功能的地方：日历、歌词、待办项目那一份设置留在功能里，由它汇总成 `IslandSettings`。还剩的跨功能 import 记在 `scripts/feature-boundary-allowlist.json`，由 `tests/unit/feature-boundaries.test.mjs` 检查，只减不增，第 3 阶段结束时清零。

## 仓库目录

根 [AGENTS.md](../../AGENTS.md)「目录总览」每个目录只写一行用途，下面是其中几个目录的细节。

- `vendor/`：拷进仓库的第三方代码。`cordis/` 是插件平台第 3 版的内核（Cordis 的 6 个包，npm 构建产物）。不受行数和「不写注释」的约束；版本、上游提交和本地改动记在 [vendor/README.md](../../vendor/README.md)。
- `packages/`：不进入岛屿的发布产物。
  - `plugin-base`：插件平台第 3 版的基座（宿主、插件接口、协议）；不能 import `src/`，有测试检查。
  - 插件开发者工具（pnpm workspace）：`fuyu-plugin`（Node SDK、CLI、模拟宿主）、`create-fuyu-plugin`（脚手架）、`powershell/Fuyu.Plugin`。
  - `vscode-extension`：切到会话终端的 VS Code 扩展，不在 workspace 里，`pnpm dlx @vscode/vsce package --no-dependencies` 打包。
- `plugins/`：插件市场，不进入发布产物。
  - `examples/` 示例插件源码（PowerShell，含 `lib/focusd.ps1`）。
  - `drafts/` 写好了、还没打包签名的官方插件（签名私钥只在 Windows 那台机器上，说明见 [plugins/drafts/README.md](../../plugins/drafts/README.md)）。
  - `schema/` 协议描述；`market/` 每个市场插件的元数据（发布者、分类，生成索引用）；`sdk/` 单文件 SDK（`pnpm sdk:build` 从 `packages/` 生成）；`packages/` 打包好的 zip。
  - `index.json` 与 `index.json.sig`：给切换前的旧版岛屿的市场索引（`pnpm plugins:index` 生成；新版岛屿读 `TixXin/fuyu-plugins`）。
  - `signing-keys.json` 可信公钥（编译进岛屿），`revoked.json` 与 `revoked.json.sig` 撤销名单，`author-key.json` 官方作者签名公钥。
- `scripts/`：
  - `release/` 发布、签名与 `latest.json` 生成；`readme/` 生成仓库首页 README 用的 SVG；`plugins/` 插件索引、签名与 SDK 生成。
  - `mq/` 攒批开 PR 合入（`pnpm mq:*` 和 pre-push 检查）；`island-lab/` 岛屿实验台（`pnpm lab`）；`progress/` 进度汇总（`pnpm progress`）。
  - 根目录放开发流程脚本：合并队列的检查（`land-check.mjs`）、门禁钩子（`gate/`，Claude Code 的 PreToolUse 钩子，登记在 `.claude/settings.json`：第一次改 `src/`、`src-tauri/`、各家 AI 代理的接入点等之前拦一次，要求先读规则文件或加载 skill，见 [workflow.md](workflow.md)「门禁钩子」）、行数检查、浏览器回归页运行器（`run-regression.mjs`）、dev 前停止运行中的岛屿。
- `video/`：宣传视频。真的前端加假后端在浏览器里跑，按时间表逐帧渲染成 MP4；自带 `package.json`，不在 workspace 里（用法见 [video/README.md](../../video/README.md)）；成片不进仓库。
- `.githooks/`（`core.hooksPath` 指向这里）：
  - `pre-push`：合并队列的推送保护与检查。
  - `pre-commit`：在 `main` 上提交必须写文件名（`git commit -- <文件>`），免得带走别的会话暂存的改动。
  - `commit-msg`：拒绝 Claude 署名行（只管本仓库自己的提交，合入的外部 PR 可以带）。
- `docs/`：按文档性质分目录，索引和各目录放什么见 [docs/README.md](../README.md)。`features/` 功能说明，`architecture/` 架构与契约（`agent/`、`plugins/` 内部设计，`history/` 做完的计划），`design/` 界面约定，`plugins/` 插件开发，`investigations/` 自己应用的排查与验收，`research/` 外部调研，`reviews/` PR 评审，`releases/` 发布说明，`assets/` 演示视频与图片，`tasks/` 任务（`README.md` 是规则，按编号首字母分文件夹，`0-archive/` 放已结束的）。

## 其他文档

- [data-storage.md](data-storage.md)：每项数据存在哪里、由哪个模块负责
- [contracts.md](contracts.md)：对外契约清单（localStorage key、事件、命令与文件格式）
- [migration-map.md](migration-map.md)：结构重构时旧文件到新位置的对照
