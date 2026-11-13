export const SHORTCUT_ACTIONS = ["region", "copy", "text", "translate", "long", "record", "fullscreen", "pins"] as const;
export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

export const CARD_SECONDS = [0, 3, 5, 8, 15, 30] as const;
export type CardSeconds = (typeof CARD_SECONDS)[number];

export const HISTORY_DAYS = [1, 7, 30, 90] as const;
export type HistoryDays = (typeof HISTORY_DAYS)[number];

export const RECORD_FPS = [30, 60] as const;
export type RecordFps = (typeof RECORD_FPS)[number];
export const RECORD_QUALITIES = ["standard", "high"] as const;
export type RecordQuality = (typeof RECORD_QUALITIES)[number];
export const RECORD_FORMATS = ["mp4", "gif"] as const;
export type RecordFormat = (typeof RECORD_FORMATS)[number];

export type RecordSettings = {
  fps: RecordFps;
  quality: RecordQuality;
  systemAudio: boolean;
  microphone: boolean;
  format: RecordFormat;
};

export type ScreenshotSettings = {
  shortcuts: Record<ShortcutAction, string>;
  printScreen: boolean;
  saveFolder: string;
  cardSeconds: CardSeconds;
  historyDays: HistoryDays;
  record: RecordSettings;
  version: 2;
};

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  region: "Ctrl+Shift+1",
  copy: "Ctrl+Shift+2",
  text: "Ctrl+Shift+3",
  translate: "Ctrl+Shift+4",
  long: "Ctrl+Shift+5",
  record: "Ctrl+Shift+6",
  fullscreen: "Ctrl+Shift+7",
  pins: "",
};

export const DEFAULT_SCREENSHOT_SETTINGS: ScreenshotSettings = {
  shortcuts: DEFAULT_SHORTCUTS,
  printScreen: false,
  saveFolder: "",
  cardSeconds: 3,
  historyDays: 7,
  record: { fps: 30, quality: "standard", systemAudio: true, microphone: false, format: "mp4" },
  version: 2,
};

const MAX_FOLDER_CHARS = 1024;

function oneOf<T>(choices: readonly T[], value: unknown, fallback: T): T {
  return (choices as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

function recordOf(value: unknown): RecordSettings {
  const saved = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const fallback = DEFAULT_SCREENSHOT_SETTINGS.record;
  return {
    fps: oneOf(RECORD_FPS, saved.fps, fallback.fps),
    quality: oneOf(RECORD_QUALITIES, saved.quality, fallback.quality),
    systemAudio: typeof saved.systemAudio === "boolean" ? saved.systemAudio : fallback.systemAudio,
    microphone: saved.microphone === true,
    format: oneOf(RECORD_FORMATS, saved.format, fallback.format),
  };
}

function shortcutOf(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length <= 64 ? trimmed : fallback;
}

export function normalizeScreenshotSettings(value: unknown): ScreenshotSettings {
  const saved = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const shortcuts = saved.shortcuts && typeof saved.shortcuts === "object" ? (saved.shortcuts as Record<string, unknown>) : {};
  const folder = typeof saved.saveFolder === "string" ? saved.saveFolder.trim() : "";
  return {
    shortcuts: Object.fromEntries(SHORTCUT_ACTIONS.map((action) => [action, shortcutOf(shortcuts[action], DEFAULT_SHORTCUTS[action])])) as Record<ShortcutAction, string>,
    printScreen: saved.printScreen === true,
    saveFolder: folder.length <= MAX_FOLDER_CHARS ? folder : "",
    cardSeconds: saved.version === 2 && (CARD_SECONDS as readonly unknown[]).includes(saved.cardSeconds) ? (saved.cardSeconds as CardSeconds) : DEFAULT_SCREENSHOT_SETTINGS.cardSeconds,
    historyDays: (HISTORY_DAYS as readonly unknown[]).includes(saved.historyDays) ? (saved.historyDays as HistoryDays) : DEFAULT_SCREENSHOT_SETTINGS.historyDays,
    record: recordOf(saved.record),
    version: 2,
  };
}

export function shortcutConfig(settings: ScreenshotSettings) {
  return SHORTCUT_ACTIONS.map((action) => ({ action, shortcut: settings.shortcuts[action] }));
}

export function saveFolderOf(settings: ScreenshotSettings) {
  return settings.saveFolder || undefined;
}
