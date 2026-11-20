export type IslandWidgetsText = {
  sizes: { bar: string; s: string; m: string; l: string; w: string };
  groups: { todos: string; calendar: string; music: string; agents: string; usage: string; clipboard: string; shelf: string; timer: string };
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
  };
  panel: {
    defaultName: string;
    empty: string;
    templateHint: string;
    templates: { workbench: string; fun: string };
    templateDetail: { workbench: string; fun: string };
    edit: string;
    done: string;
    addWidget: string;
    removeWidget: (name: string) => string;
    stretchWidget: (name: string) => string;
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
  };
};

export const zhCN: IslandWidgetsText = {
  sizes: { bar: "条", s: "小", m: "中", l: "大", w: "宽" },
  groups: { todos: "待办", calendar: "日历", music: "音乐", agents: "AI Agent", usage: "用量", clipboard: "剪贴板", shelf: "文件中转", timer: "计时器" },
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
  },
  panel: {
    defaultName: "新面板",
    empty: "这个面板还没有组件",
    templateHint: "从模板开始，或者点「编辑」自己加",
    templates: { workbench: "工作台", fun: "娱乐" },
    templateDetail: { workbench: "待办 · 会议 · Agent", fun: "音乐 · 歌词 · 天气" },
    edit: "编辑",
    done: "完成",
    addWidget: "添加组件",
    removeWidget: (name) => `拿掉「${name}」`,
    stretchWidget: (name) => `拉伸「${name}」`,
    modes: { grid: "网格", free: "自己摆" },
    mode: "排版",
    gridHint: "拖动换顺序，点一下换大小",
    freeHint: "拖动摆位置，拉右下角改大小",
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
  },
};

export const en: IslandWidgetsText = {
  sizes: { bar: "Bar", s: "S", m: "M", l: "L", w: "Wide" },
  groups: { todos: "Todos", calendar: "Calendar", music: "Music", agents: "AI Agent", usage: "Usage", clipboard: "Clipboard", shelf: "File shelf", timer: "Timer" },
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
  },
  panel: {
    defaultName: "New panel",
    empty: "This panel has no widgets yet",
    templateHint: "Start from a template, or tap Edit to add your own",
    templates: { workbench: "Workbench", fun: "Leisure" },
    templateDetail: { workbench: "Todos · Meeting · Agent", fun: "Music · Lyrics · Weather" },
    edit: "Edit",
    done: "Done",
    addWidget: "Add widget",
    removeWidget: (name) => `Remove ${name}`,
    stretchWidget: (name) => `Resize ${name}`,
    modes: { grid: "Grid", free: "Free" },
    mode: "Layout",
    gridHint: "Drag to reorder, tap to change size",
    freeHint: "Drag to move, pull the corner to resize",
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
  },
};
