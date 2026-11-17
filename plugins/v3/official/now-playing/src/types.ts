import type { NowPlaying } from "@fuyu/plugin-services";

export type Locale = "zh-CN" | "en";

export interface NowPlayingConfig {
  autoNotify: boolean;
  locale: Locale;
}

export interface NowPlayingState {
  config: NowPlayingConfig;
  current: NowPlaying | null;
  note: string | null;
  updatedAt: number;
}

export const METHODS = {
  getState: "getState",
  setConfig: "setConfig",
  showNow: "showNow",
  show: "show",
} as const;

export const TOPICS = {
  state: "state",
} as const;

export function detectLocale(): Locale {
  if (typeof navigator !== "undefined" && /^zh\b/i.test(navigator.language)) {
    return "zh-CN";
  }
  return "en";
}

export const TEXT = {
  "zh-CN": {
    title: "正在播放",
    subtitle: "在岛上显示当前播放歌曲的歌名与歌手。",
    autoNotify: "换歌时自动提示",
    autoNotifyDesc: "开启后切歌时自动在岛上弹出歌名和歌手。",
    showNow: "立即显示正在播放",
    nothingPlaying: "当前没有正在播放的歌曲",
    shownOnIsland: "已在岛上提示当前歌曲",
    playingPrefix: "当前曲目：",
    unknownArtist: "未知歌手",
  },
  en: {
    title: "Now playing",
    subtitle: "Show the playing song title and artist on the island.",
    autoNotify: "Notify on track change",
    autoNotifyDesc: "Automatically show a notice on the island whenever the song changes.",
    showNow: "Show now playing now",
    nothingPlaying: "Nothing is playing right now",
    shownOnIsland: "Shown on the island",
    playingPrefix: "Current track: ",
    unknownArtist: "Unknown artist",
  },
} as const;
