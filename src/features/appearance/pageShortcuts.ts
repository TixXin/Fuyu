import { buildShortcutFromEvent, normalizeShortcutKeyLabel, type ShortcutKeyboardEvent } from "../clipboard/shortcut.ts";

export const DEFAULT_PAGE_DIGIT_MODIFIERS = "Alt";
export const DEFAULT_PAGE_NEXT_SHORTCUT = "Ctrl+Tab";
export const DEFAULT_PAGE_PREVIOUS_SHORTCUT = "Ctrl+Shift+Tab";

const MODIFIER_ORDER = ["Ctrl", "Alt", "Shift", "Win"] as const;
const RESERVED_SHORTCUTS = new Set(["Alt+Tab", "Alt+Shift+Tab", "Win+Tab", "Shift+Win+Tab"]);

export function normalizePageDigitModifiers(value: string | undefined) {
  const modifiers = new Set<string>();

  for (const part of value?.split("+") ?? []) {
    const normalized = part.trim().toLowerCase();
    if (!normalized) continue;
    if (normalized === "ctrl" || normalized === "control") modifiers.add("Ctrl");
    else if (normalized === "alt" || normalized === "option") modifiers.add("Alt");
    else if (normalized === "shift") modifiers.add("Shift");
    else return DEFAULT_PAGE_DIGIT_MODIFIERS;
  }

  if (modifiers.size === 0) return DEFAULT_PAGE_DIGIT_MODIFIERS;
  return MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)).join("+");
}

export function normalizePageCycleShortcut(value: string | undefined, fallback: string) {
  const modifiers = new Set<string>();
  let keyLabel = "";

  for (const part of value?.split("+") ?? []) {
    const normalized = part.trim().toLowerCase();
    if (!normalized) continue;
    if (normalized === "ctrl" || normalized === "control") modifiers.add("Ctrl");
    else if (normalized === "alt" || normalized === "option") modifiers.add("Alt");
    else if (normalized === "shift") modifiers.add("Shift");
    else if (normalized === "win" || normalized === "windows" || normalized === "meta" || normalized === "cmd" || normalized === "super") modifiers.add("Win");
    else if (!keyLabel) {
      const label = normalizeShortcutKeyLabel(part.trim());
      keyLabel = label.toLowerCase() === "tab" ? "Tab" : label;
    }
  }

  if (!keyLabel || modifiers.size === 0) return fallback;
  const shortcut = [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), keyLabel].join("+");
  return RESERVED_SHORTCUTS.has(shortcut) ? fallback : shortcut;
}

export function recordedPageCycleShortcut(value: string | undefined): string | null {
  return normalizePageCycleShortcut(value, "") || null;
}

type DigitEvent = ShortcutKeyboardEvent & { repeat: boolean; code: string };

export function pageDigitFromEvent(event: DigitEvent, modifiers: string | undefined): number | null {
  if (event.repeat || event.metaKey) return null;
  const match = /^Digit([1-9])$/.exec(event.code);
  if (!match) return null;
  const expected = normalizePageDigitModifiers(modifiers);
  const pressed = [
    event.ctrlKey ? "Ctrl" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
  ].filter(Boolean).join("+");
  return pressed === expected ? Number(match[1]) : null;
}

export function pageCycleDirection(
  event: DigitEvent,
  nextShortcut: string | undefined,
  previousShortcut: string | undefined,
): 1 | -1 | null {
  if (event.repeat) return null;
  const pressed = buildShortcutFromEvent(event);
  if (!pressed) return null;
  if (pressed === normalizePageCycleShortcut(previousShortcut, DEFAULT_PAGE_PREVIOUS_SHORTCUT)) return -1;
  if (pressed === normalizePageCycleShortcut(nextShortcut, DEFAULT_PAGE_NEXT_SHORTCUT)) return 1;
  return null;
}

export function digitModifiersFromEvent(event: ShortcutKeyboardEvent & { code: string }): string | null {
  if (event.metaKey) return null;
  if (!/^Digit[1-9]$/.test(event.code) && !/^Numpad[1-9]$/.test(event.code)) return null;
  const pressed = [
    event.ctrlKey ? "Ctrl" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
  ].filter(Boolean).join("+");
  return pressed || null;
}
