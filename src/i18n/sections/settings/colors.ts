export type SettingsColorsText = {
  title: string;
  taskText: string;
  pulse: string;
  islandBackground: string;
  pulseBrightness: string;
  modeTitle: string;
  mode: string;
  modeHint: string;
  modes: Record<"dark" | "light" | "system", string>;
  editing: string;
  editingHint: string;
  resetSet: string;
  collapsedDark: string;
  collapsedDarkHint: string;
};

export const zhCN: SettingsColorsText = {
  title: "颜色",
  taskText: "任务/待办字样",
  pulse: "亮点颜色",
  islandBackground: "岛屿背景",
  pulseBrightness: "亮点亮度",
  modeTitle: "浅色和深色",
  mode: "配色",
  modeHint: "深色、浅色各有一套颜色；跟随系统按 Windows 的深色 / 浅色模式在两套之间自动切换。",
  modes: { dark: "深色", light: "浅色", system: "跟随系统" },
  editing: "调整哪一套",
  editingHint: "下面的颜色改的是这一套，预览也显示这一套。",
  resetSet: "恢复这套的默认颜色",
  collapsedDark: "收起时保持深色",
  collapsedDarkHint: "岛是浅色时，收起的小岛仍然是黑色，和屏幕顶边、刘海融在一起；展开后才变浅色。",
};

export const en: SettingsColorsText = {
  title: "Colors",
  taskText: "Task text",
  pulse: "Accent",
  islandBackground: "Island background",
  pulseBrightness: "Accent brightness",
  modeTitle: "Light and dark",
  mode: "Colors",
  modeHint: "Dark and light each have their own colors; System switches between them with Windows' dark or light mode.",
  modes: { dark: "Dark", light: "Light", system: "System" },
  editing: "Adjusting",
  editingHint: "The colors below change this set, and the preview shows it.",
  resetSet: "Reset this set's colors",
  collapsedDark: "Stay dark when collapsed",
  collapsedDarkHint: "With a light island, the collapsed island stays black so it blends into the screen's top edge and notch; it turns light when it opens.",
};
