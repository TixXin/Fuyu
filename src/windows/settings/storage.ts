import { writeJson } from "../../lib/storage.ts";

export const SETTINGS_FOCUS_STORAGE_KEY = "fuyu-settings-focus";

export type SettingsFocusSection = "savePath" | "translation" | "music" | "calendar" | "mail" | "updates" | "agentConnect";

const FOCUS_SECTIONS: readonly SettingsFocusSection[] = ["savePath", "translation", "music", "calendar", "mail", "updates", "agentConnect"];

export const FOCUS_REQUEST_MAX_AGE_MS = 10_000;

export function takeFocusRequest(): SettingsFocusSection | null {
  const stored = window.localStorage.getItem(SETTINGS_FOCUS_STORAGE_KEY);

  if (stored === null) {
    return null;
  }

  window.localStorage.removeItem(SETTINGS_FOCUS_STORAGE_KEY);

  try {
    const request = JSON.parse(stored) as {
      section?: unknown;
      requestedAt?: unknown;
    };

    const section = FOCUS_SECTIONS.find((known) => known === request.section);
    return section !== undefined &&
      typeof request.requestedAt === "number" &&
      Date.now() - request.requestedAt < FOCUS_REQUEST_MAX_AGE_MS
      ? section
      : null;
  } catch {
    return null;
  }
}

export function requestSettingsFocus(section: SettingsFocusSection) {
  window.localStorage.setItem(
    SETTINGS_FOCUS_STORAGE_KEY,
    JSON.stringify({ section, requestedAt: Date.now() }),
  );
}

export const ISLAND_POSITION_RESET_STORAGE_KEY = "fuyu-position-reset";

const POSITION_RESET_MAX_AGE_MS = 5_000;

export function requestIslandPositionReset() {
  writeJson(ISLAND_POSITION_RESET_STORAGE_KEY, { requestedAt: Date.now() });
}

export function isFreshPositionReset(stored: string | null, now = Date.now()) {
  if (stored === null) {
    return false;
  }

  try {
    const request = JSON.parse(stored) as { requestedAt?: unknown };
    return typeof request.requestedAt === "number" && now - request.requestedAt < POSITION_RESET_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export const PANEL_PREVIEW_STORAGE_KEY = "fuyu-panel-preview";

export type PanelPreviewMode = "expanded" | "collapsed";

const PANEL_PREVIEW_MAX_AGE_MS = 2_000;

export function requestPanelPreview(mode: PanelPreviewMode) {
  writeJson(PANEL_PREVIEW_STORAGE_KEY, { mode, requestedAt: Date.now() });
}

export function parsePanelPreview(stored: string | null, now = Date.now()): PanelPreviewMode | null {
  if (stored === null) {
    return null;
  }

  try {
    const request = JSON.parse(stored) as { mode?: unknown; requestedAt?: unknown };

    return (request.mode === "expanded" || request.mode === "collapsed") &&
      typeof request.requestedAt === "number" &&
      now - request.requestedAt < PANEL_PREVIEW_MAX_AGE_MS
      ? request.mode
      : null;
  } catch {
    return null;
  }
}
