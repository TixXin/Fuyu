export type SettingsLayoutText = {
  collapsedScale: string;
  expandedScale: string;
  showCollapsedText: string;
  showIdleTodoCount: string;
  title: string;
  sizeTitle: string;
  collapsedSizeTitle: string;
  expandedSizeTitle: string;
  cornersTitle: string;
  formTitle: string;
  form: string;
  formOptions: Record<"auto" | "top" | "pill" | "notch", string>;
  formHint: string;
  formHintMac: string;
  formOffTopHint: string;
  dragTitle: string;
  dragGrid: string;
  dragGridHint: string;
  opacity: string;
  opacityHint: string;
  islandOpacity: string;
  islandOpacityHint: string;
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
  collapsedWidthHintMac: string;
  panelSizeHint: string;
  panelSizeHintMac: string;
  launchAtStartup: string;
  launchAtStartupMac: string;
  trayIcon: string;
  trayIconMac: string;
  trayIconHiddenHint: string;
  trayIconHiddenHintMac: string;
  trayCard: string;
  trayCardMac: string;
  trayCardHint: string;
  trayCardHintMac: string;
  trayCardOffHint: string;
  trayCardOffHintMac: string;
  trayCardLayouts: Record<"entry" | "status" | "compact", { label: string; hint: string }>;
  showTitle: string;
  displayTitle: string;
  minimizeAction: string;
  minimizeToTray: string;
  minimizeToMenuBar: string;
  minimizeToTop: string;
  autoTuck: string;
  autoTuckSeconds: string;
  autoTuckRetract: string;
  autoTuckRetractDelay: string;
  autoTuckHint: string;
  minimizeHint: string;
  minimizeHintMac: string;
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
  collapsedSizeTitle: "折叠岛屿",
  expandedSizeTitle: "展开面板",
  cornersTitle: "圆角",
  formTitle: "形态",
  form: "岛的形态",
  formOptions: { auto: "自动", top: "贴顶", pill: "悬空药丸", notch: "刘海" },
  formHint: "药丸离顶 10px，带投影；刘海是顶部正中 240×32 的黑色刘海，折叠时两边放图标。",
  formHintMac: "自动：有刘海的屏幕用刘海，其他屏幕贴顶。药丸从菜单栏下沿离开 10px；刘海在有刘海的屏幕上贴合刘海。有刘海时选贴顶或药丸，岛会让到菜单栏下面。",
  formOffTopHint: "吸在底边或侧边时不生效，回到顶边后照这里的形态。",
  dragTitle: "拖动",
  dragGrid: "拖动时显示中线辅助线",
  dragGridHint: "拖岛时在当前屏幕上画出横竖两条中线，把屏幕分成四格。贴着上下左右四条边的正中时会轻轻吸住，方便居中放下，这一点不受开关影响。",
  opacity: "不透明度",
  opacityHint: "只调整岛底色的浓淡，文字和图标保持不透明。",
  islandOpacity: "整体不透明度",
  islandOpacityHint: "连同文字、图标和展开面板一起调整整个岛的不透明度。",
  marginY: "顶部距离",
  topFilletRadius: "贴边圆角",
  islandCornerRadius: "岛屿圆角",
  islandCornerShape: "圆角样式",
  cornerShapeSquircle: "方圆",
  cornerShapeRound: "圆角",
  maxPanelHeight: "面板高度",
  panelWidth: "面板宽度",
  collapsedWidthExtra: "折叠岛屿宽度",
  collapsedWidthHint: "在随内容变化的宽度上加宽或收窄。也可以按住 Alt 拖动折叠岛屿的左右边缘来调。",
  collapsedWidthHintMac: "在随内容变化的宽度上加宽或收窄。",
  panelSizeHint: "所有页面都用这个宽度和高度，内容多了在页面里滚动。也可以按住 Alt 拖动展开面板的左右边缘或底边来调。",
  panelSizeHintMac: "所有页面都用这个宽度和高度，内容多了在页面里滚动。",
  launchAtStartup: "开机自启动",
  launchAtStartupMac: "登录时打开",
  trayIcon: "在托盘显示图标",
  trayIconMac: "在菜单栏显示图标",
  trayIconHiddenHint: "图标隐藏后，从开始菜单或桌面快捷方式再次打开浮屿，会弹出这一页。",
  trayIconHiddenHintMac: "图标隐藏后，从「应用程序」文件夹、启动台或 Spotlight 再次打开浮屿，会弹出这一页。",
  trayCard: "托盘卡片样式",
  trayCardMac: "菜单栏卡片样式",
  trayCardHint: "点托盘图标（左键或右键）弹出的卡片。",
  trayCardHintMac: "点菜单栏图标（含按住 Control 点按或右键）弹出的卡片。",
  trayCardOffHint: "托盘图标隐藏时用不到卡片。",
  trayCardOffHintMac: "菜单栏图标隐藏时用不到卡片。",
  trayCardLayouts: {
    entry: { label: "入口型", hint: "常用功能一眼都在" },
    status: { label: "状态型", hint: "看歌、会议和 Agent" },
    compact: { label: "精简型", hint: "最小最快" },
  },
  showTitle: "显示岛屿名称",
  displayTitle: "显示内容",
  minimizeAction: "最小化按钮",
  minimizeToTray: "托盘",
  minimizeToMenuBar: "菜单栏",
  minimizeToTop: "贴边隐藏",
  autoTuck: "闲置时贴边隐藏",
  autoTuckSeconds: "闲置多久后隐藏",
  autoTuckRetract: "鼠标移开后再次隐藏",
  autoTuckRetractDelay: "再次隐藏前等待",
  autoTuckHint: "一段时间没有操作后，岛屿贴到屏幕顶部，只露出一条边。",
  minimizeHint: "点岛上的最小化按钮时，隐藏到托盘还是贴到屏幕顶部。",
  minimizeHintMac: "点岛上的最小化按钮时，隐藏到菜单栏还是贴到屏幕顶部。",
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
  collapsedSizeTitle: "Collapsed island",
  expandedSizeTitle: "Open panel",
  cornersTitle: "Corners",
  formTitle: "Form",
  form: "Island form",
  formOptions: { auto: "Auto", top: "Top", pill: "Floating pill", notch: "Notch" },
  formHint: "The pill floats 10px below the top with a shadow; the notch is a 240×32 black notch at the top centre with icons on both sides when collapsed.",
  formHintMac: "Auto uses the notch on screens that have one and Top on other screens. The pill floats 10px below the menu bar; the notch hugs the camera notch on screens that have one. On a notched screen, Top and Pill move below the menu bar.",
  formOffTopHint: "Has no effect while the island is docked to the bottom or a side; it applies again once back at the top.",
  dragTitle: "Dragging",
  dragGrid: "Show centre lines while dragging",
  dragGridHint: "Draws dashed horizontal and vertical centre lines across the current screen while you drag the island, splitting it into quarters. Near the middle of any screen edge the island gently snaps to centre; that works with the lines off too.",
  opacity: "Opacity",
  opacityHint: "Adjusts only the island's background fill while keeping text and icons opaque.",
  islandOpacity: "Island opacity",
  islandOpacityHint: "Dims the entire island, including text, icons and the open panel.",
  marginY: "Top margin",
  topFilletRadius: "Docked corner radius",
  islandCornerRadius: "Island corner radius",
  islandCornerShape: "Corner style",
  cornerShapeSquircle: "Squircle",
  cornerShapeRound: "Round",
  maxPanelHeight: "Panel height",
  panelWidth: "Panel width",
  collapsedWidthExtra: "Collapsed island width",
  collapsedWidthHint: "Widens or narrows the width that follows the content. Or hold Alt and drag the collapsed island's sides.",
  collapsedWidthHintMac: "Widens or narrows the width that follows the content.",
  panelSizeHint: "Every page has this width and height and scrolls inside when it holds more. Or hold Alt and drag the open panel's side or bottom edge.",
  panelSizeHintMac: "Every page has this width and height and scrolls inside when it holds more.",
  launchAtStartup: "Launch at startup",
  launchAtStartupMac: "Open at login",
  trayIcon: "Show icon in the system tray",
  trayIconMac: "Show icon in the menu bar",
  trayIconHiddenHint: "While the icon is hidden, opening Fuyu again from the Start menu or a desktop shortcut brings up this page.",
  trayIconHiddenHintMac: "While the icon is hidden, opening Fuyu again from Applications, Launchpad or Spotlight brings up this page.",
  trayCard: "Tray card style",
  trayCardMac: "Menu bar card style",
  trayCardHint: "The card that opens when you click the tray icon (left or right click).",
  trayCardHintMac: "The card that opens when you click the menu bar icon, including Control-click and right-click.",
  trayCardOffHint: "The card isn't available while the tray icon is hidden.",
  trayCardOffHintMac: "The card isn't available while the menu bar icon is hidden.",
  trayCardLayouts: {
    entry: { label: "Shortcuts", hint: "Everyday features at a glance" },
    status: { label: "Status", hint: "Music, meetings and agents" },
    compact: { label: "Compact", hint: "Smallest and quickest" },
  },
  showTitle: "Show island name",
  displayTitle: "Display",
  minimizeAction: "Minimize button",
  minimizeToTray: "Tray",
  minimizeToMenuBar: "Menu bar",
  minimizeToTop: "Tuck to edge",
  autoTuck: "Tuck to the edge when idle",
  autoTuckSeconds: "Idle time",
  autoTuckRetract: "Tuck again when the pointer leaves",
  autoTuckRetractDelay: "Wait before tucking again",
  autoTuckHint: "After a while without use, the island slides up to the top of the screen and shows only an edge.",
  minimizeHint: "Whether the island's minimize button hides it in the tray or tucks it to the top edge.",
  minimizeHintMac: "Whether the island's minimize button hides it in the menu bar or tucks it to the top edge.",
  seconds: (value) => `${value} s`,
  minutes: (value) => `${value} min`,
  resetToDefault: "Reset to default",
};
