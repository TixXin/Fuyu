import { en as dailyEn, zhCN as dailyZh, type DailyWidgetsText } from "./dailyWidgets.ts";

export type IslandWidgetsText = {
  sizes: { bar: string; s: string; m: string; l: string; w: string };
  groups: { todos: string; calendar: string; music: string; agents: string; usage: string; clipboard: string; shelf: string; timer: string; daily: string; messages: string; screenshot: string; translation: string; system: string };
  widgets: {
    todos: string;
    nextMeeting: string;
    nowPlaying: string;
    lyrics: string;
    agentSessions: string;
    usage: (provider: string) => string;
    clipboard: string;
    shelf: string;
    timer: string;
    monthCalendar: string;
    stopwatch: string;
    unread: string;
    screenshot: string;
    translate: string;
    systemStatus: string;
    battery: string;
    peripherals: string;
    network: string;
    launcher: string;
    levels: string;
  };
  daily: DailyWidgetsText;
  panel: {
    empty: string;
    templateHint: string;
    templates: { fuyu: string; workbench: string; fun: string };
    templateDetail: { fuyu: string; workbench: string; fun: string };
    edit: string;
    done: string;
    addWidget: string;
    removeWidget: (name: string) => string;
    stretchWidget: (name: string) => string;
    moveLeft: (name: string) => string;
    moveRight: (name: string) => string;
    resizeWidget: (name: string) => string;
    addThis: (name: string) => string;
    removed: (name: string) => string;
    reset: string;
    resetDone: string;
    undo: string;
    emptyEditing: string;
    modes: { grid: string; free: string };
    mode: string;
    gridHint: string;
    freeHint: string;
    allAdded: string;
    plugin: string;
  };
  content: {
    todosEmpty: string;
    todosLeft: (count: number) => string;
    noMeeting: string;
    meetingIn: (minutes: number) => string;
    meetingNow: string;
    allDay: string;
    notPlaying: string;
    noLyrics: string;
    noSessions: string;
    sessionCount: (count: number) => string;
    clipboardEmpty: string;
    shelfEmpty: string;
    shelfCount: (count: number) => string;
    noTimers: string;
    image: string;
    files: (count: number) => string;
    usageUnknown: string;
    eventsToday: (count: number) => string;
    start: string;
    pause: string;
    reset: string;
    noUnread: string;
    sources: { qq: string; wechat: string; mail: string; other: string };
    takeScreenshot: string;
    copyScreenshot: string;
    noScreenshots: string;
    translatePlaceholder: string;
    translating: string;
    copyResult: string;
    cpu: string;
    memory: string;
    charging: string;
    charged: string;
    onBattery: string;
    noBattery: string;
    noBatteryHint: string;
    noPeripherals: string;
    peripheralLevel: (name: string, level: number) => string;
    bluetoothAccessAsk: string;
    bluetoothAccessHint: string;
    bluetoothAccessDenied: string;
    bluetoothOpenSettings: string;
    quickTargets: { files: string; terminal: string; calculator: string; settings: string };
    volume: string;
    brightness: string;
    noBrightness: string;
  };
};

export const zhCN: IslandWidgetsText = {
  sizes: { bar: "条", s: "小", m: "中", l: "大", w: "宽" },
  groups: { todos: "待办", calendar: "日历", music: "音乐", agents: "AI Agent", usage: "用量", clipboard: "剪贴板", shelf: "文件中转", timer: "计时器", daily: "日常", messages: "消息", screenshot: "截图", translation: "翻译", system: "系统" },
  widgets: {
    todos: "今天的待办",
    nextMeeting: "下一个会议",
    nowPlaying: "正在播放",
    lyrics: "歌词",
    agentSessions: "Agent 会话",
    usage: (provider) => `${provider} 用量`,
    clipboard: "最近剪贴板",
    shelf: "文件中转",
    timer: "计时器",
    monthCalendar: "月历",
    stopwatch: "秒表",
    unread: "未读消息",
    screenshot: "最近截图",
    translate: "翻译",
    systemStatus: "系统状态",
    battery: "电池",
    peripherals: "外设电量",
    network: "网速",
    launcher: "快捷启动",
    levels: "音量亮度",
  },
  daily: dailyZh,
  panel: {
    empty: "这个面板还没有组件",
    templateHint: "从模板开始，或者点右上角的布局按钮自己加",
    templates: { fuyu: "Fuyu 默认", workbench: "工作台", fun: "娱乐" },
    templateDetail: { fuyu: "今日 · 番茄钟 · 系统等全套", workbench: "待办 · 会议 · Agent", fun: "音乐 · 歌词 · 天气" },
    edit: "调整布局",
    done: "完成调整",
    addWidget: "添加组件",
    removeWidget: (name) => `拿掉「${name}」`,
    stretchWidget: (name) => `拉伸「${name}」`,
    moveLeft: (name) => `「${name}」往前挪`,
    moveRight: (name) => `「${name}」往后挪`,
    resizeWidget: (name) => `换「${name}」的大小`,
    addThis: (name) => `加上「${name}」`,
    removed: (name) => `拿掉了「${name}」`,
    reset: "恢复默认",
    resetDone: "已恢复默认布局",
    undo: "撤销",
    emptyEditing: "点下面的组件加到面板上",
    modes: { grid: "网格", free: "自由" },
    mode: "排版",
    gridHint: "拖动或点箭头换位置 · 自动保存",
    freeHint: "拖动摆位置，拉右下角改大小 · 自动保存",
    allAdded: "能加的组件都加上了",
    plugin: "插件",
  },
  content: {
    todosEmpty: "今天没有待办",
    todosLeft: (count) => `剩 ${count} 项`,
    noMeeting: "接下来没有会议",
    meetingIn: (minutes) => (minutes < 60 ? `${minutes} 分钟后` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分后`),
    meetingNow: "进行中",
    allDay: "全天",
    notPlaying: "没在播放",
    noLyrics: "没有歌词",
    noSessions: "没有 Agent 会话",
    sessionCount: (count) => `${count} 个会话`,
    clipboardEmpty: "剪贴板记录是空的",
    shelfEmpty: "拖文件到岛上",
    shelfCount: (count) => `${count} 个文件`,
    noTimers: "没有计时",
    image: "图片",
    files: (count) => `${count} 个文件`,
    usageUnknown: "还没有用量",
    eventsToday: (count) => (count ? `今天 ${count} 个日程` : "今天没有日程"),
    start: "开始",
    pause: "暂停",
    reset: "清零",
    noUnread: "没有未读",
    sources: { qq: "QQ", wechat: "微信", mail: "邮件", other: "其他" },
    takeScreenshot: "截图",
    copyScreenshot: "复制这张截图",
    noScreenshots: "还没有截图",
    translatePlaceholder: "输入文字，回车翻译",
    translating: "翻译中…",
    copyResult: "复制译文",
    cpu: "CPU",
    memory: "内存",
    charging: "充电中",
    charged: "已充满",
    onBattery: "使用电池",
    noBattery: "这台电脑没有电池",
    noBatteryHint: "长按可移除这一格",
    noPeripherals: "没有连着能读到电量的设备",
    peripheralLevel: (name, level) => `${name} 电量 ${level}%`,
    bluetoothAccessAsk: "读取第三方蓝牙设备",
    bluetoothAccessHint: "允许浮屿使用蓝牙，读取第三方耳机、鼠标和键盘的电量",
    bluetoothAccessDenied: "浮屿没有蓝牙权限，读不到第三方设备的电量",
    bluetoothOpenSettings: "打开系统设置",
    quickTargets: { files: "文件", terminal: "终端", calculator: "计算器", settings: "系统设置" },
    volume: "音量",
    brightness: "亮度",
    noBrightness: "这块屏幕读不到亮度",
  },
};

export const en: IslandWidgetsText = {
  sizes: { bar: "Bar", s: "S", m: "M", l: "L", w: "Wide" },
  groups: { todos: "Todos", calendar: "Calendar", music: "Music", agents: "AI Agent", usage: "Usage", clipboard: "Clipboard", shelf: "File shelf", timer: "Timer", daily: "Daily", messages: "Messages", screenshot: "Screenshot", translation: "Translation", system: "System" },
  widgets: {
    todos: "Today's todos",
    nextMeeting: "Next meeting",
    nowPlaying: "Now playing",
    lyrics: "Lyrics",
    agentSessions: "Agent sessions",
    usage: (provider) => `${provider} usage`,
    clipboard: "Recent clipboard",
    shelf: "File shelf",
    timer: "Timer",
    monthCalendar: "Month",
    stopwatch: "Stopwatch",
    unread: "Unread",
    screenshot: "Latest screenshot",
    translate: "Translate",
    systemStatus: "System",
    battery: "Battery",
    peripherals: "Device batteries",
    network: "Network",
    launcher: "Quick launch",
    levels: "Volume & brightness",
  },
  daily: dailyEn,
  panel: {
    empty: "This panel has no widgets yet",
    templateHint: "Start from a template, or use the layout button to add your own",
    templates: { fuyu: "Fuyu default", workbench: "Workbench", fun: "Leisure" },
    templateDetail: { fuyu: "Today · Pomodoro · System and more", workbench: "Todos · Meeting · Agent", fun: "Music · Lyrics · Weather" },
    edit: "Edit layout",
    done: "Done editing",
    addWidget: "Add widget",
    removeWidget: (name) => `Remove ${name}`,
    stretchWidget: (name) => `Resize ${name}`,
    moveLeft: (name) => `Move ${name} earlier`,
    moveRight: (name) => `Move ${name} later`,
    resizeWidget: (name) => `Change the size of ${name}`,
    addThis: (name) => `Add ${name}`,
    removed: (name) => `Removed ${name}`,
    reset: "Reset",
    resetDone: "Back to the default layout",
    undo: "Undo",
    emptyEditing: "Click a widget below to add it",
    modes: { grid: "Grid", free: "Free" },
    mode: "Layout",
    gridHint: "Drag or use the arrows to reorder · Saved automatically",
    freeHint: "Drag to move, pull the corner to resize · Saved automatically",
    allAdded: "Every widget is already here",
    plugin: "Plugin",
  },
  content: {
    todosEmpty: "Nothing to do today",
    todosLeft: (count) => `${count} left`,
    noMeeting: "No meetings coming up",
    meetingIn: (minutes) => (minutes < 60 ? `in ${minutes} min` : `in ${Math.floor(minutes / 60)} h ${minutes % 60} min`),
    meetingNow: "Now",
    allDay: "All day",
    notPlaying: "Nothing playing",
    noLyrics: "No lyrics",
    noSessions: "No agent sessions",
    sessionCount: (count) => `${count} ${count === 1 ? "session" : "sessions"}`,
    clipboardEmpty: "Clipboard history is empty",
    shelfEmpty: "Drop files on the island",
    shelfCount: (count) => `${count} ${count === 1 ? "file" : "files"}`,
    noTimers: "No timers",
    image: "Image",
    files: (count) => `${count} ${count === 1 ? "file" : "files"}`,
    usageUnknown: "No usage yet",
    eventsToday: (count) => (count ? `${count} ${count === 1 ? "event" : "events"} today` : "Nothing today"),
    start: "Start",
    pause: "Pause",
    reset: "Reset",
    noUnread: "All read",
    sources: { qq: "QQ", wechat: "WeChat", mail: "Mail", other: "Other" },
    takeScreenshot: "Take a screenshot",
    copyScreenshot: "Copy this screenshot",
    noScreenshots: "No screenshots yet",
    translatePlaceholder: "Type and press Enter",
    translating: "Translating…",
    copyResult: "Copy the translation",
    cpu: "CPU",
    memory: "Memory",
    charging: "Charging",
    charged: "Fully charged",
    onBattery: "On battery",
    noBattery: "No battery",
    noBatteryHint: "Long-press to remove",
    noPeripherals: "No connected device reports its battery",
    peripheralLevel: (name, level) => `${name} battery ${level}%`,
    bluetoothAccessAsk: "Read other Bluetooth devices",
    bluetoothAccessHint: "Let Fuyu use Bluetooth to read the battery of third-party headphones, mice and keyboards",
    bluetoothAccessDenied: "Fuyu has no Bluetooth access, so third-party devices are not shown",
    bluetoothOpenSettings: "Open System Settings",
    quickTargets: { files: "Files", terminal: "Terminal", calculator: "Calculator", settings: "System settings" },
    volume: "Volume",
    brightness: "Brightness",
    noBrightness: "Brightness isn't readable on this screen",
  },
};
