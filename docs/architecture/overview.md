# 架构总览

本文描述 浮屿 / Fuyu 的运行时架构、目标代码结构、从现有文件到目标位置的迁移映射，以及对外契约清单。编码规则见 [AGENTS.md](../../AGENTS.md)、[src/AGENTS.md](../../src/AGENTS.md) 和 [src-tauri/AGENTS.md](../../src-tauri/AGENTS.md)，迁移步骤见 [refactor-plan.md](history/refactor-plan.md)，插件系统设计见 [v1-design.md](plugins/v1-design.md) 与 [v2-platform.md](plugins/v2-platform.md)。

## 运行时架构

```text
┌──────────────────────── WebView2（同一前端包，按 ?window= 分发）────────────────────────┐
│  main：悬浮岛    translation：快捷翻译    clipboard：剪贴板    settings：设置    screenshot-<n>：截图 │
│  onboarding：新手引导（新装第一次启动时打开）                                             │
│  drag-grid：拖岛时的中线辅助线（透明、鼠标穿透，拖岛时创建、松手销毁）                    │
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
│           local_api（127.0.0.1 HTTP，内置插件 local-api）                            │
│           mail · qq_notifications · wechat_reminders · translation · settings_window │
│           device_use · system_levels · device_events · system · rename_migration     │
│  后台服务：IMAP IDLE 收信、剪贴板监听、通知监听、微信窗口闪烁检测、鼠标穿透循环        │
└────────────┬─────────────────────────────────────────────────────────────────────────┘
             ▼
   Windows：Win32 / WinRT（SMTC 媒体、音频端点、通知监听、注册表、窗口）、凭据管理器
   macOS（适配中，G1）：平台层 macos/；暂不支持的模块编译成 unsupported 空实现
```

插件平台第 3 版（E36）：开发版、测试版和正式版均默认启动宿主，设 `FUYU_PLUGINS_V3=0` 关掉（E54）；正式版用安装包资源目录里的 `plugins-v3/host` 和 `plugins-v3/builtins`，开发版和 `pnpm build:exe` 用仓库里的源码。Rust 的 `plugin_kernel` 用基座 crate `src-tauri/crates/plugin-base` 找电脑上的 Node（没有就下载到数据目录的 `runtime/`，下载进度和失败显示在设置的插件页，失败了在那里重试），拉起没有界面的宿主进程（`packages/plugin-base` 的 host，跑 `vendor/cordis` 内核），标准输入输出上走 JSON-RPC、心跳、退避重启，用作业对象 / 进程组管住它。窗口经本机 WebSocket（令牌、来源核对、快照和序号）连宿主，插件的界面文件和 React 转接模块由自定义协议 `fuyu-plugin` 提供，前端一侧在 `src/features/plugin-kernel/`。协议和边界见 [v3-boundary.md](plugins/v3-boundary.md)，进度见 [v3-progress.md](plugins/v3-progress.md)。第 2 版插件宿主（`plugin_host`）已删除，只剩 `plugin_kernel/v2_migration.rs`（第 2 版插件）和 `v2_builtins.rs`（第 2 版里内置功能的开关和配置）读旧数据帮老用户迁移。

岛和设置窗口的界面经插槽拼装（E36.2，第 2 阶段）：`src/features/plugin-kernel/slots.ts` 给每个窗口一份不依赖宿主的注册表，设置窗口的部分（E36.3.26 起）在各功能的 `features/<领域>/plugin/settings.tsx`（分类、分节、快捷键页的分节和 `settings.runner/v1` 的接线），由 `windows/settings/slots/categories.tsx` 用 glob 收进来，窗口自己的页面留在那里；岛上的部分（E36.3.25 起）在各功能的 `features/<领域>/plugin/island.tsx`（展开页、页头按钮、收起条、刘海提醒、提示）和 `runners.tsx`（不画界面的接线），由 `windows/island/slots/pluginFiles.ts` 用 glob 收进来（窗口 import 的是 `slots/builtins.ts`：它先载外壳的样式，再载 `pluginFiles.ts`，插件里同优先级的规则才压得过外壳），外壳自己的项（状态灯、重置位置、最小化、设置按钮、第一次提示）留在 `windows/island/slots/`；岛的形状（收起条主行和宽度、贴边保持、弹出、侧边岛的行、提醒）由各功能的 runner 往 `plugin-kernel/islandContributions.ts` 的贡献表里交，外壳只读汇总，不 import 功能（E36.3.51，规则见 [v3-boundary.md](plugins/v3-boundary.md)「岛的贡献表」）；功能只从 `features/plugin-kernel/`（`slots.ts`、`settingsSlots.ts`、`settingsCategories.ts`）拿句柄，不 import 窗口（`tests/unit/feature-boundaries.test.mjs` 检查）；由 `SlotView` 渲染（内置项不加外层，第三方插件的项包 `.plugin-slot`，每项有自己的错误边界）。不设 `FUYU_PLUGINS_V3` 时也走这条路。插槽的名单和规则在 `@fuyu/plugin-base/protocol` 的 `SLOTS`，见 [v3-boundary.md](plugins/v3-boundary.md)「插槽」。

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

功能之间不直接 import（插件平台第 3 版的要求，见 [v3-phase3-plan.md](plugins/v3-phase3-plan.md)「关键设计」第 4 条）。不属于任何一个功能的共享代码在 E36.3.24 与 E36.3.50 上提了：岛屿设置的模型（含日历 `calendarSettings.ts`、歌词 `lyricsSettings.ts`、Agent `agentSettings.ts` 的设置字段与默认值）在 `lib/settings/`，待办项目的类型与规整在 `lib/todo-projects/`，主题、强调色和动效在 `lib/theme/`，快捷键工具在 `lib/shortcut/`，设置文件和备份在 `lib/settings-backup/`，系统权限在 `lib/system-permissions/`，设置页共用的分节在 `windows/settings/sections/`，岛的「第一次」提示在 `windows/island/first-hints/`；原来的 `features/appearance`、`settings-backup`、`system-permissions`、`first-hints` 不再存在。`scripts/feature-boundary-allowlist.json` 已在 E36.3.50 清零，由 `tests/unit/feature-boundaries.test.mjs` 守住零跨功能 import 和零下层反向 import。

## 仓库目录

根 [AGENTS.md](../../AGENTS.md)「目录总览」每个目录只写一行用途，下面是其中几个目录的细节。

- `vendor/`：拷进仓库的第三方代码。`cordis/` 是插件平台第 3 版的内核（Cordis 的 6 个包，npm 构建产物）。不受行数和「不写注释」的约束；版本、上游提交和本地改动记在 [vendor/README.md](../../vendor/README.md)。
- `packages/`：不进入岛屿的发布产物。
  - `plugin-base`：插件平台第 3 版的基座（宿主、插件接口、协议）；不能 import `src/`，有测试检查。
  - 插件开发者工具（pnpm workspace，第 3 版）：`plugin-cli`（命令行，npm 上发成 `fuyu-plugin` 2.x）、`create-plugin`（脚手架，发成 `create-fuyu-plugin` 2.x）、`plugin-manifest`、`plugin-market`、`plugin-review`、`plugin-services`。第 2 版的 SDK、脚手架和 PowerShell 模块已在 E36.6.6 删除。
  - `vscode-extension`：切到会话终端的 VS Code 扩展，不在 workspace 里，`pnpm dlx @vscode/vsce package --no-dependencies` 打包。
- `plugins/`：插件市场，不进入发布产物。
  - `v3/official/` 第 3 版的官方插件。
  - 冻结的第 2 版市场，只给切换到 `TixXin/fuyu-plugins` 之前发布的旧岛屿读，内容不再改（E36.6.6）：`index.json` 与 `index.json.sig` 索引，`revoked.json` 与 `revoked.json.sig` 撤销名单，`packages/` 已签名的 zip；`signing-keys.json`（旧岛屿编译进去的可信公钥）、`legacy-index-key.json`（给索引签名的旧密钥）、`author-key.json`（官方作者公钥）。紧急撤销时用 `pnpm plugins:resign` 重签，见 [market-ops.md](plugins/market-ops.md)。第 2 版的示例插件、草稿、单文件 SDK 和协议描述已删除。
- `scripts/`：
  - `release/` 发布、签名与 `latest.json` 生成；`readme/` 生成仓库首页 README 用的 SVG；`plugins/` 冻结的第 2 版市场的重签；`plugins-v3/` 第 3 版的内置插件构建、宿主打包和 npm SDK 打包。
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
