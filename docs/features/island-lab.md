# 岛屿实验台

一个本地网页，点按钮就能让**正在运行的开发版岛**（`pnpm tauri dev`）做出各种动作：模拟刘海、展开到某一页、收起、贴边，弹出 QQ / 微信 / 插件消息、音量和设备提醒，点亮 Agent 状态，发起真的 Agent 审批和提问。改界面时不用等真的消息、真的 Agent 卡住，也不用找一台有刘海的 Mac。任务 D36。

## 用法

1. 跑起开发版：`pnpm tauri dev`。开发版启动时会自己开一个只给实验台用的端口（优先 39281），把端口和令牌写进岛数据目录下的 `island-lab.json`；不用打开本地接口插件，也不用开「允许修改」。正式版不开这个端口。
2. 另开一个终端：`pnpm lab`，打开 <http://127.0.0.1:5199/>（端口可用环境变量 `ISLAND_LAB_PORT` 改）。
3. 想试审批和提问，在岛的设置里打开 **Agent 审批**；没开时页面记录里会写「岛没有接这个请求」。

页面顶上一行写着连没连上开发版的岛。右边是每次点击的结果。

## 按钮做了什么

| 一组 | 怎么做到的 | 走的是真流程吗 |
|---|---|---|
| 刘海 | `PUT /v1/dev/island/notch` 让 Rust 端把刘海当成指定的宽高（`DELETE` 取消，回到屏幕真实的刘海）；岛的窗口、点击判定、收起都按这个尺寸走，外接屏和 Windows 上也能试 | 窗口和界面是真的，刘海是假的 |
| 岛 | `POST /v1/dev/island/action`：展开到某页、收起、贴边收起、弹出，和点岛、按快捷键调用的是同一组函数 | 是 |
| 消息、系统 | `POST /v1/dev/island/emit` 把事件原样发给岛，载荷和真后端发的一样 | 跳过了抓消息、读音量的原生代码，只测岛的界面 |
| Agent 状态 | `PUT /v1/agent-status/lab`，和本地接口的同一套逻辑，来源记作 `island-lab/lab` | 是 |
| 审批、提问 | 像 Claude Code / Codex 的 hook 一样往岛的审批端口发请求，等你在岛上点允许 / 拒绝 / 选项，页面记录里显示岛的回答 | 是，从头到尾 |

## 实现

- `scripts/island-lab/`：`server.mjs` 是一个只监听 127.0.0.1 的小服务，送出网页，并把按钮的请求转给岛：从 `island-lab.json`、`agent-approval.json`（先找岛的数据目录，再找应用数据目录）读端口和令牌，转发时不带 `Origin`。它只认自己那几条路径，也只接受来自本页面的请求，别的网页不能借它往岛上发东西。`actions.mjs` 是各按钮的载荷，`lab.mjs` 画按钮。
- Rust：`local_api/lab.rs` 是开发版专用的监听（`#[cfg(debug_assertions)]`），只接 `/v1/health`、`/v1/dev/island/*` 和 `/v1/agent-status/*`，令牌每次启动重新生成；`local_api/dev_island.rs` 是那三条 `/v1/dev/island/*` 路径，本地接口在开发版里也认（正式版 404）。刘海覆盖在 `island/notch.rs`。
- 前端：`features/local-api/devIsland.ts` 处理 `emit` 和 `action`，只在开发版里接上（`import.meta.env.DEV`）；`windows/island/useDevIslandActions.ts` 把动作交给岛。
- 测试：`tests/scripts/island-lab.test.mjs`（转发白名单、配置位置、载荷格式），`local_api/tests.rs` 的路径测试。

## 还没有的

- 音乐和歌词：播放状态是岛定时去问后端的，发事件盖不住，要另做假的播放状态。
- 摄像头 / 麦克风占用：同样是定时去问的。
- 浏览器里不连岛、纯模拟的版本：没做，需要时可以复用 `video/` 的假后端。
