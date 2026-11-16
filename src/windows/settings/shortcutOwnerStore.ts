import type { ShortcutOwner } from "./shortcutConflicts.ts";

export interface ShortcutOwnerReport {
  order: number;
  owners: readonly ShortcutOwner[];
  finderOnly?: boolean;
}

export interface ShortcutOwnerSnapshot {
  owners: readonly ShortcutOwner[];
  finderOnly: readonly ShortcutOwner[];
}

const reports = new Map<string, ShortcutOwnerReport>();
const listeners = new Set<() => void>();
const EMPTY: ShortcutOwnerSnapshot = { owners: [], finderOnly: [] };
let snapshot = EMPTY;

function rebuild() {
  const sorted = [...reports.values()].sort((a, b) => a.order - b.order);
  snapshot = {
    owners: sorted.filter((report) => !report.finderOnly).flatMap((report) => report.owners),
    finderOnly: sorted.filter((report) => report.finderOnly).flatMap((report) => report.owners),
  };
  for (const listener of listeners) listener();
}

export function reportShortcutOwners(id: string, report: ShortcutOwnerReport): () => void {
  reports.set(id, report);
  rebuild();
  return () => {
    if (reports.get(id) !== report) return;
    reports.delete(id);
    rebuild();
  };
}

export function subscribeShortcutOwners(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function shortcutOwnerSnapshot(): ShortcutOwnerSnapshot {
  return snapshot;
}
