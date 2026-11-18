# 插件平台第 6 阶段计划：官方插件 v3 重写与第 2 版下线（E36.6）

对应父任务 [E36.6](/docs/tasks/E/E36.6.md)（#296），承接第 4 阶段（[v3-phase4-plan.md](v3-phase4-plan.md)）与第 5 阶段（[v3-phase5-foundation-plan.md](v3-phase5-foundation-plan.md)）。

## 一、两步走策略（先行重写 vs. 满一周期后删旧版）

按 [方案](v3-everything-plugin.md)「分阶段 → 第 6 阶段」与 `E36.6.md` 约定：
- **「删除第 2 版插件系统」是唯一不能靠开关回退的一步**，必须放在第 3 版默认开满一个完整的发版周期之后，并在动手前由用户确认。
- **「用第 3 版新接口重写 7 个官方插件」完全独立于旧系统删除**：新插件源码放在 `plugins/v3/official/<name>/`（包名 `@fuyu/<name>`，去掉旧 `dev.focusd.*` 前缀，含原 E29 的跨平台 Node 化目标），用 TypeScript + React 编写，跑在浮屿自带的 Node 宿主里，Windows 和 macOS 双端通用，可以**立即先行完成**。

因此第 6 阶段拆为两个批次、共 6 个子任务（`E36.6.1–E36.6.6`）：

```text
第一批（立即可做，不碰第 2 版运行态）：
  ├─ E36.6.1 重写待办与计时类官方插件（@fuyu/pomodoro、@fuyu/todo-digest、@fuyu/todo-ring）
  ├─ E36.6.2 重写媒体与网络类官方插件（@fuyu/now-playing、@fuyu/weather、@fuyu/github-issues）
  └─ E36.6.3 重写系统监控官方插件（@fuyu/system-monitor）与 7 个官方插件联合构建/宿主测试

第二批（等第 3 版默认开满一个发版周期、用户确认后执行）：
  ├─ E36.6.4 旧版已装插件迁移引导与一次性升级提示
  ├─ E36.6.5 删除第 2 版 Rust 宿主（plugin_host）与前端模块（features/plugins、plugin-views）
  └─ E36.6.6 删除第 2 版 SDK/模板/旧示例与旧名兼容（D81 C 类），更新 contracts.md 并收口 E36
```

---

## 二、7 个官方插件的 v3 重写对照表（第一批 E36.6.1–E36.6.3）

旧版 7 个官方示例（`plugins/examples/dev.focusd.*`）全部用 PowerShell 编写，macOS 上要装 PowerShell 7 才能跑，且 `todo-ring` 用的是旧 WebView 自定义 HTML。重写后统一放在 `plugins/v3/official/<name>/`，包名为官方作用域 `@fuyu/<name>`（`publisher.official: true`，免作者私钥签名、由受保护的 `main` 背书），`platforms: ["windows", "macos"]`：

| 旧第 2 版 ID | 新第 3 版包名 | 目录 | 用到的 v3 服务（`inject.required`） | 用到的 v3 插槽 / 命令 | 改动要点 |
|---|---|---|---|---|---|
| `dev.focusd.pomodoro` | `@fuyu/pomodoro` | `plugins/v3/official/pomodoro` | `timers/v1`、`todos/v1`、`messages/v1` | `island.page/v1`、`island.collapsed/v1`、命令 `start` / `stop` | 复用脚手架番茄钟结构并增强：支持关联当前待办、展示已完成轮数（存于 `ctx.dataDir`）、到点经 `messages/v1` 弹通知 |
| `dev.focusd.todo-digest` | `@fuyu/todo-digest` | `plugins/v3/official/todo-digest` | `todos/v1`、`messages/v1` | `settings.section/v1`、命令 `write-digest` | 监听 `todos/v1` 的 `changed` 统计未完成待办，执行 `write-digest` 时将未完成清单追加到当日 `note` 并弹完成通知 |
| `dev.focusd.todo-ring` | `@fuyu/todo-ring` | `plugins/v3/official/todo-ring` | `todos/v1` | `island.page/v1`、`island.collapsed/v1` | 告别旧版 iframe/webview，直接用 React 组件 + `--fuyu-plugin-*` 主题变量画今日待办完成进度环与待办列表 |
| `dev.focusd.now-playing` | `@fuyu/now-playing` | `plugins/v3/official/now-playing` | `media/v1`、`messages/v1` | `settings.section/v1`、命令 `show` | 订阅 `media/v1` 的 `changed` 事件，支持手动触发或切歌时经 `messages/v1` 在岛上提示歌名与歌手 |
| `dev.focusd.weather` | `@fuyu/weather` | `plugins/v3/official/weather` | `messages/v1` | `island.page/v1`、`island.collapsed/v1`、`settings.section/v1`、命令 `refresh` | 声明 `fuyu.network: ["api.open-meteo.com", "geocoding-api.open-meteo.com"]`，设置城市后拉取实时天气、逐小时与 7 天预报，降雨预警经 `messages/v1` 提醒 |
| `dev.focusd.github-issues` | `@fuyu/github-issues` | `plugins/v3/official/github-issues` | `messages/v1` | `island.page/v1`、`settings.section/v1`、命令 `refresh` | 声明 `fuyu.network: ["api.github.com"]`，列出所配仓库未关闭的 issue，点击打开浏览器 |
| `dev.focusd.system-monitor` | `@fuyu/system-monitor` | `plugins/v3/official/system-monitor` | —（声明 `fuyu.nodeApis: ["os"]`） | `island.page/v1`、`island.collapsed/v1`、`settings.section/v1` | 用 Node `node:os`（CPU 核心负载、内存占用、运行时间）在 Windows 和 macOS 双端免外部依赖运行，提供展开监控页与收起条指标 |

---

## 三、子任务拆分与验收标准

### E36.6.1：重写待办与计时类官方插件（`@fuyu/pomodoro`、`@fuyu/todo-digest`、`@fuyu/todo-ring`）
- **范围**：`plugins/v3/official/pomodoro/`、`plugins/v3/official/todo-digest/`、`plugins/v3/official/todo-ring/`
- **内容**：
  1. 建立三个官方 v3 插件目录，各自包含 `package.json`（`@fuyu/*`）、`src/`、`assets/icon.svg`、`README.md`、`LICENSE`。
  2. 实现宿主逻辑与窗口插槽组件，样式只用 `--fuyu-plugin-*` 主题变量。
- **验收**：三个插件均通过 `fuyu-plugin check --market`（`official: true`）与 `fuyu-plugin pack`，并在宿主单元测试中加载运行。

### E36.6.2：重写媒体与网络类官方插件（`@fuyu/now-playing`、`@fuyu/weather`、`@fuyu/github-issues`）
- **范围**：`plugins/v3/official/now-playing/`、`plugins/v3/official/weather/`、`plugins/v3/official/github-issues/`
- **内容**：
  1. 实现 `@fuyu/now-playing`（基于 `media/v1` + `messages/v1`）。
  2. 实现 `@fuyu/weather`（Open-Meteo，显式声明 `fuyu.network`）与 `@fuyu/github-issues`（显式声明 `fuyu.network: ["api.github.com"]`）。
- **验收**：三个插件均通过 `fuyu-plugin check --market`（`official: true`）、审核分析器无未声明域名或敏感能力告警，并在宿主测试中跑通。

### E36.6.3：重写系统监控官方插件（`@fuyu/system-monitor`）与官方插件全集测试
- **范围**：`plugins/v3/official/system-monitor/`、`tests/unit/official-plugins-v3.test.mjs`
- **内容**：
  1. 实现跨平台 `@fuyu/system-monitor`（基于 `node:os` 采样 CPU 与内存，支持展开页与收起条）。
  2. 编写 `tests/unit/official-plugins-v3.test.mjs`，对全部 7 个 `@fuyu/*` 官方插件执行 `check`、`build`、`pack`（`official: true`）、`review` 扫描与 `startHost` 挂载验证。
- **验收**：7 个官方插件全部零错误打包并在 `startHost` 中进入 `running` 状态。

### E36.6.4：旧版已装插件迁移引导与一次性升级提示（等用户确认下线第 2 版后执行）
- **范围**：`src-tauri/src/plugin_kernel/`、`src/windows/settings/`、`src/i18n/`
- **内容**：
  1. 扫描旧 `plugins.json` 中已启用的 `dev.focusd.*` 官方插件，自动在 `plugins-v3/plugins.yml` 引导对应 `@fuyu/*` 插件。
  2. 若用户装有其他第 2 版插件，在岛上和插件设置页给出一次性升级说明。
- **验收**：旧 `dev.focusd.*` 配置能平滑映射，一次性提示不重复打扰。

### E36.6.5：删除第 2 版插件宿主与前端模块（已完成，2026-11-18）
- **范围**：`src-tauri/src/plugin_host/`、`src/features/plugins/`、`src/features/plugin-views/`、`src-tauri/src/plugin_kernel/v2_builtins.rs`
- **内容**：
  1. 移除 Rust 侧 `src-tauri/src/plugin_host/` 及其 Tauri 命令、链接协议 `focusd://` 分发。
  2. 移除前端 `src/features/plugins/`、`src/features/plugin-views/` 与第 2 版插件设置页、市场页旧实现。
- **验收**：`cargo test`、`pnpm check`、`pnpm build` 与回归页全部通过。
- **结果**：Rust 侧 `plugin_host`、`v2_builtins.rs` 与各功能的 v2 `plugin_view.rs` 全部删除，`v2_migration.rs` 改为直接读旧数据；主题市场从旧宿主抽到 `src-tauri/src/theme_market.rs`。前端删掉 `features/plugins`、`features/plugin-views`、`features/plugin-dev`、第 2 版设置页与侧栏里的「插件」「插件市场」入口，插件命令快捷键由第 3 版的 `fuyu.commands` 接管，岛上的插件页面、收起条状态、权限提示和右键菜单随旧宿主一起撤掉。回归页 `plugin-info`、`plugin-menus`、`plugin-views` 删除，其余页面按第 3 版插槽重写。

### E36.6.6：删除第 2 版 SDK/模板/旧示例与旧名兼容并收口 E36（等用户确认下线第 2 版后执行）
- **范围**：`packages/fuyu-plugin`、`packages/create-fuyu-plugin`、`packages/powershell`、`plugins/`（旧 v2 文件）、`scripts/plugins/`、`packages/plugin-cli/src/keys.mjs`、`docs/architecture/contracts.md`、`docs/architecture/plugins/v3-progress.md`
- **内容**：
  1. 删除 `packages/fuyu-plugin`、`packages/create-fuyu-plugin`、`packages/powershell`、`plugins/examples/dev.focusd.*`、`plugins/drafts/`、`plugins/sdk/`、`plugins/schema/`、`plugins/index.json*`、`plugins/revoked.json*`。
  2. 清理 `D81` C 类旧名兼容（`Focusd` PowerShell 别名、`FOCUSD_*` 脚本变量）以及 `packages/plugin-cli` 的 `~/.fly-island-plugin/` 旧私钥位置兼容（先确认 Windows 私钥已迁新位置）。
  3. 从 `contracts.md` 移除第 2 版插件契约，更新 `v3-progress.md`，归档 `E36.6` 与 `E36`。
- **验收**：全仓无第 2 版插件残留与 `dev.focusd.*` 插件 ID，`pnpm check` 与 `cargo test` 全部通过。
