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
  glass: {
    title: string;
    reset: string;
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
    backdrops: { none: string; wallpaper: string };
    backdropHint: string;
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
  glass: {
    title: "液态玻璃",
    reset: "恢复液态玻璃默认",
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
    backdrops: { none: "无", wallpaper: "桌面壁纸" },
    backdropHint: "透出岛正后方的壁纸并磨砂，「玻璃强度」决定盖在上面的底色有多浓。背后有窗口挡着时仍显示壁纸；系统关掉「透明效果」或读不到壁纸时照旧用纯色玻璃。",
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
  glass: {
    title: "Liquid glass",
    reset: "Restore liquid glass defaults",
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
    backdrops: { none: "Nothing", wallpaper: "Desktop wallpaper" },
    backdropHint: "Shows the wallpaper right behind the island, frosted; glass strength sets how thick the tint over it is. Windows behind the island are not shown; with Transparency effects off or no wallpaper to read, the glass stays solid.",
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
