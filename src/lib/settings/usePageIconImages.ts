import { useSyncExternalStore } from "react";
import { loadPageIconImages, PAGE_ICON_IMAGES_KEY, savePageIconImages, type PageIconImage } from "./pageIconStore.ts";

let cache: PageIconImage[] | null = null;
const listeners = new Set<() => void>();

const snapshot = () => (cache ??= loadPageIconImages());
const notify = () => {
  for (const listener of listeners) listener();
};
const onStorage = (event: StorageEvent) => {
  if (event.key !== PAGE_ICON_IMAGES_KEY && event.key !== null) return;
  cache = null;
  notify();
};

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function writePageIconImages(images: readonly PageIconImage[]): boolean {
  const ok = savePageIconImages(images);
  cache = null;
  notify();
  return ok;
}

export function usePageIconImages(): readonly PageIconImage[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function usePageIconImage(id: string): PageIconImage | undefined {
  return usePageIconImages().find((image) => image.id === id);
}
