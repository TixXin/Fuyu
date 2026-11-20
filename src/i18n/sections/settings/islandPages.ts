export type SettingsIslandPagesText = {
  title: string;
  hint: string;
  plugin: string;
  off: string;
  hidden: string;
  showPage: (name: string) => string;
  reset: string;
  loading: string;
  hidePage: (name: string) => string;
  moveHint: string;
  modes: { label: string; bar: string; expanded: string };
  preview: { builtin: string; off: string; empty: string };
  panels: {
    tag: string;
    create: string;
    name: string;
    icon: string;
    iconNames: Record<"fuyu" | "layout-grid" | "star" | "briefcase" | "coffee" | "music" | "zap" | "heart" | "home" | "gamepad" | "book", string>;
    remove: string;
    confirmRemove: string;
    title: string;
    hint: string;
    inPanel: string;
    available: string;
    none: string;
    allAdded: string;
    add: (name: string) => string;
    removeWidget: (name: string) => string;
    moveWidget: (name: string) => string;
    unavailable: string;
    sizeTitle: string;
    sizeHint: string;
    sizeCard: (size: string, cols: number, rows: number) => string;
    oneSize: string;
  };
  page: {
    agents: string;
    todo: string;
    music: string;
    calendar: string;
    clipboard: string;
    shelf: string;
    screenshots: string;
    timer: string;
    qq: string;
    translation: string;
  };
};

export const zhCN: SettingsIslandPagesText = {
  title: "展开页面",
  hint: "点一下在上面的岛里看这一页。Alt+数字和切换上一页、下一页按这里的顺序。隐藏只是不在顶部出现，功能照常在后台运行，从收起条或通知仍能打开那一页。",
  plugin: "插件",
  off: "功能已关",
  hidden: "已隐藏",
  showPage: (name) => `在顶部显示：${name}`,
  reset: "恢复默认顺序",
  loading: "插件页面要等岛启动后才列出来。",
  hidePage: (name) => `从顶部隐藏：${name}`,
  moveHint: "拖动换位置，也可以选中后按住 Alt 加方向键",
  modes: { label: "预览岛的哪种样子", bar: "收起条", expanded: "展开" },
  preview: {
    builtin: "内置页面，内容由功能自己决定；可以换顺序或隐藏。",
    off: "这个功能关着，岛上不会出现这一页。",
    empty: "这个面板还没有组件，在下面「可以添加」里点 ＋",
  },
  panels: {
    tag: "我的",
    create: "新建面板",
    name: "面板名字",
    icon: "图标",
    iconNames: { fuyu: "文字 Fuyu", "layout-grid": "网格", star: "星星", briefcase: "公文包", coffee: "咖啡", music: "音乐", zap: "闪电", heart: "爱心", home: "房子", gamepad: "手柄", book: "书" },
    remove: "删除这个面板",
    confirmRemove: "再点一次删除",
    title: "面板里的组件",
    hint: "点 ＋ 加进来，点 × 拿掉，拖动换顺序。岛上按顺序从左上往右下自动排，最多显示 4 行，再多时在面板里滚动。",
    inPanel: "面板里",
    available: "可以添加",
    none: "还没有组件",
    allAdded: "都加进来了",
    add: (name) => `加进面板：${name}`,
    removeWidget: (name) => `从面板拿掉：${name}`,
    moveWidget: (name) => `${name}，拖动或按住 Alt 加方向键换顺序`,
    unavailable: "功能已关",
    sizeTitle: "大小",
    sizeHint: "点缩略图换大小，上面的岛跟着变。",
    sizeCard: (size, cols, rows) => `${size} · ${cols}×${rows} 格`,
    oneSize: "这个组件只有一种大小。",
  },
  page: {
    agents: "AI Agent",
    todo: "待办",
    music: "音乐",
    calendar: "日历",
    clipboard: "剪贴板",
    shelf: "文件中转",
    screenshots: "截图",
    timer: "计时器",
    qq: "消息",
    translation: "翻译",
  },
};

export const en: SettingsIslandPagesText = {
  title: "Expanded pages",
  hint: "Click a page to see it on the island above. Alt+number and next / previous page follow this order. Hiding a page only takes it off the top: the feature keeps running, and the bar or a notification can still open that page.",
  plugin: "Plugin",
  off: "Feature off",
  hidden: "Hidden",
  showPage: (name) => `Show at the top: ${name}`,
  reset: "Restore default order",
  loading: "Plugin pages are listed once the island has started.",
  hidePage: (name) => `Hide from the top: ${name}`,
  moveHint: "Drag to move, or select one and press Alt with an arrow key",
  modes: { label: "Which island to preview", bar: "Collapsed bar", expanded: "Expanded" },
  preview: {
    builtin: "A built-in page: the feature decides what is on it. You can move or hide it.",
    off: "This feature is off, so the page does not show on the island.",
    empty: "This panel has no widgets yet. Press + under Add below.",
  },
  panels: {
    tag: "Mine",
    create: "New panel",
    name: "Panel name",
    icon: "Icon",
    iconNames: { fuyu: "Text: Fuyu", "layout-grid": "Grid", star: "Star", briefcase: "Briefcase", coffee: "Coffee", music: "Music", zap: "Bolt", heart: "Heart", home: "Home", gamepad: "Gamepad", book: "Book" },
    remove: "Delete this panel",
    confirmRemove: "Click again to delete",
    title: "Widgets in this panel",
    hint: "Press + to add, × to remove, and drag to reorder. The island lays them out in order from the top left, shows up to 4 rows and scrolls past that.",
    inPanel: "In the panel",
    available: "Add",
    none: "No widgets yet",
    allAdded: "All widgets are in",
    add: (name) => `Add to the panel: ${name}`,
    removeWidget: (name) => `Remove from the panel: ${name}`,
    moveWidget: (name) => `${name}, drag or press Alt with an arrow key to move`,
    unavailable: "Feature off",
    sizeTitle: "Size",
    sizeHint: "Pick a thumbnail to change the size; the island above follows.",
    sizeCard: (size, cols, rows) => `${size} · ${cols}×${rows}`,
    oneSize: "This widget comes in one size only.",
  },
  page: {
    agents: "AI Agent",
    todo: "Todos",
    music: "Music",
    calendar: "Calendar",
    clipboard: "Clipboard",
    shelf: "File shelf",
    screenshots: "Screenshots",
    timer: "Timer",
    qq: "Messages",
    translation: "Translate",
  },
};
