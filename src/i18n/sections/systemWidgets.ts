export type SystemWidgetsText = {
  launcherHint: (name: string) => string;
  addApp: string;
  pickApp: string;
  appFilter: string;
  doneEditing: string;
  removeApp: (name: string) => string;
  restoreApp: (name: string) => string;
  editHint: string;
  editLauncher: string;
  brightnessHint: (percent: number) => string;
  brightnessFixed: (percent: number) => string;
  brightnessMissing: { windows: string; mac: string };
};

export const zhCN: SystemWidgetsText = {
  launcherHint: (name) => `${name}（右键编辑）`,
  addApp: "添加应用",
  pickApp: "选择要添加的应用",
  appFilter: "应用程序",
  doneEditing: "完成",
  removeApp: (name) => `移除 ${name}`,
  restoreApp: (name) => `加回 ${name}`,
  editHint: "拖动排序，点 × 移除，点 + 添加应用",
  editLauncher: "编辑快捷启动（也可以右键）",
  brightnessHint: (percent) => `亮度 ${percent}%`,
  brightnessFixed: (percent) => `亮度 ${percent}%：这块屏幕的亮度只能看，不能在这里调`,
  brightnessMissing: { windows: "读不到屏幕亮度：外接显示器要在显示器自己的菜单里打开 DDC/CI", mac: "读不到屏幕亮度：Mac 上只能调内建屏，外接显示器不支持" },
};

export const en: SystemWidgetsText = {
  launcherHint: (name) => `${name} (right-click to edit)`,
  addApp: "Add an app",
  pickApp: "Choose an app to add",
  appFilter: "Applications",
  doneEditing: "Done",
  removeApp: (name) => `Remove ${name}`,
  restoreApp: (name) => `Add ${name} back`,
  editHint: "Drag to reorder, × to remove, + to add an app",
  editLauncher: "Edit quick launch (or right-click)",
  brightnessHint: (percent) => `Brightness ${percent}%`,
  brightnessFixed: (percent) => `Brightness ${percent}%: this screen's brightness can be read but not changed here`,
  brightnessMissing: { windows: "Can't read the screen brightness. External monitors need DDC/CI turned on in the monitor's own menu", mac: "Can't read the screen brightness. On a Mac only the built-in screen can be adjusted" },
};
