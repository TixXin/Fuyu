export type SettingsColorsText = {
  title: string;
  taskText: string;
  pulse: string;
  islandBackground: string;
  pulseBrightness: string;
  modeTitle: string;
  mode: string;
  modeHint: string;
  modeHintMac: string;
  modes: Record<"dark" | "light" | "system", string>;
  editing: string;
  editingHint: string;
  resetSet: string;
  stayDark: string;
  stayDarkHint: string;
  stayDarkNow: string;
  stayDarkSurfaces: Record<"collapsed" | "panel" | "windows", string>;
  accent: string;
  accentHint: string;
  accentHintMac: string;
  accentSystem: string;
  accentModes: Record<"default" | "windows" | "pick", string>;
  accentColor: string;
  ink: string;
  inkHint: string;
  inkModes: Record<"auto" | "custom", string>;
  inkColor: string;
  inkReset: string;
  inkLowContrast: (ratio: string) => string;
  builtinTitle: string;
  builtin: string;
  builtinHint: string;
  builtinNames: Record<"default" | "greyWhite" | "frostedClear" | "frostedWarm", string>;
  builtinHints: Record<"default" | "greyWhite" | "frostedClear" | "frostedWarm", string>;
  builtinGlassHints: Record<"clear" | "tinted" | "flow" | "material" | "mica", string>;
  builtinCustom: string;
  builtinCustomHint: string;
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
  modeHintMac: "深色、浅色各有一套颜色；跟随系统按 macOS 的深色 / 浅色外观在两套之间自动切换。",
  modes: { dark: "深色", light: "浅色", system: "跟随系统" },
  editing: "调整哪一套",
  editingHint: "下面的颜色改的是这一套，预览也显示这一套。",
  resetSet: "恢复这套的默认颜色",
  accent: "强调色",
  accentHint: "焦点框、当前页的图标、链接用的颜色。跟随 Windows 用「设置 → 个性化 → 颜色」里的主题色。",
  accentHintMac: "焦点框、当前页的图标、链接用的颜色。跟随系统用「系统设置 → 外观」里的强调色。",
  accentSystem: "跟随系统",
  accentModes: { default: "默认", windows: "跟随 Windows", pick: "自选" },
  accentColor: "强调色颜色",
  ink: "岛上文字",
  inkHint: "自动按岛屿背景的深浅取黑字或白字。自选只改岛上的普通文字，强调色和状态颜色不变。",
  inkModes: { auto: "自动", custom: "自选" },
  inkColor: "文字颜色",
  inkReset: "恢复默认",
  inkLowContrast: (ratio) => `和岛屿背景的对比度只有 ${ratio}:1，小字可能看不清。`,
  builtinTitle: "主题",
  builtin: "一键换配色",
  builtinHint: "前四套同时换掉深色、浅色两套颜色和透明度：默认是装好时的黑色岛屿，配色是浅色时切回深色；另外三套是浅色，配色是深色时切到浅色。磨砂是半透明的底色加一层浅色调和细描边，不会模糊桌面。后面几套是液态玻璃，只换材质，颜色不变。之后还可以在下面接着调。",
  builtinNames: { default: "默认", greyWhite: "灰白", frostedClear: "透白磨砂", frostedWarm: "暖白磨砂" },
  builtinHints: { default: "装好时的黑色岛屿", greyWhite: "不透明的浅灰", frostedClear: "86% 的冷白", frostedWarm: "90% 的米白，暖色文字" },
  builtinGlassHints: { clear: "液态玻璃，几乎全透", tinted: "液态玻璃，带一层着色", flow: "液态玻璃，颜色缓缓流动", material: "液态玻璃，中等模糊", mica: "液态玻璃，重模糊" },
  builtinCustom: "自定义",
  builtinCustomHint: "现在的颜色，不是上面哪一套",
  stayDark: "保持深色",
  stayDarkHint: "配色是浅色时，选中的部分仍然用深色那一套。独立窗口指翻译和剪贴板窗口，设置窗口跟随配色。",
  stayDarkNow: "现在是深色，换成浅色后才看得出区别。",
  stayDarkSurfaces: { collapsed: "岛屿", panel: "面板", windows: "独立窗口" },
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
  modeHintMac: "Dark and light each have their own colors; System switches between them with macOS's dark or light appearance.",
  modes: { dark: "Dark", light: "Light", system: "System" },
  editing: "Adjusting",
  editingHint: "The colors below change this set, and the preview shows it.",
  resetSet: "Reset this set's colors",
  accent: "Accent",
  accentHint: "The color of focus rings, the open page's icon and links. Windows uses the accent from Settings > Personalization > Colors.",
  accentHintMac: "The color of focus rings, the open page's icon and links. System uses the accent from System Settings > Appearance.",
  accentSystem: "System",
  accentModes: { default: "Default", windows: "Windows", pick: "Pick" },
  accentColor: "Accent color",
  ink: "Island text",
  inkHint: "Auto picks dark or light text from the island background. A custom color only changes the island's plain text; the accent and status colors stay.",
  inkModes: { auto: "Auto", custom: "Custom" },
  inkColor: "Text color",
  inkReset: "Reset",
  inkLowContrast: (ratio) => `Only ${ratio}:1 against the island background; small text may be hard to read.`,
  builtinTitle: "Themes",
  builtin: "Color sets",
  builtinHint: "The first four replace both the dark and light colors and the opacity. Default is the black island you started with; light colors switch back to dark. The other three are light; dark colors switch to light. Frosted means a see-through tinted fill with a thin outline; it does not blur the desktop. The rest are liquid glass: they change the material and keep your colors. You can keep adjusting below.",
  builtinNames: { default: "Default", greyWhite: "Grey white", frostedClear: "Frosted clear", frostedWarm: "Frosted warm" },
  builtinHints: { default: "The black island you started with", greyWhite: "Solid light grey", frostedClear: "Cool white at 86%", frostedWarm: "Cream at 90%, warm text" },
  builtinGlassHints: { clear: "Liquid glass, almost clear", tinted: "Liquid glass with a tint", flow: "Liquid glass, colors drift", material: "Liquid glass, medium blur", mica: "Liquid glass, heavy blur" },
  builtinCustom: "Custom",
  builtinCustomHint: "Your current colors, none of the above",
  stayDark: "Keep dark",
  stayDarkHint: "With light colors, the selected parts still use the dark set. Other windows are the translation and clipboard windows; the settings window follows the colors.",
  stayDarkNow: "Colors are dark now; this shows once they turn light.",
  stayDarkSurfaces: { collapsed: "Island", panel: "Panel", windows: "Other windows" },
};
