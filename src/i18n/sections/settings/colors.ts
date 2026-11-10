export type SettingsColorsText = {
  title: string;
  taskText: string;
  pulse: string;
  islandBackground: string;
  pulseBrightness: string;
  modeTitle: string;
  mode: string;
  modeHint: string;
  modes: Record<"dark" | "light" | "system" | "custom", string>;
};

export const zhCN: SettingsColorsText = {
  title: "颜色",
  taskText: "任务/待办字样",
  pulse: "亮点颜色",
  islandBackground: "岛屿背景",
  pulseBrightness: "亮点亮度",
  modeTitle: "浅色和深色",
  mode: "配色",
  modeHint: "深色是黑色的岛，浅色是浅灰的岛配深色文字；跟随系统按 Windows 的深色 / 浅色模式自动切换。在下面自己挑颜色就成了自定义，切回深色或浅色时自定义的颜色还留着。",
  modes: { dark: "深色", light: "浅色", system: "跟随系统", custom: "自定义" },
};

export const en: SettingsColorsText = {
  title: "Colors",
  taskText: "Task text",
  pulse: "Accent",
  islandBackground: "Island background",
  pulseBrightness: "Accent brightness",
  modeTitle: "Light and dark",
  mode: "Colors",
  modeHint: "Dark is a black island, light a pale grey one with dark text; System follows Windows' dark or light mode. Picking a color below makes it custom, and your custom colors stay when you switch back.",
  modes: { dark: "Dark", light: "Light", system: "System", custom: "Custom" },
};
