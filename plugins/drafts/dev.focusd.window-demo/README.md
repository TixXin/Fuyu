# 窗口示例（dev.focusd.window-demo）

实验接口 `windows` 的示例插件（任务 E34，设计稿 [plugin-windows.md](/docs/architecture/plugins/plugin-windows.md)）。只在 Windows 上、开发模式下能用：清单里列了 `experimentalApis`，岛屿和市场都不收装在插件目录里的这种插件，所以它不进 `plugins/examples/`，等接口转正再上架。

## 做了什么

- `Ctrl+Alt+N`：在屏幕中央打开一个浮层（`kind: "panel"`），写一条便签，`Ctrl+Enter` 保存，`Esc` 或点别处收起。浮层顶上的标题条是岛屿画的。
- 启动时在桌面上放一个小组件（`kind: "widget"`，层级 `desktop`），显示时间和最近一条便签。按住拖动，松开后位置记进 `storage`，下次按记住的位置重建。「显示桌面」之后它还在。
- 命令「显示或关闭桌面小组件」开关小组件。

## 试一下

1. 设置 → 插件扩展 → 开发者，打开开发模式。
2. 加载这个文件夹，或运行 `fuyu-plugin dev plugins/drafts/dev.focusd.window-demo`。
3. 桌面上出现小组件；按 `Ctrl+Alt+N` 写一条便签。
