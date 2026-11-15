# 无线鼠标、键盘的电量读取

> 日期：2026-11-15。问题：桌面应用（Tauri / Rust，Windows + macOS）怎样读到无线鼠标、键盘的电量。范围：Microsoft Learn、Bluetooth SIG、Apple 开发者论坛、Logitech 官方 cpg-docs、Linux 内核 hid-logitech-hidpp、Solaar / OpenLogi / LGSTrayBattery 等 GitHub 项目、Nordic DevZone 等论坛；关键词：Battery Service 0x180F、HOGP AccessDenied、DEVPKEY_Bluetooth_Battery、HID++ 0x1004、IOHIDManager Input Monitoring、system_profiler、BatteryPercent、openrazer、rivalcfg、iCUE。相关任务：C64（#315）

## 结论

**现状（C64）**：macOS 读 `system_profiler SPBluetoothDataType -json`，取 `device_minorType` 为鼠标、键盘、触控板的设备的 `device_batteryLevelMain`（见 `src-tauri/src/macos/bluetooth.rs`）；Windows 用 WinRT 枚举已连接的 BLE 设备，读 GATT 电池服务 0x180F 的 0x2A19（见 `src-tauri/src/win32/ble_battery.rs`），还没在 Windows 真机上测过。

几条要点：

1. **蓝牙 LE 鼠标键盘（HOGP）**：规范要求 HOGP 设备必须带电池服务。Windows 会占住 HID 服务（应用读它报 DeniedBySystem），但论坛实测电池服务**仍能读**。这只有一个较旧的论坛帖子作证，微软没有文档写明，算「基本可行，待真机确认」。
2. **Windows 的兜底**：系统设置里的电量来自设备节点属性 `{104EA319-6EE2-4701-BD47-8DDBF425BBE5},2`（俗称 DEVPKEY_Bluetooth_Battery），不用 GATT 访问，PowerShell `Get-PnpDeviceProperty` 就能读到。微软没有公开文档，只有社区项目在用，所以作为 GATT 读不到时的兜底，不作主路径。
3. **经典蓝牙（BR/EDR）HID**：没有强制的电池上报；有的设备在 HID 报告描述符里放「Battery Strength」（用法页 0x06，用法 0x20），Linux 会读。Windows 对它的处理「未核实」。macOS 的 `system_profiler` 对 Apple 自家设备有电量；第三方设备有没有，看设备，「未核实」。
4. **罗技接收器（Unifying / Bolt / Lightspeed）**：走 HID++。设备在接收器后面占设备号 1–6，先用根特性 0x0000 的 GetFeature 查到特性序号，再调用电池特性。官方文档只公开了包结构和根特性，电池特性的细节来自 Linux 内核。
5. **其他品牌**：雷蛇、海盗船、赛睿都是私有协议，社区逆向（openrazer、rivalcfg）或厂商 SDK（iCUE）才能读；普通 2.4G 接收器一般不上报电量（「未核实」，没找到可靠来源）。

**建议的下一步**：

- **接收器**：两个系统都用 `hidapi` crate（MIT）直接发 HID++，按 0x1004（UNIFIED_BATTERY）→ 0x1000（BATTERY_STATUS）→ 0x1001（BATTERY_VOLTAGE，要自己换算）的顺序探测；老设备再试 HID++ 1.0 寄存器 0x07 / 0x0D。Windows 上只打开厂商用法页（0xFF00 一类）的集合，鼠标、键盘集合被系统独占打不开，也不需要。macOS 上只匹配厂商用法页，不要匹配整个设备，避免触发「输入监控」权限（见详细 4）。Solaar 是 GPL-2.0，只看它的文档和协议说明，不抄代码。
- **Windows 兜底**：HOGP 设备 GATT 读不到（AccessDenied 或超时）时，读设备节点属性 `{104EA319-…},2`。
- 接收器的后续任务：C88（#420），https://github.com/TixXin/fuyu/blob/main/docs/tasks/C/C88.md

## 详细

### 1. 蓝牙 LE：GATT 电池服务

- 电池服务 UUID 0x180F，电量特性 0x2A19，一个字节 0–100（Bluetooth SIG 的 Battery Service 规范）。WinRT 里对应 `GattServiceUuids.Battery`、`GattCharacteristicUuids.BatteryLevel`。
- 流程：`BluetoothLEDevice.GetDeviceSelectorFromConnectionStatus(Connected)` 拿选择器 → `DeviceInformation.FindAllAsync` → `BluetoothLEDevice.FromIdAsync` → `GetGattServicesForUuidAsync(Battery)` → `GetCharacteristicsForUuidAsync(BatteryLevel)` → `ReadValueAsync`。微软的 GATT 客户端文档说明了这个流程，并提到 `FromIdAsync` 可能弹出授权（需在 UI 线程调用）。
- **HOGP 的访问问题**：HOGP 测试规范把 HID 服务和电池服务都列为必选。Nordic 论坛有人做 Windows 应用连自己的遥控器：HID 服务的特性报 `DeniedbySystem`，电池服务的特性能正常读；他把 HID 服务 UUID 改掉才绕开，推测是 Windows 占用了 HID 服务。帖子已超过 7 年，没有微软的正式说明。Qt 的 bug 里也见过 `GetIncludedServicesAsync` 返回 AccessDenied。结论：电池服务一般能读，HID 服务不能读；现在的 Windows 是否一样，要真机确认。
- **系统设置用的电量**：Windows 10 1809 起，「蓝牙和其他设备」里能看到鼠标、键盘的电量。有论坛用户说它只读 BLE 的电池服务（非官方说法）。社区脚本用 `Get-PnpDeviceProperty` 读设备节点属性 `{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2` 得到百分比，作者在雷蛇 Basilisk V3 Pro 的蓝牙模式下测过。微软 Learn 上没找到这个属性的文档；2020 年微软问答里有 MVP 说 UWP 没有 API 读这个属性。Rust 里可以用 `SetupDiGetDevicePropertyW` / `CM_Get_DevNode_PropertyW` 读（这是推断，「未核实」）。
- **区分鼠标和键盘**：BLE 外观值 HID 类别为 0x0F（外观值高 10 位），键盘 0x03C1，鼠标 0x03C2，通用 HID 0x03C0（Zephyr 的 assigned numbers 头文件、Nordic SoftDevice 文档）。

### 2. 经典蓝牙（BR/EDR）HID

- HID 规范里有 Generic Device Controls 页（0x06）的 Battery Strength 用法（0x20）。Linux 2012 年加了支持，起因就是一只蓝牙鼠标把电量当普通输入事件上报；Apple 蓝牙鼠标则把它放在 Feature 报告里，范围 0–100。这是设备自愿实现的，不是强制。
- HFP 的电量上报只用于耳机，鼠标键盘不走它。
- Windows 对经典蓝牙 HID 的电量显示「未核实」。2026 年 7 月有报道说 Linux 上 Apple 键鼠走蓝牙时电量一直显示 0%，补丁已提交，说明各家实现差异大。

### 3. macOS

- `system_profiler SPBluetoothDataType -json`：本仓库代码读 `device_minorType`（Mouse / Keyboard / Trackpad）和 `device_batteryLevelMain`（形如 `"77%"`）。旧版 XML 输出里的键叫 `device_batteryPercent`（MacScripter 帖子）。Apple 没有文档说明这些键，键名随系统版本可能变，「未核实」稳定性。只有已连接的设备才有电量。
- IOKit：`ioreg -r -l -k BatteryPercent` 或 `ioreg -c AppleDeviceManagementHIDEventService` 能看到 Magic 系列的 `BatteryPercent`；更老的系统用 `AppleBluetoothHIDKeyboard`、`BNBMouseDevice` 这些类名（社区脚本和论坛）。
- 第三方 BLE 鼠标在 `system_profiler` 里有没有电量：有用户指南说电池上报是可选的，很多厂商不做；具体到罗技 MX 系列走蓝牙时有没有，「未核实」。本仓库测试数据里 MX Keys 是没有电量的样例，但那是假数据。

### 4. 罗技接收器：HID++

- **包结构**（Logitech 官方 cpg-docs）：字节 0 报告 ID（短 0x10 共 7 字节，长 0x11 共 20 字节），字节 1 设备号（0xFF 留给有线设备和接收器本身），字节 2 特性序号，字节 3 高 4 位是函数号、低 4 位是软件 ID（用来认回自己的应答），后面是参数。Linux 内核另定义了 0x12（超长，最多 64 字节）。
- **设备号**：接收器后面的设备占 1–6（HID++ 1.0 接收器规范、DJ 集合规范草案）；Solaar 文档里 Unifying 接收器最多配 6 台。
- **查特性序号**：根特性 0x0000 固定在序号 0，函数 0 是 GetFeature：参数是特性 ID 两字节，返回序号（0 表示没有）、类型位（废弃 / 隐藏 / 工程）、版本。
- **电池特性**：0x1000 BATTERY_STATUS（老的，分级加百分比）、0x1001 BATTERY_VOLTAGE（只给电压）、0x1004 UNIFIED_BATTERY（新，取能力用函数 0x00，取状态用函数 0x10，能力里有「电量百分比」标志时才给百分比，否则只给 critical / low / good / full 四档）。Linux 内核先试 0x1000 和 0x1004，再试 0x1001。
- **HID++ 1.0 老设备**：电池寄存器 0x07（BATTERY_STATUS）和 0x0D（BATTERY_MILEAGE）（Linux 内核 hid-logitech-hidpp）。
- **Windows 访问**：鼠标、键盘的顶层集合被系统以独占方式打开，应用打不开；厂商自定义的集合可以用 `hidapi`（底层 SetupDi / HidD / CreateFile）直接读写，不用装驱动。LGSTrayBattery 就有不依赖 G HUB、走 hidapi 的读法，并写了 0x1004 解析（作者注明未测试）。罗技 HID++ 集合的用法页不止 0xFF00 一种，OpenLogi 里有 0xFF43 / 0x0602 的特例，要按枚举结果挑。
- **macOS 访问和权限**：Apple DTS 在论坛说，「输入监控」用于系统直接理解的设备（键盘、鼠标等），换成别的设备类型可能不需要（他自己也说要再确认）。Solaar 的 macOS 移植（2023-11-28 合入）用 hidapi，把键盘、鼠标接口过滤掉，说明里写「不需要特殊权限」。但 Wine 的问题报告指出 `IOHIDManagerOpen` 会打开所有匹配的设备，匹配到键盘就会报 `kIOReturnNotPermitted`。所以：只匹配厂商用法页、逐个打开设备，**大概率不需要输入监控**；要在真机上用 `IOHIDCheckAccess` 确认。Apple 现在推荐新代码用 CoreHID。
- **许可**：Solaar 是 GPL-2.0，Linux 内核驱动也是 GPL-2.0，只参考协议常量和流程，不抄代码。`hidapi`（Rust crate）是 MIT。

### 5. 其他品牌

- **雷蛇**：私有 USB HID 协议，社区整理的协议参考里电量命令在 0x07 类、0x80 号，返回 0–255；Windows 托盘小工具按 openrazer 的做法读 Viper V2 Pro。雷蛇论坛有人反映 Wolverine V3 Pro 给 Windows 的电量一直是 10%。
- **海盗船**：iCUE SDK 有 `CDPI_BatteryLevel` 属性，要装 iCUE 才能用；用户反映 iCUE 有的设备只显示「低 / 中 / 满」。
- **赛睿**：rivalcfg 支持多款无线鼠标的 `--battery-level`（2.4G 模式），修过关机时报 630% 之类的错。
- **普通 2.4G 接收器**：没找到统一的电量协议，「未核实」。

## 来源

- Bluetooth SIG：[Battery Service 规范](https://www.bluetooth.com/specifications/specs/battery-service/)，[HOGP 测试规范 TS](https://files.bluetooth.com/download/hogp-ts-p11-pdf)
- Microsoft Learn：[GATT 客户端](https://learn.microsoft.com/en-us/windows/apps/develop/devices-sensors/gatt-client)，[GattServiceUuids.Battery](https://learn.microsoft.com/en-us/uwp/api/windows.devices.bluetooth.genericattributeprofile.gattserviceuuids.battery)，[Windows 为系统使用打开的顶层集合](https://learn.microsoft.com/en-us/windows-hardware/drivers/hid/top-level-collections-opened-by-windows-for-system-use)，[HID 架构](https://learn.microsoft.com/windows-hardware/drivers/hid/hid-architecture)，[微软问答：能否获取蓝牙电量](https://learn.microsoft.com/en-us/answers/a/597419)
- Nordic DevZone：[Windows 应用读 HID 服务被拒、电池服务可读](https://devzone.nordicsemi.com/f/nordic-q-a/41530/characteristics-in-hid-service-access-denied-on-windows-app/161706)；Qt：[QTBUG-82979](https://bugreports-test.qt.io/browse/QTBUG-82979)
- DEVPKEY 电量属性：[HyperNylium/Get-Bluetooth-Battery-Persentage](https://github.com/HyperNylium/Get-Bluetooth-Battery-Persentage)；1809 电量显示：[Windows Central](https://www.windowscentral.com/whats-new-settings-app-windows-10-october-2018-update)，[Winaero](https://winaero.com/check-bluetooth-device-battery-level-windows-10)
- 外观值：[Zephyr assigned_numbers.h](https://docs.zephyrproject.org/latest/doxygen/html/assigned__numbers_8h.html)，[Bluetooth Assigned Numbers](https://bluetooth.com/wp-content/uploads/Files/Specification/Assigned_Numbers.html)
- HID Battery Strength：[Linux 提交 4f5ca836b](https://gitea.osmocom.org/dect/linux-2.6/commit/4f5ca836b)，[2009 年 Apple 蓝牙鼠标讨论](https://lore.kernel.org/linux-input/1244642769.2690.51.camel@cookie.hadess.net/)，[Phoronix：Apple 键鼠蓝牙电量补丁](https://www.phoronix.com/news/Apple-Magic-Bluetooth-Battery)
- macOS：[MacScripter：Magic Mouse 电量](https://www.macscripter.net/t/check-magic-mouse-battery-level-and-notify-at-certain-threshold/71359)，[Jamf 社区：键鼠电量](https://community.jamf.com/t5/jamf-pro/extension-attribute-for-bluetooth-mouse-keyboard-levels/m-p/47825)，[dev.to：macOS 蓝牙电量](https://dev.to/aromig/macos-quirks-bluetooth-device-battery-low-dkm)，[Apple 论坛：输入监控与设备类型](https://developer.apple.com/forums/thread/804793)，[Apple 论坛：IOHIDManager 与输入监控](https://developer.apple.com/forums/thread/779582)，[Wine bug 50153](https://www.winehq.org/pipermail/wine-bugs/2021-January/547904.html)，[SDL：没有输入监控权限时不枚举 HID](https://discourse.libsdl.org/t/sdl-dont-enumerate-hid-devices-on-macos-if-we-dont-have-input-monitoring-permissions/38822)
- HID++：[Logitech cpg-docs（HID++ 2.0 包结构）](https://github.com/Logitech/cpg-docs)，[cpg-docs IRoot 0x0000](https://github.com/Logitech/cpg-docs/blob/master/hidpp20/features/0x0000-IRoot.rst)，[lekensteyn：根特性说明](https://lekensteyn.nl/files/logitech/x0000_root.html)，[HID++ 1.0 接收器规范](https://lekensteyn.nl/files/logitech/logitech_hidpp10_specification_for_Unifying_Receivers.pdf)，[DJ 集合规范草案](https://lekensteyn.nl/files/logitech/Unifying_receiver_DJ_collection_specification_draft.pdf)，[Linux hid-logitech-hidpp.c](https://codebrowser.dev/linux/linux/drivers/hid/hid-logitech-hidpp.c.html)，[内核补丁：支持 0x1004](https://lore.kernel.org/all/20210104182937.1472673-1-lains@archlinux.org/T/)
- Solaar：[仓库（GPL-2.0，支持 Unifying / Bolt / Lightspeed / Nano）](https://github.com/pwr-Solaar/Solaar)，[macOS 支持 PR #1971](https://github.com/pwr-Solaar/Solaar/pull/1971)；[LGSTrayBattery](https://github.com/vortex852456/LGSTrayBattery)；[OpenLogi transport.rs](https://docs.rs/crate/openlogi-hid/0.6.6/source/src/transport.rs)；[hidapi-rs（MIT）](https://github.com/ruabmbua/hidapi-rs)
- 其他品牌：[Razer 协议参考（uchroma）](https://hyperb1iss.github.io/uchroma/reference/razer-protocol-reference.html)，[razer_tray](https://github.com/Fan4Metal/razer_tray)，[Razer Insider：Wolverine V3 Pro 电量](https://insider.razer.com/razer-support-45/wolverine-v3-pro-always-reports-10-battery-to-windows-apis-90378)，[cue-sdk-sys](https://docs.rs/cue-sdk-sys)，[Corsair 论坛：HS80 电量](https://forum.corsair.com/forums/topic/172332-hs80-battery-status-in-icue/)，[rivalcfg](https://github.com/flozz/rivalcfg)
