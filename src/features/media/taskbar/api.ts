import { invoke } from "@tauri-apps/api/core";
import { emitTo, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { TaskbarLyricsContent, TaskbarLyricsIdle } from "../../../lib/settings/lyricsSettings";
import type { MediaState } from "../api";
import type { LyricLine } from "../lyrics/lrc";
import type { KaraokeOptions } from "../lyrics/useCurrentLyric";

export const TASKBAR_LYRICS_WINDOW = "taskbar-lyrics";
const ISLAND_WINDOW = "main";
const FEED_EVENT = "taskbar-lyrics-feed";
const REQUEST_EVENT = "taskbar-lyrics-request";

export type TaskbarLyricsFeed = {
  state: MediaState;
  lines: LyricLine[] | null;
  offsetMs: number;
  karaoke: KaraokeOptions;
  content: TaskbarLyricsContent;
  idle: TaskbarLyricsIdle;
};

const REQUESTS = ["sync", "previous", "play-pause", "next", "open"] as const;

export type TaskbarLyricsRequest = (typeof REQUESTS)[number];

function readFeed(payload: unknown): TaskbarLyricsFeed | null {
  if (!payload || typeof payload !== "object") return null;
  const feed = payload as Partial<Record<keyof TaskbarLyricsFeed, unknown>>;
  if (!feed.state || typeof feed.state !== "object") return null;
  if (feed.lines !== null && !Array.isArray(feed.lines)) return null;
  return {
    state: feed.state as MediaState,
    lines: feed.lines as LyricLine[] | null,
    offsetMs: typeof feed.offsetMs === "number" && Number.isFinite(feed.offsetMs) ? feed.offsetMs : 0,
    karaoke: feed.karaoke && typeof feed.karaoke === "object" ? (feed.karaoke as KaraokeOptions) : null,
    content: feed.content === "song" || feed.content === "lyrics" ? feed.content : "both",
    idle: feed.idle === "icon" ? "icon" : "hide",
  };
}

function readRequest(payload: unknown): TaskbarLyricsRequest | null {
  return REQUESTS.find((request) => request === payload) ?? null;
}

export function currentWindowLabel(): string {
  return getCurrentWebviewWindow().label;
}

let openQueue: Promise<void> = Promise.resolve();

export function setTaskbarLyricsOpen(open: boolean): Promise<void> {
  const next = openQueue.then(() => invoke<void>("set_taskbar_lyrics", { open }));
  openQueue = next.catch(() => undefined);
  return next;
}

export function showTaskbarLyrics(shown: boolean) {
  return invoke<void>("show_taskbar_lyrics", { shown });
}

export function sendTaskbarLyricsFeed(feed: TaskbarLyricsFeed) {
  return emitTo(TASKBAR_LYRICS_WINDOW, FEED_EVENT, feed);
}

export function listenTaskbarLyricsFeed(handler: (feed: TaskbarLyricsFeed) => void): Promise<UnlistenFn> {
  return getCurrentWebviewWindow().listen<unknown>(FEED_EVENT, ({ payload }) => {
    const feed = readFeed(payload);
    if (feed) handler(feed);
  });
}

export function askIsland(request: TaskbarLyricsRequest) {
  return emitTo(ISLAND_WINDOW, REQUEST_EVENT, request);
}

export function listenTaskbarLyricsRequests(handler: (request: TaskbarLyricsRequest) => void): Promise<UnlistenFn> {
  return getCurrentWebviewWindow().listen<unknown>(REQUEST_EVENT, ({ payload }) => {
    const request = readRequest(payload);
    if (request) handler(request);
  });
}
