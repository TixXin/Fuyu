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
  modes: { bar: string; expanded: string };
  preview: { builtin: string; off: string; empty: string; pageOf: (page: number, pages: number) => string; actions: string };
  panels: {
    tag: string;
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
  icons: {
    title: (name: string) => string;
    hint: string;
    fuyuHint: string;
    useDefault: string;
    text: string;
    jellyfish: string;
    names: Record<string, string>;
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
  modes: { bar: "收起的岛预览", expanded: "展开的面板预览" },
  preview: {
    builtin: "内置页面，内容由功能自己决定；可以换顺序或隐藏。",
    off: "这个功能关着，岛上不会出现这一页。",
    empty: "这个面板还没有组件，在下面「可以添加」里点 ＋",
    pageOf: (page, pages) => `第 ${page} / ${pages} 页`,
    actions: "页头按钮",
  },
  panels: {
    tag: "我的",
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
  icons: {
    title: (name) => `页头图标 · ${name}`,
    hint: "展开后顶部这一页用哪个图标。选「默认」换回原来的。",
    fuyuHint: "Fuyu 页默认显示文字，也可以换成水母或其他图标。",
    useDefault: "默认",
    text: "文字 Fuyu",
    jellyfish: "水母",
    names: {
      star: "星星", heart: "爱心", sparkles: "闪光", zap: "闪电", flame: "火焰", sun: "太阳", moon: "月亮", cloud: "云",
      leaf: "叶子", cat: "猫", smile: "笑脸", rocket: "火箭", coffee: "咖啡", music: "音符", headphones: "耳机", "book-open": "书",
      briefcase: "公文包", "calendar-days": "日历", clock: "时钟", timer: "计时器", "list-todo": "清单", clipboard: "剪贴板", folder: "文件夹", camera: "相机",
      image: "图片", "gamepad-2": "手柄", house: "房子", bell: "铃铛", "message-circle": "消息", bot: "机器人", globe: "地球", "layout-grid": "格子",
    },
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
  modes: { bar: "Collapsed island preview", expanded: "Expanded panel preview" },
  preview: {
    builtin: "A built-in page: the feature decides what is on it. You can move or hide it.",
    off: "This feature is off, so the page does not show on the island.",
    empty: "This panel has no widgets yet. Press + under Add below.",
    pageOf: (page, pages) => `Page ${page} of ${pages}`,
    actions: "Header buttons",
  },
  panels: {
    tag: "Mine",
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
  icons: {
    title: (name) => `Tab icon · ${name}`,
    hint: "Which icon this page uses at the top of the open island. Pick Default to go back.",
    fuyuHint: "The Fuyu page shows the word Fuyu by default; it can use the jellyfish or another icon instead.",
    useDefault: "Default",
    text: "Word Fuyu",
    jellyfish: "Jellyfish",
    names: {
      star: "Star", heart: "Heart", sparkles: "Sparkles", zap: "Lightning", flame: "Flame", sun: "Sun", moon: "Moon", cloud: "Cloud",
      leaf: "Leaf", cat: "Cat", smile: "Smile", rocket: "Rocket", coffee: "Coffee", music: "Music note", headphones: "Headphones", "book-open": "Book",
      briefcase: "Briefcase", "calendar-days": "Calendar", clock: "Clock", timer: "Timer", "list-todo": "Checklist", clipboard: "Clipboard", folder: "Folder", camera: "Camera",
      image: "Picture", "gamepad-2": "Gamepad", house: "House", bell: "Bell", "message-circle": "Message", bot: "Robot", globe: "Globe", "layout-grid": "Grid",
    },
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
