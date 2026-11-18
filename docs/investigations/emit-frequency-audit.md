# Rust 侧 `emit` 频率核查与去重报告（D49 / #257）

> 日期：2026-11-17 | 关联任务：[D49](/docs/tasks/0-archive/D/D49.md)、[D49.1](/docs/tasks/0-archive/D/D49.1.md)、[D52](/docs/tasks/0-archive/D/D52.md) | 关联 Issue：[#257](https://github.com/TixXin/Fuyu/issues/257)

## 一、背景与 Tauri 2.12 派发机制核实

上游问题 `tauri-apps/tauri#12724` 指出：Rust 调用 `emit` / `emit_to` 向 WebView 推送事件时，Tauri 会在 `tauri::event::emit_js_script` 中将 JSON 负载直接拼入一段匿名自执行脚本并通过 `eval` 执行：

```js
(function () { const fn = window['...']; fn && fn({event: '...', payload: <JSON>}, [ids]) })()
```

在 Windows WebView2 下，每次内容不同的内联脚本字符串都会残留约 0.75 KB 不可被 GC 回收的脚本元数据。经核查本仓库使用的 `tauri 2.12.5`（`tauri::event::listener::Listeners::emit_js_filter`）：

1. **按监听器过滤窗口**：只有当前已调用前端 `listen(event, ...)` 注册监听的 WebView 才会执行 `emit_js`。
2. **自定义协议与 `invoke` 不受影响**：前端主动调用 `invoke(...)` 拉取状态（如 Agent 状态、音频峰值、剪贴板列表）以及插件平台第 3 版宿主与窗口之间的本地 WebSocket 通信均不经过 `eval` 内联脚本路径。

---

## 二、诊断计数能力（`emit_diagnostics`）

新增 [emit_diagnostics.rs](/src-tauri/src/emit_diagnostics.rs)（仅在 `cfg(any(debug_assertions, test))` 编译，发布产物零开销）：

- 启动方式：`FUYU_EMIT_DIAGNOSTICS=1`（可选 `FUYU_EMIT_DIAGNOSTICS_INTERVAL_SECS=15`、`FUYU_EMIT_DIAGNOSTICS_PATH=<path>`），默认输出至 `<系统临时目录>/Fuyu-emit-diagnostics/emit-<pid>.json`。
- 统计维度：对全仓 84 个已知事件名注册全局监听，按总次数降序记录每个事件的 `total`（总发送次数）、`duplicates`（连续相同负载次数）、`distinctPayloads`（不同 JSON 负载哈希数，直接对应 WebView2 新增内联脚本上限）和 `perMinute`（每分钟频率）。

---

## 三、全仓 84 个事件分类与三种场景每分钟频率清单

对 `src-tauri/src/` 全部 `emit` / `emit_to` 调用点逐一排查后，三种典型场景下的每分钟发送次数如下：

### 1. 收起闲置（鼠标静止或正常桌面办公移动）

| 事件名 | 模块 | 优化前（次/分钟） | 优化后（次/分钟） | 不同负载数/分钟（优化后） | 说明 |
|---|---|---:|---:|---:|---|
| `island-cursor-moved` | `island/passthrough*.rs` | 静止 `0`；开启「眼睛」且在桌面移动鼠标时最高 **~1,666**（36ms 间隔、0.1px 精度，且阻塞 48ms 降频） | 静止 **`0`**；贴边收起 **`0`**；岛内移动 **`0`**（走原生 `mousemove`）；桌面远端移动 **≤ 416**（48ms×3 = 144ms，24px 网格量化去重） | 静止 **`0`**；远端移动有限网格复用 | D49 移除 `tracking` 对远离舞台 48ms 降频的阻塞，岛内与贴边收起停发，远区 24px / 近区 4px 量化去重 |
| `sync-status-changed` | `sync/engine.rs` | `0.2`（每 5 分钟无条件广播一次，未开启同步也发） | **`0`** | **`0`** | D49.1 改为仅当 `SyncStatus` 实际变化时发送 |
| `island-hover-changed` / `island-banner-hover-changed` | `island/passthrough*.rs` | 仅进出岛边界时 `0–2` | **`0–2`**（布尔值，最多 2 种负载） | **≤ 2** | 已有 `is_inside != was_inside` 去重 |
| `foreground-fullscreen-changed` | `system/fullscreen.rs` | `0`（仅全屏状态翻转时触发，原为全局 `app.emit`） | **`0`**（改为 `emit_to("main")`） | **`0`** | 已有状态比对去重，D49 收窄为仅发往 `main` |
| `system-level-changed` / `device-alert` | `system_levels` / `device_events` | 音量、亮度、外设不变时 `0` | **`0`** | **`0`** | `LevelTracker` / `OutputTracker` 已去重；Windows 音量已由 D52 改为 `IAudioEndpointVolumeCallback` 回调 |
| 其余瞬态交互事件（拖拽、调整尺寸、截图、剪贴板快捷键等） | 各模块 | 闲置均为 `0` | **`0`** | **`0`** | 仅用户触发操作时发送；`drag_grid_window` 补齐同状态去重，前端 `useIslandResize` / `IslandDragHint` / `PatternEyes` 接入 16ms 节流（M7） |

> **闲置结论：** 鼠标静止收起闲置时，每分钟发往 WebView 的事件数与不同负载数均为 **0**；即使开启默认「眼睛」中心图案并在桌面其他窗口持续移动鼠标，穿透线程也恢复 48ms 低频唤醒，岛内与贴边收起 0 发送，远端坐标经 24px 网格量化后消除了亚像素抖动带来的海量唯一脚本。

### 2. 放音乐（后台持续播放音频，每 3–4 分钟切一首歌）

| 事件名 | 模块 | 优化前（次/分钟） | 优化后（次/分钟） | 不同负载数/分钟（优化后） | 说明 |
|---|---|---:|---:|---:|---|
| `media-session-changed` | `media_control/events*.rs` | 切歌/暂停时 `0.3–1`（部分播放器重复触发 `PlaybackInfoChanged` 会偏高） | **`0.3–0.5`**（仅曲目或播放状态实际变化时发送） | **`0.3–0.5`**（每次带切歌时间戳 `at`） | `events.rs` 按曲目名与播放状态去重（D52），macOS `adapter_macos.rs` 已忽略 `elapsedTime` 等 `Change::Other` 进度差分 |
| 音频电平 / 播放进度 | `media_control` + 前端 `useMediaState` / `useAudioLevel` | `0`（走前端 `invoke("get_media_state")` / `get_audio_level`，窗口隐藏时由 `visibilityInterval` 暂停） | **`0`** | **`0`** | 走 `ipc://localhost` 命令响应，不产生 `emit` 内联脚本 |

> **放音乐结论：** 音乐播放期间每分钟 `emit` 仅在切歌或暂停/继续时触发（约 **0.3–0.5 次/分钟**），歌词滚动与波形电平全部走前端按可见性暂停的 `invoke` 拉取，不随播放时长线性泄漏脚本。

### 3. 有 Agent 会话（Claude Code / Codex / 多子会话持续运行）

| 事件名 | 模块 | 优化前（次/分钟） | 优化后（次/分钟） | 不同负载数/分钟（优化后） | 说明 |
|---|---|---:|---:|---:|---|
| Agent 运行状态、会话列表、用量环、耗时计时 | `agent_status` / `claude_usage` | `0`（全部由前端按可见性通过 `invoke` 拉取或经 v3 WebSocket 服务推送） | **`0`** | **`0`** | Rust 侧无周期性 Agent 状态 `emit` |
| `agent-approval-requested` / `agent-approval-closed` | `agent_approval/mod.rs` | 仅工具请求人工审批开关时触发（约 `0–2`） | **`0–2`**（仅审批弹窗出现/关闭时发送，必须实时送达主岛） | **`0–2`** | 用户交互必需的低频离散事件 |
| `plugin-view-changed` | `plugin_host/views.rs` | v2 插件关闭时 `0`；开启时已有 120ms 槽位合并且仅面板可见（`store.visible`）时发送 `view` | **`0`**（收起态不可见面板不发） | **`0`** | 已按可见性与槽位节流 |

> **有 Agent 会话结论：** Agent 会话运行与思考期间周期状态不走 `emit`，仅在人工审批弹窗开关时发送离散事件（0–2 次/分钟）。

---

## 四、本次改动汇总（D49 + D49.1 + M7）

1. **诊断构建事件统计（`8c3d7730`）**：新增 `src-tauri/src/emit_diagnostics.rs`，支持 `FUYU_EMIT_DIAGNOSTICS=1` 按频率排序输出全事件计数与不同负载哈希数。
2. **游标追踪降频与量化去重（D49）**：
   - `passthrough.rs`（Windows）与 `passthrough_macos.rs`（macOS）移除 `tracking` 对 `active` 快轮询（12ms）的强制锁定，光标离开舞台唤醒区后恢复 48ms 休眠；
   - 光标在岛内（已有前端 `mousemove`）或岛处于贴边收起（`is_tucked`）时停发 `island-cursor-moved`；
   - 新增 `geometry::gaze_cursor_point` 对近区（4px）与远区（24px）坐标网格量化，配合 `last_cursor` 去重。
3. **状态去重与精准投递（D49 + D49.1）**：
   - `sync/engine.rs`、`plugin_kernel/builtins.rs`、`clipboard_history/links.rs` 状态未变不发（D49.1）；
   - `island/drag_grid_window.rs` 在辅助线窗口已存在且 `DragGridState` 未变时不重复 `emit_to`；
   - `system/fullscreen.rs` 由全局 `app.emit` 收窄为 `app.emit_to("main", ...)`。
4. **前端高频事件节流（M7）**：
   - 新增纯函数 [throttle.ts](/src/utils/throttle.ts) 与单测 [throttle.test.mjs](/tests/unit/throttle.test.mjs)（支持首帧立即响应、尾帧合并、`flush` 与 `cancel`）；
   - 接入 [useIslandResize.ts](/src/windows/island/useIslandResize.ts)（Alt 拖拽尺寸中间帧 16ms 合并，`done: true` 立即落盘）、[IslandDragHint.tsx](/src/windows/island/IslandDragHint.tsx) 与 [PatternEyes.tsx](/src/features/center-pattern/PatternEyes.tsx)（高回报率鼠标 `mousemove` 16ms 节流）。
