export type SettingsDeviceAlertsText = {
  title: string;
  alerts: string;
  alertsHint: string;
  alertsHintMac: string;
};

export const zhCN: SettingsDeviceAlertsText = {
  title: "耳机与充电",
  alerts: "在小岛上提示",
  alertsHint: "耳机或蓝牙音频设备连接、断开时，收起的小岛显示 3 秒，蓝牙设备带电量；蓝牙鼠标、键盘连上时也显示电量；蓝牙设备电量降到 20% 和 10% 时各提醒一次；笔记本插上或拔掉电源时也会提示。蓝牙电量要设备自己报告给 Windows 才有，用 USB 接收器的鼠标键盘暂时读不到。",
  alertsHintMac: "耳机或蓝牙音频设备连接、断开时，收起的小岛显示 3 秒，蓝牙设备带电量；蓝牙鼠标、键盘、触控板连上时也显示电量；蓝牙设备电量降到 20% 和 10% 时各提醒一次；笔记本插上或拔掉电源时也会提示。蓝牙电量要设备自己报告给 macOS 才有，用 USB 接收器的鼠标键盘暂时读不到。",
};

export const en: SettingsDeviceAlertsText = {
  title: "Headphones and charging",
  alerts: "Show on the island",
  alertsHint: "When headphones or Bluetooth audio connect or disconnect, the collapsed island says so for 3 seconds, with the battery level of Bluetooth devices; Bluetooth mice and keyboards show their battery level when they connect too. A Bluetooth device warns once at 20% and again at 10%, and a laptop says when its charger is plugged in or pulled out. Bluetooth battery levels show only for devices that report them to Windows; mice and keyboards on a USB receiver can't be read yet.",
  alertsHintMac: "When headphones or Bluetooth audio connect or disconnect, the collapsed island says so for 3 seconds, with the battery level of Bluetooth devices; Bluetooth mice, keyboards and trackpads show their battery level when they connect too. A Bluetooth device warns once at 20% and again at 10%, and a laptop says when its charger is plugged in or pulled out. Bluetooth battery levels show only for devices that report them to macOS; mice and keyboards on a USB receiver can't be read yet.",
};
