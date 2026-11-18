import {
  DEFAULT_TRANSLATION_PROVIDER,
  LEGACY_TRANSLATION_PROVIDER,
  isTranslationProvider,
  type TranslationProvider,
} from "./providers.ts";

export type Direction = "auto" | "zh-en" | "en-zh";
export type TranslationSettings = {
  shortcut: string;
  selectionShortcut: string;
  direction: Direction;
  provider: TranslationProvider;
  customBaseUrl: string;
  models: Partial<Record<TranslationProvider, string>>;
  pasteClipboardOnOpen: boolean;
  autoTranslate: boolean;
};
export const STORAGE_KEY = "fuyu-translation-settings";
const LEGACY_DEFAULT_SHORTCUTS = new Set(["Alt+Space", "Alt+C"]);
const DEFAULT_SELECTION_SHORTCUT = "Ctrl+Alt+T";

export const DEFAULT_SETTINGS: TranslationSettings = {
  shortcut: "Ctrl+Shift+F",
  selectionShortcut: DEFAULT_SELECTION_SHORTCUT,
  direction: "auto",
  provider: DEFAULT_TRANSLATION_PROVIDER,
  customBaseUrl: "",
  models: {},
  pasteClipboardOnOpen: true,
  autoTranslate: false,
};

function normalizeModels(value: unknown): TranslationSettings["models"] {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [TranslationProvider, string] =>
        isTranslationProvider(entry[0]) && typeof entry[1] === "string",
    ),
  );
}

function normalizeShortcut(value: unknown, fallback: string, legacyDefaults?: ReadonlySet<string>): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return "";
  return legacyDefaults?.has(trimmed) ? fallback : trimmed;
}

export function normalizeTranslationSettings(stored: unknown): TranslationSettings {
  if (typeof stored !== "object" || stored === null) return DEFAULT_SETTINGS;
  const value = stored as Record<string, unknown>;
  return {
    shortcut: normalizeShortcut(value.shortcut, DEFAULT_SETTINGS.shortcut, LEGACY_DEFAULT_SHORTCUTS),
    direction: value.direction === "zh-en" || value.direction === "en-zh" ? value.direction : "auto",
    provider: isTranslationProvider(value.provider) ? value.provider : LEGACY_TRANSLATION_PROVIDER,
    customBaseUrl: typeof value.customBaseUrl === "string" ? value.customBaseUrl : "",
    models: normalizeModels(value.models),
    selectionShortcut: normalizeShortcut(value.selectionShortcut, DEFAULT_SELECTION_SHORTCUT),
    pasteClipboardOnOpen: value.pasteClipboardOnOpen !== false,
    autoTranslate: value.autoTranslate === true,
  };
}

export function loadSettings(): TranslationSettings {
  try {
    return normalizeTranslationSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveTranslationSettings(settings: TranslationSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
