export type SettingsOverviewText = {
  intro: string;
  basicsTitle: string;
  tone: string;
  toneHint: string;
  featuresTitle: string;
  featuresFooter: string;
  open: string;
  features: Record<"todos" | "calendar" | "music" | "translation" | "clipboard" | "shelf" | "screenshot" | "agents" | "messages", string>;
  messagesAction: string;
  nextTitle: string;
  look: string;
  lookHint: string;
  themes: string;
  themesHint: string;
  shortcuts: string;
  shortcutsHint: string;
  guide: string;
  guideHint: string;
  go: string;
  moreFeatures: string;
};

export const zhCN: SettingsOverviewText = {
  intro: "浮屿是停在屏幕顶部的小岛：鼠标移上去或点一下就展开。先在这里定好常用的几项，再打开你想用的功能；没打开的功能不会出现在左边的菜单里。",
  basicsTitle: "常用",
  tone: "深色或浅色",
  toneHint: "跟随系统时，系统切换深浅色，岛也跟着换。",
  featuresTitle: "功能",
  featuresFooter: "关掉的功能会从岛上和左边菜单里藏起来，后台也停下；已有数据都保留，随时可以再打开。",
  open: "设置",
  features: {
    todos: "岛上记今天要做的事，做完打勾",
    calendar: "看日程，会议开始前在岛上提醒",
    music: "显示正在播放的歌和歌词，切歌暂停",
    translation: "选中文字按快捷键，马上翻译",
    clipboard: "记住复制过的文字和图片，随时再贴",
    shelf: "把文件拖到岛上先放着，用时再拖走",
    screenshot: "框选截图，标注、贴到屏幕上或识别文字",
    agents: "Claude Code、Codex 在干什么、在等你，岛上一眼看到",
    messages: "QQ、微信和邮箱的新消息在岛上提醒",
  },
  messagesAction: "选择消息来源",
  nextTitle: "接下来",
  look: "调整岛的样子",
  lookHint: "大小、收起时显示什么、离顶部多远。",
  themes: "换一套主题",
  themesHint: "从主题市场挑别人做好的配色和风格。",
  shortcuts: "查看所有快捷键",
  shortcutsHint: "翻页、翻译、剪贴板、截图的按键都在这里。",
  guide: "再看一遍新手引导",
  guideHint: "在真的岛上一步步演示怎么用。",
  go: "前往",
  moreFeatures: "开启更多功能",
};

export const en: SettingsOverviewText = {
  intro: "Fuyu is a small island at the top of your screen: point at it or click it to open it. Pick the common settings here, then turn on the features you want. Features that are off stay out of the menu on the left.",
  basicsTitle: "Common",
  tone: "Dark or light",
  toneHint: "With System, the island switches when your system does.",
  featuresTitle: "Features",
  featuresFooter: "A feature that is off hides from the island and the menu on the left and stops working in the background. Its data is kept, so you can turn it back on any time.",
  open: "Settings",
  features: {
    todos: "Keep today's to-dos on the island and tick them off",
    calendar: "See your events and get a nudge before meetings",
    music: "See what is playing with lyrics, skip and pause",
    translation: "Select text, press a shortcut, read the translation",
    clipboard: "Keep what you copied, text and images, to paste again",
    shelf: "Drop files on the island and drag them out later",
    screenshot: "Capture a region, mark it up, pin it or read its text",
    agents: "See at a glance what Claude Code and Codex are doing and when they need you",
    messages: "New QQ, WeChat and mail messages show on the island",
  },
  messagesAction: "Choose sources",
  nextTitle: "Next",
  look: "Adjust how the island looks",
  lookHint: "Size, what the collapsed island shows, distance from the top.",
  themes: "Try another theme",
  themesHint: "Pick colours and styles others made in the theme market.",
  shortcuts: "See all shortcuts",
  shortcutsHint: "Keys for pages, translation, the clipboard and screenshots.",
  guide: "Watch the guide again",
  guideHint: "A step-by-step demo on the real island.",
  go: "Open",
  moreFeatures: "Turn on more features",
};
