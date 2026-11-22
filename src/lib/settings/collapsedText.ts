import { useEffect, useState } from "react";

export const COLLAPSED_TEXT_KEY = "fuyu-collapsed-text";
const VERSION = 1;

export const NOTCH_TEXT_KINDS = ["todos", "lyrics", "agent", "meeting"] as const;
export const NOTCH_TEXT_MODES = ["panel", "row", "flash", "off"] as const;

export type NotchTextKind = (typeof NOTCH_TEXT_KINDS)[number];
export type NotchTextMode = (typeof NOTCH_TEXT_MODES)[number];
export type NotchTextModes = Record<NotchTextKind, NotchTextMode>;

export const DEFAULT_NOTCH_TEXT: NotchTextModes = { todos: "panel", lyrics: "panel", agent: "panel", meeting: "panel" };

const isMode = (value: unknown): value is NotchTextMode => typeof value === "string" && (NOTCH_TEXT_MODES as readonly string[]).includes(value);

export function readNotchText(raw: string | null): NotchTextModes {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (typeof value !== "object" || value === null || (value as { version?: unknown }).version !== VERSION) return { ...DEFAULT_NOTCH_TEXT };
    const notch = (value as { notch?: unknown }).notch;
    const stored = typeof notch === "object" && notch !== null ? notch as Record<string, unknown> : {};
    const modes = { ...DEFAULT_NOTCH_TEXT };
    for (const kind of NOTCH_TEXT_KINDS) if (isMode(stored[kind])) modes[kind] = stored[kind];
    return modes;
  } catch {
    return { ...DEFAULT_NOTCH_TEXT };
  }
}

export function loadNotchText(): NotchTextModes {
  return readNotchText(localStorage.getItem(COLLAPSED_TEXT_KEY));
}

export function saveNotchText(modes: NotchTextModes) {
  if (NOTCH_TEXT_KINDS.every((kind) => modes[kind] === DEFAULT_NOTCH_TEXT[kind])) localStorage.removeItem(COLLAPSED_TEXT_KEY);
  else localStorage.setItem(COLLAPSED_TEXT_KEY, JSON.stringify({ version: VERSION, notch: modes }));
  window.dispatchEvent(new StorageEvent("storage", { key: COLLAPSED_TEXT_KEY }));
}

export function useNotchTextModes(): NotchTextModes {
  const [modes, setModes] = useState(loadNotchText);
  useEffect(() => {
    const follow = (event: StorageEvent) => {
      if (event.key === COLLAPSED_TEXT_KEY || event.key === null) setModes(loadNotchText());
    };
    window.addEventListener("storage", follow);
    return () => window.removeEventListener("storage", follow);
  }, []);
  return modes;
}
