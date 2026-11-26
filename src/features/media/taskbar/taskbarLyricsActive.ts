import type { TaskbarLyricsFeed } from "./api";

export const TASKBAR_LYRICS_WIDTH = 280;
export const TASKBAR_LYRICS_ICON_WIDTH = 40;

export function taskbarLyricsActive(feed: TaskbarLyricsFeed | null): boolean {
  return feed !== null && feed.state.playbackStatus !== "unavailable" && Boolean(feed.state.title);
}

export function taskbarLyricsWidth(feed: TaskbarLyricsFeed | null): number | null {
  if (taskbarLyricsActive(feed)) return TASKBAR_LYRICS_WIDTH;
  return feed?.idle === "icon" ? TASKBAR_LYRICS_ICON_WIDTH : null;
}
