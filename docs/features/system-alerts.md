# 系统提示（音量亮度、外设、隐私与大写锁定）

浮屿可在屏幕顶部的岛上以克制的弹窗或收起条角标提示常见系统状态变化，避免系统自带大面积 OSD 遮挡画面。所有子项统一在 **设置 → 计时与提示 → 系统提示**（及 **设置 → 概览** 的对应内置插件开关）中管理。平台差异见 [platforms.md](../architecture/platforms.md)。

## 包含的四类提示

1. **音量与亮度变化（`system-levels`）**：调节系统音量、静音状态或显示器亮度时，在收起条或刘海两翼弹出当前数值与进度条；Windows 支持主屏及外接显示器 DDC/CI 亮度监听，macOS 读取系统音量与主屏亮度。
2. **外设与电源提示（`device-events`）**：耳机、蓝牙外设或 USB 设备连接/断开、笔记本插拔电源与低电量时在岛上短暂提示；支持显示蓝牙外设和罗技 Unifying / Bolt / Lightspeed 接收器后面鼠标键盘的电量角标（接收器走 HID++，C88）（收起条项目 `peripheral-battery`，默认关闭，可在布局中开启）。外设电量常驻显示在 Fuyu 面板的「外设电量」组件和收起条上（C161），两处默认都不放；设置 → 计时与提醒 → 系统提示 里「耳机与充电」下面有两个开关直接放上去，说明里按平台写了支持范围（C189）：能读蓝牙耳机、蓝牙鼠标键盘（Mac 还有触控板）和罗技接收器后面的设备，读不到别家的 2.4G 接收器、有线设备，以及系统自己看不到电量的设备。笔记本电池详情与电量曲线位于内置组件 `system-widgets`（收起条项目 `battery`）。
3. **摄像头与麦克风使用提示（`device-use`）**：检测到应用正在调用摄像头或麦克风时，在收起条显示指示点并点亮刘海光晕（悬停可查看占用程序名称，点击直达系统隐私设置）。
4. **大写锁定与 Num Lock 提示（`caps-lock`）**：按下 Caps Lock 切换状态时在收起条闪烁提示并保留常驻角标（支持点击角标关闭大写锁定、仅提示/仅角标/两者都有、关闭大写时是否提示、展开态胶囊、贴边隐藏时露头、刘海两翼不收进「+N」）；Windows 另支持输入密码框时持续提醒以及可选 Num Lock 提示。

## 隐私与性能

- 仅订阅系统状态或低频按需查询，不录音、不拍照、不记录键盘按键内容（大写锁定仅查询键位开关状态，密码框判断仅检查当前焦点控件是否为密码输入框）。
- 每一项均为独立内置插件（`system-levels`、`device-events`、`device-use`、`caps-lock`），关闭后对应 Rust 后台线程与监听立即停止，前端不留任何残留 DOM 或事件监听。

## 实现位置

- Rust 侧：`src-tauri/src/system_levels/`、`src-tauri/src/device_events/`、`src-tauri/src/device_use/`、`src-tauri/src/caps_lock/`。
- 前端侧：`src/features/system-levels/`、`src/features/device-events/`、`src/features/device-use/`、`src/features/caps-lock/`。
