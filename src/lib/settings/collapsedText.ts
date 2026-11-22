import { useEffect, useMemo, useState } from "react";
import type { LyricsIslandPriority } from "./lyricsSettings";

export const COLLAPSED_TEXT_KEY = "fuyu-collapsed-text";
const VERSION = 1;

export const NOTCH_TEXT_KINDS = ["todos", "lyrics", "agent", "meeting"] as const;
export const NOTCH_TEXT_MODES = ["panel", "row", "flash", "off"] as const;

export type NotchTextKind = (typeof NOTCH_TEXT_KINDS)[number];
export type NotchTextMode = (typeof NOTCH_TEXT_MODES)[number];
export type NotchTextModes = Record<NotchTextKind, NotchTextMode>;
export type TextOrder = readonly NotchTextKind[];

export type CollapsedText = { notch: NotchTextModes; order: TextOrder | null; hidden: readonly NotchTextKind[] };

export const DEFAULT_NOTCH_TEXT: NotchTextModes = { todos: "panel", lyrics: "panel", agent: "panel", meeting: "panel" };
const DEFAULT_TEXT: CollapsedText = { notch: DEFAULT_NOTCH_TEXT, order: null, hidden: [] };

const isMode = (value: unknown): value is NotchTextMode => typeof value === "string" && (NOTCH_TEXT_MODES as readonly string[]).includes(value);
const isKind = (value: unknown): value is NotchTextKind => typeof value === "string" && (NOTCH_TEXT_KINDS as readonly string[]).includes(value);

function kinds(value: unknown): NotchTextKind[] {
  return Array.isArray(value) ? [...new Set(value.filter(isKind))] : [];
}

export function readCollapsedText(raw: string | null): CollapsedText {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (typeof value !== "object" || value === null || (value as { version?: unknown }).version !== VERSION) return DEFAULT_TEXT;
    const { notch, order, hidden } = value as { notch?: unknown; order?: unknown; hidden?: unknown };
    const stored = typeof notch === "object" && notch !== null ? notch as Record<string, unknown> : {};
    const modes = { ...DEFAULT_NOTCH_TEXT };
    for (const kind of NOTCH_TEXT_KINDS) if (isMode(stored[kind])) modes[kind] = stored[kind];
    const sorted = kinds(order);
    return { notch: modes, order: sorted.length > 0 ? sorted : null, hidden: kinds(hidden) };
  } catch {
    return DEFAULT_TEXT;
  }
}

export function readNotchText(raw: string | null): NotchTextModes {
  return { ...readCollapsedText(raw).notch };
}

export function textOrder(order: TextOrder | null, lyricsPriority: LyricsIslandPriority): TextOrder {
  const fallback: TextOrder = lyricsPriority === "agent" ? ["meeting", "agent", "lyrics", "todos"] : ["meeting", "lyrics", "agent", "todos"];
  if (!order) return fallback;
  return [...order, ...fallback.filter((kind) => !order.includes(kind))];
}

export function lyricsBeforeAgent(order: TextOrder) {
  return order.indexOf("lyrics") < order.indexOf("agent");
}

export function loadCollapsedText(): CollapsedText {
  return readCollapsedText(localStorage.getItem(COLLAPSED_TEXT_KEY));
}

export function loadNotchText(): NotchTextModes {
  return { ...loadCollapsedText().notch };
}

export function saveCollapsedText(change: Partial<CollapsedText>) {
  const next = { ...loadCollapsedText(), ...change };
  const plain = NOTCH_TEXT_KINDS.every((kind) => next.notch[kind] === DEFAULT_NOTCH_TEXT[kind]) && next.order === null && next.hidden.length === 0;
  if (plain) localStorage.removeItem(COLLAPSED_TEXT_KEY);
  else {
    localStorage.setItem(COLLAPSED_TEXT_KEY, JSON.stringify({
      version: VERSION,
      notch: next.notch,
      ...(next.order && { order: next.order }),
      ...(next.hidden.length > 0 && { hidden: next.hidden }),
    }));
  }
  window.dispatchEvent(new StorageEvent("storage", { key: COLLAPSED_TEXT_KEY }));
}

export function saveNotchText(notch: NotchTextModes) {
  saveCollapsedText({ notch });
}

export function useCollapsedText(): CollapsedText {
  const [text, setText] = useState(loadCollapsedText);
  useEffect(() => {
    const follow = (event: StorageEvent) => {
      if (event.key === COLLAPSED_TEXT_KEY || event.key === null) setText(loadCollapsedText());
    };
    window.addEventListener("storage", follow);
    return () => window.removeEventListener("storage", follow);
  }, []);
  return text;
}

export function useNotchTextModes(): NotchTextModes {
  return useCollapsedText().notch;
}

export function useTextOrder(lyricsPriority: LyricsIslandPriority): { order: TextOrder; hidden: readonly NotchTextKind[] } {
  const { order, hidden } = useCollapsedText();
  return useMemo(() => ({ order: textOrder(order, lyricsPriority), hidden }), [order, hidden, lyricsPriority]);
}
