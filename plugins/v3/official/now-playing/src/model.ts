import type { NowPlaying } from "@fuyu/plugin-services";

export type ContentMode = "title-artist" | "title" | "title-artist-album";
export type AppMode = "all" | "some";

export interface NoticeConfig {
  version: number;
  autoNotify: boolean;
  durationSec: number;
  content: ContentMode;
  showControls: boolean;
  lastOnly: boolean;
  skipFrontmost: boolean;
  browsers: boolean;
  appMode: AppMode;
  apps: string[];
  seenApps: string[];
}

export interface NoticeState {
  config: NoticeConfig;
  current: NowPlaying | null;
  note: string | null;
  updatedAt: number;
}

export interface TrackNotice {
  title: string;
  body: string;
  durationMs: number;
  iconUrl: string;
  layout: "inline";
  controls: "media" | "none";
}

export const METHODS = {
  getState: "getState",
  setConfig: "setConfig",
  showNow: "showNow",
} as const;

export const TOPICS = { state: "state" } as const;

export const CONFIG_VERSION = 3;
export const OLD_DEFAULT_DURATION = 6;
export const DURATIONS = [3, 6, 10, 15];
export const CONTENT_MODES: ContentMode[] = ["title-artist", "title", "title-artist-album"];
export const POLL_MS = 2500;
export const POLL_IDLE_MS = 30_000;
export const POLL_FALLBACK_MS = 15_000;
export const REREAD_MS = 1500;
export const LAST_ONLY_WAIT_MS = 1200;
export const MAX_SEEN_APPS = 12;
export const HEARD_GRACE_MS = 8000;

export const DEFAULT_CONFIG: NoticeConfig = Object.freeze({
  version: CONFIG_VERSION,
  autoNotify: true,
  durationSec: 3,
  content: "title-artist",
  showControls: true,
  lastOnly: true,
  skipFrontmost: false,
  browsers: false,
  appMode: "all",
  apps: [],
  seenApps: [],
}) as NoticeConfig;

const NOTE = 'fill="none" stroke="#fff" stroke-width="1.8"';
const ICON_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">',
  '<circle cx="12" cy="12" r="11" fill="#4f8cff"/>',
  `<path d="M9 17V7l8-2v10" ${NOTE} stroke-linecap="round" stroke-linejoin="round"/>`,
  `<circle cx="7.5" cy="17" r="2" ${NOTE}/>`,
  `<circle cx="15.5" cy="15" r="2" ${NOTE}/>`,
  "</svg>",
].join("");

export const MUSIC_ICON_URL = `data:image/svg+xml;utf8,${encodeURIComponent(ICON_SVG)}`;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function strings(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

export function normalizeConfig(patch: unknown, base: NoticeConfig = DEFAULT_CONFIG): NoticeConfig {
  const raw = isObject(patch) ? patch : {};
  const flag = (key: "autoNotify" | "showControls" | "lastOnly" | "skipFrontmost" | "browsers") => (typeof raw[key] === "boolean" ? (raw[key] as boolean) : base[key]);
  return {
    version: CONFIG_VERSION,
    autoNotify: flag("autoNotify"),
    durationSec: DURATIONS.includes(raw.durationSec as number) ? (raw.durationSec as number) : base.durationSec,
    content: CONTENT_MODES.includes(raw.content as ContentMode) ? (raw.content as ContentMode) : base.content,
    showControls: flag("showControls"),
    lastOnly: flag("lastOnly"),
    skipFrontmost: flag("skipFrontmost"),
    browsers: flag("browsers"),
    appMode: raw.appMode === "all" || raw.appMode === "some" ? raw.appMode : base.appMode,
    apps: "apps" in raw ? strings(raw.apps, 50) : [...base.apps],
    seenApps: "seenApps" in raw ? strings(raw.seenApps, MAX_SEEN_APPS) : [...base.seenApps],
  };
}

export function readStoredConfig(stored: unknown): NoticeConfig {
  const config = normalizeConfig(stored, DEFAULT_CONFIG);
  if (!isObject(stored)) return config;
  const version = typeof stored.version === "number" ? stored.version : 1;
  const durationSec = version < 2 && stored.durationSec === OLD_DEFAULT_DURATION ? DEFAULT_CONFIG.durationSec : config.durationSec;
  const skipFrontmost = version < 3 ? DEFAULT_CONFIG.skipFrontmost : config.skipFrontmost;
  return { ...config, durationSec, skipFrontmost };
}

export function trackKey(track: Partial<NowPlaying> | null | undefined): string | null {
  const title = typeof track?.title === "string" ? track.title.trim() : "";
  if (!title) return null;
  const artist = typeof track?.artist === "string" ? track.artist.trim() : "";
  return `${title}\n${artist}`;
}

export function pollDelay(readFailed: boolean, eventsSeen: boolean): number {
  if (readFailed) return POLL_IDLE_MS;
  return eventsSeen ? POLL_FALLBACK_MS : POLL_MS;
}

export function isHeard(track: Pick<NowPlaying, "playing">, lastHeardAt: number, now: number): boolean {
  return track.playing || now - lastHeardAt <= HEARD_GRACE_MS;
}

const BROWSER_WORDS = new Set(["chrome", "chromium", "msedge", "edge", "edgemac", "firefox", "safari", "brave", "opera", "vivaldi", "arc", "browser", "thebrowser", "308046b0af4a39cb"]);

export function isBrowser(sourceApp: string | null | undefined): boolean {
  if (typeof sourceApp !== "string") return false;
  return sourceApp.toLowerCase().split(/[^a-z0-9]+/).some((word) => BROWSER_WORDS.has(word));
}

export function appAllowed(sourceApp: string | null | undefined, config: NoticeConfig): boolean {
  const app = typeof sourceApp === "string" ? sourceApp.trim() : "";
  if (config.appMode === "some") return app !== "" && config.apps.includes(app);
  return config.browsers || !isBrowser(app);
}

export function rememberApp(config: NoticeConfig, sourceApp: string | null | undefined): NoticeConfig | null {
  const app = typeof sourceApp === "string" ? sourceApp.trim() : "";
  if (!app || config.seenApps.includes(app)) return null;
  return { ...config, seenApps: [app, ...config.seenApps].slice(0, MAX_SEEN_APPS) };
}

const PLAYERS: readonly [words: readonly string[], zh: string, en: string][] = [
  [["netease", "cloudmusic", "163music"], "网易云音乐", "NetEase Cloud Music"],
  [["qqmusic"], "QQ音乐", "QQ Music"],
  [["kugou"], "酷狗音乐", "KuGou Music"],
  [["kuwo", "kwmusic"], "酷我音乐", "Kuwo Music"],
  [["sodamusic", "soda.music", "qishui", "汽水音乐"], "汽水音乐", "Soda Music"],
  [["migumusic", "咪咕音乐"], "咪咕音乐", "Migu Music"],
  [["spotify"], "Spotify", "Spotify"],
  [["applemusic", "com.apple.music"], "Apple Music", "Apple Music"],
  [["itunes"], "iTunes", "iTunes"],
  [["youtube-music", "youtube music", "youtubemusic", "app.ytmd"], "YouTube Music", "YouTube Music"],
  [["amazonmusic", "amazon music", "amazon.music"], "Amazon Music", "Amazon Music"],
  [["tidal"], "TIDAL", "TIDAL"],
  [["deezer"], "Deezer", "Deezer"],
  [["qobuz"], "Qobuz", "Qobuz"],
  [["lx-music", "lxmusic", "toside.music", "洛雪音乐"], "洛雪音乐", "LX Music"],
  [["saltplayer", "椒盐音乐"], "椒盐音乐", "Salt Player"],
  [["hibymusic", "海贝音乐"], "海贝音乐", "HiBy Music"],
];

const GENERIC_PARTS = new Set(["mac", "macos", "desktop", "client", "app", "player", "music", "win", "windows"]);

export function appLabel(sourceApp: string, locale = "en"): string {
  const lowered = sourceApp.trim().toLowerCase();
  const known = PLAYERS.find(([words]) => words.some((word) => lowered.includes(word)));
  if (known) return locale.toLowerCase().startsWith("zh") ? known[1] : known[2];
  let name = sourceApp.trim();
  const bang = name.lastIndexOf("!");
  if (bang >= 0) name = name.slice(bang + 1);
  name = name.replace(/\.exe$/i, "");
  if (/^[\w-]+(\.[\w-]+)+$/.test(name)) {
    const parts = name.split(".");
    while (parts.length > 2 && GENERIC_PARTS.has(parts[parts.length - 1].toLowerCase())) parts.pop();
    name = parts[parts.length - 1];
  }
  return name || sourceApp;
}

export function buildNotice(track: Partial<NowPlaying> | null | undefined, config: NoticeConfig): TrackNotice | null {
  const title = typeof track?.title === "string" ? track.title.trim() : "";
  if (!title) return null;
  const artist = typeof track?.artist === "string" ? track.artist.trim() : "";
  const album = typeof track?.album === "string" ? track.album.trim() : "";
  let body = "";
  if (config.content === "title-artist") body = artist;
  if (config.content === "title-artist-album") body = [artist, album].filter(Boolean).join(" · ");
  return {
    title,
    body,
    durationMs: config.durationSec * 1000,
    iconUrl: MUSIC_ICON_URL,
    layout: "inline",
    controls: config.showControls ? "media" : "none",
  };
}
