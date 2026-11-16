export type TrayMenuText = {
  cardName: string;
  appName: string;
  updateBadge: string;
  updateLabel: (version: string) => string;
  separator: string;
  settings: string;
  island: string;
  islandOn: string;
  islandOff: string;
  islandOnShort: string;
  islandOffShort: string;
  showIsland: string;
  hideIsland: string;
  screenshot: string;
  translate: string;
  clipboard: string;
  off: string;
  offHint: (feature: string) => string;
  open: string;
  openPage: (page: string) => string;
  pages: Record<"todo" | "notes" | "calendar" | "file-shelf" | "agent", string>;
  dnd: string;
  clipPaused: string;
  autostart: string;
  autostartMac: string;
  restart: string;
  quit: string;
  nowPlaying: string;
  unknownTrack: string;
  play: string;
  pause: string;
  next: string;
  meetingNow: string;
  meetingIn: (minutes: number) => string;
  meetingInHours: (hours: number) => string;
  join: string;
  agents: string;
  running: (count: number) => string;
  waiting: (count: number) => string;
  idle: string;
  viewAgents: string;
  calm: string;
  calmSub: string;
};

export const zhCN: TrayMenuText = {
  cardName: "浮屿托盘卡片",
  appName: "浮屿",
  updateBadge: "可更新",
  updateLabel: (version) => `有新版本 ${version}，点一下更新`,
  separator: "，",
  settings: "设置",
  island: "岛屿",
  islandOn: "显示中，点一下隐藏",
  islandOff: "已隐藏，点一下显示",
  islandOnShort: "显示中",
  islandOffShort: "已隐藏",
  showIsland: "显示岛屿",
  hideIsland: "隐藏岛屿",
  screenshot: "截图",
  translate: "翻译",
  clipboard: "剪贴板",
  off: "已关闭",
  offHint: (feature) => `已关闭，去 设置 → ${feature} 里打开`,
  open: "打开",
  openPage: (page) => `打开${page}`,
  pages: { todo: "待办", notes: "笔记", calendar: "日历", "file-shelf": "文件中转", agent: "AI 代理" },
  dnd: "游戏勿扰",
  clipPaused: "暂停剪贴板记录",
  autostart: "开机自启",
  autostartMac: "登录时打开",
  restart: "重启",
  quit: "退出",
  nowPlaying: "正在播放",
  unknownTrack: "未知歌曲",
  play: "播放",
  pause: "暂停",
  next: "下一首",
  meetingNow: "正在进行",
  meetingIn: (minutes) => `${minutes} 分钟后`,
  meetingInHours: (hours) => `${hours} 小时后`,
  join: "加入",
  agents: "AI 代理",
  running: (count) => `${count} 个在跑`,
  waiting: (count) => `${count} 个等你`,
  idle: "都歇着",
  viewAgents: "看 Agent 页",
  calm: "现在没什么事",
  calmSub: "有歌在放、快开会或 Agent 在跑时会出现在这里",
};

export const en: TrayMenuText = {
  cardName: "Fuyu tray card",
  appName: "Fuyu",
  updateBadge: "Update",
  updateLabel: (version) => `Version ${version} is out, click to update`,
  separator: ", ",
  settings: "Settings",
  island: "Island",
  islandOn: "Showing, click to hide",
  islandOff: "Hidden, click to show",
  islandOnShort: "Showing",
  islandOffShort: "Hidden",
  showIsland: "Show island",
  hideIsland: "Hide island",
  screenshot: "Screenshot",
  translate: "Translate",
  clipboard: "Clipboard",
  off: "Off",
  offHint: (feature) => `Off. Turn it on in Settings → ${feature}`,
  open: "Open",
  openPage: (page) => `Open ${page}`,
  pages: { todo: "To-dos", notes: "Notes", calendar: "Calendar", "file-shelf": "File shelf", agent: "Agents" },
  dnd: "Game mode",
  clipPaused: "Pause clipboard history",
  autostart: "Launch at startup",
  autostartMac: "Open at login",
  restart: "Restart",
  quit: "Quit",
  nowPlaying: "Now playing",
  unknownTrack: "Unknown track",
  play: "Play",
  pause: "Pause",
  next: "Next",
  meetingNow: "Happening now",
  meetingIn: (minutes) => `in ${minutes} min`,
  meetingInHours: (hours) => `in ${hours} h`,
  join: "Join",
  agents: "Agents",
  running: (count) => `${count} running`,
  waiting: (count) => `${count} waiting for you`,
  idle: "All idle",
  viewAgents: "Open the Agents page",
  calm: "Nothing going on",
  calmSub: "Music, upcoming meetings and running agents show up here",
};
