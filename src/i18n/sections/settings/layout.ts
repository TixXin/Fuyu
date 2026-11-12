export type SettingsLayoutText = {
  collapsedScale: string;
  expandedScale: string;
  showCollapsedText: string;
  showIdleTodoCount: string;
  title: string;
  sizeTitle: string;
  cornersTitle: string;
  opacity: string;
  marginY: string;
  topFilletRadius: string;
  islandCornerRadius: string;
  islandCornerShape: string;
  cornerShapeSquircle: string;
  cornerShapeRound: string;
  maxPanelHeight: string;
  panelWidth: string;
  collapsedWidthExtra: string;
  collapsedWidthHint: string;
  panelSizeHint: string;
  launchAtStartup: string;
  showTitle: string;
  displayTitle: string;
  minimizeAction: string;
  minimizeToTray: string;
  minimizeToTop: string;
  autoTuck: string;
  autoTuckSeconds: string;
  autoTuckRetract: string;
  autoTuckRetractDelay: string;
  autoTuckHint: string;
  minimizeHint: string;
  seconds: (value: number) => string;
  minutes: (value: number) => string;
  resetToDefault: string;
};

export const zhCN: SettingsLayoutText = {
  collapsedScale: "折叠岛屿大小",
  expandedScale: "展开面板大小",
  showCollapsedText: "显示折叠岛屿文字",
  showIdleTodoCount: "空闲时显示剩余待办数",
  title: "尺寸与位置",
  sizeTitle: "尺寸",
  cornersTitle: "圆角",
  opacity: "不透明度",
  marginY: "顶部距离",
  topFilletRadius: "贴顶圆角",
  islandCornerRadius: "岛屿圆角",
  islandCornerShape: "圆角样式",
  cornerShapeSquircle: "方圆",
  cornerShapeRound: "圆角",
  maxPanelHeight: "面板高度",
  panelWidth: "面板宽度",
  collapsedWidthExtra: "折叠岛屿宽度",
  collapsedWidthHint: "在随内容变化的宽度上加宽或收窄。也可以按住 Alt 拖动折叠岛屿的左右边缘来调。",
  panelSizeHint: "所有页面都用这个宽度和高度，内容多了在页面里滚动。也可以按住 Alt 拖动展开面板的左右边缘或底边来调。",
  launchAtStartup: "开机自启动",
  showTitle: "显示岛屿名称",
  displayTitle: "显示内容",
  minimizeAction: "最小化按钮",
  minimizeToTray: "托盘",
  minimizeToTop: "贴边隐藏",
  autoTuck: "闲置时贴边隐藏",
  autoTuckSeconds: "闲置多久后隐藏",
  autoTuckRetract: "鼠标移开后再次隐藏",
  autoTuckRetractDelay: "再次隐藏前等待",
  autoTuckHint: "一段时间没有操作后，岛屿贴到屏幕顶部，只露出一条边。",
  minimizeHint: "点岛上的最小化按钮时，隐藏到托盘还是贴到屏幕顶部。",
  seconds: (value) => `${value} 秒`,
  minutes: (value) => `${value} 分钟`,
  resetToDefault: "恢复默认值",
};

export const en: SettingsLayoutText = {
  collapsedScale: "Collapsed island scale",
  expandedScale: "Expanded panel scale",
  showCollapsedText: "Show collapsed island text",
  showIdleTodoCount: "Show todo count when idle",
  title: "Size & position",
  sizeTitle: "Size",
  cornersTitle: "Corners",
  opacity: "Opacity",
  marginY: "Top margin",
  topFilletRadius: "Top-edge corner radius",
  islandCornerRadius: "Island corner radius",
  islandCornerShape: "Corner style",
  cornerShapeSquircle: "Squircle",
  cornerShapeRound: "Round",
  maxPanelHeight: "Panel height",
  panelWidth: "Panel width",
  collapsedWidthExtra: "Collapsed island width",
  collapsedWidthHint: "Widens or narrows the width that follows the content. Or hold Alt and drag the collapsed island's sides.",
  panelSizeHint: "Every page has this width and height and scrolls inside when it holds more. Or hold Alt and drag the open panel's side or bottom edge.",
  launchAtStartup: "Launch at startup",
  showTitle: "Show island name",
  displayTitle: "Display",
  minimizeAction: "Minimize button",
  minimizeToTray: "Tray",
  minimizeToTop: "Tuck to edge",
  autoTuck: "Tuck to the edge when idle",
  autoTuckSeconds: "Idle time",
  autoTuckRetract: "Tuck again when the pointer leaves",
  autoTuckRetractDelay: "Wait before tucking again",
  autoTuckHint: "After a while without use, the island slides up to the top of the screen and shows only an edge.",
  minimizeHint: "Whether the island's minimize button hides it in the tray or tucks it to the top edge.",
  seconds: (value) => `${value} s`,
  minutes: (value) => `${value} min`,
  resetToDefault: "Reset to default",
};
