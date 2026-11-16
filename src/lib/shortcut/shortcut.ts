import { isMacOS } from "../platform.ts";

const MAC_SYMBOLS: Readonly<Record<string, string>> = { Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Win: "⌘" };
const MAC_ORDER = ["Ctrl", "Alt", "Shift", "Win"];

export const PRIMARY_KEY = isMacOS ? "⌘" : "Ctrl";

export function isPrimaryKey(event: { ctrlKey: boolean; metaKey: boolean }, mac = isMacOS) {
  return event.ctrlKey || (mac && event.metaKey);
}

export function shortcutLabel(shortcut: string, mac = isMacOS) {
  if (!mac) return shortcut;
  const parts = shortcut.split("+").filter(Boolean);
  const key = parts.filter((part) => !(part in MAC_SYMBOLS)).join("+");
  const modifiers = MAC_ORDER.filter((name) => parts.includes(name)).map((name) => MAC_SYMBOLS[name]);
  return modifiers.join("") + key;
}

export type ShortcutKeyboardEvent = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
> & { code?: string };

function keyFromCode(code: string | undefined) {
  const match = code ? /^(?:Key([A-Z])|Digit([0-9]))$/.exec(code) : null;
  return match ? match[1] ?? match[2] : null;
}

export const MODIFIER_KEY_NAMES = new Set([
  "Alt",
  "AltGraph",
  "Control",
  "Meta",
  "Shift",
]);

export function normalizeShortcutKeyLabel(key: string) {
  if (key === " " || key === "Spacebar") {
    return "Space";
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  switch (key) {
    case "Escape":
      return "Esc";
    case "ArrowUp":
      return "Up";
    case "ArrowDown":
      return "Down";
    case "ArrowLeft":
      return "Left";
    case "ArrowRight":
      return "Right";
    default:
      return key;
  }
}

export function buildShortcutFromEvent(event: ShortcutKeyboardEvent) {
  if (MODIFIER_KEY_NAMES.has(event.key)) {
    return null;
  }

  const parts: string[] = [];

  if (event.ctrlKey) {
    parts.push("Ctrl");
  }

  if (event.altKey) {
    parts.push("Alt");
  }

  if (event.shiftKey) {
    parts.push("Shift");
  }

  if (event.metaKey) {
    parts.push("Win");
  }

  if (parts.length === 0) {
    return null;
  }

  parts.push(keyFromCode(event.code) ?? normalizeShortcutKeyLabel(event.key));
  return parts.join("+");
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
