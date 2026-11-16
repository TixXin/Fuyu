import { isMacOS } from "../../lib/platform.ts";
import { buildShortcutFromEvent, isEditableTarget, normalizeShortcutKeyLabel, shortcutLabel } from "../../lib/shortcut/shortcut.ts";

export const DEFAULT_CLIPBOARD_SHORTCUT = isMacOS ? "Shift+Win+V" : "Ctrl+Shift+W";

export function openShortcutLabel(settings: { shortcut: string; shortcutEnabled: boolean; winV: boolean }, mac = isMacOS): string | null {
  if (settings.winV && !mac) return "Win+V";
  return settings.shortcutEnabled ? shortcutLabel(normalizeClipboardShortcut(settings.shortcut), mac) : null;
}

export function normalizeClipboardShortcut(shortcut: string | undefined) {
  const text = shortcut?.trim();

  if (!text) {
    return DEFAULT_CLIPBOARD_SHORTCUT;
  }

  const parts = text
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const modifiers = new Set<string>();
  let keyLabel = "";

  for (const part of parts) {
    const normalized = part.toLowerCase();

    if (normalized === "ctrl" || normalized === "control") {
      modifiers.add("Ctrl");
    } else if (normalized === "alt" || normalized === "option") {
      modifiers.add("Alt");
    } else if (normalized === "shift") {
      modifiers.add("Shift");
    } else if (
      normalized === "win" ||
      normalized === "windows" ||
      normalized === "meta" ||
      normalized === "cmd" ||
      normalized === "super"
    ) {
      modifiers.add("Win");
    } else if (!keyLabel) {
      keyLabel = normalizeShortcutKeyLabel(part);
    }
  }

  if (!keyLabel || modifiers.size === 0) {
    return DEFAULT_CLIPBOARD_SHORTCUT;
  }

  return ["Ctrl", "Alt", "Shift", "Win"]
    .filter((modifier) => modifiers.has(modifier))
    .concat(keyLabel)
    .join("+");
}

export function matchesClipboardShortcut(
  event: KeyboardEvent,
  shortcut: string | undefined,
) {
  if (isEditableTarget(event.target)) {
    return false;
  }

  return (
    buildShortcutFromEvent(event) === normalizeClipboardShortcut(shortcut)
  );
}
