import type { SettingsCategory } from "./categories";

export type ShortcutOwner = { id: string; label: string; shortcut: string; home?: SettingsCategory };

const MODIFIER_ALIASES: Record<string, string> = {
  control: "ctrl",
  ctrl: "ctrl",
  alt: "alt",
  shift: "shift",
  win: "win",
  meta: "win",
  super: "win",
};

export function shortcutKey(shortcut: string) {
  const parts = shortcut.split("+").map((part) => part.trim().toLowerCase()).filter(Boolean);
  const key = parts.pop() ?? "";
  const modifiers = [...new Set(parts.map((part) => MODIFIER_ALIASES[part] ?? part))].sort();
  return [...modifiers, key].join("+");
}

export function findShortcutOwnerRow(shortcut: string, owners: readonly ShortcutOwner[], selfId: string) {
  const wanted = shortcutKey(shortcut);
  return owners.find((owner) => owner.id !== selfId && shortcutKey(owner.shortcut) === wanted);
}

export function findShortcutOwner(shortcut: string, owners: readonly ShortcutOwner[], selfId: string) {
  return findShortcutOwnerRow(shortcut, owners, selfId)?.label ?? null;
}
