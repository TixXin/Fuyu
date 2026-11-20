import { useSyncExternalStore } from "react";

let editing: string | null = null;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

export function editingPanel(): string | null {
  return editing;
}

export function isPanelEditing(): boolean {
  return editing !== null;
}

export function startPanelEditing(panel: string) {
  if (editing === panel) return;
  editing = panel;
  document.documentElement.dataset.panelEditing = "true";
  notify();
}

export function stopPanelEditing() {
  if (editing === null) return;
  editing = null;
  delete document.documentElement.dataset.panelEditing;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePanelEditing(): string | null {
  return useSyncExternalStore(subscribe, editingPanel, editingPanel);
}
