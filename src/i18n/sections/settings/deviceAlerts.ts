export type SettingsDeviceAlertsText = {
  title: string;
  alerts: string;
  alertsHint: string;
  alertsHintMac: string;
  peripherals: string;
  peripheralsHint: string;
  peripheralsHintMac: string;
  peripheralsBar: string;
  peripheralsBarHint: string;
};

export const zhCN: SettingsDeviceAlertsText = {
  title: "耳机与充电",
  alerts: "在小岛上提示",
  alertsHint: "耳机或蓝牙音频设备连接、断开时，收起的小岛显示 3 秒，蓝牙设备带电量；蓝牙鼠标、键盘连上时也显示电量；蓝牙设备电量降到 20% 和 10% 时各提醒一次；笔记本插上或拔掉电源时也会提示。蓝牙电量要设备自己报告给 Windows 才有。",
  alertsHintMac: "耳机或蓝牙音频设备连接、断开时，收起的小岛显示 3 秒，蓝牙设备带电量；蓝牙鼠标、键盘、触控板连上时也显示电量；蓝牙设备电量降到 20% 和 10% 时各提醒一次；笔记本插上或拔掉电源时也会提示。蓝牙电量要设备自己报告给 macOS 才有。",
  peripherals: "外设电量放到 Fuyu 面板",
  peripheralsHint: "在 Fuyu 面板上常驻列出已连接外设的电量。能读到：蓝牙耳机，蓝牙鼠标、键盘，罗技 Unifying、Bolt、Lightspeed 接收器后面的鼠标键盘。读不到：其他品牌的 2.4G 接收器、有线设备，以及在 Windows「蓝牙和其他设备」里看不到电量的设备。",
  peripheralsHintMac: "在 Fuyu 面板上常驻列出已连接外设的电量。能读到：AirPods 等蓝牙耳机，蓝牙鼠标、键盘、触控板，罗技 Unifying、Bolt、Lightspeed 接收器后面的鼠标键盘；第三方蓝牙设备要在组件里点「读取第三方蓝牙设备」授权蓝牙。读不到：其他品牌的 2.4G 接收器和有线设备。",
  peripheralsBar: "外设电量显示在收起条上",
  peripheralsBarHint: "收起条上显示电量最低的那个外设",
};

export const en: SettingsDeviceAlertsText = {
  title: "Headphones and charging",
  alerts: "Show on the island",
  alertsHint: "When headphones or Bluetooth audio connect or disconnect, the collapsed island says so for 3 seconds, with the battery level of Bluetooth devices; Bluetooth mice and keyboards show their battery level when they connect too. A Bluetooth device warns once at 20% and again at 10%, and a laptop says when its charger is plugged in or pulled out. Bluetooth battery levels show only for devices that report them to Windows.",
  alertsHintMac: "When headphones or Bluetooth audio connect or disconnect, the collapsed island says so for 3 seconds, with the battery level of Bluetooth devices; Bluetooth mice, keyboards and trackpads show their battery level when they connect too. A Bluetooth device warns once at 20% and again at 10%, and a laptop says when its charger is plugged in or pulled out. Bluetooth battery levels show only for devices that report them to macOS.",
  peripherals: "Device batteries on the Fuyu panel",
  peripheralsHint: "Keeps the battery of connected devices on the Fuyu panel. Works with Bluetooth headphones, Bluetooth mice and keyboards, and mice and keyboards on a Logitech Unifying, Bolt or Lightspeed receiver. Not other brands' 2.4 GHz receivers, wired devices, or devices whose battery Windows doesn't show under Bluetooth & devices.",
  peripheralsHintMac: "Keeps the battery of connected devices on the Fuyu panel. Works with AirPods and other Bluetooth headphones, Bluetooth mice, keyboards and trackpads, and mice and keyboards on a Logitech Unifying, Bolt or Lightspeed receiver; for third-party Bluetooth devices, click Read other Bluetooth devices in the widget to allow Bluetooth. Not other brands' 2.4 GHz receivers or wired devices.",
  peripheralsBar: "Device batteries on the collapsed bar",
  peripheralsBarHint: "Shows the device with the lowest battery on the collapsed bar",
};
