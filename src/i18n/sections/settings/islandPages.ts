export type SettingsIslandPagesText = {
  title: string;
  hint: string;
  plugin: string;
  off: string;
  hidden: string;
  showPage: (name: string) => string;
  reset: string;
  loading: string;
  panels: {
    tag: string;
    create: string;
    edit: (name: string) => string;
    editorTitle: (name: string) => string;
    close: string;
    name: string;
    icon: string;
    iconNames: Record<"layout-grid" | "star" | "briefcase" | "coffee" | "music" | "zap" | "heart" | "home" | "gamepad" | "book", string>;
    remove: string;
    confirmRemove: string;
    canvasHint: string;
    empty: string;
    removeWidget: (name: string) => string;
    moveWidget: (name: string) => string;
    unavailable: string;
    library: string;
    search: string;
    noMatch: string;
    addSize: (name: string, size: string) => string;
    onBar: (name: string) => string;
    offBar: (name: string) => string;
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
  hint: "展开后顶部的页面，按这里的顺序排，Alt+数字和切换上一页、下一页也按这个顺序。隐藏只是不在顶部出现、不进页面切换，功能照常在后台运行，从收起条或通知仍能打开那一页。关掉的功能不会出现在岛上。",
  plugin: "插件",
  off: "功能已关",
  hidden: "已隐藏",
  showPage: (name) => `在顶部显示：${name}`,
  reset: "恢复默认顺序",
  loading: "插件页面要等岛启动后才列出来。",
  panels: {
    tag: "自定义",
    create: "新建面板",
    edit: (name) => `编辑面板：${name}`,
    editorTitle: (name) => `编辑「${name}」`,
    close: "完成",
    name: "名字",
    icon: "图标",
    iconNames: { "layout-grid": "网格", star: "星星", briefcase: "公文包", coffee: "咖啡", music: "音乐", zap: "闪电", heart: "爱心", home: "房子", gamepad: "手柄", book: "书" },
    remove: "删除面板",
    confirmRemove: "再点一次删除",
    canvasHint: "拖动组件换位置，压到别的组件时它会往下挪；选中后也能用方向键移动。岛上最多显示 4 行，再多时在面板里滚动。",
    empty: "从下面的组件库里点一个尺寸，把组件加进来。",
    removeWidget: (name) => `从面板拿掉：${name}`,
    moveWidget: (name) => `${name}，拖动或用方向键移动`,
    unavailable: "现在不可用",
    library: "组件库",
    search: "搜索组件",
    noMatch: "没有匹配的组件",
    addSize: (name, size) => `把「${name}」以「${size}」尺寸加到面板`,
    onBar: (name) => `「${name}」已在收起条上，点一下拿下来`,
    offBar: (name) => `把「${name}」放到收起条上`,
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
  hint: "The pages at the top of the expanded island, in this order. Alt+number and next / previous page follow it too. Hiding a page only takes it off the top and out of page switching: the feature keeps running, and the bar or a notification can still open that page. Features that are off never show on the island.",
  plugin: "Plugin",
  off: "Feature off",
  hidden: "Hidden",
  showPage: (name) => `Show at the top: ${name}`,
  reset: "Restore default order",
  loading: "Plugin pages are listed once the island has started.",
  panels: {
    tag: "Custom",
    create: "New panel",
    edit: (name) => `Edit panel: ${name}`,
    editorTitle: (name) => `Edit "${name}"`,
    close: "Done",
    name: "Name",
    icon: "Icon",
    iconNames: { "layout-grid": "Grid", star: "Star", briefcase: "Briefcase", coffee: "Coffee", music: "Music", zap: "Bolt", heart: "Heart", home: "Home", gamepad: "Gamepad", book: "Book" },
    remove: "Delete panel",
    confirmRemove: "Click again to delete",
    canvasHint: "Drag a widget to move it; widgets in the way move down. A selected widget also moves with the arrow keys. The island shows up to 4 rows and scrolls past that.",
    empty: "Pick a size in the widget library below to add a widget.",
    removeWidget: (name) => `Remove from panel: ${name}`,
    moveWidget: (name) => `${name}, drag or use the arrow keys to move`,
    unavailable: "Not available now",
    library: "Widgets",
    search: "Search widgets",
    noMatch: "No widgets match",
    addSize: (name, size) => `Add ${name} to the panel at size ${size}`,
    onBar: (name) => `${name} is on the collapsed bar, click to take it off`,
    offBar: (name) => `Put ${name} on the collapsed bar`,
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
