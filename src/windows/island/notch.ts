import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useSyncExternalStore } from "react";
import type { IslandSettings } from "../../features/appearance/types";
import { themeColors } from "../../features/appearance/themeMode";
import { getIslandNotch, listenIslandNotch, setIslandNotchDrop, type IslandNotch } from "./api.ts";
import { MIN_COLLAPSED_ISLAND_WIDTH } from "./layout.ts";
import "./IslandNotch.css";

export const NOTCH_WING = 56;
export const MAX_NOTCH_WING = 100;

let current: IslandNotch | null = null;
const listeners = new Set<() => void>();

export function applyIslandNotch(notch: IslandNotch | null) {
  current = notch;
  const root = document.documentElement;
  if (notch) {
    root.dataset.islandNotch = "on";
    root.style.setProperty("--island-notch-width", `${notch.width}px`);
    root.style.setProperty("--island-notch-height", `${notch.height}px`);
  } else {
    delete root.dataset.islandNotch;
    root.style.removeProperty("--island-notch-width");
    root.style.removeProperty("--island-notch-height");
  }
  listeners.forEach((listener) => listener());
}

export function trackIslandNotch() {
  if (!isTauri()) return;

  void listenIslandNotch(applyIslandNotch)
    .then(() => getIslandNotch())
    .then(applyIslandNotch)
    .catch((error) => {
      console.error("Failed to track the notch", error);
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useIslandNotch(): IslandNotch | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

export function notchFittedWidth(width: number, notch: IslandNotch | null, collapsedScale: number) {
  if (!notch) return width;
  const gap = Math.ceil(notch.width / Math.max(collapsedScale, 0.01));
  const wing = Math.min(MAX_NOTCH_WING, Math.max(NOTCH_WING, NOTCH_WING + width - MIN_COLLAPSED_ISLAND_WIDTH));
  return gap + 2 * wing;
}

export const NOTCH_CONTENT_GAP = 8;
const EXPANDED_TOP_PADDING = 18;
const POPUP_TOP_PADDING = 8;

export function notchExpandedExtra(notch: IslandNotch | null, expandedScale: number, popup: boolean) {
  if (!notch) return 0;
  const inset = notch.height / Math.max(expandedScale, 0.01) + NOTCH_CONTENT_GAP;
  return Math.max(0, Math.ceil(inset - (popup ? POPUP_TOP_PADDING : EXPANDED_TOP_PADDING)));
}

export function notchLook(settings: IslandSettings): IslandSettings {
  return { ...settings, ...themeColors(settings, "dark"), islandBackgroundColor: "#000000", opacity: 100 };
}

export type NotchDropSources = {
  preview: unknown;
  notice: unknown;
  deviceAlert: unknown;
  quotaAlert: unknown;
  levelPopup: unknown;
  translationPeek: unknown;
};

export function hasNotchDrop(sources: NotchDropSources) {
  return Object.values(sources).some(Boolean);
}

export function useNotchDropSync(drop: boolean) {
  useEffect(() => {
    if (!isTauri()) return;
    void setIslandNotchDrop(drop).catch((error) => console.error("Failed to sync the notch row", error));
  }, [drop]);
}
