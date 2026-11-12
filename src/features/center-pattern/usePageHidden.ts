import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

export function usePageHidden(): boolean {
  return useSyncExternalStore(subscribe, () => document.hidden, () => false);
}
