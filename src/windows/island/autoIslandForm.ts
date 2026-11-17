import { isTauri } from "@tauri-apps/api/core";
import { useSyncExternalStore } from "react";
import { getIslandAutoForm, listenIslandAutoForm } from "./api.ts";
import type { ShownIslandForm } from "./islandForm.ts";

let current: ShownIslandForm | null = null;
const listeners = new Set<() => void>();

function applyAutoIslandForm(form: ShownIslandForm | null) {
  if (form === current) return;
  current = form;
  listeners.forEach((listener) => listener());
}

export function trackAutoIslandForm() {
  if (!isTauri()) return;

  void listenIslandAutoForm(applyAutoIslandForm)
    .then(() => getIslandAutoForm())
    .then(applyAutoIslandForm)
    .catch((error: unknown) => {
      console.error("Failed to track the automatic island form", error);
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAutoIslandForm(): ShownIslandForm | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
