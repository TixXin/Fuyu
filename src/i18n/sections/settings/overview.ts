export type SettingsOverviewText = {
  greeting: Record<"morning" | "noon" | "afternoon" | "evening" | "night", string>;
  summary: (count: number) => string;
  summaryNone: string;
  demo: Record<"todos" | "calendar" | "music" | "translation" | "clipboard" | "shelf" | "screenshot" | "agents" | "messages", string>;
  featuresOn: (on: number, all: number) => string;
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
  moreFeatures: string;
};

export const zhCN: SettingsOverviewText = {
  greeting: { morning: "早上好", noon: "中午好", afternoon: "下午好", evening: "晚上好", night: "夜深了" },
  summary: (count) => `岛上开着 ${count} 个功能。把鼠标移到下面的卡片上，看它在岛上的样子。`,
  summaryNone: "岛上还没有打开的功能。在下面挑几个打开，鼠标移上去能先看它在岛上的样子。",
  demo: {
    todos: "写周报 · 还剩 3 件",
    calendar: "周会 · 8 分钟后开始",
    music: "♪ 风从山谷那边吹过来",
    translation: "Hello → 你好",
    clipboard: "已复制 · 会议纪要的第二段",
    shelf: "3 个文件先放在这儿",
    screenshot: "截图已复制 · 点一下标注",
    agents: "Claude Code 在等你确认",
    messages: "小王：我到楼下了",
  },
  featuresOn: (on, all) => `已开 ${on} / ${all}`,
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
  moreFeatures: "开启更多功能",
};

export const en: SettingsOverviewText = {
  greeting: { morning: "Good morning", noon: "Good day", afternoon: "Good afternoon", evening: "Good evening", night: "Up late" },
  summary: (count) => `${count} ${count === 1 ? "feature is" : "features are"} on. Point at a card below to see it on the island.`,
  summaryNone: "No features are on yet. Pick a few below; point at one to see it on the island first.",
  demo: {
    todos: "Weekly report · 3 left",
    calendar: "Stand-up · in 8 min",
    music: "♪ The wind comes over the valley",
    translation: "你好 → Hello",
    clipboard: "Copied · second paragraph of the notes",
    shelf: "3 files resting here",
    screenshot: "Screenshot copied · click to mark up",
    agents: "Claude Code is waiting for you",
    messages: "Sam: I'm downstairs",
  },
  featuresOn: (on, all) => `${on} of ${all} on`,
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
  moreFeatures: "Turn on more features",
};
