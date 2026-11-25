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
  battery: {
    duration: (minutes: number) => string;
    remaining: (time: string) => string;
    fullIn: (time: string) => string;
    health: (percent: number) => string;
    designCapacity: (wh: string) => string;
    curveLabel: string;
    curveHint: string;
    curvePoint: (clock: string, level: number, pluggedIn: boolean) => string;
    collapsedMode: string;
    collapsedModeHint: string;
    collapsedModes: { percent: string; time: string };
    showCurve: string;
    showCurveHint: string;
  };
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
  battery: {
    duration: (minutes) => {
      const total = Math.max(1, Math.round(minutes));
      const h = Math.floor(total / 60);
      const m = total % 60;
      if (h === 0) return `${m} 分钟`;
      return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`;
    },
    remaining: (time) => `约剩 ${time}`,
    fullIn: (time) => `约 ${time} 充满`,
    health: (percent) => `健康度 ${percent}%`,
    designCapacity: (wh) => `设计容量 ${wh}`,
    curveLabel: "近期电量曲线（可用左右方向键查看采样点）",
    curveHint: "悬停查看",
    curvePoint: (clock, level, pluggedIn) => `${clock} · ${level}% · ${pluggedIn ? "接电" : "电池"}`,
    collapsedMode: "收起条电池显示",
    collapsedModeHint: "选择在收起条电池芯片上显示电量百分比还是剩余/充满时间（读不到估时时自动退回百分比）。",
    collapsedModes: { percent: "电量百分比", time: "剩余 / 充满时间" },
    showCurve: "显示电量曲线",
    showCurveHint: "在中等尺寸电池组件底部显示最近一段时间的电量变化曲线，可悬停或用方向键查看采样点。",
  },
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
  battery: {
    duration: (minutes) => {
      const total = Math.max(1, Math.round(minutes));
      const h = Math.floor(total / 60);
      const m = total % 60;
      if (h === 0) return `${m}m`;
      return m === 0 ? `${h}h` : `${h}h ${m}m`;
    },
    remaining: (time) => `${time} left`,
    fullIn: (time) => `Full in ${time}`,
    health: (percent) => `Health ${percent}%`,
    designCapacity: (wh) => `Design capacity ${wh}`,
    curveLabel: "Recent battery curve (use Left/Right arrow keys to inspect samples)",
    curveHint: "Hover to inspect",
    curvePoint: (clock, level, pluggedIn) => `${clock} · ${level}% · ${pluggedIn ? "AC" : "Battery"}`,
    collapsedMode: "Collapsed battery display",
    collapsedModeHint: "Show either battery percentage or remaining / charge time in the collapsed chip (falls back to percentage when unavailable).",
    collapsedModes: { percent: "Percentage", time: "Time left" },
    showCurve: "Show battery curve",
    showCurveHint: "Display recent battery history at the bottom of the medium battery widget; hover or use arrow keys to inspect samples.",
  },
};
