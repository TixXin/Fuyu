export type SettingsAppearanceText = {
  font: string;
  fontLabel: string;
  systemFont: string;
  pixelFont: string;
  title: string;
  classic: string;
  liquidGlass: string;
  glassStrength: string;
  styleTitle: string;
  idleDim: {
    title: string;
    enable: string;
    enableHint: string;
    seconds: string;
    opacity: string;
  };
  glass: {
    title: string;
    refractionTitle: string;
    detailsTitle: string;
    reset: string;
    look: string;
    looks: { clear: string; tinted: string; flow: string; material: string; mica: string; custom: string };
    style: string;
    styles: { static: string; flow: string; aurora: string; shader: string };
    shaderHint: string;
    colorSource: string;
    colorSources: { accent: string; cover: string; custom: string };
    coverHint: string;
    color: (index: number) => string;
    colorStrength: string;
    flowSpeed: string;
    still: string;
    blobScale: string;
    flowWhen: string;
    flowWhens: { always: string; expanded: string };
    pauseHint: string;
    rim: string;
    rimWidth: string;
    sheen: string;
    specular: string;
    specularHint: string;
    morph: string;
    morphs: { smooth: string; soft: string; liquid: string };
    contrastGuard: string;
    contrastGuardHint: string;
    contrastGuardOff: string;
    backdrop: string;
    backdrops: { none: string; wallpaper: string; native: string };
    backdropHint: string;
    nativeHint: string;
    blur: string;
    saturation: string;
    noise: string;
  };
  preview: {
    label: string;
    collapsed: string;
    expanded: string;
    sessions: {
      needs: { project: string; title: string };
      yourTurn: { project: string; title: string };
      done: { project: string; title: string };
    };
  };
};

export const zhCN: SettingsAppearanceText = {
  font: "字体",
  fontLabel: "岛屿字体",
  systemFont: "默认字体",
  pixelFont: "像素字体",
  title: "外观模式",
  classic: "经典",
  liquidGlass: "液态玻璃",
  glassStrength: "玻璃强度",
  styleTitle: "质感与形状",
  idleDim: {
    title: "闲置变淡",
    enable: "闲置时自动变淡",
    enableHint: "收起状态下长时间无操作时自动降低整岛不透明度，变淡期间鼠标点击穿透到下方窗口；光标靠近或有新提醒时立即恢复。",
    seconds: "闲置多久后变淡",
    opacity: "变淡后不透明度",
  },
  glass: {
    title: "液态玻璃",
    refractionTitle: "背景折射与色彩",
    detailsTitle: "流光与高光细节",
    reset: "恢复液态玻璃默认",
    look: "预设",
    looks: { clear: "iOS 26 透明", tinted: "iOS 26 着色", flow: "流彩毛玻璃", material: "iOS 18 毛玻璃", mica: "Win11 Mica", custom: "自定义" },
    style: "风格",
    styles: { static: "静态", flow: "慢流动", aurora: "极光", shader: "着色器（实验）" },
    shaderHint: "用 WebGL 画流体，效果最细，但显卡一直在工作；不支持时自动换回慢流动。",
    colorSource: "颜色来源",
    colorSources: { accent: "主题色", cover: "跟封面", custom: "自定义" },
    coverHint: "放歌时跟着封面换色，没在放时用主题色。",
    color: (index) => `颜色 ${index}`,
    colorStrength: "色彩浓度",
    flowSpeed: "流动速度",
    still: "静止",
    blobScale: "色块大小",
    flowWhen: "折叠时流动",
    flowWhens: { always: "一直", expanded: "只在展开时" },
    pauseHint: "收到边缘、游戏免打扰、隐藏和系统减少动态效果时一律停下。",
    rim: "油膜边",
    rimWidth: "边宽",
    sheen: "扫光",
    specular: "镜面高光",
    specularHint: "高光跟着鼠标走。",
    morph: "展开收起",
    morphs: { smooth: "平滑", soft: "轻弹", liquid: "液体" },
    contrastGuard: "文字保护",
    contrastGuardHint: "自动压暗或提亮色块，让文字始终看得清。",
    contrastGuardOff: "关掉后，颜色亮的地方文字可能看不清。",
    backdrop: "玻璃背后",
    backdrops: { none: "无", wallpaper: "桌面壁纸", native: "原生透出（实验）" },
    backdropHint: "透出岛正后方的壁纸并磨砂，「玻璃强度」决定盖在上面的底色有多浓。背后有窗口挡着时仍显示壁纸；系统关掉「透明效果」或读不到壁纸时照旧用纯色玻璃。",
    nativeHint: "由 macOS 原生玻璃实时磨砂岛正后方的窗口与桌面（macOS 26 用系统液态玻璃，旧版用毛玻璃）；刘海形态折叠时保持纯黑，开启系统「降低透明度」时自动退回纯色玻璃。",
    blur: "模糊",
    saturation: "饱和度",
    noise: "噪点",
  },
  preview: {
    label: "按当前设置画出的岛屿",
    collapsed: "折叠",
    expanded: "展开",
    sessions: {
      needs: { project: "Fuyu", title: "设置页切换动画" },
      yourTurn: { project: "notes", title: "整理周报大纲" },
      done: { project: "api-server", title: "修复登录超时" },
    },
  },
};

export const en: SettingsAppearanceText = {
  font: "Font",
  fontLabel: "Island font",
  systemFont: "System",
  pixelFont: "Pixel",
  title: "Appearance",
  classic: "Classic",
  liquidGlass: "Liquid glass",
  glassStrength: "Glass strength",
  styleTitle: "Look and shape",
  idleDim: {
    title: "Idle dimming",
    enable: "Dim when idle",
    enableHint: "Dims the collapsed island after a while without activity and lets mouse clicks pass through to windows underneath; restores at once when the pointer comes near or an alert arrives.",
    seconds: "Idle time before dimming",
    opacity: "Dimmed opacity",
  },
  glass: {
    title: "Liquid glass",
    refractionTitle: "Refraction and colours",
    detailsTitle: "Flow and highlights",
    reset: "Restore liquid glass defaults",
    look: "Preset",
    looks: { clear: "iOS 26 clear", tinted: "iOS 26 tinted", flow: "Frosted flow", material: "iOS 18 frosted", mica: "Windows 11 Mica", custom: "Custom" },
    style: "Style",
    styles: { static: "Still", flow: "Slow flow", aurora: "Aurora", shader: "Shader (experimental)" },
    shaderHint: "Draws a fluid with WebGL. Finest detail, but keeps the GPU busy; falls back to slow flow when unsupported.",
    colorSource: "Colours from",
    colorSources: { accent: "Accent", cover: "Album art", custom: "Custom" },
    coverHint: "Follows the album art while music plays, the accent colour otherwise.",
    color: (index) => `Colour ${index}`,
    colorStrength: "Colour strength",
    flowSpeed: "Flow speed",
    still: "Still",
    blobScale: "Blob size",
    flowWhen: "Flow when collapsed",
    flowWhens: { always: "Always", expanded: "Only expanded" },
    pauseHint: "Always stops when tucked, in game mode, hidden, or when the system reduces motion.",
    rim: "Oil-film rim",
    rimWidth: "Rim width",
    sheen: "Sheen",
    specular: "Specular highlight",
    specularHint: "The highlight follows the pointer.",
    morph: "Expand and collapse",
    morphs: { smooth: "Smooth", soft: "Soft bounce", liquid: "Liquid" },
    contrastGuard: "Keep text readable",
    contrastGuardHint: "Darkens or lightens the colours so text always stays readable.",
    contrastGuardOff: "With this off, text may be hard to read over bright colours.",
    backdrop: "Behind the glass",
    backdrops: { none: "Nothing", wallpaper: "Desktop wallpaper", native: "Native blur (experimental)" },
    backdropHint: "Shows the wallpaper right behind the island, frosted; glass strength sets how thick the tint over it is. Windows behind the island are not shown; with Transparency effects off or no wallpaper to read, the glass stays solid.",
    nativeHint: "Blurs live windows and the desktop behind the island with native macOS glass (system Liquid Glass on macOS 26, vibrancy on older versions). Stays solid black when collapsed into the notch, and falls back to solid glass when Reduce transparency is on.",
    blur: "Blur",
    saturation: "Saturation",
    noise: "Grain",
  },
  preview: {
    label: "The island with the current settings",
    collapsed: "Collapsed",
    expanded: "Expanded",
    sessions: {
      needs: { project: "Fuyu", title: "Settings page transition" },
      yourTurn: { project: "notes", title: "Weekly report outline" },
      done: { project: "api-server", title: "Fix the login timeout" },
    },
  },
};
