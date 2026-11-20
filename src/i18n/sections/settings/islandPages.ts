export type SettingsIslandPagesText = {
  title: string;
  hint: string;
  plugin: string;
  off: string;
  hidden: string;
  showPage: (name: string) => string;
  reset: string;
  loading: string;
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
