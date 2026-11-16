import { readString, writeString } from "../../lib/storage.ts";

export const TRAY_MENU_LAYOUT_KEY = "fuyu-tray-menu-layout";

export const TRAY_MENU_LAYOUTS = ["entry", "status", "compact"] as const;

export type TrayMenuLayout = (typeof TRAY_MENU_LAYOUTS)[number];

export function normalizeTrayMenuLayout(value: unknown): TrayMenuLayout {
  return TRAY_MENU_LAYOUTS.find((layout) => layout === value) ?? "entry";
}

export function loadTrayMenuLayout(): TrayMenuLayout {
  return normalizeTrayMenuLayout(readString(TRAY_MENU_LAYOUT_KEY));
}

export function saveTrayMenuLayout(layout: TrayMenuLayout) {
  return writeString(TRAY_MENU_LAYOUT_KEY, layout);
}
