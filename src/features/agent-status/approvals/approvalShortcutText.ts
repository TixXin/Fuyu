import { isMacOS } from "../../../lib/platform.ts";
import { shortcutLabel } from "../../clipboard/shortcut.ts";

const ARIA_NAMES: Readonly<Record<string, string>> = { Ctrl: "Control", Win: "Meta" };

function parts(shortcut: string) {
  return shortcut.split("+").filter(Boolean);
}

export function shortcutKey(shortcut: string) {
  return parts(shortcut).pop() ?? "";
}

export function shortcutModifiers(shortcut: string, mac = isMacOS) {
  const list = parts(shortcut);
  if (list.length < 2) return "";
  if (!mac) return `${list.slice(0, -1).join("+")}+`;
  const label = shortcutLabel(shortcut, true);
  return label.slice(0, label.length - shortcutKey(shortcut).length);
}

export function shortcutTitle(shortcut: string | undefined, mac = isMacOS) {
  return shortcut ? shortcutLabel(shortcut, mac) : "";
}

export function ariaShortcut(shortcut: string | undefined) {
  return shortcut ? parts(shortcut).map((part) => ARIA_NAMES[part] ?? part).join("+") : undefined;
}
