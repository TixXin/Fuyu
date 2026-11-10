# 待办进度环（示例）

在岛上加一个页面，用圆环画出今天的待办完成了多少，并列出接下来的几条；收起条上也有一个小环和「完成数/总数」。

## 怎么用

- 安装并启用后，岛上会多一个「待办进度环」页面。
- 完成或新增待办时，圆环会立刻跟着变；全部完成后变绿。
- 收起条上的小环在 外观 → 收起条上的项目 里可以调位置或隐藏；今天没有待办时不显示。点它打开进度环页面。
- 收起条中间也显示剩余待办数时，数量会出现两处；嫌重复可以在 设置 → 任务 里关掉「空闲时显示剩余待办数」，交给这个小环。

## 权限

- `todos:read`：读取今天的待办。

## 示例演示了什么

自定义界面页面：页面是插件自己写的 HTML，只能通过消息和插件进程通信，不能联网，也不能调用岛屿的任何命令。

收起条状态：`status.update` 带 `ring`（0–1）画小进度环，`text` 留给读屏和不支持小环的旧版岛屿。

## English

Adds an island page with a ring showing how much of today's todos are done and the next few to do, plus a small ring with done/total on the collapsed bar. The page is the plugin's own HTML; it can only talk to the plugin process and cannot reach the network.
