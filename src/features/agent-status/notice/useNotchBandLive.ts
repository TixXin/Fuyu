import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  const root = document.documentElement;
  const observer = new MutationObserver(onStoreChange);
  observer.observe(root, { attributes: true, attributeFilter: ["data-island-notch"] });
  return () => observer.disconnect();
}

function snapshot() {
  return document.documentElement.dataset.islandNotch === "on";
}

export function useNotchBandLive() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
