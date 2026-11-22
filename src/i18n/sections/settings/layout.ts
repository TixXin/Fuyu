export type SettingsLayoutText = {
  collapsedScale: string;
  expandedScale: string;
  showCollapsedText: string;
  collapsedOverflowMore: string;
  collapsedOverflowMoreHint: string;
  notchWingMax: string;
  notchWingMaxHint: string;
  notchTextTitle: string;
  notchTextHint: string;
  notchTextKinds: Record<"todos" | "lyrics" | "agent" | "meeting", string>;
  notchTextModes: Record<"panel" | "row" | "flash" | "off", string>;
  textOrderTitle: string;
  textOrderHint: string;
  textOrderShow: (name: string) => string;
  textOrderUp: (name: string) => string;
  textOrderDown: (name: string) => string;
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
  panelSizeHint: string;
  pageSizes: string;
  pageSizesHint: string;
  pageSizesReset: string;
  pageSizeReset: string;
  pageSizeValue: (width: number, height: number) => string;
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
  collapsedOverflowMore: "放不下的项目收进「+N」",
  collapsedOverflowMoreHint: "贴合刘海时两侧位置有限：按下面清单的顺序先放，放不下的收进「+N」，停在或点它查看。关掉后放不下的项目不显示。",
  notchWingMax: "刘海两侧最宽",
  notchWingMaxHint: "贴合刘海时每一侧最多占多宽。每侧至少放得下两项，放不下时自动变宽（最宽 170）；调宽能多放几个项目，也会盖住更多菜单栏。",
  notchTextTitle: "刘海屏上的文字",
  notchTextHint: "刘海挡住了中间，文字放不进收起条。每类文字选一个去处；消息和长提示仍然优先占刘海下面那一行。",
  notchTextKinds: { todos: "待办", lyrics: "歌词", agent: "Agent 标题", meeting: "会议" },
  notchTextModes: { panel: "收进「+N」小面板", row: "刘海下常驻一行", flash: "有变化时出现 4 秒", off: "不显示" },
  textOrderTitle: "文字的先后",
  textOrderHint: "收起条中间同时有几样文字时，显示排在前面的那一样。消息、翻译、截图识字这类临时提示总在最前。Agent 跑完一轮、出错或等你回答时临时排到第二位。歌词排在 Agent 前面时，没找到歌词的歌显示「歌名 - 歌手」。",
  textOrderShow: (name) => `在收起条上显示${name}`,
  textOrderUp: (name) => `把${name}往前移`,
  textOrderDown: (name) => `把${name}往后移`,
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
  collapsedWidthHint: "在随内容变化的宽度上加宽或收窄。也可以把鼠标移到折叠岛屿的左右边缘，出现提示线后拖动来调。",
  panelSizeHint: "所有页面默认都用这个宽度和高度，切换页面时面板大小不变。Fuyu 页也跟着变：组件固定两行，面板更宽时多显示几列，窄到放不下 6 列时组件整体缩小。在岛上改过尺寸的页面记着自己的尺寸，不跟这两项，见下面。",
  pageSizes: "各页面的尺寸",
  pageSizesHint: "在岛上改过尺寸的页面记着自己的尺寸，不跟上面的面板宽度和高度，都列在下面；恢复后回到默认。没有列出页面时，所有页面都用默认尺寸。",
  pageSizesReset: "全部恢复默认",
  pageSizeReset: "恢复默认",
  pageSizeValue: (width, height) => `${width} × ${height} px`,
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
  collapsedOverflowMore: "Put items that do not fit behind +N",
  collapsedOverflowMoreHint: "Beside the notch there is little room: items are placed in the order of the list below, and the rest go behind +N. Hover or click it to see them. When off, items that do not fit are not shown.",
  notchWingMax: "Widest each side of the notch",
  notchWingMaxHint: "How wide each side may grow when the island sits around the notch. Each side always fits two items and widens for them if needed (up to 170); wider fits more items and covers more of the menu bar.",
  notchTextTitle: "Text around the notch",
  notchTextHint: "The notch covers the middle, so text does not fit on the bar. Pick where each kind goes; messages and long notices still take the row under the notch first.",
  notchTextKinds: { todos: "To-do", lyrics: "Lyrics", agent: "Agent title", meeting: "Meeting" },
  notchTextModes: { panel: "In the +N panel", row: "Always, under the notch", flash: "4 seconds when it changes", off: "Hidden" },
  textOrderTitle: "Text order",
  textOrderHint: "When several kinds of text want the middle of the bar, the one higher in this list shows. Messages, translation and screenshot text always come first. An agent that finishes a turn, fails or waits for you moves up to second place for a while. With lyrics above the agent, a song without lyrics shows “title - artist”.",
  textOrderShow: (name) => `Show ${name} on the bar`,
  textOrderUp: (name) => `Move ${name} up`,
  textOrderDown: (name) => `Move ${name} down`,
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
  collapsedWidthHint: "Widens or narrows the width that follows the content. Or point at the collapsed island's side until a line shows, then drag it.",
  panelSizeHint: "Every page uses this width and height by default, so the panel keeps its size when you switch pages. The Fuyu page follows too: two rows of widgets, more columns when the panel is wider, and smaller widgets when it is too narrow for 6 columns. Pages resized on the island keep their own size instead, listed below.",
  pageSizes: "Page sizes",
  pageSizesHint: "Pages resized on the island keep their own size, ignoring the panel width and height above, and are listed below; reset them to go back to the defaults. With none listed, every page uses the defaults.",
  pageSizesReset: "Reset all",
  pageSizeReset: "Reset",
  pageSizeValue: (width, height) => `${width} × ${height} px`,
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
