export const SHORTCUT_ACTIONS = ["region", "copy", "text", "translate", "fullscreen", "pins"] as const;
export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

export const CARD_SECONDS = [0, 3, 5, 8, 15, 30] as const;
export type CardSeconds = (typeof CARD_SECONDS)[number];

export type ScreenshotSettings = {
  shortcuts: Record<ShortcutAction, string>;
  printScreen: boolean;
  saveFolder: string;
  cardSeconds: CardSeconds;
  version: 2;
};

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  region: "Ctrl+Shift+1",
  copy: "Ctrl+Shift+2",
  text: "Ctrl+Shift+3",
  translate: "Ctrl+Shift+4",
  fullscreen: "Ctrl+Shift+7",
  pins: "",
};

export const DEFAULT_SCREENSHOT_SETTINGS: ScreenshotSettings = {
  shortcuts: DEFAULT_SHORTCUTS,
  printScreen: false,
  saveFolder: "",
  cardSeconds: 3,
  version: 2,
};

const MAX_FOLDER_CHARS = 1024;

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
    version: 2,
  };
}

export function shortcutConfig(settings: ScreenshotSettings) {
  return SHORTCUT_ACTIONS.map((action) => ({ action, shortcut: settings.shortcuts[action] }));
}

export function saveFolderOf(settings: ScreenshotSettings) {
  return settings.saveFolder || undefined;
}
