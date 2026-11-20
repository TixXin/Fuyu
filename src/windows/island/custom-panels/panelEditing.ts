import { useSyncExternalStore } from "react";

export const PANEL_EDIT_GROW = { width: 80, height: 96 } as const;

export function editGrowWidth(islandWidth: number, scale: number): number {
  const screen = window.screen as Screen & { availLeft?: number };
  const left = screen.availLeft ?? 0;
  const center = window.screenX + window.innerWidth / 2;
  const half = (islandWidth * scale) / 2;
  const room = Math.min(center - half - left, left + screen.availWidth - (center + half));
  const grow = Math.floor((room / (scale || 1)) * 2);
  return Math.max(0, Math.min(PANEL_EDIT_GROW.width, grow));
}

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
