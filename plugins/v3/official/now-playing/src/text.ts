import type { Locale } from "./locale.ts";

const zh = {
  name: "换歌提示",
  noticeTitle: "提示",
  noticeHint: "岛展开、贴边收起或安静模式时不弹提示，岛上正显示 Agent 提示或聊天消息时也不弹；之后的下一首照常提示。",
  autoNotify: "换歌时提示",
  lastOnly: "连续切歌只提示最后一首",
  skipFrontmost: "播放软件在最前面时不提示",
  browsers: "浏览器里播放的也提示",
  showNow: "现在提示一次",
  nothingPlaying: "现在没有在放歌",
  shown: "已在岛上提示",
  notShown: "岛没有收起，这次没有弹出",
  playing: "正在放：",
  unknownArtist: "未知歌手",
  displayTitle: "显示",
  content: "显示内容",
  contentTitleArtist: "歌名 + 歌手",
  contentTitle: "只有歌名",
  contentAlbum: "歌名 + 歌手 + 专辑",
  duration: "停留时长",
  seconds: (n: number) => `${n} 秒`,
  showControls: "显示上一首、暂停、下一首按钮",
  appsTitle: "音乐软件",
  appsMode: "提示来自",
  appsAll: "全部",
  appsSome: "只提示选中的",
  appsEmpty: "放过歌的软件会出现在这里。",
  appsNoneTicked: "一个都没选，换歌时不会提示。",
} as const;

type Text = { [K in keyof typeof zh]: (typeof zh)[K] extends (n: number) => string ? (n: number) => string : string };

const en: Text = {
  name: "Track change notice",
  noticeTitle: "Notice",
  noticeHint: "No notice pops up while the island is expanded, tucked away or quiet, or while it is showing an agent notice or a chat message; the next track after that shows as usual.",
  autoNotify: "Notify on track change",
  lastOnly: "When skipping quickly, only show the last track",
  skipFrontmost: "Skip it while the player is the front app",
  browsers: "Also notify for playback in browsers",
  showNow: "Show it now",
  nothingPlaying: "Nothing is playing right now",
  shown: "Shown on the island",
  notShown: "The island is not collapsed, so nothing popped up",
  playing: "Playing: ",
  unknownArtist: "Unknown artist",
  displayTitle: "Display",
  content: "Show",
  contentTitleArtist: "Title + artist",
  contentTitle: "Title only",
  contentAlbum: "Title + artist + album",
  duration: "Stay for",
  seconds: (n: number) => `${n} s`,
  showControls: "Show previous, pause and next buttons",
  appsTitle: "Music apps",
  appsMode: "Notify for",
  appsAll: "All",
  appsSome: "Only the ticked ones",
  appsEmpty: "Apps that have played music show up here.",
  appsNoneTicked: "None ticked, so no notice will pop up.",
};

export const TEXT: Record<Locale, Text> = { "zh-CN": zh, en };

export const COMMAND_TITLE = { "zh-CN": "立即提示当前歌曲", en: "Show the current song" };
